<div id="krWrap39" style="max-width: 820px;">

  <!-- KR Section (conditionally shown when an OKR is selected in ind 30) -->
  <div id="krSection39" style="display:none;">
    <div id="krSummary39" style="display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;">
      <div style="font-weight:600; min-width:120px;">Key Result</div>
      <div id="krSummaryVal39" style="flex:1; min-width:200px; padding:0.25rem 0;">None selected</div>
      <button type="button" id="krToggle39" class="buttonNorm" aria-expanded="false" aria-controls="krPanel39" style="white-space:nowrap;">Change</button>
    </div>

    <div id="krPanel39" style="display:none; margin-top:0.6rem;">
      <div style="display:flex; gap:0.75rem; align-items:flex-end; flex-wrap:wrap;">
        <div style="flex:1; min-width: 260px;">
          <input id="krSearch39" type="text" autocomplete="off" placeholder="Search Key Results" aria-label="Search Key Results"
            style="width:100%; padding:0.45rem 0.55rem; border:1px solid #c9c9c9; border-radius:0.5rem;">
        </div>

        <div style="display:flex; gap:0.5rem; align-items:center;">
          <button type="button" id="krClear39" class="buttonNorm" style="white-space:nowrap;">Clear</button>
          <button type="button" id="krClose39" class="buttonNorm" style="white-space:nowrap;">Close</button>
        </div>
      </div>

      <div id="krMsg39" style="margin-top:0.5rem; font-size:0.9rem;"></div>

      <div style="margin-top:0.6rem;">
        <div style="font-weight:600; margin-bottom:0.35rem;">Available Key Results</div>
        <div id="krList39"
          style="border:1px solid #d9d9d9; border-radius:0.6rem; padding:0.6rem; min-height: 140px; max-height: 320px; overflow:auto; background:#fff;">
        </div>
      </div>
    </div>

  </div>

  <!-- Shown when no OKR is selected yet -->
  <div id="krNoOkr39"
    style="padding:0.6rem; font-size:0.9rem; opacity:0.7; border:1px dashed #c9c9c9; border-radius:0.6rem;">
    Select an OKR above to see available Key Results.
  </div>

</div>

<style>
  /* Hide the real platform field for indicator 39 */
  .response.blockIndicator_39 [name="39"] { display:none !important; }
  .response.blockIndicator_39 textarea[name="39"],
  .response.blockIndicator_39 input[name="39"],
  .response.blockIndicator_39 select[name="39"] { display:none !important; }
</style>

