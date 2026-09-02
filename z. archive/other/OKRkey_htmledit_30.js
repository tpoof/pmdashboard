<div id="pkWrap30" style="max-width: 820px;">
  <div id="pkSummary30" class="pm-picker-summary" style="display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;">
    <div class="pm-picker-summary-label" style="font-weight:600; min-width:120px;">OKR</div>
    <div id="pkSummaryVal30" class="pm-picker-summary-value" style="flex:1; min-width:200px; padding:0.25rem 0;">None selected</div>
    <button type="button" id="pkToggle30" class="buttonNorm pm-picker-change" aria-expanded="false" aria-controls="pkPanel30" style="white-space:nowrap;">Change</button>
  </div>

  <div id="pkPanel30" class="pm-picker-panel" style="display:none; margin-top:0.6rem;">
    <div class="pm-picker-search-row" style="display:flex; gap:0.75rem; align-items:flex-end; flex-wrap:wrap;">
      <div style="flex:1; min-width: 260px;">
        <input id="pkSearch30" class="pm-picker-search" type="text" autocomplete="off" placeholder="Search OKR key or name" aria-label="Search OKR key or name"
          style="width:100%; padding:0.45rem 0.55rem; border:1px solid #c9c9c9; border-radius:0.5rem;">
      </div>

      <div style="display:flex; gap:0.5rem; align-items:center;">
        <button type="button" id="pkSearchClear30" class="pm-picker-search-clear" hidden>Clear search</button>
        <button type="button" id="pkClear30" class="buttonNorm" style="white-space:nowrap;">Clear</button>
        <button type="button" id="pkClose30" class="buttonNorm" style="white-space:nowrap;">Close</button>
      </div>
    </div>

    <div id="pkMsg30" style="margin-top:0.5rem; font-size:0.9rem;"></div>

    <div style="margin-top:0.6rem;">
      <div style="font-weight:600; margin-bottom:0.35rem;">Available OKRs</div>
      <div id="pkList30" class="pm-picker-list"
        style="border:1px solid #d9d9d9; border-radius:0.6rem; padding:0.6rem; min-height: 140px; max-height: 260px; overflow-y:auto; background:#fff;">
      </div>
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
  function ensurePickerStyles() {
    if (document.getElementById("pm-picker-styles")) return;
    const style = document.createElement("style");
    style.id = "pm-picker-styles";
    style.textContent = `
.pm-picker-summary { background:#f7f8fa; border:1px solid #d0d5dd; border-radius:0.6rem; padding:0.5rem 0.6rem; }
.pm-picker-summary:hover { background:#f2f4f7; }
.pm-picker-summary:focus-within { outline:2px solid #1f6feb; outline-offset:2px; }
.pm-picker-summary-value { min-height:1.3rem; }
.pm-picker-none { color:#5b6270; font-size:0.95rem; }
.pm-picker-badge { display:inline-flex; align-items:center; gap:0.35rem; background:#e8f2ff; border:1px solid #b9d6ff; color:#0b3d91; padding:0.15rem 0.5rem; border-radius:999px; font-weight:600; font-size:0.9rem; }
.pm-picker-badge-check { font-weight:700; }
.pm-picker-change.buttonNorm { margin-left:auto; }
.pm-picker-panel { border:1px solid #d0d5dd; border-radius:0.6rem; padding:0.6rem; background:#fff; }
.pm-picker-search { width:100%; }
.pm-picker-search-clear { border:1px solid #c9c9c9; background:#fff; border-radius:0.5rem; padding:0.3rem 0.5rem; font-size:0.85rem; }
.pm-picker-search-clear:focus-visible { outline:2px solid #1f6feb; outline-offset:2px; }
.pm-picker-list { padding:0.35rem; }
.pm-picker-option { display:flex; gap:0.5rem; align-items:flex-start; padding:0.35rem 0.4rem; border-radius:0.5rem; cursor:pointer; border-left:3px solid transparent; }
.pm-picker-option:hover { background:#f5f7fb; }
.pm-picker-option--selected { background:#eef6ff; border-left-color:#2f6fed; }
.pm-picker-option:focus-within { outline:2px solid #1f6feb; outline-offset:2px; }
.pm-picker-option-status { display:inline-flex; align-items:center; gap:0.25rem; font-size:0.8rem; color:#2f6fed; font-weight:600; }
.pm-picker-empty { font-size:0.9rem; color:#5b6270; padding:0.4rem; }
    `;
    document.head.appendChild(style);
  }
  // Task field being programmed (this is where we store the selected OKR key)
  const TARGET_IND = 30;

  // OKR form fields
  const OKR_KEY_IND = 23;
  const OKR_NAME_IND = 24;

  // Endpoints
  const BASE_QUERY_ENDPOINT = "https://leaf.va.gov/platform/projects/api/form/query/";

  const wrap = document.getElementById("pkWrap30");
  const searchEl = document.getElementById("pkSearch30");
  const listEl = document.getElementById("pkList30");
  const summaryValEl = document.getElementById("pkSummaryVal30");
  const msgEl = document.getElementById("pkMsg30");
  const clearBtn = document.getElementById("pkClear30");
  const toggleBtn = document.getElementById("pkToggle30");
  const panelEl = document.getElementById("pkPanel30");
  const closeBtn = document.getElementById("pkClose30");
  const searchClearBtn = document.getElementById("pkSearchClear30");
  if (!wrap || !searchEl || !listEl || !summaryValEl || !msgEl || !clearBtn || !toggleBtn || !panelEl || !closeBtn || !searchClearBtn) return;
  ensurePickerStyles();

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

  // Bind to the real OKR field for this indicator (30)
  function findOkrBoundField() {
    const within = wrap.closest(".response") || wrap.parentElement;
    let el = within ? within.querySelector('[name="' + TARGET_IND + '"]') : null;
    if (!el) el = document.querySelector('[name="' + TARGET_IND + '"]');
    return el;
  }
  const okrFieldEl = findOkrBoundField();

  function writeValue(val) {
    if (!okrFieldEl) return;
    okrFieldEl.value = String(val || "");
    okrFieldEl.dispatchEvent(new Event("input", { bubbles: true }));
    okrFieldEl.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function readValue() {
    return okrFieldEl ? String(okrFieldEl.value || "").trim() : "";
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

  function buildOkrsQueryUrl() {
    const q = {
      terms: [{ id: "deleted", operator: "=", match: 0, gate: "AND" }],
      joins: [],
      sort: {},
      getData: [String(OKR_KEY_IND), String(OKR_NAME_IND)]
    };
    return BASE_QUERY_ENDPOINT + "?q=" + encodeURIComponent(JSON.stringify(q)) + "&x-filterData=recordID,";
  }

  let okrs = []; // { key, name }

  function matchesSearch(okr, q) {
    if (!q) return true;
    const hay = (String(okr.key) + " " + String(okr.name)).toLowerCase();
    return hay.includes(q);
  }

  function renderSummary() {
    const val = readValue();
    if (!val) {
      summaryValEl.innerHTML = '<span class="pm-picker-none">None selected</span>';
      return;
    }
    const found = okrs.find(okr => String(okr.key) === String(val));
    const label = found
      ? (found.key + (found.name ? (" | " + found.name) : ""))
      : val;
    summaryValEl.innerHTML = '<span class="pm-picker-badge"><span class="pm-picker-badge-check" aria-hidden="true">✓</span><span>' + safe(label) + '</span></span>';
  }

  function renderList() {
    const q = String(searchEl.value || "").trim().toLowerCase();
    const visible = okrs
      .filter(okr => matchesSearch(okr, q))
      .sort((a, b) => String(a.key).localeCompare(String(b.key), undefined, { numeric: true, sensitivity: "base" }));

    if (visible.length === 0) {
      listEl.innerHTML = '<div class="pm-picker-empty">No matches</div>';
      return;
    }

    const current = readValue();

    listEl.innerHTML = visible.map(okr => {
      const label = okr.key + (okr.name ? (" | " + okr.name) : "");
      const checked = String(current) === String(okr.key);
      const selectedMark = checked ? '<div class="pm-picker-option-status"><span aria-hidden="true">✓</span>Selected</div>' : "";
      return `
        <label class="pm-picker-option ${checked ? "pm-picker-option--selected" : ""}" style="display:flex; gap:0.5rem; align-items:flex-start;">
          <input type="radio" name="pkRadio30" class="pkRadio30" data-key="${safe(okr.key)}" ${checked ? "checked" : ""} style="margin-top:0.2rem;">
          <div style="min-width:0;">
            <div style="font-weight:600;">${safe(okr.key)}</div>
            <div style="opacity:0.9; word-break:break-word;">${safe(okr.name || "")}</div>
            ${selectedMark}
          </div>
        </label>
      `;
    }).join("");

    listEl.querySelectorAll(".pkRadio30").forEach(r => {
      r.addEventListener("change", () => {
        const key = String(r.getAttribute("data-key") || "");
        writeValue(key);
        renderSummary();
        setExpanded(false);
      });
    });
  }

  function updateSearchClear() {
    searchClearBtn.hidden = !String(searchEl.value || "");
  }

  function renderAll() {
    if (panelEl.style.display !== "none") {
      renderList();
      updateSearchClear();
    }
    renderSummary();
  }

  function setExpanded(isOpen) {
    panelEl.style.display = isOpen ? "" : "none";
    toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }

  async function loadOkrs() {
    if (!okrFieldEl) {
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
    renderAll();
  }

  clearBtn.addEventListener("click", () => {
    writeValue("");
    searchEl.value = "";
    renderAll();
  });

  searchClearBtn.addEventListener("click", () => {
    searchEl.value = "";
    updateSearchClear();
    renderList();
    searchEl.focus();
  });

  toggleBtn.addEventListener("click", () => {
    setExpanded(true);
    searchEl.focus();
    renderList();
    updateSearchClear();
  });

  closeBtn.addEventListener("click", () => {
    setExpanded(false);
  });

  searchEl.addEventListener("input", () => {
    updateSearchClear();
    renderList();
  });

  loadOkrs().catch(err => setMsg(String(err), "error"));
})();
</script>
