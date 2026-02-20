<div id="pkWrap30" style="max-width: 820px;">
  <div style="display:flex; gap:0.75rem; align-items:flex-end; flex-wrap:wrap;">
    <div style="flex:1; min-width: 260px;">
      <div style="font-weight:600; margin-bottom:0.25rem;">OKR</div>
      <input id="pkSearch30" type="text" autocomplete="off" placeholder="Search OKR key or name"
        style="width:100%; padding:0.45rem 0.55rem; border:1px solid #c9c9c9; border-radius:0.5rem;">
    </div>

    <div style="display:flex; gap:0.5rem; align-items:center;">
      <button type="button" id="pkClear30" class="buttonNorm" style="white-space:nowrap;">Clear</button>
    </div>
  </div>

  <div id="pkMsg30" style="margin-top:0.5rem; font-size:0.9rem;"></div>

  <div style="margin-top:0.6rem;">
    <div style="font-weight:600; margin-bottom:0.35rem;">Available OKRs</div>
    <div id="pkList30"
      style="border:1px solid #d9d9d9; border-radius:0.6rem; padding:0.6rem; min-height: 140px; max-height: 260px; overflow-y:auto; background:#fff;">
    </div>
  </div>

  <div style="margin-top:0.75rem;">
    <div style="font-weight:600; margin-bottom:0.35rem;">Selected OKR</div>
    <div id="pkSelected30"
      style="border:1px solid #d9d9d9; border-radius:0.6rem; padding:0.6rem; background:#fff;">
    </div>
  </div>
</div>

<style>
  /* Hide only the real OKR-bound field for indicator 30 (keeps custom UI visible) */
  .response.blockIndicator_30 [name="30"] { display:none !important; }
  .response.blockIndicator_30 textarea[name="30"],
  .response.blockIndicator_30 input[name="30"],
  .response.blockIndicator_30 select[name="30"] { display:none !important; }
</style>