<script>
(function () {
  // ── Indicator IDs ──────────────────────────────────────────────────────────
  const TARGET_IND   = 39;   // Where the selected KR name is saved (this form)
  const OKR_IND      = 30;   // OKR selector field (this form) – read-only here
  const KR_NAME_IND  = 36;   // KR name field inside KR records
  const KR_PARENT_IND = 35;  // Parent OKR key field inside KR records

  const BASE_QUERY_ENDPOINT = "https://leaf.va.gov/platform/projects/api/form/query/";

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const wrap        = document.getElementById("krWrap39");
  const section     = document.getElementById("krSection39");
  const noOkrEl     = document.getElementById("krNoOkr39");
  const searchEl    = document.getElementById("krSearch39");
  const listEl      = document.getElementById("krList39");
  const summaryValEl = document.getElementById("krSummaryVal39");
  const msgEl       = document.getElementById("krMsg39");
  const clearBtn    = document.getElementById("krClear39");
  const toggleBtn   = document.getElementById("krToggle39");
  const panelEl     = document.getElementById("krPanel39");
  const closeBtn    = document.getElementById("krClose39");

  if (!wrap || !section || !noOkrEl || !searchEl || !listEl || !summaryValEl || !msgEl || !clearBtn || !toggleBtn || !panelEl || !closeBtn) return;

  // ── Bind to the real platform fields ──────────────────────────────────────
  function findField(indicatorId) {
    const within = wrap.closest(".response") || wrap.parentElement;
    let el = within ? within.querySelector('[name="' + indicatorId + '"]') : null;
    if (!el) el = document.querySelector('[name="' + indicatorId + '"]');
    return el;
  }

  const krFieldEl  = findField(TARGET_IND);   // ind 39 – write KR name here
  const okrFieldEl = findField(OKR_IND);      // ind 30 – read selected OKR key

  // ── Helpers ────────────────────────────────────────────────────────────────
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

  function writeKrValue(val) {
    if (!krFieldEl) return;
    krFieldEl.value = String(val || "");
    krFieldEl.dispatchEvent(new Event("input",  { bubbles: true }));
    krFieldEl.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function readKrValue() {
    return krFieldEl ? String(krFieldEl.value || "").trim() : "";
  }

  function readOkrValue() {
    return okrFieldEl ? String(okrFieldEl.value || "").trim() : "";
  }

  // ── JSON / row helpers (same pattern as OKRkey_htmlEdit.js) ───────────────
  function coerceRows(json) {
    if (Array.isArray(json)) return json;
    if (json && typeof json === "object") {
      if (Array.isArray(json.data))    return json.data;
      if (Array.isArray(json.records)) return json.records;
      if (Array.isArray(json.results)) return json.results;
      const keys = Object.keys(json);
      if (keys.length && keys.every(k => /^\d+$/.test(k))) {
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
    const v = row.s1["id" + String(indicatorId)];
    if (v == null) return "";
    return String(v).trim();
  }

  // ── KR data ────────────────────────────────────────────────────────────────
  let allKrs = [];   // { name, parentOkrKey } – full list fetched once
  let filteredKrs = []; // subset matching the currently selected OKR

  // ── Build query URL to fetch all KR records ────────────────────────────────
  function buildKrQueryUrl() {
    const q = {
      terms: [{ id: "deleted", operator: "=", match: 0, gate: "AND" }],
      joins: [],
      sort: {},
      getData: [String(KR_NAME_IND), String(KR_PARENT_IND)]
    };
    return BASE_QUERY_ENDPOINT + "?q=" + encodeURIComponent(JSON.stringify(q)) + "&x-filterData=recordID,";
  }

  // ── Fetch all KRs once on load ─────────────────────────────────────────────
  async function loadAllKrs() {
    const url = buildKrQueryUrl();
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) throw new Error("KR list fetch failed. HTTP " + r.status);
    const json = await r.json();
    const rows = coerceRows(json);

    allKrs = rows
      .map(row => ({
        name:         extractFromS1(row, KR_NAME_IND),
        parentOkrKey: extractFromS1(row, KR_PARENT_IND)
      }))
      .filter(kr => kr.name); // must have a name
  }

  // ── Filter KRs by the currently selected OKR key ──────────────────────────
  function filterKrsByOkr(okrKey) {
    if (!okrKey) { filteredKrs = []; return; }
    filteredKrs = allKrs.filter(kr => String(kr.parentOkrKey) === String(okrKey));
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function matchesSearch(kr, q) {
    if (!q) return true;
    return String(kr.name).toLowerCase().includes(q);
  }

  function renderSummary() {
    const val = readKrValue();
    if (!val) {
      summaryValEl.textContent = "None selected";
      return;
    }
    summaryValEl.textContent = val;
  }

  function renderList() {
    const q = String(searchEl.value || "").trim().toLowerCase();
    const visible = filteredKrs
      .filter(kr => matchesSearch(kr, q))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    if (visible.length === 0) {
      listEl.innerHTML = '<div style="opacity:0.75;">No Key Results match your search</div>';
      return;
    }

    const current = readKrValue();

    listEl.innerHTML = visible.map((kr, idx) => {
      const checked = String(current) === String(kr.name);
      return `
        <label style="display:flex; gap:0.5rem; align-items:flex-start; padding:0.3rem 0; border-bottom:1px solid #f0f0f0; cursor:pointer;">
          <input type="radio" name="krRadio39" class="krRadio39" data-name="${safe(kr.name)}" ${checked ? "checked" : ""} style="margin-top:0.2rem;">
          <div style="min-width:0;">
            <div style="font-weight:600; word-break:break-word;">${safe(kr.name)}</div>
          </div>
        </label>
      `;
    }).join("");

    listEl.querySelectorAll(".krRadio39").forEach(r => {
      r.addEventListener("change", () => {
        const name = String(r.getAttribute("data-name") || "");
        writeKrValue(name);
        renderSummary();
        setExpanded(false);
      });
    });
  }

  function renderAll() {
    if (panelEl.style.display !== "none") renderList();
    renderSummary();
  }

  function setExpanded(isOpen) {
    panelEl.style.display = isOpen ? "" : "none";
    toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }

  // ── Show / hide KR section based on whether an OKR is selected ────────────
  function updateVisibility() {
    const okrKey = readOkrValue();
    if (okrKey) {
      section.style.display  = "";
      noOkrEl.style.display  = "none";
    } else {
      section.style.display  = "none";
      noOkrEl.style.display  = "";
    }
  }

  // ── React to OKR field changes (conditional logic) ─────────────────────────
  function onOkrChanged() {
    const okrKey = readOkrValue();
    updateVisibility();

    if (!okrKey) {
      // OKR was cleared — also clear any selected KR
      writeKrValue("");
      filteredKrs = [];
      renderAll();
      setMsg("", "");
      return;
    }

    // OKR selected — filter and render KRs
    filterKrsByOkr(okrKey);

    if (filteredKrs.length === 0) {
      setMsg("No Key Results found for this OKR.", "");
    } else {
      setMsg("Loaded " + filteredKrs.length + " Key Result(s) for this OKR.", "ok");
    }

    // If the currently stored KR no longer belongs to this OKR, clear it
    const currentKr = readKrValue();
    if (currentKr && !filteredKrs.find(kr => String(kr.name) === String(currentKr))) {
      writeKrValue("");
    }

    renderAll();
  }

  // ── Watch the OKR field for changes ───────────────────────────────────────
  function watchOkrField() {
    if (!okrFieldEl) return;
    okrFieldEl.addEventListener("input",  onOkrChanged);
    okrFieldEl.addEventListener("change", onOkrChanged);
  }

  // ── Clear button ──────────────────────────────────────────────────────────
  clearBtn.addEventListener("click", () => {
    writeKrValue("");
    searchEl.value = "";
    renderAll();
  });

  toggleBtn.addEventListener("click", () => {
    setExpanded(true);
    searchEl.focus();
    renderList();
  });

  closeBtn.addEventListener("click", () => {
    setExpanded(false);
  });

  searchEl.addEventListener("input", renderList);

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    if (!krFieldEl) {
      setMsg("Could not find the real field for indicator 39. The selector must bind to the platform input to persist.", "error");
      return;
    }

    try {
      await loadAllKrs();
    } catch (err) {
      setMsg(String(err), "error");
      return;
    }

    watchOkrField();

    // Run once on load in case ind 30 already has a value (e.g. edit mode)
    onOkrChanged();
  }

  init();
})();
</script>
