<script>
(function () {
  "use strict";

  // ── Indicator IDs (this task form) ─────────────────────────────────────────
  var PROJECT_KEY_IND = 8;   // Project key selected by user
  var OKR_IND         = 30;  // OKR to auto-fill
  var KR_IND          = 39;  // Key Result to auto-fill

  // ── Project record indicator IDs ───────────────────────────────────────────
  var PROJ_KEY_IND = 2;   // Project key field inside project records
  var PROJ_OKR_IND = 29;  // OKR value stored on the project record
  var PROJ_KR_IND  = 37;  // KR value stored on the project record

  var BASE_QUERY_ENDPOINT = "https://leaf.va.gov/platform/projects/api/form/query/";
  var POLL_INTERVAL = 500;

  var lastSeenProjectKey = null;
  var isFetching = false;

  // ── Resolve the correct document by anchoring off pkWrap30 ────────────────
  // pkWrap30 is injected by OKRkey_htmlEdit_30.js into the same document as
  // all the form fields. We use it to get the ownerDocument reliably since
  // document.currentScript is null for platform-injected scripts.
  function getOwnerDoc() {
    var anchor = document.getElementById("pkWrap30");
    if (anchor && anchor.ownerDocument) return anchor.ownerDocument;
    // Fallback: search all same-origin frames for the anchor
    var frames = window.frames;
    for (var i = 0; i < frames.length; i++) {
      try {
        var d = frames[i].document;
        if (d && d.getElementById("pkWrap30")) return d;
      } catch (e) {}
    }
    return document;
  }

  function findField(indicatorId) {
    var d = getOwnerDoc();
    return d.querySelector('[name="' + indicatorId + '"]') || null;
  }

  // ── Notify platform of value change ───────────────────────────────────────
  function notify(el) {
    if (!el) return;
    el.dispatchEvent(new Event("input",  { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function writeField(indicatorId, val) {
    var el = findField(indicatorId);
    if (!el) return;
    el.value = String(val || "");
    notify(el);
  }

  function readField(indicatorId) {
    var el = findField(indicatorId);
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
        { id: "deleted",            operator: "=", match: 0,          gate: "AND" },
        { id: String(PROJ_KEY_IND), operator: "=", match: projectKey, gate: "AND" }
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
  function fillFromProject(projectKey) {
    if (!projectKey) {
      writeField(OKR_IND, "");
      writeField(KR_IND,  "");
      return;
    }

    if (isFetching) return;
    isFetching = true;

    fetchProjectData(projectKey, function (err, row) {
      isFetching = false;
      if (err || !row) return;
      var okrVal = extractFromS1(row, PROJ_OKR_IND);
      var krVal  = extractFromS1(row, PROJ_KR_IND);
      writeField(OKR_IND, okrVal);
      writeField(KR_IND,  krVal);
    });
  }

  // ── Poll ind 8 for changes ────────────────────────────────────────────────
  function poll() {
    var current = readField(PROJECT_KEY_IND);
    if (current !== lastSeenProjectKey) {
      lastSeenProjectKey = current;
      fillFromProject(current);
    }
  }

  // ── Detect form submit to re-fill before save ─────────────────────────────
  function isSubmitEndpoint(url) {
    try {
      var u = new URL(url, window.location.origin);
      return /\/api\/form\/\d+\/submit\/?$/.test(u.pathname);
    } catch (e) {
      return /\/api\/form\/\d+\/submit\/?/.test(String(url || ""));
    }
  }

  function hookFetchAndXHR() {
    if (window.fetch && !window.fetch.__autofillOkrKrHooked) {
      var origFetch = window.fetch;
      window.fetch = function (input, init) {
        var url = (typeof input === "string") ? input : (input && input.url);
        try { if (url && isSubmitEndpoint(url)) fillFromProject(readField(PROJECT_KEY_IND)); } catch (e) {}
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
              fillFromProject(readField(PROJECT_KEY_IND));
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

  // ── Init — wait for pkWrap30 to exist before starting ────────────────────
  function init() {
    hookFetchAndXHR();
    lastSeenProjectKey = readField(PROJECT_KEY_IND);
    if (lastSeenProjectKey) fillFromProject(lastSeenProjectKey);
    setInterval(poll, POLL_INTERVAL);
  }

  // pkWrap30 may not exist yet if OKRkey_htmlEdit_30.js hasn't run;
  // wait up to 5s for it to appear before starting.
  function waitForAnchorThenInit() {
    var attempts = 0;
    var timer = setInterval(function () {
      attempts++;
      if (document.getElementById("pkWrap30") || attempts > 10) {
        clearInterval(timer);
        init();
      }
    }, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", waitForAnchorThenInit);
  } else {
    waitForAnchorThenInit();
  }
})();
</script>