<script>
(function () {
  // Task field being programmed (this is where we store the selected OKR key)
  const TARGET_IND = 30;

  // OKR form fields
  const OKR_KEY_IND = 23;
  const OKR_NAME_IND = 24;

  // ── Autofill from project ──────────────────────────────────────────────────
  const PROJECT_KEY_IND = 8;   // ind 8 on this form = selected project key
  const PROJ_KEY_IND    = 2;   // ind 2 on project record = project key
  const PROJ_OKR_IND    = 29;  // ind 29 on project record = OKR key
  const PROJ_KR_IND     = 37;  // ind 37 on project record = KR name
  const KR_TARGET_IND   = 39;  // ind 39 on this form = KR to auto-fill

  // Endpoints
  const BASE_QUERY_ENDPOINT = "https://leaf.va.gov/platform/projects/api/form/query/";

  const wrap = document.getElementById("pkWrap30");
  const searchEl = document.getElementById("pkSearch30");
  const listEl = document.getElementById("pkList30");
  const selectedEl = document.getElementById("pkSelected30");
  const msgEl = document.getElementById("pkMsg30");
  const clearBtn = document.getElementById("pkClear30");
  if (!wrap || !searchEl || !listEl || !selectedEl || !msgEl || !clearBtn) return;

  // ── Field finder ──────────────────────────────────────────────────────────
  function findField(indicatorId) {
    const within = wrap.closest(".response") || wrap.parentElement;
    let el = within ? within.querySelector('[name="' + indicatorId + '"]') : null;
    if (!el) el = document.querySelector('[name="' + indicatorId + '"]');
    return el;
  }

  function setMsg(text, kind) {
    msgEl.textContent = text || "";
    msgEl.style.color = kind === "error" ? "#b50909" : (kind === "ok" ? "#008423" : "");
  }

  function safe(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Lazily find the real OKR field each time
  function getOkrFieldEl() { return findField(TARGET_IND); }

  function writeValue(val) {
    const el = getOkrFieldEl();
    if (!el) return;
    el.value = String(val || "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function readValue() {
    const el = getOkrFieldEl();
    return el ? String(el.value || "").trim() : "";
  }

  function writeFieldByInd(indicatorId, val) {
    const el = findField(indicatorId);
    if (!el) return;
    el.value = String(val || "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function readFieldByInd(indicatorId) {
    const el = findField(indicatorId);
    return el ? String(el.value || "").trim() : "";
  }

  function coerceRows(json) {
    if (Array.isArray(json)) return json;
    if (json && typeof json === "object") {
      if (Array.isArray(json.data)) return json.data;
      if (Array.isArray(json.records)) return json.records;
      if (Array.isArray(json.results)) return json.results;
      const keys = Object.keys(json);
      const keyed = keys.length && keys.every(k => /^\d+$/.test(k));
      if (keyed) {
        return keys.map(k => {
          const row = json[k] || {};
          if (!row.recordID && !row.recordId && !row.id) row.recordID = k;
          return row;
        });
      }
    }
    return [];
  }

  function extractFromS1(row, indicatorId) {
    if (!row || !row.s1) return "";
    const key = "id" + String(indicatorId);
    const v = row.s1[key];
    if (v == null) return "";
    return String(v).trim();
  }

  function hasAnyS1Value(row, indicatorIds) {
    if (!row || !row.s1) return false;
    for (let i = 0; i < indicatorIds.length; i++) {
      const key = "id" + String(indicatorIds[i]);
      const v = row.s1[key];
      if (v !== null && v !== undefined && String(v).trim() !== "") return true;
    }
    return false;
  }

  // ── OKR list query ────────────────────────────────────────────────────────
  function buildOkrsQueryUrl() {
    const q = {
      terms: [{ id: "deleted", operator: "=", match: 0, gate: "AND" }],
      joins: [],
      sort: {},
      getData: [String(OKR_KEY_IND), String(OKR_NAME_IND)]
    };
    return BASE_QUERY_ENDPOINT + "?q=" + encodeURIComponent(JSON.stringify(q)) + "&x-filterData=recordID,";
  }

  // ── Project query ─────────────────────────────────────────────────────────
  function buildProjectQueryUrl(projectKey) {
    const q = {
      terms: [
        { id: "deleted",            operator: "=", match: 0,          gate: "AND" },
        { id: String(PROJ_KEY_IND), operator: "=", match: projectKey, gate: "AND" }
      ],
      joins: [],
      sort: {},
      getData: [String(PROJ_KEY_IND), String(PROJ_OKR_IND), String(PROJ_KR_IND)]
    };
    return BASE_QUERY_ENDPOINT + "?q=" + encodeURIComponent(JSON.stringify(q)) + "&x-filterData=recordID,";
  }

  let okrs = []; // { key, name }

  // ── Silently fill ind 30 and ind 39 from the project record ───────────────
  function autofillFromProject(projectKey, callback) {
    if (!projectKey) { if (callback) callback(); return; }
    fetch(buildProjectQueryUrl(projectKey), { credentials: "include" })
      .then(r => r.json())
      .then(json => {
        const rows = coerceRows(json);
        const match = rows.find(row => String(extractFromS1(row, PROJ_KEY_IND)) === String(projectKey));
        if (match) {
          writeValue(extractFromS1(match, PROJ_OKR_IND));
          writeFieldByInd(KR_TARGET_IND, extractFromS1(match, PROJ_KR_IND));
          renderAll();
        }
        if (callback) callback();
      })
      .catch(() => { if (callback) callback(); });
  }

  // ── Submit hook — fill before save then let the submit proceed ────────────
  function isSubmitEndpoint(url) {
    try {
      return /\/api\/form\/\d+\/submit\/?$/.test(new URL(url, window.location.origin).pathname);
    } catch (e) {
      return /\/api\/form\/\d+\/submit\/?/.test(String(url || ""));
    }
  }

  function hookFetchAndXHR() {
    if (window.fetch && !window.fetch.__autofillOkrKr30Hooked) {
      const origFetch = window.fetch;
      window.fetch = function (input, init) {
        const url = (typeof input === "string") ? input : (input && input.url);
        if (url && isSubmitEndpoint(url)) {
          const projectKey = readFieldByInd(PROJECT_KEY_IND);
          if (projectKey) {
            // Fire-and-forget: write values synchronously from cache if possible,
            // then let the fetch proceed normally
            autofillFromProject(projectKey, null);
          }
        }
        return origFetch.apply(this, arguments);
      };
      window.fetch.__autofillOkrKr30Hooked = true;
    }

    if (window.XMLHttpRequest && !window.XMLHttpRequest.__autofillOkrKr30Hooked) {
      const OriginalXHR = window.XMLHttpRequest;
      function WrappedXHR() {
        const xhr = new OriginalXHR();
        const origOpen = xhr.open.bind(xhr);
        const origSend = xhr.send.bind(xhr);
        xhr.open = function (method, url) {
          xhr.__leafUrl = url;
          return origOpen(method, url);
        };
        xhr.send = function (body) {
          if (xhr.__leafUrl && isSubmitEndpoint(xhr.__leafUrl)) {
            autofillFromProject(readFieldByInd(PROJECT_KEY_IND), null);
          }
          return origSend(body);
        };
        return xhr;
      }
      WrappedXHR.prototype = OriginalXHR.prototype;
      window.XMLHttpRequest = WrappedXHR;
      window.XMLHttpRequest.__autofillOkrKr30Hooked = true;
    }
  }

  function matchesSearch(okr, q) {
    if (!q) return true;
    const hay = (String(okr.key) + " " + String(okr.name)).toLowerCase();
    return hay.includes(q);
  }

  function renderSelected() {
    const val = readValue();
    if (!val) {
      selectedEl.innerHTML = '<div style="opacity:0.75;">No OKR selected</div>';
      return;
    }
    const found = okrs.find(okr => String(okr.key) === String(val));
    const label = found
      ? (found.key + (found.name ? (" | " + found.name) : ""))
      : val;

    selectedEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; gap:0.75rem; align-items:flex-start;">
        <div style="min-width:0;">
          <div style="font-weight:700;">${safe(label)}</div>
          <div style="opacity:0.85; font-size:0.9rem;">Stored value: ${safe(val)}</div>
        </div>
        <button type="button" class="buttonNorm" id="pkClearSelected30" style="white-space:nowrap;">Remove</button>
      </div>
    `;

    const btn = document.getElementById("pkClearSelected30");
    if (btn) btn.addEventListener("click", () => {
      writeValue("");
      renderAll();
    });
  }

  function renderList() {
    const q = String(searchEl.value || "").trim().toLowerCase();
    const visible = okrs
      .filter(okr => matchesSearch(okr, q))
      .sort((a, b) => String(a.key).localeCompare(String(b.key), undefined, { numeric: true, sensitivity: "base" }));

    if (visible.length === 0) {
      listEl.innerHTML = '<div style="opacity:0.75;">No OKRs match your search</div>';
      return;
    }

    const current = readValue();

    listEl.innerHTML = visible.map(okr => {
      const label = okr.key + (okr.name ? (" | " + okr.name) : "");
      const checked = String(current) === String(okr.key);
      return `
        <label style="display:flex; gap:0.5rem; align-items:flex-start; padding:0.3rem 0; border-bottom:1px solid #f0f0f0; cursor:pointer;">
          <input type="radio" name="pkRadio30" class="pkRadio30" data-key="${safe(okr.key)}" ${checked ? "checked" : ""} style="margin-top:0.2rem;">
          <div style="min-width:0;">
            <div style="font-weight:600;">${safe(okr.key)}</div>
            <div style="opacity:0.9; word-break:break-word;">${safe(okr.name || "")}</div>
          </div>
        </label>
      `;
    }).join("");

    listEl.querySelectorAll(".pkRadio30").forEach(r => {
      r.addEventListener("change", () => {
        const key = String(r.getAttribute("data-key") || "");
        writeValue(key);
        renderSelected();
      });
    });
  }

  function renderAll() {
    renderList();
    renderSelected();
  }

  async function loadOkrs() {
    if (!getOkrFieldEl()) {
      setMsg("Could not find the real OKR field for this indicator. The custom selector must bind to the platform input to persist.", "error");
      return;
    }

    setMsg("Loading OKRs...", "");
    const url = buildOkrsQueryUrl();
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) throw new Error("OKR list fetch failed. HTTP " + r.status);
    const json = await r.json();
    const rows = coerceRows(json);

    okrs = rows
      .filter(row => hasAnyS1Value(row, [OKR_KEY_IND, OKR_NAME_IND]))
      .map(row => ({
        key: extractFromS1(row, OKR_KEY_IND),
        name: extractFromS1(row, OKR_NAME_IND)
      }))
      .filter(okr => okr.key);

    setMsg("Loaded " + okrs.length + " OKRs.", "ok");

    // On load: silently fill ind 30 + ind 39 from project, then render
    const projectKey = readFieldByInd(PROJECT_KEY_IND);
    autofillFromProject(projectKey, renderAll);

    // Hook save to re-fill before submit
    hookFetchAndXHR();
  }

  clearBtn.addEventListener("click", () => {
    writeValue("");
    searchEl.value = "";
    renderAll();
  });

  searchEl.addEventListener("input", renderList);

  loadOkrs().catch(err => setMsg(String(err), "error"));
})();
</script>
