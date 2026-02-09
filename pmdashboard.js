(function () {
  var env = document.getElementById("pmEnv");
  var CSRFToken = env ? env.getAttribute("data-csrf") || "" : "";

  // Task form indicator IDs
  var TASK_IND = {
    projectKey: 128,
    title: 129,
    status: 130,
    assignedTo: 131,
    startDate: 132,
    dueDate: 133,
    priority: 140,
    category: 145,
    dependencies: 146,
    sandboxTicket: 148,
  };

  // Project form indicator IDs
  var PROJECT_IND = {
    projectKey: 135,
    projectName: 136,
    description: 137,
    owner: 138,
    projectStatus: 139,
  };

  // Endpoints
  var BASE_QUERY_ENDPOINT =
    "https://leaf.va.gov/platform/sl_projects/api/form/query/";
  var FORM_POST_ENDPOINT_PREFIX =
    "https://leaf.va.gov/platform/sl_projects/api/form/";
  var START_PROJECT_URL =
    "https://leaf.va.gov/platform/sl_projects/report.php?a=LEAF_Start_Request&id=form_7f573";
  var START_TASK_URL =
    "https://leaf.va.gov/platform/sl_projects/report.php?a=LEAF_Start_Request&id=form_c9014";

  // Persistence keys
  var STORAGE_KEYS = {
    activeTab: "pm_active_tab",
    tasksView: "pm_tasks_view",
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
    analyticsYear: "",
    analyticsCategoryYear: "",
    analyticsCategoryQuarter: "",
    sort: {
      projects: { key: null, dir: 1, type: "string" },
      tasks: { key: null, dir: 1, type: "string" },
    },
    charts: {
      status: null,
      projectKey: null,
      dueBuckets: null,
      completedByQuarter: null,
      completedByCategory: null,
      priority: null,
    },
  };

  function safe(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function openModal(title, url) {
    var modal = document.getElementById("pmModal");
    var frame = document.getElementById("pmModalFrame");
    var titleEl = document.getElementById("pmModalTitle");
    if (!modal || !frame || !titleEl) return;
    titleEl.textContent = title || "Details";
    frame.src = url;
    modal.style.display = "block";
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    var modal = document.getElementById("pmModal");
    var frame = document.getElementById("pmModalFrame");
    if (!modal || !frame) return;
    frame.src = "about:blank";
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
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

    var jsMatch = src.match(
      /CSRFToken\s*[:=]\s*["']([^"']+)["']/i,
    );
    if (jsMatch && jsMatch[1])
      return { token: jsMatch[1], field: "CSRFToken" };

    var jsAltMatch = src.match(
      /csrf_token\s*[:=]\s*["']([^"']+)["']/i,
    );
    if (jsAltMatch && jsAltMatch[1])
      return { token: jsAltMatch[1], field: "csrf_token" };

    var jsAltMatch2 = src.match(
      /csrfToken\s*[:=]\s*["']([^"']+)["']/i,
    );
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

      iframe.addEventListener("load", function () {
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
          }
          if (!token && iframe.contentWindow) {
            if (iframe.contentWindow.CSRFToken)
              token = iframe.contentWindow.CSRFToken;
            else if (iframe.contentWindow.csrfToken)
              token = iframe.contentWindow.csrfToken;
          }
        } catch (e2) {}
        if (token) cacheCSRF(token, "CSRFToken");
        finish(token);
      });

      setTimeout(function () {
        finish("");
      }, 6000);

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
      dependenciesRaw: depsRaw,
      depIds: depIds,
      href: recordID
        ? "index.php?a=printview&recordID=" + encodeURIComponent(recordID)
        : "",
    };
  }

  function normalizeProject(row) {
    var recordID = getRecordID(row);
    return {
      recordID: recordID,
      projectKey: extractFromS1(row, PROJECT_IND.projectKey),
      projectName: extractFromS1(row, PROJECT_IND.projectName),
      description: extractFromS1(row, PROJECT_IND.description),
      owner: extractFromS1(row, PROJECT_IND.owner),
      projectStatus: extractFromS1(row, PROJECT_IND.projectStatus),
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
      "&x-filterData=recordID,"
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
      if (key && key === activeKey)
        th.classList.add(dir === 1 ? "is-asc" : "is-desc");
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
      .slice(0, 500)
      .map(function (p) {
        var pkHref = getProjectRecordHrefFromKey(p.projectKey) || p.href;
        var pkLink = pkHref
          ? '<a href="' +
            safe(pkHref) +
            '" class="pm-recordLink" data-title="' +
            safe("Project " + p.projectKey) +
            '">' +
            safe(p.projectKey) +
            "</a>"
          : safe(p.projectKey);

        return (
          "<tr>" +
          "<td>" +
          pkLink +
          "</td>" +
          "<td>" +
          safe(p.projectName) +
          "</td>" +
          "<td>" +
          safe(p.description) +
          "</td>" +
          "<td>" +
          safe(p.owner) +
          "</td>" +
          "<td>" +
          safe(p.projectStatus) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    el.innerHTML =
      '<table class="pm-table">' +
      "<thead><tr>" +
      '<th class="pm-sortable" data-sort="projectKey" data-type="string">Project Key</th>' +
      '<th class="pm-sortable" data-sort="projectName" data-type="string">Project Name</th>' +
      '<th class="pm-sortable" data-sort="description" data-type="string">Description</th>' +
      '<th class="pm-sortable" data-sort="owner" data-type="string">Owner</th>' +
      '<th class="pm-sortable" data-sort="projectStatus" data-type="string">Status</th>' +
      "</tr></thead>" +
      "<tbody>" +
      rows +
      "</tbody>" +
      "</table>";

    var s = state.sort.projects;
    setSortIndicator("pmProjectsTable", s.key, s.dir);
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
            '" class="pm-recordLink" data-title="' +
            safe("Task " + t.recordID) +
            '">' +
            safe(t.recordID) +
            "</a>"
          : safe(t.recordID);

        var overdueClass = isOverdueTask(t, now) ? "pm-overdueRed" : "";

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
          "</tr>"
        );
      })
      .join("");

    el.innerHTML =
      '<table class="pm-table">' +
      "<thead><tr>" +
      '<th class="pm-sortable" data-sort="projectKey" data-type="string">Project Key</th>' +
      '<th class="pm-sortable" data-sort="recordID" data-type="number">Task ID</th>' +
      '<th class="pm-sortable" data-sort="title" data-type="string">Title</th>' +
      '<th class="pm-sortable" data-sort="status" data-type="string">Status</th>' +
      '<th class="pm-sortable" data-sort="dependencies" data-type="string">Dependencies</th>' +
      '<th class="pm-sortable" data-sort="priority" data-type="string">Priority</th>' +
      '<th class="pm-sortable" data-sort="category" data-type="string">Category</th>' +
      '<th class="pm-sortable" data-sort="assignedTo" data-type="string">Assigned To</th>' +
      '<th class="pm-sortable" data-sort="start" data-type="date">Start</th>' +
      '<th class="pm-sortable" data-sort="due" data-type="date">Due</th>' +
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
      130: newStatus,
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
    fd.append("numform_c9014", "1");
    fd.append("title", "Record");

    var r = await fetch("/platform/sl_projects/api/form/new", {
      method: "POST",
      credentials: "include",
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
    newId = String(newId || "").trim().replace(/^\"|\"$/g, "");
    if (!newId) throw new Error("Missing recordID");
    return newId;
  }

  async function setSandboxTicketIndicator(recordID, sourceId) {
    if (!recordID) throw new Error("Missing recordID");
    var token = await ensureCSRFToken(recordID);
    var tokenField = state.csrfField || getCSRFFieldName();

    var url = FORM_POST_ENDPOINT_PREFIX + encodeURIComponent(recordID);
    var bodyObj = {
      recordID: recordID,
      series: 1,
    };
    bodyObj[TASK_IND.sandboxTicket] = "Sandbox Ticket #" + sourceId;
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

  async function handleTransferFromSandbox() {
    if (state.transferInProgress) return;
    var sourceId = getQueryParam("transferFromSandbox");
    if (!sourceId) return;
    sourceId = String(sourceId || "").trim();
    if (!sourceId) return;

    showTransferDebug("Transfer detected for sandbox " + sourceId);
    state.transferInProgress = true;
    try {
      showTransferDebug("Creating task for sandbox " + sourceId);
      var newRecordID = await createTaskRecord();
      await setSandboxTicketIndicator(newRecordID, sourceId);

      var params = new URLSearchParams(window.location.search || "");
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
      console.error("Transfer from sandbox failed.", e);
    } finally {
      state.transferInProgress = false;
    }
  }

  function renderKanban(tasks) {
    var board = document.getElementById("pmKanbanBoard");
    if (!board) return;

    var cols = getKanbanColumnsOrdered().filter(function (col) {
      return String(col || "").toLowerCase().indexOf("archive") === -1;
    });
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
                '" class="pm-recordLink" data-title="' +
                safe("Task " + t.recordID) +
                '">' +
                safe(t.recordID) +
                "</a>"
              : safe(t.recordID);

            return (
              "" +
              '<div class="pm-card" draggable="true" data-taskid="' +
              safe(t.recordID) +
              '">' +
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
            "left:" + leftPct.toFixed(2) + "%;width:" + widthPct.toFixed(2) + "%;";
        }

        var title = safe(t.title || "(No title)");
        var pk = safe(t.projectKey || "");
        var id = safe(t.recordID || "");
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
    if (isCompletedStatus(st) || st.indexOf("archive") !== -1)
      return false;
    var due = mmddyyyyToDate(t.due);
    return !!(due && due.getTime() < now.getTime());
  }

  function isArchivedStatus(status) {
    return String(status || "").toLowerCase().indexOf("archive") !== -1;
  }

  function getCompletionDateForTask(t) {
    return mmddyyyyToDate(t.due) || mmddyyyyToDate(t.start) || null;
  }

  function wireTabs() {
    var tabs = Array.from(document.querySelectorAll(".pm-tab[data-tab]"));
    tabs.forEach(function (btn) {
      btn.addEventListener("click", function () {
        setActiveTab(btn.getAttribute("data-tab"));
      });
    });
  }

  function setActiveTab(tabName) {
    var tabs = Array.from(document.querySelectorAll(".pm-tab[data-tab]"));
    tabs.forEach(function (b) {
      b.classList.remove("is-active");
      b.setAttribute("aria-selected", "false");
    });

    var target = tabs.find(function (b) {
      return b.getAttribute("data-tab") === tabName;
    });
    if (target) {
      target.classList.add("is-active");
      target.setAttribute("aria-selected", "true");
    }

    document.querySelectorAll(".pm-panel").forEach(function (p) {
      p.classList.remove("is-active");
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
      wrapTable.style.display = view === "table" ? "block" : "none";
      wrapKanban.style.display = view === "kanban" ? "block" : "none";
      wrapGantt.style.display = view === "gantt" ? "block" : "none";

      btnTable.classList.toggle("is-active", view === "table");
      btnKanban.classList.toggle("is-active", view === "kanban");
      btnGantt.classList.toggle("is-active", view === "gantt");

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

    var initial = localStorage.getItem(STORAGE_KEYS.tasksView) || "table";
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
    var selectedStatus = getSelected("pmStatusSelect");
    var selectedAssignee = getSelected("pmAssigneeSelect");
    var selectedPriority = getSelected("pmPrioritySelect");
    var selectedCategory = getSelected("pmCategorySelect");

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
        p.projectStatus
      ).toLowerCase();
      return matchesQuery(hay, q, qCompact) || recordMatch(p.recordID);
    });

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
        t.due
      ).toLowerCase();

      return matchesQuery(hay, q, qCompact) || recordMatch(t.recordID);
    });

    var activeTab = localStorage.getItem(STORAGE_KEYS.activeTab) || "projects";
    var tasksView = localStorage.getItem(STORAGE_KEYS.tasksView) || "table";

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
      if (activeTab === "projects") renderProjectsTable(projectsFiltered);
      if (activeTab === "tasks") {
        renderTasksTable(tasksFiltered);
        if (tasksView === "kanban") renderKanban(tasksFiltered);
        if (tasksView === "gantt") renderGantt(tasksNoArchive);
      }
    } else {
      renderProjectsTable(projectsFiltered);
      renderTasksTable(tasksFiltered);
      if (activeTab === "tasks" && tasksView === "kanban")
        renderKanban(tasksFiltered);
      if (activeTab === "tasks" && tasksView === "gantt")
        renderGantt(tasksNoArchive);
      if (activeTab === "analytics") renderAnalytics(tasksSearchNoArchive);
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

  function wireSandboxMessageListener() {
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
    if (closeBtn) closeBtn.addEventListener("click", closeModal);

    if (modal) {
      modal.addEventListener("click", function (e) {
        var t = e.target;
        if (t && t.getAttribute && t.getAttribute("data-close") === "1")
          closeModal();
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeModal();
    });
  }

  function wireAddButtons() {
    var p = document.getElementById("pmAddProjectBtn");
    var t = document.getElementById("pmAddTaskBtn");
    if (p)
      p.addEventListener("click", function () {
        openModal("New Project", START_PROJECT_URL);
      });
    if (t)
      t.addEventListener("click", function () {
        openModal("New Task", START_TASK_URL);
      });
  }

  function wireAnalyticsYearFilter() {
    var sel = document.getElementById("pmAnalyticsYearSelect");
    if (!sel) return;
    sel.addEventListener("change", function () {
      state.analyticsYear = sel.value || "";
      applySearchAndFilters(false);
    });
  }

  function wireAnalyticsCategoryFilters() {
    var yearSel = document.getElementById("pmAnalyticsCategoryYearSelect");
    var quarterSel = document.getElementById(
      "pmAnalyticsCategoryQuarterSelect",
    );
    if (!yearSel || !quarterSel) return;

    yearSel.addEventListener("change", function () {
      state.analyticsCategoryYear = yearSel.value || "";
      applySearchAndFilters(false);
    });

    quarterSel.addEventListener("change", function () {
      state.analyticsCategoryQuarter = quarterSel.value || "";
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
      var clientHeight = window.innerHeight || document.documentElement.clientHeight;
      var needsScroll = scrollHeight - clientHeight > 80;
      btn.classList.toggle("is-visible", needsScroll && scrollTop > 120);
    }

    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    window.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("resize", updateVisibility);
    updateVisibility();
  }

  function renderAnalytics(tasks) {
    if (typeof Chart === "undefined") {
      var note = document.querySelector(".pm-analyticsNote");
      if (note)
        note.textContent =
          "Charts unavailable because Chart.js did not load in this environment.";
      return;
    }

    var analyticsTasks = (tasks || []).filter(function (t) {
      return !isArchivedStatus(t.status);
    });

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

    var byStatus = {};
    var byProject = {};
    var now = new Date();
    var buckets = {
      Overdue: 0,
      "Due in 7 days": 0,
      "Due in 30 days": 0,
      "Due later": 0,
      "No due date": 0,
    };

    analyticsTasks.forEach(function (t) {
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

    var yearSelect = document.getElementById("pmAnalyticsYearSelect");
    var catYearSelect = document.getElementById(
      "pmAnalyticsCategoryYearSelect",
    );
    var catQuarterSelect = document.getElementById(
      "pmAnalyticsCategoryQuarterSelect",
    );
    var completedTasks = analyticsTasks.filter(function (t) {
      return isCompletedStatus(t.status);
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

    if (!state.analyticsYear) {
      state.analyticsYear = String(completedYears[0]);
    }

    if (completedYears.indexOf(Number(state.analyticsYear)) === -1) {
      state.analyticsYear = String(completedYears[0]);
    }

    if (yearSelect) {
      yearSelect.innerHTML = completedYears
        .map(function (y) {
          return (
            '<option value="' +
            y +
            '"' +
            (String(y) === String(state.analyticsYear) ? " selected" : "") +
            ">" +
            y +
            "</option>"
          );
        })
        .join("");
    }

    if (!state.analyticsCategoryYear) {
      state.analyticsCategoryYear = String(completedYears[0]);
    }
    if (completedYears.indexOf(Number(state.analyticsCategoryYear)) === -1) {
      state.analyticsCategoryYear = String(completedYears[0]);
    }

    if (catYearSelect) {
      catYearSelect.innerHTML = completedYears
        .map(function (y) {
          return (
            '<option value="' +
            y +
            '"' +
            (String(y) === String(state.analyticsCategoryYear)
              ? " selected"
              : "") +
            ">" +
            y +
            "</option>"
          );
        })
        .join("");
    }

    var quarterOptions = [
      { value: "all", label: "All" },
      { value: "Q1", label: "Q1" },
      { value: "Q2", label: "Q2" },
      { value: "Q3", label: "Q3" },
      { value: "Q4", label: "Q4" },
    ];
    if (!state.analyticsCategoryQuarter)
      state.analyticsCategoryQuarter = "all";
    if (
      !quarterOptions.some(function (q) {
        return q.value === state.analyticsCategoryQuarter;
      })
    ) {
      state.analyticsCategoryQuarter = "all";
    }
    if (catQuarterSelect) {
      catQuarterSelect.innerHTML = quarterOptions
        .map(function (q) {
          return (
            '<option value="' +
            q.value +
            '"' +
            (q.value === state.analyticsCategoryQuarter ? " selected" : "") +
            ">" +
            q.label +
            "</option>"
          );
        })
        .join("");
    }

    var selectedYear = Number(state.analyticsYear);
    var quarters = [0, 0, 0, 0];
    completedTasks.forEach(function (t) {
      var date = getCompletionDateForTask(t);
      if (!date) return;
      if (date.getFullYear() !== selectedYear) return;
      var q = Math.floor(date.getMonth() / 3);
      quarters[q] += 1;
    });

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

    var ctxQuarter = document.getElementById("pmChartCompletedByQuarter");
    if (ctxQuarter) {
      state.charts.completedByQuarter = new Chart(ctxQuarter, {
        type: "bar",
        data: {
          labels: ["Q1", "Q2", "Q3", "Q4"],
          datasets: [{ label: "Completed tasks", data: quarters }],
        },
        options: { responsive: true, maintainAspectRatio: false },
      });
    }

    var catYear = Number(state.analyticsCategoryYear);
    var catQuarter = state.analyticsCategoryQuarter;
    var catCounts = {};
    completedTasks.forEach(function (t) {
      var date = getCompletionDateForTask(t);
      if (!date || date.getFullYear() !== catYear) return;
      var qIdx = Math.floor(date.getMonth() / 3);
      var qName = "Q" + (qIdx + 1);
      if (catQuarter !== "all" && qName !== catQuarter) return;
      var cat = String(t.category || "").trim() || "Unspecified";
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });

    var catLabels = Object.keys(catCounts).sort(function (a, b) {
      return a.localeCompare(b);
    });
    var catData = catLabels.map(function (k) {
      return catCounts[k];
    });

    var ctxCat = document.getElementById("pmChartCompletedByCategory");
    if (ctxCat) {
      state.charts.completedByCategory = new Chart(ctxCat, {
        type: "bar",
        data: {
          labels: catLabels.length ? catLabels : ["No data"],
          datasets: [
            {
              label: "Completed tasks",
              data: catLabels.length ? catData : [0],
            },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false },
      });
    }

    var priorityCounts = { High: 0, Medium: 0, Low: 0, Unspecified: 0 };
    analyticsTasks.forEach(function (t) {
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

    var ctxPriority = document.getElementById("pmChartTasksByPriority");
    if (ctxPriority) {
      state.charts.priority = new Chart(ctxPriority, {
        type: "doughnut",
        data: {
          labels: priorityLabels,
          datasets: [
            {
              data: priorityData,
              backgroundColor: ["#f2938c", "#e6c74c", "#aacdec", "#cfcfcf"],
            },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false },
      });
    }

    var ctx1 = document.getElementById("pmChartTasksByStatus");
    if (ctx1) {
      state.charts.status = new Chart(ctx1, {
        type: "bar",
        data: {
          labels: statusLabels,
          datasets: [{ label: "Tasks", data: statusData }],
        },
        options: { responsive: true, maintainAspectRatio: false },
      });
    }

    var projLabels = Object.keys(byProject).sort(function (a, b) {
      return a.localeCompare(b);
    });
    var projData = projLabels.map(function (k) {
      return byProject[k] || 0;
    });

    var ctx2 = document.getElementById("pmChartTasksByProject");
    if (ctx2) {
      state.charts.projectKey = new Chart(ctx2, {
        type: "bar",
        data: {
          labels: projLabels,
          datasets: [{ label: "Tasks", data: projData }],
        },
        options: { responsive: true, maintainAspectRatio: false },
      });
    }

    var bucketLabels = Object.keys(buckets);
    var bucketData = bucketLabels.map(function (k) {
      return buckets[k];
    });

    var ctx3 = document.getElementById("pmChartDueBuckets");
    if (ctx3) {
      var dueColors = bucketLabels.map(function (label) {
        return String(label).toLowerCase() === "overdue"
          ? "#ff4040"
          : "#aacdec";
      });
      state.charts.dueBuckets = new Chart(ctx3, {
        type: "bar",
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
        options: { responsive: true, maintainAspectRatio: false },
      });
    }

    var health = {};
    analyticsTasks.forEach(function (t) {
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

    var overdueTasks = analyticsTasks
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
      wireSortingDelegation();
      wireClearFilters();
      wireRecordModalLinks();
      wireSandboxMessageListener();
      wireModalControls();
      wireAddButtons();
      wireAnalyticsYearFilter();
      wireAnalyticsCategoryFilters();
      wireJumpToTop();

      var projectsUrl = buildQueryUrl(
        [
          PROJECT_IND.projectKey,
          PROJECT_IND.projectName,
          PROJECT_IND.description,
          PROJECT_IND.owner,
          PROJECT_IND.projectStatus,
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
        return hasAnyS1Value(r, [135, 136, 137, 138, 139]);
      });
      var taskRows = taskRowsAll.filter(function (r) {
        return hasAnyS1Value(r, [128, 129, 130, 131, 132, 133, 140, 145, 146]);
      });

      state.projectsAll = projectRows.map(normalizeProject);
      state.tasksAll = taskRows.map(normalizeTask);

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
      populateAssigneeDropdown(state.tasksAll);
      populateCategoryDropdown(state.tasksAll);
      populateStatusDropdown(getKanbanColumnsOrdered());

      [
        "pmSearchInput",
        "pmProjectKeySelect",
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
      await handleTransferFromSandbox();
    }
  }

  handleTransferFromSandbox();
  window.addEventListener("load", handleTransferFromSandbox);
  document.addEventListener("DOMContentLoaded", main);
})();
