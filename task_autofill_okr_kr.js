(function () {
  "use strict";

  var TASK_IND = {
    projectKey: 8,
    okr: 30,
    keyResult: 39,
  };

  var PROJECT_IND = {
    projectKey: 2,
    okr: 29,
    keyResult: 37,
  };

  var BASE_QUERY_ENDPOINT =
    "https://leaf.va.gov/platform/projects/api/form/query/";

  var INFO_TEXT =
    "This value will be auto-filled based on the selected Project.";

  var cache = Object.create(null);
  var inflight = Object.create(null);
  var lastProjectKey = "";
  var useDefaultsBtnId = "pm-use-project-defaults";

  function ready(fn) {
    if (window.jQuery) {
      window.jQuery(fn);
      return;
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function findField(indicatorId) {
    return qs('[name="' + indicatorId + '"]');
  }

  function closestWrapper(el) {
    if (!el) return null;
    return (
      el.closest(".response") ||
      el.closest(".form-group") ||
      el.closest(".form-element") ||
      el.closest(".fieldwrap") ||
      el.closest("td") ||
      el.closest("tr") ||
      el.parentElement
    );
  }

  function ensureInfo(indicatorId) {
    var noteId = "pm-autofill-note-" + indicatorId;
    var note = document.getElementById(noteId);
    var field = findField(indicatorId);
    var wrapper = closestWrapper(field);

    if (!wrapper || !wrapper.parentElement) return null;

    if (!note) {
      note = document.createElement("div");
      note.id = noteId;
      note.setAttribute("role", "note");
      note.style.fontSize = "0.9rem";
      note.style.lineHeight = "1.35";
      note.style.padding = "0.35rem 0";
      note.style.color = "#1f1f1f";

      var text = document.createElement("div");
      text.textContent = INFO_TEXT;
      text.style.margin = "0 0 0.25rem 0";
      note.appendChild(text);

      wrapper.parentElement.insertBefore(note, wrapper);
    }

    return note;
  }

  function hideField(indicatorId) {
    var field = findField(indicatorId);
    if (!field) return null;

    var wrapper = closestWrapper(field);
    var note = ensureInfo(indicatorId);

    if (wrapper) wrapper.style.display = "none";

    var sublabel = document.querySelector(
      ".sublabel.blockIndicator_" + indicatorId,
    );
    if (sublabel) sublabel.style.display = "none";

    return { field: field, wrapper: wrapper, note: note };
  }

  function ensureSkipNotice(indicatorId) {
    var note = ensureInfo(indicatorId);
    if (!note) return null;

    var msgId = "pm-autofill-skip-" + indicatorId;
    var msg = document.getElementById(msgId);
    if (!msg) {
      msg = document.createElement("div");
      msg.id = msgId;
      msg.style.fontSize = "0.85rem";
      msg.style.color = "#5b3b00";
      msg.style.marginTop = "0.1rem";
      note.appendChild(msg);
    }
    return msg;
  }

  function setSkipNotice(indicatorId, text) {
    var msg = ensureSkipNotice(indicatorId);
    if (!msg) return;
    msg.textContent = text || "";
    msg.style.display = text ? "block" : "none";
  }

  function clearSkipNotice(indicatorId) {
    setSkipNotice(indicatorId, "");
  }

  function setFieldValue(indicatorId, value) {
    var field = findField(indicatorId);
    if (!field) return false;
    field.value = value == null ? "" : String(value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function readFieldValue(indicatorId) {
    var field = findField(indicatorId);
    return field ? String(field.value || "").trim() : "";
  }

  function updateUseDefaultsButton(projectKey) {
    var btn = document.getElementById(useDefaultsBtnId);
    if (!btn) return;
    var enabled = !!projectKey;
    btn.disabled = !enabled;
    btn.setAttribute("aria-disabled", enabled ? "false" : "true");
  }

  function ensureUseDefaultsButton() {
    var note = ensureInfo(TASK_IND.okr);
    if (!note) return;
    if (document.getElementById(useDefaultsBtnId)) return;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = useDefaultsBtnId;
    btn.textContent = "Use Project defaults";
    btn.className = "buttonNorm";
    btn.style.marginTop = "0.35rem";
    btn.style.padding = "0.25rem 0.5rem";
    btn.style.fontSize = "0.85rem";

    btn.addEventListener("click", function () {
      var key = readFieldValue(TASK_IND.projectKey);
      if (!key) return;
      applyDefaultsForKey(key, true);
    });

    note.appendChild(btn);
  }

  function coerceRows(json) {
    if (Array.isArray(json)) return json;
    if (json && typeof json === "object") {
      if (Array.isArray(json.data)) return json.data;
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

  function normalizeProjectCandidate(obj) {
    if (!obj || typeof obj !== "object") return null;
    var okr =
      obj.okrAssociation ||
      obj.okr ||
      obj.okrKey ||
      obj.okr_key ||
      obj.id29 ||
      obj["29"] ||
      "";
    var kr =
      obj.keyResultSelection ||
      obj.keyResult ||
      obj.key_result ||
      obj.kr ||
      obj.id37 ||
      obj["37"] ||
      "";

    if (!okr && !kr && obj.s1) {
      okr = obj.s1["id" + PROJECT_IND.okr] || "";
      kr = obj.s1["id" + PROJECT_IND.keyResult] || "";
    }

    okr = String(okr || "").trim();
    kr = String(kr || "").trim();

    if (!okr && !kr) return null;
    return { okr: okr, kr: kr };
  }

  function matchProjectKey(obj, key) {
    if (!obj || typeof obj !== "object") return false;
    var candidate =
      obj.projectKey ||
      obj.project_key ||
      obj.key ||
      obj.id2 ||
      obj["2"] ||
      "";
    if (!candidate && obj.s1) candidate = obj.s1["id" + PROJECT_IND.projectKey];
    return String(candidate || "").trim() === key;
  }

  function findClientSideProjectDefaults(projectKey) {
    var key = String(projectKey || "").trim();
    if (!key) return null;

    if (cache[key]) return cache[key];

    var mapCandidates = [
      window.pmProjectCache,
      window.projectKeyMap,
      window.pmProjectMap,
    ];
    for (var i = 0; i < mapCandidates.length; i += 1) {
      var map = mapCandidates[i];
      if (map && typeof map === "object" && !Array.isArray(map)) {
        if (map[key]) {
          var normalized = normalizeProjectCandidate(map[key]);
          if (normalized) return normalized;
        }
      }
    }

    var arrayCandidates = [];
    if (Array.isArray(window.pmProjectsAll)) arrayCandidates.push(window.pmProjectsAll);
    if (Array.isArray(window.projectsAll)) arrayCandidates.push(window.projectsAll);
    if (Array.isArray(window.pmProjectCache)) arrayCandidates.push(window.pmProjectCache);

    for (var j = 0; j < arrayCandidates.length; j += 1) {
      var arr = arrayCandidates[j];
      for (var k = 0; k < arr.length; k += 1) {
        if (matchProjectKey(arr[k], key)) {
          var normalizedArr = normalizeProjectCandidate(arr[k]);
          if (normalizedArr) return normalizedArr;
        }
      }
    }

    return null;
  }

  function buildProjectQueryUrl(projectKey) {
    var q = {
      terms: [
        {
          id: String(PROJECT_IND.projectKey),
          operator: "=",
          match: String(projectKey || ""),
          gate: "AND",
        },
        { id: "deleted", operator: "=", match: 0, gate: "AND" },
      ],
      joins: [],
      sort: {},
      getData: [
        String(PROJECT_IND.projectKey),
        String(PROJECT_IND.okr),
        String(PROJECT_IND.keyResult),
      ],
    };

    return (
      BASE_QUERY_ENDPOINT +
      "?q=" +
      encodeURIComponent(JSON.stringify(q)) +
      "&x-filterData=recordID,"
    );
  }

  function fetchProjectDefaults(projectKey) {
    var key = String(projectKey || "").trim();
    if (!key) return Promise.resolve(null);

    var cached = findClientSideProjectDefaults(key);
    if (cached) {
      cache[key] = cached;
      return Promise.resolve(cached);
    }

    if (cache[key]) return Promise.resolve(cache[key]);
    if (inflight[key]) return inflight[key];

    var url = buildProjectQueryUrl(key);
    inflight[key] = fetch(url, { credentials: "include" })
      .then(function (resp) {
        if (!resp.ok) {
          throw new Error("Project lookup failed. HTTP " + resp.status);
        }
        return resp.json();
      })
      .then(function (json) {
        var rows = coerceRows(json);
        var row = rows && rows.length ? rows[0] : null;
        var okr = extractFromS1(row, PROJECT_IND.okr);
        var kr = extractFromS1(row, PROJECT_IND.keyResult);
        var result = { okr: okr, kr: kr };
        cache[key] = result;
        return result;
      })
      .catch(function (err) {
        console.warn("Project lookup failed:", err);
        return null;
      })
      .finally(function () {
        delete inflight[key];
      });

    return inflight[key];
  }

  function applyDefaultsForKey(projectKey, force) {
    var key = String(projectKey || "").trim();
    updateUseDefaultsButton(key);
    if (!key) return;

    fetchProjectDefaults(key).then(function (defaults) {
      if (!defaults) return;

      var okrValue = defaults.okr || "";
      var krValue = defaults.kr || "";

      if (force) {
        setFieldValue(TASK_IND.okr, okrValue);
        setFieldValue(TASK_IND.keyResult, krValue);
        clearSkipNotice(TASK_IND.okr);
        clearSkipNotice(TASK_IND.keyResult);
        return;
      }

      var okrExisting = readFieldValue(TASK_IND.okr);
      var krExisting = readFieldValue(TASK_IND.keyResult);

      if (!okrExisting) {
        setFieldValue(TASK_IND.okr, okrValue);
        clearSkipNotice(TASK_IND.okr);
      } else {
        setSkipNotice(
          TASK_IND.okr,
          "OKR not auto-filled because a value already exists.",
        );
      }

      if (!krExisting) {
        setFieldValue(TASK_IND.keyResult, krValue);
        clearSkipNotice(TASK_IND.keyResult);
      } else {
        setSkipNotice(
          TASK_IND.keyResult,
          "Key Result not auto-filled because a value already exists.",
        );
      }
    });
  }

  function init() {
    var projectKeyField = findField(TASK_IND.projectKey);
    if (!projectKeyField) return;

    hideField(TASK_IND.okr);
    hideField(TASK_IND.keyResult);
    ensureUseDefaultsButton();

    var onProjectChange = function () {
      var key = readFieldValue(TASK_IND.projectKey);
      if (key === lastProjectKey) {
        updateUseDefaultsButton(key);
      }
      lastProjectKey = key;
      applyDefaultsForKey(key, false);
    };

    projectKeyField.addEventListener("change", onProjectChange);
    projectKeyField.addEventListener("blur", onProjectChange);
    projectKeyField.addEventListener("input", function () {
      updateUseDefaultsButton(readFieldValue(TASK_IND.projectKey));
    });

    onProjectChange();
  }

  ready(init);

  window.PMTaskAutofill = window.PMTaskAutofill || {};
  window.PMTaskAutofill.hideField = hideField;
})();
