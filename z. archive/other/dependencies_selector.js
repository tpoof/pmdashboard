<div id="depWrap17" style="max-width: 820px;">
  <div style="display:flex; gap:0.75rem; align-items:flex-end; flex-wrap:wrap;">
    <div style="flex:1; min-width: 260px;">
      <input
        id="depSearch17"
        type="text"
        autocomplete="off"
        placeholder="Search tasks by ID or title"
        style="width:100%; padding:0.45rem 0.55rem; border:1px solid #c9c9c9; border-radius:0.5rem;"
      >
    </div>
 
    <div style="display:flex; gap:0.5rem; align-items:center;">
      <button type="button" id="depSave17" class="buttonNorm" style="white-space:nowrap;">Save</button>
      <button type="button" id="depClear17" class="buttonNorm" style="white-space:nowrap;">Clear</button>
    </div>
  </div>
 
  <div id="depMsg17" style="margin-top:0.5rem; font-size:0.9rem;"></div>
 
  <div style="margin-top:0.6rem; display:grid; grid-template-columns: 1fr 260px; gap:0.75rem;">
    <div>
      <div style="font-weight:600; margin-bottom:0.35rem;">Available tasks</div>
      <div
        id="depList17"
        style="border:1px solid #d9d9d9; border-radius:0.6rem; padding:0.6rem; min-height: 150px; max-height: 250px; overflow:auto; background:#fff;"
      ></div>
    </div>
 
    <div>
      <div style="font-weight:600; margin-bottom:0.35rem;">Selected</div>
      <div
        id="depSelected17"
        style="border:1px solid #d9d9d9; border-radius:0.6rem; padding:0.6rem; min-height: 150px; max-height: 250px; overflow:auto; background:#fff;"
      ></div>
    </div>
  </div>
</div>
 
<style>
.response.blockIndicator_17 [name="17"] {
  display: none !important; 
  }
 
.response.blockIndicator_17 textarea[name="17"],
.response.blockIndicator_17 input[name="17"],
.response.blockIndicator_17 select[name="17"] {
  display: none !important;
  }
