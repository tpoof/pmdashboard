<script>
(function () {
  "use strict";

  // ── Indicator IDs (this task form) ─────────────────────────────────────────
  var PROJECT_KEY_SEL = '[name="8"]';   // Project key selected by user
  var OKR_SEL         = '[name="30"]';  // OKR to auto-fill
  var KR_SEL          = '[name="39"]';  // Key Result to auto-fill

  // ── Project record indicator IDs ───────────────────────────────────────────
  var PROJ_KEY_IND = 2;   // Project key field inside project records
  var PROJ_OKR_IND = 29;  // OKR value stored on the project record
  var PROJ_KR_IND  = 37;  // KR value stored on the project record

  var BASE_QUERY_ENDPOINT = "https://leaf.va.gov/platform/projects/api/form/query/";

  // ── Notify platform of value change ───────────────────────────────────────
  function notify(el) {
    if (!el) return;
    el.dispatchEvent(new Event("input",  { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // ── Write a value into a field and notify ─────────────────────────────────
  function writeField(sel, val) {
    var el = document.querySelector(sel);
    if (!el) return;
    el.value = String(val || "");
    notify(el);
  }

  // ── Read a field value ────────────────────────────────────────────────────
  function readField(sel) {
    var el = document.querySelector(sel);
    return el ? String(el.value || "").trim() : "";
  }

  // ── JSON row helpers ──────────────────────────────────────────────────────
  function coerceRows(json) {
    if (Array.isArray(json)) return json;
    if (json && typeof json === "object") {
      if (Array.isArray(json.data))    return json.data;
      if (Array.isArray(json.records)) return json.records;
      if (Array.isArray(json.results)) return json.results;
      var keys = Object.keys(json);
      if (keys.length && keys.every(function (k) { return /^\d+$/.test(k); })) {
        return keys.map(function (k) {
          var row = json[k] || {};
          if (!row.recordID && !row.recordId && !row.id) row.recordID = k;
          return row;
        });
      }
    }
    return [];
  }

  function extractFromS1(row, indicatorId) {
    if (!row || !row.s1) return "";
    var v = row.s1["id" + String(indicatorId)];
    if (v == null) return "";
    return String(v).trim();
  }

  // ── Fetch project record matching the selected project key ────────────────
  function buildProjectQueryUrl(projectKey) {
    var q = {
      terms: [
        { id: "deleted",          operator: "=",  match: 0,          gate: "AND" },
        { id: String(PROJ_KEY_IND), operator: "=",  match: projectKey, gate: "AND" }
      ],
      joins: [],
      sort: {},
      getData: [String(PROJ_KEY_IND), String(PROJ_OKR_IND), String(PROJ_KR_IND)]
    };
    return BASE_QUERY_ENDPOINT + "?q=" + encodeURIComponent(JSON.stringify(q)) + "&x-filterData=recordID,";
  }

  function fetchProjectData(projectKey, callback) {
    var url = buildProjectQueryUrl(projectKey);
    fetch(url, { credentials: "include" })
      .then(function (r) {
        if (!r.ok) throw new Error("Project fetch failed. HTTP " + r.status);
        return r.json();
      })
      .then(function (json) {
        var rows = coerceRows(json);
        // Find the row whose project key matches
        var match = null;
        for (var i = 0; i < rows.length; i++) {
          var key = extractFromS1(rows[i], PROJ_KEY_IND);
          if (String(key) === String(projectKey)) { match = rows[i]; break; }
        }
        callback(null, match);
      })
      .catch(function (err) { callback(err, null); });
  }

  // ── Main fill function ────────────────────────────────────────────────────
  function fillFromProject() {
    var projectKey = readField(PROJECT_KEY_SEL);
    if (!projectKey) {
      // No project selected — clear both fields
      writeField(OKR_SEL, "");
      writeField(KR_SEL,  "");
      return;
    }

    fetchProjectData(projectKey, function (err, row) {
      if (err || !row) {
        // Could not find project — leave fields as-is
        return;
      }
      var okrVal = extractFromS1(row, PROJ_OKR_IND);
      var krVal  = extractFromS1(row, PROJ_KR_IND);
      writeField(OKR_SEL, okrVal);
      writeField(KR_SEL,  krVal);
    });
  }

  // ── Watch the project key field for changes ───────────────────────────────
  function hookProjectField() {
    var el = document.querySelector(PROJECT_KEY_SEL);
    if (!el) return;
    el.addEventListener("change", fillFromProject, true);
    el.addEventListener("blur",   fillFromProject, true);
  }

  // ── Detect form submit to re-fill before save (mirrors working snippet) ───
  function isSubmitEndpoint(url) {
    try {
      var u = new URL(url, window.location.origin);
      return /\/api\/form\/\d+\/submit\/?$/.test(u.pathname);
    } catch (e) {
      return /\/api\/form\/\d+\/submit\/?/.test(String(url || ""));
    }
  }

  function hookSubmitClicks() {
    document.addEventListener("pointerdown", fillFromProject, true);
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (!t) return;
      if (t.matches('button, input[type="button"], input[type="submit"]')) {
        var label = (t.innerText || t.value || "").toLowerCase();
        if (label.includes("submit") || label.includes("save")) {
          fillFromProject();
        }
      }
    }, true);
  }

  function hookFetchAndXHR() {
    if (window.fetch && !window.fetch.__autofillOkrKrHooked) {
      var origFetch = window.fetch;
      window.fetch = function (input, init) {
        var url = (typeof input === "string") ? input : (input && input.url);
        try { if (url && isSubmitEndpoint(url)) fillFromProject(); } catch (e) {}
        return origFetch.apply(this, arguments).then(function (resp) {
          try {
            if (url && isSubmitEndpoint(url) && resp && resp.ok) {
              setTimeout(function () { try { window.location.reload(); } catch (e) {} }, 250);
            }
          } catch (e) {}
          return resp;
        });
      };
      window.fetch.__autofillOkrKrHooked = true;
    }

    if (window.XMLHttpRequest && !window.XMLHttpRequest.__autofillOkrKrHooked) {
      var OriginalXHR = window.XMLHttpRequest;
      function WrappedXHR() {
        var xhr = new OriginalXHR();
        var origOpen = xhr.open;
        var origSend = xhr.send;
        xhr.open = function (method, url) {
          xhr.__leafUrl = url;
          return origOpen.apply(xhr, arguments);
        };
        xhr.send = function (body) {
          try {
            if (xhr.__leafUrl && isSubmitEndpoint(xhr.__leafUrl)) {
              fillFromProject();
              xhr.addEventListener("load", function () {
                try {
                  if (xhr.status >= 200 && xhr.status < 300) {
                    setTimeout(function () { try { window.location.reload(); } catch (e) {} }, 250);
                  }
                } catch (e) {}
              });
            }
          } catch (e) {}
          return origSend.apply(xhr, arguments);
        };
        return xhr;
      }
      WrappedXHR.prototype = OriginalXHR.prototype;
      window.XMLHttpRequest = WrappedXHR;
      window.XMLHttpRequest.__autofillOkrKrHooked = true;
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    hookProjectField();
    hookSubmitClicks();
    hookFetchAndXHR();
    fillFromProject(); // Run once on load for edit mode
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
</script>
