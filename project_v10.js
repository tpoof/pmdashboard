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

  // Indicator ID for the isRecurring checkbox field on the Task form.
  // IMPORTANT: Replace 99 with the real LEAF indicator ID once the field is created.
  // TODO: replace 99 with real LEAF indicator ID
  var RECURRING_INDICATOR_ID = 45;

  // Task form indicator IDs
  var TASK_IND = {
    projectKey: 8,
    title: 9,
    status: 10,
    otherSubType: 44,
    assignedTo: 11,
    startDate: 12,
    dueDate: 13,
    priority: 14,
    category: 16,
    dependencies: 17,
    supportTicket: 18,
    okrAssociation: 30,
    keyResultSelection: 39,
    isRecurring: RECURRING_INDICATOR_ID,
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
    keyResultSelection: 37,
  };

  // OKR indicator IDs (Project form)
  var OKR_IND = {
    okrKey: 23,
    objective: 24,
    startDate: 25,
    endDate: 26,
    fiscalYear: 33,
  };

  var KEY_RESULT_IND = {
    okrKey: 35,
    name: 36,
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
  var START_RECURRING_TASK_URL =
    "https://leaf.va.gov/platform/projects/report.php?a=LEAF_Start_Request&id=form_9b302&title=Recurring+Task&" +
    encodeURIComponent(RECURRING_INDICATOR_ID) + "=Yes";
  var START_OKR_URL =
    "https://leaf.va.gov/platform/projects/report.php?a=LEAF_Start_Request&id=form_a2b55&title=OKR";
  var START_KEY_RESULT_URL =
    "https://leaf.va.gov/platform/projects/report.php?a=LEAF_Start_Request&id=form_6530b&title=Key+Result";

  // Persistence keys
  var STORAGE_KEYS = {
    activeTab: "pm_active_tab",
    tasksView: "pm_tasks_view",
    analyticsView: "pm_analytics_view",
    tasksDevOnly: "pmdashboard_tasks_devOnly_v10",
    tasksPagination: "pm_tasks_pagination_v10",
  };

  var STATUS_CONFIG = {
    ALL_STATUSES: [
      "Not Started",
      "In Progress",
      "Ready for HCD Review",
      "Ready for Testing",
      "Ready for PO Review",
      "Other",
      "Completed",
    ],
    LEGACY_KANBAN_COLUMNS: [
      "Not Started",
      "In Progress",
      "Ready for HCD Review",
      "Ready for PO Review",
      "Completed",
      "Other",
    ],
    DEV_KANBAN_COLUMNS: [
      "Not Started",
      "In Progress",
      "Ready for HCD Review",
      "Ready for Testing",
      "Ready for PO Review",
      "Completed",
      "Other",
    ],
    OTHER_SUBTYPES: ["Blocked", "On Hold"],
  };

  var KANBAN_RENDER_LIMIT = 100;
  var KANBAN_RENDER_STEP = 50;

  var PAGINATION_CONFIG = {
    tasks: {
      storageKey: STORAGE_KEYS.tasksPagination,
      containerId: "pmTasksTablePagination",
      defaultPageSize: 100,
      pageSizes: [50, 100, 200],
    },
  };

  var state = {
    projectsAll: [],
    tasksAll: [],
    projectKeyToRecordID: {},
    projectKeyToTitle: {},
    csrfToken: "",
    csrfField: "CSRFToken",
    transferInProgress: false,
    kanbanColumns: [],
    dataReady: false,
    devOnly: false,
    okrTableView: "objectives",
    filters: {
      projectFiscalYear: new Set(),
      projectKey: new Set(),
      status: new Set(),
      assignee: new Set(),
      category: new Set(),
      priority: new Set(),
      analyticsYear: new Set(),
      analyticsQuarter: new Set(),
      okrFiscalYear: new Set(),
    },
    filterControls: {},
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
    },
    keyResultsAll: [],
        projectsLoaded: false,
    tasksVersion: 0,
    projectsVersion: 0,
    tasksById: new Map(),
    cache: {
      tasksFiltered: new Map(),
      tasksSorted: new Map(),
      projects: new Map(),
      kanban: new Map(),
      analytics: new Map(),
      okrs: new Map(),
      analyticsBase: null,
    },
    renderState: {
      projectsSig: "",
      tasksTableSig: "",
      tasksKanbanSig: "",
      tasksGanttSig: "",
      analyticsMainSig: "",
      analyticsOkrsSig: "",
    },
    tabInit: {
      projects: false,
      tasks: false,
      analytics: false,
    },
    viewInit: {
      tasksTable: false,
      tasksKanban: false,
      tasksGantt: false,
      analyticsMain: false,
      analyticsOkrs: false,
    },
    virtualTasks: {
      inited: false,
      rowHeight: 52,
      buffer: 6,
      lastStart: 0,
      lastEnd: 0,
      total: 0,
      lastFocusId: "",
      pendingFocusId: "",
    },
    pagination: {
      tasks: {
        page: 1,
        pageSize: 100,
        signature: "",
        total: 0,
        totalPages: 1,
        inited: false,
      },
    },
    analyticsTables: {
      healthExpanded: false,
      overdueExpanded: false,
      healthRows: [],
      overdueRows: [],
    },
  };



  // Tracks recurring task IDs already copied this session to prevent duplicate copies on re-poll.
  var recurringCopiedThisSession = new Set();

  function safe(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function safeAttr(s) {
    return safe(s).replaceAll('"', "&quot;");
  }

  function getKanbanBaseColumns() {
    return state.devOnly
      ? STATUS_CONFIG.DEV_KANBAN_COLUMNS.slice()
      : STATUS_CONFIG.LEGACY_KANBAN_COLUMNS.slice();
  }

  function getStatusFilterOptions() {
    return getKanbanBaseColumns();
  }

  function normalizePrimaryStatus(status) {
    var raw = String(status || "").trim();
    if (!raw) return "Unknown";
    var lower = raw.toLowerCase();
    var match = STATUS_CONFIG.ALL_STATUSES.find(function (label) {
      return label.toLowerCase() === lower;
    });
    return match || "Unknown";
  }

  function isOtherStatusLabel(status) {
    return normalizePrimaryStatus(status) === "Other";
  }

  async function checkAndCopyResolvedRecurringTasks() {
    try {
      // Pre-fetch CSRF token so createTaskRecord has it available
      // This is necessary when the dashboard is served without Smarty templating
      var token = getCSRFToken();
      if (!token || token.indexOf('{') === 0) {
        token = await fetchCSRFFromAPI();
        if (!token) {
          console.warn('checkAndCopyResolvedRecurringTasks: could not obtain CSRF token, skipping.');
          return;
        }
      }

      var query = new LeafFormQuery();
      query.addTerm('stepID', '=', 'resolved');
      query.addDataTerm('data', TASK_IND.isRecurring, '=', 'Yes');
      query.getData([
        TASK_IND.projectKey,
        TASK_IND.title,
        TASK_IND.assignedTo,
        TASK_IND.startDate,
        TASK_IND.dueDate,
        TASK_IND.priority,
        TASK_IND.category,
        TASK_IND.isRecurring,
      ]);

      var results = await query.execute();

      for (var recordID in results) {
        if (recurringCopiedThisSession.has(recordID)) continue;
        recurringCopiedThisSession.add(recordID);
        try {
          await copyRecurringTask(recordID);
        } catch (e) {
          console.error('Failed to copy recurring task ' + recordID, e);
          recurringCopiedThisSession.delete(recordID);
        }
      }
    } catch (e) {
      console.error('checkAndCopyResolvedRecurringTasks failed', e);
    }
  }

  async function copyRecurringTask(recordID) {
    if (!recordID) throw new Error("copyRecurringTask: missing recordID");

    // Step 1: Read all data from the source record
    var readUrl = "/platform/projects/api/form/" + encodeURIComponent(recordID) + "/data";
    var readResp = await fetch(readUrl, { credentials: "include" });
    if (!readResp.ok) throw new Error("Read failed HTTP " + readResp.status);
    var sourceData = await readResp.json();
    // sourceData is an object keyed by indicatorID -> value

    // Step 2: Create a new blank task record
    var newRecordID = await createTaskRecord();

    // Step 3: Write copied fields to new record
    // Copy all fields EXCEPT status (reset to blank/default) and isRecurring (preserve true)
    var token = await ensureCSRFToken(newRecordID);
    var tokenField = state.csrfField || getCSRFFieldName();
    var url = FORM_POST_ENDPOINT_PREFIX + encodeURIComponent(newRecordID);

    var fieldsToSkip = new Set([
      String(TASK_IND.status),      // do not copy resolved status to new record
      String(TASK_IND.otherSubType) // do not copy sub-type either
    ]);

    var bodyObj = {
      recordID: newRecordID,
      series: 1,
    };
    bodyObj[tokenField] = token;

    // Copy all indicator fields from source, skipping excluded ones
    Object.keys(sourceData).forEach(function (indID) {
      if (!fieldsToSkip.has(String(indID))) {
        bodyObj[indID] = sourceData[indID];
      }
    });

    // Explicitly preserve isRecurring on the copy
    bodyObj[TASK_IND.isRecurring] = "Yes";

    var body = encodeFormBody(bodyObj);
    var headers = {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-requested-with": "XMLHttpRequest",
      "x-csrf-token": token,
      "x-xsrf-token": token,
    };

    var writeResp = await fetch(url, {
      method: "POST",
      headers: headers,
      credentials: "include",
      body: body,
    });
    if (!writeResp.ok) throw new Error("Write failed HTTP " + writeResp.status);

    console.log(
      "Recurring task copied: source=" + recordID + " \u2192 new=" + newRecordID
    );

    // Step 4: Submit the new record to the first workflow step so it
    // appears in the dashboard. dependencyID and actionType must be
    // confirmed in LEAF Admin under the workflow editor for form_9b302.
    // TODO: Replace YOUR_DEPENDENCY_ID with the real dependencyID value
    //       (found in LEAF Admin -> Workflow editor for form_9b302 ->
    //        first step requirement ID, or by inspecting a live task
    //        submission network request).
    // TODO: Confirm actionType is correct for your workflow
    //       (typically "approve" for the initial submission step).
    var workflowToken = await ensureCSRFToken(newRecordID);
    var workflowTokenField = state.csrfField || getCSRFFieldName();
    var workflowUrl =
      "/platform/projects/api/formWorkflow/" +
      encodeURIComponent(newRecordID) +
      "/apply";
    var workflowBody = encodeFormBody({
      dependencyID: "1", // TODO: replace with real value
      actionType: "Submit",               // TODO: confirm for your workflow
      comment: "Auto-submitted by recurring task copy.",
      [workflowTokenField]: workflowToken,
    });
    var workflowResp = await fetch(workflowUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-requested-with": "XMLHttpRequest",
        "x-csrf-token": workflowToken,
        "x-xsrf-token": workflowToken,
      },
      credentials: "include",
      body: workflowBody,
    });
    if (!workflowResp.ok) {
      throw new Error("Workflow submit failed HTTP " + workflowResp.status);
    }
    console.log("Recurring task submitted to workflow: " + newRecordID);

    return newRecordID;
  }

  function getOtherSubTypeValue(value) {
    var raw = String(value || "").trim();
    if (!raw) return "";
    var match = STATUS_CONFIG.OTHER_SUBTYPES.find(function (label) {
      return label.toLowerCase() === raw.toLowerCase();
    });
    return match || "";
  }

  function isDevelopmentTask(t) {
    return String(t.category || "")
      .trim()
      .toLowerCase() === "development";
  }

  var lastFocusedElement = null;
  var otherModalResolve = null;
  var otherModalLastFocused = null;

  // Accessibility: keep focus inside the modal while it is open.
  function getFocusableElements(container) {
    if (!container) return [];
    var selectors =
      'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])';
    return Array.from(container.querySelectorAll(selectors)).filter(
      function (el) {
        if (el.getAttribute("aria-hidden") === "true") return false;
        return !!(el.offsetParent || el === document.activeElement);
      },
    );
  }

  function toggleAppInert(isInert) {
    var app = document.querySelector(".pm-wrap");
    if (!app) return;
    Array.from(app.children).forEach(function (child) {
      if (!child || child.id === "pmModal" || child.id === "pmOtherModal")
        return;
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

  function openModal(title, url, postLoadCallback) {
    var modal = document.getElementById("pmModal");
    var frame = document.getElementById("pmModalFrame");
    var titleEl = document.getElementById("pmModalTitle");
    var openTabBtn = document.getElementById("pmModalOpenTabBtn");
    var closeBtn = document.getElementById("pmModalCloseBtn");
    if (!modal || !frame || !titleEl) return;
    titleEl.textContent = title || "Details";

    // Remove any previous load listener
    if (frame._recurringLoadHandler) {
      frame.removeEventListener("load", frame._recurringLoadHandler);
      frame._recurringLoadHandler = null;
    }

    if (typeof postLoadCallback === "function") {
      frame._recurringLoadHandler = function () {
        frame.removeEventListener("load", frame._recurringLoadHandler);
        frame._recurringLoadHandler = null;
        try {
          postLoadCallback(frame);
        } catch (e) {
          console.warn("postLoadCallback error", e);
        }
      };
      frame.addEventListener("load", frame._recurringLoadHandler);
    }

    frame.src = url;
    frame.setAttribute(
      "title",
      title ? "LEAF content - " + String(title) : "LEAF content"
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

  function isOtherModalOpen() {
    var modal = document.getElementById("pmOtherModal");
    return !!(modal && modal.getAttribute("aria-hidden") === "false");
  }

  function openOtherStatusModal(initialValue) {
    var modal = document.getElementById("pmOtherModal");
    if (!modal) return Promise.resolve("");

    var options = Array.from(
      modal.querySelectorAll('input[name="pmOtherStatus"]'),
    );
    options.forEach(function (opt) {
      opt.checked = getOtherSubTypeValue(initialValue) === opt.value;
    });
    var confirmBtn = document.getElementById("pmOtherModalConfirmBtn");
    if (confirmBtn) {
      confirmBtn.disabled = !getOtherSubTypeValue(initialValue);
    }

    otherModalLastFocused = document.activeElement;
    modal.style.display = "block";
    modal.setAttribute("aria-hidden", "false");
    toggleAppInert(true);
    document.body.style.overflow = "hidden";

    requestAnimationFrame(function () {
      var firstOption = options[0];
      if (firstOption) firstOption.focus();
    });

    return new Promise(function (resolve) {
      otherModalResolve = resolve;
    });
  }

  function closeOtherStatusModal(result) {
    var modal = document.getElementById("pmOtherModal");
    if (!modal) return;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    toggleAppInert(false);
    document.body.style.overflow = "";
    if (otherModalLastFocused && document.contains(otherModalLastFocused)) {
      otherModalLastFocused.focus();
    }
    otherModalLastFocused = null;
    if (otherModalResolve) {
      otherModalResolve(result || "");
      otherModalResolve = null;
    }
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

  async function fetchCSRFFromAPI() {
    // Fetch CSRF token directly from a LEAF page that reliably returns it
    try {
      var r = await fetch('/platform/projects/report.php?a=LEAF_Start_Request&id=form_9b302&title=Task', {
        credentials: 'include'
      });
      var html = await r.text();
      var match = extractCSRFTokenFromHTML(html);
      if (match && match.token) {
        cacheCSRF(match.token, match.field);
        console.log('CSRF token fetched from API successfully.');
        return match.token;
      }
    } catch (e) {
      console.warn('fetchCSRFFromAPI failed:', e);
    }
    return null;
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
    var stepKeys = Object.keys(row).filter(function (k) {
      return /^s\d+$/.test(k);
    });
    for (var i = 0; i < stepKeys.length; i++) {
      var step = row[stepKeys[i]];
      if (step && step[key] != null) return step[key];
    }
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
    var upper = key.toUpperCase();
    var digits = upper.match(/\d+/);
    if (digits && digits[0]) return "OKR-" + digits[0];
    return upper;
  }

  function parseSupportTicket(value) {
    var text = String(value || "").trim();
    if (!text) return { id: "", type: "" };
    var match = text.match(/^(Support|UX|Idea)\s*Ticket\s*#(\d+)/i);
    if (match) return { id: match[2], type: match[1].toLowerCase() };
    return { id: "", type: "" };
  }

  function buildSupportTicketHref(parsed) {
    var id = parsed && parsed.id ? parsed.id : "";
    if (!id) return "";
    var hrefBase =
      parsed.type === "ux"
        ? "/platform/ux/index.php?a=printview&recordID="
        : parsed.type === "idea"
          ? "/platform/ideas/index.php?a=printview&recordID="
          : "/platform/support/index.php?a=printview&recordID=";
    return hrefBase + encodeURIComponent(id);
  }

  function getTicketOriginFromHref(href) {
    var match = String(href || "").match(/\/platform\/([^/]+)/i);
    if (!match) return { key: "", label: "" };
    var key = String(match[1] || "").toLowerCase();
    if (key === "support") return { key: key, label: "Support" };
    if (key === "ideas") return { key: key, label: "Ideas" };
    if (key === "ux") return { key: key, label: "UX" };
    return { key: key, label: "" };
  }

  function supportTicketLink(value) {
    var parsed = parseSupportTicket(value);
    var id = parsed.id;
    if (!id) return "";
    var label = "#" + id;
    var title = parsed.type
      ? (parsed.type === "ux"
          ? "UX Ticket #"
          : parsed.type === "idea"
            ? "Idea Ticket #"
            : "Support Ticket #") + id
      : "Ticket #" + id;
    var href = buildSupportTicketHref(parsed);
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

  function supportTicketChip(value) {
    var parsed = parseSupportTicket(value);
    var id = parsed.id;
    if (!id) return "";
    var label = "#" + id;
    var href = buildSupportTicketHref(parsed);
    var origin = getTicketOriginFromHref(href);
    var originLabel = origin.label || "unknown";
    var tooltip = origin.label
      ? "Imported from " + origin.label + " site"
      : "Imported from unknown site";
    var chipClass =
      "pm-ticketChip" +
      (origin.label
        ? " pm-ticketChip--" + origin.key
        : " pm-ticketChip--unknown");
    var aria = "Ticket " + id + ", " + tooltip;
    return (
      '<span class="' +
      chipClass +
      '">' +
      '<a href="' +
      safe(href) +
      '" class="pm-recordLink pm-ticketLink" data-title="' +
      safeAttr(tooltip) +
      '" aria-label="' +
      safeAttr(aria) +
      '" title="' +
      safeAttr(tooltip) +
      '">' +
      safe(label) +
      "</a>" +
      "</span>"
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
        return setSupportTicketIndicator(
          item.recordID,
          item.id,
          "support",
        ).catch(function () {});
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
      otherSubType: extractFromS1(row, TASK_IND.otherSubType),
      assignedTo: extractFromS1(row, TASK_IND.assignedTo),
      start: extractFromS1(row, TASK_IND.startDate),
      due: extractFromS1(row, TASK_IND.dueDate),
      priority: extractFromS1(row, TASK_IND.priority),
      category: extractFromS1(row, TASK_IND.category),
      supportTicket: extractFromS1(row, TASK_IND.supportTicket),
      okrAssociation: extractFromS1(row, TASK_IND.okrAssociation),
      keyResultSelection: extractFromS1(row, TASK_IND.keyResultSelection),
      isRecurring: row[TASK_IND.isRecurring] === "Yes" || row[TASK_IND.isRecurring] === "1" || row[TASK_IND.isRecurring] === true || row[TASK_IND.isRecurring] === 1,
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
      keyResultSelection: extractFromS1(row, PROJECT_IND.keyResultSelection),
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

  function normalizeKeyResult(row) {
    var recordID = getRecordID(row);
    return {
      recordID: recordID,
      okrKey: String(extractRawIndicator(row, KEY_RESULT_IND.okrKey) || "").trim(),
      keyResultName: String(
        extractRawIndicator(row, KEY_RESULT_IND.name) || "",
      ).trim(),
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

  function hasAnyIndicatorValue(row, indicatorIds) {
    if (!row) return false;
    for (var i = 0; i < indicatorIds.length; i++) {
      var v = extractRawIndicator(row, indicatorIds[i]);
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
    var raw = String(value || "").trim();
    if (!raw) return "Unknown";
    var normalized = raw.replace(/\u2013|\u2014/g, "-");
    var dashIdx = normalized.indexOf("-");
    if (dashIdx !== -1) normalized = normalized.slice(0, dashIdx);
    var label = normalized.trim();
    return label || "Unknown";
  }

  function buildProjectTypeChartData(projects) {
    var counts = {};
    var rawSample = [];
    (projects || []).forEach(function (p) {
      var rawType = String(p.projectType || "").trim();
      if (!rawType) rawType = "Unknown";
      if (rawSample.length < 10) rawSample.push(rawType);
      counts[rawType] = (counts[rawType] || 0) + 1;
    });

    var rawKeys = Object.keys(counts).sort(function (a, b) {
      return a.localeCompare(b);
    });
    var labels = rawKeys.map(function (k) {
      return formatProjectTypeLabel(k);
    });
    var data = rawKeys.map(function (k) {
      return counts[k];
    });
    var formattedSample = rawSample.map(function (v) {
      return formatProjectTypeLabel(v);
    });
    var distinctLabels = Array.from(new Set(labels));

    return {
      rawKeys: rawKeys,
      labels: labels,
      data: data,
      rawSample: rawSample,
      formattedSample: formattedSample,
      distinctLabels: distinctLabels,
    };
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

  function getTaskOtherBadgeLabel(task) {
    if (!task || normalizePrimaryStatus(task.status) !== "Other") return "";
    return getOtherSubTypeValue(task.otherSubType);
  }

  function renderStatusBadge(label, extraClass) {
    if (!label) return "";
    var cls = "pm-statusBadge";
    if (label === "Blocked") cls += " pm-okrPercentBadge--none";
    if (extraClass) cls += " " + extraClass;
    return '<span class="' + cls + '">' + safe(label) + "</span>";
  }

  function renderStatusCell(task) {
    var primary = normalizePrimaryStatus(task.status);
    var badge = getTaskOtherBadgeLabel(task);
    if (primary === "Other" && badge) {
      return (
        '<div class="pm-statusCell"><div>' +
        safe(primary) +
        "</div>" +
        renderStatusBadge(badge) +
        "</div>"
      );
    }
    return safe(primary);
  }

  function getOkrStatusLabel(task) {
    if (isCompletedStatus(task.status)) return "Completed";
    var primary = normalizePrimaryStatus(task.status);
    if (primary === "Other") {
      var subtype = getOtherSubTypeValue(task.otherSubType);
      return subtype ? "Other (" + subtype + ")" : "Other";
    }
    if (primary === "Unknown") return "Unknown";
    return primary;
  }

  function renderOkrStatusTag(task) {
    var label = getOkrStatusLabel(task);
    if (label === "Completed") {
      return '<span class="pm-completeGreen">Completed</span>';
    }
    return '<span class="pm-okrStatusOpen">' + safe(label) + "</span>";
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
        var okrKeyText = String(p.okrAssociation || "").trim();
        var krText = String(p.keyResultSelection || "").trim();
        var okrLink = okrKeyText
          ? okrRecordLink(okrKeyText, okrKeyText)
          : "<span class='pm-okrFallback'>None</span>";
        var krDisplay = krText
          ? safe(krText)
          : "<span class='pm-okrFallback'>No Key Result</span>";
        var okrCombined =
          okrLink +
          ' <span class="pm-okrSep" aria-hidden="true">|</span> ' +
          krDisplay;

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
          safe(p.projectFiscalYear) +
          "</td>" +
          "<td>" +
          okrCombined +
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
      '<th scope="col" class="pm-sortable pm-colKey" data-sort="projectKey" data-type="string"><button type="button" class="pm-sortBtn">Project Key</button></th>' +
      '<th scope="col" class="pm-sortable pm-colName" data-sort="projectName" data-type="string"><button type="button" class="pm-sortBtn">Project Name</button></th>' +
      '<th scope="col" class="pm-sortable pm-colDesc" data-sort="description" data-type="string"><button type="button" class="pm-sortBtn">Description</button></th>' +
      '<th scope="col" class="pm-sortable" data-sort="owner" data-type="string"><button type="button" class="pm-sortBtn">Owner</button></th>' +
      '<th scope="col" class="pm-sortable" data-sort="projectFiscalYear" data-type="string"><button type="button" class="pm-sortBtn">FY</button></th>' +
      '<th scope="col" class="pm-sortable" data-sort="okrAssociation" data-type="string"><button type="button" class="pm-sortBtn">OKR | Key Result</button></th>' +
      '<th scope="col" class="pm-sortable" data-sort="projectStatus" data-type="string"><button type="button" class="pm-sortBtn">Status</button></th>' +
      "</tr></thead>" +
      "<tbody>" +
      rows +
      "</tbody>" +
      "</table>";

    var s = state.sort.projects;
    setSortIndicator("pmProjectsTable", s.key, s.dir);
  }

  function renderOkrsObjectivesTable(projects) {
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

  function renderOkrsKeyResultsTable() {
    var el = document.getElementById("pmOkrsTable");
    if (!el) return;

    var keyResultTextToId = {};
    (state.keyResultsAll || []).forEach(function (kr) {
      var name = String(kr.keyResultName || "").trim();
      var matchKey = normalizeKeyResultMatch(name);
      if (!matchKey) return;
      if (!keyResultTextToId[matchKey] && kr.recordID) {
        keyResultTextToId[matchKey] = kr.recordID;
      }
    });

    var okrMap = {};
    (state.keyResultsAll || []).forEach(function (kr) {
      var okrKey = String(kr.okrKey || "").trim();
      var name = String(kr.keyResultName || "").trim();
      if (!okrKey) return;
      if (!okrMap[okrKey]) okrMap[okrKey] = [];
      if (name) okrMap[okrKey].push(name);
    });

    var okrKeys = Object.keys(okrMap).sort(function (a, b) {
      return a.localeCompare(b, undefined, { numeric: true });
    });

    var rowsData = okrKeys.map(function (okrKey) {
      var names = okrMap[okrKey] || [];
      var uniqueNames = Array.from(new Set(names)).sort(function (a, b) {
        return a.localeCompare(b);
      });
      var concatText = uniqueNames.join(" | ");
      var linkHtml = uniqueNames.length
        ? uniqueNames
            .map(function (name) {
              var matchKey = normalizeKeyResultMatch(name);
              var rid = keyResultTextToId[matchKey];
              if (rid) {
                var href =
                  "index.php?a=printview&recordID=" +
                  encodeURIComponent(rid);
                return (
                  '<a href="' +
                  safe(href) +
                  '" class="pm-recordLink" data-title="' +
                  safe("Key Result " + rid) +
                  '">' +
                  safe(name) +
                  "</a>"
                );
              }
              return safe(name);
            })
            .join("<br />")
        : "<span class='pm-okrFallback'>No Key Results</span>";

      return {
        okrKey: okrKey,
        keyResultsText: concatText,
        keyResultsHtml: linkHtml,
      };
    });

    var s = state.sort.okrs;
    if (s.key === "okrKey" || s.key === "keyResults") {
      rowsData = rowsData.slice().sort(function (a, b) {
        if (s.key === "keyResults") {
          return compareValues(
            a.keyResultsText,
            b.keyResultsText,
            s.dir,
            s.type,
          );
        }
        return compareValues(a.okrKey, b.okrKey, s.dir, "string");
      });
    }

    var rows = rowsData
      .slice(0, 500)
      .map(function (row) {
        var okrLink = row.okrKey ? okrRecordLink(row.okrKey, row.okrKey) : "";
        return (
          "<tr>" +
          "<td>" +
          (okrLink || safe(row.okrKey)) +
          "</td>" +
          "<td>" +
          row.keyResultsHtml +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    el.innerHTML =
      '<table class="pm-table">' +
      "<thead><tr>" +
      '<th scope="col" class="pm-sortable" data-sort="okrKey" data-type="string"><button type="button" class="pm-sortBtn">OKR Key</button></th>' +
      '<th scope="col" class="pm-sortable" data-sort="keyResults" data-type="string"><button type="button" class="pm-sortBtn">Key Results</button></th>' +
      "</tr></thead>" +
      "<tbody>" +
      (rows || "<tr><td colspan='2'>No Key Results found</td></tr>") +
      "</tbody>" +
      "</table>";

    setSortIndicator("pmOkrsTable", s.key, s.dir);
  }

  function renderOkrsTable(projects) {
    if (state.okrTableView === "keyResults") {
      renderOkrsKeyResultsTable();
    } else {
      renderOkrsObjectivesTable(projects);
    }
  }

  
  function buildOkrsSignature(selectedOkrFiscalYears) {
    return [
      "okrs",
      state.tasksVersion,
      state.projectsVersion,
      signatureFromSet(selectedOkrFiscalYears),
      state.okrTableView,
    ].join("|");
  }

  function renderOkrsAnalytics(selectedOkrFiscalYears) {
    var sig = buildOkrsSignature(selectedOkrFiscalYears);
    var cached = state.cache.okrs.get(sig);
    if (cached) {
      var summary = document.getElementById("pmOkrsSummary");
      var indexWrap = document.getElementById("pmOkrIndex");
      var quickStatsEl = document.getElementById("pmOkrQuickStats");
      var table = document.getElementById("pmOkrsTable");
      if (summary) summary.innerHTML = cached.summaryHtml || "";
      if (indexWrap) indexWrap.innerHTML = cached.indexHtml || "";
      if (quickStatsEl) quickStatsEl.innerHTML = cached.quickHtml || "";
      if (table) table.innerHTML = cached.tableHtml || "";
      return;
    }

    var okrFiltered = state.projectsAll;
    if (selectedOkrFiscalYears && selectedOkrFiscalYears.size) {
      okrFiltered = okrFiltered.filter(function (p) {
        return selectedOkrFiscalYears.has(
          String(p.okrFiscalYear || "").trim(),
        );
      });
    }

    var okrBaseProjects = state.projectsAll;
    if (selectedOkrFiscalYears && selectedOkrFiscalYears.size) {
      okrBaseProjects = okrBaseProjects.filter(function (p) {
        return selectedOkrFiscalYears.has(
          String(p.okrFiscalYear || "").trim(),
        );
      });
    }
    var okrBaseTasks = state.tasksAll;

    renderOkrsRollup(
      okrBaseProjects,
      okrBaseProjects,
      okrBaseTasks,
      "",
      "",
      selectedOkrFiscalYears,
    );
    renderOkrsTable(okrFiltered);

    var summary = document.getElementById("pmOkrsSummary");
    var indexWrap = document.getElementById("pmOkrIndex");
    var quickStatsEl = document.getElementById("pmOkrQuickStats");
    var table = document.getElementById("pmOkrsTable");

    state.cache.okrs.set(sig, {
      summaryHtml: summary ? summary.innerHTML : "",
      indexHtml: indexWrap ? indexWrap.innerHTML : "",
      quickHtml: quickStatsEl ? quickStatsEl.innerHTML : "",
      tableHtml: table ? table.innerHTML : "",
    });
  }


  function getProjectLabelFromKey(projectKey) {
    var key = String(projectKey || "").trim();
    var name = key ? state.projectKeyToTitle[key] || "" : "";
    if (key && name) return key + " | " + name;
    return key || name || "Unknown project";
  }

  function getTaskDedupKey(t) {
    if (!t) return "";
    var rid = String(t.recordID || "").trim();
    if (rid) return "id:" + rid;
    var title = String(t.title || "").trim().toLowerCase();
    var projectKey = String(t.projectKey || "").trim().toLowerCase();
    var okrKey = String(t.okrAssociation || "").trim().toLowerCase();
    var kr = String(t.keyResultSelection || "").trim().toLowerCase();
    return ["t", title, projectKey, okrKey, kr].join("|");
  }

  function normalizeProjectKey(val) {
    return String(val || "")
      .replace(/\u00A0/g, " ")
      .trim()
      .replace(/\s+/g, " ")
      .toUpperCase();
  }

  function classifyKr(
    matchKey,
    krName,
    projectsForOkr,
    tasksForOkr,
    projectMapByKey,
  ) {
    var krProjects = (projectsForOkr || []).filter(function (p) {
      return normalizeKeyResultMatch(p.keyResultSelection) === matchKey;
    });
    var krTasksRaw = (tasksForOkr || []).filter(function (t) {
      return normalizeKeyResultMatch(t.keyResultSelection) === matchKey;
    });
    var krTasks = [];
    var krTaskKeys = {};
    krTasksRaw.forEach(function (t) {
      var key = getTaskDedupKey(t);
      if (!key || krTaskKeys[key]) return;
      krTaskKeys[key] = true;
      krTasks.push(t);
    });

    var projectsToRender = [];
    var projectsToRenderMap = {};
    krProjects.forEach(function (p) {
      var pkNorm = normalizeProjectKey(p.projectKey);
      var listKey =
        pkNorm || (p.recordID ? "rid:" + String(p.recordID).trim() : "");
      if (!listKey) return;
      if (!projectsToRenderMap[listKey]) {
        projectsToRenderMap[listKey] = true;
        projectsToRender.push(p);
      }
    });

    var tasksByProjectKey = {};
    var resolvedProjectKeys = {};
    var unresolvedProjectKeys = {};
    krTasks.forEach(function (t) {
      var pkNorm = normalizeProjectKey(t.projectKey);
      if (!pkNorm) return;
      if (projectMapByKey && projectMapByKey[pkNorm]) {
        resolvedProjectKeys[pkNorm] = true;
        if (!tasksByProjectKey[pkNorm]) tasksByProjectKey[pkNorm] = [];
        tasksByProjectKey[pkNorm].push(t);
      } else {
        if (!unresolvedProjectKeys[pkNorm]) {
          unresolvedProjectKeys[pkNorm] = String(t.projectKey || "");
        }
      }
    });

    Object.keys(resolvedProjectKeys)
      .sort(function (a, b) {
        return a.localeCompare(b);
      })
      .forEach(function (pkNorm) {
        var proj = projectMapByKey ? projectMapByKey[pkNorm] : null;
        if (!proj) return;
        if (!projectsToRenderMap[pkNorm]) {
          projectsToRenderMap[pkNorm] = true;
          projectsToRender.push(proj);
        }
      });

    var renderedTaskKeys = {};
    Object.keys(tasksByProjectKey).forEach(function (pkNorm) {
      tasksByProjectKey[pkNorm].forEach(function (t) {
        var key = getTaskDedupKey(t);
        if (key) renderedTaskKeys[key] = true;
      });
    });
    var otherTasks = krTasks.filter(function (t) {
      var key = getTaskDedupKey(t);
      return key ? !renderedTaskKeys[key] : true;
    });

    return {
      krProjects: krProjects,
      tasks: krTasks,
      otherTasks: otherTasks,
      projectsToRender: projectsToRender,
      tasksByProjectKey: tasksByProjectKey,
      resolvedProjectKeys: resolvedProjectKeys,
      unresolvedProjectKeys: unresolvedProjectKeys,
      renderedTaskKeys: renderedTaskKeys,
    };
  }

  function getTaskProjectMeta(projectKey) {
    var key = String(projectKey || "").trim();
    if (!key) return "No project";
    var name = state.projectKeyToTitle[key] || "";
    return key + " | " + (name ? name : "Unknown project");
  }

  function makeSafeId(val) {
    return String(val || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function renderOkrsRollup(
    okrRecords,
    projects,
    tasks,
    searchQuery,
    searchCompact,
    selectedOkrFiscalYears,
  ) {
    var wrap = document.getElementById("pmOkrsRollup");
    var summary = document.getElementById("pmOkrsSummary");
    var indexWrap = document.getElementById("pmOkrIndex");
    var quickStatsEl = document.getElementById("pmOkrQuickStats");
    if (!wrap || !summary) return;

    var okrMap = {};
    (okrRecords || []).forEach(function (r) {
      var key = normalizeOkrKey(r.okrKey);
      if (!key) return;
      if (!okrMap[key]) {
        okrMap[key] = {
          key: key,
          title: String(r.okrObjective || "").trim(),
          fiscalYear: String(r.okrFiscalYear || "").trim(),
        };
      } else if (!okrMap[key].title && r.okrObjective) {
        okrMap[key].title = String(r.okrObjective || "").trim();
      }
    });
    if (!Object.keys(okrMap).length && state.projectsAll.length) {
      (state.projectsAll || []).forEach(function (r) {
        var key = normalizeOkrKey(r.okrKey);
        if (!key) return;
        if (!okrMap[key]) {
          okrMap[key] = {
            key: key,
            title: String(r.okrObjective || "").trim(),
            fiscalYear: String(r.okrFiscalYear || "").trim(),
          };
        } else if (!okrMap[key].title && r.okrObjective) {
          okrMap[key].title = String(r.okrObjective || "").trim();
        }
      });
    }

    var keyResultsByOkr = {};
    (state.keyResultsAll || []).forEach(function (kr) {
      var okrKey = normalizeOkrKey(kr.okrKey);
      var name = String(kr.keyResultName || "").trim();
      if (!okrKey || !name) return;
      var matchKey = normalizeKeyResultMatch(name);
      if (!keyResultsByOkr[okrKey]) keyResultsByOkr[okrKey] = {};
      if (!keyResultsByOkr[okrKey][matchKey])
        keyResultsByOkr[okrKey][matchKey] = name;
    });

    var projectsByOkr = {};
    (projects || []).forEach(function (p) {
      var okrKey = normalizeOkrKey(p.okrAssociation);
      if (!okrKey || !okrMap[okrKey]) return;
      if (!projectsByOkr[okrKey]) projectsByOkr[okrKey] = [];
      projectsByOkr[okrKey].push(p);
    });

    var projectsReady = !!state.projectsLoaded;
    var projectMapByKey = {};
    if (projectsReady) {
      (state.projectsAll || []).forEach(function (p) {
        var pkNorm = normalizeProjectKey(p.projectKey);
        if (pkNorm && !projectMapByKey[pkNorm]) {
          projectMapByKey[pkNorm] = p;
        }
      });
    }

    var tasksByOkr = {};
    (tasks || []).forEach(function (t) {
      var okrKey = normalizeOkrKey(t.okrAssociation);
      if (!okrKey || !okrMap[okrKey]) return;
      if (!tasksByOkr[okrKey]) tasksByOkr[okrKey] = [];
      tasksByOkr[okrKey].push(t);
    });

    var okrKeys = Object.keys(okrMap).sort(function (a, b) {
      return a.localeCompare(b, undefined, { numeric: true });
    });

    var query = String(searchQuery || "").trim();
    var queryCompact = searchCompact || normalizeForSearch(query);
    var searchActive = !!query;

    var okrEntries = okrKeys.map(function (okrKey) {
      var objective = okrMap[okrKey];
      var projectsForOkr = projectsByOkr[okrKey] || [];
      var tasksForOkr = tasksByOkr[okrKey] || [];
      var keyResultNameMap = keyResultsByOkr[okrKey]
        ? Object.assign({}, keyResultsByOkr[okrKey])
        : {};

      if (!Object.keys(keyResultNameMap).length) {
        projectsForOkr.forEach(function (p) {
          var name = String(p.keyResultSelection || "").trim();
          if (!name) return;
          var matchKey = normalizeKeyResultMatch(name);
          if (!keyResultNameMap[matchKey]) keyResultNameMap[matchKey] = name;
        });
        tasksForOkr.forEach(function (t) {
          var name = String(t.keyResultSelection || "").trim();
          if (!name) return;
          var matchKey = normalizeKeyResultMatch(name);
          if (!keyResultNameMap[matchKey]) keyResultNameMap[matchKey] = name;
        });
      }

      var krMatchKeys = [];
      if (searchActive) {
        Object.keys(keyResultNameMap).forEach(function (matchKey) {
          var name = keyResultNameMap[matchKey];
          if (matchesQuery(name, query, queryCompact))
            krMatchKeys.push(matchKey);
        });
      }

      var objectiveMatch =
        searchActive &&
        (matchesQuery(objective.title, query, queryCompact) ||
          matchesQuery(okrKey, query, queryCompact));
      var include = !searchActive || objectiveMatch || krMatchKeys.length > 0;

      return {
        okrKey: okrKey,
        objective: objective,
        projectsForOkr: projectsForOkr,
        tasksForOkr: tasksForOkr,
        keyResultNameMap: keyResultNameMap,
        krMatchKeys: krMatchKeys,
        objectiveMatch: objectiveMatch,
        include: include,
      };
    });

    var okrEntriesFiltered = okrEntries.filter(function (entry) {
      if (selectedOkrFiscalYears && selectedOkrFiscalYears.size) {
        var fy = String(entry.objective.fiscalYear || "").trim();
        if (!selectedOkrFiscalYears.has(fy)) return false;
      }
      return entry.include;
    });

    if (!okrEntriesFiltered.length) {
      summary.innerHTML =
        "<div class='pm-okrCard'>No OKRs found for this selection.</div>";
      if (indexWrap) indexWrap.innerHTML = "";
      if (quickStatsEl) quickStatsEl.innerHTML = "";
    } else {
      var initialCount = 8;
      var stepCount = 8;
      var visibleCount = Math.min(initialCount, okrEntriesFiltered.length);

      var quickKrCount = 0;
      var quickPercentSum = 0;
      var indexItems = [];
      var cardsHtml = okrEntriesFiltered
        .map(function (entry, idx) {
          var okrKey = entry.okrKey;
          var objective = entry.objective;
          var projectsForOkr = entry.projectsForOkr;
          var tasksForOkr = entry.tasksForOkr;
          var keyResultNameMap = entry.keyResultNameMap;
          var krMatchKeys = entry.krMatchKeys || [];
          var cardExpanded =
            searchActive &&
            (entry.objectiveMatch || (krMatchKeys && krMatchKeys.length > 0));

          var keyResultItems = Object.keys(keyResultNameMap)
            .map(function (matchKey) {
              var krName = keyResultNameMap[matchKey];
              var classification = classifyKr(
                matchKey,
                krName,
                projectsForOkr,
                tasksForOkr,
                projectMapByKey,
              );
              var krTasks = classification.tasks;
              var krProjects = classification.projectsToRender;
              var otherTasks = classification.otherTasks;
              var tasksByProjectKey = classification.tasksByProjectKey;
              otherTasks.sort(function (a, b) {
                var aComplete = isCompletedStatus(a.status);
                var bComplete = isCompletedStatus(b.status);
                if (aComplete !== bComplete) return aComplete ? 1 : -1;
                var aName = String(a.title || "").trim();
                var bName = String(b.title || "").trim();
                var nameCmp = aName.localeCompare(bName, undefined, {
                  sensitivity: "base",
                  numeric: true,
                });
                if (nameCmp !== 0) return nameCmp;
                var aId = String(a.recordID || "").trim();
                var bId = String(b.recordID || "").trim();
                return aId.localeCompare(bId, undefined, { numeric: true });
              });
              var completedTasks = krTasks.filter(function (t) {
                return isCompletedStatus(t.status);
              }).length;
              var totalTasks = krTasks.length;
              var pct = totalTasks
                ? Math.round((completedTasks / totalTasks) * 100)
                : 0;

              return {
                name: krName,
                matchKey: matchKey,
                projects: krProjects,
                tasks: krTasks,
                tasksByProjectKey: classification.tasksByProjectKey,
                otherTasks: otherTasks,
                completedTasks: completedTasks,
                totalTasks: totalTasks,
                percent: pct,
              };
            })
            .sort(function (a, b) {
              if (b.percent !== a.percent) return b.percent - a.percent;
              return a.name.localeCompare(b.name);
            });

          quickKrCount += keyResultItems.length;
          // Quick view uses OKR-level average percent; no task totals needed.

          var avgPercent = 0;
          if (keyResultItems.length) {
            avgPercent = Math.round(
              keyResultItems.reduce(function (sum, kr) {
                return sum + kr.percent;
              }, 0) / keyResultItems.length,
            );
          }

          quickPercentSum += avgPercent;

          var okrProjectKeys = {};
          keyResultItems.forEach(function (kr) {
            (kr.projects || []).forEach(function (p) {
              var pk = String(p.projectKey || "").trim();
              var key =
                pk || (p.recordID ? "rid:" + String(p.recordID).trim() : "");
              if (key) okrProjectKeys[key] = true;
            });
          });
          var okrProjectCount = Object.keys(okrProjectKeys).length;

          var okrTaskKeys = {};
          keyResultItems.forEach(function (kr) {
            (kr.tasks || []).forEach(function (t) {
              var key = getTaskDedupKey(t);
              if (key) okrTaskKeys[key] = true;
            });
          });
          var okrTaskCount = Object.keys(okrTaskKeys).length;

          var pctClass = "pm-okrPercentBadge";
          if (avgPercent === 0) pctClass += " pm-okrPercentBadge--none";
          else if (avgPercent >= 100)
            pctClass += " pm-okrPercentBadge--complete";

          var okrLabel = safeAttr(okrKey);
          var okrKeyLink = okrRecordLink(okrKey, okrKey);
          var cardId = "pmOkrCard-" + makeSafeId(okrKey);
          var cardBodyId = cardId + "-body";

          indexItems.push({
            okrKey: okrKey,
            title: objective.title,
            percent: avgPercent,
            cardId: cardId,
          });
          var listId = "pmKrList-" + makeSafeId(okrKey);

          var keyResultList = keyResultItems.length
            ? "<ul class='pm-krList' id='" + listId + "'>" +
              keyResultItems
                .map(function (kr) {
                  var krId =
                    "pmKr-" + makeSafeId(okrKey + "-" + kr.matchKey);
                  var projId = krId + "-projects";
                  var otherId = krId + "-other";
                  var extraClass = "";
                  var krHighlight =
                    searchActive && krMatchKeys.indexOf(kr.matchKey) !== -1
                      ? " pm-krHighlight"
                      : "";
                  var projList = kr.projects.length
                    ? "<ul class='pm-krProjectList'>" +
                      kr.projects
                        .map(function (p, projIdx) {
                          var pk = String(p.projectKey || "").trim();
                          var pkNorm = normalizeProjectKey(pk);
                          var name = String(p.projectName || "").trim();
                          var label = name
                            ? name + (pk ? " (" + pk + ")" : "")
                            : pk || "Untitled project";
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
                              safe("Project " + (p.projectKey || "")) +
                              '">' +
                              safe(label) +
                              "</a>"
                            : safe(label);
                          var projectTasks = [];
                          if (pkNorm && kr.tasksByProjectKey) {
                            projectTasks = kr.tasksByProjectKey[pkNorm] || [];
                          }
                          var completedProjectTasks = projectTasks.filter(
                            function (t) {
                              return isCompletedStatus(t.status);
                            },
                          ).length;
                          var taskSummary =
                            "Tasks: " +
                            projectTasks.length +
                            " total, " +
                            completedProjectTasks +
                            " completed";
                          var projectTaskId =
                            krId + "-project-" + projIdx + "-tasks";
                          var taskList = projectTasks.length
                            ? "<ul class='pm-krTaskList'>" +
                              projectTasks
                                .map(function (t) {
                                  var title = String(t.title || "").trim();
                                  var taskLabel =
                                    title ||
                                    (t.recordID
                                      ? "Task " + t.recordID
                                      : "Task");
                                  var projectLabel = getProjectLabelFromKey(
                                    t.projectKey,
                                  );
                                  var statusLabel = renderOkrStatusTag(t);
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
                            : "<div class='pm-okrItem'>No tasks for this project.</div>";

                          return (
                            "<li class='pm-krProject'>" +
                            "<div class='pm-krProjectRow'>" +
                            "<div class='pm-krProjectName'>" +
                            link +
                            "</div>" +
                            "<div class='pm-krProjectMeta'>" +
                            safe(taskSummary) +
                            "</div>" +
                            "<button type='button' class='pm-okrToggle pm-krProjectToggle' data-target='" +
                            projectTaskId +
                            "' data-label='Tasks' data-okr='" +
                            okrLabel +
                            "' data-count='" +
                            projectTasks.length +
                            "' aria-expanded='true' aria-controls='" +
                            projectTaskId +
                            "' aria-label='Hide Tasks for OKR " +
                            okrLabel +
                            " key result " +
                            safeAttr(kr.name) +
                            "'>Hide Tasks (" +
                            projectTasks.length +
                            ")</button>" +
                            "</div>" +
                            "<div class='pm-okrDetails' id='" +
                            projectTaskId +
                            "' role='region' aria-label='Tasks for OKR " +
                            okrLabel +
                            " key result " +
                            safeAttr(kr.name) +
                            "' aria-hidden='false'>" +
                            taskList +
                            "</div>" +
                            "</li>"
                          );
                        })
                        .join("") +
                      "</ul>"
                    : "<div class='pm-okrItem'>No associated projects.</div>";

                  var otherList = kr.otherTasks.length
                    ? "<ul class='pm-krOtherList'>" +
                      kr.otherTasks
                        .map(function (t) {
                          var title = String(t.title || "").trim();
                          var taskLabel =
                            title ||
                            (t.recordID ? "Task " + t.recordID : "Task");
                          var statusLabel = renderOkrStatusTag(t);
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
                          var projectMeta =
                            "Project: " + getTaskProjectMeta(t.projectKey);
                          return (
                            "<li class='pm-okrItem'>" +
                            taskLink +
                            " — " +
                            '<span class="pm-krOtherMeta">' +
                            safe(projectMeta) +
                            "</span>" +
                            " (" +
                            statusLabel +
                            ")" +
                            "</li>"
                          );
                        })
                        .join("") +
                      "</ul>"
                    : "<div class='pm-okrItem'>No other contributing items.</div>";

                  var exceptionCount = kr.otherTasks.length;
                  var hasExceptions = exceptionCount > 0;
                  var krDetailsId = krId + "-details";
                  var exceptionBadge = hasExceptions
                    ? "<span class='pm-krBadge'>Exceptions: " +
                      exceptionCount +
                      "</span>"
                    : "";
                  var countsLabel =
                    "Tasks: " +
                    kr.completedTasks +
                    " / " +
                    kr.totalTasks +
                    " | Projects: " +
                    kr.projects.length;
                  var otherToggleClass =
                    "pm-okrToggle pm-krOtherToggle" +
                    (hasExceptions ? "" : " pm-krOtherToggle--muted");
                  var projectsToggle =
                    "<button type='button' class='pm-okrToggle pm-krProjectsToggle' data-target='" +
                    projId +
                    "' data-label='Projects' data-okr='" +
                    okrLabel +
                    "' data-count='" +
                    kr.projects.length +
                    "' aria-expanded='true' aria-controls='" +
                    projId +
                    "' aria-label='Hide Projects for OKR " +
                    okrLabel +
                    " key result " +
                    safeAttr(kr.name) +
                    "'>Hide Projects (" +
                    kr.projects.length +
                    ")</button>";
                  var otherToggle = hasExceptions
                    ? "<button type='button' class='" +
                      otherToggleClass +
                      "' data-target='" +
                      otherId +
                      "' data-label='Other contributing items' data-okr='" +
                      okrLabel +
                      "' data-count='" +
                      exceptionCount +
                      "' aria-expanded='false' aria-controls='" +
                      otherId +
                      "' aria-label='Expand Other contributing items for OKR " +
                      okrLabel +
                      " key result " +
                      safeAttr(kr.name) +
                      "'>Other contributing items (" +
                      exceptionCount +
                      ")</button>"
                    : "";
                  var otherBlock = hasExceptions
                    ? "<div class='pm-krDetailBlock'>" +
                      otherToggle +
                      "<div class='pm-okrDetails' id='" +
                      otherId +
                      "' role='region' aria-label='Other contributing items for OKR " +
                      okrLabel +
                      " key result " +
                      safeAttr(kr.name) +
                      "' aria-hidden='true' hidden>" +
                      "<div class='pm-okrHelper'>Tasks tagged to this Key Result whose project is tagged to a different Key Result or is not set.</div>" +
                      otherList +
                      "</div>" +
                      "</div>"
                    : "";

                  return (
                    "<li class='pm-krItem" +
                    extraClass +
                    "'>" +
                    "<div class='pm-krRow" +
                    (hasExceptions ? " pm-krRow--hasExceptions" : "") +
                    "'>" +
                    "<div class='pm-krName" +
                    krHighlight +
                    "'>" +
                    safe(kr.name) +
                    "</div>" +
                    "<div class='pm-krProgressWrap'>" +
                    "<div class='pm-krProgress' aria-hidden='true'><div class='pm-krProgressBar' style='width:" +
                    kr.percent +
                    "%'></div></div>" +
                    "<div class='pm-krPercent'>" +
                    kr.percent +
                    "%</div>" +
                    "</div>" +
                    "<div class='pm-krCounts'>" +
                    safe(countsLabel) +
                    "</div>" +
                    "<div class='pm-krActions'>" +
                    exceptionBadge +
                    "<button type='button' class='pm-krRowToggle' data-target='" +
                    krDetailsId +
                    "' aria-expanded='false' aria-controls='" +
                    krDetailsId +
                    "' data-kr='" +
                    safeAttr(kr.name) +
                    "' aria-label='Expand details for key result " +
                    safeAttr(kr.name) +
                    "'>Details</button>" +
                    "</div>" +
                    "</div>" +
                    "<div class='pm-okrDetails pm-krDetails' id='" +
                    krDetailsId +
                    "' role='region' aria-label='Details for key result " +
                    safeAttr(kr.name) +
                    "' aria-hidden='true' hidden>" +
                    "<div class='pm-krDetailBlock'>" +
                    projectsToggle +
                    "<div class='pm-okrDetails' id='" +
                    projId +
                    "' role='region' aria-label='Projects for OKR " +
                    okrLabel +
                    " key result " +
                    safeAttr(kr.name) +
                    "' aria-hidden='false'>" +
                    projList +
                    "</div>" +
                    "</div>" +
                    otherBlock +
                    "</div>" +
                    "</li>"
                  );
                })
                .join("") +
              "</ul>"
            : "<div class='pm-krEmpty'>No Key Results found.</div>";

          return (
            "<div class='pm-okrCard" +
            (idx >= visibleCount ? " is-hidden" : "") +
            (cardExpanded ? " is-expanded" : "") +
            "' id='" +
            cardId +
            "' data-okr-index='" +
            idx +
            "' data-okr-key='" +
            okrLabel +
            "'>" +
            "<div class='pm-okrCardHeader'>" +
            "<div class='pm-okrTitle'>" +
            safe(objective.title || "Untitled objective") +
            "</div>" +
            "<div class='pm-okrMeta'>" +
            "<span class='pm-okrKeyBadge'>" +
            (okrKeyLink || safe(okrKey)) +
            "</span>" +
            "<span class='" +
            pctClass +
            "'>" +
            avgPercent +
            "%</span>" +
            "</div>" +
            "</div>" +
            "<div class='pm-okrProgress' role='img' aria-label='Objective " +
            okrLabel +
            " is " +
            avgPercent +
            "% complete'>" +
            "<div class='pm-okrProgressBar' style='width:" +
            avgPercent +
            "%'></div>" +
            "</div>" +
            "<div class='pm-okrSummaryRow'>" +
            "<div class='pm-okrStats'>" +
            "<span class='pm-okrStat'>Key Results: " +
            keyResultItems.length +
            "</span>" +
            "<span class='pm-okrStat'>Projects: " +
            okrProjectCount +
            "</span>" +
            "<span class='pm-okrStat'>Tasks: " +
            okrTaskCount +
            "</span>" +
            "</div>" +
            "<button type='button' class='pm-okrCardToggle' data-target='" +
            cardBodyId +
            "' aria-expanded='" +
            (cardExpanded ? "true" : "false") +
            "' aria-controls='" +
            cardBodyId +
            "' data-okr='" +
            okrLabel +
            "' aria-label='" +
            (cardExpanded ? "Collapse OKR " : "Expand OKR ") +
            okrLabel +
            "'>" +
            (cardExpanded ? "Collapse" : "Expand") +
            "</button>" +
            "</div>" +
            "<div class='pm-okrCardBody' id='" +
            cardBodyId +
            "' role='region' aria-label='Key Results for OKR " +
            okrLabel +
            "' aria-hidden='" +
            (cardExpanded ? "false" : "true") +
            "'" +
            (cardExpanded ? "" : " hidden") +
            ">" +
            "<div class='pm-krSection'>" +
            "<div class='pm-krHeader'>" +
            "<div class='pm-krHeaderTitle'>Key Results (" +
            keyResultItems.length +
            ")</div>" +
            "</div>" +
            keyResultList +
            "</div>" +
            "</div>" +
            "</div>"
          );
        })
        .join("");

      var showMoreBtn =
        okrEntriesFiltered.length > visibleCount
          ? "<div class='pm-okrShowMore'><button type='button' class='pm-okrShowMoreBtn' data-visible='" +
            visibleCount +
            "' data-step='" +
            stepCount +
            "' data-total='" +
            okrEntriesFiltered.length +
            "' aria-expanded='false'>Show more Objectives</button></div>"
          : "";

      var quickOverallPercent = okrEntriesFiltered.length
        ? Math.round(quickPercentSum / okrEntriesFiltered.length)
        : 0;
      if (quickStatsEl) {
        quickStatsEl.innerHTML =
          "<span class='pm-okrQuickStat'>Objectives: " +
          okrEntriesFiltered.length +
          "</span>" +
          "<span class='pm-okrQuickStat'>Key Results: " +
          quickKrCount +
          "</span>" +
          "<span class='pm-okrQuickStat'>Overall: " +
          quickOverallPercent +
          "%</span>";
      }

      if (indexWrap) {
        var indexHtml =
          "<div class='pm-okrIndexGrid'>" +
          indexItems
            .map(function (item) {
              var title = item.title || "Untitled objective";
              return (
                "<div class='pm-okrIndexItem' role='button' tabindex='0' data-target='" +
                item.cardId +
                "' data-okr='" +
                safeAttr(item.okrKey) +
                "' aria-label='Jump to OKR " +
                safeAttr(item.okrKey) +
                "'>" +
                "<div class='pm-okrIndexKey'>" +
                safe(item.okrKey) +
                "</div>" +
                "<div class='pm-okrIndexTitle' title='" +
                safeAttr(title) +
                "'>" +
                safe(title) +
                "</div>" +
                "<div class='pm-okrIndexProgressWrap'>" +
                "<div class='pm-okrIndexProgress' aria-hidden='true'><div class='pm-okrIndexBar' style='width:" +
                item.percent +
                "%'></div></div>" +
                "<div class='pm-okrIndexPercent'>" +
                item.percent +
                "%</div>" +
                "</div>" +
                "</div>"
              );
            })
            .join("") +
          "</div>";
        indexWrap.innerHTML = indexHtml;
      }

      summary.innerHTML = cardsHtml + showMoreBtn;
    }
  }


  
  function initTasksVirtualTable() {
    var container = document.querySelector("#pmTasksTableWrap .pm-tableWrap");
    var el = document.getElementById("pmTasksTable");
    if (!container || !el) return null;

    function readTasksRowHeight() {
      var computed = window.getComputedStyle(container);
      var rh = parseFloat(
        computed.getPropertyValue("--pm-tasks-row-height"),
      );
      if (!rh || isNaN(rh)) {
        rh = parseFloat(computed.getPropertyValue("--pm-row-height"));
      }
      return rh && !isNaN(rh) ? rh : 52;
    }

    if (!state.virtualTasks) {
      state.virtualTasks = {
        inited: false,
        rowHeight: 52,
        buffer: 6,
        lastStart: 0,
        lastEnd: 0,
        total: 0,
        lastFocusId: "",
        pendingFocusId: "",
      };
    }

    if (!state.virtualTasks.inited) {
      var headerHtml =
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
        "</tr></thead>";

      el.innerHTML =
        '<table class="pm-table pm-virtualTable">' +
        headerHtml +
        "<tbody></tbody></table>";

      state.virtualTasks.container = container;
      state.virtualTasks.tbody = el.querySelector("tbody");
      state.virtualTasks.colCount = 11;
      state.virtualTasks.inited = true;

      state.virtualTasks.rowHeight = readTasksRowHeight();

      container.addEventListener(
        "scroll",
        function () {
          updateTasksVirtualSlice(false);
        },
        { passive: true },
      );

      window.addEventListener("resize", function () {
        state.virtualTasks.rowHeight = readTasksRowHeight();
        updateTasksVirtualSlice(true);
      });

      el.addEventListener("focusin", function (e) {
        var row = e.target.closest("tr[data-taskid]");
        if (row) {
          state.virtualTasks.lastFocusId =
            row.getAttribute("data-taskid") || "";
        }
      });
    }

    return state.virtualTasks;
  }

  function buildTasksRowHtml(t, now) {
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

    var titleText = String(t.title || "(No title)");
    var titleAttr = safeAttr(titleText);

    return (
      '<tr class="pm-virtualRow" data-taskid="' +
      safeAttr(t.recordID) +
      '">' +
      "<td>" +
      pkLink +
      "</td>" +
      "<td>" +
      taskLink +
      "</td>" +
      '<td><span class="pm-titleClamp" title="' +
      titleAttr +
      '" aria-label="' +
      titleAttr +
      '" tabindex="0">' +
      safe(titleText) +
      "</span></td>" +
      "<td>" +
      renderStatusCell(t) +
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
      supportTicketChip(t.supportTicket) +
      "</td>" +
      "</tr>"
    );
  }

  function buildTasksTableRowsHtml(items, start, end, rowHeight, colCount) {
    var now = new Date();
    var topHeight = start * rowHeight;
    var bottomHeight = (items.length - end) * rowHeight;
    var html = "";

    if (topHeight > 0) {
      html +=
        '<tr class="pm-virtualSpacer" aria-hidden="true"><td colspan="' +
        colCount +
        '" style="height:' +
        topHeight +
        'px"></td></tr>';
    }

    for (var i = start; i < end; i++) {
      html += buildTasksRowHtml(items[i], now);
    }

    if (bottomHeight > 0) {
      html +=
        '<tr class="pm-virtualSpacer" aria-hidden="true"><td colspan="' +
        colCount +
        '" style="height:' +
        bottomHeight +
        'px"></td></tr>';
    }

    return html;
  }

  function updateTasksVirtualSlice(force) {
    var v = state.virtualTasks;
    if (!v || !v.inited) return;
    var items = v.items || [];
    var total = items.length;
    var container = v.container;
    var tbody = v.tbody;
    if (!container || !tbody) return;

    var active = document.activeElement;
    if (active && tbody.contains(active)) {
      var row = active.closest("tr[data-taskid]");
      if (row) v.pendingFocusId = row.getAttribute("data-taskid") || "";
    }

    if (!total) {
      if (force || v.total !== 0) tbody.innerHTML = "";
      v.total = 0;
      v.lastStart = 0;
      v.lastEnd = 0;
      return;
    }

    var rowHeight = v.rowHeight || 52;
    var viewportHeight = container.clientHeight || 0;
    if (!viewportHeight) {
      viewportHeight = Math.min(600, window.innerHeight || 600);
    }
    var scrollTop = container.scrollTop || 0;
    var buffer = v.buffer || 6;

    var start = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
    var end = Math.min(
      total,
      Math.ceil((scrollTop + viewportHeight) / rowHeight) + buffer,
    );

    if (!force && start === v.lastStart && end === v.lastEnd && total === v.total)
      return;

    v.lastStart = start;
    v.lastEnd = end;
    v.total = total;

    var html = buildTasksTableRowsHtml(
      items,
      start,
      end,
      rowHeight,
      v.colCount || 11,
    );
    var tpl = document.createElement("template");
    tpl.innerHTML = html;
    tbody.replaceChildren(tpl.content);

    if (v.pendingFocusId) {
      var selector =
        'tr[data-taskid="' +
        String(v.pendingFocusId).replace(/"/g, '\\"') +
        '"]';
      var focusRow = tbody.querySelector(selector);
      if (focusRow) {
        var focusTarget = focusRow.querySelector(
          'a,button,[tabindex]:not([tabindex="-1"])',
        );
        if (focusTarget) focusTarget.focus({ preventScroll: true });
        v.pendingFocusId = "";
      } else if (v.container) {
        v.container.focus({ preventScroll: true });
      }
    }
  }

  function renderTasksTable(tasks) {
    var v = initTasksVirtualTable();
    if (!v) return;
    v.items = tasks || [];
    v.total = v.items.length;
    updateTasksVirtualSlice(true);

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

  async function updateTaskStatus(recordID, newStatus, otherSubType) {
    if (!recordID) throw new Error("Missing recordID");
    var token = await ensureCSRFToken(recordID);
    if (!token) throw new Error("Missing CSRFToken");
    var tokenField = state.csrfField || getCSRFFieldName();

    var url = FORM_POST_ENDPOINT_PREFIX + encodeURIComponent(recordID);
    var isOther = isOtherStatusLabel(newStatus);
    var subType = getOtherSubTypeValue(otherSubType);
    if (isOther && !subType) {
      throw new Error("Other status requires a subtype.");
    }
    var bodyObj = {
      10: newStatus,
      44: isOther ? subType : "",
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
    var label =
      (sourceType === "ux"
        ? "UX Ticket #"
        : sourceType === "idea"
          ? "Idea Ticket #"
          : "Support Ticket #") + sourceId;
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
    var ideaId = getQueryParam("transferFromIdea");
    var legacyId = getQueryParam("transferFromSandbox");
    var sourceId = supportId || uxId || ideaId || legacyId;
    var sourceType = uxId ? "ux" : ideaId ? "idea" : "support";
    var sourceLabel =
      sourceType === "ux" ? "UX" : sourceType === "idea" ? "Idea" : "Support";
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
      params.delete("transferFromIdea");
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

  
  function renderKanbanCard(t, col) {
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

    var badge = getTaskOtherBadgeLabel(t);
    var cardLabel =
      "Task " +
      String(t.recordID || "") +
      ": " +
      String(t.title || "(No title)") +
      ". Status " +
      String(col || "") +
      (badge ? " " + badge + "." : ".");

    var badgeHtml = badge
      ? '<div class="pm-cardBadgeWrap">' +
        renderStatusBadge(badge) +
        "</div>"
      : "";

    return (
      "" +
      '<div class="pm-card" draggable="true" data-taskid="' +
      safe(t.recordID) +
      '" data-status="' +
      safe(col) +
      '" tabindex="0" role="group" aria-label="' +
      safeAttr(cardLabel) +
      '" aria-describedby="pmKanbanHint">' +
      '<div class="pm-card-header">' +
      '<div class="pm-card-title">' +
      safe(t.title || "(No title)") +
      "</div>" +
      badgeHtml +
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
  }

  function getKanbanCacheEntry(sig, tasks, filters) {
    var cached = state.cache.kanban.get(sig);
    if (cached) return normalizeKanbanCache(cached);

    var baseCols = getKanbanBaseColumns().filter(function (col) {
      return (
        String(col || "")
          .toLowerCase()
          .indexOf("archive") === -1
      );
    });
    var grouped = {};
    var columnsByKey = {};
    var columns = baseCols.map(function (c) {
      grouped[c] = [];
      var colObj = {
        key: c,
        title: c,
        totalCount: 0,
        visibleCards: 0,
        hasMore: false,
      };
      columnsByKey[c] = colObj;
      return colObj;
    });

    (tasks || []).forEach(function (t) {
      var st = normalizePrimaryStatus(t.status);
      if (!grouped[st]) {
        grouped[st] = [];
        if (!columnsByKey[st]) {
          var colObj = {
            key: st,
            title: st,
            totalCount: 0,
            visibleCards: 0,
            hasMore: false,
          };
          columnsByKey[st] = colObj;
          columns.push(colObj);
        }
      }
      grouped[st].push(t);
    });

    var visibleCounts = {};
    columns.forEach(function (colObj) {
      var total = (grouped[colObj.key] || []).length;
      var visible = Math.min(KANBAN_RENDER_LIMIT, total);
      colObj.totalCount = total;
      colObj.visibleCards = visible;
      colObj.hasMore = total > visible;
      visibleCounts[colObj.key] = visible;
    });

    var entry = {
      signature: sig,
      filters: filters,
      columns: columns,
      grouped: grouped,
      visibleCounts: visibleCounts,
    };
    normalizeKanbanCache(entry);
    state.cache.kanban.set(sig, entry);
    return entry;
  }

  function normalizeKanbanCache(cache) {
    if (!cache) return cache;
    if (!cache.grouped) cache.grouped = {};
    var cols = cache.columns;
    if (!Array.isArray(cols) || !cols.length) {
      cols = getKanbanBaseColumns()
        .filter(function (col) {
          return (
            String(col || "")
              .toLowerCase()
              .indexOf("archive") === -1
          );
        })
        .map(function (c) {
          return {
            key: c,
            title: c,
            totalCount: 0,
            visibleCards: 0,
            hasMore: false,
          };
        });
    } else if (typeof cols[0] === "string") {
      cols = cols.map(function (c) {
        return {
          key: c,
          title: c,
          totalCount: 0,
          visibleCards: 0,
          hasMore: false,
        };
      });
    }

    var seen = {};
    cols.forEach(function (colObj) {
      if (!colObj || !colObj.key) return;
      seen[colObj.key] = true;
      if (!cache.grouped[colObj.key]) cache.grouped[colObj.key] = [];
    });

    Object.keys(cache.grouped).forEach(function (key) {
      if (!seen[key]) {
        cols.push({
          key: key,
          title: key,
          totalCount: 0,
          visibleCards: 0,
          hasMore: false,
        });
        if (!cache.grouped[key]) cache.grouped[key] = [];
      }
    });

    cache.columns = cols;
    if (!cache.visibleCounts) cache.visibleCounts = {};
    cols.forEach(function (colObj) {
      var list = cache.grouped[colObj.key] || [];
      var total = list.length;
      var visible = cache.visibleCounts[colObj.key];
      if (visible == null) visible = Math.min(KANBAN_RENDER_LIMIT, total);
      if (visible > total) visible = total;
      cache.visibleCounts[colObj.key] = visible;
      colObj.totalCount = total;
      colObj.visibleCards = visible;
      colObj.hasMore = total > visible;
    });

    return cache;
  }

  function updateKanbanColumnMeta(colEl, visible, total) {
    if (!colEl) return;
    var countEl = colEl.querySelector(".pm-kanban-count");
    if (countEl) countEl.textContent = "Showing " + visible + " of " + total;
    var totalEl = colEl.querySelector(".pm-kanban-total");
    if (totalEl) totalEl.textContent = String(total);
  }

  function appendKanbanCards(body, tasks, col) {
    if (!body || !tasks || !tasks.length) return;
    var html = tasks
      .map(function (t) {
        return renderKanbanCard(t, col);
      })
      .join("");
    var tpl = document.createElement("template");
    tpl.innerHTML = html;
    body.appendChild(tpl.content);
    wireKanbanDnD();
  }

  function wireKanbanLoadMore() {
    var board = document.getElementById("pmKanbanBoard");
    if (!board || board.dataset.loadmoreBound === "1") return;
    board.dataset.loadmoreBound = "1";

    board.addEventListener("click", function (e) {
      var btn = e.target.closest(".pm-kanban-moreBtn");
      if (!btn) return;
      var status = btn.getAttribute("data-status") || "";
      var sig = state.currentKanbanSig;
      var cache = sig ? state.cache.kanban.get(sig) : null;
      cache = normalizeKanbanCache(cache);
      if (!cache || !cache.grouped) return;

      var colTasks = cache.grouped[status] || [];
      var visible = cache.visibleCounts[status] || 0;
      var step = parseInt(btn.getAttribute("data-step") || "0", 10) ||
        KANBAN_RENDER_STEP;
      var nextVisible = Math.min(colTasks.length, visible + step);
      if (nextVisible <= visible) return;

      var newTasks = colTasks.slice(visible, nextVisible);
      var body = board.querySelector(
        '.pm-kanban-col-body[data-status="' +
          String(status).replace(/"/g, '\\"') +
          '"]',
      );
      appendKanbanCards(body, newTasks, status);
      cache.visibleCounts[status] = nextVisible;
      if (cache.columns && cache.columns.length) {
        var colObj = cache.columns.find(function (c) {
          return c.key === status;
        });
        if (colObj) {
          colObj.totalCount = colTasks.length;
          colObj.visibleCards = nextVisible;
          colObj.hasMore = nextVisible < colTasks.length;
        }
      }

      var colEl = body ? body.closest(".pm-kanban-col") : null;
      updateKanbanColumnMeta(colEl, nextVisible, colTasks.length);

      if (nextVisible >= colTasks.length) btn.remove();
    });
  }

  function renderKanban(tasks, filters, sig) {
    var board = document.getElementById("pmKanbanBoard");
    if (!board) return;

    var cache = getKanbanCacheEntry(sig, tasks, filters);
    state.currentKanbanSig = sig;
    state.kanbanColumns = cache.columns.map(function (c) {
      return c.key;
    });

    board.innerHTML = cache.columns
      .map(function (colObj) {
        var col = colObj.key;
        var colTasks = cache.grouped[col] || [];
        var total = colTasks.length;
        var visible = cache.visibleCounts[col];
        if (visible == null) {
          visible = Math.min(KANBAN_RENDER_LIMIT, total);
          cache.visibleCounts[col] = visible;
        }
        if (visible > total) visible = total;
        colObj.totalCount = total;
        colObj.visibleCards = visible;
        colObj.hasMore = total > visible;

        var cards = colTasks
          .slice(0, visible)
          .map(function (t) {
            return renderKanbanCard(t, col);
          })
          .join("");

        var countText = "Showing " + visible + " of " + total;
        var moreBtn =
          total > visible
            ? '<button type="button" class="pm-ghostBtn pm-kanban-moreBtn" data-status="' +
              safeAttr(col) +
              '" data-step="' +
              KANBAN_RENDER_STEP +
              '">Load more</button>'
            : "";

        return (
          "" +
          '<div class="pm-kanban-col">' +
          '<div class="pm-kanban-col-header"><span>' +
          safe(colObj.title || col) +
          '</span><span class="pm-kanban-total">' +
          total +
          "</span></div>" +
          '<div class="pm-kanban-col-meta"><span class="pm-kanban-count">' +
          countText +
          "</span>" +
          (moreBtn ? moreBtn : "") +
          "</div>" +
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
    wireKanbanLoadMore();
  }


  function announceKanbanStatus(msg) {
    var el = document.getElementById("pmKanbanStatusMsg");
    if (el) el.textContent = msg || "";
  }

  function focusKanbanCard(taskId) {
    if (!taskId) return;
    var selector =
      '.pm-card[data-taskid="' + String(taskId).replace(/"/g, '\\"') + '"]';
    var card = document.querySelector(selector);
    if (card) card.focus();
  }

  async function handleKanbanStatusChange(taskId, newStatus) {
    if (!taskId || !newStatus) return;
    var task = state.tasksById
      ? state.tasksById.get(String(taskId))
      : null;
    if (!task) {
      var idx = state.tasksAll.findIndex(function (t) {
        return String(t.recordID) === String(taskId);
      });
      if (idx === -1) return;
      task = state.tasksAll[idx];
    }

    var normalized = normalizePrimaryStatus(newStatus);
    if (normalized === "Unknown") return;

    var prev = cloneTaskForUpdate(task);
    var next = null;

    if (normalized === "Other") {
      var selection = await openOtherStatusModal(task.otherSubType);
      selection = getOtherSubTypeValue(selection);
      if (!selection) {
        applySearchAndFilters(true);
        return;
      }
      task.status = "Other";
      task.otherSubType = selection;
      next = cloneTaskForUpdate(task);
      updateTaskDerivedCaches(prev, next);
      refreshAfterTaskUpdate(prev, next);
      announceKanbanStatus(
        "Moved task " + taskId + " to Other (" + selection + ").",
      );
    } else {
      task.status = normalized;
      task.otherSubType = "";
      next = cloneTaskForUpdate(task);
      updateTaskDerivedCaches(prev, next);
      refreshAfterTaskUpdate(prev, next);
      announceKanbanStatus(
        "Moved task " + taskId + " to " + normalized + ".",
      );
    }

    requestAnimationFrame(function () {
      focusKanbanCard(taskId);
    });

    try {
      await updateTaskStatus(taskId, task.status, task.otherSubType);
      refreshOkrsIfVisible();
    } catch (err) {
      task.status = prev.status;
      task.otherSubType = prev.otherSubType;
      var reverted = cloneTaskForUpdate(task);
      updateTaskDerivedCaches(next || task, reverted);
      refreshAfterTaskUpdate(next || task, reverted);
      refreshOkrsIfVisible();
      announceKanbanStatus(
        "Could not update task " + taskId + ". " + String(err),
      );
      alert("Could not update task status. " + String(err));
    }
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
        if (card.dataset.dndBound === "1") return;
        card.dataset.dndBound = "1";

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

          await handleKanbanStatusChange(id, newStatus);
        });
      });

    document.querySelectorAll(".pm-kanban-col-body").forEach(function (body) {
      if (body.dataset.dndBound === "1") return;
      body.dataset.dndBound = "1";

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

        await handleKanbanStatusChange(id, newStatus);
      });
    });
  }



  function updateKanbanDomForTaskChange(oldTask, newTask) {
    var board = document.getElementById("pmKanbanBoard");
    if (!board) return;

    var sig = state.currentKanbanSig;
    var cache = sig ? state.cache.kanban.get(sig) : null;
    cache = normalizeKanbanCache(cache);
    if (!cache) {
      renderTasksView("kanban", true);
      return;
    }

    state.kanbanColumns = cache.columns.map(function (c) {
      return c.key;
    });

    var oldStatus = normalizePrimaryStatus(oldTask.status);
    var newStatus = normalizePrimaryStatus(newTask.status);
    if (oldStatus === "Unknown" && newStatus === "Unknown") return;

    var statuses =
      oldStatus === newStatus ? [oldStatus] : [oldStatus, newStatus];
    var renderedAny = false;

    statuses.forEach(function (col) {
      if (!col || col === "Unknown") return;
      var body = board.querySelector(
        '.pm-kanban-col-body[data-status="' +
          String(col).replace(/"/g, '\\"') +
          '"]',
      );
      var colEl = body ? body.closest(".pm-kanban-col") : null;
      if (!body || !colEl) return;

      var colTasks = cache.grouped[col] || [];
      var total = colTasks.length;
      var visible = cache.visibleCounts[col];
      if (visible == null) {
        visible = Math.min(KANBAN_RENDER_LIMIT, total);
        cache.visibleCounts[col] = visible;
      }
      if (visible > total) visible = total;
      var colObj = cache.columns.find(function (c) {
        return c.key === col;
      });
      if (colObj) {
        colObj.totalCount = total;
        colObj.visibleCards = visible;
        colObj.hasMore = total > visible;
      }

      var cards = colTasks
        .slice(0, visible)
        .map(function (t) {
          return renderKanbanCard(t, col);
        })
        .join("");

      body.innerHTML = cards || '<div class="pm-card-meta">No tasks</div>';
      updateKanbanColumnMeta(colEl, visible, total);

      var meta = colEl.querySelector(".pm-kanban-col-meta");
      var existingBtn = meta ? meta.querySelector(".pm-kanban-moreBtn") : null;
      if (total > visible) {
        if (!existingBtn && meta) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "pm-ghostBtn pm-kanban-moreBtn";
          btn.setAttribute("data-status", col);
          btn.setAttribute("data-step", String(KANBAN_RENDER_STEP));
          btn.textContent = "Load more";
          meta.appendChild(btn);
        }
      } else if (existingBtn) {
        existingBtn.remove();
      }

      renderedAny = true;
    });

    if (!renderedAny) {
      renderTasksView("kanban", true);
      return;
    }

    wireKanbanDnD();
    wireKanbanLoadMore();
  }

  function refreshAfterTaskUpdate(oldTask, newTask) {
    var activeTab = getActiveTab();
    if (activeTab === "tasks") {
      var view = getTasksView();
      if (view === "table") {
        renderTasksView("table", true);
      } else if (view === "gantt") {
        renderTasksView("gantt", true);
      } else if (view === "kanban") {
        updateKanbanDomForTaskChange(oldTask, newTask);
      }
      return;
    }

    if (activeTab === "analytics") {
      if (getAnalyticsView() === "main") {
        refreshAnalyticsIfVisible();
      } else {
        refreshOkrsIfVisible();
      }
    }
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

    renderProjectHealthSticky(
      tabName,
      tabName === "tasks"
        ? getSingleSelectedValue(getFilterSet("projectKey"))
        : "",
    );
    renderActiveTab(tabName);
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
      if (getActiveTab() === "tasks") {
        renderTasksView(view);
        if (view === "kanban") {
          requestAnimationFrame(ensureKanbanRendered);
        }
      }
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


  function wireDevOnlyToggle() {
    var toggle = document.getElementById("pmDevOnlyToggle");
    if (!toggle) return;
    var stored = localStorage.getItem(STORAGE_KEYS.tasksDevOnly) || "";
    state.devOnly = stored === "true" || stored === "1";
    toggle.checked = state.devOnly;

    toggle.addEventListener("change", function () {
      state.devOnly = !!toggle.checked;
      localStorage.setItem(
        STORAGE_KEYS.tasksDevOnly,
        state.devOnly ? "true" : "false",
      );
      refreshStatusDropdown();
      applySearchAndFilters(true);
    });
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
      if (getActiveTab() === "analytics") {
        renderAnalyticsView(view);
      }
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


  function wireOkrTableViewToggle() {
    var btnObjectives = document.getElementById("pmOkrTableObjectivesBtn");
    var btnKeyResults = document.getElementById("pmOkrTableKeyResultsBtn");
    if (!btnObjectives || !btnKeyResults) return;

    function setView(view) {
      state.okrTableView = view;
      if (view === "keyResults") {
        if (state.sort.okrs.key !== "okrKey" && state.sort.okrs.key !== "keyResults") {
          state.sort.okrs.key = "okrKey";
          state.sort.okrs.dir = 1;
          state.sort.okrs.type = "string";
        }
      } else if (state.sort.okrs.key === "keyResults") {
        state.sort.okrs.key = "okrKey";
        state.sort.okrs.dir = 1;
        state.sort.okrs.type = "number";
      }
      var isObjectives = view === "objectives";
      btnObjectives.classList.toggle("is-active", isObjectives);
      btnKeyResults.classList.toggle("is-active", !isObjectives);
      btnObjectives.setAttribute("aria-selected", isObjectives ? "true" : "false");
      btnKeyResults.setAttribute("aria-selected", !isObjectives ? "true" : "false");
      btnObjectives.setAttribute("tabindex", isObjectives ? "0" : "-1");
      btnKeyResults.setAttribute("tabindex", !isObjectives ? "0" : "-1");
      applySearchAndFilters(true);
    }

    btnObjectives.addEventListener("click", function () {
      setView("objectives");
    });
    btnKeyResults.addEventListener("click", function () {
      setView("keyResults");
    });

    var tabs = [btnObjectives, btnKeyResults];
    tabs.forEach(function (btn) {
      btn.addEventListener("keydown", function (e) {
        handleTablistKeydown(e, tabs, function (tab) {
          setView(tab === btnObjectives ? "objectives" : "keyResults");
        });
      });
    });

    setView("objectives");
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

  function setFilterOptions(key, options) {
    var ctrl = state.filterControls[key];
    if (!ctrl) return;
    ctrl.setOptions(options || []);
  }

  function populateProjectKeyDropdown(projects) {
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

    setFilterOptions(
      "projectKey",
      cleaned.map(function (p) {
        return {
          value: String(p.projectKey || "").trim(),
          label:
            p.projectKey && p.projectName
              ? p.projectKey + " | " + p.projectName
              : p.projectKey || p.projectName || "",
        };
      }),
    );
  }

  function populateProjectFiscalYearDropdown(projects) {
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

    setFilterOptions(
      "projectFiscalYear",
      vals.map(function (v) {
        return { value: v, label: v };
      }),
    );
  }

  function populateOkrFiscalYearDropdown(projects) {
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

    setFilterOptions(
      "okrFiscalYear",
      vals.map(function (v) {
        return { value: v, label: v };
      }),
    );
  }

  function populateAssigneeDropdown(tasks) {
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

    setFilterOptions(
      "assignee",
      vals.map(function (v) {
        return { value: v, label: v };
      }),
    );
  }

  function populateCategoryDropdown(tasks) {
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

    setFilterOptions(
      "category",
      vals.map(function (v) {
        return { value: v, label: v };
      }),
    );
  }

  function populateStatusDropdown(statuses) {
    setFilterOptions(
      "status",
      (statuses || []).map(function (s) {
        return { value: s, label: s };
      }),
    );
  }

  function refreshStatusDropdown() {
    var options = getStatusFilterOptions();
    populateStatusDropdown(options);
  }

  function getSearchQuery() {
    var el = document.getElementById("pmSearchInput");
    return (el && el.value ? el.value : "").trim().toLowerCase();
  }

  function normalizeForSearch(val) {
    return String(val || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function normalizeKeyResultMatch(val) {
    return String(val || "").trim().toLowerCase();
  }

  function matchesQuery(hay, q, qCompact) {
    if (!q) return true;
    var h = String(hay || "").toLowerCase();
    if (h.includes(q)) return true;
    if (!qCompact) return false;
    return normalizeForSearch(h).includes(qCompact);
  }

  function sigPart(val) {
    return encodeURIComponent(String(val || ""));
  }

  function getActiveTab() {
    return localStorage.getItem(STORAGE_KEYS.activeTab) || "projects";
  }

  function getTasksView() {
    return localStorage.getItem(STORAGE_KEYS.tasksView) || "table";
  }

  function getAnalyticsView() {
    return localStorage.getItem(STORAGE_KEYS.analyticsView) || "main";
  }

  function debounce(fn, wait) {
    var timer;
    return function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(ctx, args);
      }, wait);
    };
  }

  function signatureFromSet(set) {
    if (!set || !set.size) return "all";
    return Array.from(set)
      .map(function (v) {
        return sigPart(v);
      })
      .sort()
      .join(",");
  }

  function getFilterSet(key) {
    if (!state.filters[key]) state.filters[key] = new Set();
    return state.filters[key];
  }

  function setFilterValues(key, values) {
    var set = getFilterSet(key);
    set.clear();
    (values || []).forEach(function (v) {
      var val = String(v || "").trim();
      if (val) set.add(val);
    });
  }

  function getSingleSelectedValue(set) {
    if (!set || set.size !== 1) return "";
    return Array.from(set)[0] || "";
  }

  function matchesFilterSet(value, set) {
    if (!set || !set.size) return true;
    var v = String(value || "").trim();
    return set.has(v);
  }

  function multiSelectDropdown(config) {
    var container = document.getElementById(config.id);
    if (!container) return null;

    var selected = config.selected || new Set();
    var options = [];
    var searchThreshold = config.searchThreshold || 15;
    var isOpen = false;
    var searchValue = "";
    var labelMap = new Map();

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "pm-multiSelectToggle";
    toggle.id = config.id + "Toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", config.id + "Panel");

    var panel = document.createElement("div");
    panel.className = "pm-multiSelectPanel";
    panel.id = config.id + "Panel";
    panel.hidden = true;

    var actions = document.createElement("div");
    actions.className = "pm-multiSelectActions";

    var selectAllBtn = document.createElement("button");
    selectAllBtn.type = "button";
    selectAllBtn.className = "pm-multiSelectActionBtn";
    selectAllBtn.textContent = "Select all";

    var clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "pm-multiSelectActionBtn";
    clearBtn.textContent = "Clear";

    actions.appendChild(selectAllBtn);
    actions.appendChild(clearBtn);

    var searchWrap = document.createElement("div");
    searchWrap.className = "pm-multiSelectSearch";
    var searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search";
    searchInput.setAttribute("aria-label", "Search options");
    searchWrap.appendChild(searchInput);

    var list = document.createElement("div");
    list.className = "pm-multiSelectList";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-multiselectable", "true");

    panel.appendChild(actions);
    panel.appendChild(searchWrap);
    panel.appendChild(list);
    container.innerHTML = "";
    container.appendChild(toggle);
    container.appendChild(panel);

    function updateToggleLabel() {
      if (!selected.size) {
        toggle.textContent = "All";
        toggle.classList.remove("is-active");
        return;
      }
      if (selected.size === 1) {
        var val = Array.from(selected)[0];
        toggle.textContent = labelMap.get(val) || val;
        toggle.classList.add("is-active");
        return;
      }
      toggle.textContent = selected.size + " selected";
      toggle.classList.add("is-active");
    }

    function renderList() {
      var filterText = String(searchValue || "").toLowerCase();
      var items = options.filter(function (opt) {
        if (!filterText) return true;
        return String(opt.label || opt.value || "")
          .toLowerCase()
          .includes(filterText);
      });

      list.innerHTML = "";
      if (!items.length) {
        var empty = document.createElement("div");
        empty.className = "pm-multiSelectEmpty";
        empty.textContent = "No options";
        list.appendChild(empty);
        return;
      }

      var frag = document.createDocumentFragment();
      items.forEach(function (opt, idx) {
        var label = document.createElement("label");
        label.className = "pm-multiSelectOption";
        var input = document.createElement("input");
        input.type = "checkbox";
        input.value = opt.value;
        input.checked = selected.has(opt.value);
        input.setAttribute("data-value", opt.value);
        input.setAttribute("aria-checked", input.checked ? "true" : "false");
        var span = document.createElement("span");
        span.textContent = opt.label;
        label.appendChild(input);
        label.appendChild(span);
        frag.appendChild(label);
      });
      list.appendChild(frag);
    }

    function closePanel() {
      if (!isOpen) return;
      isOpen = false;
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      document.removeEventListener("mousedown", handleOutsideClick);
      toggle.focus();
    }

    function openPanel() {
      if (isOpen) return;
      isOpen = true;
      panel.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      document.addEventListener("mousedown", handleOutsideClick);
      if (options.length > searchThreshold) {
        searchInput.focus();
      } else {
        var first = list.querySelector('input[type="checkbox"]');
        if (first) first.focus();
      }
    }

    function handleOutsideClick(e) {
      if (container.contains(e.target)) return;
      closePanel();
    }

    toggle.addEventListener("click", function () {
      if (isOpen) closePanel();
      else openPanel();
    });

    toggle.addEventListener("keydown", function (e) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (isOpen) closePanel();
        else openPanel();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closePanel();
      }
    });

    panel.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        e.preventDefault();
        closePanel();
      }
    });

    list.addEventListener("change", function (e) {
      var input = e.target;
      if (!input || input.type !== "checkbox") return;
      var val = input.value;
      if (input.checked) selected.add(val);
      else selected.delete(val);
      input.setAttribute("aria-checked", input.checked ? "true" : "false");
      updateToggleLabel();
      if (config.onChange) config.onChange(new Set(selected));
    });

    selectAllBtn.addEventListener("click", function () {
      options.forEach(function (opt) {
        selected.add(opt.value);
      });
      renderList();
      updateToggleLabel();
      if (config.onChange) config.onChange(new Set(selected));
    });

    clearBtn.addEventListener("click", function () {
      selected.clear();
      renderList();
      updateToggleLabel();
      if (config.onChange) config.onChange(new Set(selected));
    });

    searchInput.addEventListener("input", function () {
      searchValue = searchInput.value || "";
      renderList();
    });

    function setOptions(nextOptions) {
      options = (nextOptions || []).map(function (opt) {
        return {
          value: String(opt.value || "").trim(),
          label: String(opt.label || opt.value || "").trim(),
        };
      });
      labelMap = new Map();
      options.forEach(function (opt) {
        labelMap.set(opt.value, opt.label);
      });

      var validValues = new Set(
        options.map(function (opt) {
          return opt.value;
        }),
      );
      var changed = false;
      Array.from(selected).forEach(function (val) {
        if (!validValues.has(val)) {
          selected.delete(val);
          changed = true;
        }
      });

      searchWrap.style.display =
        options.length > searchThreshold ? "block" : "none";
      renderList();
      updateToggleLabel();
      if (changed && config.onChange) config.onChange(new Set(selected));
    }

    updateToggleLabel();
    return {
      setOptions: setOptions,
      getSelected: function () {
        return new Set(selected);
      },
      clear: function () {
        selected.clear();
        renderList();
        updateToggleLabel();
      },
      selectAll: function () {
        options.forEach(function (opt) {
          selected.add(opt.value);
        });
        renderList();
        updateToggleLabel();
      },
    };
  }

  function getPaginationConfig(key) {
    return PAGINATION_CONFIG[key];
  }

  function loadPaginationState(key) {
    var cfg = getPaginationConfig(key);
    if (!cfg) return null;
    var stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(cfg.storageKey) || "{}");
    } catch (err) {
      stored = null;
    }
    var pageSize = cfg.defaultPageSize;
    if (stored && cfg.pageSizes.indexOf(Number(stored.pageSize)) !== -1) {
      pageSize = Number(stored.pageSize);
    }
    var page = stored && Number(stored.page) > 0 ? Number(stored.page) : 1;
    var signature =
      stored && typeof stored.signature === "string" ? stored.signature : "";
    return {
      page: page,
      pageSize: pageSize,
      signature: signature,
      total: 0,
      totalPages: 1,
      inited: true,
    };
  }

  function savePaginationState(key, pag) {
    var cfg = getPaginationConfig(key);
    if (!cfg || !pag) return;
    localStorage.setItem(
      cfg.storageKey,
      JSON.stringify({
        page: pag.page,
        pageSize: pag.pageSize,
        signature: pag.signature || "",
      }),
    );
  }

  function buildPaginationModel(total, page, pageSize) {
    var safeTotal = Math.max(0, Number(total) || 0);
    var safePageSize = Math.max(1, Number(pageSize) || 1);
    var totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
    var safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    var startIndex = safeTotal ? (safePage - 1) * safePageSize : 0;
    var endIndex = Math.min(safeTotal, startIndex + safePageSize);
    var startLabel = safeTotal ? startIndex + 1 : 0;
    var endLabel = safeTotal ? endIndex : 0;
    return {
      total: safeTotal,
      page: safePage,
      pageSize: safePageSize,
      totalPages: totalPages,
      startIndex: startIndex,
      endIndex: endIndex,
      startLabel: startLabel,
      endLabel: endLabel,
      hasPrev: safePage > 1,
      hasNext: safePage < totalPages,
    };
  }

  function resetTasksTableScroll() {
    var wrap = document.querySelector("#pmTasksTableWrap .pm-tableWrap");
    if (wrap) wrap.scrollTop = 0;
  }

  function handlePaginationChange(key) {
    if (key === "tasks") {
      resetTasksTableScroll();
      renderTasksView("table", true);
    }
  }

  function ensurePaginationState(key, signature, total) {
    var cfg = getPaginationConfig(key);
    if (!cfg) return null;
    var pag = state.pagination[key];
    if (!pag || !pag.inited) {
      pag = loadPaginationState(key) || {
        page: 1,
        pageSize: cfg.defaultPageSize,
        signature: "",
        total: 0,
        totalPages: 1,
        inited: true,
      };
      state.pagination[key] = pag;
    }

    if (signature && pag.signature !== signature) {
      pag.page = 1;
      pag.signature = signature;
      resetTasksTableScroll();
    }

    var model = buildPaginationModel(total, pag.page, pag.pageSize);
    pag.page = model.page;
    pag.pageSize = model.pageSize;
    pag.total = model.total;
    pag.totalPages = model.totalPages;
    savePaginationState(key, pag);
    return model;
  }

  function bindPaginationControls(container) {
    if (!container || container.dataset.bound === "1") return;
    container.dataset.bound = "1";

    container.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-page-action]");
      if (!btn) return;
      var key = container.getAttribute("data-pagination-key");
      if (!key) return;
      var pag = state.pagination[key];
      if (!pag) return;
      var action = btn.getAttribute("data-page-action");
      if (action === "prev") pag.page = Math.max(1, pag.page - 1);
      if (action === "next")
        pag.page = Math.min(pag.page + 1, pag.totalPages || 1);
      savePaginationState(key, pag);
      handlePaginationChange(key);
    });

    container.addEventListener("change", function (e) {
      var select = e.target.closest("select[data-page-size]");
      if (!select) return;
      var key = container.getAttribute("data-pagination-key");
      if (!key) return;
      var pag = state.pagination[key];
      if (!pag) return;
      var size = parseInt(select.value || "0", 10);
      if (!size || isNaN(size)) return;
      pag.pageSize = size;
      pag.page = 1;
      savePaginationState(key, pag);
      handlePaginationChange(key);
    });
  }

  function renderPaginationControls(key, model) {
    var cfg = getPaginationConfig(key);
    if (!cfg) return;
    var container = document.getElementById(cfg.containerId);
    if (!container || !model) return;

    var shouldShow = model.total > model.pageSize;
    container.style.display = shouldShow ? "flex" : "none";
    container.innerHTML = "";
    if (!shouldShow) return;

    var options = cfg.pageSizes
      .map(function (size) {
        return (
          '<option value="' +
          size +
          '"' +
          (Number(size) === Number(model.pageSize) ? " selected" : "") +
          ">" +
          size +
          "</option>"
        );
      })
      .join("");

    container.setAttribute("data-pagination-key", key);
    container.innerHTML =
      '<div class="pm-paginationRange">Showing ' +
      model.startLabel.toLocaleString() +
      "-" +
      model.endLabel.toLocaleString() +
      " of " +
      model.total.toLocaleString() +
      '</div><div class="pm-paginationControls">' +
      '<label class="pm-srOnly" for="pmPaginationSize_' +
      key +
      '">Rows per page</label>' +
      '<select id="pmPaginationSize_' +
      key +
      '" class="pm-select pm-paginationSelect" data-page-size="1" aria-label="Rows per page">' +
      options +
      "</select>" +
      '<button type="button" class="pm-ghostBtn" data-page-action="prev"' +
      (model.hasPrev ? "" : " disabled") +
      '>Previous</button>' +
      '<button type="button" class="pm-ghostBtn" data-page-action="next"' +
      (model.hasNext ? "" : " disabled") +
      '>Next</button>' +
      "</div>";

    bindPaginationControls(container);
  }

  function buildTaskFilterState() {
    var q = getSearchQuery();
    var qCompact = normalizeForSearch(q);
    return {
      q: q,
      qCompact: qCompact,
      projectKeys: new Set(getFilterSet("projectKey")),
      statuses: new Set(getFilterSet("status")),
      assignees: new Set(getFilterSet("assignee")),
      priorities: new Set(getFilterSet("priority")),
      categories: new Set(getFilterSet("category")),
      devOnly: state.devOnly,
    };
  }

  function taskMatchesFilters(task, filters) {
    if (!task) return false;
    var q = (filters && filters.q) || "";
    var qCompact = (filters && filters.qCompact) || "";
    if (q) {
      var hay = (
        task.projectKey +
        " " +
        task.recordID +
        " " +
        task.title +
        " " +
        task.status +
        " " +
        task.otherSubType +
        " " +
        task.priority +
        " " +
        task.category +
        " " +
        task.assignedTo +
        " " +
        task.start +
        " " +
        task.due +
        " " +
        task.okrAssociation +
        " " +
        task.keyResultSelection
      ).toLowerCase();
      if (
        !matchesQuery(hay, q, qCompact) &&
        !matchesQuery(task.recordID, q, qCompact)
      ) {
        return false;
      }
    }
    if (filters && filters.devOnly && !isDevelopmentTask(task)) return false;
    if (
      filters &&
      !matchesFilterSet(task.projectKey, filters.projectKeys)
    )
      return false;
    if (filters && !matchesFilterSet(task.status, filters.statuses))
      return false;
    if (filters && !matchesFilterSet(task.assignedTo, filters.assignees))
      return false;
    if (filters && !matchesFilterSet(task.priority, filters.priorities))
      return false;
    if (filters && !matchesFilterSet(task.category, filters.categories))
      return false;
    return true;
  }

  function buildTaskFilterSignature(filters) {
    return [
      "t",
      state.tasksVersion,
      sigPart(filters.q),
      filters.devOnly ? "1" : "0",
      signatureFromSet(filters.projectKeys),
      signatureFromSet(filters.statuses),
      signatureFromSet(filters.assignees),
      signatureFromSet(filters.priorities),
      signatureFromSet(filters.categories),
    ].join("|");
  }

  function buildTaskSortSignature(sortState) {
    if (!sortState || !sortState.key) return "none";
    return [
      sigPart(sortState.key),
      sortState.dir,
      sigPart(sortState.type),
    ].join("|");
  }

  function getTasksFilteredCached(filters) {
    var sig = buildTaskFilterSignature(filters);
    var cached = state.cache.tasksFiltered.get(sig);
    if (cached) return cached.list;
    var list = (state.tasksAll || []).filter(function (t) {
      return taskMatchesFilters(t, filters);
    });
    state.cache.tasksFiltered.set(sig, { list: list, filters: filters });
    return list;
  }

  function getTasksSortedCached(filters, sortState) {
    var filterSig = buildTaskFilterSignature(filters);
    var sortSig = buildTaskSortSignature(sortState);
    var fullSig = filterSig + "::" + sortSig;
    var cached = state.cache.tasksSorted.get(fullSig);
    if (cached) return cached.list;
    var list = getTasksFilteredCached(filters);
    var sorted = list;
    if (sortState && sortState.key) {
      sorted = list.slice().sort(function (a, b) {
        return compareValues(
          a[sortState.key],
          b[sortState.key],
          sortState.dir,
          sortState.type,
        );
      });
    }
    state.cache.tasksSorted.set(fullSig, {
      list: sorted,
      filterSig: filterSig,
      sortKey: sortState ? sortState.key : null,
      sortDir: sortState ? sortState.dir : 1,
      sortType: sortState ? sortState.type : "string",
    });
    return sorted;
  }

  function buildProjectFilterState() {
    var q = getSearchQuery();
    var qCompact = normalizeForSearch(q);
    return {
      q: q,
      qCompact: qCompact,
      fiscalYears: new Set(getFilterSet("projectFiscalYear")),
    };
  }

  function projectMatchesFilters(project, filters) {
    if (!project) return false;
    var q = (filters && filters.q) || "";
    var qCompact = (filters && filters.qCompact) || "";
    if (q) {
      var hay = (
        project.projectKey +
        " " +
        project.recordID +
        " " +
        project.projectName +
        " " +
        project.description +
        " " +
        project.owner +
        " " +
        project.projectStatus +
        " " +
        project.projectFiscalYear +
        " " +
        project.okrKey +
        " " +
        project.okrObjective +
        " " +
        project.okrStartDate +
        " " +
        project.okrEndDate +
        " " +
        project.okrFiscalYear +
        " " +
        project.okrAssociation +
        " " +
        project.keyResultSelection +
        " " +
        project.projectType
      ).toLowerCase();
      if (
        !matchesQuery(hay, q, qCompact) &&
        !matchesQuery(project.recordID, q, qCompact)
      ) {
        return false;
      }
    }
    if (
      filters &&
      !matchesFilterSet(project.projectFiscalYear, filters.fiscalYears)
    )
      return false;
    return true;
  }

  function buildProjectsSignature(filters, sortState) {
    return [
      "p",
      state.projectsVersion,
      sigPart(filters.q),
      signatureFromSet(filters.fiscalYears),
      buildTaskSortSignature(sortState),
    ].join("|");
  }

  function getProjectsFilteredCached(filters) {
    var sig = buildProjectsSignature(filters, {
      key: null,
      dir: 1,
      type: "string",
    });
    var cached = state.cache.projects.get(sig);
    if (cached) return cached.list;
    var list = (state.projectsAll || []).filter(function (p) {
      return projectMatchesFilters(p, filters);
    });
    state.cache.projects.set(sig, { list: list, filters: filters });
    return list;
  }

  function getProjectsSortedCached(filters, sortState) {
    var sig = buildProjectsSignature(filters, sortState);
    var cached = state.cache.projects.get(sig);
    if (cached) return cached.list;
    var list = getProjectsFilteredCached(filters);
    var sorted = list;
    if (sortState && sortState.key) {
      sorted = list.slice().sort(function (a, b) {
        return compareValues(
          a[sortState.key],
          b[sortState.key],
          sortState.dir,
          sortState.type,
        );
      });
    }
    state.cache.projects.set(sig, { list: sorted, filters: filters });
    return sorted;
  }

  function invalidateTaskCaches() {
    state.tasksVersion = (state.tasksVersion || 0) + 1;
    state.cache.tasksFiltered = new Map();
    state.cache.tasksSorted = new Map();
    state.cache.kanban = new Map();
    state.cache.analytics = new Map();
    state.cache.okrs = new Map();
    state.cache.analyticsBase = null;
    state.renderState.tasksTableSig = "";
    state.renderState.tasksKanbanSig = "";
    state.renderState.tasksGanttSig = "";
    state.renderState.analyticsMainSig = "";
    state.renderState.analyticsOkrsSig = "";
  }

  function invalidateOkrsCaches() {
    state.cache.okrs = new Map();
    state.renderState.analyticsOkrsSig = "";
  }

  function removeTaskFromList(list, recordID) {
    if (!list || !list.length) return;
    var idx = list.findIndex(function (t) {
      return String(t.recordID) === String(recordID);
    });
    if (idx !== -1) list.splice(idx, 1);
  }

  function cloneTaskForUpdate(task) {
    if (!task) return {};
    return {
      recordID: task.recordID,
      projectKey: task.projectKey,
      title: task.title,
      status: task.status,
      otherSubType: task.otherSubType,
      priority: task.priority,
      category: task.category,
      assignedTo: task.assignedTo,
      start: task.start,
      due: task.due,
      okrAssociation: task.okrAssociation,
      keyResultSelection: task.keyResultSelection,
      supportTicket: task.supportTicket,
      depIds: task.depIds,
      href: task.href,
      createdAt: task.createdAt,
    };
  }

  function updateTaskFilterCaches(oldTask, newTask) {
    state.cache.tasksFiltered.forEach(function (entry) {
      var oldMatch = taskMatchesFilters(oldTask, entry.filters);
      var newMatch = taskMatchesFilters(newTask, entry.filters);
      if (oldMatch && !newMatch) {
        removeTaskFromList(entry.list, oldTask.recordID);
        entry.changed = true;
      } else if (!oldMatch && newMatch) {
        entry.list.push(newTask);
        entry.changed = true;
      } else if (oldMatch && newMatch) {
        entry.changed = entry.changed || false;
      }
    });

    state.cache.tasksSorted.forEach(function (entry) {
      var filterEntry = state.cache.tasksFiltered.get(entry.filterSig);
      if (!filterEntry) return;
      if (filterEntry.changed) {
        if (entry.sortKey) {
          entry.list = filterEntry.list.slice().sort(function (a, b) {
            return compareValues(
              a[entry.sortKey],
              b[entry.sortKey],
              entry.sortDir,
              entry.sortType,
            );
          });
        } else {
          entry.list = filterEntry.list;
        }
      }
    });

    state.cache.tasksFiltered.forEach(function (entry) {
      if (entry.changed) delete entry.changed;
    });
  }

  function buildKanbanSignature(filters, sortState) {
    return (
      buildTaskFilterSignature(filters) +
      "::kanban::" +
      buildTaskSortSignature(sortState)
    );
  }

  function updateKanbanCaches(oldTask, newTask) {
    state.cache.kanban.forEach(function (entry) {
      entry = normalizeKanbanCache(entry);
      if (!entry || !entry.grouped) return;
      var oldMatch = taskMatchesFilters(oldTask, entry.filters);
      var newMatch = taskMatchesFilters(newTask, entry.filters);
      var oldStatus = normalizePrimaryStatus(oldTask.status);
      var newStatus = normalizePrimaryStatus(newTask.status);
      var touched = {};

      function ensureColumn(status) {
        if (!entry.grouped[status]) entry.grouped[status] = [];
        if (!entry.columns) entry.columns = [];
        var colObj = entry.columns.find(function (c) {
          return c.key === status;
        });
        if (!colObj) {
          colObj = {
            key: status,
            title: status,
            totalCount: 0,
            visibleCards: 0,
            hasMore: false,
          };
          entry.columns.push(colObj);
        }
        return colObj;
      }

      if (oldMatch) {
        var oldList = entry.grouped[oldStatus];
        if (oldList) removeTaskFromList(oldList, oldTask.recordID);
        touched[oldStatus] = true;
      }
      if (newMatch) {
        ensureColumn(newStatus);
        entry.grouped[newStatus].push(newTask);
        touched[newStatus] = true;
      }

      Object.keys(touched).forEach(function (status) {
        var list = entry.grouped[status] || [];
        var total = list.length;
        var visible = entry.visibleCounts[status] || 0;
        if (!visible && total) {
          visible = Math.min(KANBAN_RENDER_LIMIT, total);
        }
        if (visible > total) visible = total;
        entry.visibleCounts[status] = visible;

        var colObj = ensureColumn(status);
        colObj.totalCount = total;
        colObj.visibleCards = visible;
        colObj.hasMore = total > visible;
      });
    });
  }

  function updateAnalyticsCaches(oldTask, newTask) {
    var now = new Date();
    state.cache.analytics.forEach(function (entry) {
      updateAnalyticsCacheEntry(entry, oldTask, newTask, now);
    });
  }

  function updateTaskDerivedCaches(oldTask, newTask) {
    updateTaskFilterCaches(oldTask, newTask);
    updateKanbanCaches(oldTask, newTask);
    updateAnalyticsCaches(oldTask, newTask);
    invalidateOkrsCaches();
  }


  
  function applySearchAndFilters() {
    if (!state.dataReady) return;
    renderActiveTab(getActiveTab());
  }

  function renderActiveTab(tabName) {
    if (tabName === "projects") {
      state.tabInit.projects = true;
      renderProjectsView();
      renderProjectHealthSticky(tabName, "");
      return;
    }
    if (tabName === "tasks") {
      state.tabInit.tasks = true;
      renderTasksView(getTasksView());
      requestAnimationFrame(ensureKanbanRendered);
      return;
    }
    if (tabName === "analytics") {
      state.tabInit.analytics = true;
      renderAnalyticsView(getAnalyticsView());
    }
  }

  function renderProjectsView() {
    var filters = buildProjectFilterState();
    var sig = buildProjectsSignature(filters, state.sort.projects);
    if (state.renderState.projectsSig === sig) return;
    var projects = getProjectsSortedCached(filters, state.sort.projects);
    renderProjectsTable(projects);
    state.renderState.projectsSig = sig;
  }

  function renderTasksView(view, force) {
    var filters = buildTaskFilterState();
    renderProjectHealthSticky(
      "tasks",
      getSingleSelectedValue(filters.projectKeys),
    );
    var sortState = state.sort.tasks;

    if (view === "table") {
      state.viewInit.tasksTable = true;
      var baseSig =
        buildTaskFilterSignature(filters) +
        "::table::" +
        buildTaskSortSignature(sortState);
      var tasks = getTasksSortedCached(filters, sortState);
      var paginationModel = ensurePaginationState(
        "tasks",
        baseSig,
        tasks.length,
      );
      var sig =
        baseSig +
        "::page:" +
        paginationModel.page +
        "::size:" +
        paginationModel.pageSize;
      if (!force && state.renderState.tasksTableSig === sig) {
        renderPaginationControls("tasks", paginationModel);
        return;
      }
      var pagedTasks = tasks.slice(
        paginationModel.startIndex,
        paginationModel.endIndex,
      );
      renderTasksTable(pagedTasks);
      renderPaginationControls("tasks", paginationModel);
      state.renderState.tasksTableSig = sig;
      return;
    }

    if (view === "kanban") {
      var wasInited = state.viewInit.tasksKanban;
      var sigK = buildKanbanSignature(filters, sortState);
      if (!force && wasInited && state.renderState.tasksKanbanSig === sigK)
        return;
      var tasksK = getTasksSortedCached(filters, sortState);
      renderKanban(tasksK, filters, sigK);
      state.viewInit.tasksKanban = true;
      state.renderState.tasksKanbanSig = sigK;
      return;
    }

    if (view === "gantt") {
      state.viewInit.tasksGantt = true;
      var sigG =
        buildTaskFilterSignature(filters) +
        "::gantt::" +
        buildTaskSortSignature(sortState);
      if (!force && state.renderState.tasksGanttSig === sigG) return;
      var tasksG = getTasksSortedCached(filters, sortState).filter(function (t) {
        return !isArchivedStatus(t.status);
      });
      renderGantt(tasksG);
      state.renderState.tasksGanttSig = sigG;
    }
  }

  function ensureKanbanRendered() {
    if (!state.dataReady) return;
    if (getActiveTab() !== "tasks") return;
    if (getTasksView() !== "kanban") return;
    var board = document.getElementById("pmKanbanBoard");
    if (!board) return;
    if (board.children && board.children.length) return;
    var filters = buildTaskFilterState();
    var sortState = state.sort.tasks;
    var sigK = buildKanbanSignature(filters, sortState);
    var tasksK = getTasksSortedCached(filters, sortState);
    renderKanban(tasksK, filters, sigK);
    state.viewInit.tasksKanban = true;
    state.renderState.tasksKanbanSig = sigK;
  }

  function renderAnalyticsView(view) {
    if (view === "okrs") {
      state.viewInit.analyticsOkrs = true;
      var fy = getFilterSet("okrFiscalYear");
      var sig = buildOkrsSignature(fy);
      if (state.renderState.analyticsOkrsSig === sig) return;
      renderOkrsAnalytics(fy);
      state.renderState.analyticsOkrsSig = sig;
      return;
    }

    state.viewInit.analyticsMain = true;
    var sigMain = buildAnalyticsSignature();
    if (state.renderState.analyticsMainSig === sigMain) return;
    var analyticsTasks = getAnalyticsBaseTasks();
    renderAnalytics(analyticsTasks);
    state.renderState.analyticsMainSig = sigMain;
  }


  function refreshOkrsIfVisible() {
    if (!state.dataReady) return;
    var activeTab = localStorage.getItem(STORAGE_KEYS.activeTab) || "projects";
    if (activeTab !== "analytics") return;
    var analyticsView =
      localStorage.getItem(STORAGE_KEYS.analyticsView) || "main";
    if (analyticsView !== "okrs") return;
    renderOkrsAnalytics(getFilterSet("okrFiscalYear"));
  }

  function refreshAnalyticsIfVisible() {
    if (!state.dataReady) return;
    var activeTab = getActiveTab();
    if (activeTab !== "analytics") return;
    var view = getAnalyticsView();
    if (view !== "main") return;
    var sig = buildAnalyticsSignature();
    var cache = state.cache.analytics.get(sig);
    if (cache) {
      renderAnalyticsFromCache(cache);
    }
  }

  function initFilterControls() {
    var tasksOnChange = function () {
      applySearchAndFilters(true);
    };
    var analyticsOnChange = function () {
      applySearchAndFilters(false);
    };

    state.filterControls.projectFiscalYear = multiSelectDropdown({
      id: "pmProjectFiscalYearSelect",
      selected: getFilterSet("projectFiscalYear"),
      onChange: tasksOnChange,
    });
    state.filterControls.projectKey = multiSelectDropdown({
      id: "pmProjectKeySelect",
      selected: getFilterSet("projectKey"),
      onChange: tasksOnChange,
    });
    state.filterControls.status = multiSelectDropdown({
      id: "pmStatusSelect",
      selected: getFilterSet("status"),
      onChange: tasksOnChange,
    });
    state.filterControls.assignee = multiSelectDropdown({
      id: "pmAssigneeSelect",
      selected: getFilterSet("assignee"),
      onChange: tasksOnChange,
    });
    state.filterControls.category = multiSelectDropdown({
      id: "pmCategorySelect",
      selected: getFilterSet("category"),
      onChange: tasksOnChange,
    });
    state.filterControls.priority = multiSelectDropdown({
      id: "pmPrioritySelect",
      selected: getFilterSet("priority"),
      onChange: tasksOnChange,
    });
    state.filterControls.analyticsYear = multiSelectDropdown({
      id: "pmAnalyticsGeneralYearSelect",
      selected: getFilterSet("analyticsYear"),
      onChange: analyticsOnChange,
    });
    state.filterControls.analyticsQuarter = multiSelectDropdown({
      id: "pmAnalyticsGeneralQuarterSelect",
      selected: getFilterSet("analyticsQuarter"),
      onChange: analyticsOnChange,
    });
    state.filterControls.okrFiscalYear = multiSelectDropdown({
      id: "pmOkrFiscalYearSelect",
      selected: getFilterSet("okrFiscalYear"),
      onChange: tasksOnChange,
    });

    setFilterOptions("priority", [
      { value: "High", label: "High" },
      { value: "Medium", label: "Medium" },
      { value: "Low", label: "Low" },
    ]);
  }


  function wireClearFilters() {
    function clearAll() {
      var s = document.getElementById("pmSearchInput");
      if (s) s.value = "";
      ["projectKey", "status", "assignee", "priority", "category"].forEach(
        function (key) {
          setFilterValues(key, []);
          var ctrl = state.filterControls[key];
          if (ctrl) ctrl.clear();
        },
      );
      applySearchAndFilters(true);
    }
    var b2 = document.getElementById("pmClearFiltersBtn_tasks");
    if (b2) b2.addEventListener("click", clearAll);
  }

  function wireOkrFilters() {
    var clearBtn = document.getElementById("pmClearFiltersBtn_okrs");
    if (clearBtn)
      clearBtn.addEventListener("click", function () {
        setFilterValues("okrFiscalYear", []);
        var ctrl = state.filterControls.okrFiscalYear;
        if (ctrl) ctrl.clear();
        applySearchAndFilters(true);
      });
  }

  function wireOkrRollupToggle() {
    var wrap = document.getElementById("pmOkrsSummary");
    var indexWrap = document.getElementById("pmOkrIndex");
    if (!wrap) return;

    function setCardExpanded(card, expand) {
      if (!card) return;
      var toggle = card.querySelector(".pm-okrCardToggle");
      if (!toggle) return;
      var targetId = toggle.getAttribute("data-target") || "";
      if (!targetId) return;
      var panel = document.getElementById(targetId);
      if (!panel) return;
      var shouldExpand = expand != null ? expand : panel.hasAttribute("hidden");
      panel.toggleAttribute("hidden", !shouldExpand);
      panel.setAttribute("aria-hidden", shouldExpand ? "false" : "true");
      toggle.setAttribute("aria-expanded", shouldExpand ? "true" : "false");
      toggle.textContent = shouldExpand ? "Collapse" : "Expand";
      card.classList.toggle("is-expanded", shouldExpand);
      var okr = toggle.getAttribute("data-okr") || "";
      var action = shouldExpand ? "Collapse" : "Expand";
      toggle.setAttribute(
        "aria-label",
        action + (okr ? " OKR " + okr : " OKR"),
      );
    }

    function revealCard(card) {
      if (!card || !card.classList.contains("is-hidden")) return;
      var showMoreBtn = wrap.querySelector(".pm-okrShowMoreBtn");
      if (!showMoreBtn) {
        card.classList.remove("is-hidden");
        return;
      }
      var total = parseInt(showMoreBtn.getAttribute("data-total") || "0", 10);
      var visible = parseInt(
        showMoreBtn.getAttribute("data-visible") || "0",
        10,
      );
      var idx = parseInt(card.getAttribute("data-okr-index") || "0", 10);
      var nextVisible = Math.min(total, Math.max(visible, idx + 1));
      var cards = Array.from(wrap.querySelectorAll(".pm-okrCard"));
      cards.forEach(function (c, i) {
        if (i < nextVisible) c.classList.remove("is-hidden");
      });
      showMoreBtn.setAttribute("data-visible", String(nextVisible));
      showMoreBtn.setAttribute(
        "aria-expanded",
        nextVisible >= total ? "true" : "false",
      );
      if (nextVisible >= total) {
        var container = showMoreBtn.closest(".pm-okrShowMore");
        if (container) container.remove();
      }
    }

    function activateIndexItem(item) {
      if (!item) return;
      var targetId = item.getAttribute("data-target") || "";
      if (!targetId) return;
      var card = document.getElementById(targetId);
      if (!card) return;
      revealCard(card);
      setCardExpanded(card, true);
      card.scrollIntoView({ behavior: "smooth", block: "start" });
      var toggle = card.querySelector(".pm-okrCardToggle");
      if (toggle) toggle.focus({ preventScroll: true });
    }

    if (indexWrap) {
      indexWrap.addEventListener("click", function (e) {
        var item = e.target.closest(".pm-okrIndexItem");
        if (!item) return;
        activateIndexItem(item);
      });
      indexWrap.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== " ") return;
        var item = e.target.closest(".pm-okrIndexItem");
        if (!item) return;
        e.preventDefault();
        activateIndexItem(item);
      });
    }

    wrap.addEventListener("click", function (e) {
      var showMoreBtn = e.target.closest(".pm-okrShowMoreBtn");
      if (showMoreBtn) {
        var total = parseInt(
          showMoreBtn.getAttribute("data-total") || "0",
          10,
        );
        var step = parseInt(
          showMoreBtn.getAttribute("data-step") || "8",
          10,
        );
        var visible = parseInt(
          showMoreBtn.getAttribute("data-visible") || "0",
          10,
        );
        var cards = Array.from(wrap.querySelectorAll(".pm-okrCard"));
        var nextVisible = Math.min(total, visible + step);
        cards.forEach(function (card, idx) {
          if (idx < nextVisible) card.classList.remove("is-hidden");
        });
        showMoreBtn.setAttribute("data-visible", String(nextVisible));
        showMoreBtn.setAttribute(
          "aria-expanded",
          nextVisible >= total ? "true" : "false",
        );
        if (nextVisible >= total) {
          var container = showMoreBtn.closest(".pm-okrShowMore");
          if (container) container.remove();
        }
        return;
      }
      var cardToggle = e.target.closest(".pm-okrCardToggle");
      if (cardToggle) {
        var card = cardToggle.closest(".pm-okrCard");
        setCardExpanded(card);
        return;
      }
      var krToggle = e.target.closest(".pm-krRowToggle");
      if (krToggle) {
        var krTargetId = krToggle.getAttribute("data-target") || "";
        if (!krTargetId) return;
        var krPanel = document.getElementById(krTargetId);
        if (!krPanel) return;
        var krOpen = !krPanel.hasAttribute("hidden");
        krPanel.toggleAttribute("hidden", krOpen);
        krPanel.setAttribute("aria-hidden", krOpen ? "true" : "false");
        krToggle.setAttribute("aria-expanded", krOpen ? "false" : "true");
        krToggle.textContent = krOpen ? "Details" : "Hide details";
        var krName = krToggle.getAttribute("data-kr") || "";
        var krAction = krOpen ? "Expand" : "Hide";
        krToggle.setAttribute(
          "aria-label",
          krAction + " details" + (krName ? " for " + krName : ""),
        );
        return;
      }
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
      var label = btn.getAttribute("data-label") || "Details";
      var count = btn.getAttribute("data-count") || "0";
      var collapsedLabel = label + " (" + count + ")";
      var expandedLabel = "Hide " + label + " (" + count + ")";
      btn.textContent = isOpen ? collapsedLabel : expandedLabel;
      var okr = btn.getAttribute("data-okr") || "";
      var action = isOpen ? "Expand" : "Hide";
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

  function wireOtherStatusModal() {
    var modal = document.getElementById("pmOtherModal");
    if (!modal) return;
    var closeBtn = document.getElementById("pmOtherModalCloseBtn");
    var cancelBtn = document.getElementById("pmOtherModalCancelBtn");
    var confirmBtn = document.getElementById("pmOtherModalConfirmBtn");

    function getSelection() {
      var selected = modal.querySelector(
        'input[name="pmOtherStatus"]:checked',
      );
      return selected ? selected.value : "";
    }

    function updateConfirmState() {
      if (!confirmBtn) return;
      var selection = getOtherSubTypeValue(getSelection());
      confirmBtn.disabled = !selection;
    }

    modal
      .querySelectorAll('input[name="pmOtherStatus"]')
      .forEach(function (opt) {
        opt.addEventListener("change", updateConfirmState);
      });

    if (closeBtn)
      closeBtn.addEventListener("click", function () {
        closeOtherStatusModal("");
      });
    if (cancelBtn)
      cancelBtn.addEventListener("click", function () {
        closeOtherStatusModal("");
      });
    if (confirmBtn)
      confirmBtn.addEventListener("click", function () {
        var selection = getOtherSubTypeValue(getSelection());
        if (!selection) return;
        closeOtherStatusModal(selection);
      });

    modal.addEventListener("click", function (e) {
      var t = e.target;
      if (t && t.getAttribute && t.getAttribute("data-close") === "1") {
        closeOtherStatusModal("");
      }
    });

    document.addEventListener("keydown", function (e) {
      if (!isOtherModalOpen()) return;
      if (e.key === "Escape") {
        closeOtherStatusModal("");
        return;
      }
      if (e.key !== "Tab") return;
      var focusable = getFocusableElements(modal);
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

    updateConfirmState();
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
      if (action === "project") openModal("New Project", START_PROJECT_URL);
      else if (action === "task") openModal("New Task", START_TASK_URL);
      else if (action === "recurringTask") {
        openModal("New Recurring Task", START_RECURRING_TASK_URL, function (frame) {
          var maxAttempts = 20;  // 20 x 250ms = 5 seconds max wait
          var attempts = 0;

          function tryInject() {
            attempts++;
            try {
              var doc = frame.contentDocument || frame.contentWindow.document;
              if (!doc) {
                if (attempts < maxAttempts) setTimeout(tryInject, 250);
                return;
              }

              var checkbox = doc.querySelector('input[name="' + RECURRING_INDICATOR_ID + '"]');

              if (!checkbox) {
                // Not rendered yet — retry
                if (attempts < maxAttempts) {
                  setTimeout(tryInject, 250);
                } else {
                  console.warn("Recurring checkbox (indicator " + RECURRING_INDICATOR_ID + ") not found after " + maxAttempts + " attempts.");
                }
                return;
              }

              // Checkbox found — inject value
              checkbox.checked = true;
              checkbox.value = "Yes";

              // iCheck API first, fall back to events
              var $cb = frame.contentWindow.$ && frame.contentWindow.$(checkbox);
              if ($cb && $cb.iCheck) {
                $cb.iCheck('check');
              } else {
                checkbox.dispatchEvent(new Event("ifChecked", { bubbles: true }));
                checkbox.dispatchEvent(new Event("change", { bubbles: true }));
                checkbox.dispatchEvent(new Event("click", { bubbles: true }));
              }

              // Hide the field row from the user
              var fieldWrapper =
                checkbox.closest("tr") ||
                checkbox.closest(".xtemplate_field") ||
                checkbox.closest(".leafFormField") ||
                checkbox.parentElement;
              if (fieldWrapper) fieldWrapper.style.display = "none";

              console.log("Recurring checkbox set successfully on attempt " + attempts);

            } catch (e) {
              console.warn("Could not inject recurring checkbox value:", e);
            }
          }

          // Start polling after initial short delay
          setTimeout(tryInject, 300);
        });
      }
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
    var clearBtn = document.getElementById("pmAnalyticsClearFiltersBtn");
    if (clearBtn)
      clearBtn.addEventListener("click", function () {
        setFilterValues("analyticsYear", []);
        setFilterValues("analyticsQuarter", []);
        var yearCtrl = state.filterControls.analyticsYear;
        var quarterCtrl = state.filterControls.analyticsQuarter;
        if (yearCtrl) yearCtrl.clear();
        if (quarterCtrl) quarterCtrl.clear();
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
        xAxes: [{ ticks: { beginAtZero: true, fontColor: "#1f2933" } }],
        yAxes: [{ ticks: { autoSkip: false, fontColor: "#1f2933" } }],
      };
    } else {
      options.indexAxis = "y";
      options.scales = {
        x: { beginAtZero: true, ticks: { color: "#1f2933" } },
        y: { ticks: { autoSkip: false, color: "#1f2933" } },
      };
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

  
  function buildAnalyticsSignature() {
    return [
      "analytics",
      state.tasksVersion,
      signatureFromSet(getFilterSet("analyticsYear")),
      signatureFromSet(getFilterSet("analyticsQuarter")),
    ].join("|");
  }

  function getAnalyticsBaseTasks() {
    if (
      !state.cache.analyticsBase ||
      state.cache.analyticsBase.version !== state.tasksVersion
    ) {
      var list = (state.tasksAll || []).filter(function (t) {
        return !isArchivedStatus(t.status);
      });
      state.cache.analyticsBase = { version: state.tasksVersion, list: list };
    }
    return state.cache.analyticsBase.list || [];
  }

  function isInAnalyticsWindow(date, config) {
    if (!date || isNaN(date.getTime())) return false;
    if (
      config.yearsSet &&
      config.yearsSet.size &&
      !config.yearsSet.has(String(date.getFullYear()))
    )
      return false;
    if (config.quartersSet && config.quartersSet.size) {
      var q = "Q" + (Math.floor(date.getMonth() / 3) + 1);
      if (!config.quartersSet.has(q)) return false;
    }
    return true;
  }

  function getDueBucketForTask(task, now) {
    var due = mmddyyyyToDate(task.due);
    if (!due) return "No due date";
    var diff = Math.round((due.getTime() - now.getTime()) / 86400000);
    if (diff < 0 && !isCompletedStatus(task.status)) return "Overdue";
    if (diff <= 7) return "Due in 7 days";
    if (diff <= 30) return "Due in 30 days";
    return "Due later";
  }

  function adjustCount(obj, key, delta) {
    if (obj[key] == null) obj[key] = 0;
    obj[key] += delta;
    if (obj[key] < 0) obj[key] = 0;
  }

  function adjustIndex(arr, idx, delta) {
    if (!arr[idx]) arr[idx] = 0;
    arr[idx] += delta;
    if (arr[idx] < 0) arr[idx] = 0;
  }

  function getAnalyticsTaskInfo(task, config, now) {
    if (!task || isArchivedStatus(task.status)) {
      return { inGeneral: false, inCompleted: false, inTicket: false };
    }

    var generalDate = getTaskGeneralDate(task);
    var completionDate = getCompletionDateForTask(task);
    var ticketDate = getTicketImportedDate(task);
    var hasTicket = !!String(task.supportTicket || "").trim();

    var inGeneral = !!(
      generalDate && isInAnalyticsWindow(generalDate, config)
    );
    var inCompleted = !!(
      isCompletedStatus(task.status) &&
      completionDate &&
      isInAnalyticsWindow(completionDate, config)
    );
    var inTicket = !!(
      hasTicket && ticketDate && isInAnalyticsWindow(ticketDate, config)
    );

    return {
      task: task,
      inGeneral: inGeneral,
      inCompleted: inCompleted,
      inTicket: inTicket,
      primaryStatus: normalizePrimaryStatus(task.status),
      otherSubType: getOtherSubTypeValue(task.otherSubType),
      projectKey: String(task.projectKey || "").trim() || "(Blank)",
      priority: String(task.priority || "").trim(),
      category: String(task.category || "").trim() || "Unspecified",
      completionDate: completionDate,
      ticketDate: ticketDate,
    };
  }

  function applyAnalyticsGeneralDelta(cache, info, delta, now) {
    if (!info.inGeneral) return;

    var primary = info.primaryStatus;
    if (primary === "Other") {
      adjustCount(cache.statusCounts, "Other", delta);
      if (info.otherSubType === "Blocked")
        adjustCount(cache.otherBuckets, "Other (Blocked)", delta);
      else if (info.otherSubType === "On Hold")
        adjustCount(cache.otherBuckets, "Other (On Hold)", delta);
      else cache.unknownCount += delta;
    } else if (primary === "Unknown") {
      cache.unknownCount += delta;
    } else if (cache.statusCounts[primary] != null) {
      adjustCount(cache.statusCounts, primary, delta);
    } else {
      cache.unknownCount += delta;
    }

    var pk = info.projectKey || "(Blank)";
    adjustCount(cache.byProject, pk, delta);

    var bucket = getDueBucketForTask(info.task, now);
    adjustCount(cache.buckets, bucket, delta);

    var p = info.priority ? info.priority.toLowerCase() : "";
    if (!p) adjustCount(cache.priorityCounts, "Unspecified", delta);
    else if (p === "high") adjustCount(cache.priorityCounts, "High", delta);
    else if (p === "medium")
      adjustCount(cache.priorityCounts, "Medium", delta);
    else if (p === "low") adjustCount(cache.priorityCounts, "Low", delta);
    else adjustCount(cache.priorityCounts, "Unspecified", delta);

    if (!cache.health[pk]) cache.health[pk] = { total: 0, overdue: 0, completed: 0 };
    cache.health[pk].total += delta;
    if (isCompletedStatus(info.task.status)) cache.health[pk].completed += delta;
    if (isOverdueTask(info.task, now)) cache.health[pk].overdue += delta;

    if (isOverdueTask(info.task, now)) {
      if (delta > 0) cache.overdueTasks.push(info.task);
      else removeTaskFromList(cache.overdueTasks, info.task.recordID);
    }
  }

  function applyAnalyticsCompletedDelta(cache, info, delta) {
    if (!info.inCompleted) return;
    if (info.completionDate) {
      var q = Math.floor(info.completionDate.getMonth() / 3);
      adjustIndex(cache.quarters, q, delta);
    }
    adjustCount(cache.catCounts, info.category, delta);
  }

  function applyAnalyticsTicketDelta(cache, info, delta) {
    if (!info.inTicket) return;
    if (info.ticketDate) {
      adjustIndex(cache.ticketCounts, info.ticketDate.getMonth(), delta);
    }
  }

  function updateAnalyticsCacheEntry(cache, oldTask, newTask, now) {
    if (!cache || !cache.config) return;
    var oldInfo = getAnalyticsTaskInfo(oldTask, cache.config, now);
    var newInfo = getAnalyticsTaskInfo(newTask, cache.config, now);

    if (oldInfo.inGeneral) applyAnalyticsGeneralDelta(cache, oldInfo, -1, now);
    if (newInfo.inGeneral) applyAnalyticsGeneralDelta(cache, newInfo, 1, now);

    if (oldInfo.inCompleted) applyAnalyticsCompletedDelta(cache, oldInfo, -1);
    if (newInfo.inCompleted) applyAnalyticsCompletedDelta(cache, newInfo, 1);

    if (oldInfo.inTicket) applyAnalyticsTicketDelta(cache, oldInfo, -1);
    if (newInfo.inTicket) applyAnalyticsTicketDelta(cache, newInfo, 1);
  }

  function computeAnalyticsCache(analyticsTasks, analyticsProjects, config) {
    var now = new Date();
    var years = (config.years || []).map(function (y) {
      return String(y);
    });
    var quarters = (config.quarters || []).map(function (q) {
      return String(q);
    });
    var yearsSet = new Set(years);
    var quartersSet = new Set(quarters);
    config.yearsSet = yearsSet;
    config.quartersSet = quartersSet;
    var isAllYears = !yearsSet.size;
    var isAllQuarters = !quartersSet.size;

    function inSelectedYear(d) {
      if (!d || isNaN(d.getTime())) return false;
      if (isAllYears) return true;
      return yearsSet.has(String(d.getFullYear()));
    }

    function inSelectedQuarter(d) {
      if (!d || isNaN(d.getTime())) return false;
      if (isAllQuarters) return true;
      var q = "Q" + (Math.floor(d.getMonth() / 3) + 1);
      return quartersSet.has(q);
    }

    var tasksForGeneralCharts = (analyticsTasks || []).filter(function (t) {
      var d = getTaskGeneralDate(t);
      if (!d || isNaN(d.getTime())) return false;
      return inSelectedYear(d) && inSelectedQuarter(d);
    });

    var projectsForGeneralCharts = (analyticsProjects || []).filter(function (p) {
      var d = getProjectGeneralDate(p);
      if (!d || isNaN(d.getTime())) return false;
      return inSelectedYear(d) && inSelectedQuarter(d);
    });

    var statusCounts = {};
    STATUS_CONFIG.ALL_STATUSES.forEach(function (label) {
      statusCounts[label] = 0;
    });
    var otherBuckets = { "Other (Blocked)": 0, "Other (On Hold)": 0 };
    var unknownCount = 0;
    var byProject = {};
    var buckets = {
      Overdue: 0,
      "Due in 7 days": 0,
      "Due in 30 days": 0,
      "Due later": 0,
      "No due date": 0,
    };
    var priorityCounts = { High: 0, Medium: 0, Low: 0, Unspecified: 0 };
    var health = {};
    var overdueTasks = [];

    tasksForGeneralCharts.forEach(function (t) {
      var primaryStatus = normalizePrimaryStatus(t.status);
      if (primaryStatus === "Other") {
        statusCounts.Other += 1;
        var subType = getOtherSubTypeValue(t.otherSubType);
        if (subType === "Blocked") otherBuckets["Other (Blocked)"] += 1;
        else if (subType === "On Hold") otherBuckets["Other (On Hold)"] += 1;
        else unknownCount += 1;
      } else if (primaryStatus === "Unknown") {
        unknownCount += 1;
      } else if (statusCounts[primaryStatus] != null) {
        statusCounts[primaryStatus] += 1;
      } else {
        unknownCount += 1;
      }

      var pk = String(t.projectKey || "").trim() || "(Blank)";
      byProject[pk] = (byProject[pk] || 0) + 1;

      var bucket = getDueBucketForTask(t, now);
      buckets[bucket] = (buckets[bucket] || 0) + 1;

      var p = String(t.priority || "").trim();
      if (!p) priorityCounts.Unspecified += 1;
      else if (p.toLowerCase() === "high") priorityCounts.High += 1;
      else if (p.toLowerCase() === "medium") priorityCounts.Medium += 1;
      else if (p.toLowerCase() === "low") priorityCounts.Low += 1;
      else priorityCounts.Unspecified += 1;

      if (!health[pk]) health[pk] = { total: 0, overdue: 0, completed: 0 };
      health[pk].total += 1;

      var st = String(t.status || "").toLowerCase();
      if (st.indexOf("completed") !== -1) health[pk].completed += 1;

      if (isOverdueTask(t, now)) {
        health[pk].overdue += 1;
        overdueTasks.push(t);
      }
    });

    var completedTasks = (analyticsTasks || []).filter(function (t) {
      return isCompletedStatus(t.status);
    });
    var completedTasksForCharts = completedTasks.filter(function (t) {
      var date = getCompletionDateForTask(t);
      if (!date || isNaN(date.getTime())) return false;
      return inSelectedYear(date) && inSelectedQuarter(date);
    });

    var quarters = [0, 0, 0, 0];
    completedTasksForCharts.forEach(function (t) {
      var date = getCompletionDateForTask(t);
      if (!date) return;
      var q = Math.floor(date.getMonth() / 3);
      quarters[q] += 1;
    });

    var catCounts = {};
    completedTasksForCharts.forEach(function (t) {
      var cat = String(t.category || "").trim() || "Unspecified";
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });

    var ticketTasks = (analyticsTasks || []).filter(function (t) {
      return !!String(t.supportTicket || "").trim();
    });
    var ticketCounts = new Array(12).fill(0);
    ticketTasks.forEach(function (t) {
      var date = getTicketImportedDate(t);
      if (!date || !inSelectedYear(date)) return;
      if (!inSelectedQuarter(date)) return;
      ticketCounts[date.getMonth()] += 1;
    });

    var projectTypeData = buildProjectTypeChartData(projectsForGeneralCharts);

    var yearLabel = isAllYears
      ? "All years"
      : "Years " + years.slice().sort().join(", ");
    var quarterLabel = isAllQuarters
      ? "all quarters"
      : quarters.slice().sort().join(", ");
    var filterLabel = yearLabel + ", " + quarterLabel;

    return {
      config: config,
      filterLabel: filterLabel,
      statusCounts: statusCounts,
      otherBuckets: otherBuckets,
      unknownCount: unknownCount,
      byProject: byProject,
      buckets: buckets,
      priorityCounts: priorityCounts,
      health: health,
      overdueTasks: overdueTasks,
      quarters: quarters,
      catCounts: catCounts,
      ticketCounts: ticketCounts,
      projectTypeData: projectTypeData,
    };
  }

  function updateOrCreateChart(slot, canvasId, labels, data, datasetLabel, colors) {
    var ctx = sizeChartBox(canvasId, labels.length || 1);
    if (!ctx) return;

    var dataset = { label: datasetLabel, data: data };
    if (colors) {
      dataset.backgroundColor = colors;
      dataset.borderColor = colors;
      dataset.borderWidth = 1;
    }

    var chart = state.charts[slot];
    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets = [dataset];
      chart.update();
      return;
    }

    state.charts[slot] = new Chart(ctx, {
      type: getHorizontalBarType(),
      data: {
        labels: labels,
        datasets: [dataset],
      },
      options: buildHorizontalBarOptions(),
    });
  }

  function ensureAnalyticsTableState() {
    if (!state.analyticsTables) {
      state.analyticsTables = {
        healthExpanded: false,
        overdueExpanded: false,
        healthRows: [],
        overdueRows: [],
      };
    }
    return state.analyticsTables;
  }

  function renderAnalyticsTable(
    containerId,
    tableId,
    headerHtml,
    rows,
    colCount,
    expanded,
    toggleKey,
    emptyLabel,
  ) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var total = rows.length;
    var limit = 20;
    var showAll = !!expanded;
    var visibleRows = showAll ? rows : rows.slice(0, limit);
    var shown = showAll ? total : Math.min(limit, total);
    var rangeText =
      "Showing " + shown + " of " + total + " result" + (total === 1 ? "" : "s");
    var showToggle = total > limit;
    var toggleHtml = showToggle
      ? '<button type="button" class="pm-ghostBtn pm-tableToggle" data-analytics-toggle="' +
        toggleKey +
        '" aria-expanded="' +
        (showAll ? "true" : "false") +
        '" aria-controls="' +
        tableId +
        '">' +
        (showAll ? "Show less" : "Show all") +
        "</button>"
      : "";
    var metaHtml =
      total > 0
        ? '<div class="pm-tableMeta"><span class="pm-tableRange">' +
          rangeText +
          "</span>" +
          toggleHtml +
          "</div>"
        : "";
    var bodyHtml =
      visibleRows.join("") ||
      "<tr><td colspan='" + colCount + "'>" + emptyLabel + "</td></tr>";

    container.innerHTML =
      '<table class="pm-table" id="' +
      tableId +
      '">' +
      headerHtml +
      "<tbody>" +
      bodyHtml +
      "</tbody></table>" +
      metaHtml;
  }

  function renderAnalyticsTablesFromState() {
    var tableState = ensureAnalyticsTableState();
    renderAnalyticsTable(
      "pmProjectHealthTable",
      "pmProjectHealthTableInner",
      "<thead><tr><th>Project Key</th><th>Total tasks</th><th>Completed</th><th>Completed percent</th><th>Overdue</th></tr></thead>",
      tableState.healthRows || [],
      5,
      tableState.healthExpanded,
      "health",
      "No data",
    );
    renderAnalyticsTable(
      "pmOverdueTasksTable",
      "pmOverdueTasksTableInner",
      "<thead><tr><th>Project Key</th><th>Task ID</th><th>Title</th><th>Assigned To</th><th>Due</th><th>Status</th></tr></thead>",
      tableState.overdueRows || [],
      6,
      tableState.overdueExpanded,
      "overdue",
      "No overdue tasks",
    );

    ["pmProjectHealthTable", "pmOverdueTasksTable"].forEach(function (id) {
      var container = document.getElementById(id);
      if (!container || container.dataset.toggleBound === "1") return;
      container.dataset.toggleBound = "1";
      container.addEventListener("click", function (e) {
        var btn = e.target.closest("button[data-analytics-toggle]");
        if (!btn) return;
        var key = btn.getAttribute("data-analytics-toggle");
        if (!key) return;
        if (key === "health")
          tableState.healthExpanded = !tableState.healthExpanded;
        if (key === "overdue")
          tableState.overdueExpanded = !tableState.overdueExpanded;
        renderAnalyticsTablesFromState();
        var nextBtn = container.querySelector(
          'button[data-analytics-toggle="' + key + '"]',
        );
        if (nextBtn) nextBtn.focus();
      });
    });
  }

  function renderAnalyticsTablesFromCache(cache) {
    var tableState = ensureAnalyticsTableState();
    tableState.healthRows = Object.keys(cache.health)
      .sort(function (a, b) {
        return a.localeCompare(b);
      })
      .map(function (pk) {
        var h = cache.health[pk];
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
      });

    var overdueTasks = (cache.overdueTasks || [])
      .slice()
      .sort(function (a, b) {
        var da = mmddyyyyToDate(a.due) || new Date(8640000000000000);
        var db = mmddyyyyToDate(b.due) || new Date(8640000000000000);
        return da - db;
      });

    tableState.overdueRows = overdueTasks.map(function (t) {
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
        " (Overdue)</td>" +
        "<td>" +
        renderStatusCell(t) +
        "</td>" +
        "</tr>"
      );
    });

    renderAnalyticsTablesFromState();
  }

  function renderAnalyticsFromCache(cache) {
    var filterLabel = cache.filterLabel || "All years, all quarters";

    var statusLabels = [];
    STATUS_CONFIG.ALL_STATUSES.forEach(function (label) {
      if (label === "Other") {
        statusLabels.push("Other (Blocked)", "Other (On Hold)");
      } else {
        statusLabels.push(label);
      }
    });
    if (cache.unknownCount > 0) statusLabels.push("Unknown");
    var statusData = statusLabels.map(function (label) {
      if (label === "Other (Blocked)") return cache.otherBuckets["Other (Blocked)"] || 0;
      if (label === "Other (On Hold)") return cache.otherBuckets["Other (On Hold)"] || 0;
      if (label === "Unknown") return cache.unknownCount || 0;
      return cache.statusCounts[label] || 0;
    });
    setChartSummary(
      "pmChartTasksByStatusDesc",
      "Tasks by status (" +
        filterLabel +
        "): " +
        summarizeLabelData(statusLabels, statusData),
    );

    updateOrCreateChart(
      "status",
      "pmChartTasksByStatus",
      statusLabels,
      statusData,
      "Tasks",
    );

    var bucketLabels = Object.keys(cache.buckets);
    var bucketData = bucketLabels.map(function (k) {
      return cache.buckets[k] || 0;
    });
    setChartSummary(
      "pmChartDueBucketsDesc",
      "Due date buckets (" +
        filterLabel +
        "): " +
        summarizeLabelData(bucketLabels, bucketData),
    );
    var dueColors = bucketLabels.map(function (label) {
      return String(label).toLowerCase() === "overdue" ? "#ff4040" : "#aacdec";
    });
    updateOrCreateChart(
      "dueBuckets",
      "pmChartDueBuckets",
      bucketLabels,
      bucketData,
      "Tasks",
      dueColors,
    );

    var quarters = cache.quarters || [0, 0, 0, 0];
    setChartSummary(
      "pmChartCompletedByQuarterDesc",
      "Completed tasks by quarter (" +
        filterLabel +
        "): " +
        summarizeLabelData(["Q1", "Q2", "Q3", "Q4"], quarters),
    );
    updateOrCreateChart(
      "completedByQuarter",
      "pmChartCompletedByQuarter",
      ["Q1", "Q2", "Q3", "Q4"],
      quarters,
      "Completed tasks",
    );

    var catLabels = Object.keys(cache.catCounts || {}).sort(function (a, b) {
      return a.localeCompare(b);
    });
    var catData = catLabels.map(function (k) {
      return cache.catCounts[k] || 0;
    });
    setChartSummary(
      "pmChartCompletedByCategoryDesc",
      "Completed tasks by category (" +
        filterLabel +
        "): " +
        (catLabels.length ? summarizeLabelData(catLabels, catData) : "No data."),
    );
    updateOrCreateChart(
      "completedByCategory",
      "pmChartCompletedByCategory",
      catLabels.length ? catLabels : ["No data"],
      catLabels.length ? catData : [0],
      "Completed tasks",
    );

    var priorityLabels = Object.keys(cache.priorityCounts);
    var priorityData = priorityLabels.map(function (k) {
      return cache.priorityCounts[k] || 0;
    });
    setChartSummary(
      "pmChartTasksByPriorityDesc",
      "Tasks by priority (" +
        filterLabel +
        "): " +
        summarizeLabelData(priorityLabels, priorityData),
    );
    var priorityColors = ["#f2938c", "#e6c74c", "#aacdec", "#cfcfcf"];
    updateOrCreateChart(
      "priority",
      "pmChartTasksByPriority",
      priorityLabels,
      priorityData,
      "Tasks",
      priorityColors,
    );

    var projLabels = Object.keys(cache.byProject).sort(function (a, b) {
      return a.localeCompare(b);
    });
    var projData = projLabels.map(function (k) {
      return cache.byProject[k] || 0;
    });
    setChartSummary(
      "pmChartTasksByProjectDesc",
      "Tasks per project key (" +
        filterLabel +
        "): " +
        (projLabels.length ? summarizeLabelData(projLabels, projData) : "No data."),
    );
    updateOrCreateChart(
      "projectKey",
      "pmChartTasksByProject",
      projLabels.length ? projLabels : ["No data"],
      projLabels.length ? projData : [0],
      "Tasks",
    );

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
        summarizeLabelData(ticketLabels, cache.ticketCounts),
    );
    updateOrCreateChart(
      "ticketsImported",
      "pmChartTicketsImported",
      ticketLabels,
      cache.ticketCounts,
      "Tickets imported",
    );

    var projectTypeData = cache.projectTypeData || { labels: [], data: [] };
    setChartSummary(
      "pmChartProjectsByTypeDesc",
      "Projects by project type (" +
        filterLabel +
        "): " +
        (projectTypeData.labels.length
          ? summarizeLabelData(projectTypeData.labels, projectTypeData.data)
          : "No data."),
    );
    updateOrCreateChart(
      "projectsByType",
      "pmChartProjectsByType",
      projectTypeData.labels.length ? projectTypeData.labels : ["No data"],
      projectTypeData.labels.length ? projectTypeData.data : [0],
      "Projects",
    );

    renderAnalyticsTablesFromCache(cache);
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
    var yearControl = state.filterControls.analyticsYear;
    var quarterControl = state.filterControls.analyticsQuarter;
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

    if (yearControl) {
      yearControl.setOptions(
        generalYears.map(function (y) {
          return { value: String(y), label: String(y) };
        }),
      );
    }

    var quarterOptions = [
      { value: "Q1", label: "Q1" },
      { value: "Q2", label: "Q2" },
      { value: "Q3", label: "Q3" },
      { value: "Q4", label: "Q4" },
    ];
    if (quarterControl) {
      quarterControl.setOptions(quarterOptions);
    }

    var sig = buildAnalyticsSignature();
    var cache = state.cache.analytics.get(sig);
    if (!cache) {
      cache = computeAnalyticsCache(analyticsTasks, analyticsProjects, {
        years: Array.from(getFilterSet("analyticsYear")),
        quarters: Array.from(getFilterSet("analyticsQuarter")),
      });
      state.cache.analytics.set(sig, cache);
    }

    renderAnalyticsFromCache(cache);
  }


  async function main() {
    try {
      flushTransferDebug();
      wireTabs();
      wireTaskViewToggle();
      wireDevOnlyToggle();
      wireAnalyticsViewToggle();
      wireOkrTableViewToggle();
      wireSortingDelegation();
      initFilterControls();
      wireClearFilters();
      wireOkrFilters();
      wireOkrRollupToggle();
      wireRecordModalLinks();
      wireSupportMessageListener();
      wireModalControls();
      wireOtherStatusModal();
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
          PROJECT_IND.keyResultSelection,
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
          TASK_IND.otherSubType,
          TASK_IND.priority,
          TASK_IND.category,
          TASK_IND.dependencies,
          TASK_IND.assignedTo,
          TASK_IND.startDate,
          TASK_IND.dueDate,
          TASK_IND.supportTicket,
          TASK_IND.okrAssociation,
          TASK_IND.keyResultSelection,
          TASK_IND.isRecurring,
        ],
        [],
      );

      var keyResultsUrl = buildQueryUrl(
        [KEY_RESULT_IND.okrKey, KEY_RESULT_IND.name],
        [],
      );

      var results = await Promise.all([
        fetchJSON(projectsUrl),
        fetchJSON(tasksUrl),
        fetchJSON(keyResultsUrl),
      ]);
      var projectsJson = results[0];
      var tasksJson = results[1];
      var keyResultsJson = results[2];

      var projectRowsAll = coerceRows(projectsJson) || [];
      var taskRowsAll = coerceRows(tasksJson) || [];

      var projectRows = projectRowsAll.filter(function (r) {
        return hasAnyS1Value(
          r,
          [2, 3, 4, 5, 6, 23, 24, 25, 26, 29, 32, 33, 37, 38],
        );
      });
      var taskRows = taskRowsAll.filter(function (r) {
        return hasAnyS1Value(
          r,
          [8, 9, 10, 44, 11, 12, 13, 14, 16, 17, 18, 30, 39],
        );
      });

      var keyResultRows = (coerceRows(keyResultsJson) || []).filter(
        function (r) {
          return hasAnyIndicatorValue(r, [35, 36]);
        },
      );

      state.projectsAll = projectRows.map(normalizeProject);

      state.projectsVersion = (state.projectsVersion || 0) + 1;
      state.tasksAll = taskRows.map(normalizeTask);

      state.tasksById = new Map();
      state.tasksAll.forEach(function (t) {
        state.tasksById.set(String(t.recordID), t);
      });
      invalidateTaskCaches();
      state.keyResultsAll = keyResultRows.map(normalizeKeyResult);
      state.projectsLoaded = true;
      backfillSupportTicketLabels(state.tasksAll);
      checkAndCopyResolvedRecurringTasks();

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
      refreshStatusDropdown();

      
      var debouncedSearch = debounce(function () {
        applySearchAndFilters(true);
      }, 275);

      var searchInput = document.getElementById("pmSearchInput");
      if (searchInput) {
        searchInput.addEventListener("input", debouncedSearch);
      }


      state.dataReady = true;

      var activeTab =
        localStorage.getItem(STORAGE_KEYS.activeTab) || "projects";
      setActiveTab(activeTab);

      applySearchAndFilters(true);
    } catch (e) {
      console.error("Failed to load data.", e);
    } finally {
      await handleTransferFromSupport();
    }
  }

  handleTransferFromSupport();
  window.addEventListener("load", handleTransferFromSupport);
  document.addEventListener("DOMContentLoaded", main);

  // DEBUG: expose recurring task functions to window for console testing
  // TODO: remove after confirmed working
  window._pmCheckRecurring = checkAndCopyResolvedRecurringTasks;
  window._pmCopyRecurring = copyRecurringTask;
})();