</style>
 
 
<script>
(function () {
  const DEP_IND = 17;          // dependencies field
  const TASK_TITLE_IND = 9;   // task title
  const TASK_KEY_IND = 8;     // project key on task form (used only for exclusivity)
  const BASE_QUERY_ENDPOINT = https://leaf.va.gov/platform/projects/api/form/query/;
 
  // recordID for the current task
  const CURRENT_RECORD_ID =
    (typeof window.recordID !== "undefined" && window.recordID) ? String(window.recordID) : "";
 
  const wrap = document.getElementById("depWrap17");
  const searchEl = document.getElementById("depSearch17");
  const listEl = document.getElementById("depList17");
  const selectedEl = document.getElementById("depSelected17");
  const msgEl = document.getElementById("depMsg17");
  const saveBtn = document.getElementById("depSave17");
  const clearBtn = document.getElementById("depClear17");
  if (!wrap || !searchEl || !listEl || !selectedEl || !msgEl || !saveBtn || !clearBtn) return;
 
  function setMsg(text, kind) {
    msgEl.textContent = text || "";
    msgEl.style.color = kind === "error" ? "#b50909" : (kind === "ok" ? "#008423" : "");
  }
 
  // IMPORTANT: bind to the REAL LEAF field for indicator 17
  function findLeafBoundField() {
    // Most reliable: within this indicator block
    const within = wrap.closest(".response") || wrap.parentElement;
    let el = within ? within.querySelector('[name="' + DEP_IND + '"]') : null;
 
    // Fallbacks
    if (!el) el = document.querySelector('[name="' + DEP_IND + '"]');
    return el;
  }
 
  const leafFieldEl = findLeafBoundField();
 
  function safe(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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
 
  function getRecordID(row) {
    return String(row.recordID || row.recordId || row.id || "").trim();
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
 
  function buildTasksQueryUrl() {
    const q = {
      terms: [
        { id: "stepID", operator: "!=", match: "resolved", gate: "AND" },
        { id: "deleted", operator: "=", match: 0, gate: "AND" }
      ],
      joins: [],
      sort: {},
      getData: [String(TASK_TITLE_IND), String(TASK_KEY_IND)]
    };
    return BASE_QUERY_ENDPOINT + "?q=" + encodeURIComponent(JSON.stringify(q)) + "&x-filterData=recordID,";
  }
 
  // Store dependencies as JSON so it survives a single-line field.
  // Format: [{id:"179", title:"..."}, ...]
  function readStoredDeps() {
    const raw = leafFieldEl ? String(leafFieldEl.value || "").trim() : "";
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(x => ({
          id: String(x && x.id ? x.id : "").trim(),
          title: String(x && x.title ? x.title : "").trim()
        }))
        .filter(x => x.id);
    } catch (e) {
      // Backward compatibility: allow newline "id | title"
      return raw.split(/\r?\n/)
        .map(l => String(l || "").trim())
        .filter(Boolean)
        .map(line => {
          const parts = line.split("|");
          const id = String(parts[0] || "").trim();
          const title = String(parts.slice(1).join("|") || "").trim();
          return id ? ({ id, title }) : null;
        })
        .filter(Boolean);
    }
  }
 
  function writeStoredDeps(depArray) {
    if (!leafFieldEl) return;
    const jsonText = JSON.stringify(depArray);
    leafFieldEl.value = jsonText;
 
    // Trigger LEAF change detection so the main Save changes includes 17
    leafFieldEl.dispatchEvent(new Event("input", { bubbles: true }));
    leafFieldEl.dispatchEvent(new Event("change", { bubbles: true }));
  }
 
  function getCSRFToken() {
    if (typeof window.CSRFToken !== "undefined" && window.CSRFToken) return String(window.CSRFToken);
    const el = document.querySelector('input[name="CSRFToken"]');
    return el && el.value ? String(el.value) : "";
  }
 
  function getSaveUrl(recordID) {
    return location.origin + "/platform/projects/api/form/" + encodeURIComponent(String(recordID));
  }
 
  async function saveToLeaf(recordID, jsonText) {
    const token = getCSRFToken();
    if (!token) throw new Error("CSRFToken not found on page.");
 
    const body =
      encodeURIComponent(String(DEP_IND)) + "=" + encodeURIComponent(String(jsonText)) +
      "&recordID=" + encodeURIComponent(String(recordID)) +
      "&series=1" +
      "&CSRFToken=" + encodeURIComponent(token);
 
    const r = await fetch(getSaveUrl(recordID), {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-requested-with": "XMLHttpRequest"
      },
      body
    });
 
    if (!r.ok) throw new Error("Save failed. HTTP " + r.status);
    return r.text();
  }
 
  let allTasks = [];
  let taskMap = new Map();   // id -> {id,title}
  let selected = new Set();  // ids
 
  function matchesSearch(task, q) {
    if (!q) return true;
    const hay = (String(task.id) + " " + String(task.title)).toLowerCase();
    return hay.includes(q);
  }
 
  function getSelectedArray() {
    return Array.from(selected)
      .map(id => taskMap.get(String(id)))
      .filter(Boolean)
      .sort((a, b) => Number(a.id) - Number(b.id));
  }
 
  function persistToLeafFieldOnly() {
    const depArray = getSelectedArray().map(t => ({ id: String(t.id), title: String(t.title || "") }));
    writeStoredDeps(depArray);
  }
 
  function renderSelected() {
    const items = getSelectedArray();
    if (items.length === 0) {
      selectedEl.innerHTML = '<div style="opacity:0.75;">No dependencies selected</div>';
      return;
    }
 
    selectedEl.innerHTML = items.map(t => {
      const href = "index.php?a=printview&recordID=" + encodeURIComponent(String(t.id));
      return `
        <div style="display:flex; justify-content:space-between; gap:0.5rem; padding:0.35rem 0; border-bottom:1px solid #f0f0f0;">
          <div style="min-width:0;">
            <div style="font-weight:600;">
              <a href="${safe(href)}" target="_blank" rel="noopener">${safe(t.id)}</a>
            </div>
            <div style="opacity:0.9; word-break:break-word;">
              <a href="${safe(href)}" target="_blank" rel="noopener">${safe(t.title || "(No title)")}</a>
            </div>
          </div>
          <div style="display:flex; gap:0.35rem; align-items:flex-start;">
            <a class="buttonNorm" href="${safe(href)}" target="_blank" rel="noopener"
               style="text-decoration:none; padding:0.2rem 0.45rem; white-space:nowrap;">Open</a>
            <button type="button" class="buttonNorm depRemoveBtn" data-id="${safe(t.id)}"
              style="padding:0.2rem 0.45rem; white-space:nowrap;">Remove</button>
          </div>
        </div>
      `;
    }).join("");
 
    selectedEl.querySelectorAll(".depRemoveBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        selected.delete(String(btn.getAttribute("data-id")));
        persistToLeafFieldOnly();
        renderAll();
      });
    });
  }
 
  function renderAvailable() {
    const q = String(searchEl.value || "").trim().toLowerCase();
 
    const visible = allTasks
      .filter(t => !CURRENT_RECORD_ID || String(t.id) !== String(CURRENT_RECORD_ID)) // keep: no self-dependency
      .filter(t => matchesSearch(t, q))
      .sort((a, b) => Number(a.id) - Number(b.id));
 
    if (visible.length === 0) {
      listEl.innerHTML = '<div style="opacity:0.75;">No tasks match your search</div>';
      return;
    }
 
    // IMPORTANT CHANGE: show ALL available tasks, rely on scroll (no slice(0,5))
    listEl.innerHTML = visible.map(t => {
      const checked = selected.has(String(t.id)) ? "checked" : "";
      return `
        <label style="display:flex; gap:0.5rem; align-items:flex-start; padding:0.3rem 0; border-bottom:1px solid #f0f0f0; cursor:pointer;">
          <input type="checkbox" class="depChk" data-id="${safe(t.id)}" ${checked} style="margin-top:0.2rem;">
          <div style="min-width:0;">
            <div style="font-weight:600;">${safe(t.id)}</div>
            <div style="opacity:0.9; word-break:break-word;">${safe(t.title || "(No title)")}</div>
          </div>
        </label>
      `;
    }).join("");
 
    listEl.querySelectorAll(".depChk").forEach(chk => {
      chk.addEventListener("change", () => {
        const id = String(chk.getAttribute("data-id"));
        if (chk.checked) selected.add(id);
        else selected.delete(id);
        persistToLeafFieldOnly();
        renderSelected();
      });
    });
  }
 
  function renderAll() {
    renderAvailable();
    renderSelected();
  }
 
  async function loadTasks() {
    if (!leafFieldEl) {
      setMsg("Could not find the real LEAF field for indicator 17. This must bind to the platform input to persist.", "error");
      return;
    }
 
    setMsg("Loading tasks...", "");
    const url = buildTasksQueryUrl();
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) throw new Error("Task list fetch failed. HTTP " + r.status);
    const json = await r.json();
    const rows = coerceRows(json);
 
    const tasks = rows
      .filter(row => hasAnyS1Value(row, [TASK_TITLE_IND, TASK_KEY_IND]))
      .map(row => {
        const id = getRecordID(row);
        const title = extractFromS1(row, TASK_TITLE_IND);
        return { id, title };
      })
      // IMPORTANT CHANGE: do NOT require title, keep tasks even if title blank
      .filter(t => t.id);
 
    allTasks = tasks;
    taskMap = new Map(tasks.map(t => [String(t.id), t]));
 
    // hydrate selection from the REAL field value
    const stored = readStoredDeps();
    selected = new Set(stored.map(x => String(x.id)).filter(id => taskMap.has(String(id))));
 
    // normalize field to JSON format immediately
    persistToLeafFieldOnly();
 
    renderAll();
    setMsg("Loaded " + tasks.length + " tasks.", "ok");
  }
 
  saveBtn.addEventListener("click", async () => {
    if (!leafFieldEl) {
      setMsg("Cannot save: LEAF-bound field not found.", "error");
      return;
    }
    if (!CURRENT_RECORD_ID) {
      setMsg("No recordID found yet. Save or submit the task first, then set dependencies.", "error");
      return;
    }
 
    try {
      saveBtn.disabled = true;
      setMsg("Saving dependencies...", "");
 
      // ensure bound field contains latest JSON
      persistToLeafFieldOnly();
 
      // also persist immediately to LEAF endpoint
      const jsonText = String(leafFieldEl.value || "");
      await saveToLeaf(CURRENT_RECORD_ID, jsonText);
 
      setMsg("Saved.", "ok");
    } catch (e) {
      setMsg(String(e), "error");
    } finally {
      saveBtn.disabled = false;
    }
  });
 
  clearBtn.addEventListener("click", () => {
    selected.clear();
    persistToLeafFieldOnly();
    renderAll();
  });
 
  searchEl.addEventListener("input", renderAvailable);
 
  loadTasks().catch(err => setMsg(String(err), "error"));
})();
 
  //auto-refresh
  (function () {
    "use strict";
 
    if (window.__leafAutoReloadAfterSubmitInstalled) return;
    window.__leafAutoReloadAfterSubmitInstalled = true;
 
    var RELOAD_DELAY_MS = 800;
 
    function looksLikeSubmitButton(el) {
      if (!el) return false;
      var tag = (el.tagName || "").toLowerCase();
      if (tag !== "button" && !(tag === "input" && (el.type === "button" || el.type === "submit"))) return false;
 
      var label = (el.innerText || el.value || "").trim().toLowerCase();
      return label.includes("submit") || label.includes("save");
    }
 
    function hasObviousErrorUI() {
      // Best-effort selectors for common error patterns
      return Boolean(
        document.querySelector(".alert-danger, .alert-error, .error, .has-error, .text-danger") ||
        Array.from(document.querySelectorAll(".alert, .toast, .notification, .message")).some(function (n) {
          var t = (n.textContent || "").toLowerCase();
          return t.includes("error") || t.includes("failed") || t.includes("invalid");
        })
      );
    }
 
    function scheduleReload() {
      var startUrl = String(window.location.href);
 
      setTimeout(function () {
        try {
          // If navigation already happened, do nothing
          if (String(window.location.href) !== startUrl) return;
 
          // If an error UI is present, do not reload
          if (hasObviousErrorUI()) return;
 
          window.location.reload();
        } catch (e) {}
      }, RELOAD_DELAY_MS);
    }
 
    // Capture very early, before app code runs
    document.addEventListener(
      "pointerdown",
      function (e) {
        var btn = e.target && e.target.closest ? e.target.closest("button, input[type='button'], input[type='submit']") : null;
        if (looksLikeSubmitButton(btn)) scheduleReload();
      },
      true
    );
 
    document.addEventListener(
      "click",
      function (e) {
        var btn = e.target && e.target.closest ? e.target.closest("button, input[type='button'], input[type='submit']") : null;
        if (looksLikeSubmitButton(btn)) scheduleReload();
      },
      true
    );
  })();
 
</script>