<div id="pkWrap8" style="max-width: 820px;">
  <div style="display:flex; gap:0.75rem; align-items:flex-end; flex-wrap:wrap;">
    <div style="flex:1; min-width: 260px;">
      <input id="pkSearch8" type="text" autocomplete="off" placeholder="Search project key or name"
        style="width:100%; padding:0.45rem 0.55rem; border:1px solid #c9c9c9; border-radius:0.5rem;">
    </div>
 
    <div style="display:flex; gap:0.5rem; align-items:center;">
      <button type="button" id="pkClear8" class="buttonNorm" style="white-space:nowrap;">Clear</button>
    </div>
  </div>
 
  <div id="pkMsg8" style="margin-top:0.5rem; font-size:0.9rem;"></div>
 
  <div style="margin-top:0.6rem;">
    <div style="font-weight:600; margin-bottom:0.35rem;">Available projects</div>
    <div id="pkList8"
      style="border:1px solid #d9d9d9; border-radius:0.6rem; padding:0.6rem; min-height: 140px; max-height: 320px; overflow:auto; background:#fff;">
    </div>
  </div>
 
  <div style="margin-top:0.75rem;">
    <div style="font-weight:600; margin-bottom:0.35rem;">Selected</div>
    <div id="pkSelected8"
      style="border:1px solid #d9d9d9; border-radius:0.6rem; padding:0.6rem; background:#fff;">
    </div>
  </div>
</div>
 
<style>
  /* Hide only the real LEAF-bound field for indicator 8 (keeps custom UI visible) */
  .response.blockIndicator_8 [name="8"] { display:none !important; }
  .response.blockIndicator_8 textarea[name="8"],
  .response.blockIndicator_8 input[name="8"],
  .response.blockIndicator_8 select[name="8"] { display:none !important; }
</style>
 
<script>
(function () {
  // Task field being programmed (this is where we store the selected project key)
  const TARGET_IND = 8;
 
  // Project form fields
  const PROJECT_KEY_IND = 2;
  const PROJECT_NAME_IND = 3;
 
  // Endpoints
  const BASE_QUERY_ENDPOINT = https://leaf.va.gov/platform/projects/api/form/query/;
 
  const wrap = document.getElementById("pkWrap8");
  const searchEl = document.getElementById("pkSearch8");
  const listEl = document.getElementById("pkList8");
  const selectedEl = document.getElementById("pkSelected8");
  const msgEl = document.getElementById("pkMsg8");
  const clearBtn = document.getElementById("pkClear8");
  if (!wrap || !searchEl || !listEl || !selectedEl || !msgEl || !clearBtn) return;
 
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
 
  // Bind to the real LEAF field for this indicator (8)
  function findLeafBoundField() {
    const within = wrap.closest(".response") || wrap.parentElement;
    let el = within ? within.querySelector('[name="' + TARGET_IND + '"]') : null;
    if (!el) el = document.querySelector('[name="' + TARGET_IND + '"]');
    return el;
  }
  const leafFieldEl = findLeafBoundField();
 
  function writeValue(val) {
    if (!leafFieldEl) return;
    leafFieldEl.value = String(val || "");
    leafFieldEl.dispatchEvent(new Event("input", { bubbles: true }));
    leafFieldEl.dispatchEvent(new Event("change", { bubbles: true }));
  }
 
  function readValue() {
    return leafFieldEl ? String(leafFieldEl.value || "").trim() : "";
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
 
  function buildProjectsQueryUrl() {
    const q = {
      terms: [{ id: "deleted", operator: "=", match: 0, gate: "AND" }],
      joins: [],
      sort: {},
      getData: [String(PROJECT_KEY_IND), String(PROJECT_NAME_IND)]
    };
    return BASE_QUERY_ENDPOINT + "?q=" + encodeURIComponent(JSON.stringify(q)) + "&x-filterData=recordID,";
  }
 
  let projects = []; // { key, name }
 
  function matchesSearch(p, q) {
    if (!q) return true;
    const hay = (String(p.key) + " " + String(p.name)).toLowerCase();
    return hay.includes(q);
  }
 
  function renderSelected() {
    const val = readValue();
    if (!val) {
      selectedEl.innerHTML = '<div style="opacity:0.75;">No project selected</div>';
      return;
    }
    const found = projects.find(p => String(p.key) === String(val));
    const label = found
      ? (found.key + (found.name ? (" | " + found.name) : ""))
      : val;
 
    selectedEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; gap:0.75rem; align-items:flex-start;">
        <div style="min-width:0;">
          <div style="font-weight:700;">${safe(label)}</div>
          <div style="opacity:0.85; font-size:0.9rem;">Stored value: ${safe(val)}</div>
        </div>
        <button type="button" class="buttonNorm" id="pkClearSelected8" style="white-space:nowrap;">Remove</button>
      </div>
    `;
 
    const btn = document.getElementById("pkClearSelected8");
    if (btn) btn.addEventListener("click", () => {
      writeValue("");
      renderAll();
    });
  }
 
  function renderList() {
    const q = String(searchEl.value || "").trim().toLowerCase();
    const visible = projects
      .filter(p => matchesSearch(p, q))
      .sort((a, b) => String(a.key).localeCompare(String(b.key), undefined, { numeric: true, sensitivity: "base" }));
 
    if (visible.length === 0) {
      listEl.innerHTML = '<div style="opacity:0.75;">No projects match your search</div>';
      return;
    }
 
    const current = readValue();
 
    listEl.innerHTML = visible.map(p => {
      const label = p.key + (p.name ? (" | " + p.name) : "");
      const checked = String(current) === String(p.key);
      return `
        <label style="display:flex; gap:0.5rem; align-items:flex-start; padding:0.3rem 0; border-bottom:1px solid #f0f0f0; cursor:pointer;">
          <input type="radio" name="pkRadio8" class="pkRadio8" data-key="${safe(p.key)}" ${checked ? "checked" : ""} style="margin-top:0.2rem;">
          <div style="min-width:0;">
            <div style="font-weight:600;">${safe(p.key)}</div>
            <div style="opacity:0.9; word-break:break-word;">${safe(p.name || "")}</div>
          </div>
        </label>
      `;
    }).join("");
 
    listEl.querySelectorAll(".pkRadio8").forEach(r => {
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
 
  async function loadProjects() {
    if (!leafFieldEl) {
      setMsg("Could not find the real LEAF field for this indicator. The custom selector must bind to the platform input to persist.", "error");
      return;
    }
 
    setMsg("Loading projects...", "");
    const url = buildProjectsQueryUrl();
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) throw new Error("Project list fetch failed. HTTP " + r.status);
    const json = await r.json();
    const rows = coerceRows(json);
 
    projects = rows
      .filter(row => hasAnyS1Value(row, [PROJECT_KEY_IND, PROJECT_NAME_IND]))
      .map(row => ({
        key: extractFromS1(row, PROJECT_KEY_IND),
        name: extractFromS1(row, PROJECT_NAME_IND)
      }))
      .filter(p => p.key);
 
    setMsg("Loaded " + projects.length + " projects.", "ok");
    renderAll();
  }
 
  clearBtn.addEventListener("click", () => {
    writeValue("");
    searchEl.value = "";
    renderAll();
  });
 
  searchEl.addEventListener("input", renderList);
 
  loadProjects().catch(err => setMsg(String(err), "error"));
})();
</script>