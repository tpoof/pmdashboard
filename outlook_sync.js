/* ============================================================
   OUTLOOK SYNC — LEAF Team Command Center
   Additive module: does not modify calendar.js's own data model or
   rendering logic. Talks to calendar.js only through the small hook
   object it exposes on window.LeafCalendarOutlookSync (init/onEntrySaved),
   and the mergeEntries()/reloadLeafEntries()/render() callbacks calendar.js
   passes into init().

   Auth:   MSAL Browser (public client, PKCE, popup flow — no client secret)
   Target: shared mailbox LEAF@va.gov, via delegated Calendars.ReadWrite.Shared
           (requires Full Access delegate permission on that mailbox, granted
           by an Exchange/M365 admin — separate from the Entra app setup)

   ============================================================
   ▼▼▼  CONFIG — FILL THIS IN ONCE YOUR ENTRA ADMIN COMPLETES SETUP  ▼▼▼
   ============================================================ */
(function () {
  if (window.__leafOutlookSyncLoaded) return;
  window.__leafOutlookSyncLoaded = true;

  const CONFIG = {
    // From your Entra admin, after they complete the app registration
    // described in "exact ask for Entra admin".
    clientId: "REPLACE_ME_CLIENT_ID",
    tenantId: "REPLACE_ME_TENANT_ID",

    // Confirmed with your Entra admin: leaf.va.gov is a federal VA system,
    // so Government Cloud (GCC/GCC High) is likely — but UNVERIFIED as of
    // this writing. Swap to the commercial block below once confirmed.
    authorityBase: "https://login.microsoftonline.us", // Gov Cloud (assumed default)
    graphBase: "https://graph.microsoft.us/v1.0", // Gov Cloud (assumed default)
    // --- Commercial Azure AD alternative (uncomment + comment out above if confirmed commercial) ---
    // authorityBase: "https://login.microsoftonline.com",
    // graphBase: "https://graph.microsoft.com/v1.0",

    redirectUri: "https://leaf.va.gov/platform/calendar",

    // Confirmed constant — the shared mailbox this calendar syncs with.
    sharedMailbox: "LEAF@va.gov",

    scopes: ["Calendars.ReadWrite.Shared", "User.Read", "offline_access"],

    // How far around "today" to pull Outlook events for. Wide enough to
    // cover month view navigation without re-fetching on every click.
    windowDaysPast: 60,
    windowDaysFuture: 120,

    // Background re-sync interval while the tab stays open (ms).
    autoSyncIntervalMs: 5 * 60 * 1000,
  };
  /* ▲▲▲  END CONFIG  ▲▲▲ */

  if (
    CONFIG.clientId.indexOf("REPLACE_ME") === 0 ||
    CONFIG.tenantId.indexOf("REPLACE_ME") === 0
  ) {
    console.warn(
      "[OutlookSync] Not configured yet — set clientId/tenantId in outlook-sync.js once your Entra admin provides them. Outlook sync UI will stay hidden until then.",
    );
  }

  let msalInstance = null;
  let hostCallbacks = null; // { mergeEntries, reloadLeafEntries, render }
  let autoSyncTimer = null;

  function isConfigured() {
    return (
      CONFIG.clientId.indexOf("REPLACE_ME") !== 0 &&
      CONFIG.tenantId.indexOf("REPLACE_ME") !== 0 &&
      typeof window.msal !== "undefined"
    );
  }

  function getMsal() {
    if (msalInstance) return msalInstance;
    msalInstance = new window.msal.PublicClientApplication({
      auth: {
        clientId: CONFIG.clientId,
        authority: `${CONFIG.authorityBase}/${CONFIG.tenantId}`,
        redirectUri: CONFIG.redirectUri,
      },
      cache: {
        cacheLocation: "sessionStorage", // avoid localStorage per artifact rules; this file also isn't an artifact but keeping it in-session is the more conservative choice
      },
    });
    return msalInstance;
  }

  async function ensureSignedIn() {
    const app = getMsal();
    const accounts = app.getAllAccounts();
    if (accounts.length > 0) {
      try {
        const res = await app.acquireTokenSilent({
          scopes: CONFIG.scopes,
          account: accounts[0],
        });
        return res.accessToken;
      } catch (e) {
        // Silent renewal failed (expired refresh, revoked consent, etc.) —
        // fall through to an interactive popup.
      }
    }
    const res = await app.loginPopup({ scopes: CONFIG.scopes });
    const token = await app.acquireTokenSilent({
      scopes: CONFIG.scopes,
      account: res.account,
    });
    return token.accessToken;
  }

  function isoDate(d) {
    return d.toISOString();
  }

  function ymd(d) {
    return d.toISOString().slice(0, 10);
  }

  function parseGraphDateTime(dt) {
    // Graph returns { dateTime: "2026-07-10T14:00:00.0000000", timeZone: "UTC" }
    if (!dt || !dt.dateTime) return null;
    const d = new Date(dt.dateTime + (dt.dateTime.endsWith("Z") ? "" : "Z"));
    return isNaN(d.getTime()) ? null : d;
  }

  // Normalizes a Graph event into the same shape calendar.js's own
  // normalizeEntry() produces, so it drops into state.entries unchanged.
  function normalizeOutlookEvent(ev) {
    const start = parseGraphDateTime(ev.start);
    const end = parseGraphDateTime(ev.end) || start;
    return {
      recordID: `outlook-${ev.id}`,
      type: "Outlook Event",
      typeClass: "outlook",
      date: start,
      dateKey: start ? ymd(start) : "",
      title: ev.subject || "(untitled)",
      body: ev.bodyPreview || "",
      status: "",
      dueDate: null,
      endDate: end,
      assignedTo: "",
      coveredBy: "",
      opsScrumNotes: "",
      devScrumNotes: "",
      links: [],
      author:
        (ev.organizer &&
          ev.organizer.emailAddress &&
          ev.organizer.emailAddress.name) ||
        "Outlook",
      authorName:
        (ev.organizer &&
          ev.organizer.emailAddress &&
          ev.organizer.emailAddress.name) ||
        "Outlook",
      lastUpdated: ev.lastModifiedDateTime || "",
      _outlookWebLink: ev.webLink || "",
    };
  }

  async function fetchOutlookEvents() {
    const token = await ensureSignedIn();
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - CONFIG.windowDaysPast);
    const end = new Date(now);
    end.setDate(end.getDate() + CONFIG.windowDaysFuture);

    const url =
      `${CONFIG.graphBase}/users/${encodeURIComponent(CONFIG.sharedMailbox)}/calendarview` +
      `?startDateTime=${encodeURIComponent(isoDate(start))}` +
      `&endDateTime=${encodeURIComponent(isoDate(end))}` +
      `&$top=200`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: 'outlook.timezone="UTC"',
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Graph calendarview failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    return (data.value || []).map(normalizeOutlookEvent);
  }

  async function pushEntryToOutlook(entry) {
    const token = await ensureSignedIn();
    const dateStr = entry.date; // 'YYYY-MM-DD' from calFldDate
    if (!dateStr) return; // nothing to push without a date

    const startIso = `${dateStr}T09:00:00`;
    const endDateStr = entry.endDate || entry.dueDate || dateStr;
    const endIso = `${endDateStr}T09:30:00`;

    const body = {
      subject: `[LEAF] ${entry.title || "Calendar Entry"}`,
      body: {
        contentType: "HTML",
        content:
          (entry.body || "") +
          `<p><em>Synced from LEAF Team Command Center — recordID ${entry.recordID}</em></p>`,
      },
      start: { dateTime: startIso, timeZone: "UTC" },
      end: { dateTime: endIso, timeZone: "UTC" },
    };

    const url = `${CONFIG.graphBase}/users/${encodeURIComponent(CONFIG.sharedMailbox)}/events`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Graph event create failed (${res.status}): ${text}`);
    }
  }

  async function syncNow(setStatusFn) {
    if (!isConfigured()) return;
    try {
      if (setStatusFn) setStatusFn("Syncing Outlook…");
      const outlookEntries = await fetchOutlookEvents();
      if (hostCallbacks) hostCallbacks.mergeEntries(outlookEntries);
      if (setStatusFn) setStatusFn("");
    } catch (e) {
      console.warn("[OutlookSync] sync failed:", e.message);
      if (setStatusFn) setStatusFn(`Outlook sync failed: ${e.message}`, true);
    }
  }

  function wireSyncButton() {
    const btn = document.getElementById("calSyncOutlookBtn");
    if (!btn) return;
    btn.hidden = !isConfigured();
    btn.addEventListener("click", () => {
      const statusEl = document.getElementById("cal-live-polite");
      syncNow((msg) => {
        if (statusEl) statusEl.textContent = msg;
      });
    });
  }

  function startAutoSync() {
    if (autoSyncTimer) clearInterval(autoSyncTimer);
    autoSyncTimer = setInterval(() => syncNow(), CONFIG.autoSyncIntervalMs);
  }

  // Public hook object consumed by calendar.js.
  window.LeafCalendarOutlookSync = {
    // Called once from calendar.js's main() after LEAF entries first load.
    async init(callbacks) {
      hostCallbacks = callbacks;
      wireSyncButton();
      if (!isConfigured()) return;
      await syncNow();
      startAutoSync();
    },

    // Called from calendar.js's saveEntry() right after a LEAF entry saves
    // successfully. Failure here is caught by the caller and never blocks
    // the LEAF save.
    async onEntrySaved(entry) {
      if (!isConfigured()) return;
      await pushEntryToOutlook(entry);
      await syncNow();
    },
  };
})();
