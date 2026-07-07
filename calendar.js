/* ============================================================
   TEAM COMMAND CENTER — LEAF standalone app
   Pattern:
     • Reads   → LeafFormQuery (global on LEAF sites), per formQuery.md
     • Writes  → POST ./api/form/new  → POST ./api/form/{id} → submit
     • Records → opened in an iframe modal (printview)

   ============================================================
   ▼▼▼  CONFIG — FILL THIS IN AFTER YOU BUILD THE FORM  ▼▼▼
   ============================================================ */
(function () {
  // Guards against "Identifier has already been declared" if this script
  // ever gets executed twice in the same page context — e.g. an in-page
  // navigation back to this calendar without a full browser reload,
  // which can re-inject and re-run the <script> tag while the first
  // run's top-level declarations are still alive in global scope.
  if (window.__leafCalendarLoaded) return;
  window.__leafCalendarLoaded = true;

  const CONFIG = {
    // Form category for the Calendar Entry form
    categoryID: "form_34212",

    // Base URL of this LEAF site's record printview
    recordViewBase:
      "https://leaf.va.gov/platform/calendar/index.php?a=printview&recordID=",

    // Numeric indicator IDs from the Calendar Entry form
    indicators: {
      entryDate: "11", // Date       — the day the entry lands on
      entryType: "2", // Dropdown   — Meeting Notes / Action Item / Out-of-Office / General Log
      title: "3", // Text       — chip label
      body: "4", // Textarea / rich text — details
      linked: "5", // Textarea   — app-managed JSON list of {recordID, categoryID}
      status: "6", // Dropdown   — Open / In Progress / Done / Carried Forward
      assignedTo: "7", // Orgchart employee (empUID) — action-item owner
      dueDate: "8", // Date       — action-item due date
      endDate: "9", // Date       — OOO range end
      coveredBy: "10", // Orgchart employee (empUID) — OOO coverage
      opsScrumNotes: "14", // Textarea / rich text — Ops Daily Scrum notes
      devScrumNotes: "15", // Textarea / rich text — Dev Daily Scrum notes
    },

    // How many chips fit in a month cell before "+N more"
    monthCellChipLimit: 3,

    // Week starts on Sunday (0) or Monday (1)
    weekStartsOn: 0,
  };
  /* ▲▲▲  END CONFIG  ▲▲▲ */

  /* ============================================================
   Runtime config from the page (Smarty-filled in LEAF)
   ============================================================ */
  const pageConfig = window.leafCalendar || {};
  const DEBUG = pageConfig.debug === true;

  // Diagnostic only (gated behind DEBUG): watches for LEAF's own
  // trumbowyg.min.js / trumbowyg.min.css ever being inserted into the
  // page a second time after our own script has started running — which
  // would mean LEAF's page shell is reloading its rich-text library out
  // from under an editor we've already built. Logs a timestamp every time
  // this is observed, so it can be lined up against exactly when typing
  // breaks, instead of inferring it from the Network tab separately.
  if (DEBUG && typeof MutationObserver !== "undefined") {
    let trumbowygScriptSeenCount = 0;
    const trumbowygReloadObserver = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return; // only element nodes
          const src = (node.src || node.href || "").toString();
          if (/trumbowyg\.min\.(js|css)/i.test(src)) {
            trumbowygScriptSeenCount += 1;
            logDebug(
              `[trumbowyg-reload-watch] ${node.tagName} for ${src} inserted into the page ` +
                `(occurrence #${trumbowygScriptSeenCount} since this page load) at ${new Date().toISOString()}`,
            );
          }
        });
      });
    });
    trumbowygReloadObserver.observe(document.head, { childList: true });
    trumbowygReloadObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // Diagnostic only (gated behind DEBUG): on every click anywhere within a
  // rich-text field's wrapper bounds, logs what element the browser
  // actually considers topmost at that exact point. Tab-to-focus works by
  // jumping straight to the element regardless of what's visually on top
  // of it — a real click has to land on whatever's topmost at that pixel.
  // If something else is overlapping the editor, this will show it by name
  // instead of us having to guess at a CSS stacking fix blind.
  //
  // Logged as one flat string (not a console object) so a plain
  // copy-paste of the console captures everything — no expanding
  // collapsed objects required.
  function describeEl(el) {
    if (!el) return "null";
    const tag = el.tagName || "?";
    const cls =
      typeof el.className === "string" && el.className.trim()
        ? `.${el.className.trim().replace(/\s+/g, ".")}`
        : "";
    const id = el.id ? `#${el.id}` : "";
    return `${tag}${id}${cls}`;
  }

  if (DEBUG) {
    document.addEventListener(
      "click",
      (e) => {
        ["calFldBody", "calFldOpsScrum", "calFldDevScrum"].forEach(
          (fieldId) => {
            const field = document.getElementById(fieldId);
            if (!field) return;
            const rtWrap = field.closest(".cal-rtWrap");
            if (!rtWrap) return;
            const rect = rtWrap.getBoundingClientRect();
            const withinBounds =
              e.clientX >= rect.left &&
              e.clientX <= rect.right &&
              e.clientY >= rect.top &&
              e.clientY <= rect.bottom;
            if (!withinBounds) return; // click wasn't anywhere near this field
            const topEl = document.elementFromPoint(e.clientX, e.clientY);
            const editorEl = rtWrap.querySelector(".trumbowyg-editor");
            const isEditorTopmost = !!(
              editorEl &&
              (topEl === editorEl || editorEl.contains(topEl))
            );
            console.log(
              `[Calendar][click-diag:${fieldId}] target=${describeEl(e.target)} ` +
                `topmostAtPoint=${describeEl(topEl)} editor=${describeEl(editorEl)} ` +
                `isEditorTopmost=${isEditorTopmost} x=${Math.round(e.clientX)} y=${Math.round(e.clientY)} ` +
                `wrapRect=(${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)}x${Math.round(rect.height)})`,
            );
          },
        );
      },
      true, // capture phase — see the click before anything else can react to or stop it
    );
  }

  // calendar.html escapes CSRF/userID server-side via |unescape|escape:"quotes"
  // (same convention as ideas.html), so no client-side comment-stripping
  // workaround is needed here.
  const CSRF = String(pageConfig.csrfToken || "").trim();
  const CURRENT_USER = String(pageConfig.userID || "").trim();

  const TYPES = [
    "Daily Scrum",
    "Meeting Notes",
    "Action Item",
    "Out-of-Office",
    "General Log",
  ];
  const TYPE_CLASS = {
    "Meeting Notes": "meeting",
    "Action Item": "action",
    "Out-of-Office": "ooo",
    "General Log": "log",
    "Daily Scrum": "scrum",
  };

  /* ============================================================
   State
   ============================================================ */
  const state = {
    view: "week", // week | month
    cursor: startOfDay(new Date()), // the date the current view is centered on
    entries: [], // normalized entry view-models
    entriesByDate: {}, // 'YYYY-MM-DD' -> [entry]
    authors: {}, // userID -> display name
    filters: {
      type: [],
      author: [],
      assignee: [],
      search: "",
      showClosed: false,
    },
    editing: null, // entry being edited (or null for new)
    draftLinks: [], // [{recordID, categoryID, title, formName}]
    draftAssigned: null, // {empUID, name}
    draftCovered: null, // {empUID, name}
  };

  // Tracks in-flight link searches so a fast typist can't race an old
  // response into overwriting a newer one.
  let linkSearchToken = 0;

  /* ============================================================
   Small utilities
   ============================================================ */
  function logDebug(...args) {
    if (!DEBUG) return;
    console.log("[Calendar]", ...args);
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function decodeEntities(str) {
    if (!str || typeof str !== "string") return str;
    return str
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&#x27;/gi, "'")
      .replace(/&apos;/g, "'");
  }

  function debounce(fn, delay) {
    let timer;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function announce(msg, assertive) {
    const node = byId(assertive ? "cal-live-assertive" : "cal-live-polite");
    if (!node) return;
    node.textContent = "";
    setTimeout(() => {
      node.textContent = msg;
    }, 50);
  }

  function setStatus(msg, isError) {
    const el = byId("calStatus");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("is-error", !!isError);
  }

  /* ── Date helpers (local-time, no UTC drift) ─────────────── */
  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function ymd(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function parseYMD(s) {
    if (!s) return null;
    const str = String(s).trim();
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) {
      const d = new Date(str);
      return Number.isNaN(d.getTime()) ? null : startOfDay(d);
    }
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }
  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  /* ------------------------------------------------------------
   MM/DD/YYYY date fields — LEAF's native date format. Fields are
   plain text inputs (not <input type="date">, which renders per the
   browser's locale rather than LEAF's convention); we auto-insert
   slashes as the person types and validate/convert to our internal
   YYYY-MM-DD on the way in and out.
   ------------------------------------------------------------ */
  const MDY_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

  // Converts a YYYY-MM-DD internal date string (or Date) to MM/DD/YYYY for display.
  function ymdToMdy(input) {
    if (!input) return "";
    const d = input instanceof Date ? input : parseYMD(input);
    if (!d) return "";
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${mm}/${dd}/${d.getFullYear()}`;
  }

  // Converts a typed MM/DD/YYYY string to our internal YYYY-MM-DD, or null
  // if it's empty/malformed/not a real calendar date.
  function mdyToYmd(str) {
    const trimmed = String(str || "").trim();
    if (!trimmed) return "";
    const m = trimmed.match(MDY_RE);
    if (!m) return null;
    const mm = +m[1];
    const dd = +m[2];
    const yyyy = +m[3];
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    const d = new Date(yyyy, mm - 1, dd);
    // Reject "Feb 31" etc. rolling over into another month
    if (d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
    return ymd(d);
  }

  // As-you-type formatting: auto-inserts "/" after MM and DD, digits only.
  function autoFormatMdy(raw) {
    const digits = String(raw || "")
      .replace(/\D/g, "")
      .slice(0, 8);
    const mm = digits.slice(0, 2);
    const dd = digits.slice(2, 4);
    const yyyy = digits.slice(4, 8);
    if (digits.length <= 2) return mm;
    if (digits.length <= 4) return `${mm}/${dd}`;
    return `${mm}/${dd}/${yyyy}`;
  }

  // Wires a text input for MM/DD/YYYY entry: auto-formats as-you-type and
  // shows/hides an inline error on blur (matching LEAF's own validation UX).
  function wireDateInput(inputId, errorId) {
    const input = byId(inputId);
    const error = byId(errorId);
    if (!input) return;
    input.addEventListener("input", () => {
      const pos = input.selectionStart;
      const before = input.value;
      input.value = autoFormatMdy(input.value);
      // Keep the caret roughly in place after auto-inserting a slash
      if (pos !== null && input.value.length >= before.length) {
        input.setSelectionRange(input.value.length, input.value.length);
      }
      input.classList.remove("is-invalid");
      if (error) error.hidden = true;
    });
    input.addEventListener("blur", () => {
      if (!input.value.trim()) {
        input.classList.remove("is-invalid");
        if (error) error.hidden = true;
        return;
      }
      const valid = mdyToYmd(input.value) !== null;
      input.classList.toggle("is-invalid", !valid);
      if (error) error.hidden = valid;
    });

    // LEAF's native date picker (jQuery UI Datepicker) — already loaded
    // globally on this page. Typing MM/DD/YYYY directly still works; this
    // just adds the calendar popup as a faster alternative, same as LEAF's
    // own date-format indicator fields.
    if (window.$ && window.$.fn && window.$.fn.datepicker) {
      window.$(input).datepicker({
        dateFormat: "mm/dd/yy",
        onSelect: function () {
          input.classList.remove("is-invalid");
          if (error) error.hidden = true;
        },
      });
    }
  }

  function getDateFieldValue(inputId) {
    const input = byId(inputId);
    if (!input) return "";
    const val = mdyToYmd(input.value);
    return val === null ? "" : val;
  }

  function setDateFieldValue(inputId, ymdValue) {
    const input = byId(inputId);
    if (!input) return;
    input.value = ymdToMdy(ymdValue);
    input.classList.remove("is-invalid");
  }

  function sameDay(a, b) {
    return a && b && ymd(a) === ymd(b);
  }
  function isTodayDate(d) {
    return sameDay(d, new Date());
  }

  const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const DOW_LONG = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  function orderedDow() {
    const out = [];
    for (let i = 0; i < 7; i++) out.push((CONFIG.weekStartsOn + i) % 7);
    return out;
  }
  function startOfWeek(d) {
    const x = startOfDay(d);
    const diff = (x.getDay() - CONFIG.weekStartsOn + 7) % 7;
    return addDays(x, -diff);
  }
  function fmtLongDate(d) {
    return `${DOW_LONG[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  /* ============================================================
   LEAF API helpers
   ============================================================ */
  function recordViewURL(recordID) {
    const base = CONFIG.recordViewBase || "";
    if (!base || base.indexOf("REPLACE_ME") === 0) {
      // Relative fallback — works when the app is served from the site root
      return `index.php?a=printview&recordID=${encodeURIComponent(recordID)}`;
    }
    return `${base}${encodeURIComponent(recordID)}`;
  }

  function encodeBody(obj) {
    const body = new URLSearchParams();
    Object.keys(obj || {}).forEach((k) => {
      const v = obj[k];
      if (v === undefined || v === null) return;
      body.append(String(k), String(v));
    });
    return body.toString();
  }

  // POST helper returning text (or parsed JSON when possible)
  async function apiPost(url, dataObj) {
    const res = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-requested-with": "XMLHttpRequest",
      },
      body: encodeBody(dataObj),
    });
    if (!res.ok) throw new Error(`POST ${url} → HTTP ${res.status}`);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return text;
    }
  }

  async function apiGet(url) {
    const res = await fetch(url, {
      credentials: "same-origin",
      headers: {
        "x-requested-with": "XMLHttpRequest",
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
    return res.json();
  }

  // Create a record of CONFIG.categoryID; returns the new numeric recordID.
  // Field name confirmed against the working SNAP/UC-cache pattern in
  // activity_map.html: the POST field is `num{categoryID}` with the
  // "form_" prefix INTACT (e.g. "numform_34212"), not stripped.
  async function createRecord() {
    const payload = {
      CSRFToken: CSRF,
      title: "Calendar Entry",
      [`num${CONFIG.categoryID}`]: "on",
    };
    const res = await apiPost("./api/form/new", payload);
    const id = parseInt(String(res).trim().replace(/^"|"$/g, ""), 10);
    if (!id || id <= 0)
      throw new Error(`Record creation returned no ID: ${res}`);
    return id;
  }

  // Write indicator values to a record.
  // Payload shape confirmed against LeafForm.doModify() (form.js): the POST
  // body must include `recordID` as a top-level field alongside each
  // {indicatorID: value} pair.
  async function writeIndicators(recordID, indicatorValues) {
    const payload = { recordID, CSRFToken: CSRF };
    Object.keys(indicatorValues).forEach((indID) => {
      if (indID && indID !== "REPLACE_ME")
        payload[indID] = indicatorValues[indID];
    });
    return apiPost(`./api/form/${encodeURIComponent(recordID)}`, payload);
  }

  // Submit a freshly-created record into its (single-step) workflow so it's live
  async function submitRecord(recordID) {
    try {
      await apiPost(`./api/form/${encodeURIComponent(recordID)}/submit`, {
        CSRFToken: CSRF,
      });
    } catch (e) {
      logDebug(
        "submit skipped/failed (record may already be live):",
        e.message,
      );
    }
  }

  // Keeps LEAF's own native record title (used elsewhere in generic
  // record lists/print-views) in sync with this entry's Title field.
  // Best-effort/silent by design: this runs after the calendar's own save
  // has already succeeded, so a failure here shouldn't surface as a save
  // error — it's a nice-to-have sync, not part of the calendar's own data.
  async function syncRecordTitle(recordID, title) {
    if (!recordID || !title) return;
    try {
      await apiPost(`./api/form/${encodeURIComponent(recordID)}/title`, {
        title,
        CSRFToken: CSRF,
      });
    } catch (e) {
      logDebug("record title sync skipped/failed:", e.message);
    }
  }

  /* ============================================================
   Diagnostics — discover indicator IDs / categories
   Runs when window.leafCalendar.debug = true
   ============================================================ */
  async function runDiagnostics() {
    console.log("=== CALENDAR DIAGNOSTICS ===");
    console.log("Configured categoryID:", CONFIG.categoryID);
    try {
      const cats = await apiGet("./api/workflow/categoriesUnabridged");
      console.log("--- Forms available on this site ---");
      (Array.isArray(cats) ? cats : Object.values(cats || {})).forEach((c) => {
        console.log(`  ${c.categoryID || c.id} => ${c.categoryName || c.name}`);
      });
    } catch (e) {
      console.log("Could not list categories:", e.message);
    }

    if (CONFIG.categoryID && CONFIG.categoryID.indexOf("REPLACE_ME") !== 0) {
      try {
        const raw = String(CONFIG.categoryID).replace("form_", "");
        const inds = await apiGet(
          `./api/formEditor/indicator/list/category/${raw}`,
        );
        console.log(`--- Indicator IDs for ${CONFIG.categoryID} ---`);
        Object.keys(inds || {}).forEach((k) => {
          const i = inds[k];
          console.log(
            `  id ${k} | ${i.name || i.description || ""} | format: ${i.format || i.input_type || ""}`,
          );
        });
        console.log(">>> Copy these numbers into CONFIG.indicators above.");
      } catch (e) {
        console.log(
          "Could not fetch indicator list — build the form first, then set categoryID.",
          e.message,
        );
      }
    } else {
      console.log(
        ">>> Set CONFIG.categoryID first, then reload to see indicator IDs.",
      );
    }
  }

  /* ============================================================
   Data loading — read all Calendar Entry records
   Uses LeafFormQuery per formQuery.md rather than hitting
   api/form/query directly, and reports progress via onProgress
   so large record sets don't look like a hang.
   ============================================================ */
  function indVal(series, indID) {
    if (!indID || indID === "REPLACE_ME" || !series) return "";
    // LEAF response shape is s1.id{N} (optionally {value: ...}).
    let v = series[`id${indID}`];
    if (v && typeof v === "object" && "value" in v) v = v.value;
    return v == null ? "" : decodeEntities(String(v));
  }

  function safeParseLinks(raw) {
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return arr
          .map((o) => {
            if (o == null) return null;
            if (typeof o === "number" || typeof o === "string") {
              return { recordID: String(o), categoryID: "" };
            }
            return {
              recordID: String(o.recordID || o.id || ""),
              categoryID: String(o.categoryID || ""),
            };
          })
          .filter((o) => o && o.recordID);
      }
    } catch (e) {
      /* fall through to delimiter parse */
    }
    // Fallback: comma/space separated recordIDs
    return String(raw)
      .split(/[\s,;]+/)
      .filter(Boolean)
      .map((id) => ({ recordID: id, categoryID: "" }));
  }

  // Orgchart-linked indicator fields carry a sibling "id{N}_orgchart" object
  // in the same query response, holding the metadata LEAF's orgchart widget
  // captured for that field (userName, and sometimes name parts) — reading
  // it here means we don't need a separate API round-trip just to display
  // a name for Assigned-to/Covered-by.
  function orgchartDisplayName(series, indicatorID) {
    const og = series && series[`id${indicatorID}_orgchart`];
    if (!og) return "";
    if (og.lastName || og.firstName) {
      return `${og.lastName || ""}, ${og.firstName || ""}${og.middleName ? ` ${og.middleName}` : ""}`
        .trim()
        .replace(/^,\s*/, "");
    }
    return og.userName ? String(og.userName).trim() : "";
  }

  function normalizeEntry(recordID, rec) {
    const series = rec.s1 || rec;
    const I = CONFIG.indicators;
    const type = indVal(series, I.entryType) || "General Log";
    const dateStr = indVal(series, I.entryDate);
    const d = parseYMD(dateStr) || parseYMD(rec.date) || null;
    const assignedTo = indVal(series, I.assignedTo);
    const coveredBy = indVal(series, I.coveredBy);

    // Populate the shared name cache directly from data already in this
    // response, so filter dropdowns and read-only labels show a real name
    // immediately, with no extra lookup needed for these two fields.
    if (assignedTo && !peopleCache[assignedTo]) {
      const name = orgchartDisplayName(series, I.assignedTo);
      if (name) peopleCache[assignedTo] = name;
    }
    if (coveredBy && !peopleCache[coveredBy]) {
      const name = orgchartDisplayName(series, I.coveredBy);
      if (name) peopleCache[coveredBy] = name;
    }

    return {
      recordID: String(recordID),
      type,
      typeClass: TYPE_CLASS[type] || "log",
      date: d,
      dateKey: d ? ymd(d) : "",
      title: indVal(series, I.title) || rec.title || "(untitled)",
      body: indVal(series, I.body),
      status: indVal(series, I.status),
      dueDate: parseYMD(indVal(series, I.dueDate)),
      endDate: parseYMD(indVal(series, I.endDate)),
      assignedTo,
      coveredBy,
      opsScrumNotes: indVal(series, I.opsScrumNotes),
      devScrumNotes: indVal(series, I.devScrumNotes),
      links: safeParseLinks(indVal(series, I.linked)),
      author: rec.userID || rec.initiatorName || "",
      authorName: rec.initiatorName || rec.userID || "",
      lastUpdated: rec.lastUpdated || "",
    };
  }

  async function loadEntries() {
    setStatus("Loading entries…");
    if (typeof LeafFormQuery === "undefined") {
      setStatus(
        "LeafFormQuery is not available — this page must run inside LEAF.",
        true,
      );
      throw new Error("LeafFormQuery missing");
    }
    const I = CONFIG.indicators;
    const wantedIndicators = [
      I.entryDate,
      I.entryType,
      I.title,
      I.body,
      I.linked,
      I.status,
      I.assignedTo,
      I.dueDate,
      I.endDate,
      I.coveredBy,
      I.opsScrumNotes,
      I.devScrumNotes,
    ].filter((x) => x && x !== "REPLACE_ME");

    const q = new LeafFormQuery();
    q.addTerm("categoryID", "=", CONFIG.categoryID);
    q.addTerm("deleted", "=", 0);
    q.join("initiatorName");
    q.getData(wantedIndicators);

    // IMPORTANT: indicator data lives under the nested "s1" object in the
    // response (s1.id{N}), not a top-level "s1" scalar. Naming "s1" in
    // x-filterData strips the entire indicator payload and silently
    // breaks every entry — so we only whitelist the flat, top-level
    // fields we actually read off `rec` directly.
    q.setExtraParams(
      "&x-filterData=recordID,title,userID,initiatorName,lastUpdated",
    );

    q.onProgress((count) => {
      setStatus(`Loading entries… ${count} loaded`);
    });

    const res = await q.execute();
    const entries = [];
    Object.keys(res || {}).forEach((rid) => {
      const e = normalizeEntry(rid, res[rid]);
      if (e.date) entries.push(e);
    });

    state.entries = entries;
    indexEntries();
    buildAuthorFilter();
    buildAssigneeFilter();
    await resolveLinkTitles();
    await resolveAuthorAndAssigneeNames();
    logDebug("Loaded entries:", entries.length);
    setStatus("");
  }

  function isMultiDayOoo(e) {
    return e.type === "Out-of-Office" && !!e.endDate && e.endDate > e.date;
  }

  function indexEntries() {
    const map = {};
    const todayKey = ymd(new Date());
    state.entries.forEach((e) => {
      (map[e.dateKey] = map[e.dateKey] || []).push(e);

      // Multi-day OOO spans are rendered as a single spanning band (see
      // packOooLanes / renderWeek / renderMonth) — no per-day clones needed.

      const isOpenAction =
        e.type === "Action Item" &&
        (e.status === "Open" ||
          e.status === "In Progress" ||
          e.status === "Carried Forward");
      if (!isOpenAction) return;

      if (e.dueDate) {
        const dueKey = ymd(e.dueDate);
        // (2) Due-date marker — surfaced on the due date itself, distinct
        // from wherever it was originally logged, so it's visible ahead of time.
        if (dueKey !== e.dateKey) {
          const dueMarker = { ...e, _dueMarker: true, dateKey: dueKey };
          (map[dueKey] = map[dueKey] || []).push(dueMarker);
        }
        // (3) Carry forward to today once overdue, unless today already
        // shows it via the logged date or the due-date marker above.
        if (
          dueKey < todayKey &&
          e.dateKey !== todayKey &&
          dueKey !== todayKey
        ) {
          const cf = { ...e, _carriedForward: true, dateKey: todayKey };
          (map[todayKey] = map[todayKey] || []).push(cf);
        }
      } else if (e.dateKey < todayKey) {
        // No due date set — fall back to simple carry-forward-to-today.
        const cf = { ...e, _carriedForward: true, dateKey: todayKey };
        (map[todayKey] = map[todayKey] || []).push(cf);
      }
    });
    state.entriesByDate = map;
  }

  // Days between two YMD-normalized Date objects (positive = b is after a)
  function daysBetween(a, b) {
    return Math.round((b - a) / 86400000);
  }

  // Due-date badge text + overdue flag for a given entry, used by both the
  // week card and month chip renderers.
  function dueBadge(e) {
    if (!e.dueDate) return null;
    const todayKey = ymd(new Date());
    const dueKey = ymd(e.dueDate);
    const diff = daysBetween(parseYMD(todayKey), parseYMD(dueKey));
    const overdue = dueKey < todayKey;
    let label;
    if (overdue) {
      const days = Math.abs(diff);
      label = `${days} day${days === 1 ? "" : "s"} overdue`;
    } else if (diff === 0) {
      label = "Due today";
    } else if (diff === 1) {
      label = "Due tomorrow";
    } else {
      label = `Due in ${diff} days`;
    }
    return { label, overdue };
  }

  function buildAuthorFilter() {
    const seen = {};
    state.entries.forEach((e) => {
      if (e.author && !seen[e.author])
        seen[e.author] = e.authorName || e.author;
    });
    state.authors = seen;
    const options = Object.keys(seen)
      .sort((a, b) => String(seen[a]).localeCompare(String(seen[b])))
      .map((uid) => ({ value: uid, label: seen[uid] }));
    renderMultiSelectOptions("author", options);
  }

  function buildAssigneeFilter() {
    const seen = {};
    state.entries.forEach((e) => {
      if (e.type === "Action Item" && e.assignedTo && !seen[e.assignedTo]) {
        seen[e.assignedTo] = peopleLabel(e.assignedTo);
      }
    });
    const options = Object.keys(seen)
      .sort((a, b) => String(seen[a]).localeCompare(String(seen[b])))
      .map((empUID) => ({ value: empUID, label: seen[empUID] }));
    renderMultiSelectOptions("assignee", options);
  }

  // Best-effort name resolution for Author only. Assigned-to/Covered-by
  // names now come from the "_orgchart" sibling metadata LEAF already
  // attaches to orgchart-indicator fields in the query response (see
  // orgchartDisplayName() in normalizeEntry) — no extra API round-trip
  // needed for those two. Author has no such sibling (it's the record's
  // system-level initiator, not an indicator), so it still falls back to
  // LEAF's employee API for any ID the initiatorName join didn't resolve.
  async function resolveAuthorAndAssigneeNames() {
    if (!ORGCHART_PATH) return; // no orgchart configured on this page — skip

    const unresolved = Array.from(
      new Set(state.entries.map((e) => e.author).filter(Boolean)),
    ).filter((id) => !peopleCache[id]);
    if (!unresolved.length) return;

    await Promise.all(
      unresolved.map(async (id) => {
        try {
          // `id` here is a LEAF login username (e.g. "oitauslumags"), not a
          // numeric empUID. There is no GET /api/employee/_<username> route —
          // that underscore-prefix convention only applies to the import
          // endpoint (/api/employee/import/_<user>), which is a stateful
          // write operation we don't need just to display a name. Instead,
          // resolve usernames via the national directory search, which LEAF
          // itself uses for username lookups (see project_v17/18/19.js and
          // subindicators.tpl for the same q=userName: pattern).
          const res = await apiGet(
            `${ORGCHART_PATH}/api/national/employee/search?q=userName:${encodeURIComponent(id)}&noLimit=0&domain=`,
          );
          // Response shape: an array of employee matches, or an object
          // keyed by empUID — normalize to a single best match.
          const match = Array.isArray(res)
            ? res[0]
            : res && typeof res === "object"
              ? Object.values(res)[0]
              : null;
          const emp = (match && match.employee) || match;
          if (emp && (emp.firstName || emp.lastName)) {
            const name = `${emp.firstName || ""} ${emp.lastName || ""}`.trim();
            if (name) peopleCache[id] = name;
          }
        } catch (e) {
          // Lookup unavailable for this ID — leave it showing the raw ID.
          logDebug("name lookup failed for", id, e.message);
        }
      }),
    );

    // Re-render the author filter's option labels with any newly-resolved names.
    buildAuthorFilter();
  }

  // Resolve titles for all linked records in one batched query, so chips show live names
  async function resolveLinkTitles() {
    const ids = {};
    state.entries.forEach((e) => {
      e.links.forEach((l) => {
        if (l.recordID) ids[l.recordID] = true;
      });
    });
    const idList = Object.keys(ids);
    if (!idList.length || typeof LeafFormQuery === "undefined") return;
    try {
      const q = new LeafFormQuery();
      q.addTerm("recordIDs", "=", idList.join(","));
      q.join("categoryName");
      q.setExtraParams(
        "&x-filterData=recordID,title,categoryID,categoryName,categoryNames",
      );
      q.onProgress((count) => {
        logDebug(`Resolving linked record titles… ${count} loaded`);
      });
      const res = await q.execute();
      const titleMap = {};
      Object.keys(res || {}).forEach((rid) => {
        const r = res[rid];
        titleMap[rid] = {
          title: decodeEntities(r.title || `#${rid}`),
          formName:
            r.categoryName ||
            (Array.isArray(r.categoryNames)
              ? r.categoryNames.join(", ")
              : "") ||
            "",
          categoryID: r.categoryID || "",
        };
      });
      state.entries.forEach((e) => {
        e.links.forEach((l) => {
          const m = titleMap[l.recordID];
          if (m) {
            l.title = m.title;
            l.formName = m.formName;
            if (!l.categoryID) l.categoryID = m.categoryID;
          } else if (!l.title) {
            l.title = `#${l.recordID}`;
          }
        });
      });
    } catch (e) {
      logDebug("Link title resolution failed:", e.message);
    }
  }

  /* ============================================================
   Filtering
   ============================================================ */
  function passesFilter(e) {
    const f = state.filters;
    if (f.type && f.type.length && !f.type.includes(e.type)) return false;
    if (f.author && f.author.length && !f.author.includes(e.author))
      return false;
    if (
      f.assignee &&
      f.assignee.length &&
      (e.type !== "Action Item" || !f.assignee.includes(e.assignedTo))
    )
      return false;
    if (
      !f.showClosed &&
      e.type === "Action Item" &&
      e.status === "Done" &&
      !e._carriedForward
    ) {
      // closed items hidden unless the toggle is on
      return false;
    }
    if (f.search) {
      if (!entrySearchHaystack(e).includes(f.search.toLowerCase()))
        return false;
    }
    return true;
  }

  // Builds the full searchable text for an entry: title, details, Daily
  // Scrum notes, status, type, assigned-to/covered-by names, and any
  // linked record titles — except records linked from the (internal-only,
  // hidden) Feedback form, which never surface in search either.
  function entrySearchHaystack(e) {
    const parts = [
      e.title,
      stripHtml(e.body),
      stripHtml(e.opsScrumNotes),
      stripHtml(e.devScrumNotes),
      e.status,
      e.type,
      e.assignedTo ? peopleLabel(e.assignedTo) : "",
      e.coveredBy ? peopleLabel(e.coveredBy) : "",
    ];
    (e.links || []).forEach((l) => {
      if (isHiddenCategoryName(l.formName)) return;
      parts.push(l.title);
    });
    return parts.filter(Boolean).join(" ").toLowerCase();
  }

  function stripHtml(html) {
    if (!html) return "";
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }

  // document.execCommand (used by the rich-text toolbar) notoriously wraps
  // every line in its own <div> in Chromium browsers, producing "div soup"
  // like <div>text</div><div>text</div> instead of real paragraphs. This
  // collapses top-level <div> wrappers into <p> tags and normalizes legacy
  // <b>/<i> (also produced by execCommand) into <strong>/<em>.
  function normalizeRichText(html) {
    if (!html) return "";
    const tmp = document.createElement("div");
    tmp.innerHTML = html;

    Array.from(tmp.children).forEach((child) => {
      if (child.tagName === "DIV") {
        const p = document.createElement("p");
        p.innerHTML = child.innerHTML;
        child.replaceWith(p);
      }
    });

    tmp.querySelectorAll("b").forEach((el) => {
      const strong = document.createElement("strong");
      strong.innerHTML = el.innerHTML;
      el.replaceWith(strong);
    });
    tmp.querySelectorAll("i").forEach((el) => {
      const em = document.createElement("em");
      em.innerHTML = el.innerHTML;
      el.replaceWith(em);
    });

    tmp.querySelectorAll("p").forEach((p) => {
      if (p.innerHTML.trim() === "<br>" || p.innerHTML.trim() === "") {
        p.remove();
      }
    });

    return tmp.innerHTML.trim();
  }

  function entriesForDay(dateKey) {
    const list = (state.entriesByDate[dateKey] || []).filter(passesFilter);
    // Stable order: type priority then title
    const order = {
      "Daily Scrum": -1,
      "Out-of-Office": 0,
      "Meeting Notes": 1,
      "Action Item": 2,
      "General Log": 3,
    };
    return list.sort(
      (a, b) => order[a.type] - order[b.type] || a.title.localeCompare(b.title),
    );
  }

  /* ============================================================
   Rendering — shared chip / helpers
   ============================================================ */
  function chipLabel(e) {
    return e.title;
  }

  function chipHTML(e) {
    let cls = `cal-chip t-${e.typeClass}`;
    if (e.type === "Action Item" && e.status === "Done") cls += " is-done";
    if (e._carriedForward) cls += " is-carried";
    const badge = e.type === "Action Item" ? dueBadge(e) : null;
    if (badge && badge.overdue) cls += " is-overdue";
    const prefix = e._carriedForward ? "↺ " : e._dueMarker ? "⏰ " : "";
    const badgeHtml =
      badge && (e._dueMarker || e._carriedForward)
        ? `<span class="cal-chipDue">${escapeHtml(badge.label)}</span>`
        : "";
    return `<span class="${cls}" data-record="${escapeHtml(e.recordID)}" role="button" tabindex="0" title="${escapeHtml(`${e.type}: ${e.title}`)}"><button type="button" class="cal-cardEditBtn cal-cardEditBtn--chip" data-edit-record="${escapeHtml(e.recordID)}" title="Edit entry" aria-label="Edit entry"><span class="material-symbols-outlined" aria-hidden="true">edit</span></button>${escapeHtml(prefix)}${escapeHtml(chipLabel(e))}${badgeHtml}</span>`;
  }

  // Lane-packs Out-of-Office ranges that fall within [rangeStart, rangeEnd]
  // (inclusive, both Date objects normalized to midnight) so that only
  // genuinely overlapping ranges get separate rows/lanes — non-overlapping
  // OOO entries share a lane. Returns an array of lanes, each lane an array
  // of { entry, colStart, colEnd } segments clipped to the range.
  function packOooLanes(entries, rangeStart, rangeEnd) {
    const segments = entries
      .map((e) => {
        const spanStart = e.date;
        const spanEnd = e.endDate && e.endDate > e.date ? e.endDate : e.date;
        if (spanEnd < rangeStart || spanStart > rangeEnd) return null;
        const segStart = spanStart > rangeStart ? spanStart : rangeStart;
        const segEnd = spanEnd < rangeEnd ? spanEnd : rangeEnd;
        return {
          entry: e,
          colStart: Math.round((segStart - rangeStart) / 86400000),
          colEnd: Math.round((segEnd - rangeStart) / 86400000),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.colStart - b.colStart);

    const lanes = [];
    const laneEnds = [];
    segments.forEach((seg) => {
      let placed = false;
      for (let i = 0; i < lanes.length; i++) {
        if (seg.colStart > laneEnds[i]) {
          lanes[i].push(seg);
          laneEnds[i] = seg.colEnd;
          placed = true;
          break;
        }
      }
      if (!placed) {
        lanes.push([seg]);
        laneEnds.push(seg.colEnd);
      }
    });
    return lanes;
  }

  /* ── Month view ──────────────────────────────────────────── */
  // Single CSS grid for the whole month (not one grid per week) with
  // explicit row/column line numbers on every cell. Each week occupies:
  //   - 1 row for day numbers
  //   - 1 row per OOO band that touches that week
  //   - 1 row for chip content
  // Using one grid (rather than nested grids) avoids cascade/context bugs
  // where a child grid's own `display:grid` fails to apply and its cells
  // fall back to block/flex stacking.
  function renderMonth() {
    const head = byId("calWeekHead");
    const grid = byId("calMonthGrid");
    if (!head || !grid) return;

    head.innerHTML = orderedDow()
      .map((d) => `<div>${DOW_SHORT[d]}</div>`)
      .join("");

    const first = new Date(
      state.cursor.getFullYear(),
      state.cursor.getMonth(),
      1,
    );
    const monthEnd = new Date(
      state.cursor.getFullYear(),
      state.cursor.getMonth() + 1,
      0,
    );
    const gridStart = startOfWeek(first);
    const gridEnd = startOfWeek(monthEnd);
    const totalDays = Math.round((gridEnd - gridStart) / 86400000) + 7;
    const totalWeeks = totalDays / 7;

    const oooEntries = state.entries.filter(
      (e) => isMultiDayOoo(e) && passesFilter(e),
    );

    // First pass: figure out how many OOO band lanes each week needs (only
    // genuinely overlapping ranges get separate lanes), and the absolute
    // grid-row line number where each week's content starts.
    const weekBands = []; // weekBands[w] = lanes[] = [{entry, colStart, colEnd}, ...][]
    const weekRowStart = []; // weekRowStart[w] = grid-row line where week w's day-number row begins
    let cursorRow = 1;
    for (let w = 0; w < totalWeeks; w++) {
      const rowStart = addDays(gridStart, w * 7);
      const rowEnd = addDays(rowStart, 6);
      const lanes = packOooLanes(oooEntries, rowStart, rowEnd);
      weekBands.push(lanes);
      weekRowStart.push(cursorRow);
      cursorRow += 1 + lanes.length + 1; // day-number row + lane rows + chip row
    }
    const totalRows = cursorRow - 1;

    // Build the grid-template-rows track list to match: auto for day-number
    // rows, a fixed 22px for each lane row, 1fr (min 96px) for chip rows.
    const rowTracks = [];
    for (let w = 0; w < totalWeeks; w++) {
      rowTracks.push("auto"); // day numbers
      weekBands[w].forEach(() => rowTracks.push("22px")); // one per lane
      rowTracks.push("minmax(96px, 1fr)"); // chip content
    }
    grid.style.gridTemplateColumns = "repeat(7, 1fr)";
    grid.style.gridTemplateRows = rowTracks.join(" ");

    let html = "";
    for (let w = 0; w < totalWeeks; w++) {
      const rowStart = addDays(gridStart, w * 7);
      const dayNumRow = weekRowStart[w];
      const lanes = weekBands[w];
      const chipRow = dayNumRow + 1 + lanes.length;

      // Day-number row
      for (let d = 0; d < 7; d++) {
        const day = addDays(rowStart, d);
        const outside = day.getMonth() !== state.cursor.getMonth();
        html += `<div class="cal-dayNumCell${outside ? " is-outside" : ""}${isTodayDate(day) ? " is-today" : ""}" style="grid-column:${d + 1};grid-row:${dayNumRow}"><span class="cal-dayNum">${day.getDate()}</span></div>`;
      }

      // OOO band lanes for this week — genuinely overlapping ranges get
      // separate lanes; non-overlapping ranges share a lane.
      lanes.forEach((lane, laneIdx) => {
        const gridRow = dayNumRow + 1 + laneIdx;
        lane.forEach((b) => {
          const spanStartLabel = fmtLongDate(b.entry.date);
          const spanEndLabel =
            b.entry.endDate && b.entry.endDate > b.entry.date
              ? ` through ${fmtLongDate(b.entry.endDate)}`
              : "";
          html += `<button type="button" class="cal-oooBand" style="grid-column:${b.colStart + 1} / span ${b.colEnd - b.colStart + 1};grid-row:${gridRow}" data-record="${escapeHtml(b.entry.recordID)}" title="${escapeHtml(`${b.entry.type}: ${b.entry.title}`)}" aria-label="${escapeHtml(b.entry.title)}, Out-of-Office, ${escapeHtml(spanStartLabel)}${escapeHtml(spanEndLabel)}">${escapeHtml(b.entry.title)}</button>`;
        });
      });

      // Chip content row — always the last row for this week, below every
      // lane row above it, so it can never be visually covered.
      for (let d = 0; d < 7; d++) {
        const day = addDays(rowStart, d);
        const key = ymd(day);
        const outside = day.getMonth() !== state.cursor.getMonth();
        const list = entriesForDay(key).filter((e) => !isMultiDayOoo(e));
        const limit = CONFIG.monthCellChipLimit;
        const shown = list.slice(0, limit);
        const extra = list.length - shown.length;

        html += `<div class="cal-dayCell${outside ? " is-outside" : ""}${isTodayDate(day) ? " is-today" : ""}" style="grid-column:${d + 1};grid-row:${chipRow}" data-day="${key}" tabindex="0" role="button" aria-label="${escapeHtml(fmtLongDate(day))}, ${list.length} ${list.length === 1 ? "entry" : "entries"}">`;
        html += '<div class="cal-dayChips">';
        shown.forEach((e) => {
          html += chipHTML(e);
        });
        if (extra > 0) {
          html += `<button type="button" class="cal-moreLink" data-more="${key}">+${extra} more</button>`;
        }
        html += "</div></div>";
      }
    }
    grid.innerHTML = html;
  }

  /* ── Week view ───────────────────────────────────────────── */
  function renderWeek() {
    const board = byId("calWeekBoard");
    if (!board) return;
    const start = startOfWeek(state.cursor);
    const end = addDays(start, 6);

    const oooEntries = state.entries.filter(
      (e) => isMultiDayOoo(e) && passesFilter(e),
    );
    const lanes = packOooLanes(oooEntries, start, end);

    let html = "";
    lanes.forEach((lane, laneIdx) => {
      lane.forEach((b) => {
        const spanStartLabel = fmtLongDate(b.entry.date);
        const spanEndLabel =
          b.entry.endDate && b.entry.endDate > b.entry.date
            ? ` through ${fmtLongDate(b.entry.endDate)}`
            : "";
        html += `<button type="button" class="cal-oooBand" style="grid-column:${b.colStart + 1} / span ${b.colEnd - b.colStart + 1};grid-row:${laneIdx + 1}" data-record="${escapeHtml(b.entry.recordID)}" title="${escapeHtml(`${b.entry.type}: ${b.entry.title}`)}" aria-label="${escapeHtml(b.entry.title)}, Out-of-Office, ${escapeHtml(spanStartLabel)}${escapeHtml(spanEndLabel)}">${escapeHtml(b.entry.title)}</button>`;
      });
    });

    const laneCount = lanes.length;
    for (let i = 0; i < 7; i++) {
      const day = addDays(start, i);
      const key = ymd(day);
      const list = entriesForDay(key).filter((e) => !isMultiDayOoo(e));
      const today = isTodayDate(day);
      html += `<div class="cal-weekCol" style="grid-column:${i + 1};grid-row:${laneCount + 1}">`;
      html += `<div class="cal-weekColHead${today ? " is-today" : ""}"><div class="cal-weekDow">${DOW_SHORT[day.getDay()]}</div><div class="cal-weekDate">${day.getDate()}</div></div>`;
      html += `<div class="cal-weekColBody" data-day="${key}">`;
      if (!list.length) {
        html += '<span style="font-size:12px;color:#97a1ad">No entries</span>';
      } else {
        list.forEach((e) => {
          const meta = weekCardMeta(e);
          const badge = e.type === "Action Item" ? dueBadge(e) : null;
          const overdue = badge && badge.overdue ? " is-overdue" : "";
          const marker = e._carriedForward ? " ↺" : e._dueMarker ? " ⏰" : "";
          const dueMeta =
            badge && (e._dueMarker || e._carriedForward)
              ? `<div class="cal-weekCardDue">${escapeHtml(badge.label)}</div>`
              : "";
          const isScrum = e.type === "Daily Scrum";
          const typeLabel = isScrum
            ? ""
            : `<div class="cal-weekCardType">${escapeHtml(e.type)}${marker}</div>`;
          html += `<div class="cal-weekCard t-${e.typeClass}${overdue}${isScrum ? " cal-weekCard--minimal" : ""}" data-record="${escapeHtml(e.recordID)}" role="button" tabindex="0" title="${escapeHtml(`${e.type}: ${e.title}`)}"><button type="button" class="cal-cardEditBtn" data-edit-record="${escapeHtml(e.recordID)}" title="Edit entry" aria-label="Edit entry"><span class="material-symbols-outlined" aria-hidden="true">edit</span></button>${typeLabel}<div class="cal-weekCardTitle">${escapeHtml(e.title)}</div>${meta ? `<div class="cal-weekCardMeta">${meta}</div>` : ""}${dueMeta}</div>`;
        });
      }
      html += "</div></div>";
    }

    board.style.gridTemplateRows = `${"22px ".repeat(laneCount)}auto`.trim();
    board.innerHTML = html;
  }

  function weekCardMeta(e) {
    const bits = [];
    if (e.type === "Action Item") {
      if (e.status) bits.push(escapeHtml(e.status));
      if (e.assignedTo)
        bits.push(`👤 ${escapeHtml(peopleLabel(e.assignedTo))}`);
    }
    if (e.type === "Out-of-Office" && e.coveredBy) {
      bits.push(`Covered: ${escapeHtml(peopleLabel(e.coveredBy))}`);
    }
    if (e.links && e.links.length) bits.push(`🔗 ${e.links.length}`);
    return bits.join(" · ");
  }

  // Display label for an empUID we may have cached; falls back to the raw value
  const peopleCache = {}; // empUID -> name
  function peopleLabel(empUID) {
    if (!empUID) return "";
    return peopleCache[empUID] || String(empUID);
  }

  /* ── View switch ─────────────────────────────────────────── */
  function render() {
    updateRangeLabel();
    byId("calMonthView").hidden = state.view !== "month";
    byId("calWeekView").hidden = state.view !== "week";
    if (state.view === "month") renderMonth();
    else renderWeek();
  }

  function updateRangeLabel() {
    const el = byId("calRangeLabel");
    if (!el) return;
    if (state.view === "week") {
      const s = startOfWeek(state.cursor);
      const e = addDays(s, 6);
      const crossesMonth = s.getMonth() !== e.getMonth();
      el.textContent = `${MONTHS[s.getMonth()].slice(0, 3)} ${s.getDate()} – ${crossesMonth ? `${MONTHS[e.getMonth()].slice(0, 3)} ` : ""}${e.getDate()}, ${e.getFullYear()}`;
    } else {
      el.textContent = `${MONTHS[state.cursor.getMonth()]} ${state.cursor.getFullYear()}`;
    }
  }

  /* ============================================================
   Modal plumbing (focus trap + open/close)
   ============================================================ */
  let modalStack = [];
  function getFocusable(container) {
    return Array.from(
      container.querySelectorAll(
        'a[href],button:not([disabled]),textarea,input:not([disabled]),select:not([disabled]),iframe,[tabindex]:not([tabindex="-1"]),[contenteditable="true"]',
      ),
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
  }
  function trapKey(e, modal) {
    if (e.key !== "Tab") return;
    const f = getFocusable(modal);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  function openModal(id) {
    const modal = byId(id);
    if (!modal) return;
    modal._lastFocus = document.activeElement;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    modal._trap = (e) => trapKey(e, modal);
    modal.addEventListener("keydown", modal._trap);
    modalStack.push(modal);
    const f = getFocusable(modal);
    if (f[0]) f[0].focus();
  }
  function closeModal(id) {
    const modal = byId(id);
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    if (modal._trap) modal.removeEventListener("keydown", modal._trap);
    modalStack = modalStack.filter((m) => m !== modal);
    if (modal._lastFocus && modal._lastFocus.focus) modal._lastFocus.focus();
  }

  /* ============================================================
   Record viewer (iframe)
   ============================================================ */
  function openRecord(recordID, title) {
    const frame = byId("calRecordFrame");
    const titleEl = byId("calRecordModalTitle");
    const openTab = byId("calRecordOpenTab");
    const url = recordViewURL(recordID);
    if (titleEl) titleEl.textContent = title || `Record #${recordID}`;
    if (openTab) openTab.href = url;
    if (frame) frame.src = url;
    openModal("calRecordModal");
  }

  /* ============================================================
   Entry modal — open / populate / conditional fields
   ============================================================ */
  function applyConditionalFields(type) {
    byId("calCondAction").hidden = type !== "Action Item";
    byId("calCondOoo").hidden = type !== "Out-of-Office";
    byId("calCondScrum").hidden = type !== "Daily Scrum";
    byId("calFldBodyField").hidden = type === "Daily Scrum";
  }

  // Auto-fills Title as "MM/DD/YYYY • Daily Scrum" for Daily Scrum entries,
  // re-running as the date changes, but only until the person edits Title
  // themselves (see state.scrumTitleAuto, set false on real keystrokes).
  function maybeAutoFillScrumTitle() {
    if (byId("calFldType").value !== "Daily Scrum") return;
    if (!state.scrumTitleAuto) return;
    const dateText = byId("calFldDate").value.trim();
    if (!dateText) return;
    byId("calFldTitle").value = `${dateText} • Daily Scrum`;
  }

  /* ------------------------------------------------------------
   Details field — Trumbowyg (LEAF's native advanced formatting
   editor, already loaded globally by LEAF's page shell).
   ------------------------------------------------------------ */
  const richTextFieldsReady = {}; // fieldId -> bool
  const trumbowygPinnedFn = {}; // fieldId -> the trumbowyg plugin fn captured at first build

  const TRUMBOWYG_BTNS = [
    "bold",
    "italic",
    "underline",
    "|",
    "unorderedList",
    "orderedList",
    "|",
    "justifyLeft",
    "justifyCenter",
    "justifyRight",
    "fullscreen",
  ];

  // Rebuilds the Trumbowyg instance fresh every time this is called, rather
  // than initializing once and reusing forever. Trumbowyg needs its
  // container to be genuinely visible at construction time — if a single
  // init ever happened while hidden (or in any other bad state), reusing
  // that same broken instance for the rest of the session would leave the
  // field permanently non-interactive. Destroying and rebuilding each time
  // the edit form becomes visible costs a little overhead but guarantees
  // every entry into edit mode gets a clean, working editor.
  function initRichTextField(fieldId) {
    const field = byId(fieldId);
    if (
      typeof window.$ === "undefined" ||
      !window.$.fn ||
      !window.$.fn.trumbowyg
    ) {
      // Trumbowyg isn't available (e.g. running this page outside LEAF's
      // shell for local testing) — fall back to a plain textarea so the
      // form still works.
      logDebug(`[rt:${fieldId}] jQuery/Trumbowyg not available at init time`, {
        hasJQuery: typeof window.$ !== "undefined",
        hasTrumbowygPlugin: !!(
          window.$ &&
          window.$.fn &&
          window.$.fn.trumbowyg
        ),
      });
      return;
    }
    if (!field) {
      logDebug(`[rt:${fieldId}] field element not found in DOM`);
      return;
    }

    // Diagnostics: capture visibility/geometry right before (re)building,
    // to catch a repeat of "built while hidden/zero-size" if it recurs.
    const rect = field.getBoundingClientRect();
    const modalEl = field.closest(".cal-modal");
    logDebug(`[rt:${fieldId}] initRichTextField() called`, {
      wasAlreadyReady: !!richTextFieldsReady[fieldId],
      fieldOffsetParentIsNull: field.offsetParent === null,
      rectWidth: rect.width,
      rectHeight: rect.height,
      modalHasIsOpenClass: modalEl
        ? modalEl.classList.contains("is-open")
        : null,
      fieldHiddenAttr: field.hidden,
      formHiddenAttr: byId("calEntryForm") ? byId("calEntryForm").hidden : null,
      trumbowygFnChangedSinceFirstBuild:
        trumbowygPinnedFn[fieldId] &&
        trumbowygPinnedFn[fieldId] !== window.$.fn.trumbowyg,
    });

    // Pin the plugin function we actually build with, the first time, and
    // reuse that exact reference from then on — window.$.fn.trumbowyg is
    // looked up fresh by jQuery every time you call $field.trumbowyg(...),
    // so if LEAF's page shell reloads trumbowyg.min.js mid-session (we've
    // observed it re-requesting that file around record load/submit) and
    // that reload redefines window.$.fn.trumbowyg, any call after that
    // point would run the NEW plugin code against an editor the OLD code
    // built — a mismatch that could plausibly explain typing breaking
    // partway through. Calling the pinned reference directly sidesteps
    // that risk entirely for this field's lifetime.
    if (!trumbowygPinnedFn[fieldId]) {
      trumbowygPinnedFn[fieldId] = window.$.fn.trumbowyg;
    }
    const pinnedFn = trumbowygPinnedFn[fieldId];

    const $field = window.$(`#${fieldId}`);
    if (richTextFieldsReady[fieldId]) {
      try {
        pinnedFn.call($field, "destroy");
        logDebug(`[rt:${fieldId}] destroy() succeeded`);
      } catch (e) {
        logDebug(`[rt:${fieldId}] destroy() THREW:`, e.message);
      }
      richTextFieldsReady[fieldId] = false;
    }
    try {
      pinnedFn.call($field, { btns: TRUMBOWYG_BTNS });
      richTextFieldsReady[fieldId] = true;
    } catch (e) {
      logDebug(`[rt:${fieldId}] trumbowyg() build THREW:`, e.message);
      richTextFieldsReady[fieldId] = false;
      return;
    }

    // Post-build check: is the resulting editable region actually editable?
    // Trumbowyg wraps the original field inside .trumbowyg-box (as a
    // parent, not a following sibling) — the earlier `~` selector could
    // never match, which is why it always reported "not found" regardless
    // of whether the build actually worked.
    const wrapEl = field.closest(".trumbowyg-box") || field.parentElement;
    const editorEl = wrapEl ? wrapEl.querySelector(".trumbowyg-editor") : null;
    let focusWorked = null;
    if (editorEl) {
      try {
        editorEl.focus();
        focusWorked = document.activeElement === editorEl;
      } catch (e) {
        focusWorked = false;
      }
    }
    logDebug(`[rt:${fieldId}] post-build check`, {
      editorFound: !!editorEl,
      contentEditableAttr: editorEl
        ? editorEl.getAttribute("contenteditable")
        : null,
      editorRect: editorEl ? editorEl.getBoundingClientRect() : null,
      focusActuallyLanded: focusWorked,
    });
  }

  function setRichTextValue(fieldId, html) {
    if (richTextFieldsReady[fieldId] && trumbowygPinnedFn[fieldId]) {
      trumbowygPinnedFn[fieldId].call(
        window.$(`#${fieldId}`),
        "html",
        html || "",
      );
    } else if (byId(fieldId)) {
      byId(fieldId).value = html || "";
    }
  }

  function getRichTextValue(fieldId) {
    if (richTextFieldsReady[fieldId] && trumbowygPinnedFn[fieldId]) {
      return trumbowygPinnedFn[fieldId]
        .call(window.$(`#${fieldId}`), "html")
        .trim();
    }
    return byId(fieldId) ? byId(fieldId).value.trim() : "";
  }

  function initBodyEditor() {
    initRichTextField("calFldBody");
    initRichTextField("calFldOpsScrum");
    initRichTextField("calFldDevScrum");
  }

  function setBodyEditorValue(html) {
    setRichTextValue("calFldBody", html);
  }

  function getBodyEditorValue() {
    return getRichTextValue("calFldBody");
  }

  function openEntryModal(entry, presetDate, mode) {
    state.editing = entry || null;
    state.draftLinks = entry ? entry.links.map((l) => ({ ...l })) : [];
    state.draftAssigned = null;
    state.draftCovered = null;

    const effectiveMode = mode || (entry ? "view" : "edit");

    byId("calSaveBtn").textContent = entry ? "Save changes" : "Save entry";
    byId("calDeleteBtn").hidden = !entry;

    const openTab = byId("calEntryOpenTab");
    if (openTab) {
      if (entry) {
        openTab.href = recordViewURL(entry.recordID);
        openTab.hidden = false;
      } else {
        openTab.hidden = true;
      }
    }

    byId("calEntryMsg").textContent = "";

    byId("calEntryRecordID").value = entry ? entry.recordID : "";
    setDateFieldValue(
      "calFldDate",
      entry && entry.date ? ymd(entry.date) : presetDate || ymd(new Date()),
    );
    byId("calFldType").value = entry ? entry.type : "";
    byId("calFldTitle").value = entry ? entry.title : "";

    byId("calFldStatus").value = entry && entry.status ? entry.status : "Open";
    setDateFieldValue(
      "calFldDue",
      entry && entry.dueDate ? ymd(entry.dueDate) : "",
    );
    setDateFieldValue(
      "calFldEnd",
      entry && entry.endDate ? ymd(entry.endDate) : "",
    );
    byId("calScrumDupe").hidden = true;

    // Title is auto-generated for brand-new Daily Scrum entries (date •
    // Daily Scrum) but stays freely editable — only overwrite it
    // automatically until the person actually types in the field
    // themselves, and never for an entry that already exists.
    state.scrumTitleAuto = !entry;

    // People
    if (entry && entry.assignedTo) {
      state.draftAssigned = {
        empUID: entry.assignedTo,
        name: peopleLabel(entry.assignedTo),
      };
    }
    if (entry && entry.coveredBy) {
      state.draftCovered = {
        empUID: entry.coveredBy,
        name: peopleLabel(entry.coveredBy),
      };
    }
    renderPeopleSelected("assigned");
    renderPeopleSelected("covered");

    applyConditionalFields(entry ? entry.type : "");
    renderDraftLinks();
    openModal("calEntryModal");
    setEntryModalMode(effectiveMode, entry);
    // openModal() already tried to focus the first focusable element, but
    // that happened before setEntryModalMode() revealed the right section
    // (form vs. read-only) — re-focus now that it's correct.
    const focusable = getFocusable(byId("calEntryModal"));
    if (focusable[0]) focusable[0].focus();
  }

  // Toggles the entry modal between "view" (clean, read-only summary) and
  // "edit" (the full form) without re-fetching data — both are populated
  // from the same entry object already loaded above.
  function setEntryModalMode(mode, entry) {
    state.entryModalMode = mode;
    const isView = mode === "view" && !!entry;
    byId("calEntryModalTitle").textContent = isView
      ? entry.title || "Entry"
      : entry
        ? "Edit entry"
        : "New entry";
    byId("calEntryForm").hidden = isView;
    byId("calEntryReadOnly").hidden = !isView;
    byId("calReadOnlyActions").hidden = !isView;
    byId("calEditFormActions").hidden = isView;
    if (isView) {
      renderReadOnlyEntry(entry);
    } else {
      // Trumbowyg must be built while its textarea is actually visible —
      // building it inside a display:none modal leaves the editable area
      // permanently non-interactive even after the modal opens later. This
      // is only called once the modal itself is already open (see call
      // order in openEntryModal/switchToEditMode), and is safe to call
      // repeatedly — initRichTextField() no-ops after the first real init.
      initBodyEditor();
      setBodyEditorValue(entry ? normalizeRichText(entry.body || "") : "");
      setRichTextValue(
        "calFldOpsScrum",
        entry ? normalizeRichText(entry.opsScrumNotes || "") : "",
      );
      setRichTextValue(
        "calFldDevScrum",
        entry ? normalizeRichText(entry.devScrumNotes || "") : "",
      );
    }
  }

  function switchToEditMode() {
    if (state.editing) setEntryModalMode("edit", state.editing);
  }

  /* ============================================================
   Multi-select filter dropdowns (Type / Author / Assigned to)
   ============================================================ */
  const multiSelects = {}; // filterKey -> {btn, label, panel, options}
  const MS_ALL_LABEL = {
    type: "All types",
    author: "Everyone",
    assignee: "Anyone",
  };

  function initMultiSelect(filterKey, containerId) {
    const container = byId(containerId);
    if (!container) return;
    const btn = container.querySelector(".cal-msBtn");
    const label = container.querySelector(".cal-msBtnLabel");
    const panel = container.querySelector(".cal-msPanel");
    multiSelects[filterKey] = { btn, label, panel, options: [] };

    btn.addEventListener("click", () => {
      const isOpen = !panel.hidden;
      closeAllMultiSelects();
      if (!isOpen) {
        panel.hidden = false;
        btn.setAttribute("aria-expanded", "true");
      }
    });
  }

  function closeAllMultiSelects() {
    Object.keys(multiSelects).forEach((key) => {
      const ms = multiSelects[key];
      ms.panel.hidden = true;
      ms.btn.setAttribute("aria-expanded", "false");
    });
  }

  function renderMultiSelectOptions(filterKey, options) {
    const ms = multiSelects[filterKey];
    if (!ms) return;
    ms.options = options;
    const selected = state.filters[filterKey] || [];
    ms.panel.innerHTML = options.length
      ? options
          .map(
            (o) =>
              `<label class="cal-msOption"><input type="checkbox" value="${escapeHtml(o.value)}"${selected.includes(o.value) ? " checked" : ""} />${escapeHtml(o.label)}</label>`,
          )
          .join("")
      : '<div class="cal-msEmpty">Nothing to filter on yet</div>';
    ms.panel.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener("change", () => {
        const set = new Set(state.filters[filterKey] || []);
        if (cb.checked) set.add(cb.value);
        else set.delete(cb.value);
        state.filters[filterKey] = Array.from(set);
        updateMultiSelectLabel(filterKey);
        if (filterKey === "type") syncLegendActive();
        render();
      });
    });
    updateMultiSelectLabel(filterKey);
  }

  function updateMultiSelectLabel(filterKey) {
    const ms = multiSelects[filterKey];
    if (!ms) return;
    const selected = state.filters[filterKey] || [];
    if (!selected.length) {
      ms.label.textContent = MS_ALL_LABEL[filterKey] || "All";
    } else if (selected.length === 1) {
      const opt = ms.options.find((o) => o.value === selected[0]);
      ms.label.textContent = opt ? opt.label : selected[0];
    } else {
      ms.label.textContent = `${selected.length} selected`;
    }
  }

  // Sets a multi-select's selection programmatically (e.g. from the legend
  // or Clear Filters) and keeps its checkboxes/label in sync.
  function setMultiSelectValues(filterKey, values) {
    state.filters[filterKey] = values.slice();
    const ms = multiSelects[filterKey];
    if (ms) {
      ms.panel.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        cb.checked = values.includes(cb.value);
      });
      updateMultiSelectLabel(filterKey);
    }
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".cal-msSelect")) closeAllMultiSelects();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllMultiSelects();
  });

  function syncLegendActive() {
    const active = new Set(state.filters.type || []);
    document.querySelectorAll("[data-legend-type]").forEach((btn) => {
      btn.classList.toggle(
        "is-active",
        active.has(btn.getAttribute("data-legend-type")),
      );
    });
  }

  // Builds the clean, non-editable summary shown when an entry is opened
  // by clicking its card (the new default), before the person opts into Edit.
  function renderReadOnlyEntry(entry) {
    const wrap = byId("calEntryReadOnly");
    if (!wrap) return;

    const pill = `<span class="cal-roPill t-${entry.typeClass}">${escapeHtml(entry.type)}</span>`;

    let dateLine = escapeHtml(fmtLongDate(entry.date));
    if (
      entry.type === "Out-of-Office" &&
      entry.endDate &&
      entry.endDate > entry.date
    ) {
      dateLine += ` – ${escapeHtml(fmtLongDate(entry.endDate))}`;
    }

    const rows = [];
    rows.push(
      `<div class="cal-roRow"><span class="cal-roLabel">Date</span><span class="cal-roValue">${dateLine}</span></div>`,
    );

    if (entry.type === "Action Item") {
      const badge = dueBadge(entry);
      rows.push(
        `<div class="cal-roRow"><span class="cal-roLabel">Status</span><span class="cal-roValue">${escapeHtml(entry.status || "Open")}</span></div>`,
      );
      if (entry.dueDate) {
        const overdueCls = badge && badge.overdue ? " is-overdue" : "";
        rows.push(
          `<div class="cal-roRow"><span class="cal-roLabel">Due date</span><span class="cal-roValue${overdueCls}">${escapeHtml(fmtLongDate(entry.dueDate))}${badge && entry.status !== "Done" ? ` · ${escapeHtml(badge.label)}` : ""}</span></div>`,
        );
      }
      if (entry.assignedTo) {
        rows.push(
          `<div class="cal-roRow"><span class="cal-roLabel">Assigned to</span><span class="cal-roValue">${escapeHtml(peopleLabel(entry.assignedTo))}</span></div>`,
        );
      }
    }

    if (entry.type === "Out-of-Office" && entry.coveredBy) {
      rows.push(
        `<div class="cal-roRow"><span class="cal-roLabel">Covered by</span><span class="cal-roValue">${escapeHtml(peopleLabel(entry.coveredBy))}</span></div>`,
      );
    }

    const detailsHtml = entry.body
      ? `<div class="cal-roDetails">${normalizeRichText(entry.body)}</div>`
      : '<p class="cal-roEmpty">No details added.</p>';

    const opsScrumHtml = entry.opsScrumNotes
      ? `<div class="cal-roDetails">${normalizeRichText(entry.opsScrumNotes)}</div>`
      : '<p class="cal-roEmpty">No notes added.</p>';
    const devScrumHtml = entry.devScrumNotes
      ? `<div class="cal-roDetails">${normalizeRichText(entry.devScrumNotes)}</div>`
      : '<p class="cal-roEmpty">No notes added.</p>';

    const linksHtml =
      entry.links && entry.links.length
        ? `<div class="cal-linkChips">${entry.links
            .map((l, idx) => {
              const label = linkChipLabel(l);
              return `<span class="cal-linkChip cal-linkChip--ro" role="listitem"><span class="cal-linkChipMain" data-open-link="${idx}" role="button" tabindex="0"><span class="material-symbols-outlined" style="font-size:15px" aria-hidden="true">description</span>${escapeHtml(label)}</span></span>`;
            })
            .join("")}</div>`
        : '<p class="cal-roEmpty">No records linked.</p>';

    const bodySectionsHtml =
      entry.type === "Daily Scrum"
        ? `
    <div class="cal-roSection">
      <h3 class="cal-roHeading">Ops Daily Scrum Notes</h3>
      ${opsScrumHtml}
    </div>
    <div class="cal-roSection">
      <h3 class="cal-roHeading">Dev Daily Scrum Notes</h3>
      ${devScrumHtml}
    </div>`
        : `
    <div class="cal-roSection">
      <h3 class="cal-roHeading">Details</h3>
      ${detailsHtml}
    </div>`;

    wrap.innerHTML = `
    <div class="cal-roHead">${pill}</div>
    <div class="cal-roRows">${rows.join("")}</div>
    ${bodySectionsHtml}
    <div class="cal-roSection">
      <h3 class="cal-roHeading">Linked records</h3>
      ${linksHtml}
    </div>
  `;
  }

  // Consistent linked-record label everywhere: "#123 · Record Title" — no
  // form name, since the record number + title is enough context here.
  function linkChipLabel(l) {
    const title = l.title || `Record #${l.recordID}`;
    return `#${l.recordID} · ${title}`;
  }

  function renderDraftLinks() {
    const wrap = byId("calLinkChips");
    if (!wrap) return;
    if (!state.draftLinks.length) {
      wrap.innerHTML =
        '<span style="font-size:13px;color:#97a1ad">No records linked yet.</span>';
      return;
    }
    wrap.innerHTML = state.draftLinks
      .map((l, idx) => {
        const label = linkChipLabel(l);
        return `<span class="cal-linkChip" role="listitem"><span class="cal-linkChipMain" data-open-link="${idx}" role="button" tabindex="0"><span class="material-symbols-outlined" style="font-size:15px" aria-hidden="true">description</span>${escapeHtml(label)}</span><button type="button" data-remove-link="${idx}" aria-label="Remove link: ${escapeHtml(label)}"><span class="material-symbols-outlined" aria-hidden="true">close</span></button></span>`;
      })
      .join("");
  }

  /* ============================================================
   People picker (orgchart) — LEAF's native nationalEmployeeSelector
   widget, loaded on demand from the orgchart app (the same mechanism
   LEAF's own indicator fields use — see empSel_<id>_input/_result).
   ============================================================ */
  const ORGCHART_PATH = String(pageConfig.orgchartPath || "")
    .trim()
    .replace(/\/$/, "");

  function renderPeopleSelected(role) {
    const containerId =
      role === "assigned" ? "calAssignedSelected" : "calCoveredSelected";
    const selectorId =
      role === "assigned" ? "empSel_calAssigned" : "empSel_calCovered";
    const person =
      role === "assigned" ? state.draftAssigned : state.draftCovered;
    const el = byId(containerId);
    const selectorEl = byId(selectorId);
    if (!el) return;
    if (person && person.empUID) {
      const label = person.name || person.empUID;
      el.innerHTML = `<span class="cal-personChip">${escapeHtml(label)}<button type="button" data-clear-person="${role}" aria-label="Remove ${escapeHtml(label)}"><span class="material-symbols-outlined" aria-hidden="true">close</span></button></span>`;
      if (selectorEl) selectorEl.style.display = "none";
    } else {
      el.innerHTML = "";
      if (selectorEl) selectorEl.style.display = "";
    }
  }

  function pickPerson(role, empUID, name, userName) {
    peopleCache[empUID] = name;
    if (role === "assigned") state.draftAssigned = { empUID, name, userName };
    else state.draftCovered = { empUID, name, userName };
    renderPeopleSelected(role);
  }

  function clearPerson(role) {
    if (role === "assigned") state.draftAssigned = null;
    else state.draftCovered = null;
    renderPeopleSelected(role);
    const empSel = employeeSelectors[role];
    if (empSel) {
      const input = document.querySelector(
        `#empSel_cal${role === "assigned" ? "Assigned" : "Covered"} input.employeeSelectorInput`,
      );
      if (input) input.value = "";
    }
  }

  // Lazy-loads nationalEmployeeSelector.js + its stylesheet from the
  // orgchart app, matching LEAF's own "load once, reuse" pattern for
  // indicator fields of this type.
  let employeeSelectorLoad = null;
  function loadNationalEmployeeSelector() {
    if (employeeSelectorLoad) return employeeSelectorLoad;
    employeeSelectorLoad = new Promise((resolve, reject) => {
      if (!ORGCHART_PATH) {
        reject(new Error("orgchartPath is not configured on this page"));
        return;
      }
      if (typeof window.nationalEmployeeSelector !== "undefined") {
        resolve();
        return;
      }
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `${ORGCHART_PATH}/css/employeeSelector.css`;
      document.head.appendChild(link);
      const script = document.createElement("script");
      script.src = `${ORGCHART_PATH}/js/nationalEmployeeSelector.js`;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Failed to load nationalEmployeeSelector.js"));
      document.head.appendChild(script);
    });
    return employeeSelectorLoad;
  }

  const employeeSelectors = {}; // role -> nationalEmployeeSelector instance

  async function initEmployeeSelector(role) {
    if (employeeSelectors[role]) return employeeSelectors[role];
    try {
      await loadNationalEmployeeSelector();
    } catch (e) {
      logDebug("employee selector failed to load:", e.message);
      return null;
    }
    const containerId =
      role === "assigned" ? "empSel_calAssigned" : "empSel_calCovered";
    if (!byId(containerId)) return null;
    const empSel = new window.nationalEmployeeSelector(containerId);
    empSel.apiPath = `${ORGCHART_PATH}/api/`;
    empSel.rootPath = `${ORGCHART_PATH}/`;
    empSel.setSelectHandler(() => onEmployeeChosen(role, empSel));
    empSel.setResultHandler(() => onEmployeeChosen(role, empSel));
    empSel.initialize();
    employeeSelectors[role] = empSel;
    return empSel;
  }

  // Mirrors LEAF's own importFromNational(): resolves the chosen national
  // employee into a local empUID we can save on the indicator.
  function onEmployeeChosen(role, empSel) {
    const selection = empSel.selection;
    if (!selection) return;
    const data = empSel.selectionData && empSel.selectionData[selection];
    const userName = data ? data.userName : null;
    if (!userName) return;
    apiPost(`${ORGCHART_PATH}/api/employee/import/_${userName}`, {
      CSRFToken: CSRF,
    })
      .then((res) => {
        const empUID = String(res).trim();
        const name = data
          ? `${data.lastName || ""}, ${data.firstName || ""}${data.middleName ? ` ${data.middleName}` : ""}`.trim()
          : userName;
        pickPerson(role, empUID, name, userName);
      })
      .catch((e) => logDebug("employee import failed:", e.message));
  }

  /* ============================================================
   Link picker — search across ALL forms
   ============================================================ */
  let linkFormFilterReady = false;
  // Category names hidden from this internal calendar entirely — never
  // shown as a filter option and never returned in search results.
  const HIDDEN_CATEGORY_NAMES = ["feedback"];
  function isHiddenCategoryName(name) {
    return HIDDEN_CATEGORY_NAMES.includes(
      String(name || "")
        .trim()
        .toLowerCase(),
    );
  }

  async function ensureLinkFormFilter() {
    if (linkFormFilterReady) return;
    const sel = byId("calLinkFormFilter");
    if (!sel) return;
    try {
      const cats = await apiGet("./api/workflow/categoriesUnabridged");
      const arr = (
        Array.isArray(cats) ? cats : Object.values(cats || {})
      ).filter(
        (c) =>
          c &&
          (c.categoryName || c.name) &&
          !isHiddenCategoryName(c.categoryName || c.name),
      );
      arr.sort((a, b) =>
        String(a.categoryName || a.name).localeCompare(
          String(b.categoryName || b.name),
        ),
      );
      arr.forEach((c) => {
        const o = document.createElement("option");
        o.value = c.categoryID || c.id;
        o.textContent = c.categoryName || c.name;
        sel.appendChild(o);
      });
      linkFormFilterReady = true;
    } catch (e) {
      logDebug("form filter load failed:", e.message);
    }
  }

  const linkSearchRun = debounce(() => {
    const term = byId("calLinkSearch").value.trim();
    const formFilter = byId("calLinkFormFilter").value;
    runLinkSearch(term, formFilter);
  }, 250);

  async function runLinkSearch(term, formFilter) {
    const out = byId("calLinkResults");
    if (!out) return;
    if (!term || term.length < 2) {
      out.innerHTML =
        '<p class="cal-linkHint">Type at least 2 characters to search across all forms, or enter a record number.</p>';
      return;
    }
    const myToken = ++linkSearchToken;
    out.innerHTML = '<p class="cal-linkHint">Searching…</p>';
    try {
      const isNumeric = /^\d+$/.test(term.trim());
      const filterData =
        "&x-filterData=recordID,title,categoryID,categoryName,categoryNames";

      const titleQuery = new LeafFormQuery();
      titleQuery.addTerm("title", "LIKE", `*${term}*`);
      titleQuery.addTerm("deleted", "=", 0);
      if (formFilter) titleQuery.addTerm("categoryID", "=", formFilter);
      titleQuery.join("categoryName");
      titleQuery.setLimit(40);
      titleQuery.setExtraParams(filterData);
      titleQuery.onProgress((count) => {
        if (myToken !== linkSearchToken) return;
        out.innerHTML = `<p class="cal-linkHint">Searching… ${count} matched so far</p>`;
      });

      const queries = [titleQuery.execute()];

      // If the typed term looks like a record number, also look it up by
      // exact recordID (LeafFormQuery only supports exact match there, not
      // LIKE) and merge the two result sets, deduped by recordID.
      if (isNumeric) {
        const idQuery = new LeafFormQuery();
        idQuery.addTerm("recordID", "=", term.trim());
        idQuery.addTerm("deleted", "=", 0);
        if (formFilter) idQuery.addTerm("categoryID", "=", formFilter);
        idQuery.join("categoryName");
        idQuery.setExtraParams(filterData);
        queries.push(idQuery.execute());
      }

      const results = await Promise.all(queries);
      if (myToken !== linkSearchToken) return; // stale response — a newer search is in flight

      const merged = {};
      results.forEach((res) => {
        Object.keys(res || {}).forEach((rid) => {
          merged[rid] = res[rid];
        });
      });

      const rows = Object.keys(merged)
        .map((rid) => {
          const r = merged[rid];
          return {
            recordID: rid,
            title: decodeEntities(r.title || `#${rid}`),
            categoryID: r.categoryID || "",
            formName:
              r.categoryName ||
              (Array.isArray(r.categoryNames)
                ? r.categoryNames.join(", ")
                : "") ||
              "",
          };
        })
        .filter((r) => !isHiddenCategoryName(r.formName));
      if (!rows.length) {
        out.innerHTML = `<p class="cal-linkHint">No records match "${escapeHtml(term)}".</p>`;
        return;
      }
      const linkedIds = {};
      state.draftLinks.forEach((l) => {
        linkedIds[l.recordID] = true;
      });
      out.innerHTML = rows
        .map((r) => {
          const isLinked = !!linkedIds[r.recordID];
          return `<div class="cal-linkResult${isLinked ? " is-linked" : ""}" role="button" tabindex="0" data-record="${escapeHtml(r.recordID)}" data-cat="${escapeHtml(r.categoryID)}" data-title="${escapeHtml(r.title)}" data-form="${escapeHtml(r.formName)}"><div class="cal-linkResultMain"><div class="cal-linkResultTitle">${escapeHtml(r.title)}</div><div class="cal-linkResultMeta">${escapeHtml(r.formName || "Form")} · #${escapeHtml(r.recordID)}</div></div><span class="cal-linkResultAdd">${isLinked ? "✓ Linked" : "+ Add"}</span></div>`;
        })
        .join("");
    } catch (e) {
      if (myToken !== linkSearchToken) return;
      out.innerHTML = `<p class="cal-linkHint">Search failed. ${escapeHtml(e.message)}</p>`;
    }
  }

  function toggleDraftLink(recordID, categoryID, title, formName) {
    const idx = state.draftLinks.findIndex((l) => l.recordID === recordID);
    if (idx >= 0) state.draftLinks.splice(idx, 1);
    else state.draftLinks.push({ recordID, categoryID, title, formName });
    renderDraftLinks();
    // reflect in the open search list
    const term = byId("calLinkSearch").value.trim();
    runLinkSearch(term, byId("calLinkFormFilter").value);
  }

  /* ============================================================
   Save / delete
   ============================================================ */
  async function saveEntry() {
    const msg = byId("calEntryMsg");
    msg.textContent = "";
    const I = CONFIG.indicators;

    const type = byId("calFldType").value;
    const title = byId("calFldTitle").value.trim();

    if (!title) {
      msg.textContent = "Add a title.";
      byId("calFldTitle").focus();
      return;
    }

    // Validate any date fields that have text in them (all are optional, but
    // if something's typed it needs to be a real MM/DD/YYYY date).
    const dateFields = [
      ["calFldDate", "calFldDate_error"],
      ["calFldDue", "calFldDue_error"],
      ["calFldEnd", "calFldEnd_error"],
    ];
    for (const [inputId, errorId] of dateFields) {
      const input = byId(inputId);
      if (!input || !input.value.trim()) continue;
      if (mdyToYmd(input.value) === null) {
        input.classList.add("is-invalid");
        const err = byId(errorId);
        if (err) err.hidden = false;
        msg.textContent = "Fix the date field highlighted in red (MM/DD/YYYY).";
        input.focus();
        return;
      }
    }

    // `date` (ISO) is only for our own internal logic (duplicate-check
    // comparison below); `dateMdy` is the raw typed MM/DD/YYYY text, which
    // is what actually gets written to the indicator — matching LEAF's own
    // convention for date-format fields (they store the typed string
    // as-is, e.g. "07/10/2026", not an ISO conversion). Writing ISO there
    // instead was why the native LEAF record view showed YYYY-MM-DD.
    const date = getDateFieldValue("calFldDate");
    const dateMdy = byId("calFldDate").value.trim();

    // Daily Scrum: hard-block a second entry on the same date — point at
    // the existing one instead of allowing a duplicate.
    if (type === "Daily Scrum" && date) {
      const recordID = byId("calEntryRecordID").value;
      const dupe = state.entries.find(
        (e) =>
          e.type === "Daily Scrum" &&
          e.dateKey === date &&
          e.recordID !== recordID,
      );
      if (dupe) {
        const dupeBanner = byId("calScrumDupe");
        dupeBanner.hidden = false;
        byId("calScrumDupeOpen").onclick = () => openEntryModal(dupe);
        msg.textContent = "";
        dupeBanner.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }

    const saveBtn = byId("calSaveBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    // Build indicator payload
    const values = {};
    values[I.entryDate] = dateMdy;
    values[I.entryType] = type;
    values[I.title] = title;
    values[I.body] = normalizeRichText(getBodyEditorValue());
    values[I.linked] = JSON.stringify(
      state.draftLinks.map((l) => ({
        recordID: l.recordID,
        categoryID: l.categoryID || "",
      })),
    );

    if (type === "Action Item") {
      values[I.status] = byId("calFldStatus").value;
      values[I.dueDate] = byId("calFldDue").value.trim();
      values[I.assignedTo] = state.draftAssigned
        ? state.draftAssigned.empUID
        : "";
    } else {
      values[I.status] = "";
      values[I.dueDate] = "";
      values[I.assignedTo] = "";
    }
    if (type === "Out-of-Office") {
      values[I.endDate] = byId("calFldEnd").value.trim();
      values[I.coveredBy] = state.draftCovered ? state.draftCovered.empUID : "";
    } else {
      values[I.endDate] = "";
      values[I.coveredBy] = "";
    }
    if (type === "Daily Scrum") {
      values[I.opsScrumNotes] = normalizeRichText(
        getRichTextValue("calFldOpsScrum"),
      );
      values[I.devScrumNotes] = normalizeRichText(
        getRichTextValue("calFldDevScrum"),
      );
    } else {
      values[I.opsScrumNotes] = "";
      values[I.devScrumNotes] = "";
    }

    try {
      let recordID = byId("calEntryRecordID").value;
      const isNew = !recordID;
      if (isNew) {
        recordID = await createRecord();
      }
      await writeIndicators(recordID, values);
      if (isNew) await submitRecord(recordID);
      await syncRecordTitle(recordID, title);

      closeModal("calEntryModal");
      announce(isNew ? "Entry created." : "Entry saved.");
      setStatus("Reloading…");
      await loadEntries();
      render();
    } catch (e) {
      msg.textContent = `Save failed: ${e.message}`;
      logDebug("save error", e);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = state.editing ? "Save changes" : "Save entry";
    }
  }

  async function deleteEntry() {
    const recordID = byId("calEntryRecordID").value;
    if (!recordID) return;
    if (!window.confirm("Delete this entry? This can't be undone.")) return;
    try {
      // LEAF's real endpoint for removing a record is "cancel", not
      // "delete" — confirmed from LEAF's own print_form.tpl. It returns
      // the literal value 1 on success, or an error string otherwise.
      const res = await apiPost(
        `./api/form/${encodeURIComponent(recordID)}/cancel`,
        {
          CSRFToken: CSRF,
        },
      );
      if (String(res).trim() !== "1") {
        throw new Error(
          typeof res === "string" ? res : "Request was not cancelled",
        );
      }
      closeModal("calEntryModal");
      announce("Entry deleted.");
      await loadEntries();
      render();
    } catch (e) {
      byId("calEntryMsg").textContent = `Delete failed: ${e.message}`;
    }
  }

  /* ============================================================
   Day peek popover ("+N more")
   ============================================================ */
  function openDayPeek(dateKey, anchorEl) {
    const peek = byId("calDayPeek");
    if (!peek) return;
    const d = parseYMD(dateKey);
    const list = entriesForDay(dateKey);
    peek.innerHTML = `<div class="cal-dayPeekHead">${escapeHtml(fmtLongDate(d))}<button type="button" data-close-peek aria-label="Close"><span class="material-symbols-outlined" aria-hidden="true">close</span></button></div>${list.map((e) => chipHTML(e)).join("")}`;
    peek.hidden = false;
    const r = anchorEl.getBoundingClientRect();
    const top = window.scrollY + r.bottom + 4;
    let left = window.scrollX + r.left;
    left = Math.min(left, window.scrollX + window.innerWidth - 320);
    peek.style.top = `${top}px`;
    peek.style.left = `${Math.max(8, left)}px`;
    // Move focus to the close button so keyboard/AT users land somewhere sensible
    const closeBtn = peek.querySelector("[data-close-peek]");
    if (closeBtn) closeBtn.focus();
  }
  function closeDayPeek() {
    const p = byId("calDayPeek");
    if (p) p.hidden = true;
  }

  /* ============================================================
   Event wiring
   ============================================================ */
  function wireControls() {
    // Navigation
    byId("calPrevBtn").addEventListener("click", () => navigate(-1));
    byId("calNextBtn").addEventListener("click", () => navigate(1));
    byId("calTodayBtn").addEventListener("click", () => {
      state.cursor = startOfDay(new Date());
      render();
    });

    // View toggle
    document.querySelectorAll(".cal-viewBtn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".cal-viewBtn").forEach((b) => {
          b.classList.remove("is-active");
          b.setAttribute("aria-selected", "false");
        });
        btn.classList.add("is-active");
        btn.setAttribute("aria-selected", "true");
        state.view = btn.getAttribute("data-view");
        render();
      });
    });

    // Filters — multi-select dropdowns for Type / Author / Assigned to
    initMultiSelect("type", "calFilterTypeMS");
    initMultiSelect("author", "calFilterAuthorMS");
    initMultiSelect("assignee", "calFilterAssigneeMS");
    renderMultiSelectOptions(
      "type",
      TYPES.map((t) => ({
        value: t,
        label: t === "Action Item" ? "Action Items" : t,
      })),
    );

    byId("calShowClosed").addEventListener("change", function onChange() {
      state.filters.showClosed = this.checked;
      render();
    });
    byId("calFilterSearch").addEventListener(
      "input",
      debounce(() => {
        state.filters.search = byId("calFilterSearch").value.trim();
        render();
      }, 200),
    );
    byId("calClearFilters").addEventListener("click", () => {
      state.filters = {
        type: [],
        author: [],
        assignee: [],
        search: "",
        showClosed: false,
      };
      setMultiSelectValues("type", []);
      setMultiSelectValues("author", []);
      setMultiSelectValues("assignee", []);
      byId("calFilterSearch").value = "";
      byId("calShowClosed").checked = false;
      syncLegendActive();
      render();
    });

    // Legend — click a type to toggle it in/out of the Type filter's
    // selected set (multiple legend items can be active at once).
    document.querySelectorAll("[data-legend-type]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const type = btn.getAttribute("data-legend-type");
        const set = new Set(state.filters.type || []);
        if (set.has(type)) set.delete(type);
        else set.add(type);
        setMultiSelectValues("type", Array.from(set));
        syncLegendActive();
        render();
      });
    });

    // Edit button inside the read-only entry view
    byId("calEditBtn").addEventListener("click", switchToEditMode);

    // Add
    byId("calAddBtn").addEventListener("click", () => openEntryModal(null));

    // Delegated clicks across views
    document.addEventListener("click", onDelegatedClick);

    // Day cell / chip keyboard activation + Escape handling
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (!byId("calDayPeek").hidden) {
          closeDayPeek();
          return;
        }
        if (modalStack.length) closeModal(modalStack[modalStack.length - 1].id);
        return;
      }
      if (e.key !== "Enter" && e.key !== " ") return;
      const cell = e.target.closest && e.target.closest(".cal-dayCell");
      if (cell && e.target === cell) {
        e.preventDefault();
        openEntryModal(null, cell.getAttribute("data-day"));
        return;
      }
      const card =
        e.target.closest && e.target.closest('[role="button"][data-record]');
      if (card && e.target === card) {
        e.preventDefault();
        card.click();
      }
    });

    // Modal close buttons / backdrops
    document.querySelectorAll("[data-close]").forEach((el) => {
      el.addEventListener("click", () => {
        const which = el.getAttribute("data-close");
        const map = {
          entry: "calEntryModal",
          link: "calLinkModal",
          record: "calRecordModal",
        };
        closeModal(map[which]);
        if (which === "record") byId("calRecordFrame").src = "about:blank";
      });
    });

    // Entry form
    byId("calEntryForm").addEventListener("submit", (e) => {
      e.preventDefault();
      saveEntry();
    });
    byId("calDeleteBtn").addEventListener("click", deleteEntry);
    byId("calFldType").addEventListener("change", function onChange() {
      applyConditionalFields(this.value);
      maybeAutoFillScrumTitle();
      byId("calScrumDupe").hidden = true;
    });

    // Daily Scrum title auto-fill: "MM/DD/YYYY • Daily Scrum", regenerated
    // as the date changes, but only until the person types in Title
    // themselves (real keystrokes fire 'input'; our own programmatic
    // fills below don't, so this only trips on genuine manual edits).
    byId("calFldTitle").addEventListener("input", () => {
      state.scrumTitleAuto = false;
    });
    byId("calFldDate").addEventListener("input", () => {
      maybeAutoFillScrumTitle();
      byId("calScrumDupe").hidden = true;
    });
    byId("calFldDate").addEventListener("change", maybeAutoFillScrumTitle);

    // NOTE: Trumbowyg is intentionally NOT initialized here. Building it
    // while the modal is still display:none (page load, before it's ever
    // opened) leaves the editable area permanently non-interactive even
    // after the modal becomes visible later. It's initialized lazily
    // instead, in setEntryModalMode(), the first time the edit form is
    // genuinely on-screen — see initBodyEditor() call there.

    // MM/DD/YYYY date fields — auto-format + validate as-you-type
    wireDateInput("calFldDate", "calFldDate_error");
    wireDateInput("calFldDue", "calFldDue_error");
    wireDateInput("calFldEnd", "calFldEnd_error");

    // People pickers — LEAF's native orgchart employee selector, loaded
    // on demand from the orgchart app.
    initEmployeeSelector("assigned");
    initEmployeeSelector("covered");

    // Link picker
    byId("calLinkAddBtn").addEventListener("click", () => {
      ensureLinkFormFilter();
      byId("calLinkSearch").value = "";
      byId("calLinkResults").innerHTML =
        '<p class="cal-linkHint">Type at least 2 characters to search across all forms.</p>';
      openModal("calLinkModal");
      setTimeout(() => byId("calLinkSearch").focus(), 50);
    });
    byId("calLinkSearch").addEventListener("input", linkSearchRun);
    byId("calLinkFormFilter").addEventListener("change", linkSearchRun);

    // Jump to top
    const jump = byId("calJumpTop");
    window.addEventListener(
      "scroll",
      () => {
        jump.hidden = window.scrollY < 400;
      },
      { passive: true },
    );
    jump.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // Close peek on outside click
    document.addEventListener("click", (e) => {
      const peek = byId("calDayPeek");
      if (peek.hidden) return;
      if (!peek.contains(e.target) && !e.target.closest("[data-more]"))
        closeDayPeek();
    });
  }

  function onDelegatedClick(e) {
    // Edit pencil on a card — opens straight into edit mode
    const editBtn = e.target.closest("[data-edit-record]");
    if (editBtn) {
      e.stopPropagation();
      const rid = editBtn.getAttribute("data-edit-record");
      const entry = state.entries.find((x) => x.recordID === rid);
      if (entry) openEntryModal(entry, null, "edit");
      return;
    }

    // OOO band (spanning pill, week or month view)
    const oooBand = e.target.closest(".cal-oooBand");
    if (oooBand) {
      const rid = oooBand.getAttribute("data-record");
      const entry = state.entries.find((x) => x.recordID === rid);
      if (entry) openEntryModal(entry);
      return;
    }

    // Open a record chip / card — defaults to read-only view
    const recEl = e.target.closest("[data-record]");
    if (
      recEl &&
      !e.target.closest(
        "[data-remove-link],[data-open-link],[data-close],.cal-linkResult",
      )
    ) {
      const rid = recEl.getAttribute("data-record");
      const entry = state.entries.find((x) => x.recordID === rid);
      if (entry) openEntryModal(entry);
      return;
    }

    // "+N more"
    const more = e.target.closest("[data-more]");
    if (more) {
      e.stopPropagation();
      openDayPeek(more.getAttribute("data-more"), more);
      return;
    }

    // close peek button
    if (e.target.closest("[data-close-peek]")) {
      closeDayPeek();
      return;
    }

    // Empty day cell / week column body → new entry for that day
    const body = e.target.closest(".cal-weekColBody");
    if (body && !e.target.closest("[data-record]")) {
      openEntryModal(null, body.getAttribute("data-day"));
      return;
    }
    const cell = e.target.closest(".cal-dayCell");
    if (cell && e.target === cell) {
      openEntryModal(null, cell.getAttribute("data-day"));
      return;
    }
    const chips = e.target.closest(".cal-dayChips");
    if (cell && !chips && !e.target.closest("[data-record],[data-more]")) {
      openEntryModal(null, cell.getAttribute("data-day"));
      return;
    }

    // Draft link chip: open record
    const openLink = e.target.closest("[data-open-link]");
    if (openLink) {
      const l = state.draftLinks[+openLink.getAttribute("data-open-link")];
      if (l) openRecord(l.recordID, l.title);
      return;
    }
    // Draft link chip: remove
    const rmLink = e.target.closest("[data-remove-link]");
    if (rmLink) {
      state.draftLinks.splice(+rmLink.getAttribute("data-remove-link"), 1);
      renderDraftLinks();
      return;
    }
    // Clear a picked person
    const clearP = e.target.closest("[data-clear-person]");
    if (clearP) {
      clearPerson(clearP.getAttribute("data-clear-person"));
      return;
    }
    // Link search result add/remove
    const lr = e.target.closest(".cal-linkResult");
    if (lr) {
      toggleDraftLink(
        lr.getAttribute("data-record"),
        lr.getAttribute("data-cat"),
        lr.getAttribute("data-title"),
        lr.getAttribute("data-form"),
      );
    }
  }

  function navigate(dir) {
    if (state.view === "week") state.cursor = addDays(state.cursor, dir * 7);
    else
      state.cursor = new Date(
        state.cursor.getFullYear(),
        state.cursor.getMonth() + dir,
        1,
      );
    render();
  }

  /* ============================================================
   Init
   ============================================================ */
  async function main() {
    wireControls();
    render(); // paints the empty grid immediately

    if (DEBUG) {
      await runDiagnostics();
    }

    if (String(CONFIG.categoryID).indexOf("REPLACE_ME") === 0) {
      setStatus(
        "Calendar not configured yet — set CONFIG.categoryID and indicator IDs in calendar.js.",
        true,
      );
      return;
    }

    const hasAnyIndicator = Object.values(CONFIG.indicators).some(
      (v) => v && v !== "REPLACE_ME",
    );
    if (!hasAnyIndicator) {
      setStatus(
        "Calendar not configured yet — set CONFIG.indicators in calendar.js.",
        true,
      );
      return;
    }

    try {
      await loadEntries();
      render();
    } catch (e) {
      setStatus(`Could not load entries. ${e.message}`, true);
      logDebug("load failed", e);
    }
  }

  document.addEventListener("DOMContentLoaded", main);
})();
