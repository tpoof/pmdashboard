(function () {
  var env = document.getElementById("pmEnv");
  var CSRFToken = "";
  if (env) {
    CSRFToken =
      env.getAttribute("data-csrf") ||
      env.getAttribute("data-csrf-alt") ||
      env.getAttribute("data-csrf2") ||
      "";
  }

  // Task form indicator IDs
  var TASK_IND = {
    projectKey: 8,
    title: 9,
    status: 10,
    assignedTo: 11,
    startDate: 12,
    dueDate: 13,
    priority: 14,
    category: 16,
    dependencies: 17,
    supportTicket: 18,
    okrAssociation: 30,
  };

  // Project form indicator IDs
  var PROJECT_IND = {
    projectKey: 2,
    projectName: 3,
    description: 4,
    owner: 5,
    projectStatus: 6,
    projectFiscalYear: 38,
    okrAssociation: 29,
    projectType: 32,
  };

  // OKR indicator IDs (Project form)
  var OKR_IND = {
    okrKey: 23,
    objective: 24,
    startDate: 25,
    endDate: 26,
    fiscalYear: 33,
  };

  // Endpoints
  var BASE_QUERY_ENDPOINT =
    "https://leaf.va.gov/platform/projects/api/form/query/";
  var FORM_POST_ENDPOINT_PREFIX =
    "https://leaf.va.gov/platform/projects/api/form/";
  var START_PROJECT_URL =
    "https://leaf.va.gov/platform/projects/report.php?a=LEAF_Start_Request&id=form_55445&title=Project";
  var START_TASK_URL =
    "https://leaf.va.gov/platform/projects/report.php?a=LEAF_Start_Request&id=form_9b302&title=Task";
  var START_OKR_URL =
    "https://leaf.va.gov/platform/projects/report.php?a=LEAF_Start_Request&id=form_a2b55&title=OKR";
  var START_KEY_RESULT_URL =
    "https://leaf.va.gov/platform/projects/report.php?a=LEAF_Start_Request&id=form_6530b&title=Key+Result";

  // Persistence keys
  var STORAGE_KEYS = {
    activeTab: "pm_active_tab",
    tasksView: "pm_tasks_view",
    analyticsView: "pm_analytics_view",
  };

  // Fallback drives Kanban column order even when zero tasks
  var STATUS_OPTIONS_FALLBACK = [
    "Not Started",
    "In Progress",
    "Blocked - Dependencies",
    "On Hold",
    "Completed",
  ];

  var state = {
    projectsAll: [],
    tasksAll: [],
    statusOptionsOrdered: STATUS_OPTIONS_FALLBACK.slice(),
    projectKeyToRecordID: {},
    projectKeyToTitle: {},
    csrfToken: "",
    csrfField: "CSRFToken",
    transferInProgress: false,
    kanbanColumns: [],
    analyticsYear: "",
    analyticsCategoryYear: "",
    analyticsCategoryQuarter: "",
    analyticsTicketsYear: "",
    analyticsGeneralYear: "",
    analyticsGeneralQuarter: "",
    sort: {
      projects: { key: null, dir: 1, type: "string" },
      tasks: { key: null, dir: 1, type: "string" },
      okrs: { key: null, dir: 1, type: "string" },
    },
    charts: {
      status: null,
      projectKey: null,
      dueBuckets: null,
      completedByQuarter: null,
      completedByCategory: null,
      priority: null,
      ticketsImported: null,
      projectsByType: null,
      okrAchieved: null,
      okrTasks: null,
    },
  };

  function safe(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function safeAttr(s) {
    return safe(s).replaceAll('"', "&quot;");
  }

  var lastFocusedElement = null;

  // Accessibility: keep focus inside the modal while it is open.
  function getFocusableElements(container) {
    if (!container) return [];
    var selectors =
      'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])';
    return Array.from(container.querySelectorAll(selectors)).filter(function (
      el,
    ) {
      if (el.getAttribute("aria-hidden") === "true") return false;
      return !!(el.offsetParent || el === document.activeElement);
    });
  }

  function toggleAppInert(isInert) {
    var app = document.querySelector(".pm-wrap");
    if (!app) return;
    Array.from(app.children).forEach(function (child) {
      if (!child || child.id === "pmModal") return;
      if (isInert) {
        child.setAttribute("aria-hidden", "true");
        child.setAttribute("inert", "");
      } else {
        child.removeAttribute("aria-hidden");
        child.removeAttribute("inert");
      }
    });
  }

  function isModalOpen() {
    var modal = document.getElementById("pmModal");
    return !!(modal && modal.getAttribute("aria-hidden") === "false");
  }

  function openModal(title, url) {
    var modal = document.getElementById("pmModal");
    var frame = document.getElementById("pmModalFrame");
    var titleEl = document.getElementById("pmModalTitle");
    var openTabBtn = document.getElementById("pmModalOpenTabBtn");
    var closeBtn = document.getElementById("pmModalCloseBtn");
    if (!modal || !frame || !titleEl) return;
    titleEl.textContent = title || "Details";
    frame.src = url;
    frame.setAttribute(
      "title",
      title ? "LEAF content - " + String(title) : "LEAF content",
    );
    if (openTabBtn) openTabBtn.setAttribute("data-url", url || "");
    lastFocusedElement = document.activeElement;
    modal.style.display = "block";
    modal.setAttribute("aria-hidden", "false");
    toggleAppInert(true);
    document.body.style.overflow = "hidden";
    requestAnimationFrame(function () {
      if (closeBtn) closeBtn.focus();
      else modal.focus();
    });
  }

  function closeModal() {
    var modal = document.getElementById("pmModal");
    var frame = document.getElementById("pmModalFrame");
    var openTabBtn = document.getElementById("pmModalOpenTabBtn");
    if (!modal || !frame) return;
    frame.src = "about:blank";
    frame.setAttribute("title", "LEAF content");
    if (openTabBtn) openTabBtn.setAttribute("data-url", "");
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    toggleAppInert(false);
    document.body.style.overflow = "";
    if (lastFocusedElement && document.contains(lastFocusedElement)) {
      lastFocusedElement.focus();
    }
    lastFocusedElement = null;
  }

  function encodeFormBody(obj) {
    var parts = [];
    Object.keys(obj).forEach(function (k) {
      parts.push(
        encodeURIComponent(k) +
          "=" +
          encodeURIComponent(String(obj[k] == null ? "" : obj[k])),
      );
    });
    return parts.join("&");
  }

  function showTransferDebug(msg) {
    if (!msg) return;
    if (!document || !document.body) {
      window.__pmTransferDebug = msg;
      return;
    }
    var el = document.getElementById("pmTransferDebug");
    if (!el) {
      el = document.createElement("div");
      el.id = "pmTransferDebug";
      el.style.cssText =
        "position:fixed;right:16px;bottom:16px;z-index:9999;background:#111;color:#fff;padding:8px 10px;border-radius:6px;font-size:12px;max-width:300px;box-shadow:0 2px 8px rgba(0,0,0,0.25)";
      document.body.appendChild(el);
    }
    el.textContent = msg;
  }

  function flushTransferDebug() {
    if (window.__pmTransferDebug) {
      var msg = window.__pmTransferDebug;
      window.__pmTransferDebug = "";
      showTransferDebug(msg);
    }
  }

  function getQueryParam(name) {
    var search = window.location.search || "";
    if (!search) return "";
    try {
      if (typeof URLSearchParams !== "undefined") {
        return new URLSearchParams(search).get(name) || "";
      }
    } catch (e) {}
    var match = search.match(new RegExp("[?&]" + name + "=([^&]+)"));
    return match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : "";
  }

  function getCSRFToken() {
    if (CSRFToken && CSRFToken.indexOf("{") !== 0) return CSRFToken;

    var meta = document.querySelector("meta[name='csrf-token']");
    if (meta) {
      var v = meta.getAttribute("content") || "";
      if (v) return v;
    }

    var input =
      document.querySelector("input[name='CSRFToken']") ||
      document.querySelector("input[name='csrf_token']") ||
      document.querySelector("input[name='csrfToken']");
    if (input && input.value) return input.value;

    if (typeof window !== "undefined") {
      if (window.CSRFToken) return window.CSRFToken;
      if (window.csrfToken) return window.csrfToken;
      if (window.csrf_token) return window.csrf_token;
    }

    var cookieNames = ["CSRFToken", "csrf_token", "XSRF-TOKEN"];
    for (var i = 0; i < cookieNames.length; i++) {
      var name = cookieNames[i];
      var re = new RegExp("(?:^|;\\\\s*)" + name + "=([^;]+)");
      var m = document.cookie.match(re);
      if (m && m[1]) return decodeURIComponent(m[1]);
    }

    return CSRFToken || "";
  }

  function getCSRFFieldName() {
    var input =
      document.querySelector("input[name='CSRFToken']") ||
      document.querySelector("input[name='csrf_token']") ||
      document.querySelector("input[name='csrfToken']");
    if (input && input.name) return input.name;
    return "CSRFToken";
  }

  function extractCSRFTokenFromHTML(html) {
    var src = String(html || "");
    if (!src) return { token: "", field: "" };

    var inputMatch = src.match(
      /name=["'](CSRFToken|csrf_token|csrfToken)["'][^>]*value=["']([^"']+)["']/i,
    );
    if (inputMatch && inputMatch[2])
      return { token: inputMatch[2], field: inputMatch[1] };

    var metaMatch = src.match(
      /<meta[^>]*name=["']csrf-token["'][^>]*content=["']([^"']+)["']/i,
    );
    if (metaMatch && metaMatch[1])
      return { token: metaMatch[1], field: "CSRFToken" };

    var jsMatch = src.match(/CSRFToken\s*[:=]\s*["']([^"']+)["']/i);
    if (jsMatch && jsMatch[1]) return { token: jsMatch[1], field: "CSRFToken" };

    var jsAltMatch = src.match(/csrf_token\s*[:=]\s*["']([^"']+)["']/i);
    if (jsAltMatch && jsAltMatch[1])
      return { token: jsAltMatch[1], field: "csrf_token" };

    var jsAltMatch2 = src.match(/csrfToken\s*[:=]\s*["']([^"']+)["']/i);
    if (jsAltMatch2 && jsAltMatch2[1])
      return { token: jsAltMatch2[1], field: "csrfToken" };

    return { token: "", field: "" };
  }

  function cacheCSRF(token, field) {
    if (token) state.csrfToken = token;
    if (field) state.csrfField = field;
  }

  function fetchCSRFTokenFromIframe(url) {
    return new Promise(function (resolve) {
      if (!document || !document.body || !url) return resolve("");
      var iframe = document.createElement("iframe");
      var done = false;
      var maxWaitMs = 3500;
      var pollIntervalMs = 200;
      var startTime = Date.now();
      iframe.style.cssText =
        "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;border:0;opacity:0;";
      var sep = url.indexOf("?") === -1 ? "?" : "&";
      iframe.src = url + sep + "csrfProbe=1&ts=" + Date.now();

      function finish(token) {
        if (done) return;
        done = true;
        try {
          iframe.remove();
        } catch (e0) {
          try {
            if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
          } catch (e1) {}
        }
        resolve(token || "");
      }

      function tryReadToken() {
        var token = "";
        try {
          var doc = iframe.contentDocument || iframe.contentWindow.document;
          if (doc) {
            var input =
              doc.querySelector("input[name='CSRFToken']") ||
              doc.querySelector("input[name='csrf_token']") ||
              doc.querySelector("input[name='csrfToken']");
            if (input && input.value) token = input.value;

            if (!token) {
              var meta = doc.querySelector("meta[name='csrf-token']");
              if (meta) token = meta.getAttribute("content") || "";
            }

            if (!token && doc.documentElement) {
              var html = doc.documentElement.innerHTML || "";
              var match = extractCSRFTokenFromHTML(html);
              if (match && match.token) token = match.token;
            }
          }
          if (!token && iframe.contentWindow) {
            if (iframe.contentWindow.CSRFToken)
              token = iframe.contentWindow.CSRFToken;
            else if (iframe.contentWindow.csrfToken)
              token = iframe.contentWindow.csrfToken;
            else if (iframe.contentWindow.csrf_token)
              token = iframe.contentWindow.csrf_token;
          }
        } catch (e2) {}
        return token;
      }

      function pollForToken() {
        var token = tryReadToken();
        if (token) {
          cacheCSRF(token, "CSRFToken");
          finish(token);
          return;
        }
        if (Date.now() - startTime > maxWaitMs) {
          finish("");
          return;
        }
        setTimeout(pollForToken, pollIntervalMs);
      }

      iframe.addEventListener("load", function () {
        pollForToken();
      });

      setTimeout(function () {
        finish("");
      }, maxWaitMs + 500);

      document.body.appendChild(iframe);
    });
  }

  async function ensureCSRFToken(recordID) {
    if (state.csrfToken) return state.csrfToken;

    var token = getCSRFToken();
    var field = getCSRFFieldName();
    if (token && token.indexOf("{") !== 0) {
      cacheCSRF(token, field);
      return token;
    }

    try {
      var localHtml = document.documentElement
        ? document.documentElement.innerHTML
        : "";
      var localMatch = extractCSRFTokenFromHTML(localHtml);
      if (localMatch.token) {
        cacheCSRF(localMatch.token, localMatch.field);
        return localMatch.token;
      }
    } catch (e0) {}

    async function fetchAndExtract(url, label) {
      var r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error(label + " HTTP " + r.status);

      var headerNames = [
        "x-csrf-token",
        "csrf-token",
        "x-xsrf-token",
        "x-csrftoken",
      ];
      for (var i = 0; i < headerNames.length; i++) {
        var h = r.headers.get(headerNames[i]);
        if (h) {
          cacheCSRF(h, "CSRFToken");
          return h;
        }
      }

      var html = await r.text();
      var match = extractCSRFTokenFromHTML(html);
      if (match.token) {
        cacheCSRF(match.token, match.field);
        return match.token;
      }

      console.warn("CSRF token not found in " + label + " response.");
      return "";
    }

    try {
      var t1 = await fetchAndExtract(START_TASK_URL, "START_TASK_URL");
      if (t1) return t1;
    } catch (e) {
      console.warn("CSRF fetch failed (START_TASK_URL).", e);
    }

    try {
      var t2 = await fetchAndExtract(START_PROJECT_URL, "START_PROJECT_URL");
      if (t2) return t2;
    } catch (e2) {
      console.warn("CSRF fetch failed (START_PROJECT_URL).", e2);
    }

    try {
      var t3 = await fetchCSRFTokenFromIframe(START_TASK_URL);
      if (t3) return t3;
    } catch (e3) {}

    if (recordID) {
      try {
        var viewUrl =
          "index.php?a=view&recordID=" + encodeURIComponent(recordID);
        var t4 = await fetchAndExtract(viewUrl, "view form");
        if (t4) return t4;
      } catch (e4) {
        console.warn("CSRF fetch failed (view form).", e3);
      }
    }

    return "";
  }

  async function fetchJSON(url) {
    var r = await fetch(url, { credentials: "same-origin" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  function coerceRows(json) {
    if (Array.isArray(json)) return json;
    if (json && typeof json === "object") {
      if (Array.isArray(json.data)) return json.data;
      if (Array.isArray(json.records)) return json.records;
      if (Array.isArray(json.results)) return json.results;

      var keys = Object.keys(json);
      var keyed =
        keys.length &&
        keys.every(function (k) {
          return /^\d+$/.test(k);
        });
      if (keyed) {
        return keys.map(function (k) {
          var row = json[k] || {};
          if (!row.recordID && !row.recordId && !row.id) row.recordID = k;
          return row;
        });
      }
    }
    return null;
  }

  function extractFromS1(row, indicatorId) {
    if (!row || !row.s1) return "";
    var key = "id" + String(indicatorId);
    var v = row.s1[key];
    if (v == null) return "";
    return String(v).trim();
  }

  function extractRawIndicator(row, indicatorId) {
    if (!row) return null;
    var key = "id" + String(indicatorId);
    if (row.s1 && row.s1[key] != null) return row.s1[key];
    if (row[key] != null) return row[key];
    if (row.data && row.data[key] != null) return row.data[key];
    return null;
  }

  function decodeEntities(str) {
    // Handles HTML-escaped JSON like [{&quot;id&quot;:185,...}]
    var s = String(str || "");
    if (!s) return "";
    var ta = document.createElement("textarea");
    ta.innerHTML = s;
    return ta.value;
  }

  /* ===== Dependencies parsing (comma rendering) ===== */
  function parseDependencies(raw) {
    var v = String(raw || "").trim();
    if (!v) return [];
    try {
      var a = JSON.parse(v);
      return Array.isArray(a) ? a : [];
    } catch (e1) {
      try {
        var decoded = decodeEntities(v);
        var b = JSON.parse(decoded);
        return Array.isArray(b) ? b : [];
      } catch (e2) {
        return [];
      }
    }
  }

  function extractDependencyIds(raw) {
    var arr = parseDependencies(raw);
    return arr
      .map(function (x) {
        return x && (x.id != null ? String(x.id).trim() : "");
      })
      .filter(function (id) {
        return !!id;
      });
  }

  function recordLink(recordID, title) {
    var id = String(recordID || "").trim();
    if (!id) return "";
    var href = "index.php?a=printview&recordID=" + encodeURIComponent(id);
    return (
      '<a href="' +
      safe(href) +
      '" class="pm-recordLink" data-title="' +
      safe(title || "Record " + id) +
      '">' +
      safe(id) +
      "</a>"
    );
  }

  function getOkrRecordId(okrKey) {
    var raw = String(okrKey || "");
    var match = raw.match(/\d+/);
    if (!match) return "";
    var num = Number(match[0]);
    if (!isFinite(num)) return "";
    return String(num);
  }

  function formatOkrDisplay(okrKey, okrObjective) {
    var key = String(okrKey || "").trim();
    var obj = String(okrObjective || "").trim();
    if (!key) return obj;
    if (!obj) return key;
    return key + " - " + obj;
  }

  function okrRecordLink(okrKey, displayText) {
    var id = getOkrRecordId(okrKey);
    if (!id) return "";
    var href = "index.php?a=printview&recordID=" + encodeURIComponent(id);
    var label = displayText || okrKey;
    return (
      '<a href="' +
      safe(href) +
      '" class="pm-recordLink" data-title="' +
      safe(displayText || "OKR " + id) +
      '">' +
      safe(label) +
      "</a>"
    );
  }

  function normalizeOkrKey(val) {
    var key = String(val || "").trim();
    if (!key) return "";
    return key.toUpperCase();
  }

  function parseSupportTicket(value) {
    var text = String(value || "").trim();
    if (!text) return { id: "", type: "" };
    var match = text.match(/^(Support|UX)\s*Ticket\s*#(\d+)/i);
    if (match) return { id: match[2], type: match[1].toLowerCase() };
    return { id: "", type: "" };
  }

  function getSupportTicketId(value) {
    return parseSupportTicket(value).id;
  }

  function supportTicketLink(value) {
    var parsed = parseSupportTicket(value);
    var id = parsed.id;
    if (!id) return "";
    var label = "#" + id;
    var title = parsed.type
      ? (parsed.type === "ux" ? "UX Ticket #" : "Support Ticket #") + id
      : "Ticket #" + id;
    var hrefBase =
      parsed.type === "ux"
        ? "/platform/ux/index.php?a=printview&recordID="
        : "/platform/support/index.php?a=printview&recordID=";
    var href = hrefBase + encodeURIComponent(id);
    return (
      '<a href="' +
      safe(href) +
      '" class="pm-recordLink" data-title="' +
      safe(title) +
      '">' +
      safe(label) +
      "</a>"
    );
  }

  function backfillSupportTicketLabels(tasks) {
    if (!tasks || !tasks.length) return;
    if (window.__pmSupportTicketBackfillRan) return;
    var pending = tasks
      .map(function (t) {
        var parsed = parseSupportTicket(t.supportTicket);
        if (!parsed.id || parsed.type) return null;
        return { recordID: t.recordID, id: parsed.id };
      })
      .filter(Boolean);

    if (!pending.length) return;
    window.__pmSupportTicketBackfillRan = true;

    var maxUpdates = 25;
    if (pending.length > maxUpdates) pending = pending.slice(0, maxUpdates);

    pending.reduce(function (p, item) {
      return p.then(function () {
        return setSupportTicketIndicator(item.recordID, item.id, "support").catch(
          function () {},
        );
      });
    }, Promise.resolve());
  }

  function renderDepsList(depIds) {
    if (!depIds || !depIds.length) return '<span class="pm-muted">None</span>';
    return (
      '<span class="pm-depsList">' +
      depIds
        .map(function (id) {
          return recordLink(id, "Dependency " + id);
        })
        .join(", ") +
      "</span>"
    );
  }
  /* ===== End dependencies block ===== */

  function getRecordID(row) {
    return String(row.recordID || row.recordId || row.id || "").trim();
  }

  function normalizeTask(row) {
    var recordID = getRecordID(row);
    var createdAt =
      row.dateInitiated ||
      row.dateSubmitted ||
      row.submitted ||
      row.dateCreated ||
      row.created ||
      row.creationDate ||
      row.date ||
      "";

    // Prefer raw access first, then s1 string fallback
    var depsRawAny = extractRawIndicator(row, TASK_IND.dependencies);
    var depsRaw =
      depsRawAny != null && typeof depsRawAny !== "object"
        ? String(depsRawAny)
        : extractFromS1(row, TASK_IND.dependencies);

    // If we actually got an array/object, try to JSON-stringify then parse with the same logic
    if (depsRawAny != null && typeof depsRawAny === "object") {
      try {
        depsRaw = JSON.stringify(depsRawAny);
      } catch (e0) {}
    }

    var depIds = extractDependencyIds(depsRaw);

    return {
      recordID: recordID,
      projectKey: extractFromS1(row, TASK_IND.projectKey),
      title: extractFromS1(row, TASK_IND.title),
      status: extractFromS1(row, TASK_IND.status),
      assignedTo: extractFromS1(row, TASK_IND.assignedTo),
      start: extractFromS1(row, TASK_IND.startDate),
      due: extractFromS1(row, TASK_IND.dueDate),
      priority: extractFromS1(row, TASK_IND.priority),
      category: extractFromS1(row, TASK_IND.category),
      supportTicket: extractFromS1(row, TASK_IND.supportTicket),
      okrAssociation: extractFromS1(row, TASK_IND.okrAssociation),
      createdAt: createdAt,
      dependenciesRaw: depsRaw,
      depIds: depIds,
      href: recordID
        ? "index.php?a=printview&recordID=" + encodeURIComponent(recordID)
        : "",
    };
  }

  function normalizeProject(row) {
    var recordID = getRecordID(row);
    var createdAt =
      row.dateInitiated ||
      row.dateSubmitted ||
      row.submitted ||
      row.dateCreated ||
      row.created ||
      row.creationDate ||
      row.date ||
      "";
    return {
      recordID: recordID,
      projectKey: extractFromS1(row, PROJECT_IND.projectKey),
      projectName: extractFromS1(row, PROJECT_IND.projectName),
      description: extractFromS1(row, PROJECT_IND.description),
      owner: extractFromS1(row, PROJECT_IND.owner),
      projectStatus: extractFromS1(row, PROJECT_IND.projectStatus),
      projectFiscalYear: extractFromS1(row, PROJECT_IND.projectFiscalYear),
      okrAssociation: extractFromS1(row, PROJECT_IND.okrAssociation),
      projectType: extractFromS1(row, PROJECT_IND.projectType),
      okrKey: extractFromS1(row, OKR_IND.okrKey),
      okrObjective: extractFromS1(row, OKR_IND.objective),
      okrStartDate: extractFromS1(row, OKR_IND.startDate),
      okrEndDate: extractFromS1(row, OKR_IND.endDate),
      okrFiscalYear: extractFromS1(row, OKR_IND.fiscalYear),
      createdAt: createdAt,
      href: recordID
        ? "index.php?a=printview&recordID=" + encodeURIComponent(recordID)
        : "",
    };
  }

  function buildQueryUrl(getData, extraTerms) {
    var terms = Array.isArray(extraTerms) ? extraTerms.slice() : [];
    terms.push({ id: "deleted", operator: "=", match: 0, gate: "AND" });
    var q = { terms: terms, joins: [], sort: {}, getData: getData.map(String) };
    return (
      BASE_QUERY_ENDPOINT +
      "?q=" +
      encodeURIComponent(JSON.stringify(q)) +
      "&x-filterData=recordID,date"
    );
  }

  function hasAnyS1Value(row, indicatorIds) {
    if (!row || !row.s1) return false;
    for (var i = 0; i < indicatorIds.length; i++) {
      var key = "id" + String(indicatorIds[i]);
      var v = row.s1[key];
      if (v !== null && v !== undefined && String(v).trim() !== "") return true;
    }
    return false;
  }

  function parseDateLoose(val) {
    if (!val) return null;
    var d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatDateCell(value) {
    var d = parseDateLoose(value);
    if (d) return formatDateShort(d);
    return String(value || "").trim();
  }

  function formatProjectTypeLabel(value) {
    var pt = String(value || "").trim() || "Unspecified";
    var dashIdx = pt.indexOf("-");
    if (dashIdx !== -1) pt = pt.slice(0, dashIdx).trim();
    return pt || "Unspecified";
  }

  function setChartSummary(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text || "";
  }

  function summarizeLabelData(labels, data) {
    if (!labels || !labels.length || !data || !data.length) return "No data.";
    return labels
      .map(function (label, idx) {
        var v = data[idx];
        if (v == null || isNaN(v)) v = 0;
        return label + ": " + v;
      })
      .join("; ");
  }

  function summarizeStacked(labels, dataA, dataB, labelA, labelB) {
    if (!labels || !labels.length) return "No data.";
    return labels
      .map(function (label, idx) {
        var a = dataA && dataA[idx] != null ? dataA[idx] : 0;
        var b = dataB && dataB[idx] != null ? dataB[idx] : 0;
        return label + ": " + labelA + " " + a + ", " + labelB + " " + b;
      })
      .join("; ");
  }

  function compareValues(a, b, dir, type) {
    if (type === "number") return dir * ((Number(a) || 0) - (Number(b) || 0));
    if (type === "date") {
      var da = parseDateLoose(a);
      var db = parseDateLoose(b);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return dir * (da - db);
    }
    return (
      dir *
      String(a || "").localeCompare(String(b || ""), undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  }

  function setSortIndicator(containerId, activeKey, dir) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll(".pm-sortable").forEach(function (th) {
      th.classList.remove("is-asc", "is-desc");
      var key = th.getAttribute("data-sort");
      var ariaSort = "none";
      if (key && key === activeKey) {
        th.classList.add(dir === 1 ? "is-asc" : "is-desc");
        ariaSort = dir === 1 ? "ascending" : "descending";
      }
      th.setAttribute("aria-sort", ariaSort);
    });
  }

  function getPriorityPill(priority) {
    var p = String(priority || "").trim();
    if (!p) return "";
    if (p.toLowerCase() === "high")
      return '<span class="pm-pill pm-pill-high">High</span>';
    if (p.toLowerCase() === "medium")
      return '<span class="pm-pill pm-pill-med">Medium</span>';
    if (p.toLowerCase() === "low")
      return '<span class="pm-pill pm-pill-low">Low</span>';
    return safe(p);
  }

  function getProjectRecordHrefFromKey(projectKey) {
    var key = String(projectKey || "").trim();
    if (!key) return "";
    var rid = state.projectKeyToRecordID[key];
    if (!rid) return "";
    return "index.php?a=printview&recordID=" + encodeURIComponent(rid);
  }

  function renderProjectsTable(projects) {
    var el = document.getElementById("pmProjectsTable");
    if (!el) return;

    var rows = projects
      .filter(function (p) {
        return (
          String(p.projectKey || "").trim() ||
          String(p.projectName || "").trim() ||
          String(p.description || "").trim() ||
          String(p.owner || "").trim() ||
          String(p.projectStatus || "").trim()
        );
      })
      .slice(0, 500)
      .map(function (p) {
        var projectKeyText = String(p.projectKey || "").trim();
        var projectNameText = String(p.projectName || "").trim();
        var pkHref = getProjectRecordHrefFromKey(p.projectKey) || p.href;
        var pkLink = pkHref
          ? '<a href="' +
            safe(pkHref) +
            '" class="pm-recordLink" data-title="' +
            safe("Project " + projectKeyText) +
            '" title="' +
            safeAttr(projectKeyText) +
            '">' +
            safe(projectKeyText) +
            "</a>"
          : '<span class="pm-colKeyText" tabindex="0" title="' +
            safeAttr(projectKeyText) +
            '">' +
            safe(projectKeyText) +
            "</span>";
        var okrLink = p.okrAssociation
          ? okrRecordLink(p.okrAssociation, p.okrAssociation)
          : "";

        return (
          "<tr>" +
          '<td class="pm-colKey">' +
          pkLink +
          "</td>" +
          '<td class="pm-colName">' +
          '<div class="pm-wrapCol pm-colNameText" tabindex="0" title="' +
          safeAttr(projectNameText) +
          '" aria-label="' +
          safeAttr(projectNameText || "Project name") +
          '">' +
          safe(projectNameText) +
          "</div>" +
          "</td>" +
          '<td class="pm-colDesc">' +
          '<div class="pm-wrapColLong">' +
          safe(p.description) +
          "</div>" +
          "</td>" +
          "<td>" +
          safe(p.owner) +
          "</td>" +
          "<td>" +
          safe(p.projectStatus) +
          "</td>" +
          "<td>" +
          safe(p.projectFiscalYear) +
          "</td>" +
          "<td>" +
          (okrLink || safe(p.okrAssociation)) +
          "</td>" +
          "<td>" +
          safe(formatProjectTypeLabel(p.projectType)) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    el.innerHTML =
      '<table class="pm-table">' +
      "<thead><tr>" +
      '<th scope="col" class="pm-sortable pm-colKey" data-sort="projectKey" data-type="string"><button type="button" class="pm-sortBtn">Project Key</button></th>' +
      '<th scope="col" class="pm-sortable pm-colName" data-sort="projectName" data-type="string"><button type="button" class="pm-sortBtn">Project Name</button></th>' +
      '<th scope="col" class="pm-sortable pm-colDesc" data-sort="description" data-type="string"><button type="button" class="pm-sortBtn">Description</button></th>' +
      '<th scope="col" class="pm-sortable" data-sort="owner" data-type="string"><button type="button" class="pm-sortBtn">Owner</button></th>' +
      '<th scope="col" class="pm-sortable" data-sort="projectStatus" data-type="string"><button type="button" class="pm-sortBtn">Status</button></th>' +
      '<th scope="col" class="pm-sortable" data-sort="projectFiscalYear" data-type="string"><button type="button" class="pm-sortBtn">FY</button></th>' +
      '<th scope="col" class="pm-sortable" data-sort="okrAssociation" data-type="string"><button type="button" class="pm-sortBtn">OKR</button></th>' +
      '<th scope="col" class="pm-sortable" data-sort="projectType" data-type="string"><button type="button" class="pm-sortBtn">Project Type</button></th>' +
      "</tr></thead>" +
      "<tbody>" +
      rows +
      "</tbody>" +
      "</table>";

    var s = state.sort.projects;
    setSortIndicator("pmProjectsTable", s.key, s.dir);
  }

  function renderOkrsTable(projects) {
    var el = document.getElementById("pmOkrsTable");
    if (!el) return;

    var okrRows = (projects || []).filter(function (p) {
      return (
        String(p.okrKey || "").trim() ||
        String(p.okrObjective || "").trim() ||
        String(p.okrStartDate || "").trim() ||
        String(p.okrEndDate || "").trim() ||
        String(p.okrFiscalYear || "").trim()
      );
    });

    if (state.sort.okrs.key) {
      var so = state.sort.okrs;
      okrRows = okrRows.slice().sort(function (a, b) {
        var av = a[so.key];
        var bv = b[so.key];
        if (so.key === "okrKey" && so.type === "number") {
          av = getOkrRecordId(av);
          bv = getOkrRecordId(bv);
        }
        return compareValues(av, bv, so.dir, so.type);
      });
    }

    var rows = okrRows
      .slice(0, 500)
      .map(function (p) {
        var okrLink = p.okrKey ? okrRecordLink(p.okrKey, p.okrKey) : "";
        return (
          "<tr>" +
          "<td>" +
          (okrLink || safe(p.okrKey)) +
          "</td>" +
          "<td>" +
          safe(p.okrObjective) +
          "</td>" +
          "<td>" +
          safe(formatDateCell(p.okrStartDate)) +
          "</td>" +
          "<td>" +
          safe(formatDateCell(p.okrEndDate)) +
          "</td>" +
          "<td>" +
          safe(p.okrFiscalYear) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    el.innerHTML =
      '<table class="pm-table">' +
      "<thead><tr>" +
      '<th scope="col" class="pm-sortable" data-sort="okrKey" data-type="number"><button type="button" class="pm-sortBtn">OKR Key</button></th>' +
      '<th scope="col" class="pm-sortable" data-sort="okrObjective" data-type="string"><button type="button" class="pm-sortBtn">Objective</button></th>' +
      '<th scope="col" class="pm-sortable" data-sort="okrStartDate" data-type="date"><button type="button" class="pm-sortBtn">Start Date</button></th>' +
      '<th scope="col" class="pm-sortable" data-sort="okrEndDate" data-type="date"><button type="button" class="pm-sortBtn">End Date</button></th>' +
      '<th scope="col" class="pm-sortable" data-sort="okrFiscalYear" data-type="string"><button type="button" class="pm-sortBtn">Fiscal Year</button></th>' +
      "</tr></thead>" +
      "<tbody>" +
      (rows || "<tr><td colspan='5'>No OKRs found</td></tr>") +
      "</tbody>" +
      "</table>";

    var s = state.sort.okrs;
    setSortIndicator("pmOkrsTable", s.key, s.dir);
  }

  function getProjectLabel(p) {
    var key = String(p.projectKey || "").trim();
    var name = String(p.projectName || "").trim();
    if (key && name) return key + " | " + name;
    return key || name || "Untitled project";
  }

  function getProjectLabelFromKey(projectKey) {
    var key = String(projectKey || "").trim();
    var name = key ? state.projectKeyToTitle[key] || "" : "";
    if (key && name) return key + " | " + name;
    return key || name || "Unknown project";
  }

  function makeSafeId(val) {
    return String(val || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function buildOkrRollup(okrRecords, projects, tasks) {
    var map = {};
    function ensure(key, display) {
      if (!key) return;
      if (!map[key]) {
        map[key] = {
          key: key,
          displayKey: display || key,
          projects: [],
          tasks: [],
          completedTasks: [],
        };
      } else if (display) {
        if (!map[key].displayKey) {
          map[key].displayKey = display;
        } else if (map[key].displayKey === key && display !== key) {
          map[key].displayKey = display;
        }
      }
    }

    (okrRecords || []).forEach(function (r) {
      var key = normalizeOkrKey(r.okrKey);
      if (!key) return;
      ensure(key, formatOkrDisplay(r.okrKey, r.okrObjective));
    });

    var hasOkrKeys = Object.keys(map).length > 0;

    (projects || []).forEach(function (p) {
      var key = normalizeOkrKey(p.okrAssociation);
      if (!key) return;
      if (!hasOkrKeys) ensure(key, key);
      if (!map[key]) return;
      map[key].projects.push(p);
    });

    (tasks || []).forEach(function (t) {
      var key = normalizeOkrKey(t.okrAssociation);
      if (!key) return;
      if (!hasOkrKeys) ensure(key, key);
      if (!map[key]) return;
      map[key].tasks.push(t);
      if (isCompletedStatus(t.status)) map[key].completedTasks.push(t);
    });

    var keys = Object.keys(map).sort(function (a, b) {
      return a.localeCompare(b, undefined, { numeric: true });
    });

    var items = keys.map(function (key) {
      var entry = map[key];
      var total = entry.tasks.length;
      var completed = entry.completedTasks.length;
      var percent = total ? Math.round((completed / total) * 100) : 0;
      return {
        key: entry.key,
        displayKey: entry.displayKey || entry.key,
        projects: entry.projects,
        tasks: entry.tasks,
        completedTasks: entry.completedTasks,
        totalTasks: total,
        completedTasksCount: completed,
        remainingTasksCount: Math.max(total - completed, 0),
        percent: percent,
      };
    });

    return { keys: keys, items: items };
  }

  function renderOkrsRollup(okrRecords, projects, tasks) {
    var wrap = document.getElementById("pmOkrsRollup");
    var summary = document.getElementById("pmOkrsSummary");
    if (!wrap || !summary) return;

    var rollup = buildOkrRollup(okrRecords, projects, tasks);
    var items = rollup.items || [];

    if (!items.length) {
      summary.innerHTML =
        "<div class='pm-okrCard'>No OKRs found for roll-up.</div>";
    } else {
      summary.innerHTML = items
        .map(function (item) {
          var keyId = makeSafeId(item.key || item.displayKey);
          var projId = "pmOkrProjects-" + keyId;
          var tasksId = "pmOkrTasks-" + keyId;
          var completedId = "pmOkrCompleted-" + keyId;
          var pctValue = Number(item.percent);
          if (!isFinite(pctValue)) pctValue = 0;
          var pctText = String(pctValue);
          var projectCountText = String(item.projects.length || 0);
          var totalTasksText = String(item.totalTasks || 0);
          var completedTasksText = String(item.completedTasksCount || 0);
          var pctClass = "pm-okrPct";
          var okrLabel = safeAttr(item.displayKey || item.key || "");
          if (item.completedTasksCount === 0)
            pctClass += " pm-okrPct--none";
          else if (pctValue >= 100) pctClass += " pm-okrPct--complete";

          var projectList = item.projects.length
            ? "<ul class='pm-okrList'>" +
              item.projects
                .map(function (p) {
                  var label = getProjectLabel(p);
                  var href =
                    getProjectRecordHrefFromKey(p.projectKey) ||
                    (p.recordID
                      ? "index.php?a=printview&recordID=" +
                        encodeURIComponent(p.recordID)
                      : "");
                  var link = href
                    ? '<a href="' +
                      safe(href) +
                      '" class="pm-recordLink" data-title="' +
                      safe("Project " + (p.projectKey || p.recordID || "")) +
                      '">' +
                      safe(label) +
                      "</a>"
                    : safe(label);
                  return "<li class='pm-okrItem'>" + link + "</li>";
                })
                .join("") +
              "</ul>"
            : "<div class='pm-okrItem'>No associated projects.</div>";

          var taskList = item.tasks.length
            ? "<ul class='pm-okrList'>" +
              item.tasks
                .map(function (t) {
                  var title = String(t.title || "").trim();
                  var taskLabel =
                    title || (t.recordID ? "Task " + t.recordID : "Task");
                  var projectLabel = getProjectLabelFromKey(t.projectKey);
                  var isComplete = isCompletedStatus(t.status);
                  var statusLabel = isComplete
                    ? '<span class="pm-completeGreen">Completed</span>'
                    : '<span class="pm-okrStatusOpen">In progress</span>';
                  var taskHref = t.recordID
                    ? "index.php?a=printview&recordID=" +
                      encodeURIComponent(t.recordID)
                    : "";
                  var taskLink = taskHref
                    ? '<a href="' +
                      safe(taskHref) +
                      '" class="pm-recordLink" data-title="' +
                      safe("Task " + t.recordID) +
                      '">' +
                      safe(taskLabel) +
                      "</a>"
                    : safe(taskLabel);
                  return (
                    "<li class='pm-okrItem'>" +
                    taskLink +
                    " — " +
                    safe(projectLabel) +
                    " (" +
                    statusLabel +
                    ")" +
                    "</li>"
                  );
                })
                .join("") +
              "</ul>"
            : "<div class='pm-okrItem'>No associated tasks.</div>";

          var completedList = item.completedTasks.length
            ? "<ul class='pm-okrList'>" +
              item.completedTasks
                .map(function (t) {
                  var title = String(t.title || "").trim();
                  var taskLabel =
                    title || (t.recordID ? "Task " + t.recordID : "Task");
                  var projectLabel = getProjectLabelFromKey(t.projectKey);
                  var taskHref = t.recordID
                    ? "index.php?a=printview&recordID=" +
                      encodeURIComponent(t.recordID)
                    : "";
                  var taskLink = taskHref
                    ? '<a href="' +
                      safe(taskHref) +
                      '" class="pm-recordLink" data-title="' +
                      safe("Task " + t.recordID) +
                      '">' +
                      safe(taskLabel) +
                      "</a>"
                    : safe(taskLabel);
                  return (
                    "<li class='pm-okrItem'>" +
                    taskLink +
                    " — " +
                    safe(projectLabel) +
                    "</li>"
                  );
                })
                .join("") +
              "</ul>"
            : "<div class='pm-okrItem'>No completed tasks.</div>";

          return (
            "<div class='pm-okrCard'>" +
            "<div class='pm-okrHeader'>" +
            "<div class='pm-okrKey'>" +
            safe(item.displayKey || item.key) +
            "</div>" +
            "<div class='" +
            pctClass +
            "'>" +
            pctText +
            "%</div>" +
            "</div>" +
            "<div class='pm-okrMetrics'>" +
            "<div class='pm-okrMetric'>" +
            "<div class='pm-okrMetricLabel'>Projects</div>" +
            "<div class='pm-okrMetricValue'>" +
            projectCountText +
            "</div>" +
            "<button type='button' class='pm-okrToggle' data-target='" +
            projId +
            "' data-label='Projects' data-okr='" +
            okrLabel +
            "' aria-expanded='false' aria-controls='" +
            projId +
            "' aria-label='Expand Projects for OKR " +
            okrLabel +
            "'>Expand</button>" +
            "<div class='pm-okrDetails' id='" +
            projId +
            "' role='region' aria-label='Projects for OKR " +
            okrLabel +
            "' aria-hidden='true' hidden>" +
            projectList +
            "</div>" +
            "</div>" +
            "<div class='pm-okrMetric'>" +
            "<div class='pm-okrMetricLabel'>Total Tasks</div>" +
            "<div class='pm-okrMetricValue'>" +
            totalTasksText +
            "</div>" +
            "<button type='button' class='pm-okrToggle' data-target='" +
            tasksId +
            "' data-label='Total Tasks' data-okr='" +
            okrLabel +
            "' aria-expanded='false' aria-controls='" +
            tasksId +
            "' aria-label='Expand Total Tasks for OKR " +
            okrLabel +
            "'>Expand</button>" +
            "<div class='pm-okrDetails' id='" +
            tasksId +
            "' role='region' aria-label='Total Tasks for OKR " +
            okrLabel +
            "' aria-hidden='true' hidden>" +
            taskList +
            "</div>" +
            "</div>" +
            "<div class='pm-okrMetric'>" +
            "<div class='pm-okrMetricLabel'>Completed Tasks</div>" +
            "<div class='pm-okrMetricValue'>" +
            completedTasksText +
            "</div>" +
            "<button type='button' class='pm-okrToggle' data-target='" +
            completedId +
            "' data-label='Completed Tasks' data-okr='" +
            okrLabel +
            "' aria-expanded='false' aria-controls='" +
            completedId +
            "' aria-label='Expand Completed Tasks for OKR " +
            okrLabel +
            "'>Expand</button>" +
            "<div class='pm-okrDetails' id='" +
            completedId +
            "' role='region' aria-label='Completed Tasks for OKR " +
            okrLabel +
            "' aria-hidden='true' hidden>" +
            completedList +
            "</div>" +
            "</div>" +
            "</div>" +
            "</div>"
          );
        })
        .join("");
    }

    var labels = items.map(function (i) {
      return i.key || i.displayKey;
    });
    var percentData = items.map(function (i) {
      return i.percent || 0;
    });
    var completedData = items.map(function (i) {
      return i.completedTasksCount || 0;
    });
    var remainingData = items.map(function (i) {
      return i.remainingTasksCount || 0;
    });
    setChartSummary(
      "pmChartOkrAchievedDesc",
      "OKR percent achieved: " +
        (labels.length
          ? summarizeLabelData(labels, percentData)
          : "No data."),
    );
    setChartSummary(
      "pmChartOkrTasksDesc",
      "OKR tasks completed vs remaining: " +
        (labels.length
          ? summarizeStacked(
              labels,
              completedData,
              remainingData,
              "Completed",
              "Remaining",
            )
          : "No data."),
    );

    if (state.charts.okrAchieved) {
      state.charts.okrAchieved.destroy();
      state.charts.okrAchieved = null;
    }
    if (state.charts.okrTasks) {
      state.charts.okrTasks.destroy();
      state.charts.okrTasks = null;
    }

    var ctxAchieved = sizeChartBox(
      "pmChartOkrAchieved",
      labels.length || 1,
    );
    if (ctxAchieved && window.Chart) {
      state.charts.okrAchieved = new Chart(ctxAchieved, {
        type: getHorizontalBarType(),
        data: {
          labels: labels.length ? labels : ["No OKRs"],
          datasets: [
            {
              label: "% Achieved",
              data: labels.length ? percentData : [0],
              backgroundColor: "#aacdec",
            },
          ],
        },
        options: buildHorizontalBarOptions(),
      });
    }

    var ctxTasks = sizeChartBox("pmChartOkrTasks", labels.length || 1);
    if (ctxTasks && window.Chart) {
      state.charts.okrTasks = new Chart(ctxTasks, {
        type: getHorizontalBarType(),
        data: {
          labels: labels.length ? labels : ["No OKRs"],
          datasets: [
            {
              label: "Completed",
              data: labels.length ? completedData : [0],
              backgroundColor: "#719f2a",
            },
            {
              label: "Remaining",
              data: labels.length ? remainingData : [0],
              backgroundColor: "#e6c74c",
            },
          ],
        },
        options: buildStackedHorizontalOptions(),
      });
    }
  }

  function renderTasksTable(tasks) {
    var el = document.getElementById("pmTasksTable");
    if (!el) return;

    var now = new Date();
    var rows = tasks
      .slice(0, 500)
      .map(function (t) {
        var pkHref = getProjectRecordHrefFromKey(t.projectKey);
        var pkLink = pkHref
          ? '<a href="' +
            safe(pkHref) +
            '" class="pm-recordLink" data-title="' +
            safe("Project " + t.projectKey) +
            '">' +
            safe(t.projectKey) +
            "</a>"
          : safe(t.projectKey);

        var taskLink = t.href
          ? '<a href="' +
            safe(t.href) +
            '" class="pm-recordLink pm-taskIdBadge" data-title="' +
            safe("Task " + t.recordID) +
            '">' +
            safe(t.recordID) +
            "</a>"
          : '<span class="pm-taskIdBadge">' + safe(t.recordID) + "</span>";

        var overdueClass = isOverdueTask(t, now) ? "pm-overdueRed" : "";

        return (
          "<tr>" +
          "<td>" +
          pkLink +
          "</td>" +
          "<td>" +
          taskLink +
          "</td>" +
          '<td class="pm-wrapCol">' +
          safe(t.title) +
          "</td>" +
          "<td>" +
          safe(t.status) +
          "</td>" +
          "<td>" +
          renderDepsList(t.depIds) +
          "</td>" +
          "<td>" +
          getPriorityPill(t.priority) +
          "</td>" +
          "<td>" +
          safe(t.category) +
          "</td>" +
          "<td>" +
          safe(t.assignedTo) +
          "</td>" +
          "<td>" +
          safe(t.start) +
          "</td>" +
          '<td class="' +
          overdueClass +
          '">' +
          safe(t.due) +
          "</td>" +
          "<td>" +
          supportTicketLink(t.supportTicket) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    el.innerHTML =
      '<table class="pm-table">' +
      "<thead><tr>" +
      '<th scope="col" class="pm-sortable" data-sort="projectKey" data-type="string"><button type="button" class="pm-sortBtn">Project Key</button></th>' +
      '<th scope="col" class="pm-sortable" data-sort="recordID" data-type="number"><button type="button" class="pm-sortBtn">Task ID</button></th>' +
      '<th scope="col" class="pm-sortable pm-wrapCol" data-sort="title" data-type="string"><button type="button" class="pm-sortBtn">Title</button></th>' +
      '<th scope="col" class="pm-sortable" data-sort="status" data-type="string"><button type="button" class="pm-sortBtn">Status</button></th>' +
      '<th scope="col" class="pm-sortable" data-sort="dependencies" data-type="string"><button type="button" class="pm-sortBtn">Dependencies</button></th>' +
      '<th scope="col" class="pm-sortable" data-sort="priority" data-type="string"><button type="button" class="pm-sortBtn">Priority</button></th>' +
      '<th scope="col" class="pm-sortable" data-sort="category" data-type="string"><button type="button" class="pm-sortBtn">Category</button></th>' +
      '<th scope="col" class="pm-sortable" data-sort="assignedTo" data-type="string"><button type="button" class="pm-sortBtn">Assigned To</button></th>' +
      '<th scope="col" class="pm-sortable" data-sort="start" data-type="date"><button type="button" class="pm-sortBtn">Start</button></th>' +
      '<th scope="col" class="pm-sortable" data-sort="due" data-type="date"><button type="button" class="pm-sortBtn">Due</button></th>' +
      '<th scope="col" class="pm-sortable" data-sort="supportTicket" data-type="string"><button type="button" class="pm-sortBtn">Ticket</button></th>' +
      "</tr></thead>" +
      "<tbody>" +
      rows +
      "</tbody>" +
      "</table>";

    var s = state.sort.tasks;
    setSortIndicator("pmTasksTable", s.key, s.dir);
  }

  function renderProjectHealthSticky(activeTab, selectedProjectKey) {
    var wrap = document.getElementById("pmProjectHealthSticky");
    if (!wrap) return;

    var key = String(selectedProjectKey || "").trim();
    if (activeTab !== "tasks" || !key) {
      wrap.style.display = "none";
      wrap.innerHTML = "";
      return;
    }

    var title = String(state.projectKeyToTitle[key] || "").trim();
    if (!title) title = "{no project title}";
    var tasksForProject = state.tasksAll.filter(function (t) {
      return String(t.projectKey || "").trim() === key;
    });

    var total = tasksForProject.length;
    var completed = 0;
    var overdue = 0;
    var now = new Date();

    tasksForProject.forEach(function (t) {
      var st = String(t.status || "").toLowerCase();
      if (st.indexOf("completed") !== -1) completed += 1;
      if (isOverdueTask(t, now)) overdue += 1;
    });

    var compPct = total ? Math.round((completed / total) * 100) : 0;
    var compClass =
      compPct === 100 ? "pm-healthValue pm-completeGreen" : "pm-healthValue";
    var overdueClass =
      overdue > 0 ? "pm-healthValue pm-overdueRed" : "pm-healthValue";

    wrap.style.display = "block";
    wrap.innerHTML =
      '<div class="pm-healthInner">' +
      '<div class="pm-healthCell"><span class="pm-healthLabel">Project Key:</span> <span class="pm-healthValue">' +
      safe(key) +
      "</span></div>" +
      '<div class="pm-healthCell"><span class="pm-healthLabel">Project Title:</span> <span class="pm-healthValue">' +
      safe(title) +
      "</span></div>" +
      '<div class="pm-healthCell"><span class="pm-healthLabel">Total Tasks:</span> <span class="pm-healthValue">' +
      total +
      "</span></div>" +
      '<div class="pm-healthCell"><span class="pm-healthLabel">Completed:</span> <span class="pm-healthValue">' +
      completed +
      "</span></div>" +
      '<div class="pm-healthCell"><span class="pm-healthLabel">Completed percent:</span> <span class="' +
      compClass +
      '">' +
      compPct +
      "%</span></div>" +
      '<div class="pm-healthCell"><span class="pm-healthLabel">Overdue:</span> <span class="' +
      overdueClass +
      '">' +
      overdue +
      "</span></div>" +
      "</div>";
  }

  function normalizeStatus(s) {
    var v = String(s || "").trim();
    return v ? v : "Unspecified";
  }

  function getKanbanColumnsOrdered() {
    var cols =
      state.statusOptionsOrdered && state.statusOptionsOrdered.length
        ? state.statusOptionsOrdered.slice()
        : STATUS_OPTIONS_FALLBACK.slice();

    var found = {};
    state.tasksAll.forEach(function (t) {
      var st = normalizeStatus(t.status);
      if (st && st !== "Unspecified") found[st] = true;
    });

    Object.keys(found).forEach(function (st) {
      if (isArchivedStatus(st)) return;
      if (cols.indexOf(st) === -1) cols.push(st);
    });

    return cols.filter(function (st) {
      return !isArchivedStatus(st);
    });
  }

  async function updateTaskStatus(recordID, newStatus) {
    if (!recordID) throw new Error("Missing recordID");
    var token = await ensureCSRFToken(recordID);
    if (!token) throw new Error("Missing CSRFToken");
    var tokenField = state.csrfField || getCSRFFieldName();

    var url = FORM_POST_ENDPOINT_PREFIX + encodeURIComponent(recordID);
    var bodyObj = {
      10: newStatus,
      recordID: recordID,
      series: 1,
    };
    bodyObj[tokenField] = token;
    var body = encodeFormBody(bodyObj);

    var r = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-requested-with": "XMLHttpRequest",
        "x-csrf-token": token,
        "x-xsrf-token": token,
      },
      credentials: "include",
      body: body,
    });

    if (!r.ok) throw new Error("Update failed HTTP " + r.status);
    return true;
  }

  async function createTaskRecord() {
    var token = await ensureCSRFToken();
    var tokenField = state.csrfField || getCSRFFieldName();

    var fd = new FormData();
    if (token) {
      fd.append(tokenField, token);
    } else {
      console.warn("Missing CSRFToken. Attempting create without token.");
      showTransferDebug("Missing CSRFToken. Attempting create without token.");
    }
    fd.append("numform_9b302", "1");
    fd.append("title", "Record");

    var headers = { "x-requested-with": "XMLHttpRequest" };
    if (token) {
      headers["x-csrf-token"] = token;
      headers["x-xsrf-token"] = token;
    }

    var r = await fetch("/platform/projects/api/form/new", {
      method: "POST",
      credentials: "include",
      headers: headers,
      body: fd,
    });

    if (!r.ok) throw new Error("Create failed HTTP " + r.status);

    var text = await r.text();
    var newId;
    try {
      newId = JSON.parse(text);
    } catch (e) {
      newId = text;
    }
    newId = String(newId || "")
      .trim()
      .replace(/^\"|\"$/g, "");
    if (!newId) throw new Error("Missing recordID");
    return newId;
  }

  async function setSupportTicketIndicator(recordID, sourceId, sourceType) {
    if (!recordID) throw new Error("Missing recordID");
    var token = await ensureCSRFToken(recordID);
    var tokenField = state.csrfField || getCSRFFieldName();

    var url = FORM_POST_ENDPOINT_PREFIX + encodeURIComponent(recordID);
    var bodyObj = {
      recordID: recordID,
      series: 1,
    };
    var label = (sourceType === "ux" ? "UX Ticket #" : "Support Ticket #") + sourceId;
    bodyObj[TASK_IND.supportTicket] = label;
    if (token) {
      bodyObj[tokenField] = token;
    } else {
      console.warn("Missing CSRFToken. Attempting update without token.");
      showTransferDebug("Missing CSRFToken. Attempting update without token.");
    }
    var body = encodeFormBody(bodyObj);

    var headers = {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-requested-with": "XMLHttpRequest",
    };
    if (token) {
      headers["x-csrf-token"] = token;
      headers["x-xsrf-token"] = token;
    }

    var r = await fetch(url, {
      method: "POST",
      headers: headers,
      credentials: "include",
      body: body,
    });

    if (!r.ok) throw new Error("Update failed HTTP " + r.status);
    return true;
  }

  async function handleTransferFromSupport() {
    if (state.transferInProgress) return;
    var supportId = getQueryParam("transferFromSupport");
    var uxId = getQueryParam("transferFromUX");
    var legacyId = getQueryParam("transferFromSandbox");
    var sourceId = supportId || uxId || legacyId;
    var sourceType = uxId ? "ux" : "support";
    var sourceLabel = sourceType === "ux" ? "UX" : "Support";
    if (!sourceId) return;
    sourceId = String(sourceId || "").trim();
    if (!sourceId) return;

    showTransferDebug("Transfer detected for " + sourceLabel + " " + sourceId);
    state.transferInProgress = true;
    try {
      showTransferDebug("Creating Task");
      var newRecordID = await createTaskRecord();
      await setSupportTicketIndicator(newRecordID, sourceId, sourceType);

      var params = new URLSearchParams(window.location.search || "");
      params.delete("transferFromUX");
      params.delete("transferFromSupport");
      params.delete("transferFromSandbox");
      var nextUrl =
        window.location.pathname +
        (params.toString() ? "?" + params.toString() : "") +
        window.location.hash;
      history.replaceState({}, "", nextUrl);

      setActiveTab("tasks");
      openModal(
        "Task " + newRecordID,
        "index.php?a=printview&recordID=" + encodeURIComponent(newRecordID),
      );
      showTransferDebug("Transfer complete. Task " + newRecordID);
    } catch (e) {
      showTransferDebug("Transfer failed. Check console for details.");
      console.error("Transfer from " + sourceLabel + " failed.", e);
    } finally {
      state.transferInProgress = false;
    }
  }

  function renderKanban(tasks) {
    var board = document.getElementById("pmKanbanBoard");
    if (!board) return;

    var cols = getKanbanColumnsOrdered().filter(function (col) {
      return (
        String(col || "")
          .toLowerCase()
          .indexOf("archive") === -1
      );
    });
    state.kanbanColumns = cols.slice();
    var grouped = {};
    cols.forEach(function (c) {
      grouped[c] = [];
    });

    tasks.forEach(function (t) {
      var st = normalizeStatus(t.status);
      if (!grouped[st]) grouped[st] = [];
      grouped[st].push(t);
    });

    board.innerHTML = cols
      .map(function (col) {
        var colTasks = grouped[col] || [];

        var cards = colTasks
          .map(function (t) {
            var pkHref = getProjectRecordHrefFromKey(t.projectKey);
            var pkLink = pkHref
              ? '<a href="' +
                safe(pkHref) +
                '" class="pm-recordLink" data-title="' +
                safe("Project " + t.projectKey) +
                '">' +
                safe(t.projectKey) +
                "</a>"
              : safe(t.projectKey);

            var taskHref = t.href || "";
            var taskLink = taskHref
              ? '<a href="' +
                safe(taskHref) +
                '" class="pm-recordLink pm-taskIdBadge" data-title="' +
                safe("Task " + t.recordID) +
                '">' +
                safe(t.recordID) +
                "</a>"
              : '<span class="pm-taskIdBadge">' + safe(t.recordID) + "</span>";
            var ticketLink = supportTicketLink(t.supportTicket);

            var cardLabel =
              "Task " +
              String(t.recordID || "") +
              ": " +
              String(t.title || "(No title)") +
              ". Status " +
              String(col || "");

            return (
              "" +
              '<div class="pm-card" draggable="true" data-taskid="' +
              safe(t.recordID) +
              '" data-status="' +
              safe(col) +
              '" tabindex="0" role="group" aria-label="' +
              safeAttr(cardLabel) +
              '" aria-describedby="pmKanbanHint">' +
              '<div class="pm-card-title">' +
              safe(t.title || "(No title)") +
              "</div>" +
              '<div class="pm-card-meta">' +
              "<div><strong>Task ID:</strong> " +
              taskLink +
              "</div>" +
              "<div><strong>Project:</strong> " +
              pkLink +
              "</div>" +
              "<div><strong>Priority:</strong> " +
              getPriorityPill(t.priority) +
              "</div>" +
              "<div><strong>Dependencies:</strong> " +
              renderDepsList(t.depIds) +
              "</div>" +
              "<div><strong>Assigned:</strong> " +
              safe(t.assignedTo) +
              "</div>" +
              "<div><strong>Start:</strong> " +
              safe(t.start) +
              "</div>" +
              "<div><strong>Due:</strong> " +
              safe(t.due) +
              "</div>" +
              (ticketLink
                ? "<div><strong>Ticket:</strong> " + ticketLink + "</div>"
                : "") +
              "</div>" +
              "</div>"
            );
          })
          .join("");

        return (
          "" +
          '<div class="pm-kanban-col">' +
          '<div class="pm-kanban-col-header"><span>' +
          safe(col) +
          "</span><span>" +
          colTasks.length +
          "</span></div>" +
          '<div class="pm-kanban-col-body" data-status="' +
          safe(col) +
          '">' +
          (cards || '<div class="pm-card-meta">No tasks</div>') +
          "</div>" +
          "</div>"
        );
      })
      .join("");

    wireKanbanDnD();
  }

  function announceKanbanStatus(msg) {
    var el = document.getElementById("pmKanbanStatusMsg");
    if (el) el.textContent = msg || "";
  }

  function focusKanbanCard(taskId) {
    if (!taskId) return;
    var selector =
      '.pm-card[data-taskid="' +
      String(taskId).replace(/"/g, '\\"') +
      '"]';
    var card = document.querySelector(selector);
    if (card) card.focus();
  }

  function formatDateShort(d) {
    if (!d) return "";
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    var yyyy = d.getFullYear();
    return mm + "/" + dd + "/" + yyyy;
  }

  function ganttPriorityClass(priority) {
    var p = String(priority || "").toLowerCase();
    if (p === "high") return "pm-ganttHigh";
    if (p === "medium") return "pm-ganttMed";
    if (p === "low") return "pm-ganttLow";
    return "pm-ganttNone";
  }

  function renderGantt(tasks) {
    var wrap = document.getElementById("pmGanttInner");
    var meta = document.getElementById("pmGanttMeta");
    if (!wrap || !meta) return;

    tasks = (tasks || []).filter(function (t) {
      return !isArchivedStatus(t.status);
    });

    if (!tasks || !tasks.length) {
      meta.textContent = "No tasks to display.";
      wrap.innerHTML = "";
      return;
    }

    var rows = tasks
      .slice()
      .sort(function (a, b) {
        var sa = mmddyyyyToDate(a.start) || mmddyyyyToDate(a.due);
        var sb = mmddyyyyToDate(b.start) || mmddyyyyToDate(b.due);
        var da = sa || new Date(8640000000000000);
        var db = sb || new Date(8640000000000000);
        return da - db;
      })
      .map(function (t) {
        var start = mmddyyyyToDate(t.start) || null;
        var due = mmddyyyyToDate(t.due) || null;
        var s = start || due;
        var e = due || start;
        return { task: t, start: s, end: e };
      });

    var visibleRows = rows.filter(function (row) {
      return row.start || row.end;
    });
    var hiddenCount = rows.length - visibleRows.length;

    if (!visibleRows.length) {
      meta.textContent =
        "No tasks with dates to display." +
        (hiddenCount ? " " + hiddenCount + " hidden without dates." : "");
      wrap.innerHTML = "";
      return;
    }

    var rangeStart = null;
    var rangeEnd = null;

    visibleRows.forEach(function (row) {
      if (!rangeStart || row.start < rangeStart) rangeStart = row.start;
      if (!rangeEnd || row.end > rangeEnd) rangeEnd = row.end;
    });

    var rangeDays = 1;
    if (rangeStart && rangeEnd) {
      rangeDays = Math.max(
        1,
        Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000),
      );
    }

    var metaParts = ["Showing " + visibleRows.length + " tasks."];
    if (rangeStart && rangeEnd) {
      metaParts.push(
        "Range: " +
          formatDateShort(rangeStart) +
          " – " +
          formatDateShort(rangeEnd) +
          ".",
      );
    } else {
      metaParts.push("No dated tasks to scale.");
    }
    if (hiddenCount) metaParts.push(hiddenCount + " hidden without dates.");
    meta.textContent = metaParts.join(" ");

    wrap.innerHTML = visibleRows
      .map(function (row) {
        var t = row.task;
        var start = row.start;
        var end = row.end;
        var hasDates = !!(start && end && rangeStart && rangeEnd);

        var leftPct = 0;
        var widthPct = 0;
        var barStyle = "";

        if (hasDates) {
          var startOffset = Math.round(
            (start.getTime() - rangeStart.getTime()) / 86400000,
          );
          var durationDays = Math.max(
            1,
            Math.round((end.getTime() - start.getTime()) / 86400000) || 1,
          );
          leftPct = (startOffset / rangeDays) * 100;
          widthPct = (durationDays / rangeDays) * 100;
          if (widthPct < 1.5) widthPct = 1.5;
          barStyle =
            "left:" +
            leftPct.toFixed(2) +
            "%;width:" +
            widthPct.toFixed(2) +
            "%;";
        }

        var title = safe(t.title || "(No title)");
        var pk = safe(t.projectKey || "");
        var id = safe(t.recordID || "");
        var ticketLink = supportTicketLink(t.supportTicket);
        var dateLabel =
          safe(t.start || "No start") + " → " + safe(t.due || "No due");

        return (
          '<div class="pm-ganttRow">' +
          '<div class="pm-ganttTop">' +
          '<div class="pm-ganttName">' +
          title +
          "</div>" +
          '<div class="pm-ganttDates">' +
          dateLabel +
          "</div>" +
          "</div>" +
          '<div class="pm-card-meta">Task ID: ' +
          id +
          " · Project: " +
          pk +
          (ticketLink ? " · " + ticketLink : "") +
          "</div>" +
          '<div class="pm-ganttBarWrap">' +
          '<div class="pm-ganttBar ' +
          ganttPriorityClass(t.priority) +
          '" style="' +
          barStyle +
          '"></div>' +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function wireKanbanDnD() {
    var draggingId = null;

    document
      .querySelectorAll(".pm-card[draggable='true']")
      .forEach(function (card) {
        card.addEventListener("dragstart", function (e) {
          draggingId = card.getAttribute("data-taskid");
          card.classList.add("is-dragging");
          try {
            e.dataTransfer.setData("text/plain", draggingId);
          } catch (err) {}
        });

        card.addEventListener("dragend", function () {
          draggingId = null;
          card.classList.remove("is-dragging");
          document
            .querySelectorAll(".pm-kanban-col-body")
            .forEach(function (b) {
              b.classList.remove("is-over");
            });
        });

        card.addEventListener("keydown", async function (e) {
          if (!e.shiftKey) return;
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();

          var cols = state.kanbanColumns || [];
          var currentStatus = card.getAttribute("data-status") || "";
          var idxCol = cols.indexOf(currentStatus);
          if (idxCol === -1) return;
          var nextIdx = e.key === "ArrowLeft" ? idxCol - 1 : idxCol + 1;
          if (nextIdx < 0 || nextIdx >= cols.length) return;

          var newStatus = cols[nextIdx];
          var id = card.getAttribute("data-taskid");
          if (!id || !newStatus) return;

          var idx = state.tasksAll.findIndex(function (t) {
            return String(t.recordID) === String(id);
          });
          if (idx === -1) return;

          var oldStatus = state.tasksAll[idx].status;
          state.tasksAll[idx].status = newStatus;
          applySearchAndFilters(true);
          announceKanbanStatus(
            "Moved task " + id + " to " + newStatus + ".",
          );
          requestAnimationFrame(function () {
            focusKanbanCard(id);
          });

          try {
            await updateTaskStatus(id, newStatus);
          } catch (err3) {
            state.tasksAll[idx].status = oldStatus;
            applySearchAndFilters(true);
            announceKanbanStatus(
              "Could not update task " + id + ". " + String(err3),
            );
            alert("Could not update task status. " + String(err3));
          }
        });
      });

    document.querySelectorAll(".pm-kanban-col-body").forEach(function (body) {
      body.addEventListener("dragover", function (e) {
        e.preventDefault();
        body.classList.add("is-over");
      });

      body.addEventListener("dragleave", function () {
        body.classList.remove("is-over");
      });

      body.addEventListener("drop", async function (e) {
        e.preventDefault();
        body.classList.remove("is-over");

        var newStatus = body.getAttribute("data-status") || "";
        var id = draggingId;
        if (!id) {
          try {
            id = e.dataTransfer.getData("text/plain");
          } catch (err2) {}
        }
        if (!id || !newStatus) return;

        var idx = state.tasksAll.findIndex(function (t) {
          return String(t.recordID) === String(id);
        });
        if (idx === -1) return;

        var oldStatus = state.tasksAll[idx].status;

        state.tasksAll[idx].status = newStatus;
        applySearchAndFilters(true);

        try {
          await updateTaskStatus(id, newStatus);
        } catch (err3) {
          state.tasksAll[idx].status = oldStatus;
          applySearchAndFilters(true);
          alert("Could not update task status. " + String(err3));
        }
      });
    });
  }

  function mmddyyyyToDate(s) {
    var v = String(s || "").trim();
    if (!v) return null;
    var d = new Date(v);
    if (!isNaN(d.getTime())) return d;
    var parts = v.split("/");
    if (parts.length !== 3) return null;
    var mm = parseInt(parts[0], 10) - 1;
    var dd = parseInt(parts[1], 10);
    var yyyy = parseInt(parts[2], 10);
    var d2 = new Date(yyyy, mm, dd);
    return isNaN(d2.getTime()) ? null : d2;
  }

  function isCompletedStatus(status) {
    var st = String(status || "").toLowerCase();
    return (
      st.indexOf("completed") !== -1 ||
      st.indexOf("complete") !== -1 ||
      st.indexOf("done") !== -1 ||
      st.indexOf("closed") !== -1
    );
  }

  function isOverdueTask(t, now) {
    var st = String(t.status || "").toLowerCase();
    if (isCompletedStatus(st) || st.indexOf("archive") !== -1) return false;
    var due = mmddyyyyToDate(t.due);
    return !!(due && due.getTime() < now.getTime());
  }

  function isArchivedStatus(status) {
    return (
      String(status || "")
        .toLowerCase()
        .indexOf("archive") !== -1
    );
  }

  function getCompletionDateForTask(t) {
    return mmddyyyyToDate(t.due) || mmddyyyyToDate(t.start) || null;
  }

  function parseLeafDate(value) {
    if (value == null || value === "") return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    var str = String(value).trim();
    if (!str) return null;

    if (/^\d+$/.test(str)) {
      var num = Number(str);
      if (!isFinite(num)) return null;
      if (num < 1000000000000) num = num * 1000;
      var d = new Date(num);
      return isNaN(d.getTime()) ? null : d;
    }

    return mmddyyyyToDate(str) || parseDateLoose(str);
  }

  function getTaskGeneralDate(t) {
    return parseLeafDate(t.due || t.start || t.createdAt) || null;
  }

  function getProjectGeneralDate(p) {
    return parseLeafDate(p.createdAt) || null;
  }

  function getTicketImportedDate(t) {
    return parseLeafDate(t.createdAt || t.start) || null;
  }

  // Accessibility: enable keyboard navigation in tablists.
  function handleTablistKeydown(e, tabs, activate) {
    var keys = [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
    ];
    if (keys.indexOf(e.key) === -1) return;
    var idx = tabs.indexOf(e.currentTarget);
    if (idx === -1) return;
    var nextIdx = idx;
    if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = tabs.length - 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      nextIdx = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "ArrowRight" || e.key === "ArrowDown")
      nextIdx = (idx + 1) % tabs.length;
    if (nextIdx === idx) return;
    e.preventDefault();
    tabs[nextIdx].focus();
    activate(tabs[nextIdx]);
  }

  function wireTabs() {
    var tabs = Array.from(document.querySelectorAll(".pm-tab[data-tab]"));
    tabs.forEach(function (btn) {
      btn.addEventListener("click", function () {
        setActiveTab(btn.getAttribute("data-tab"));
      });
      btn.addEventListener("keydown", function (e) {
        handleTablistKeydown(e, tabs, function (tab) {
          setActiveTab(tab.getAttribute("data-tab"));
        });
      });
    });
  }

  function setActiveTab(tabName) {
    var tabs = Array.from(document.querySelectorAll(".pm-tab[data-tab]"));
    tabs.forEach(function (b) {
      b.classList.remove("is-active");
      b.setAttribute("aria-selected", "false");
      b.setAttribute("tabindex", "-1");
    });

    var target = tabs.find(function (b) {
      return b.getAttribute("data-tab") === tabName;
    });
    if (target) {
      target.classList.add("is-active");
      target.setAttribute("aria-selected", "true");
      target.setAttribute("tabindex", "0");
    }

    document.querySelectorAll(".pm-panel").forEach(function (p) {
      var isActive = p.id === "pmTab-" + tabName;
      p.classList.toggle("is-active", isActive);
      p.setAttribute("aria-hidden", isActive ? "false" : "true");
    });
    var panel = document.getElementById("pmTab-" + tabName);
    if (panel) panel.classList.add("is-active");

    localStorage.setItem(STORAGE_KEYS.activeTab, tabName);

    applySearchAndFilters(true);
    requestAnimationFrame(function () {
      applySearchAndFilters(false);
    });
  }

  function wireTaskViewToggle() {
    var btnTable = document.getElementById("pmViewTableBtn");
    var btnKanban = document.getElementById("pmViewKanbanBtn");
    var btnGantt = document.getElementById("pmViewGanttBtn");
    var wrapTable = document.getElementById("pmTasksTableWrap");
    var wrapKanban = document.getElementById("pmKanbanWrap");
    var wrapGantt = document.getElementById("pmGanttWrap");
    if (
      !btnTable ||
      !btnKanban ||
      !btnGantt ||
      !wrapTable ||
      !wrapKanban ||
      !wrapGantt
    )
      return;

    function setView(view) {
      var isTable = view === "table";
      var isKanban = view === "kanban";
      var isGantt = view === "gantt";

      wrapTable.style.display = isTable ? "block" : "none";
      wrapKanban.style.display = isKanban ? "block" : "none";
      wrapGantt.style.display = isGantt ? "block" : "none";

      wrapTable.hidden = !isTable;
      wrapKanban.hidden = !isKanban;
      wrapGantt.hidden = !isGantt;

      wrapTable.setAttribute("aria-hidden", isTable ? "false" : "true");
      wrapKanban.setAttribute("aria-hidden", isKanban ? "false" : "true");
      wrapGantt.setAttribute("aria-hidden", isGantt ? "false" : "true");

      btnTable.classList.toggle("is-active", isTable);
      btnKanban.classList.toggle("is-active", isKanban);
      btnGantt.classList.toggle("is-active", isGantt);

      btnTable.setAttribute("aria-selected", isTable ? "true" : "false");
      btnKanban.setAttribute("aria-selected", isKanban ? "true" : "false");
      btnGantt.setAttribute("aria-selected", isGantt ? "true" : "false");

      btnTable.setAttribute("tabindex", isTable ? "0" : "-1");
      btnKanban.setAttribute("tabindex", isKanban ? "0" : "-1");
      btnGantt.setAttribute("tabindex", isGantt ? "0" : "-1");

      localStorage.setItem(STORAGE_KEYS.tasksView, view);
      applySearchAndFilters(true);
    }

    btnTable.addEventListener("click", function () {
      setView("table");
    });
    btnKanban.addEventListener("click", function () {
      setView("kanban");
    });
    btnGantt.addEventListener("click", function () {
      setView("gantt");
    });

    var tabs = [btnTable, btnKanban, btnGantt];
    tabs.forEach(function (btn) {
      btn.addEventListener("keydown", function (e) {
        handleTablistKeydown(e, tabs, function (tab) {
          if (tab === btnTable) setView("table");
          else if (tab === btnKanban) setView("kanban");
          else setView("gantt");
        });
      });
    });

    var initial = localStorage.getItem(STORAGE_KEYS.tasksView) || "table";
    setView(initial);
  }

  function wireAnalyticsViewToggle() {
    var btnMain = document.getElementById("pmAnalyticsViewMainBtn");
    var btnOkrs = document.getElementById("pmAnalyticsViewOkrsBtn");
    var wrapMain = document.getElementById("pmAnalyticsWrap");
    var wrapOkrs = document.getElementById("pmOkrsAnalyticsWrap");
    if (!btnMain || !btnOkrs || !wrapMain || !wrapOkrs) return;

    function setView(view) {
      var isMain = view === "main";
      var isOkrs = view === "okrs";

      wrapMain.style.display = isMain ? "block" : "none";
      wrapOkrs.style.display = isOkrs ? "block" : "none";

      wrapMain.hidden = !isMain;
      wrapOkrs.hidden = !isOkrs;

      wrapMain.setAttribute("aria-hidden", isMain ? "false" : "true");
      wrapOkrs.setAttribute("aria-hidden", isOkrs ? "false" : "true");

      btnMain.classList.toggle("is-active", isMain);
      btnOkrs.classList.toggle("is-active", isOkrs);

      btnMain.setAttribute("aria-selected", isMain ? "true" : "false");
      btnOkrs.setAttribute("aria-selected", isOkrs ? "true" : "false");

      btnMain.setAttribute("tabindex", isMain ? "0" : "-1");
      btnOkrs.setAttribute("tabindex", isOkrs ? "0" : "-1");

      localStorage.setItem(STORAGE_KEYS.analyticsView, view);
      applySearchAndFilters(true);
    }

    btnMain.addEventListener("click", function () {
      setView("main");
    });
    btnOkrs.addEventListener("click", function () {
      setView("okrs");
    });

    var tabs = [btnMain, btnOkrs];
    tabs.forEach(function (btn) {
      btn.addEventListener("keydown", function (e) {
        handleTablistKeydown(e, tabs, function (tab) {
          setView(tab === btnMain ? "main" : "okrs");
        });
      });
    });

    var initial = localStorage.getItem(STORAGE_KEYS.analyticsView) || "main";
    setView(initial);
  }

  function wireSortingDelegation() {
    var projectsContainer = document.getElementById("pmProjectsTable");
    if (projectsContainer) {
      projectsContainer.addEventListener("click", function (e) {
        var th = e.target.closest(".pm-sortable");
        if (!th) return;
        var key = th.getAttribute("data-sort");
        var type = th.getAttribute("data-type") || "string";
        if (!key) return;

        var s = state.sort.projects;
        if (s.key === key) s.dir *= -1;
        else {
          s.key = key;
          s.dir = 1;
          s.type = type;
        }

        applySearchAndFilters(true);
      });
    }

    var tasksContainer = document.getElementById("pmTasksTable");
    if (tasksContainer) {
      tasksContainer.addEventListener("click", function (e) {
        var th = e.target.closest(".pm-sortable");
        if (!th) return;
        var key = th.getAttribute("data-sort");
        var type = th.getAttribute("data-type") || "string";
        if (!key) return;

        var s2 = state.sort.tasks;
        if (s2.key === key) s2.dir *= -1;
        else {
          s2.key = key;
          s2.dir = 1;
          s2.type = type;
        }

        applySearchAndFilters(true);
      });
    }

    var okrsContainer = document.getElementById("pmOkrsTable");
    if (okrsContainer) {
      okrsContainer.addEventListener("click", function (e) {
        var th = e.target.closest(".pm-sortable");
        if (!th) return;
        var key = th.getAttribute("data-sort");
        var type = th.getAttribute("data-type") || "string";
        if (!key) return;

        var s3 = state.sort.okrs;
        if (s3.key === key) s3.dir *= -1;
        else {
          s3.key = key;
          s3.dir = 1;
          s3.type = type;
        }

        applySearchAndFilters(true);
      });
    }
  }

  function populateProjectKeyDropdown(projects) {
    var sel = document.getElementById("pmProjectKeySelect");
    if (!sel) return;
    var cleaned = projects
      .filter(function (p) {
        return (
          (p.projectKey || "").trim() !== "" ||
          (p.projectName || "").trim() !== ""
        );
      })
      .sort(function (a, b) {
        return (a.projectKey || "").localeCompare(b.projectKey || "");
      });

    sel.innerHTML = '<option value="">All Projects</option>';
    cleaned.forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p.projectKey || "";
      opt.textContent =
        p.projectKey && p.projectName
          ? p.projectKey + " | " + p.projectName
          : p.projectKey || p.projectName || "";
      sel.appendChild(opt);
    });
  }

  function populateProjectFiscalYearDropdown(projects) {
    var sel = document.getElementById("pmProjectFiscalYearSelect");
    if (!sel) return;
    var vals = Array.from(
      new Set(
        (projects || [])
          .map(function (p) {
            return String(p.projectFiscalYear || "").trim();
          })
          .filter(Boolean),
      ),
    ).sort(function (a, b) {
      return a.localeCompare(b, undefined, { numeric: true });
    });

    sel.innerHTML = '<option value="">All Fiscal Years</option>';
    vals.forEach(function (v) {
      var opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    });
  }

  function populateOkrFiscalYearDropdown(projects) {
    var sel = document.getElementById("pmOkrFiscalYearSelect");
    if (!sel) return;
    var vals = Array.from(
      new Set(
        (projects || [])
          .map(function (p) {
            return String(p.okrFiscalYear || "").trim();
          })
          .filter(Boolean),
      ),
    ).sort(function (a, b) {
      return a.localeCompare(b, undefined, { numeric: true });
    });

    sel.innerHTML = '<option value="">All Fiscal Years</option>';
    vals.forEach(function (v) {
      var opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    });
  }

  function populateAssigneeDropdown(tasks) {
    var sel = document.getElementById("pmAssigneeSelect");
    if (!sel) return;
    var vals = Array.from(
      new Set(
        tasks
          .map(function (t) {
            return (t.assignedTo || "").trim();
          })
          .filter(Boolean),
      ),
    ).sort(function (a, b) {
      return a.localeCompare(b);
    });

    sel.innerHTML = '<option value="">All Assignees</option>';
    vals.forEach(function (v) {
      var opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    });
  }

  function populateCategoryDropdown(tasks) {
    var sel = document.getElementById("pmCategorySelect");
    if (!sel) return;

    var vals = Array.from(
      new Set(
        tasks
          .map(function (t) {
            return (t.category || "").trim();
          })
          .filter(Boolean),
      ),
    ).sort(function (a, b) {
      return a.localeCompare(b);
    });

    sel.innerHTML = '<option value="">All Categories</option>';
    vals.forEach(function (v) {
      var opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    });
  }

  function populateStatusDropdown(statuses) {
    var sel = document.getElementById("pmStatusSelect");
    if (!sel) return;
    sel.innerHTML = '<option value="">All Statuses</option>';
    statuses.forEach(function (s) {
      var opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      sel.appendChild(opt);
    });
  }

  function getSearchQuery() {
    var el = document.getElementById("pmSearchInput");
    return (el && el.value ? el.value : "").trim().toLowerCase();
  }

  function getSelected(id) {
    var el = document.getElementById(id);
    return (el && el.value ? el.value : "").trim();
  }

  function normalizeForSearch(val) {
    return String(val || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function matchesQuery(hay, q, qCompact) {
    if (!q) return true;
    var h = String(hay || "").toLowerCase();
    if (h.includes(q)) return true;
    if (!qCompact) return false;
    return normalizeForSearch(h).includes(qCompact);
  }

  function applySearchAndFilters(renderOnlyCurrentTabFirst) {
    var q = getSearchQuery();
    var qCompact = normalizeForSearch(q);
    var selectedProjectKey = getSelected("pmProjectKeySelect");
    var selectedProjectFiscalYear = getSelected("pmProjectFiscalYearSelect");
    var selectedStatus = getSelected("pmStatusSelect");
    var selectedAssignee = getSelected("pmAssigneeSelect");
    var selectedPriority = getSelected("pmPrioritySelect");
    var selectedCategory = getSelected("pmCategorySelect");
    var selectedOkrFiscalYear = getSelected("pmOkrFiscalYearSelect");

    var recordMatch = function (recID) {
      return matchesQuery(recID, q, qCompact);
    };

    var projectsFiltered = state.projectsAll.filter(function (p) {
      var hay = (
        p.projectKey +
        " " +
        p.recordID +
        " " +
        p.projectName +
        " " +
        p.description +
        " " +
        p.owner +
        " " +
        p.projectStatus +
        " " +
        p.projectFiscalYear +
        " " +
        p.okrKey +
        " " +
        p.okrObjective +
        " " +
        p.okrStartDate +
        " " +
        p.okrEndDate +
        " " +
        p.okrFiscalYear +
        " " +
        p.okrAssociation +
        " " +
        p.projectType
      ).toLowerCase();
      return matchesQuery(hay, q, qCompact) || recordMatch(p.recordID);
    });

    var projectsTableFiltered = projectsFiltered;
    if (selectedProjectFiscalYear) {
      projectsTableFiltered = projectsFiltered.filter(function (p) {
        return (
          String(p.projectFiscalYear || "").trim() ===
          selectedProjectFiscalYear
        );
      });
    }

    var tasksSearchFiltered = state.tasksAll.filter(function (t) {
      var hay = (
        t.projectKey +
        " " +
        t.recordID +
        " " +
        t.title +
        " " +
        t.status +
        " " +
        t.priority +
        " " +
        t.category +
        " " +
        t.assignedTo +
        " " +
        t.start +
        " " +
        t.due +
        " " +
        t.okrAssociation
      ).toLowerCase();

      return matchesQuery(hay, q, qCompact) || recordMatch(t.recordID);
    });

    var activeTab = localStorage.getItem(STORAGE_KEYS.activeTab) || "projects";
    var tasksView = localStorage.getItem(STORAGE_KEYS.tasksView) || "table";
    var analyticsView =
      localStorage.getItem(STORAGE_KEYS.analyticsView) || "main";

    var okrFiltered = projectsFiltered;
    if (analyticsView === "okrs" && selectedOkrFiscalYear) {
      okrFiltered = projectsFiltered.filter(function (p) {
        return (
          String(p.okrFiscalYear || "").trim() === selectedOkrFiscalYear
        );
      });
    }

    var tasksFiltered = tasksSearchFiltered;
    if (activeTab === "tasks") {
      tasksFiltered = tasksSearchFiltered.filter(function (t) {
        if (
          selectedProjectKey &&
          String(t.projectKey || "").trim() !== selectedProjectKey
        )
          return false;
        if (selectedStatus && String(t.status || "").trim() !== selectedStatus)
          return false;
        if (
          selectedAssignee &&
          String(t.assignedTo || "").trim() !== selectedAssignee
        )
          return false;
        if (
          selectedPriority &&
          String(t.priority || "").trim() !== selectedPriority
        )
          return false;
        if (
          selectedCategory &&
          String(t.category || "").trim() !== selectedCategory
        )
          return false;
        return true;
      });
    }

    if (state.sort.projects.key) {
      var sp = state.sort.projects;
      projectsFiltered = projectsFiltered.slice().sort(function (a, b) {
        return compareValues(a[sp.key], b[sp.key], sp.dir, sp.type);
      });
    }
    if (state.sort.tasks.key) {
      var st = state.sort.tasks;
      tasksFiltered = tasksFiltered.slice().sort(function (a, b) {
        return compareValues(a[st.key], b[st.key], st.dir, st.type);
      });
    }

    renderProjectHealthSticky(activeTab, selectedProjectKey);

    var tasksNoArchive = tasksFiltered.filter(function (t) {
      return !isArchivedStatus(t.status);
    });

    var tasksSearchNoArchive = tasksSearchFiltered.filter(function (t) {
      return !isArchivedStatus(t.status);
    });

    if (renderOnlyCurrentTabFirst) {
      if (activeTab === "projects") {
        renderProjectsTable(projectsTableFiltered);
      }
      if (activeTab === "tasks") {
        renderTasksTable(tasksFiltered);
        if (tasksView === "kanban") renderKanban(tasksFiltered);
        if (tasksView === "gantt") renderGantt(tasksNoArchive);
      }
      if (activeTab === "analytics") {
        if (analyticsView === "okrs") {
          renderOkrsRollup(okrFiltered, projectsFiltered, tasksSearchFiltered);
          renderOkrsTable(okrFiltered);
        } else {
          renderAnalytics(tasksSearchNoArchive);
        }
      }
    } else {
      renderProjectsTable(projectsTableFiltered);
      renderTasksTable(tasksFiltered);
      if (activeTab === "tasks" && tasksView === "kanban")
        renderKanban(tasksFiltered);
      if (activeTab === "tasks" && tasksView === "gantt")
        renderGantt(tasksNoArchive);
      if (activeTab === "analytics") {
        if (analyticsView === "okrs") {
          renderOkrsRollup(okrFiltered, projectsFiltered, tasksSearchFiltered);
          renderOkrsTable(okrFiltered);
        } else {
          renderAnalytics(tasksSearchNoArchive);
        }
      }
    }
  }

  function wireClearFilters() {
    function clearAll() {
      var s = document.getElementById("pmSearchInput");
      if (s) s.value = "";
      [
        "pmProjectKeySelect",
        "pmStatusSelect",
        "pmAssigneeSelect",
        "pmPrioritySelect",
        "pmCategorySelect",
      ].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = "";
      });
      applySearchAndFilters(true);
    }
    var b1 = document.getElementById("pmClearFiltersBtn_projects");
    var b2 = document.getElementById("pmClearFiltersBtn_tasks");
    if (b1) b1.addEventListener("click", clearAll);
    if (b2) b2.addEventListener("click", clearAll);
  }

  function wireOkrFilters() {
    var sel = document.getElementById("pmOkrFiscalYearSelect");
    var clearBtn = document.getElementById("pmClearFiltersBtn_okrs");
    if (sel)
      sel.addEventListener("change", function () {
        applySearchAndFilters(true);
      });
    if (clearBtn)
      clearBtn.addEventListener("click", function () {
        if (sel) sel.value = "";
        applySearchAndFilters(true);
      });
  }

  function wireOkrRollupToggle() {
    var wrap = document.getElementById("pmOkrsSummary");
    if (!wrap) return;
    wrap.addEventListener("click", function (e) {
      var btn = e.target.closest(".pm-okrToggle");
      if (!btn) return;
      var targetId = btn.getAttribute("data-target") || "";
      if (!targetId) return;
      var panel = document.getElementById(targetId);
      if (!panel) return;
      var isOpen = !panel.hasAttribute("hidden");
      panel.toggleAttribute("hidden", isOpen);
      panel.setAttribute("aria-hidden", isOpen ? "true" : "false");
      btn.setAttribute("aria-expanded", isOpen ? "false" : "true");
      btn.textContent = isOpen ? "Expand" : "Collapse";
      var label = btn.getAttribute("data-label") || "Details";
      var okr = btn.getAttribute("data-okr") || "";
      var action = isOpen ? "Expand" : "Collapse";
      btn.setAttribute(
        "aria-label",
        action + " " + label + (okr ? " for OKR " + okr : ""),
      );
    });
  }

  function wireRecordModalLinks() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest("a.pm-recordLink");
      if (!a) return;
      e.preventDefault();
      var href = a.getAttribute("href");
      var title = a.getAttribute("data-title") || "Details";
      if (href) openModal(title, href);
    });
  }

  function wireSupportMessageListener() {
    window.addEventListener("message", function (event) {
      if (event.origin !== window.location.origin) return;
      var data = event.data || {};
      if (!data || data.type !== "pm-open-modal") return;
      var url = typeof data.url === "string" ? data.url : "";
      if (!url) return;
      var title = typeof data.title === "string" ? data.title : "Details";
      openModal(title, url);
    });
  }

  function wireModalControls() {
    var modal = document.getElementById("pmModal");
    var closeBtn = document.getElementById("pmModalCloseBtn");
    var openTabBtn = document.getElementById("pmModalOpenTabBtn");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (openTabBtn)
      openTabBtn.addEventListener("click", function () {
        var url = openTabBtn.getAttribute("data-url") || "";
        if (!url) return;
        window.open(url, "_blank", "noopener");
      });

    if (modal) {
      modal.addEventListener("click", function (e) {
        var t = e.target;
        if (t && t.getAttribute && t.getAttribute("data-close") === "1")
          closeModal();
      });
    }

    document.addEventListener("keydown", function (e) {
      if (!isModalOpen()) return;
      if (e.key === "Escape") {
        closeModal();
        return;
      }
      if (e.key !== "Tab") return;
      var modalEl = document.getElementById("pmModal");
      var focusable = getFocusableElements(modalEl);
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  function wireAddButtons() {
    var inbox = document.getElementById("pmViewInboxBtn");
    if (inbox)
      inbox.addEventListener("click", function () {
        openModal("Inbox", "report.php?a=LEAF_Inbox");
      });

    var menuBtn = document.getElementById("pmAddMenuBtn");
    var menu = document.getElementById("pmAddMenuList");
    if (!menuBtn || !menu) return;

    var items = Array.from(menu.querySelectorAll(".pm-menuItem"));
    if (!items.length) return;
    var activeIndex = 0;
    var isOpen = false;

    items.forEach(function (item, idx) {
      item.setAttribute("tabindex", "-1");
      item.addEventListener("focus", function () {
        activeIndex = idx;
      });
    });

    function focusItem(index) {
      if (!items.length) return;
      activeIndex = Math.max(0, Math.min(index, items.length - 1));
      items.forEach(function (item, idx) {
        item.setAttribute("tabindex", idx === activeIndex ? "0" : "-1");
      });
      items[activeIndex].focus();
    }

    function openMenu(focusIndex) {
      if (isOpen) return;
      isOpen = true;
      menu.hidden = false;
      menuBtn.setAttribute("aria-expanded", "true");
      focusItem(
        typeof focusIndex === "number" ? focusIndex : Math.max(0, activeIndex),
      );
      document.addEventListener("click", onDocumentClick, true);
      document.addEventListener("keydown", onDocumentKeydown);
    }

    function closeMenu(returnFocus) {
      if (!isOpen) return;
      isOpen = false;
      menu.hidden = true;
      menuBtn.setAttribute("aria-expanded", "false");
      items.forEach(function (item) {
        item.setAttribute("tabindex", "-1");
      });
      document.removeEventListener("click", onDocumentClick, true);
      document.removeEventListener("keydown", onDocumentKeydown);
      if (returnFocus) menuBtn.focus();
    }

    function launchAction(action) {
      if (action === "project")
        openModal("New Project", START_PROJECT_URL);
      else if (action === "task") openModal("New Task", START_TASK_URL);
      else if (action === "objective")
        openModal("Add Objective", START_OKR_URL);
      else if (action === "keyResult")
        openModal("Add Key Result", START_KEY_RESULT_URL);
    }

    function activateItem(item) {
      if (!item || !item.classList || !item.classList.contains("pm-menuItem"))
        return;
      var action = item.getAttribute("data-action") || "";
      closeMenu(true);
      if (action) launchAction(action);
    }

    function onDocumentClick(e) {
      if (
        e.target === menuBtn ||
        menu.contains(e.target) ||
        menuBtn.contains(e.target)
      )
        return;
      closeMenu(true);
    }

    function onDocumentKeydown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeMenu(true);
      }
    }

    menuBtn.addEventListener("click", function () {
      if (isOpen) closeMenu(true);
      else openMenu(0);
    });

    menuBtn.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu(0);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        openMenu(items.length - 1);
      }
    });

    menu.addEventListener("keydown", function (e) {
      if (!isOpen) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        focusItem((activeIndex + 1) % items.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        focusItem((activeIndex - 1 + items.length) % items.length);
      } else if (e.key === "Home") {
        e.preventDefault();
        focusItem(0);
      } else if (e.key === "End") {
        e.preventDefault();
        focusItem(items.length - 1);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activateItem(document.activeElement);
      } else if (e.key === "Tab") {
        closeMenu(false);
      }
    });

    menu.addEventListener("click", function (e) {
      var item = e.target.closest(".pm-menuItem");
      if (!item) return;
      e.preventDefault();
      activateItem(item);
    });
  }

  function wireAnalyticsSharedFilters() {
    var yearSel = document.getElementById("pmAnalyticsGeneralYearSelect");
    var quarterSel = document.getElementById("pmAnalyticsGeneralQuarterSelect");
    if (yearSel)
      yearSel.addEventListener("change", function () {
        state.analyticsGeneralYear = yearSel.value || "";
        applySearchAndFilters(false);
      });
    if (quarterSel)
      quarterSel.addEventListener("change", function () {
        state.analyticsGeneralQuarter = quarterSel.value || "";
        applySearchAndFilters(false);
      });
  }

  function wireJumpToTop() {
    var btn = document.getElementById("pmJumpTopBtn");
    if (!btn) return;

    function updateVisibility() {
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var scrollHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
      );
      var clientHeight =
        window.innerHeight || document.documentElement.clientHeight;
      var needsScroll = scrollHeight - clientHeight > 80;
      var isVisible = needsScroll && scrollTop > 120;
      btn.classList.toggle("is-visible", isVisible);
      btn.setAttribute("aria-hidden", isVisible ? "false" : "true");
      btn.setAttribute("tabindex", isVisible ? "0" : "-1");
    }

    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    window.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("resize", updateVisibility);
    updateVisibility();
  }

  function isChartV2() {
    return !!(
      window.Chart &&
      Chart.version &&
      String(Chart.version).startsWith("2")
    );
  }

  function getHorizontalBarType() {
    return isChartV2() ? "horizontalBar" : "bar";
  }

  function buildHorizontalBarOptions() {
    var options = { responsive: true, maintainAspectRatio: false };
    if (isChartV2()) {
      options.scales = {
        xAxes: [{ ticks: { beginAtZero: true } }],
        yAxes: [{ ticks: { autoSkip: false } }],
      };
    } else {
      options.indexAxis = "y";
      options.scales = {
        x: { beginAtZero: true },
        y: { ticks: { autoSkip: false } },
      };
    }
    return options;
  }

  function buildStackedHorizontalOptions() {
    var options = buildHorizontalBarOptions();
    if (isChartV2()) {
      options.scales.xAxes[0].stacked = true;
      options.scales.yAxes[0].stacked = true;
    } else {
      options.scales.x.stacked = true;
      options.scales.y.stacked = true;
    }
    return options;
  }

  function sizeChartBox(canvasId, itemCount, config) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    var box = canvas.closest(".pm-chartBox");
    var inner = canvas.closest(".pm-chartInner") || box;
    var minHeight = (config && config.minHeight) || 220;
    var baseHeight = (config && config.baseHeight) || 80;
    var rowHeight = (config && config.rowHeight) || 28;
    var maxHeight = (config && config.maxHeight) || 520;
    var count = Math.max(1, Number(itemCount) || 0);
    var contentHeight = Math.max(minHeight, baseHeight + count * rowHeight);
    var containerHeight = Math.min(contentHeight, maxHeight);

    if (box) {
      box.style.height = containerHeight + "px";
      box.style.maxHeight = maxHeight + "px";
      box.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
    }
    if (inner && inner !== box) {
      inner.style.height = contentHeight + "px";
    }
    return canvas;
  }

  function renderAnalytics(tasks) {
    if (typeof Chart === "undefined") {
      var note = document.querySelector(".pm-analyticsNote");
      if (note)
        note.textContent =
          "Charts unavailable because Chart.js did not load in this environment.";
      [
        "pmChartDueBucketsDesc",
        "pmChartCompletedByQuarterDesc",
        "pmChartCompletedByCategoryDesc",
        "pmChartTasksByPriorityDesc",
        "pmChartTasksByStatusDesc",
        "pmChartTasksByProjectDesc",
        "pmChartTicketsImportedDesc",
        "pmChartProjectsByTypeDesc",
      ].forEach(function (id) {
        setChartSummary(id, "Charts unavailable.");
      });
      return;
    }

    var analyticsTasks = (tasks || []).filter(function (t) {
      return !isArchivedStatus(t.status);
    });
    var analyticsProjects = (state.projectsAll || []).slice();
    var now = new Date();

    if (state.charts.status) {
      state.charts.status.destroy();
      state.charts.status = null;
    }
    if (state.charts.projectKey) {
      state.charts.projectKey.destroy();
      state.charts.projectKey = null;
    }
    if (state.charts.dueBuckets) {
      state.charts.dueBuckets.destroy();
      state.charts.dueBuckets = null;
    }
    if (state.charts.completedByQuarter) {
      state.charts.completedByQuarter.destroy();
      state.charts.completedByQuarter = null;
    }
    if (state.charts.completedByCategory) {
      state.charts.completedByCategory.destroy();
      state.charts.completedByCategory = null;
    }
    if (state.charts.priority) {
      state.charts.priority.destroy();
      state.charts.priority = null;
    }
    if (state.charts.ticketsImported) {
      state.charts.ticketsImported.destroy();
      state.charts.ticketsImported = null;
    }
    if (state.charts.projectsByType) {
      state.charts.projectsByType.destroy();
      state.charts.projectsByType = null;
    }

    var generalYearSelect = document.getElementById(
      "pmAnalyticsGeneralYearSelect",
    );
    var generalQuarterSelect = document.getElementById(
      "pmAnalyticsGeneralQuarterSelect",
    );
    var generalYears = Array.from(
      new Set(
        analyticsTasks
          .map(function (t) {
            var d = getTaskGeneralDate(t);
            return d ? d.getFullYear() : null;
          })
          .concat(
            analyticsProjects.map(function (p) {
              var d = getProjectGeneralDate(p);
              return d ? d.getFullYear() : null;
            }),
          )
          .filter(function (y) {
            return y != null;
          }),
      ),
    ).sort(function (a, b) {
      return b - a;
    });

    if (!generalYears.length) {
      generalYears = [now.getFullYear()];
    }

    if (!state.analyticsGeneralYear) {
      state.analyticsGeneralYear = "all";
    }
    if (
      state.analyticsGeneralYear !== "all" &&
      generalYears.indexOf(Number(state.analyticsGeneralYear)) === -1
    ) {
      state.analyticsGeneralYear = "all";
    }

    if (generalYearSelect) {
      generalYearSelect.innerHTML =
        '<option value="all"' +
        (state.analyticsGeneralYear === "all" ? " selected" : "") +
        ">All Years</option>" +
        generalYears
          .map(function (y) {
            return (
              '<option value="' +
              y +
              '"' +
              (String(y) === String(state.analyticsGeneralYear)
                ? " selected"
                : "") +
              ">" +
              y +
              "</option>"
            );
          })
          .join("");
    }

    var isAllYears = state.analyticsGeneralYear === "all";
    var selectedGeneralYear = isAllYears
      ? null
      : Number(state.analyticsGeneralYear);
    var selectedGeneralQuarter = state.analyticsGeneralQuarter || "all";
    var filterLabel =
      (isAllYears ? "All years" : "Year " + selectedGeneralYear) +
      (selectedGeneralQuarter === "all"
        ? ", all quarters"
        : ", " + selectedGeneralQuarter);
    function inSelectedYear(d) {
      if (!d || isNaN(d.getTime())) return false;
      if (isAllYears) return true;
      return d.getFullYear() === selectedGeneralYear;
    }
    function inSelectedQuarter(d) {
      if (!d || isNaN(d.getTime())) return false;
      if (selectedGeneralQuarter === "all") return true;
      var q = Math.floor(d.getMonth() / 3) + 1;
      return selectedGeneralQuarter === "Q" + q;
    }
    var tasksForGeneralCharts = analyticsTasks.filter(function (t) {
      var d = getTaskGeneralDate(t);
      if (!d || isNaN(d.getTime())) return false;
      return inSelectedYear(d) && inSelectedQuarter(d);
    });
    var projectsForGeneralCharts = analyticsProjects.filter(function (p) {
      var d = getProjectGeneralDate(p);
      if (!d || isNaN(d.getTime())) return false;
      return inSelectedYear(d) && inSelectedQuarter(d);
    });

    var byStatus = {};
    var byProject = {};
    var buckets = {
      Overdue: 0,
      "Due in 7 days": 0,
      "Due in 30 days": 0,
      "Due later": 0,
      "No due date": 0,
    };

    tasksForGeneralCharts.forEach(function (t) {
      var st = normalizeStatus(t.status);
      if (isArchivedStatus(st)) return;
      byStatus[st] = (byStatus[st] || 0) + 1;

      var pk = String(t.projectKey || "").trim() || "(Blank)";
      byProject[pk] = (byProject[pk] || 0) + 1;

      var due = mmddyyyyToDate(t.due);
      if (!due) {
        buckets["No due date"] += 1;
        return;
      }

      var diff = Math.round((due.getTime() - now.getTime()) / 86400000);
      if (diff < 0) buckets["Overdue"] += 1;
      else if (diff <= 7) buckets["Due in 7 days"] += 1;
      else if (diff <= 30) buckets["Due in 30 days"] += 1;
      else buckets["Due later"] += 1;
    });

    var completedTasks = analyticsTasks.filter(function (t) {
      return isCompletedStatus(t.status);
    });
    var completedTasksForCharts = completedTasks.filter(function (t) {
      var date = getCompletionDateForTask(t);
      if (!date || isNaN(date.getTime())) return false;
      return inSelectedYear(date) && inSelectedQuarter(date);
    });

    var completedYears = Array.from(
      new Set(
        completedTasks
          .map(function (t) {
            var date = getCompletionDateForTask(t);
            return date ? date.getFullYear() : null;
          })
          .filter(function (y) {
            return y != null;
          }),
      ),
    ).sort(function (a, b) {
      return b - a;
    });

    if (!completedYears.length) {
      completedYears = [now.getFullYear()];
    }


    var ticketTasks = analyticsTasks.filter(function (t) {
      return !!String(t.supportTicket || "").trim();
    });

    var ticketYears = Array.from(
      new Set(
        ticketTasks
          .map(function (t) {
            var date = getTicketImportedDate(t);
            return date ? date.getFullYear() : null;
          })
          .filter(function (y) {
            return y != null;
          }),
      ),
    ).sort(function (a, b) {
      return b - a;
    });

    if (!ticketYears.length) {
      ticketYears = [now.getFullYear()];
    }


    var quarterOptions = [
      { value: "all", label: "All" },
      { value: "Q1", label: "Q1" },
      { value: "Q2", label: "Q2" },
      { value: "Q3", label: "Q3" },
      { value: "Q4", label: "Q4" },
    ];
    if (!state.analyticsGeneralQuarter) state.analyticsGeneralQuarter = "all";
    if (
      !quarterOptions.some(function (q) {
        return q.value === state.analyticsGeneralQuarter;
      })
    ) {
      state.analyticsGeneralQuarter = "all";
    }
    if (generalQuarterSelect) {
      generalQuarterSelect.innerHTML = quarterOptions
        .map(function (q) {
          return (
            '<option value="' +
            q.value +
            '"' +
            (q.value === state.analyticsGeneralQuarter ? " selected" : "") +
            ">" +
            q.label +
            "</option>"
          );
        })
        .join("");
    }

    var quarters = [0, 0, 0, 0];
    completedTasksForCharts.forEach(function (t) {
      var date = getCompletionDateForTask(t);
      if (!date) return;
      var q = Math.floor(date.getMonth() / 3);
      quarters[q] += 1;
    });
    setChartSummary(
      "pmChartCompletedByQuarterDesc",
      "Completed tasks by quarter (" +
        filterLabel +
        "): " +
        summarizeLabelData(["Q1", "Q2", "Q3", "Q4"], quarters),
    );

    var statusLabels = getKanbanColumnsOrdered()
      .slice()
      .filter(function (label) {
        return !isArchivedStatus(label);
      });
    Object.keys(byStatus).forEach(function (k) {
      if (isArchivedStatus(k)) return;
      if (statusLabels.indexOf(k) === -1) statusLabels.push(k);
    });
    var statusData = statusLabels.map(function (k) {
      return byStatus[k] || 0;
    });
    setChartSummary(
      "pmChartTasksByStatusDesc",
      "Tasks by status (" +
        filterLabel +
        "): " +
        summarizeLabelData(statusLabels, statusData),
    );

    var ctxQuarter = sizeChartBox("pmChartCompletedByQuarter", 4);
    if (ctxQuarter) {
      state.charts.completedByQuarter = new Chart(ctxQuarter, {
        type: getHorizontalBarType(),
        data: {
          labels: ["Q1", "Q2", "Q3", "Q4"],
          datasets: [{ label: "Completed tasks", data: quarters }],
        },
        options: buildHorizontalBarOptions(),
      });
    }

    var catCounts = {};
    completedTasksForCharts.forEach(function (t) {
      var cat = String(t.category || "").trim() || "Unspecified";
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });

    var catLabels = Object.keys(catCounts).sort(function (a, b) {
      return a.localeCompare(b);
    });
    var catData = catLabels.map(function (k) {
      return catCounts[k];
    });
    setChartSummary(
      "pmChartCompletedByCategoryDesc",
      "Completed tasks by category (" +
        filterLabel +
        "): " +
        (catLabels.length
          ? summarizeLabelData(catLabels, catData)
          : "No data."),
    );

    var ctxCat = sizeChartBox(
      "pmChartCompletedByCategory",
      catLabels.length || 1,
    );
    if (ctxCat) {
      state.charts.completedByCategory = new Chart(ctxCat, {
        type: getHorizontalBarType(),
        data: {
          labels: catLabels.length ? catLabels : ["No data"],
          datasets: [
            {
              label: "Completed tasks",
              data: catLabels.length ? catData : [0],
            },
          ],
        },
        options: buildHorizontalBarOptions(),
      });
    }

    var priorityCounts = { High: 0, Medium: 0, Low: 0, Unspecified: 0 };
    tasksForGeneralCharts.forEach(function (t) {
      var p = String(t.priority || "").trim();
      if (!p) priorityCounts.Unspecified += 1;
      else if (p.toLowerCase() === "high") priorityCounts.High += 1;
      else if (p.toLowerCase() === "medium") priorityCounts.Medium += 1;
      else if (p.toLowerCase() === "low") priorityCounts.Low += 1;
      else priorityCounts.Unspecified += 1;
    });

    var priorityLabels = Object.keys(priorityCounts);
    var priorityData = priorityLabels.map(function (k) {
      return priorityCounts[k];
    });
    setChartSummary(
      "pmChartTasksByPriorityDesc",
      "Tasks by priority (" +
        filterLabel +
        "): " +
        summarizeLabelData(priorityLabels, priorityData),
    );

    var ctxPriority = sizeChartBox(
      "pmChartTasksByPriority",
      priorityLabels.length,
    );
    if (ctxPriority) {
      var priorityColors = ["#f2938c", "#e6c74c", "#aacdec", "#cfcfcf"];
      state.charts.priority = new Chart(ctxPriority, {
        type: getHorizontalBarType(),
        data: {
          labels: priorityLabels,
          datasets: [
            {
              label: "Tasks",
              data: priorityData,
              backgroundColor: priorityColors,
              borderColor: priorityColors,
              borderWidth: 1,
            },
          ],
        },
        options: buildHorizontalBarOptions(),
      });
    }

    var ctx1 = sizeChartBox("pmChartTasksByStatus", statusLabels.length);
    if (ctx1) {
      state.charts.status = new Chart(ctx1, {
        type: getHorizontalBarType(),
        data: {
          labels: statusLabels,
          datasets: [{ label: "Tasks", data: statusData }],
        },
        options: buildHorizontalBarOptions(),
      });
    }

    var projLabels = Object.keys(byProject).sort(function (a, b) {
      return a.localeCompare(b);
    });
    var projData = projLabels.map(function (k) {
      return byProject[k] || 0;
    });
    setChartSummary(
      "pmChartTasksByProjectDesc",
      "Tasks per project key (" +
        filterLabel +
        "): " +
        (projLabels.length
          ? summarizeLabelData(projLabels, projData)
          : "No data."),
    );

    var ctx2 = sizeChartBox(
      "pmChartTasksByProject",
      projLabels.length || 1,
    );
    if (ctx2) {
      state.charts.projectKey = new Chart(ctx2, {
        type: getHorizontalBarType(),
        data: {
          labels: projLabels,
          datasets: [{ label: "Tasks", data: projData }],
        },
        options: buildHorizontalBarOptions(),
      });
    }

    var bucketLabels = Object.keys(buckets);
    var bucketData = bucketLabels.map(function (k) {
      return buckets[k];
    });
    setChartSummary(
      "pmChartDueBucketsDesc",
      "Due date buckets (" +
        filterLabel +
        "): " +
        summarizeLabelData(bucketLabels, bucketData),
    );

    var ctx3 = sizeChartBox("pmChartDueBuckets", bucketLabels.length);
    if (ctx3) {
      var dueColors = bucketLabels.map(function (label) {
        return String(label).toLowerCase() === "overdue"
          ? "#ff4040"
          : "#aacdec";
      });
      state.charts.dueBuckets = new Chart(ctx3, {
        type: getHorizontalBarType(),
        data: {
          labels: bucketLabels,
          datasets: [
            {
              label: "Tasks",
              data: bucketData,
              backgroundColor: dueColors,
              borderColor: dueColors,
              borderWidth: 1,
            },
          ],
        },
        options: buildHorizontalBarOptions(),
      });
    }

    var ticketCounts = new Array(12).fill(0);
    ticketTasks.forEach(function (t) {
      var date = getTicketImportedDate(t);
      if (!date || !inSelectedYear(date)) return;
      if (!inSelectedQuarter(date)) return;
      ticketCounts[date.getMonth()] += 1;
    });
    var ticketLabels = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    setChartSummary(
      "pmChartTicketsImportedDesc",
      "Tickets imported by month (" +
        filterLabel +
        "): " +
        summarizeLabelData(ticketLabels, ticketCounts),
    );

    var ctxTickets = sizeChartBox(
      "pmChartTicketsImported",
      ticketLabels.length,
    );
    if (ctxTickets) {
      state.charts.ticketsImported = new Chart(ctxTickets, {
        type: getHorizontalBarType(),
        data: {
          labels: ticketLabels,
          datasets: [{ label: "Tickets imported", data: ticketCounts }],
        },
        options: buildHorizontalBarOptions(),
      });
    }

    var projectTypeCounts = {};
    projectsForGeneralCharts.forEach(function (p) {
      var pt = formatProjectTypeLabel(p.projectType);
      projectTypeCounts[pt] = (projectTypeCounts[pt] || 0) + 1;
    });

    var typeLabels = Object.keys(projectTypeCounts).sort(function (a, b) {
      return a.localeCompare(b);
    });
    var typeData = typeLabels.map(function (k) {
      return projectTypeCounts[k];
    });
    setChartSummary(
      "pmChartProjectsByTypeDesc",
      "Projects by project type (" +
        filterLabel +
        "): " +
        (typeLabels.length
          ? summarizeLabelData(typeLabels, typeData)
          : "No data."),
    );

    var ctxProjType = sizeChartBox(
      "pmChartProjectsByType",
      typeLabels.length || 1,
    );
    if (ctxProjType) {
      state.charts.projectsByType = new Chart(ctxProjType, {
        type: getHorizontalBarType(),
        data: {
          labels: typeLabels.length ? typeLabels : ["No data"],
          datasets: [
            {
              label: "Projects",
              data: typeLabels.length ? typeData : [0],
            },
          ],
        },
        options: buildHorizontalBarOptions(),
      });
    }

    var health = {};
    tasksForGeneralCharts.forEach(function (t) {
      var pk = String(t.projectKey || "").trim() || "(Blank)";
      if (!health[pk]) health[pk] = { total: 0, overdue: 0, completed: 0 };
      health[pk].total += 1;

      var st = String(t.status || "").toLowerCase();
      if (st.indexOf("completed") !== -1) health[pk].completed += 1;

      if (isOverdueTask(t, now)) health[pk].overdue += 1;
    });

    var healthRows = Object.keys(health)
      .sort(function (a, b) {
        return a.localeCompare(b);
      })
      .map(function (pk) {
        var h = health[pk];
        var compPct = h.total ? Math.round((h.completed / h.total) * 100) : 0;
        var compClass = compPct === 100 ? "pm-completeGreen" : "";

        var overdueCell =
          h.overdue > 0
            ? "<td class='pm-overdueRed'>" + h.overdue + "</td>"
            : "<td>" + h.overdue + "</td>";

        return (
          "<tr><td>" +
          safe(pk) +
          "</td><td>" +
          h.total +
          "</td><td>" +
          h.completed +
          "</td><td class='" +
          compClass +
          "'>" +
          compPct +
          "%</td>" +
          overdueCell +
          "</tr>"
        );
      })
      .join("");

    var healthTable = document.getElementById("pmProjectHealthTable");
    if (healthTable) {
      healthTable.innerHTML =
        '<table class="pm-table">' +
        "<thead><tr><th>Project Key</th><th>Total tasks</th><th>Completed</th><th>Completed percent</th><th>Overdue</th></tr></thead>" +
        "<tbody>" +
        (healthRows || "<tr><td colspan='5'>No data</td></tr>") +
        "</tbody>" +
        "</table>";
    }

    var overdueTasks = tasksForGeneralCharts
      .filter(function (t) {
        return isOverdueTask(t, now);
      })
      .sort(function (a, b) {
        var da = mmddyyyyToDate(a.due) || new Date(8640000000000000);
        var db = mmddyyyyToDate(b.due) || new Date(8640000000000000);
        return da - db;
      });

    var overdueRows = overdueTasks
      .slice(0, 200)
      .map(function (t) {
        var pkHref = getProjectRecordHrefFromKey(t.projectKey);
        var pkLink = pkHref
          ? "<a href='" +
            safe(pkHref) +
            "' class='pm-recordLink' data-title='" +
            safe("Project " + t.projectKey) +
            "'>" +
            safe(t.projectKey) +
            "</a>"
          : safe(t.projectKey);

        var taskHref = t.href || "";
        var taskLink = taskHref
          ? "<a href='" +
            safe(taskHref) +
            "' class='pm-recordLink' data-title='" +
            safe("Task " + t.recordID) +
            "'>" +
            safe(t.recordID) +
            "</a>"
          : safe(t.recordID);

        return (
          "<tr>" +
          "<td>" +
          pkLink +
          "</td>" +
          "<td>" +
          taskLink +
          "</td>" +
          "<td>" +
          safe(t.title) +
          "</td>" +
          "<td>" +
          safe(t.assignedTo) +
          "</td>" +
          "<td class='pm-overdueRed'>" +
          safe(t.due) +
          "</td>" +
          "<td>" +
          safe(t.status) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    var overdueTable = document.getElementById("pmOverdueTasksTable");
    if (overdueTable) {
      overdueTable.innerHTML =
        '<table class="pm-table">' +
        "<thead><tr><th>Project Key</th><th>Task ID</th><th>Title</th><th>Assigned To</th><th>Due</th><th>Status</th></tr></thead>" +
        "<tbody>" +
        (overdueRows || "<tr><td colspan='6'>No overdue tasks</td></tr>") +
        "</tbody>" +
        "</table>";
    }
  }

  async function main() {
    try {
      flushTransferDebug();
      wireTabs();
      wireTaskViewToggle();
      wireAnalyticsViewToggle();
      wireSortingDelegation();
      wireClearFilters();
      wireOkrFilters();
      wireOkrRollupToggle();
      wireRecordModalLinks();
      wireSupportMessageListener();
      wireModalControls();
      wireAddButtons();
      wireAnalyticsSharedFilters();
      wireJumpToTop();

      var projectsUrl = buildQueryUrl(
        [
          PROJECT_IND.projectKey,
          PROJECT_IND.projectName,
          PROJECT_IND.description,
          PROJECT_IND.owner,
          PROJECT_IND.projectStatus,
          PROJECT_IND.projectFiscalYear,
          PROJECT_IND.okrAssociation,
          PROJECT_IND.projectType,
          OKR_IND.okrKey,
          OKR_IND.objective,
          OKR_IND.startDate,
          OKR_IND.endDate,
          OKR_IND.fiscalYear,
        ],
        [],
      );

      // Important: include ALL task fields
      var tasksUrl = buildQueryUrl(
        [
          TASK_IND.projectKey,
          TASK_IND.title,
          TASK_IND.status,
          TASK_IND.priority,
          TASK_IND.category,
          TASK_IND.dependencies,
          TASK_IND.assignedTo,
          TASK_IND.startDate,
          TASK_IND.dueDate,
          TASK_IND.supportTicket,
          TASK_IND.okrAssociation,
        ],
        [],
      );

      var results = await Promise.all([
        fetchJSON(projectsUrl),
        fetchJSON(tasksUrl),
      ]);
      var projectsJson = results[0];
      var tasksJson = results[1];

      var projectRowsAll = coerceRows(projectsJson) || [];
      var taskRowsAll = coerceRows(tasksJson) || [];

      var projectRows = projectRowsAll.filter(function (r) {
        return hasAnyS1Value(
          r,
          [2, 3, 4, 5, 6, 23, 24, 25, 26, 29, 32, 33, 38],
        );
      });
      var taskRows = taskRowsAll.filter(function (r) {
        return hasAnyS1Value(
          r,
          [8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 30],
        );
      });

      state.projectsAll = projectRows.map(normalizeProject);
      state.tasksAll = taskRows.map(normalizeTask);
      backfillSupportTicketLabels(state.tasksAll);

      state.projectKeyToRecordID = {};
      state.projectKeyToTitle = {};
      state.projectsAll.forEach(function (p) {
        var pk = String(p.projectKey || "").trim();
        var rid = String(p.recordID || "").trim();
        if (pk && rid && !state.projectKeyToRecordID[pk])
          state.projectKeyToRecordID[pk] = rid;
        if (pk && p.projectName && !state.projectKeyToTitle[pk])
          state.projectKeyToTitle[pk] = p.projectName;
      });

      populateProjectKeyDropdown(state.projectsAll);
      populateProjectFiscalYearDropdown(state.projectsAll);
      populateOkrFiscalYearDropdown(state.projectsAll);
      populateAssigneeDropdown(state.tasksAll);
      populateCategoryDropdown(state.tasksAll);
      populateStatusDropdown(getKanbanColumnsOrdered());

      [
        "pmSearchInput",
        "pmProjectKeySelect",
        "pmProjectFiscalYearSelect",
        "pmStatusSelect",
        "pmAssigneeSelect",
        "pmPrioritySelect",
        "pmCategorySelect",
      ].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener(
          id === "pmSearchInput" ? "input" : "change",
          function () {
            applySearchAndFilters(true);
          },
        );
      });

      var activeTab =
        localStorage.getItem(STORAGE_KEYS.activeTab) || "projects";
      setActiveTab(activeTab);

      applySearchAndFilters(true);
      requestAnimationFrame(function () {
        applySearchAndFilters(false);
      });
    } catch (e) {
      console.error("Failed to load data.", e);
    } finally {
      await handleTransferFromSupport();
    }
  }

  handleTransferFromSupport();
  window.addEventListener("load", handleTransferFromSupport);
  document.addEventListener("DOMContentLoaded", main);
})();
