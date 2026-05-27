(function () {
  var env = document.getElementById("pmEnv");
  var CSRFToken = "";
  var CURRENT_USER_ID = "";
  var CURRENT_USER_NAME = "";
  if (env) {
    CSRFToken =
      env.getAttribute("data-csrf") ||
      env.getAttribute("data-csrf-alt") ||
      env.getAttribute("data-csrf2") ||
      "";
    CURRENT_USER_ID = env.getAttribute("data-userid") || "";
    CURRENT_USER_NAME = env.getAttribute("data-username") || "";
  }

  // Indicator ID for the isRecurring checkbox field on the Task form.
  // IMPORTANT: Replace 99 with the real LEAF indicator ID once the field is created.
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
    actualCompletionDate: 47,
    // Indicator 48: recurringCopied — written to the SOURCE task after a successful
    // copy. Stores the new copy's recordID as a string. Provides server-side
    // deduplication that survives localStorage clears, private browsing, new devices,
    // and deleted copies. IMPORTANT: Must be created manually in LEAF Form Editor on
    // the task form (type = text, label = "Continued As Task #", read-only) before this
    // logic takes effect. Until then, deduplication falls back to localStorage only.
    recurringCopied: 48,
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
    ticketNumber: 68,
    projectEndDate: 70,
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
    encodeURIComponent(RECURRING_INDICATOR_ID) +
    "=Yes";
  var START_OKR_URL =
    "https://leaf.va.gov/platform/projects/report.php?a=LEAF_Start_Request&id=form_a2b55&title=OKR";
  var START_KEY_RESULT_URL =
    "https://leaf.va.gov/platform/projects/report.php?a=LEAF_Start_Request&id=form_6530b&title=Key+Result";

  var PROJECTS_INITIAL_BATCH = 50;
  var PROJECTS_LOAD_MORE_BATCH = 50;

  // Persistence keys
  var STORAGE_KEYS = {
    activeTab: "pm_active_tab_v18",
    tasksView: "pm_tasks_view_v18",
    analyticsView: "pm_analytics_view_v18",
    tasksDevOnly: "pmdashboard_tasks_devOnly_v18",
    tasksPagination: "pm_tasks_pagination_v18",
    FILTER_STATE_KEY: "pm_filter_state_v18",
    dateRange: "pm_date_range_v18",
  };

  var OVERDUE_ALERT_DISMISSED_KEY = "pm_overdue_alert_dismissed_v18";

  var STATUS_CONFIG = {
    ALL_STATUSES: [
      "Not Started",
      "In Progress",
      "Ready for HCD Review",
      "Ready for Testing",
      "Ready for PO Review",
      "Other",
      "Completed",
      "Cancelled",
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
    projects: {
      storageKey: "pm_projects_pagination_v18",
      containerId: "pmProjectsTablePagination",
      defaultPageSize: 25,
      pageSizes: [25, 50, 100],
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
    recurringOnly: false,
    dateRangeFilter: null,
    modalHistory: [],
    modalHistoryIndex: -1,
    pendingProjectKeyRefresh: null,
    okrTableView: "objectives",
    filters: {
      projectFiscalYear: new Set(),
      projectOwner: new Set(),
      projectStatus: new Set(),
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
    projectTableCurrentRows: [],
    projectTableRenderedCount: 0,
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
      scheduleVariance: null,
    },
    drilldownActive: {},
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
    pagination: {
      tasks: {
        page: 1,
        pageSize: 100,
        signature: "",
        total: 0,
        totalPages: 1,
        inited: false,
      },
      projects: {
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
    lastModalRecordID: null,
  };

  var _kanbanColsCache = { devOnly: null, cols: null };

  // Persistent dedup — survives page refresh
  // Stores recordIDs that have already been copied as recurring tasks
  var RECURRING_COPIED_KEY = "pm_recurring_copied_v18";

  function getRecurringCopiedSet() {
    try {
      var stored = localStorage.getItem(RECURRING_COPIED_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (e) {
      return new Set();
    }
  }

  function addRecurringCopied(recordID) {
    try {
      var set = getRecurringCopiedSet();
      set.add(String(recordID));
      localStorage.setItem(
        RECURRING_COPIED_KEY,
        JSON.stringify(Array.from(set)),
      );
    } catch (e) {
      console.warn("addRecurringCopied storage error:", e);
    }
  }

  // In-memory lock to prevent concurrent copies within same poll cycle
  var recurringInProgress = new Set();

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
    if (_kanbanColsCache.devOnly === state.devOnly && _kanbanColsCache.cols) {
      return _kanbanColsCache.cols.slice();
    }
    var cols = state.devOnly
      ? STATUS_CONFIG.DEV_KANBAN_COLUMNS.slice()
      : STATUS_CONFIG.LEGACY_KANBAN_COLUMNS.slice();
    _kanbanColsCache.devOnly = state.devOnly;
    _kanbanColsCache.cols = cols;
    return cols.slice();
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

  /*
   * RECURRING TASK DEDUPLICATION — REQUIRED MANUAL SETUP IN LEAF:
   *
   * Indicator 48 must be created manually in the LEAF Form Editor:
   *   1. Go to Admin Panel → Form Editor → Task form
   *   2. Add a new field: type = text, label = "Continued As Task #"
   *   3. Set the indicator ID to 48 (or note the assigned ID and update
   *      TASK_IND.recurringCopied in project_v10.js to match)
   *   4. Set field permissions to read-only for regular users
   *   5. This field will be auto-populated by the dashboard after each
   *      successful recurring task copy
   *
   * Until this is done, deduplication falls back to localStorage only.
   */
  async function isRecurringAlreadyCopiedServerSide(sourceRecordID) {
    try {
      var q = JSON.stringify({
        terms: [
          {
            id: "recordIDs",
            operator: "=",
            match: String(sourceRecordID),
            gate: "AND",
          },
        ],
        joins: [],
        sort: {},
        getData: [TASK_IND.recurringCopied],
      });
      var resp = await fetch(
        "api/form/query?q=" + encodeURIComponent(q) + "&x-filterData=recordID",
        {
          credentials: "include",
          headers: {
            Accept: "application/json",
            "x-requested-with": "XMLHttpRequest",
          },
        },
      );
      if (!resp.ok) return false;
      var data = await resp.json();
      var rec = data && data[String(sourceRecordID)];
      var val =
        rec && rec.s1
          ? String(rec.s1["id" + TASK_IND.recurringCopied] || "").trim()
          : "";
      return val.length > 0;
    } catch (e) {
      return false; // fail open — localStorage guard still applies
    }
  }

  async function checkAndCopyResolvedRecurringTasks() {
    try {
      // Pre-fetch CSRF token using fetchCSRFFromAPI which handles
      // the formData.append format that LEAF uses on this site
      var token = getCSRFToken();
      if (!token || token.indexOf("{") === 0) {
        token = await fetchCSRFFromAPI();
        if (!token) {
          console.warn(
            "checkAndCopyResolvedRecurringTasks: could not obtain CSRF token, skipping.",
          );
          return;
        }
      }
      // Cache it so createTaskRecord and ensureCSRFToken can use it downstream
      cacheCSRF(token, "CSRFToken");

      var query = new LeafFormQuery();
      query.addTerm("stepID", "=", "resolved");
      query.addDataTerm("data", TASK_IND.isRecurring, "=", "Yes");
      query.addTerm("categoryID", "=", "form_9b302");
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

      var copiedSet = getRecurringCopiedSet();
      for (var recordID in results) {
        // Skip if already copied (persistent) or currently being copied (in-memory lock)
        if (copiedSet.has(String(recordID))) continue;
        if (recurringInProgress.has(String(recordID))) continue;

        // Server-side check — survives localStorage clears, new browsers, and deleted copies
        var serverSideCopied =
          await isRecurringAlreadyCopiedServerSide(recordID);
        if (serverSideCopied) {
          addRecurringCopied(recordID); // re-hydrate localStorage from server truth
          continue;
        }

        // Lock immediately before any async work
        recurringInProgress.add(String(recordID));
        addRecurringCopied(recordID);

        try {
          var newRecordID = await copyRecurringTask(recordID);

          // Write indicator 48 to the SOURCE record — permanent server-side dedup marker.
          // Survives localStorage clears, private browsing, new devices, and deleted copies.
          try {
            var flagToken = await ensureCSRFToken(recordID);
            var flagField = state.csrfField || getCSRFFieldName();
            var flagObj = { recordID: recordID, series: 1 };
            flagObj[TASK_IND.recurringCopied] = String(newRecordID);
            flagObj[flagField] = flagToken;
            var flagRes = await fetch(
              FORM_POST_ENDPOINT_PREFIX + encodeURIComponent(String(recordID)),
              {
                method: "POST",
                headers: {
                  "content-type":
                    "application/x-www-form-urlencoded; charset=UTF-8",
                  "x-requested-with": "XMLHttpRequest",
                  "x-csrf-token": flagToken,
                  "x-xsrf-token": flagToken,
                },
                credentials: "include",
                body: encodeFormBody(flagObj),
              },
            );
            if (!flagRes.ok) {
              console.warn(
                'pm-dashboard: failed to write "Continued As Task #" flag to record ' +
                  recordID +
                  " — HTTP " +
                  flagRes.status,
              );
            }
          } catch (flagErr) {
            console.warn(
              'pm-dashboard: error writing "Continued As Task #" flag:',
              flagErr,
            );
          }
        } catch (e) {
          console.error("Failed to copy recurring task " + recordID, e);
          // Remove from both on failure so it can retry
          recurringInProgress.delete(String(recordID));
          try {
            var set = getRecurringCopiedSet();
            set.delete(String(recordID));
            localStorage.setItem(
              RECURRING_COPIED_KEY,
              JSON.stringify(Array.from(set)),
            );
          } catch (e2) {}
        }
      }
    } catch (e) {
      console.error("checkAndCopyResolvedRecurringTasks failed", e);
    }
  }

  async function copyRecurringTask(sourceRecordID) {
    if (!sourceRecordID) throw new Error("copyRecurringTask: missing recordID");

    // Step 1: Read source record data via query API
    var query = new LeafFormQuery();
    query.addTerm("recordIDs", "=", String(sourceRecordID));
    query.getData([
      TASK_IND.projectKey,
      TASK_IND.title,
      TASK_IND.status,
      TASK_IND.assignedTo,
      TASK_IND.startDate,
      TASK_IND.dueDate,
      TASK_IND.priority,
      TASK_IND.category,
      TASK_IND.dependencies,
      TASK_IND.supportTicket,
      TASK_IND.okrAssociation,
      TASK_IND.keyResultSelection,
      TASK_IND.isRecurring,
    ]);

    var results = await query.execute();
    var sourceRecord = results[String(sourceRecordID)];
    if (!sourceRecord || !sourceRecord.s1) {
      throw new Error(
        "copyRecurringTask: could not read source record " + sourceRecordID,
      );
    }

    var s1 = sourceRecord.s1;

    // Step 2: Get CSRF token
    var token = await fetchCSRFFromAPI();
    if (!token) throw new Error("copyRecurringTask: missing CSRFToken");

    // Step 3: Create new record with all data in a single api/form/new POST
    var fd = new FormData();
    fd.append("CSRFToken", token);
    fd.append("numform_9b302", "1");

    // Use actual title from source record
    fd.append("title", sourceRecord.title || "Recurring Task");

    // Fields to skip — reset on new copy
    var skipFields = new Set([
      "id" + TASK_IND.status,
      "id" + TASK_IND.otherSubType,
    ]);

    // Copy s1 fields — only id[number] keys, skip timestamps and metadata
    Object.keys(s1).forEach(function (key) {
      if (!/^id\d+$/.test(key)) return; // skip timestamps, _orgchart, etc
      if (skipFields.has(key)) return;
      var indID = key.replace("id", "");
      var value = s1[key];

      // Skip nulls, empty, empty arrays
      if (
        value === null ||
        value === undefined ||
        value === "" ||
        value === "[]"
      )
        return;

      // Skip objects — these are complex types that need special handling below
      if (typeof value === "object") return;

      fd.append(indID, String(value));
    });

    // Special handling: assignedTo (indicator 11) uses orgchart format
    // LEAF expects userName, not display name
    var orgchart = s1["id" + TASK_IND.assignedTo + "_orgchart"];
    var assignedTo = s1["id" + TASK_IND.assignedTo];

    if (orgchart && orgchart.userName) {
      // Use userName from orgchart metadata — most reliable format
      fd.append(String(TASK_IND.assignedTo), orgchart.userName);
    } else if (
      assignedTo &&
      typeof assignedTo === "string" &&
      assignedTo.trim() !== ""
    ) {
      fd.append(String(TASK_IND.assignedTo), assignedTo.trim());
    }

    // Always set isRecurring to Yes on the copy
    fd.append(String(TASK_IND.isRecurring), "Yes");

    // Reset status to Not Started
    fd.append(String(TASK_IND.status), "Not Started");

    // Write source record ID to indicator 46 for traceability
    fd.append("46", String(sourceRecordID));

    var headers = {
      "x-requested-with": "XMLHttpRequest",
      "x-csrf-token": token,
      "x-xsrf-token": token,
    };

    var r = await fetch("/platform/projects/api/form/new", {
      method: "POST",
      credentials: "include",
      headers: headers,
      body: fd,
    });

    if (!r.ok) throw new Error("Create failed HTTP " + r.status);

    var text = await r.text();
    var newRecordID;
    try {
      newRecordID = JSON.parse(text);
    } catch (e) {
      newRecordID = text;
    }
    newRecordID = String(newRecordID || "")
      .trim()
      .replace(/^\"|\"$/g, "");
    if (!newRecordID || newRecordID === "Invalid Token.") {
      throw new Error(
        "copyRecurringTask: invalid new record ID: " + newRecordID,
      );
    }

    showRecurringBanner(newRecordID);
    scheduleSilentRefresh(5000); // 5 second delay after banner shows
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          { type: "pmRecurringBannerMsg", newRecordID: String(newRecordID) },
          "*",
        );
      }
    } catch (e) {}

    // Step 4: Copy assignedTo field using LEAF orgchart API sequence
    var orgchart = s1["id" + TASK_IND.assignedTo + "_orgchart"];
    var assignedUserName =
      orgchart && orgchart.userName ? orgchart.userName : null;
    var assignedEmpUID =
      orgchart && orgchart.empUID && orgchart.empUID !== 0
        ? orgchart.empUID
        : null;

    if (assignedUserName) {
      try {
        var orgToken = await fetchCSRFFromAPI();

        // Step 4a: Search by username to find employee
        await fetch(
          "/platform/orgchart/api/national/employee/search?q=userName:" +
            encodeURIComponent(assignedUserName) +
            "&noLimit=0&domain=&_=" +
            Date.now(),
          {
            credentials: "include",
            headers: { "x-requested-with": "XMLHttpRequest" },
          },
        );

        // Step 4b: Import employee into local orgchart
        var importResp = await fetch(
          "/platform/orgchart/api/employee/import/_" +
            encodeURIComponent(assignedUserName),
          {
            method: "POST",
            credentials: "include",
            headers: {
              "content-type":
                "application/x-www-form-urlencoded; charset=UTF-8",
              "x-requested-with": "XMLHttpRequest",
              "x-csrf-token": orgToken,
            },
            body: encodeFormBody({ CSRFToken: orgToken }),
          },
        );

        // Step 4c: Search by empUID to confirm import
        if (assignedEmpUID) {
          await fetch(
            "/platform/orgchart/api/employee/search?q=%23" +
              encodeURIComponent(assignedEmpUID) +
              "&noLimit=0&domain=&includeDisabled=true&_=" +
              Date.now(),
            {
              credentials: "include",
              headers: { "x-requested-with": "XMLHttpRequest" },
            },
          );
        }

        // Step 4d: Write empUID to assignedTo field on new record
        if (importResp.ok) {
          var writeToken = await fetchCSRFFromAPI();
          var writeUrl =
            FORM_POST_ENDPOINT_PREFIX + encodeURIComponent(newRecordID);
          var writeBody = encodeFormBody({
            CSRFToken: writeToken,
            recordID: newRecordID,
            series: 1,
            [TASK_IND.assignedTo]: assignedEmpUID || assignedUserName,
          });

          var writeResp = await fetch(writeUrl, {
            method: "POST",
            credentials: "include",
            headers: {
              "content-type":
                "application/x-www-form-urlencoded; charset=UTF-8",
              "x-requested-with": "XMLHttpRequest",
              "x-csrf-token": writeToken,
            },
            body: writeBody,
          });

          if (writeResp.ok) {
          } else {
            console.warn("Assigned To write failed HTTP " + writeResp.status);
          }
        }
      } catch (e) {
        console.warn("Could not copy assignedTo for record " + newRecordID, e);
      }
    }

    // Step 5: Submit record into workflow using the correct submit endpoint
    try {
      var submitToken = await fetchCSRFFromAPI();
      var submitUrl =
        "/platform/projects/api/form/" +
        encodeURIComponent(newRecordID) +
        "/submit";
      var submitBody = encodeFormBody({ CSRFToken: submitToken });

      var submitResp = await fetch(submitUrl, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "x-requested-with": "XMLHttpRequest",
          "x-csrf-token": submitToken,
        },
        body: submitBody,
      });

      if (submitResp.ok) {
        console.log("Recurring task submitted to workflow: " + newRecordID);
      } else {
        var submitText = await submitResp.text();
        console.warn(
          "Workflow submit failed HTTP " +
            submitResp.status +
            ": " +
            submitText,
        );
      }
    } catch (e) {
      console.warn("Could not submit record to workflow: " + newRecordID, e);
    }

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
    return (
      String(t.category || "")
        .trim()
        .toLowerCase() === "development"
    );
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

  function updateModalNav() {
    var nav = document.getElementById("pmModalNav");
    var prevBtn = document.getElementById("pmModalPrevBtn");
    var nextBtn = document.getElementById("pmModalNextBtn");
    var counter = document.getElementById("pmModalNavCounter");
    if (!nav) return;

    var history = state.modalHistory || [];
    var idx = state.modalHistoryIndex;

    if (history.length === 0 || idx < 0) {
      nav.hidden = true;
      return;
    }

    nav.hidden = false;
    if (prevBtn) prevBtn.disabled = idx <= 0;
    if (nextBtn) nextBtn.disabled = idx >= history.length - 1;
    if (counter)
      counter.textContent =
        history.length > 1 ? idx + 1 + " / " + history.length : "";
  }

  function suppressIframeHeader(frame) {
    try {
      var doc =
        frame.contentDocument ||
        (frame.contentWindow && frame.contentWindow.document);
      if (!doc) return;

      if (!doc.getElementById("pm-iframe-header-suppression")) {
        var style = doc.createElement("style");
        style.id = "pm-iframe-header-suppression";
        style.textContent = [
          "#header,#siteHeader,.siteHeader,#leafHeader,.leaf-header,",
          "#topNav,.topNav,#mainNav,.site-header,#site-header,",
          "header.main,nav.main-nav,#headerWrap,.headerWrap,",
          "#globalHeader,.globalHeader { display: none !important; }",
        ].join("\n");
        doc.head.appendChild(style);
        var headerEl = doc.getElementById("header");
        if (headerEl) headerEl.style.display = "none";
      }
    } catch (e) {}
  }

  function openModal(title, url, postLoadCallback, _skipHistory) {
    var modal = document.getElementById("pmModal");
    var frame = document.getElementById("pmModalFrame");
    var titleEl = document.getElementById("pmModalTitle");
    var openTabBtn = document.getElementById("pmModalOpenTabBtn");
    var closeBtn = document.getElementById("pmModalCloseBtn");
    if (!modal || !frame || !titleEl) return;

    // If inline content mode is active, restore the iframe and clean up
    var inlineContainer = document.getElementById("pmModalInlineContent");
    if (inlineContainer) {
      inlineContainer.style.display = "none";
      inlineContainer.innerHTML = "";
    }
    frame.style.display = "";

    // Restore the open-in-tab button and remove any injected project key link
    if (openTabBtn) openTabBtn.style.display = "";
    var existingPkLink = document.getElementById("pmModalProjectKeyLink");
    if (existingPkLink) existingPkLink.remove();

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

    var iframeUrl = url
      ? url + (url.indexOf("?") !== -1 ? "&" : "?") + "iframe=1"
      : url;
    frame.src = iframeUrl;

    // Suppress the LEAF header on every load
    if (frame._headerSuppressionHandler) {
      frame.removeEventListener("load", frame._headerSuppressionHandler);
    }
    frame._headerSuppressionHandler = function () {
      suppressIframeHeader(frame);
    };
    frame.addEventListener("load", frame._headerSuppressionHandler);

    frame.setAttribute(
      "title",
      title ? "LEAF content - " + String(title) : "LEAF content",
    );
    if (openTabBtn) openTabBtn.setAttribute("data-url", url || "");
    var _rMatch = String(url || "").match(/[?&]recordID=(\d+)/i);
    state.lastModalRecordID = _rMatch ? _rMatch[1] : null;
    if (!_skipHistory) {
      if (state.modalHistoryIndex < state.modalHistory.length - 1) {
        state.modalHistory = state.modalHistory.slice(
          0,
          state.modalHistoryIndex + 1,
        );
      }
      state.modalHistory.push({ url: url, title: title || "Details" });
      state.modalHistoryIndex = state.modalHistory.length - 1;
    }
    updateModalNav();
    lastFocusedElement = document.activeElement;
    modal.hidden = false;
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
    state.lastModalRecordID = null;
    frame.src = "about:blank";
    frame.setAttribute("title", "LEAF content");
    if (openTabBtn) openTabBtn.setAttribute("data-url", "");
    // Restore iframe and clean up inline content container
    if (frame) frame.style.display = "";
    var inlineContainer = document.getElementById("pmModalInlineContent");
    if (inlineContainer) {
      inlineContainer.style.display = "none";
      inlineContainer.innerHTML = "";
    }
    var existingPkLink = document.getElementById("pmModalProjectKeyLink");
    if (existingPkLink) existingPkLink.remove();
    if (openTabBtn) openTabBtn.style.display = "";
    state.modalHistory = [];
    state.modalHistoryIndex = -1;
    updateModalNav();
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    toggleAppInert(false);
    document.body.style.overflow = "";
    if (lastFocusedElement && document.contains(lastFocusedElement)) {
      lastFocusedElement.focus();
    }
    lastFocusedElement = null;
    if (state.pendingProjectKeyRefresh) {
      var pk = state.pendingProjectKeyRefresh;
      state.pendingProjectKeyRefresh = null;
      reloadTasksAndOpenProjectModal(pk);
    }
    scheduleSilentRefresh(500);
  }

  function reloadTasksAndOpenProjectModal(projectKey) {
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
        TASK_IND.actualCompletionDate,
        TASK_IND.recurringCopied,
      ],
      [{ id: "categoryID", operator: "=", match: "form_9b302", gate: "AND" }],
    );

    fetchJSON(tasksUrl)
      .then(function (tasksJson) {
        var taskRowsAll = coerceRows(tasksJson) || [];
        var taskRows = taskRowsAll.filter(function (r) {
          return hasAnyS1Value(
            r,
            [8, 9, 10, 44, 11, 12, 13, 14, 16, 17, 18, 30, 39, 47],
          );
        });
        state.tasksAll = taskRows.map(normalizeTask);
        state.tasksById = new Map();
        state.tasksAll.forEach(function (t) {
          state.tasksById.set(String(t.recordID), t);
        });
        state.tasksVersion = (state.tasksVersion || 0) + 1;
        invalidateTaskCaches();
        openProjectTasksModal(projectKey);
      })
      .catch(function (err) {
        console.warn(
          "pm-dashboard: failed to reload tasks after new task creation",
          err,
        );
        openProjectTasksModal(projectKey);
      });
  }

  function openProjectTasksModal(projectKey, _skipHistory) {
    var projectName = state.projectKeyToTitle[projectKey] || projectKey;
    var projectHref = getProjectRecordHrefFromKey(projectKey);

    // Filter from the full unfiltered task list, not the current view
    var tasks = (state.tasksAll || []).filter(function (t) {
      return String(t.projectKey || "").trim() === String(projectKey).trim();
    });

    // Build table rows as DOM-safe HTML strings
    var now = new Date();
    var rows = tasks
      .map(function (t) {
        var taskIdCell = t.href
          ? '<td><a href="' +
            safeAttr(t.href) +
            '" class="pm-recordLink pm-taskIdBadge" ' +
            'data-title="Task ' +
            safe(t.recordID) +
            (t.title ? "  \u2014  " + safeAttr(t.title.trim()) : "") +
            '">' +
            safe(t.recordID) +
            "</a></td>"
          : '<td><span class="pm-taskIdBadge">' +
            safe(t.recordID) +
            "</span></td>";
        var overdueClass = isOverdueTask(t, now) ? " pm-overdueRed" : "";
        return (
          "<tr>" +
          taskIdCell +
          "<td>" +
          safe(t.title || "(No title)") +
          "</td>" +
          "<td>" +
          renderStatusCell(t) +
          "</td>" +
          "<td>" +
          getPriorityPill(t.priority) +
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
          safe(t.assignedTo) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    if (!rows) {
      rows =
        '<tr><td colspan="7" style="text-align:center;padding:16px;color:#888;">' +
        "No tasks found for this project.</td></tr>";
    }

    var newTaskUrl =
      START_TASK_URL +
      "&" +
      encodeURIComponent(TASK_IND.projectKey) +
      "=" +
      encodeURIComponent(projectKey);

    // Build the full modal content as an inline div — NOT srcdoc
    // This keeps it in the same DOM so pm-recordLink delegation fires correctly
    var contentHtml =
      '<div style="padding:16px;overflow:auto;">' +
      '<div class="pm-pkModalToolbar">' +
      '<button type="button" class="pm-primaryBtn pm-pkAddTaskBtn" ' +
      'id="pmPkAddTaskBtn" data-url="' +
      safeAttr(newTaskUrl) +
      '" ' +
      'data-projectkey="' +
      safeAttr(projectKey) +
      '">' +
      "+ Task" +
      "</button>" +
      "</div>" +
      '<table class="pm-table" style="width:100%;border-collapse:collapse;">' +
      "<thead><tr>" +
      '<th scope="col" class="pm-sortable" data-type="number"><button type="button" class="pm-sortBtn">Task ID</button></th>' +
      '<th scope="col" class="pm-sortable" data-type="string"><button type="button" class="pm-sortBtn">Task Name</button></th>' +
      '<th scope="col" class="pm-sortable" data-type="string"><button type="button" class="pm-sortBtn">Status</button></th>' +
      '<th scope="col" class="pm-sortable" data-type="string"><button type="button" class="pm-sortBtn">Priority</button></th>' +
      '<th scope="col" class="pm-sortable" data-type="date"><button type="button" class="pm-sortBtn">Start</button></th>' +
      '<th scope="col" class="pm-sortable" data-type="date"><button type="button" class="pm-sortBtn">Due</button></th>' +
      '<th scope="col" class="pm-sortable" data-type="string"><button type="button" class="pm-sortBtn">Assigned To</button></th>' +
      "</tr></thead>" +
      "<tbody>" +
      rows +
      "</tbody>" +
      "</table>" +
      "</div>";

    // Use the existing pmModal but replace the iframe with an inline content div.
    // Hide the iframe, inject content into a sibling div instead.
    var modal = document.getElementById("pmModal");
    var frame = document.getElementById("pmModalFrame");
    var titleEl = document.getElementById("pmModalTitle");
    var openTabBtn = document.getElementById("pmModalOpenTabBtn");
    var closeBtn = document.getElementById("pmModalCloseBtn");
    if (!modal || !frame || !titleEl) return;

    var pkModalTitle =
      projectKey +
      (projectName && projectName !== projectKey
        ? "  \u2014  " + projectName
        : "") +
      "  \u2014  Tasks";

    if (!_skipHistory) {
      if (state.modalHistoryIndex < state.modalHistory.length - 1) {
        state.modalHistory = state.modalHistory.slice(
          0,
          state.modalHistoryIndex + 1,
        );
      }
      state.modalHistory.push({
        url: "__projectKey__:" + projectKey,
        title: pkModalTitle,
      });
      state.modalHistoryIndex = state.modalHistory.length - 1;
    }
    updateModalNav();

    titleEl.textContent = pkModalTitle;

    // Inject or update the project record link in the modal header actions row
    var existingPkLink = document.getElementById("pmModalProjectKeyLink");
    if (existingPkLink) existingPkLink.remove();
    if (projectHref) {
      var pkHeaderLink = document.createElement("a");
      pkHeaderLink.id = "pmModalProjectKeyLink";
      pkHeaderLink.href = projectHref;
      pkHeaderLink.className = "pm-recordLink pm-modalOpenTab";
      pkHeaderLink.setAttribute("data-title", "Project " + projectKey);
      pkHeaderLink.style.cssText = "text-decoration:none;font-size:13px;";
      pkHeaderLink.innerHTML =
        '<span class="material-icons" ' +
        'style="font-size:14px;vertical-align:middle;margin-right:3px;">open_in_new</span>' +
        "View Project Record";
      var modalActions = document.querySelector(".pm-modalActions");
      if (modalActions && openTabBtn) {
        modalActions.insertBefore(pkHeaderLink, openTabBtn);
      }
    }

    // Hide iframe, show inline content container
    frame.style.display = "none";
    frame.src = "about:blank";

    var inlineContainer = document.getElementById("pmModalInlineContent");
    if (!inlineContainer) {
      inlineContainer = document.createElement("div");
      inlineContainer.id = "pmModalInlineContent";
      inlineContainer.style.cssText =
        "flex:1;min-height:0;overflow:auto;box-sizing:border-box;";
      frame.parentNode.insertBefore(inlineContainer, frame.nextSibling);
    }
    inlineContainer.innerHTML = contentHtml;
    inlineContainer.style.display = "";

    var pkTable = inlineContainer.querySelector("table.pm-table");
    if (pkTable) wireInlineTableSort(pkTable);

    var addTaskBtn = document.getElementById("pmPkAddTaskBtn");
    if (addTaskBtn) {
      addTaskBtn.addEventListener("click", function () {
        var url = addTaskBtn.getAttribute("data-url") || "";
        var pk = addTaskBtn.getAttribute("data-projectkey") || "";
        if (!url) return;

        state.pendingProjectKeyRefresh = pk;

        openModal("New Task \u2014 " + pk, url, function (frame) {
          // postLoadCallback — iframe has loaded, now inject the project key
          // The picker calls loadProjects() async, so we poll until the hidden
          // input[name="8"] exists and the picker has populated its project list
          var attempts = 0;
          var maxAttempts = 40; // 4 seconds max (40 x 100ms)

          function tryInject() {
            attempts++;
            try {
              var doc =
                frame.contentDocument ||
                (frame.contentWindow && frame.contentWindow.document);
              if (!doc || doc.readyState !== "complete") {
                if (attempts < maxAttempts) setTimeout(tryInject, 100);
                return;
              }

              // Wait for the hidden LEAF field for indicator 8
              var hiddenField = doc.querySelector(
                'input[name="8"], textarea[name="8"], select[name="8"]',
              );
              if (!hiddenField) {
                if (attempts < maxAttempts) setTimeout(tryInject, 100);
                return;
              }

              // Set value directly on hidden field
              hiddenField.value = pk;
              hiddenField.dispatchEvent(
                new frame.contentWindow.Event("input", { bubbles: true }),
              );
              hiddenField.dispatchEvent(
                new frame.contentWindow.Event("change", { bubbles: true }),
              );

              // Update the picker summary UI to reflect the selection
              // without needing the panel to be open
              var summaryValEl = doc.getElementById("pkSummaryVal8");
              if (summaryValEl) {
                summaryValEl.innerHTML =
                  '<span class="pm-picker-badge">' +
                  '<span class="pm-picker-badge-check" aria-hidden="true">✓</span>' +
                  "<span>" +
                  pk +
                  "</span></span>";
              }

              // Also try to trigger the radio if projects have loaded
              var radios = doc.querySelectorAll("input.pkRadio8[data-key]");
              for (var i = 0; i < radios.length; i++) {
                if (radios[i].getAttribute("data-key") === pk) {
                  radios[i].checked = true;
                  radios[i].dispatchEvent(
                    new frame.contentWindow.Event("change", { bubbles: true }),
                  );
                  break;
                }
              }
            } catch (e) {
              console.warn(
                "pm-dashboard: could not inject project key into task form",
                e,
              );
            }
          }

          setTimeout(tryInject, 300);
        });
      });
    }

    // Hide open-in-tab button since content is client-side generated
    if (openTabBtn) openTabBtn.style.display = "none";

    state.lastModalRecordID = null;
    lastFocusedElement = document.activeElement;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    toggleAppInert(true);
    document.body.style.overflow = "hidden";
    requestAnimationFrame(function () {
      if (closeBtn) closeBtn.focus();
      else modal.focus();
    });
  }

  async function syncTaskAfterModalClose(recordID) {
    var taskIdx = -1;
    for (var i = 0; i < (state.tasksAll || []).length; i++) {
      if (String(state.tasksAll[i].recordID) === String(recordID)) {
        taskIdx = i;
        break;
      }
    }
    if (taskIdx === -1) return; // not a known task record

    try {
      var row = await fetchSingleRecord(recordID, [
        TASK_IND.projectKey,
        TASK_IND.title,
        TASK_IND.status,
        TASK_IND.otherSubType,
        TASK_IND.assignedTo,
        TASK_IND.startDate,
        TASK_IND.dueDate,
        TASK_IND.priority,
        TASK_IND.category,
        TASK_IND.dependencies,
        TASK_IND.supportTicket,
        TASK_IND.okrAssociation,
        TASK_IND.keyResultSelection,
        TASK_IND.isRecurring,
        TASK_IND.actualCompletionDate,
        TASK_IND.recurringCopied,
      ]);
      if (!row) return;

      var prev = cloneTaskForUpdate(state.tasksAll[taskIdx]);
      var updated = normalizeTask(row);

      // Auto-stamp actual completion date if completed but missing
      if (isCompletedStatus(updated.status) && !updated.actualCompletion) {
        var n = new Date();
        var mm = String(n.getMonth() + 1).padStart(2, "0");
        var dd = String(n.getDate()).padStart(2, "0");
        var today = mm + "/" + dd + "/" + n.getFullYear();
        updated.actualCompletion = today;
        try {
          var token = await ensureCSRFToken(recordID);
          var tokenField = state.csrfField || getCSRFFieldName();
          var bodyObj = { 47: today, recordID: recordID, series: 1 };
          bodyObj[tokenField] = token;
          await fetch(
            FORM_POST_ENDPOINT_PREFIX + encodeURIComponent(recordID),
            {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              credentials: "include",
              body: encodeFormBody(bodyObj),
            },
          );
        } catch (e) {
          console.warn("syncTaskAfterModalClose: write ind 47 failed", e);
        }
      } else if (
        !isCompletedStatus(updated.status) &&
        updated.actualCompletion
      ) {
        updated.actualCompletion = "";
        try {
          var token2 = await ensureCSRFToken(recordID);
          var tokenField2 = state.csrfField || getCSRFFieldName();
          var bodyObj2 = { 47: "", recordID: recordID, series: 1 };
          bodyObj2[tokenField2] = token2;
          await fetch(
            FORM_POST_ENDPOINT_PREFIX + encodeURIComponent(recordID),
            {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              credentials: "include",
              body: encodeFormBody(bodyObj2),
            },
          );
        } catch (e) {
          console.warn("syncTaskAfterModalClose: clear ind 47 failed", e);
        }
      }

      state.tasksAll[taskIdx] = updated;
      state.tasksById.set(String(updated.recordID), updated);

      var next = cloneTaskForUpdate(updated);
      updateTaskDerivedCaches(prev, next);
      refreshAfterTaskUpdate(prev, next);
      refreshOkrsIfVisible();
      syncProjectCompletionStatus(updated.projectKey);

      // Re-populate dropdowns in case assignee/category changed
      populateAssigneeDropdown(state.tasksAll);
      populateCategoryDropdown(state.tasksAll);
      renderOverdueAlert();
    } catch (e) {
      console.warn("pm-dashboard: syncTaskAfterModalClose failed", e);
    }
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
    modal.hidden = false;
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
    modal.hidden = true;
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

  function showRecurringBanner(newRecordID) {
    var existing = document.getElementById("pmRecurringBanner");
    if (existing) existing.remove();

    var el = document.createElement("div");
    el.id = "pmRecurringBanner";
    el.className = "pm-recurringBanner";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-atomic", "true");
    el.innerHTML =
      '<span class="pm-recurringBannerCheck">&#10003;</span>' +
      " A new task <strong>#" +
      safe(String(newRecordID || "")) +
      "</strong> has been automatically created.";

    document.body.appendChild(el);

    setTimeout(function () {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }, 6000);
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
    try {
      var r = await fetch(
        "/platform/projects/report.php?a=LEAF_Start_Request&id=form_9b302&title=Task",
        {
          credentials: "include",
        },
      );
      var html = await r.text();

      // Try existing extractCSRFTokenFromHTML first
      var match = extractCSRFTokenFromHTML(html);
      if (match && match.token) {
        cacheCSRF(match.token, match.field);
        return match.token;
      }

      // Fallback: match formData.append('CSRFToken', 'TOKEN') format
      var appendMatch = html.match(
        /formData\.append\(\s*['"]CSRFToken['"]\s*,\s*['"]([a-f0-9]+)['"]\s*\)/i,
      );
      if (appendMatch && appendMatch[1]) {
        cacheCSRF(appendMatch[1], "CSRFToken");
        return appendMatch[1];
      }

      console.warn("fetchCSRFFromAPI: token not found in response.");
    } catch (e) {
      console.warn("fetchCSRFFromAPI failed:", e);
    }
    return null;
  }

  async function fetchJSON(url) {
    var r = await fetch(url, { credentials: "same-origin" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  async function fetchSingleRecord(recordID, indicatorIds) {
    var q = JSON.stringify({
      terms: [
        {
          id: "recordIDs",
          operator: "=",
          match: String(recordID),
          gate: "AND",
        },
      ],
      joins: [],
      sort: {},
      getData: indicatorIds.map(String),
    });
    var url =
      BASE_QUERY_ENDPOINT +
      "?q=" +
      encodeURIComponent(q) +
      "&x-filterData=recordID,date";
    var json = await fetchJSON(url);
    var rows = coerceRows(json);
    return rows && rows.length ? rows[0] : null;
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
    return decodeEntities(String(v).trim());
  }

  function extractRawIndicator(row, indicatorId) {
    if (!row) return null;
    var key = "id" + String(indicatorId);
    if (row.s1 && row.s1[key] != null) {
      var v1 = row.s1[key];
      return typeof v1 === "string" ? decodeEntities(v1) : v1;
    }
    var stepKeys = Object.keys(row).filter(function (k) {
      return /^s\d+$/.test(k);
    });
    for (var i = 0; i < stepKeys.length; i++) {
      var step = row[stepKeys[i]];
      if (step && step[key] != null) {
        var vs = step[key];
        return typeof vs === "string" ? decodeEntities(vs) : vs;
      }
    }
    if (row[key] != null) {
      var vr = row[key];
      return typeof vr === "string" ? decodeEntities(vr) : vr;
    }
    if (row.data && row.data[key] != null) {
      var vd = row.data[key];
      return typeof vd === "string" ? decodeEntities(vd) : vd;
    }
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
    if (!depIds || !depIds.length) return "None";
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

    // Indicator 11 (assignedTo) may be an orgchart object with a userName
    // property. Extract userName when present so matching works regardless
    // of how LEAF serialized the field.
    var assignedToRaw = extractRawIndicator(row, TASK_IND.assignedTo);
    var assignedToValue =
      assignedToRaw &&
      typeof assignedToRaw === "object" &&
      assignedToRaw.userName
        ? String(assignedToRaw.userName).trim()
        : extractFromS1(row, TASK_IND.assignedTo);

    return {
      recordID: recordID,
      projectKey: extractFromS1(row, TASK_IND.projectKey),
      title: extractFromS1(row, TASK_IND.title),
      status: extractFromS1(row, TASK_IND.status),
      otherSubType: extractFromS1(row, TASK_IND.otherSubType),
      assignedTo: assignedToValue,
      start: extractFromS1(row, TASK_IND.startDate),
      due: extractFromS1(row, TASK_IND.dueDate),
      priority: extractFromS1(row, TASK_IND.priority),
      category: extractFromS1(row, TASK_IND.category),
      supportTicket: extractFromS1(row, TASK_IND.supportTicket),
      okrAssociation: extractFromS1(row, TASK_IND.okrAssociation),
      keyResultSelection: extractFromS1(row, TASK_IND.keyResultSelection),
      actualCompletion: extractFromS1(row, TASK_IND.actualCompletionDate),
      isRecurring: (function () {
        var v = extractFromS1(row, TASK_IND.isRecurring);
        return v === "Yes" || v === "1" || v === "yes";
      })(),
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
      // Indicator 5 (owner) may be an orgchart object — extract userName when present
      owner: (function () {
        var raw = extractRawIndicator(row, PROJECT_IND.owner);
        if (raw && typeof raw === "object" && raw.userName)
          return String(raw.userName).trim();
        return extractFromS1(row, PROJECT_IND.owner);
      })(),
      projectStatus: extractFromS1(row, PROJECT_IND.projectStatus),
      projectFiscalYear: extractFromS1(row, PROJECT_IND.projectFiscalYear),
      okrAssociation: extractFromS1(row, PROJECT_IND.okrAssociation),
      projectType: extractFromS1(row, PROJECT_IND.projectType),
      keyResultSelection: extractFromS1(row, PROJECT_IND.keyResultSelection),
      ticketNumber: extractFromS1(row, PROJECT_IND.ticketNumber),
      projectEndDate: extractFromS1(row, PROJECT_IND.projectEndDate),
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
      okrKey: String(
        extractRawIndicator(row, KEY_RESULT_IND.okrKey) || "",
      ).trim(),
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
      if (!rawType) return;
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

  function wireInlineTableSort(tableEl) {
    if (!tableEl || tableEl._pmSortWired) return;
    tableEl._pmSortWired = true;

    var sortState = { col: -1, dir: 1 };

    tableEl.addEventListener("click", function (e) {
      var th = e.target.closest("th.pm-sortable");
      if (!th) return;

      var ths = Array.prototype.slice.call(
        tableEl.querySelectorAll("thead th"),
      );
      var col = ths.indexOf(th);
      if (col === -1) return;

      var type = th.getAttribute("data-type") || "string";

      if (sortState.col === col) {
        sortState.dir *= -1;
      } else {
        sortState.col = col;
        sortState.dir = 1;
      }

      // Update sort indicators on headers
      ths.forEach(function (t) {
        t.classList.remove("is-asc", "is-desc");
        t.setAttribute("aria-sort", "none");
        var btn = t.querySelector(".pm-sortBtn");
        if (btn) btn.setAttribute("data-dir", "");
      });
      th.classList.add(sortState.dir === 1 ? "is-asc" : "is-desc");
      th.setAttribute(
        "aria-sort",
        sortState.dir === 1 ? "ascending" : "descending",
      );

      // Collect and sort rows
      var tbody = tableEl.querySelector("tbody");
      if (!tbody) return;
      var rows = Array.prototype.slice.call(tbody.querySelectorAll("tr"));

      rows.sort(function (a, b) {
        var aCell = a.querySelectorAll("td")[col];
        var bCell = b.querySelectorAll("td")[col];
        var aVal = aCell ? aCell.textContent.trim() : "";
        var bVal = bCell ? bCell.textContent.trim() : "";

        if (type === "number") {
          var aNum = parseFloat(aVal.replace(/[^0-9.-]/g, "")) || 0;
          var bNum = parseFloat(bVal.replace(/[^0-9.-]/g, "")) || 0;
          return (aNum - bNum) * sortState.dir;
        }
        if (type === "date") {
          var aDate = new Date(aVal);
          var bDate = new Date(bVal);
          var aTime = isNaN(aDate) ? 0 : aDate.getTime();
          var bTime = isNaN(bDate) ? 0 : bDate.getTime();
          return (aTime - bTime) * sortState.dir;
        }
        return (
          aVal.localeCompare(bVal, undefined, { sensitivity: "base" }) *
          sortState.dir
        );
      });

      rows.forEach(function (r) {
        tbody.appendChild(r);
      });
    });
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
    if (label === "Cancelled") cls += " pm-statusCancelled";
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

  function getProjectCompletionPct(projectKey) {
    var key = String(projectKey || "").trim();
    var tasks = (state.tasksAll || []).filter(function (t) {
      return String(t.projectKey || "").trim() === key;
    });
    var total = tasks.length;
    if (total === 0) return 0;
    var completed = tasks.filter(function (t) {
      return (
        String(t.status || "")
          .toLowerCase()
          .indexOf("completed") !== -1
      );
    }).length;
    return Math.round((completed / total) * 100);
  }

  function buildProjectRowHtml(p) {
    var projectKeyText = String(p.projectKey || "").trim();
    var projectNameText = String(p.projectName || "").trim();
    var pkHref = getProjectRecordHrefFromKey(p.projectKey) || p.href;
    var pkLink = pkHref
      ? '<a href="' +
        safe(pkHref) +
        '" class="pm-recordLink pm-pkProjectLink" data-title="' +
        safe("Project " + projectKeyText) +
        '" data-projectkey="' +
        safeAttr(projectKeyText) +
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
    var compPct = getProjectCompletionPct(p.projectKey);
    var compClass =
      compPct === 100
        ? "pm-completeGreen"
        : compPct >= 50
          ? "pm-completeMid"
          : "";
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
      '<td class="pm-colCompletion"><span class="pm-compPctWrap"><span class="pm-compPctBar" style="--pct-width:' +
      compPct +
      "%;width:" +
      Math.min(compPct, 100) +
      '%" aria-hidden="true"></span><span class="' +
      compClass +
      ' pm-compPctLabel">' +
      compPct +
      "%</span></span></td>" +
      "<td>" +
      (p.ticketNumber ? supportTicketChip(p.ticketNumber) : "") +
      "</td>" +
      "</tr>"
    );
  }

  function renderProjectsTable(projects) {
    var el = document.getElementById("pmProjectsTable");
    if (!el) return;

    var filtered = (projects || []).filter(function (p) {
      return (
        String(p.projectKey || "").trim() ||
        String(p.projectName || "").trim() ||
        String(p.description || "").trim() ||
        String(p.owner || "").trim() ||
        String(p.projectStatus || "").trim()
      );
    });

    state.projectTableCurrentRows = filtered;
    state.projectTableRenderedCount = filtered.length;

    var rowsHtml = "";
    for (var i = 0; i < filtered.length; i++) {
      rowsHtml += buildProjectRowHtml(filtered[i]);
    }

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
      '<th scope="col" class="pm-sortable pm-colCompletion" data-sort="completionPct" data-type="number"><button type="button" class="pm-sortBtn">% Complete</button></th>' +
      '<th scope="col" class="pm-sortable" data-sort="ticketNumber" data-type="string"><button type="button" class="pm-sortBtn">Ticket #</button></th>' +
      "</tr></thead>" +
      "<tbody>" +
      rowsHtml +
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
                  "index.php?a=printview&recordID=" + encodeURIComponent(rid);
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
        return selectedOkrFiscalYears.has(String(p.okrFiscalYear || "").trim());
      });
    }

    var okrBaseProjects = state.projectsAll;
    if (selectedOkrFiscalYears && selectedOkrFiscalYears.size) {
      okrBaseProjects = okrBaseProjects.filter(function (p) {
        return selectedOkrFiscalYears.has(String(p.okrFiscalYear || "").trim());
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
    var title = String(t.title || "")
      .trim()
      .toLowerCase();
    var projectKey = String(t.projectKey || "")
      .trim()
      .toLowerCase();
    var okrKey = String(t.okrAssociation || "")
      .trim()
      .toLowerCase();
    var kr = String(t.keyResultSelection || "")
      .trim()
      .toLowerCase();
    return ["t", title, projectKey, okrKey, kr].join("|");
  }

  function normalizeProjectKey(val) {
    return String(val || "")
      .replace(/\u00A0/g, " ")
      .trim()
      .replace(/\s+/g, " ")
      .toUpperCase();
  }

  function classifyKr(matchKey, projectsForOkr, tasksForOkr, projectMapByKey) {
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
              var classification = classifyKr(
                matchKey,
                projectsForOkr,
                tasksForOkr,
                projectMapByKey,
              );
              var krTasks = classification.tasks;
              var krProjects = classification.projectsToRender;
              var otherTasks = classification.otherTasks;
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
                name: keyResultNameMap[matchKey],
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
            ? "<ul class='pm-krList' id='" +
              listId +
              "'>" +
              keyResultItems
                .map(function (kr) {
                  var krId = "pmKr-" + makeSafeId(okrKey + "-" + kr.matchKey);
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

  function buildTasksRowHtml(t, now) {
    var pkHref = getProjectRecordHrefFromKey(t.projectKey);
    var pkLink = pkHref
      ? '<a href="' +
        safe(pkHref) +
        '" class="pm-recordLink pm-pkProjectLink" data-title="' +
        safe("Project " + t.projectKey) +
        '" data-projectkey="' +
        safeAttr(t.projectKey) +
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
      "<tr>" +
      "<td>" +
      pkLink +
      "</td>" +
      "<td>" +
      taskLink +
      "</td>" +
      '<td title="' +
      titleAttr +
      '">' +
      '<div style="display:inline-flex;align-items:center;gap:4px;max-width:100%;overflow:hidden;">' +
      (t.isRecurring
        ? '<span class="material-icons pm-recurringIcon" style="flex-shrink:0;font-size:15px;" title="Recurring Task" aria-label="Recurring Task">change_circle</span>'
        : "") +
      '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
      safe(titleText) +
      "</span>" +
      "</div>" +
      "</td>" +
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
      formatDateCell(t.actualCompletion) +
      "</td>" +
      "<td>" +
      supportTicketChip(t.supportTicket) +
      "</td>" +
      "</tr>"
    );
  }

  function renderTasksTable(tasks) {
    var el = document.getElementById("pmTasksTable");
    if (!el) return;

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
      '<th scope="col" class="pm-sortable" data-sort="actualCompletion" data-type="date"><button type="button" class="pm-sortBtn">Completed</button></th>' +
      '<th scope="col" class="pm-sortable" data-sort="supportTicket" data-type="string"><button type="button" class="pm-sortBtn">Ticket</button></th>' +
      "</tr></thead>";

    var now = new Date();
    var rowsHtml = "";
    for (var i = 0; i < (tasks || []).length; i++) {
      rowsHtml += buildTasksRowHtml(tasks[i], now);
    }

    el.innerHTML =
      '<table class="pm-table">' +
      headerHtml +
      "<tbody>" +
      (rowsHtml ||
        '<tr><td colspan="12" style="text-align:center;padding:16px;color:#888;">No tasks found.</td></tr>') +
      "</tbody></table>";

    var s = state.sort.tasks;
    setSortIndicator("pmTasksTable", s.key, s.dir);
  }

  function renderProjectHealthSticky(activeTab, selectedProjectKey) {
    var wrap = document.getElementById("pmProjectHealthSticky");
    if (!wrap) return;

    var key = String(selectedProjectKey || "").trim();
    if (activeTab !== "tasks" || !key) {
      wrap.hidden = true;
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

    wrap.hidden = false;
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

  async function syncProjectCompletionStatus(projectKey) {
    var p = (state.projectsAll || []).find(function (proj) {
      return (
        normalizeProjectKey(proj.projectKey) === normalizeProjectKey(projectKey)
      );
    });
    if (!p || !p.recordID) return;

    var pct = getProjectCompletionPct(projectKey);

    var target;
    if (pct === 100 && !isCompletedStatus(p.projectStatus)) {
      target = "Completed";
    } else if (pct < 100 && isCompletedStatus(p.projectStatus)) {
      target = "In Progress";
    } else {
      return;
    }

    try {
      var token = await ensureCSRFToken(p.recordID);
      var tokenField = state.csrfField || getCSRFFieldName();
      var body = new URLSearchParams();
      body.append(tokenField, token);
      body.append(PROJECT_IND.projectStatus, target);
      var res = await fetch(FORM_POST_ENDPOINT_PREFIX + p.recordID, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      p.projectStatus = target;
      applySearchAndFilters();
    } catch (err) {
      console.error("syncProjectCompletionStatus failed:", err);
    }
  }

  async function auditAllProjectStatuses() {
    for (var i = 0; i < state.projectsAll.length; i++) {
      var p = state.projectsAll[i];
      if (!p.recordID || !p.projectKey) continue;
      await syncProjectCompletionStatus(p.projectKey);
    }
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
    function todayMMDDYYYY() {
      var n = new Date();
      var mm = String(n.getMonth() + 1).padStart(2, "0");
      var dd = String(n.getDate()).padStart(2, "0");
      return mm + "/" + dd + "/" + n.getFullYear();
    }
    var bodyObj = {
      10: newStatus,
      44: isOther ? subType : "",
      47: isCompletedStatus(newStatus) ? todayMMDDYYYY() : "",
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

  async function createProjectRecord() {
    var token = await ensureCSRFToken();
    var tokenField = state.csrfField || getCSRFFieldName();

    var fd = new FormData();
    if (token) {
      fd.append(tokenField, token);
    } else {
      console.warn("Missing CSRFToken. Attempting create without token.");
      showTransferDebug("Missing CSRFToken. Attempting create without token.");
    }
    fd.append("numform_55445", "1");
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

  async function setProjectTicketIndicator(recordID, sourceId, sourceType) {
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
    bodyObj[PROJECT_IND.ticketNumber] = label;
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

    // Task transfer params (new naming + legacy fallbacks)
    var uxTaskId = getQueryParam("transferTaskFromUX");
    var supportId = getQueryParam("transferFromSupport");
    var ideaId = getQueryParam("transferFromIdea");
    var legacyId = getQueryParam("transferFromPortal");

    // Project transfer param
    var uxProjectId = getQueryParam("transferProjectFromUX");

    var isProjectTransfer = !!uxProjectId;
    var sourceId = uxProjectId || uxTaskId || supportId || ideaId || legacyId;
    var sourceType =
      uxProjectId || uxTaskId ? "ux" : ideaId ? "idea" : "support";
    var sourceLabel =
      sourceType === "ux" ? "UX" : sourceType === "idea" ? "Idea" : "Support";

    if (!sourceId) return;
    sourceId = String(sourceId || "").trim();
    if (!sourceId) return;

    showTransferDebug(
      "Transfer detected for " +
        sourceLabel +
        " " +
        sourceId +
        " (as " +
        (isProjectTransfer ? "Project" : "Task") +
        ")",
    );
    state.transferInProgress = true;
    try {
      var newRecordID;
      if (isProjectTransfer) {
        showTransferDebug("Creating Project");
        newRecordID = await createProjectRecord();
        await setProjectTicketIndicator(newRecordID, sourceId, sourceType);
      } else {
        showTransferDebug("Creating Task");
        newRecordID = await createTaskRecord();
        await setSupportTicketIndicator(newRecordID, sourceId, sourceType);
      }

      var params = new URLSearchParams(window.location.search || "");
      params.delete("transferTaskFromUX");
      params.delete("transferProjectFromUX");
      params.delete("transferFromUX");
      params.delete("transferFromIdea");
      params.delete("transferFromSupport");
      params.delete("transferFromPortal");
      var nextUrl =
        window.location.pathname +
        (params.toString() ? "?" + params.toString() : "") +
        window.location.hash;
      history.replaceState({}, "", nextUrl);

      if (isProjectTransfer) {
        setActiveTab("projects");
        openModal(
          "Project " + newRecordID,
          "index.php?a=printview&recordID=" + encodeURIComponent(newRecordID),
        );
        showTransferDebug("Transfer complete. Project " + newRecordID);
      } else {
        setActiveTab("tasks");
        openModal(
          "Task " + newRecordID,
          "index.php?a=printview&recordID=" + encodeURIComponent(newRecordID),
        );
        showTransferDebug("Transfer complete. Task " + newRecordID);
      }
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
        '" class="pm-recordLink pm-pkProjectLink" data-title="' +
        safe("Project " + t.projectKey) +
        '" data-projectkey="' +
        safeAttr(String(t.projectKey || "")) +
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
      ? '<div class="pm-cardBadgeWrap">' + renderStatusBadge(badge) + "</div>"
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
      (t.isRecurring
        ? '<span class="material-icons pm-recurringIcon pm-recurringIconCard" title="Recurring Task" aria-label="Recurring Task">change_circle</span>'
        : "") +
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
      (t.actualCompletion
        ? "<div><strong>Completed:</strong> " +
          safe(t.actualCompletion) +
          "</div>"
        : "") +
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
      if (st === "Cancelled") return; // skip, not shown on Kanban
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
      var step =
        parseInt(btn.getAttribute("data-step") || "0", 10) ||
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

  // NOTE (CLEANUP): "pmKanbanBoard" is queried by getElementById in 4 separate
  // functions (renderKanban, wireKanbanDnD, wireKanbanLoadMore, ensureKanbanRendered).
  // If hot-path profiling shows DOM lookup overhead, consider caching this element
  // at module level after DOMContentLoaded. Do not refactor without auditing all
  // tab-switching and lazy-init paths first.
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
    var task = state.tasksById ? state.tasksById.get(String(taskId)) : null;
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
      task.actualCompletion = "";
      next = cloneTaskForUpdate(task);
      updateTaskDerivedCaches(prev, next);
      refreshAfterTaskUpdate(prev, next);
      announceKanbanStatus(
        "Moved task " + taskId + " to Other (" + selection + ").",
      );
    } else {
      task.status = normalized;
      task.otherSubType = "";
      task.actualCompletion = isCompletedStatus(normalized)
        ? (function () {
            var n = new Date();
            var m = String(n.getMonth() + 1).padStart(2, "0");
            var d = String(n.getDate()).padStart(2, "0");
            return m + "/" + d + "/" + n.getFullYear();
          })()
        : "";
      next = cloneTaskForUpdate(task);
      updateTaskDerivedCaches(prev, next);
      refreshAfterTaskUpdate(prev, next);
      announceKanbanStatus("Moved task " + taskId + " to " + normalized + ".");
    }

    requestAnimationFrame(function () {
      focusKanbanCard(taskId);
    });

    try {
      await updateTaskStatus(taskId, task.status, task.otherSubType);
      state.cache.kanban.clear();
      refreshOkrsIfVisible();
      syncProjectCompletionStatus(task.projectKey);
      scheduleSilentRefresh(500);
    } catch (err) {
      task.status = prev.status;
      task.otherSubType = prev.otherSubType;
      task.actualCompletion = prev.actualCompletion || "";
      var reverted = cloneTaskForUpdate(task);
      updateTaskDerivedCaches(next || task, reverted);
      refreshAfterTaskUpdate(next || task, reverted);
      refreshOkrsIfVisible();
      announceKanbanStatus(
        "Error: Could not update task status. Please try again.",
      );
      var hint = document.getElementById("pmKanbanHint");
      if (hint) {
        hint.textContent = "Could not update task status. Please try again.";
        hint.style.color = "#b00020";
        setTimeout(function () {
          hint.textContent =
            "Drag a task card to a new status column to update the task. Keyboard: focus a card and press Shift+Left/Right to move it.";
          hint.style.color = "";
        }, 5000);
      }
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
          document.querySelectorAll(".pm-kanban-col").forEach(function (b) {
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

    document.querySelectorAll(".pm-kanban-col").forEach(function (col) {
      if (col.dataset.dndBound === "1") return;
      col.dataset.dndBound = "1";

      var body = col.querySelector(".pm-kanban-col-body");
      var status = body ? body.getAttribute("data-status") : "";
      if (!status) return;

      col.addEventListener("dragover", function (e) {
        e.preventDefault();
        e.stopPropagation();
        col.classList.add("is-over");
      });

      col.addEventListener("dragleave", function (e) {
        // Only remove highlight when leaving the column entirely,
        // not when moving between child elements inside it
        var related = e.relatedTarget;
        if (related && col.contains(related)) return;
        col.classList.remove("is-over");
      });

      col.addEventListener("drop", async function (e) {
        e.preventDefault();
        e.stopPropagation();
        col.classList.remove("is-over");

        var newStatus = status;
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

      var statusChanged = oldStatus !== newStatus;

      if (!statusChanged) {
        // Card stayed in same column — find and update just that card's DOM
        var existingCard = body.querySelector(
          '.pm-card[data-taskid="' +
            String(newTask.recordID).replace(/"/g, '\\"') +
            '"]',
        );
        if (existingCard) {
          var tpl = document.createElement("template");
          tpl.innerHTML = renderKanbanCard(newTask, col);
          var newCardEl = tpl.content.firstElementChild;
          if (newCardEl) {
            body.replaceChild(newCardEl, existingCard);
          }
        } else {
          // Not found in DOM — rebuild column
          var cards = colTasks
            .slice(0, visible)
            .map(function (t) {
              return renderKanbanCard(t, col);
            })
            .join("");
          body.innerHTML = cards || '<div class="pm-card-meta">No tasks</div>';
        }
      } else {
        // Card moved columns — rebuild both affected columns fully
        var cards = colTasks
          .slice(0, visible)
          .map(function (t) {
            return renderKanbanCard(t, col);
          })
          .join("");
        body.innerHTML = cards || '<div class="pm-card-meta">No tasks</div>';
      }

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

  // Strict MM/DD/YYYY parser — always uses local-time constructor.
  // Never calls new Date(string), which is ambiguous and browser-dependent.
  // Only accepts exactly "MM/DD/YYYY" — no fallbacks, no guessing.
  function strictMmDdYyyy(s) {
    var v = String(s || "").trim();
    if (!v) return null;
    var parts = v.split("/");
    if (parts.length !== 3) return null;
    var mm = parseInt(parts[0], 10);
    var dd = parseInt(parts[1], 10);
    var yyyy = parseInt(parts[2], 10);
    if (isNaN(mm) || isNaN(dd) || isNaN(yyyy)) return null;
    if (mm < 1 || mm > 12) return null;
    if (dd < 1 || dd > 31) return null;
    if (yyyy < 1900 || yyyy > 2100) return null;
    var d = new Date(yyyy, mm - 1, dd);
    return isNaN(d.getTime()) ? null : d;
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
        if (
          state.sort.okrs.key !== "okrKey" &&
          state.sort.okrs.key !== "keyResults"
        ) {
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
      btnObjectives.setAttribute(
        "aria-selected",
        isObjectives ? "true" : "false",
      );
      btnKeyResults.setAttribute(
        "aria-selected",
        !isObjectives ? "true" : "false",
      );
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

  function populateProjectOwnerDropdown(projects) {
    var vals = Array.from(
      new Set(
        (projects || [])
          .map(function (p) {
            return String(p.owner || "").trim();
          })
          .filter(Boolean),
      ),
    ).sort(function (a, b) {
      return a.localeCompare(b);
    });
    setFilterOptions(
      "projectOwner",
      vals.map(function (v) {
        return { value: v, label: v };
      }),
    );
  }

  function populateProjectStatusDropdown(projects) {
    var vals = Array.from(
      new Set(
        (projects || [])
          .map(function (p) {
            return String(p.projectStatus || "").trim();
          })
          .filter(Boolean),
      ),
    ).sort(function (a, b) {
      return a.localeCompare(b);
    });
    setFilterOptions(
      "projectStatus",
      vals.map(function (v) {
        return { value: v, label: v };
      }),
    );
  }

  function populateProjectTypeDropdown(projects) {
    var seen = {};
    var opts = [];
    (projects || []).forEach(function (p) {
      var raw = String(p.projectType || "").trim();
      if (!raw) return;
      var label = formatProjectTypeLabel(raw);
      if (!label || label === "Unknown") return;
      if (seen[label]) return;
      seen[label] = true;
      opts.push({ value: label, label: label });
    });
    opts.sort(function (a, b) {
      return a.label.localeCompare(b.label);
    });
    setFilterOptions("projectType", opts);
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
    return String(val || "")
      .trim()
      .toLowerCase();
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

  function saveFilterState() {
    var obj = {};
    var keys = [
      "projectKey",
      "status",
      "assignee",
      "priority",
      "category",
      "projectFiscalYear",
      "projectOwner",
      "projectStatus",
    ];
    keys.forEach(function (k) {
      obj[k] = Array.from(getFilterSet(k));
    });
    try {
      localStorage.setItem(STORAGE_KEYS.FILTER_STATE_KEY, JSON.stringify(obj));
    } catch (e) {}
  }

  function loadFilterState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEYS.FILTER_STATE_KEY);
      if (!raw) return false;
      var obj = JSON.parse(raw);
      var keys = [
        "projectKey",
        "status",
        "assignee",
        "priority",
        "category",
        "projectFiscalYear",
        "projectOwner",
        "projectStatus",
      ];
      keys.forEach(function (k) {
        if (Array.isArray(obj[k]) && obj[k].length > 0) {
          setFilterValues(k, obj[k]);
        }
      });
      var savedRange = localStorage.getItem(STORAGE_KEYS.dateRange);
      if (savedRange && !isNaN(parseInt(savedRange, 10))) {
        state.dateRangeFilter = parseInt(savedRange, 10);
      }
      return true;
    } catch (e) {
      return false;
    }
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
    var searchThreshold =
      config.searchThreshold != null ? config.searchThreshold : 15;
    var isOpen = false;
    var searchValue = "";
    var labelMap = new Map();

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "pm-multiSelectToggle";
    toggle.id = config.id + "Toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", config.id + "Panel");
    toggle.setAttribute("aria-haspopup", "listbox");

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
    var filterName = container.getAttribute("data-filter") || "options";
    var filterNameLabels = {
      projectKey: "Project",
      status: "Status",
      assignee: "Assigned To",
      category: "Category",
      priority: "Priority",
      projectFiscalYear: "Fiscal Year",
      analyticsYear: "Year",
      analyticsQuarter: "Quarter",
      okrFiscalYear: "OKR Fiscal Year",
    };
    var humanLabel = filterNameLabels[filterName] || filterName;
    searchInput.setAttribute("aria-label", "Search " + humanLabel + " options");
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
      items.forEach(function (opt) {
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
      setSelectedValues: function (newSet) {
        selected.clear();
        if (newSet) {
          newSet.forEach(function (v) {
            selected.add(v);
          });
        }
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

  function resetProjectsTableScroll() {
    var wrap = document.querySelector("#pmProjectsTableWrap");
    if (wrap) wrap.scrollTop = 0;
  }

  function handlePaginationChange(key) {
    if (key === "tasks") {
      renderTasksView("table", true);
    }
    if (key === "projects") {
      resetProjectsTableScroll();
      renderProjectsView(true);
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
      ">Previous</button>" +
      '<button type="button" class="pm-ghostBtn" data-page-action="next"' +
      (model.hasNext ? "" : " disabled") +
      ">Next</button>" +
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
      recurringOnly: !!state.recurringOnly,
      dateRange: state.dateRangeFilter,
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
    if (filters && filters.recurringOnly && !task.isRecurring) return false;
    if (filters && !matchesFilterSet(task.projectKey, filters.projectKeys))
      return false;
    if (filters && !matchesFilterSet(task.status, filters.statuses))
      return false;
    if (filters && !matchesFilterSet(task.assignedTo, filters.assignees))
      return false;
    if (filters && !matchesFilterSet(task.priority, filters.priorities))
      return false;
    if (filters && !matchesFilterSet(task.category, filters.categories))
      return false;
    if (filters && filters.dateRange) {
      var today = new Date();
      today.setHours(0, 0, 0, 0);

      var cutoff = new Date();
      cutoff.setHours(0, 0, 0, 0);
      cutoff.setDate(cutoff.getDate() - filters.dateRange);

      var startDate = strictMmDdYyyy(task.start);
      var completed = strictMmDdYyyy(task.actualCompletion);

      if (!startDate && !completed) return false;

      // Must fall within the window: cutoff <= date <= today
      // Excludes future dates and dates older than the selected range
      var startedInRange =
        startDate && startDate >= cutoff && startDate <= today;
      var completedInRange =
        completed && completed >= cutoff && completed <= today;

      if (!startedInRange && !completedInRange) return false;
    }
    return true;
  }

  function buildTaskFilterSignature(filters) {
    return [
      "t",
      state.tasksVersion,
      sigPart(filters.q),
      filters.devOnly ? "1" : "0",
      filters.recurringOnly ? "r" : "0",
      sigPart(String(filters.dateRange || 0)),
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
      owners: new Set(getFilterSet("projectOwner")),
      projectStatuses: new Set(getFilterSet("projectStatus")),
      projectType: new Set(getFilterSet("projectType")),
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
    if (filters && !matchesFilterSet(project.owner, filters.owners))
      return false;
    if (
      filters &&
      !matchesFilterSet(project.projectStatus, filters.projectStatuses)
    )
      return false;
    if (filters && filters.projectType && filters.projectType.size > 0) {
      var typeLabel = formatProjectTypeLabel(
        String(project.projectType || "").trim(),
      );
      if (!matchesFilterSet(typeLabel, filters.projectType)) return false;
    }
    return true;
  }

  function buildProjectsSignature(filters, sortState) {
    return [
      "p",
      state.projectsVersion,
      sigPart(filters.q),
      signatureFromSet(filters.fiscalYears),
      signatureFromSet(filters.owners),
      signatureFromSet(filters.projectStatuses),
      signatureFromSet(filters.projectType),
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
        if (sortState.key === "completionPct") {
          return compareValues(
            getProjectCompletionPct(a.projectKey),
            getProjectCompletionPct(b.projectKey),
            sortState.dir,
            "number",
          );
        }
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
      actualCompletion: task.actualCompletion || "",
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
        entry.list.unshift(newTask);
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
        var targetList = entry.grouped[newStatus];
        var existingIdx = -1;
        for (var ei = 0; ei < targetList.length; ei++) {
          if (String(targetList[ei].recordID) === String(newTask.recordID)) {
            existingIdx = ei;
            break;
          }
        }
        if (existingIdx !== -1) {
          // Already in this column — update in place, preserve position
          targetList[existingIdx] = newTask;
        } else if (oldStatus !== newStatus) {
          // Moving to a different column — insert at the top so it is
          // visible immediately without scrolling
          targetList.unshift(newTask);
        } else {
          // Same column, not found — fallback to push
          targetList.push(newTask);
        }
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

  function renderProjectsView(force) {
    var filters = buildProjectFilterState();
    var baseSig = buildProjectsSignature(filters, state.sort.projects);
    var projects = getProjectsSortedCached(filters, state.sort.projects);
    var paginationModel = ensurePaginationState(
      "projects",
      baseSig,
      projects.length,
    );
    var sig =
      baseSig +
      "::page:" +
      paginationModel.page +
      "::size:" +
      paginationModel.pageSize;
    if (!force && state.renderState.projectsSig === sig) {
      renderPaginationControls("projects", paginationModel);
      return;
    }
    var pagedProjects = projects.slice(
      paginationModel.startIndex,
      paginationModel.endIndex,
    );
    renderProjectsTable(pagedProjects);
    renderPaginationControls("projects", paginationModel);
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
      var tasksG = getTasksSortedCached(filters, sortState).filter(
        function (t) {
          return !isArchivedStatus(t.status);
        },
      );
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
    // Clear any open drilldowns so stale data is not shown after filter change
    state.drilldownActive = {};
    var panel = document.getElementById("pmAnalyticsDrilldown");
    var body = document.getElementById("pmAnalyticsDrilldownBody");
    if (panel) panel.hidden = true;
    if (body) body.innerHTML = "";
    var sig = buildAnalyticsSignature();
    var cache = state.cache.analytics.get(sig);
    if (cache) {
      renderAnalyticsFromCache(cache);
    }
  }

  function initFilterControls() {
    var tasksOnChange = function () {
      applySearchAndFilters(true);
      saveFilterState();
    };
    var analyticsOnChange = function () {
      applySearchAndFilters(false);
    };

    state.filterControls.projectFiscalYear = multiSelectDropdown({
      id: "pmProjectFiscalYearSelect",
      selected: getFilterSet("projectFiscalYear"),
      onChange: tasksOnChange,
    });
    state.filterControls.projectOwner = multiSelectDropdown({
      id: "pmProjectOwnerSelect",
      selected: getFilterSet("projectOwner"),
      onChange: tasksOnChange,
    });
    state.filterControls.projectStatus = multiSelectDropdown({
      id: "pmProjectStatusSelect",
      selected: getFilterSet("projectStatus"),
      onChange: tasksOnChange,
    });
    state.filterControls.projectType = multiSelectDropdown({
      id: "pmProjectTypeSelect",
      selected: getFilterSet("projectType"),
      onChange: tasksOnChange,
    });
    state.filterControls.projectKey = multiSelectDropdown({
      id: "pmProjectKeySelect",
      selected: getFilterSet("projectKey"),
      onChange: tasksOnChange,
      searchThreshold: 0,
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
      searchThreshold: 0,
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

  function currentUserMatchesTask(task) {
    if (!CURRENT_USER_ID && !CURRENT_USER_NAME) return false;
    var assigned = String(task.assignedTo || "")
      .trim()
      .toLowerCase();
    if (!assigned) return false;
    if (CURRENT_USER_ID && assigned === CURRENT_USER_ID.trim().toLowerCase())
      return true;
    if (CURRENT_USER_NAME) {
      var name = CURRENT_USER_NAME.trim().toLowerCase();
      if (assigned === name) return true;
      // Handle "Last, First" → "First Last" reversal
      if (name.indexOf(",") !== -1) {
        var parts = name.split(",");
        var reversed = (parts[1] || "").trim() + " " + (parts[0] || "").trim();
        if (assigned === reversed.toLowerCase()) return true;
      }
    }
    return false;
  }

  // Checks whether the logged-in user is the owner of a project.
  // Uses the same name-matching logic as currentUserMatchesTask.
  function currentUserMatchesProject(project) {
    if (!CURRENT_USER_ID && !CURRENT_USER_NAME) return false;
    var owner = String(project.owner || "")
      .trim()
      .toLowerCase();
    if (!owner) return false;
    if (CURRENT_USER_ID && owner === CURRENT_USER_ID.trim().toLowerCase())
      return true;
    if (CURRENT_USER_NAME) {
      var name = CURRENT_USER_NAME.trim().toLowerCase();
      if (owner === name) return true;
      if (name.indexOf(",") !== -1) {
        var parts = name.split(",");
        var reversed = (parts[1] || "").trim() + " " + (parts[0] || "").trim();
        if (owner === reversed.toLowerCase()) return true;
      }
    }
    return false;
  }

  function renderOverdueAlert() {
    var alertEl = document.getElementById("pmOverdueAlert");
    if (!alertEl) return;

    // Stay hidden if user dismissed this session
    if (sessionStorage.getItem(OVERDUE_ALERT_DISMISSED_KEY)) {
      alertEl.hidden = true;
      return;
    }

    // If both user identity fields are empty, Smarty vars didn't resolve — bail silently
    if (!CURRENT_USER_ID && !CURRENT_USER_NAME) {
      alertEl.hidden = true;
      return;
    }

    // Neither tasks nor projects loaded yet — wait
    if (
      (!state.tasksAll || !state.tasksAll.length) &&
      (!state.projectsAll || !state.projectsAll.length)
    ) {
      alertEl.hidden = true;
      return;
    }

    var now = new Date();

    // --- Overdue tasks: indicator 13 (dueDate) past today, not completed/archived ---
    var overdueTasks = (state.tasksAll || []).filter(function (t) {
      if (!currentUserMatchesTask(t)) return false;
      if (isCompletedStatus(t.status)) return false;
      if (isArchivedStatus(t.status)) return false;
      return isOverdueTask(t, now);
    });

    // Sort tasks by due date ascending (most overdue first)
    overdueTasks = overdueTasks.slice().sort(function (a, b) {
      var da = mmddyyyyToDate(a.due) || new Date(8640000000000000);
      var db = mmddyyyyToDate(b.due) || new Date(8640000000000000);
      return da - db;
    });

    // --- Overdue projects: indicator 70 (projectEndDate) past today, not completed/archived ---
    var overdueProjects = (state.projectsAll || []).filter(function (p) {
      if (!currentUserMatchesProject(p)) return false;
      if (isCompletedStatus(p.projectStatus)) return false;
      if (isArchivedStatus(p.projectStatus)) return false;
      var endDate = mmddyyyyToDate(p.projectEndDate);
      return !!(endDate && endDate.getTime() < now.getTime());
    });

    // Sort projects by end date ascending (most overdue first)
    overdueProjects = overdueProjects.slice().sort(function (a, b) {
      var da = mmddyyyyToDate(a.projectEndDate) || new Date(8640000000000000);
      var db = mmddyyyyToDate(b.projectEndDate) || new Date(8640000000000000);
      return da - db;
    });

    var totalTasks = overdueTasks.length;
    var totalProjects = overdueProjects.length;
    var totalAll = totalTasks + totalProjects;

    if (!totalAll) {
      alertEl.hidden = true;
      return;
    }

    // Build heading copy
    var headingEl = document.getElementById("pmOverdueAlertHeading");
    if (headingEl) {
      var parts = [];
      if (totalTasks > 0)
        parts.push(
          totalTasks + " overdue task" + (totalTasks === 1 ? "" : "s"),
        );
      if (totalProjects > 0)
        parts.push(
          totalProjects + " overdue project" + (totalProjects === 1 ? "" : "s"),
        );
      headingEl.textContent = "You have " + parts.join(" and ") + ".";
    }

    // Merge and cap at 5 shown items; tasks listed before projects
    var CAP = 5;
    var allItems = [];

    overdueTasks.forEach(function (t) {
      allItems.push({ type: "task", record: t });
    });
    overdueProjects.forEach(function (p) {
      allItems.push({ type: "project", record: p });
    });

    var shown = allItems.slice(0, CAP);
    var remaining = allItems.length - shown.length;

    var listEl = document.getElementById("pmOverdueAlertList");
    if (listEl) {
      listEl.innerHTML = shown
        .map(function (item) {
          if (item.type === "task") {
            var t = item.record;
            var title = String(t.title || "(No title)");
            var safeTitle = safe(title);
            var safeAttrTitle = safeAttr("Task " + t.recordID + " — " + title);
            var badge =
              '<span class="pm-overdueAlert-badge pm-overdueAlert-badge--task">Task</span>';
            if (t.href) {
              return (
                "<li>" +
                badge +
                '<a href="' +
                safe(t.href) +
                '" class="pm-recordLink pm-overdueAlert-link"' +
                ' data-title="' +
                safeAttrTitle +
                '"' +
                ' target="_blank" rel="noopener noreferrer">' +
                safeTitle +
                "</a></li>"
              );
            }
            return "<li>" + badge + safeTitle + "</li>";
          } else {
            var p = item.record;
            var name = String(p.projectName || p.projectKey || "(No name)");
            var safeName = safe(name);
            var safeAttrName = safeAttr(
              "Project " + (p.projectKey || p.recordID) + " — " + name,
            );
            var badge =
              '<span class="pm-overdueAlert-badge pm-overdueAlert-badge--project">Project</span>';
            if (p.href) {
              return (
                "<li>" +
                badge +
                '<a href="' +
                safe(p.href) +
                '" class="pm-recordLink pm-overdueAlert-link"' +
                ' data-title="' +
                safeAttrName +
                '"' +
                ' target="_blank" rel="noopener noreferrer">' +
                safeName +
                "</a></li>"
              );
            }
            return "<li>" + badge + safeName + "</li>";
          }
        })
        .join("");
    }

    var moreEl = document.getElementById("pmOverdueAlertMore");
    if (moreEl) {
      moreEl.textContent =
        remaining > 0
          ? "and " +
            remaining +
            " more overdue item" +
            (remaining === 1 ? "" : "s") +
            "."
          : "";
      moreEl.hidden = remaining === 0;
    }

    // ── DEBUG: overdue alert diagnostics ────────────────────────────────────
    // Open the browser console and run: pmOverdueDebug() to see a full report.
    // Remove this block once the alert is confirmed working in production.
    window.pmOverdueDebug = function () {
      var _now = new Date();
      console.group(
        "%c[pmOverdueDebug] Overdue Alert Diagnostics",
        "color:#b26a00;font-weight:bold",
      );

      console.group("1) Identity");
      console.log("CURRENT_USER_ID  :", JSON.stringify(CURRENT_USER_ID));
      console.log("CURRENT_USER_NAME:", JSON.stringify(CURRENT_USER_NAME));
      console.groupEnd();

      console.group(
        "2) Tasks (indicator 11 = assignedTo, indicator 13 = dueDate)",
      );
      console.log("Total tasks loaded:", (state.tasksAll || []).length);
      var taskSample = (state.tasksAll || []).slice(0, 5).map(function (t) {
        return {
          recordID: t.recordID,
          title: t.title,
          assignedTo: t.assignedTo,
          due: t.due,
          status: t.status,
          matchesUser: currentUserMatchesTask(t),
          isCompleted: isCompletedStatus(t.status),
          isArchived: isArchivedStatus(t.status),
          isOverdue: isOverdueTask(t, _now),
        };
      });
      console.table(taskSample);

      var myOverdueTasks = (state.tasksAll || []).filter(function (t) {
        return (
          currentUserMatchesTask(t) &&
          !isCompletedStatus(t.status) &&
          !isArchivedStatus(t.status) &&
          isOverdueTask(t, _now)
        );
      });
      console.log(
        "My overdue tasks:",
        myOverdueTasks.length,
        myOverdueTasks.map(function (t) {
          return t.recordID + " - " + t.title;
        }),
      );
      console.groupEnd();

      console.group(
        "3) Projects (indicator 5 = owner, indicator 70 = projectEndDate)",
      );
      console.log("Total projects loaded:", (state.projectsAll || []).length);
      var projSample = (state.projectsAll || []).slice(0, 5).map(function (p) {
        return {
          recordID: p.recordID,
          projectKey: p.projectKey,
          projectName: p.projectName,
          owner: p.owner,
          projectEndDate: p.projectEndDate,
          projectStatus: p.projectStatus,
          matchesUser: currentUserMatchesProject(p),
          isCompleted: isCompletedStatus(p.projectStatus),
          isArchived: isArchivedStatus(p.projectStatus),
          endDateParsed: String(mmddyyyyToDate(p.projectEndDate)),
        };
      });
      console.table(projSample);

      var myOverdueProjects = (state.projectsAll || []).filter(function (p) {
        if (!currentUserMatchesProject(p)) return false;
        if (
          isCompletedStatus(p.projectStatus) ||
          isArchivedStatus(p.projectStatus)
        )
          return false;
        var endDate = mmddyyyyToDate(p.projectEndDate);
        return !!(endDate && endDate.getTime() < _now.getTime());
      });
      console.log(
        "My overdue projects:",
        myOverdueProjects.length,
        myOverdueProjects.map(function (p) {
          return p.recordID + " - " + p.projectName;
        }),
      );
      console.groupEnd();

      console.group("4) Session dismiss key");
      console.log("OVERDUE_ALERT_DISMISSED_KEY:", OVERDUE_ALERT_DISMISSED_KEY);
      console.log(
        "Dismissed this session?:",
        !!sessionStorage.getItem(OVERDUE_ALERT_DISMISSED_KEY),
      );
      console.groupEnd();

      console.groupEnd();
    };
    // ── END DEBUG ─────────────────────────────────────────────────────────────

    alertEl.hidden = false;
  }

  function wireDismissOverdueAlert() {
    var btn = document.getElementById("pmOverdueAlertDismiss");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var alertEl = document.getElementById("pmOverdueAlert");
      if (alertEl) alertEl.hidden = true;
      sessionStorage.setItem(OVERDUE_ALERT_DISMISSED_KEY, "1");
    });
  }

  function syncDateRangeBtnUI() {
    document.querySelectorAll(".pm-dateRangeBtn").forEach(function (btn) {
      var days = parseInt(btn.getAttribute("data-days"), 10);
      var active = state.dateRangeFilter === days;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
      btn.classList.toggle("is-active", active);
    });
  }

  function wireDateRangeFilter() {
    document.querySelectorAll(".pm-dateRangeBtn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var days = parseInt(btn.getAttribute("data-days"), 10);
        if (state.dateRangeFilter === days) {
          state.dateRangeFilter = null;
          localStorage.setItem(STORAGE_KEYS.dateRange, "");
        } else {
          state.dateRangeFilter = days;
          localStorage.setItem(STORAGE_KEYS.dateRange, days);
        }
        syncDateRangeBtnUI();
        invalidateTaskCaches();
        applySearchAndFilters(true);
      });
    });
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
      state.recurringOnly = false;
      var recurringFilterBtn = document.getElementById("pmRecurringFilterBtn");
      if (recurringFilterBtn)
        recurringFilterBtn.setAttribute("aria-pressed", "false");
      state.dateRangeFilter = null;
      localStorage.removeItem(STORAGE_KEYS.dateRange);
      syncDateRangeBtnUI();
      applySearchAndFilters(true);
      saveFilterState();
    }
    var b2 = document.getElementById("pmClearFiltersBtn_tasks");
    if (b2) b2.addEventListener("click", clearAll);

    var bProjects = document.getElementById("pmClearProjectFilters");
    if (bProjects)
      bProjects.addEventListener("click", function () {
        setFilterValues("projectFiscalYear", []);
        if (state.filterControls.projectFiscalYear)
          state.filterControls.projectFiscalYear.clear();
        setFilterValues("projectOwner", []);
        if (state.filterControls.projectOwner)
          state.filterControls.projectOwner.clear();
        setFilterValues("projectStatus", []);
        if (state.filterControls.projectStatus)
          state.filterControls.projectStatus.clear();
        setFilterValues("projectType", []);
        if (state.filterControls.projectType)
          state.filterControls.projectType.clear();
        applySearchAndFilters();
      });
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
        var total = parseInt(showMoreBtn.getAttribute("data-total") || "0", 10);
        var step = parseInt(showMoreBtn.getAttribute("data-step") || "8", 10);
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

      // Only intercept project-key links when clicked from within the tasks table
      if (a.classList.contains("pm-pkProjectLink")) {
        var projectKey = a.getAttribute("data-projectkey") || "";
        if (projectKey) {
          openProjectTasksModal(projectKey);
          return;
        }
      }

      // Default behavior for ALL other pm-recordLink clicks including task IDs
      var href = a.getAttribute("href");
      var title = a.getAttribute("data-title") || "Details";
      if (href) {
        var taskTitleMatch = title.match(/^Task (\d+)$/i);
        if (taskTitleMatch) {
          var taskId = taskTitleMatch[1];
          var taskRecord =
            state.tasksById && state.tasksById.get(String(taskId));
          var taskName =
            taskRecord && taskRecord.title ? taskRecord.title.trim() : "";
          if (taskName) {
            title = "Task " + taskId + "  \u2014  " + taskName;
          }
        }
        openModal(title, href);
      }
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
    window.addEventListener("message", function (e) {
      if (!e || !e.data || e.data.type !== "pmRecurringBannerMsg") return;
      if (typeof showRecurringBanner === "function") {
        showRecurringBanner(e.data.newRecordID);
      }
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

    var prevBtn = document.getElementById("pmModalPrevBtn");
    var nextBtn = document.getElementById("pmModalNextBtn");

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        var idx = state.modalHistoryIndex - 1;
        if (idx < 0) return;
        var item = state.modalHistory[idx];
        state.modalHistoryIndex = idx;
        updateModalNav();
        if (item.url && item.url.indexOf("__projectKey__:") === 0) {
          var pk = item.url.replace("__projectKey__:", "");
          openProjectTasksModal(pk, true);
        } else {
          openModal(item.title, item.url, null, true);
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        var idx = state.modalHistoryIndex + 1;
        if (idx >= state.modalHistory.length) return;
        var item = state.modalHistory[idx];
        state.modalHistoryIndex = idx;
        updateModalNav();
        if (item.url && item.url.indexOf("__projectKey__:") === 0) {
          var pk = item.url.replace("__projectKey__:", "");
          openProjectTasksModal(pk, true);
        } else {
          openModal(item.title, item.url, null, true);
        }
      });
    }

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
      var selected = modal.querySelector('input[name="pmOtherStatus"]:checked');
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

  function wireRecurringFieldHider() {
    function hideRecurringField() {
      var sublabel = document.querySelector(
        ".sublabel.blockIndicator_" + RECURRING_INDICATOR_ID,
      );
      var response = document.querySelector(
        ".response.blockIndicator_" + RECURRING_INDICATOR_ID,
      );
      if (sublabel) sublabel.style.display = "none";
      if (response) response.style.display = "none";
    }

    // Initial hide attempt
    hideRecurringField();

    // Watch for LEAF re-rendering and re-hide immediately
    var observer = new MutationObserver(function () {
      hideRecurringField();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function wireAddButtons() {
    var inbox = document.getElementById("pmViewInboxBtn");
    if (inbox)
      inbox.addEventListener("click", function () {
        openModal("Inbox", "report.php?a=LEAF_Inbox");
      });

    var reportBuilder = document.getElementById("pmReportBuilderBtn");
    if (reportBuilder)
      reportBuilder.addEventListener("click", function () {
        window.open(
          "https://leaf.va.gov/platform/projects/?a=reports&v=3",
          "_blank",
          "noopener",
        );
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
      if (typeof focusIndex === "number") {
        focusItem(focusIndex);
      }
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
        openModal(
          "New Recurring Task",
          START_RECURRING_TASK_URL,
          function (frame) {
            var maxAttempts = 20; // 20 x 250ms = 5 seconds max wait
            var attempts = 0;

            function tryInject() {
              attempts++;
              try {
                var doc = frame.contentDocument || frame.contentWindow.document;
                if (!doc) {
                  if (attempts < maxAttempts) setTimeout(tryInject, 250);
                  return;
                }

                // Target the Yes radio button for indicator 45
                var radio = doc.querySelector(
                  'input[type="radio"][name="' +
                    RECURRING_INDICATOR_ID +
                    '"][value="Yes"]',
                );

                if (!radio) {
                  if (attempts < maxAttempts) {
                    setTimeout(tryInject, 250);
                  } else {
                    console.warn(
                      "Recurring radio (indicator " +
                        RECURRING_INDICATOR_ID +
                        ") not found after " +
                        maxAttempts +
                        " attempts.",
                    );
                  }
                  return;
                }

                // Ensure it's selected — URL pre-population should handle this
                // but we force it as a safety measure
                radio.checked = true;
                radio.dispatchEvent(new Event("change", { bubbles: true }));

                // Use iCheck API if available
                var $radio =
                  frame.contentWindow.$ && frame.contentWindow.$(radio);
                if ($radio && $radio.iCheck) {
                  $radio.iCheck("check");
                }

                // Hide the entire field from the user
                var fieldWrapper =
                  radio.closest("tr") ||
                  radio.closest(".xtemplate_field") ||
                  radio.closest(".leafFormField") ||
                  radio.parentElement;
                if (fieldWrapper) fieldWrapper.style.display = "none";
              } catch (e) {
                console.warn("Could not inject recurring radio value:", e);
              }
            }

            // Start polling after initial short delay
            setTimeout(tryInject, 300);
          },
        );
      } else if (action === "objective")
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
      else openMenu();
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

  function fetchAndRenderInboxCount() {
    var badge = document.getElementById("pmInboxBadge");
    if (!badge) return;

    var queryParams =
      "?q=" +
      encodeURIComponent(
        JSON.stringify({
          terms: [
            { id: "stepID", operator: "=", match: "actionable", gate: "AND" },
            { id: "deleted", operator: "=", match: 0, gate: "AND" },
          ],
          joins: [],
          sort: {},
          limit: 500,
          limitOffset: 0,
        }),
      ) +
      "&x-filterData=recordID&masquerade=nonAdmin";

    fetch("api/site/settings/sitemap_json", {
      headers: { "x-requested-with": "XMLHttpRequest" },
      credentials: "include",
    })
      .then(function (r) {
        if (!r.ok) throw new Error("sitemap HTTP " + r.status);
        return r.json();
      })
      .then(function (sitemap) {
        var portalUrls = [];

        try {
          // sitemap is an array; first element's "data" property is a JSON string
          // containing a "buttons" array where each button has a "target" URL
          var entry = Array.isArray(sitemap) ? sitemap[0] : null;
          var parsed = entry && entry.data ? JSON.parse(entry.data) : null;
          var buttons =
            parsed && Array.isArray(parsed.buttons) ? parsed.buttons : [];

          buttons.forEach(function (btn) {
            if (btn.target) {
              portalUrls.push(btn.target.replace(/\/$/, ""));
            }
          });
        } catch (e) {
          console.warn("pm-inbox: failed to parse sitemap buttons", e);
        }

        // Fallback to current portal if sitemap parse failed or empty
        if (!portalUrls.length) {
          var currentBase = window.location.href.replace(
            /\/[^\/]*(\?.*)?$/,
            "",
          );
          portalUrls = [currentBase];
        }

        // Query each portal for actionable records in parallel
        var fetches = portalUrls.map(function (baseUrl) {
          return fetch(baseUrl + "/api/form/query" + queryParams, {
            credentials: "include",
          })
            .then(function (r) {
              if (!r.ok) return {};
              return r.json();
            })
            .then(function (data) {
              return data && typeof data === "object"
                ? Object.keys(data).length
                : 0;
            })
            .catch(function () {
              return 0;
            });
        });

        return Promise.all(fetches);
      })
      .then(function (counts) {
        var total = counts.reduce(function (sum, n) {
          return sum + n;
        }, 0);
        var count = total;
        if (count > 0) {
          badge.textContent = count > 99 ? "99+" : String(count);
          badge.hidden = false;
          badge.setAttribute(
            "aria-label",
            count + " inbox item" + (count !== 1 ? "s" : ""),
          );
        } else {
          badge.hidden = true;
          badge.setAttribute("aria-label", "No inbox items");
        }
      })
      .catch(function () {
        badge.hidden = true;
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
      window.scrollTo(0, 0);
    });

    window.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("resize", debounce(updateVisibility, 120));
    updateVisibility();
  }

  function wireFeedbackWidget() {
    var btn = document.getElementById("pmFeedbackBtn");
    var modal = document.getElementById("pmFeedbackModal");
    var closeBtn = document.getElementById("pmFeedbackClose");
    var textarea = document.getElementById("pmFeedbackText");
    var submitBtn = document.getElementById("pmFeedbackSubmit");
    var statusEl = document.getElementById("pmFeedbackStatus");
    if (!btn || !modal) return;

    var feedbackClickOutsideHandler = null;

    function attachFeedbackClickOutside() {
      if (feedbackClickOutsideHandler) return;
      feedbackClickOutsideHandler = function (e) {
        if (!modal.hidden && !modal.contains(e.target) && e.target !== btn) {
          closeFeedback();
        }
      };
      setTimeout(function () {
        document.addEventListener("click", feedbackClickOutsideHandler);
      }, 0);
    }

    function detachFeedbackClickOutside() {
      if (feedbackClickOutsideHandler) {
        document.removeEventListener("click", feedbackClickOutsideHandler);
        feedbackClickOutsideHandler = null;
      }
    }

    function openFeedback() {
      modal.hidden = false;
      textarea.focus();
      attachFeedbackClickOutside();
    }

    function closeFeedback() {
      detachFeedbackClickOutside();
      modal.hidden = true;
      textarea.value = "";
      statusEl.textContent = "";
      btn.focus();
    }

    btn.addEventListener("click", openFeedback);
    closeBtn.addEventListener("click", closeFeedback);

    // Close on Escape
    modal.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeFeedback();
    });

    submitBtn.addEventListener("click", async function () {
      var text = textarea.value.trim();
      if (!text) {
        statusEl.textContent = "Please enter your feedback before submitting.";
        textarea.focus();
        return;
      }

      submitBtn.disabled = true;
      statusEl.textContent = "Submitting...";

      try {
        var token = await ensureCSRFToken();
        var tokenField = state.csrfField || getCSRFFieldName();

        // Step 1: Create new record
        var fd = new FormData();
        fd.append(tokenField, token);
        fd.append("numform_1c5b6", "1");
        var createHeaders = { "x-requested-with": "XMLHttpRequest" };
        if (token) {
          createHeaders["x-csrf-token"] = token;
          createHeaders["x-xsrf-token"] = token;
        }
        var createRes = await fetch("/platform/projects/api/form/new", {
          method: "POST",
          credentials: "include",
          headers: createHeaders,
          body: fd,
        });
        if (!createRes.ok)
          throw new Error("Create failed HTTP " + createRes.status);
        var createText = await createRes.text();
        var newRecordID;
        try {
          newRecordID = JSON.parse(createText);
        } catch (e) {
          newRecordID = createText;
        }
        newRecordID = parseInt(
          String(newRecordID || "")
            .trim()
            .replace(/^\"|\"$/g, ""),
          10,
        );
        if (!newRecordID || newRecordID <= 0)
          throw new Error("Invalid record ID returned");

        // Step 2: Write feedback text to indicator 50
        var writeToken = await ensureCSRFToken(newRecordID);
        var writeBody = new URLSearchParams();
        writeBody.append("CSRFToken", writeToken);
        writeBody.append("50", text);
        await fetch("/platform/projects/api/form/" + newRecordID, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: writeBody.toString(),
        });

        // Step 3: Submit into workflow step 13
        var submitToken = await ensureCSRFToken(newRecordID);
        var submitBody = new URLSearchParams();
        submitBody.append("CSRFToken", submitToken);
        submitBody.append("stepID", "13");
        await fetch("/platform/projects/api/form/" + newRecordID + "/submit", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: submitBody.toString(),
        });

        statusEl.textContent = "Thank you for your feedback!";
        textarea.value = "";
        setTimeout(closeFeedback, 2000);
      } catch (err) {
        console.error("Feedback submission failed:", err);
        statusEl.textContent = "Submission failed. Please try again.";
      } finally {
        submitBtn.disabled = false;
      }
    });
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
    var dark = document.body.classList.contains("pm-dark");
    var tickColor = dark ? "#e2e8f0" : "#1f2933";
    var gridColor = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
    var options = { responsive: true, maintainAspectRatio: false };
    if (isChartV2()) {
      options.scales = {
        xAxes: [
          {
            ticks: { beginAtZero: true, fontColor: tickColor },
            gridLines: { color: gridColor },
          },
        ],
        yAxes: [
          {
            ticks: { autoSkip: false, fontColor: tickColor },
            gridLines: { color: gridColor },
          },
        ],
      };
    } else {
      options.indexAxis = "y";
      options.scales = {
        x: {
          beginAtZero: true,
          ticks: { color: tickColor },
          grid: { color: gridColor },
        },
        y: {
          ticks: { autoSkip: false, color: tickColor },
          grid: { color: gridColor },
        },
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

  function getAnalyticsTaskInfo(task, config) {
    if (!task || isArchivedStatus(task.status)) {
      return { inGeneral: false, inCompleted: false, inTicket: false };
    }

    var generalDate = getTaskGeneralDate(task);
    var completionDate = getCompletionDateForTask(task);
    var ticketDate = getTicketImportedDate(task);
    var hasTicket = !!String(task.supportTicket || "").trim();

    var inGeneral = !!(generalDate && isInAnalyticsWindow(generalDate, config));
    var inCompleted = !!(
      isCompletedStatus(task.status) &&
      completionDate &&
      isInAnalyticsWindow(completionDate, config)
    );
    var inTicket = !!(
      hasTicket &&
      ticketDate &&
      isInAnalyticsWindow(ticketDate, config)
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
    else if (p === "medium") adjustCount(cache.priorityCounts, "Medium", delta);
    else if (p === "low") adjustCount(cache.priorityCounts, "Low", delta);
    else adjustCount(cache.priorityCounts, "Unspecified", delta);

    if (!cache.health[pk])
      cache.health[pk] = { total: 0, overdue: 0, completed: 0 };
    cache.health[pk].total += delta;
    if (isCompletedStatus(info.task.status))
      cache.health[pk].completed += delta;
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
    var oldInfo = getAnalyticsTaskInfo(oldTask, cache.config);
    var newInfo = getAnalyticsTaskInfo(newTask, cache.config);

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

    var projectsForGeneralCharts = (analyticsProjects || []).filter(
      function (p) {
        var d = getProjectGeneralDate(p);
        if (!d || isNaN(d.getTime())) return false;
        return inSelectedYear(d) && inSelectedQuarter(d);
      },
    );

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

    // Projects imported by month — uses createdAt via getProjectGeneralDate
    var projectImportCounts = new Array(12).fill(0);
    (projectsForGeneralCharts || []).forEach(function (p) {
      var date = getProjectGeneralDate(p);
      if (!date || !inSelectedYear(date)) return;
      if (!inSelectedQuarter(date)) return;
      projectImportCounts[date.getMonth()] += 1;
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
      projectImportCounts: projectImportCounts,
      projectTypeData: projectTypeData,
      tasksForGeneralCharts: tasksForGeneralCharts,
    };
  }

  var CHART_DRILLDOWN_MAP = {
    scheduleVariance: {
      containerId: "pmDrilldownScheduleVariance",
      resolver: drilldownScheduleVariance,
    },
    dueBuckets: {
      containerId: "pmDrilldownDueBuckets",
      resolver: drilldownDueBuckets,
    },
    completedByQuarter: {
      containerId: "pmDrilldownCompletedByQuarter",
      resolver: drilldownCompletedByQuarter,
    },
    completedByCategory: {
      containerId: "pmDrilldownCompletedByCategory",
      resolver: drilldownCompletedByCategory,
    },
    priority: {
      containerId: "pmDrilldownTasksByPriority",
      resolver: drilldownTasksByPriority,
    },
    status: {
      containerId: "pmDrilldownTasksByStatus",
      resolver: drilldownTasksByStatus,
    },
    projectKey: {
      containerId: "pmDrilldownTasksByProject",
      resolver: drilldownTasksByProject,
    },
    ticketsImported: {
      containerId: "pmDrilldownTicketsImported",
      resolver: drilldownTicketsImported,
    },
    projectsByType: {
      containerId: "pmDrilldownProjectsByType",
      resolver: drilldownProjectsByType,
    },
  };

  function wireChartDrilldown(slot, canvasId) {
    var drilldownCfg = CHART_DRILLDOWN_MAP[slot];
    if (!drilldownCfg) return;
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    canvas.classList.add("pm-chartClickable");
    if (canvas._pmDrilldownHandler) {
      canvas.removeEventListener("click", canvas._pmDrilldownHandler);
    }
    canvas._pmDrilldownHandler = function (e) {
      var chartInstance = state.charts[slot];
      if (!chartInstance) return;
      var elements = chartInstance.getElementsAtEventForMode
        ? chartInstance.getElementsAtEventForMode(
            e,
            "nearest",
            { intersect: true },
            false,
          )
        : chartInstance.getElementsAtEvent
          ? chartInstance.getElementsAtEvent(e)
          : [];
      if (!elements || !elements.length) return;
      var index =
        elements[0].index != null
          ? elements[0].index
          : elements[0]._index != null
            ? elements[0]._index
            : null;
      if (index === null) return;
      var clickedLabel = chartInstance.data.labels[index];
      var containerId = drilldownCfg.containerId;
      if (state.drilldownActive[containerId] === clickedLabel) {
        closeDrilldown(containerId);
        return;
      }
      state.drilldownActive[containerId] = clickedLabel;
      var cache =
        state.cache.analytics && state.cache.analytics.size
          ? state.cache.analytics.values().next().value
          : null;
      drilldownCfg.resolver(clickedLabel, cache);
    };
    canvas.addEventListener("click", canvas._pmDrilldownHandler);
  }

  function updateOrCreateChart(
    slot,
    canvasId,
    labels,
    data,
    datasetLabel,
    colors,
  ) {
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
      wireChartDrilldown(slot, canvasId);
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
    wireChartDrilldown(slot, canvasId);
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

  // ── Drilldown engine ──────────────────────────────────────────────────────

  function renderDrilldownTable(
    containerId,
    label,
    columns,
    rows,
    columnTypes,
  ) {
    // containerId is now ignored — all drilldowns go to the shared panel
    var panel = document.getElementById("pmAnalyticsDrilldown");
    var titleEl = panel && panel.querySelector(".pm-analyticsDrilldownTitle");
    var iconEl = panel && panel.querySelector(".pm-analyticsDrilldownIcon");
    var body = document.getElementById("pmAnalyticsDrilldownBody");
    if (!panel || !body) return;

    // Find the chart title for context — look up from CHART_DRILLDOWN_MAP
    var slotToCanvasId = {
      scheduleVariance: "pmChartScheduleVariance",
      dueBuckets: "pmChartDueBuckets",
      completedByQuarter: "pmChartCompletedByQuarter",
      completedByCategory: "pmChartCompletedByCategory",
      priority: "pmChartTasksByPriority",
      status: "pmChartTasksByStatus",
      projectKey: "pmChartTasksByProject",
      ticketsImported: "pmChartTicketsImported",
      projectsByType: "pmChartProjectsByType",
    };
    var chartLabel = "";
    Object.keys(CHART_DRILLDOWN_MAP).forEach(function (slot) {
      if (CHART_DRILLDOWN_MAP[slot].containerId === containerId) {
        var canvas = document.getElementById(slotToCanvasId[slot]);
        if (canvas) {
          var card = canvas.closest(".pm-chartCard");
          var titleNode = card && card.querySelector(".pm-chartTitle");
          chartLabel = titleNode ? titleNode.textContent.trim() : "";
        }
      }
    });

    if (titleEl)
      titleEl.textContent =
        (chartLabel ? chartLabel + "  \u2014  " : "") + label;
    if (iconEl) iconEl.textContent = "bar_chart";

    var headerCells = columns
      .map(function (c, i) {
        var type = (columnTypes && columnTypes[i]) || "string";
        return (
          '<th scope="col" class="pm-sortable" data-type="' +
          type +
          '">' +
          '<button type="button" class="pm-sortBtn">' +
          safe(c) +
          "</button>" +
          "</th>"
        );
      })
      .join("");
    var bodyHtml = rows.length
      ? rows.join("")
      : '<tr><td colspan="' +
        columns.length +
        '" style="text-align:center;padding:16px;color:#888;">No data for this selection.</td></tr>';

    body.innerHTML =
      '<table class="pm-table" style="width:100%;">' +
      "<thead><tr>" +
      headerCells +
      "</tr></thead>" +
      "<tbody>" +
      bodyHtml +
      "</tbody>" +
      "</table>";

    var tableEl = body.querySelector("table");
    if (tableEl) wireInlineTableSort(tableEl);

    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function closeDrilldown(containerId) {
    // Clear the active state for this container
    delete state.drilldownActive[containerId];

    // Only hide the panel if no other drilldowns are active
    if (Object.keys(state.drilldownActive).length === 0) {
      var panel = document.getElementById("pmAnalyticsDrilldown");
      var body = document.getElementById("pmAnalyticsDrilldownBody");
      if (panel) panel.hidden = true;
      if (body) body.innerHTML = "";
    }
  }

  function drilldownTaskIdCell(t) {
    return t.href
      ? '<td><a href="' +
          safeAttr(t.href) +
          '" class="pm-recordLink pm-taskIdBadge" data-title="Task ' +
          safe(t.recordID) +
          '">' +
          safe(t.recordID) +
          "</a></td>"
      : '<td><span class="pm-taskIdBadge">' + safe(t.recordID) + "</span></td>";
  }

  function wireDrilldownCloseButtons() {
    var closeBtn = document.getElementById("pmAnalyticsDrilldownClose");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        state.drilldownActive = {};
        var panel = document.getElementById("pmAnalyticsDrilldown");
        var body = document.getElementById("pmAnalyticsDrilldownBody");
        if (panel) panel.hidden = true;
        if (body) body.innerHTML = "";
      });
    }
  }

  // ── Per-chart drilldown resolvers ─────────────────────────────────────────

  function drilldownScheduleVariance(label, cache) {
    var MS_PER_DAY = 1000 * 60 * 60 * 24;
    var sourceTasks =
      cache && cache.tasksForGeneralCharts
        ? cache.tasksForGeneralCharts
        : getAnalyticsBaseTasks();

    var tasks = (sourceTasks || [])
      .filter(function (t) {
        if (!t.actualCompletion || !t.due) return false;
        if (
          String(t.status || "")
            .toLowerCase()
            .indexOf("completed") === -1
        )
          return false;
        var due = mmddyyyyToDate(t.due);
        var actual = mmddyyyyToDate(t.actualCompletion);
        if (!due || !actual) return false;
        var gap = Math.round((actual.getTime() - due.getTime()) / MS_PER_DAY);
        if (label === "Early/On Time") return gap <= 0;
        if (label === "1\u20137 days late") return gap >= 1 && gap <= 7;
        if (label === "8\u201314 days late") return gap >= 8 && gap <= 14;
        if (label === "15+ days late") return gap >= 15;
        return false;
      })
      .map(function (t) {
        var due = mmddyyyyToDate(t.due);
        var actual = mmddyyyyToDate(t.actualCompletion);
        var gap = Math.round((actual.getTime() - due.getTime()) / MS_PER_DAY);
        return { task: t, gap: gap };
      })
      .sort(function (a, b) {
        return b.gap - a.gap;
      });

    var rows = tasks.map(function (item) {
      var gapLabel =
        item.gap <= 0
          ? Math.abs(item.gap) + " days early"
          : item.gap + " days late";
      return (
        "<tr>" +
        drilldownTaskIdCell(item.task) +
        "<td>" +
        safe(item.task.title || "(No title)") +
        "</td>" +
        "<td>" +
        safe(item.task.assignedTo) +
        "</td>" +
        "<td>" +
        safe(item.task.due) +
        "</td>" +
        "<td>" +
        safe(item.task.actualCompletion) +
        "</td>" +
        '<td style="font-weight:600;color:' +
        (item.gap > 0 ? "#c62828" : "#2e7d32") +
        ';">' +
        gapLabel +
        "</td>" +
        "</tr>"
      );
    });

    renderDrilldownTable(
      "pmDrilldownScheduleVariance",
      label,
      [
        "Task ID",
        "Task Name",
        "Assigned To",
        "Due Date",
        "Completed Date",
        "Variance",
      ],
      rows,
      ["number", "string", "string", "date", "date", "string"],
    );
  }

  function drilldownDueBuckets(label, cache) {
    var now = new Date();
    var tasks = (state.tasksAll || []).filter(function (t) {
      return getDueBucketForTask(t, now) === label;
    });
    var rows = tasks.map(function (t) {
      return (
        "<tr>" +
        drilldownTaskIdCell(t) +
        "<td>" +
        safe(t.title || "(No title)") +
        "</td>" +
        "<td>" +
        safe(t.status) +
        "</td>" +
        "<td>" +
        safe(t.priority) +
        "</td>" +
        "<td>" +
        safe(t.due) +
        "</td>" +
        "<td>" +
        safe(t.assignedTo) +
        "</td>" +
        "</tr>"
      );
    });
    renderDrilldownTable(
      "pmDrilldownDueBuckets",
      label,
      ["Task ID", "Task Name", "Status", "Priority", "Due Date", "Assigned To"],
      rows,
      ["number", "string", "string", "string", "date", "string"],
    );
  }

  function drilldownCompletedByQuarter(label, cache) {
    var qIndex = parseInt(label.replace("Q", "")) - 1;
    var tasks = (state.tasksAll || []).filter(function (t) {
      if (!isCompletedStatus(t.status)) return false;
      var date = getCompletionDateForTask(t);
      if (!date) return false;
      return Math.floor(date.getMonth() / 3) === qIndex;
    });
    var rows = tasks.map(function (t) {
      return (
        "<tr>" +
        drilldownTaskIdCell(t) +
        "<td>" +
        safe(t.title || "(No title)") +
        "</td>" +
        "<td>" +
        safe(t.category) +
        "</td>" +
        "<td>" +
        safe(t.assignedTo) +
        "</td>" +
        "<td>" +
        safe(t.actualCompletion) +
        "</td>" +
        "</tr>"
      );
    });
    renderDrilldownTable(
      "pmDrilldownCompletedByQuarter",
      label,
      ["Task ID", "Task Name", "Category", "Assigned To", "Completed Date"],
      rows,
      ["number", "string", "string", "string", "date"],
    );
  }

  function drilldownCompletedByCategory(label, cache) {
    var tasks = (state.tasksAll || []).filter(function (t) {
      if (!isCompletedStatus(t.status)) return false;
      var cat = String(t.category || "").trim() || "Unspecified";
      return cat === label;
    });
    var rows = tasks.map(function (t) {
      return (
        "<tr>" +
        drilldownTaskIdCell(t) +
        "<td>" +
        safe(t.title || "(No title)") +
        "</td>" +
        "<td>" +
        safe(t.assignedTo) +
        "</td>" +
        "<td>" +
        safe(t.actualCompletion) +
        "</td>" +
        "</tr>"
      );
    });
    renderDrilldownTable(
      "pmDrilldownCompletedByCategory",
      label,
      ["Task ID", "Task Name", "Assigned To", "Completed Date"],
      rows,
      ["number", "string", "string", "date"],
    );
  }

  function drilldownTasksByPriority(label, cache) {
    var tasks = (state.tasksAll || []).filter(function (t) {
      var p = String(t.priority || "").trim();
      var normalized = !p
        ? "Unspecified"
        : p.toLowerCase() === "high"
          ? "High"
          : p.toLowerCase() === "medium"
            ? "Medium"
            : p.toLowerCase() === "low"
              ? "Low"
              : "Unspecified";
      return normalized === label;
    });
    var rows = tasks.map(function (t) {
      return (
        "<tr>" +
        drilldownTaskIdCell(t) +
        "<td>" +
        safe(t.title || "(No title)") +
        "</td>" +
        "<td>" +
        safe(t.status) +
        "</td>" +
        "<td>" +
        safe(t.projectKey) +
        "</td>" +
        "<td>" +
        safe(t.assignedTo) +
        "</td>" +
        "<td>" +
        safe(t.due) +
        "</td>" +
        "</tr>"
      );
    });
    renderDrilldownTable(
      "pmDrilldownTasksByPriority",
      label,
      [
        "Task ID",
        "Task Name",
        "Status",
        "Project Key",
        "Assigned To",
        "Due Date",
      ],
      rows,
      ["number", "string", "string", "string", "string", "date"],
    );
  }

  function drilldownTasksByStatus(label, cache) {
    var tasks = (state.tasksAll || []).filter(function (t) {
      var primary = normalizePrimaryStatus(t.status);
      if (label === "Other (Blocked)") {
        return (
          primary === "Other" &&
          getOtherSubTypeValue(t.otherSubType) === "Blocked"
        );
      }
      if (label === "Other (On Hold)") {
        return (
          primary === "Other" &&
          getOtherSubTypeValue(t.otherSubType) === "On Hold"
        );
      }
      if (label === "Unknown") {
        return primary === "Unknown" || primary === "Other";
      }
      return primary === label;
    });
    var rows = tasks.map(function (t) {
      return (
        "<tr>" +
        drilldownTaskIdCell(t) +
        "<td>" +
        safe(t.title || "(No title)") +
        "</td>" +
        "<td>" +
        safe(t.projectKey) +
        "</td>" +
        "<td>" +
        safe(t.priority) +
        "</td>" +
        "<td>" +
        safe(t.assignedTo) +
        "</td>" +
        "<td>" +
        safe(t.due) +
        "</td>" +
        "</tr>"
      );
    });
    renderDrilldownTable(
      "pmDrilldownTasksByStatus",
      label,
      [
        "Task ID",
        "Task Name",
        "Project Key",
        "Priority",
        "Assigned To",
        "Due Date",
      ],
      rows,
      ["number", "string", "string", "string", "string", "date"],
    );
  }

  function drilldownTasksByProject(label, cache) {
    var tasks = (state.tasksAll || []).filter(function (t) {
      var pk = String(t.projectKey || "").trim() || "(Blank)";
      return pk === label;
    });
    var rows = tasks.map(function (t) {
      return (
        "<tr>" +
        drilldownTaskIdCell(t) +
        "<td>" +
        safe(t.title || "(No title)") +
        "</td>" +
        "<td>" +
        safe(t.status) +
        "</td>" +
        "<td>" +
        safe(t.priority) +
        "</td>" +
        "<td>" +
        safe(t.assignedTo) +
        "</td>" +
        "<td>" +
        safe(t.due) +
        "</td>" +
        "</tr>"
      );
    });
    renderDrilldownTable(
      "pmDrilldownTasksByProject",
      label,
      ["Task ID", "Task Name", "Status", "Priority", "Assigned To", "Due Date"],
      rows,
      ["number", "string", "string", "string", "string", "date"],
    );
  }

  function drilldownTicketsImported(label, cache) {
    var monthIndex = [
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
    ].indexOf(label);

    // Ticket-linked tasks
    var ticketTasks = (state.tasksAll || []).filter(function (t) {
      if (!String(t.supportTicket || "").trim()) return false;
      var date = getTicketImportedDate(t);
      if (!date) return false;
      return date.getMonth() === monthIndex;
    });

    // Projects imported in this month
    var importedProjects = (state.projectsAll || []).filter(function (p) {
      var date = getProjectGeneralDate(p);
      if (!date) return false;
      return date.getMonth() === monthIndex;
    });

    // Build combined rows — tickets first, then projects
    var ticketRows = ticketTasks.map(function (t) {
      return (
        "<tr>" +
        drilldownTaskIdCell(t) +
        "<td>" +
        safe(t.title || "(No title)") +
        "</td>" +
        "<td>" +
        safe(t.supportTicket) +
        "</td>" +
        "<td>" +
        safe(t.projectKey) +
        "</td>" +
        "<td>" +
        safe(t.assignedTo) +
        "</td>" +
        "<td>Ticket</td>" +
        "</tr>"
      );
    });

    var projectRows = importedProjects.map(function (p) {
      var pkHref = getProjectRecordHrefFromKey(p.projectKey);
      var pkCell = pkHref
        ? '<a href="' +
          safe(pkHref) +
          '" class="pm-recordLink pm-pkProjectLink" ' +
          'data-title="Project ' +
          safeAttr(p.projectKey) +
          '" ' +
          'data-projectkey="' +
          safeAttr(p.projectKey) +
          '">' +
          safe(p.projectKey) +
          "</a>"
        : safe(p.projectKey);
      return (
        "<tr>" +
        "<td>" +
        pkCell +
        "</td>" +
        "<td>" +
        safe(p.projectName || "(No name)") +
        "</td>" +
        "<td>—</td>" +
        "<td>" +
        safe(p.projectKey) +
        "</td>" +
        "<td>" +
        safe(p.owner) +
        "</td>" +
        "<td>Project</td>" +
        "</tr>"
      );
    });

    renderDrilldownTable(
      "pmDrilldownTicketsImported",
      label,
      [
        "ID / Key",
        "Name",
        "Ticket #",
        "Project Key",
        "Assigned / Owner",
        "Type",
      ],
      ticketRows.concat(projectRows),
      ["string", "string", "string", "string", "string", "string"],
    );
  }

  function drilldownProjectsByType(label, cache) {
    var projects = (state.projectsAll || []).filter(function (p) {
      // Apply the same label transformation used when building the chart
      // so "IT - Infrastructure" correctly matches chart label "IT"
      var rawType = String(p.projectType || "").trim() || "Unknown";
      var formattedType = formatProjectTypeLabel(rawType);
      return formattedType === label;
    });

    var rows = projects.map(function (p) {
      var pkHref = getProjectRecordHrefFromKey(p.projectKey);
      var pkCell = pkHref
        ? '<td><a href="' +
          safeAttr(pkHref) +
          '" class="pm-recordLink pm-pkProjectLink" ' +
          'data-title="Project ' +
          safeAttr(p.projectKey) +
          '" ' +
          'data-projectkey="' +
          safeAttr(p.projectKey) +
          '">' +
          safe(p.projectKey) +
          "</a></td>"
        : "<td>" + safe(p.projectKey) + "</td>";
      return (
        "<tr>" +
        pkCell +
        "<td>" +
        safe(p.projectName) +
        "</td>" +
        "<td>" +
        safe(p.projectStatus) +
        "</td>" +
        "<td>" +
        safe(p.owner) +
        "</td>" +
        "<td>" +
        safe(p.projectFiscalYear) +
        "</td>" +
        "</tr>"
      );
    });

    renderDrilldownTable(
      "pmDrilldownProjectsByType",
      label,
      ["Project Key", "Project Name", "Status", "Owner", "Fiscal Year"],
      rows,
      ["string", "string", "string", "string", "string"],
    );
  }

  // ── End drilldown engine ──────────────────────────────────────────────────

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
      "Showing " +
      shown +
      " of " +
      total +
      " result" +
      (total === 1 ? "" : "s");
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

    var overdueTasks = (cache.overdueTasks || []).slice().sort(function (a, b) {
      var da = mmddyyyyToDate(a.due) || new Date(8640000000000000);
      var db = mmddyyyyToDate(b.due) || new Date(8640000000000000);
      return da - db;
    });

    tableState.overdueRows = overdueTasks.map(function (t) {
      var pkHref = getProjectRecordHrefFromKey(t.projectKey);
      var pkLink = pkHref
        ? "<a href='" +
          safe(pkHref) +
          "' class='pm-recordLink pm-pkProjectLink' data-title='" +
          safe("Project " + t.projectKey) +
          "' data-projectkey='" +
          safeAttr(String(t.projectKey || "")) +
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
      if (label === "Other (Blocked)")
        return cache.otherBuckets["Other (Blocked)"] || 0;
      if (label === "Other (On Hold)")
        return cache.otherBuckets["Other (On Hold)"] || 0;
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
        (catLabels.length
          ? summarizeLabelData(catLabels, catData)
          : "No data."),
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
        (projLabels.length
          ? summarizeLabelData(projLabels, projData)
          : "No data."),
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

    var projectImportCounts =
      cache.projectImportCounts || new Array(12).fill(0);

    setChartSummary(
      "pmChartTicketsImportedDesc",
      "Tickets & Projects imported by month (" +
        filterLabel +
        "): " +
        "Tickets — " +
        summarizeLabelData(ticketLabels, cache.ticketCounts) +
        "; Projects — " +
        summarizeLabelData(ticketLabels, projectImportCounts),
    );

    // Destroy existing chart instance before replacing with multi-dataset
    if (state.charts && state.charts["ticketsImported"]) {
      try {
        state.charts["ticketsImported"].destroy();
      } catch (e) {}
      delete state.charts["ticketsImported"];
    }

    var ticketsCanvas = document.getElementById("pmChartTicketsImported");
    if (ticketsCanvas && typeof Chart !== "undefined") {
      var ticketsCtx = ticketsCanvas.getContext("2d");
      var isDarkMode = document.body.classList.contains("pm-dark");
      var tickColor = isDarkMode ? "#e2e8f0" : "#1f2933";
      var gridColor = isDarkMode
        ? "rgba(255,255,255,0.08)"
        : "rgba(0,0,0,0.08)";

      var multiChart = new Chart(ticketsCtx, {
        type: "bar",
        data: {
          labels: ticketLabels,
          datasets: [
            {
              label: "Tickets",
              data: cache.ticketCounts,
              backgroundColor: "rgba(37,99,235,0.75)",
              borderColor: "rgba(37,99,235,1)",
              borderWidth: 1,
            },
            {
              label: "Projects",
              data: projectImportCounts,
              backgroundColor: "rgba(16,185,129,0.75)",
              borderColor: "rgba(16,185,129,1)",
              borderWidth: 1,
            },
          ],
        },
        options: (function () {
          if (isChartV2()) {
            return {
              responsive: true,
              maintainAspectRatio: true,
              legend: {
                display: true,
                position: "top",
                labels: { fontColor: tickColor, boxWidth: 14, padding: 12 },
              },
              scales: {
                xAxes: [
                  {
                    ticks: { fontColor: tickColor },
                    gridLines: { color: gridColor },
                  },
                ],
                yAxes: [
                  {
                    ticks: {
                      fontColor: tickColor,
                      beginAtZero: true,
                      precision: 0,
                    },
                    gridLines: { color: gridColor },
                  },
                ],
              },
            };
          }
          return {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: {
                display: true,
                position: "top",
                labels: { color: tickColor, boxWidth: 14, padding: 12 },
              },
            },
            scales: {
              x: { ticks: { color: tickColor }, grid: { color: gridColor } },
              y: {
                beginAtZero: true,
                ticks: { color: tickColor, precision: 0 },
                grid: { color: gridColor },
              },
            },
          };
        })(),
      });

      if (!state.charts) state.charts = {};
      state.charts["ticketsImported"] = multiChart;
      wireChartDrilldown("ticketsImported", "pmChartTicketsImported");
    }

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

    var svData = computeScheduleVariance(cache.tasksForGeneralCharts || []);
    setChartSummary(
      "pmChartScheduleVarianceDesc",
      "Schedule variance (" +
        filterLabel +
        "): " +
        (svData.labels.length
          ? summarizeLabelData(svData.labels, svData.data)
          : "No data."),
    );
    updateOrCreateChart(
      "scheduleVariance",
      "pmChartScheduleVariance",
      svData.labels.length ? svData.labels : ["No data"],
      svData.labels.length ? svData.data : [0],
      "Tasks",
    );

    renderAnalyticsTablesFromCache(cache);
  }

  function computeScheduleVariance(tasks) {
    var buckets = {
      "Early/On Time": 0,
      "1\u20137 days late": 0,
      "8\u201314 days late": 0,
      "15+ days late": 0,
    };
    var MS_PER_DAY = 1000 * 60 * 60 * 24;
    (tasks || []).forEach(function (t) {
      if (!t.actualCompletion || !t.due) return;
      var statusLower = String(t.status || "").toLowerCase();
      if (statusLower.indexOf("completed") === -1) return;
      var dueDate = mmddyyyyToDate(t.due);
      var actualDate = mmddyyyyToDate(t.actualCompletion);
      if (!dueDate || !actualDate) return;
      var gap = Math.round(
        (actualDate.getTime() - dueDate.getTime()) / MS_PER_DAY,
      );
      if (gap <= 0) {
        buckets["Early/On Time"]++;
      } else if (gap <= 7) {
        buckets["1\u20137 days late"]++;
      } else if (gap <= 14) {
        buckets["8\u201314 days late"]++;
      } else {
        buckets["15+ days late"]++;
      }
    });
    var labels = Object.keys(buckets);
    var data = labels.map(function (k) {
      return buckets[k];
    });
    return { labels: labels, data: data };
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
        "pmChartScheduleVarianceDesc",
      ].forEach(function (id) {
        setChartSummary(id, "Charts unavailable.");
      });
      return;
    }

    var analyticsTasks = (tasks || []).filter(function (t) {
      return !isArchivedStatus(t.status);
    });
    var analyticsProjects = (state.projectsAll || []).filter(function (p) {
      var status = String(p.projectStatus || "").toLowerCase();
      return (
        status.indexOf("cancel") === -1 &&
        status.indexOf("delet") === -1 &&
        status.indexOf("archive") === -1 &&
        status.indexOf("inactive") === -1
      );
    });
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

  function initTour() {
    var TOUR_KEY = "pm_tour_seen_v1";

    var steps = [
      {
        title: "Welcome to the LEAF Project Dashboard",
        body: "This quick tour walks you through the key features. Use Next and Back to navigate, or press Escape to exit anytime. Keyboard users: use Tab to move between buttons and arrow keys to navigate steps.",
        target: null,
      },
      {
        title: "Add Menu",
        body: "Create a new Project, Task, or Recurring Task here. Recurring tasks automatically generate a fresh copy each time they're completed — no manual re-entry needed.",
        target: "#pmAddMenuBtn",
      },
      {
        title: "View Inbox",
        body: "Your LEAF inbox — tasks assigned to you, pending approvals, and workflow actions waiting on your attention.",
        target: "#pmViewInboxBtn",
      },
      {
        title: "Projects Tab",
        body: "Your bird's-eye view of every active project — status, health, OKR associations, and % completion at a glance.",
        target: '[data-tab="projects"]',
      },
      {
        title: "Tasks Tab",
        body: "All tasks across every project in one place. Your primary workspace for day-to-day work.",
        target: '[data-tab="tasks"]',
      },
      {
        title: "Other Views: Kanban & Gantt",
        body: "Switch between Task Table, Kanban board, and Gantt timeline using these view buttons. Drag cards on the Kanban to update status — completion dates are recorded automatically.",
        target: ".pm-viewRow",
      },
      {
        title: "Analytics Tab",
        body: "Track completion trends by quarter and category, monitor schedule variance, and review project health summaries.",
        target: '[data-tab="analytics"]',
      },
      {
        title: "Filter Bar",
        body: "Narrow down tasks by Project, Status, Assigned To, Category, or Priority. Use multiple filters together. Hit Clear all filters to reset.",
        target: ".pm-filterRow",
      },
      {
        title: "You're all set!",
        body: "That covers the essentials. Click the <strong>tour</strong> icon in the toolbar anytime to replay this tour.",
        target: null,
      },
    ];

    var currentStep = 0;
    var overlay = document.getElementById("pmTourOverlay");
    var spotlight = document.getElementById("pmTourSpotlight");
    var tooltip = document.getElementById("pmTourTooltip");
    var stepLabel = document.getElementById("pmTourStepLabel");
    var titleEl = document.getElementById("pmTourTitle");
    var bodyEl = document.getElementById("pmTourBody");
    var backBtn = document.getElementById("pmTourBack");
    var nextBtn = document.getElementById("pmTourNext");
    var skipBtn = document.getElementById("pmTourSkip");
    var tourBtn = document.getElementById("pmTourBtn");

    if (!overlay || !tourBtn) return;

    function getTargetRect(selector) {
      if (!selector) return null;
      var el = document.querySelector(selector);
      if (!el) return null;
      var r = el.getBoundingClientRect();
      return { top: r.top, left: r.left, width: r.width, height: r.height };
    }

    function positionTooltip(rect) {
      var pad = 16;
      var tw = 300;
      var th = tooltip.offsetHeight || 160;
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var top, left;

      if (!rect) {
        top = (vh - th) / 2;
        left = (vw - tw) / 2;
      } else {
        if (rect.top + rect.height + pad + th < vh) {
          top = rect.top + rect.height + pad;
          left = rect.left;
        } else if (rect.top - pad - th > 0) {
          top = rect.top - pad - th;
          left = rect.left;
        } else {
          top = rect.top;
          left = rect.left + rect.width + pad;
        }
        left = Math.max(pad, Math.min(left, vw - tw - pad));
        top = Math.max(pad, Math.min(top, vh - th - pad));
      }

      tooltip.style.top = top + "px";
      tooltip.style.left = left + "px";
    }

    function showStep(index) {
      var step = steps[index];
      var total = steps.length;

      stepLabel.textContent =
        index === 0 || index === total - 1
          ? ""
          : "Step " + index + " of " + (total - 2);
      titleEl.textContent = step.title;
      bodyEl.innerHTML = step.body;
      backBtn.disabled = index === 0;
      nextBtn.textContent = index === total - 1 ? "Finish ✓" : "Next →";

      // getTargetRect returns null if selector is null or element not in DOM —
      // both cases fall back to centered tooltip with no spotlight
      var rect = getTargetRect(step.target);

      if (rect) {
        var pad = 8;
        spotlight.style.top = rect.top - pad + "px";
        spotlight.style.left = rect.left - pad + "px";
        spotlight.style.width = rect.width + pad * 2 + "px";
        spotlight.style.height = rect.height + pad * 2 + "px";
        spotlight.hidden = false;
      } else {
        spotlight.hidden = true;
        spotlight.style.width = "0";
        spotlight.style.height = "0";
      }

      positionTooltip(rect);
      nextBtn.focus();
    }

    function trapFocus(e) {
      if (overlay.hidden) return;
      var focusable = Array.from(
        tooltip.querySelectorAll("button:not([disabled])"),
      );
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.key === "Tab") {
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    function startTour() {
      currentStep = 0;
      overlay.hidden = false;
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", trapFocus);
      showStep(0);
    }

    function endTour() {
      overlay.hidden = true;
      document.body.style.overflow = "";
      document.removeEventListener("keydown", trapFocus);
      localStorage.setItem(TOUR_KEY, "1");
      if (tourBtn) tourBtn.focus();
    }

    nextBtn.addEventListener("click", function () {
      if (currentStep >= steps.length - 1) {
        endTour();
      } else {
        currentStep++;
        showStep(currentStep);
      }
    });

    backBtn.addEventListener("click", function () {
      if (currentStep > 0) {
        currentStep--;
        showStep(currentStep);
      }
    });

    skipBtn.addEventListener("click", endTour);

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) endTour();
    });

    document.addEventListener("keydown", function (e) {
      if (overlay.hidden) return;
      if (e.key === "Escape") {
        e.preventDefault();
        endTour();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        nextBtn.click();
      }
      if (e.key === "ArrowLeft" && !backBtn.disabled) {
        e.preventDefault();
        backBtn.click();
      }
    });

    tourBtn.addEventListener("click", startTour);

    window.addEventListener("resize", function () {
      if (!overlay.hidden) showStep(currentStep);
    });
  }

  var _silentRefreshTimer = null;

  function scheduleSilentRefresh(delayMs) {
    if (_silentRefreshTimer) clearTimeout(_silentRefreshTimer);
    _silentRefreshTimer = setTimeout(
      function () {
        _silentRefreshTimer = null;
        runSilentRefresh();
      },
      delayMs != null ? delayMs : 500,
    );
  }

  async function runSilentRefresh() {
    if (state._silentRefreshInProgress) return;
    state._silentRefreshInProgress = true;
    try {
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
          PROJECT_IND.ticketNumber,
          PROJECT_IND.projectEndDate,
          OKR_IND.okrKey,
          OKR_IND.objective,
          OKR_IND.startDate,
          OKR_IND.endDate,
          OKR_IND.fiscalYear,
        ],
        [],
      );
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
          TASK_IND.actualCompletionDate,
          TASK_IND.recurringCopied,
        ],
        [{ id: "categoryID", operator: "=", match: "form_9b302", gate: "AND" }],
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

      var projectRowsAll = coerceRows(results[0]) || [];
      var taskRowsAll = coerceRows(results[1]) || [];
      var keyResultRows = (coerceRows(results[2]) || []).filter(function (r) {
        return hasAnyIndicatorValue(r, [35, 36]);
      });

      var projectRows = projectRowsAll.filter(function (r) {
        return hasAnyS1Value(
          r,
          [2, 3, 4, 5, 6, 23, 24, 25, 26, 29, 32, 33, 37, 38],
        );
      });
      var taskRows = taskRowsAll.filter(function (r) {
        return hasAnyS1Value(
          r,
          [8, 9, 10, 44, 11, 12, 13, 14, 16, 17, 18, 30, 39, 47],
        );
      });

      // Update projects state
      state.projectsAll = projectRows.map(normalizeProject);
      state.projectsVersion = (state.projectsVersion || 0) + 1;
      state.cache.projects = new Map();
      state.renderState.projectsSig = "";
      state.renderState.analyticsMainSig = "";

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

      // Update tasks state
      state.tasksAll = taskRows.map(normalizeTask);
      state.tasksById = new Map();
      state.tasksAll.forEach(function (t) {
        state.tasksById.set(String(t.recordID), t);
      });
      state.keyResultsAll = keyResultRows.map(normalizeKeyResult);
      invalidateTaskCaches();

      // Refresh all dropdowns
      populateProjectKeyDropdown(state.projectsAll);
      populateProjectFiscalYearDropdown(state.projectsAll);
      populateProjectOwnerDropdown(state.projectsAll);
      populateProjectStatusDropdown(state.projectsAll);
      populateProjectTypeDropdown(state.projectsAll);
      populateOkrFiscalYearDropdown(state.projectsAll);
      populateAssigneeDropdown(state.tasksAll);
      populateCategoryDropdown(state.tasksAll);
      refreshStatusDropdown();

      // Always re-render the active tab
      applySearchAndFilters(true);
    } catch (e) {
      console.warn("pm-dashboard: runSilentRefresh failed", e);
    } finally {
      state._silentRefreshInProgress = false;
    }
  }

  /* ── Dark Mode ── */
  var DARK_MODE_KEY = "pm_dark_mode_v18";

  function isDarkMode() {
    try {
      return localStorage.getItem(DARK_MODE_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function refreshChartsForTheme(dark) {
    var tickColor = dark ? "#e2e8f0" : "#1f2933";
    var gridColor = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
    var chartKeys = Object.keys(state.charts || {});
    chartKeys.forEach(function (key) {
      var chart = state.charts[key];
      if (!chart) return;
      try {
        if (isChartV2()) {
          if (chart.options.scales.xAxes) {
            chart.options.scales.xAxes.forEach(function (axis) {
              if (axis.ticks) axis.ticks.fontColor = tickColor;
              if (axis.gridLines) axis.gridLines.color = gridColor;
            });
          }
          if (chart.options.scales.yAxes) {
            chart.options.scales.yAxes.forEach(function (axis) {
              if (axis.ticks) axis.ticks.fontColor = tickColor;
              if (axis.gridLines) axis.gridLines.color = gridColor;
            });
          }
        } else {
          if (chart.options.scales) {
            Object.keys(chart.options.scales).forEach(function (axisKey) {
              var axis = chart.options.scales[axisKey];
              if (axis.ticks) axis.ticks.color = tickColor;
              if (axis.grid) axis.grid.color = gridColor;
            });
          }
        }
        chart.update();
      } catch (e) {
        console.warn("pm-dashboard: refreshChartsForTheme failed for", key, e);
      }
    });

    // Force analytics to re-render so new charts pick up the right color
    state.renderState.analyticsMainSig = "";
    if (getActiveTab() === "analytics" && getAnalyticsView() === "main") {
      var analyticsTasks = getAnalyticsBaseTasks();
      renderAnalytics(analyticsTasks);
    }
  }

  function applyDarkMode(enabled) {
    document.body.classList.toggle("pm-dark", enabled);
    try {
      localStorage.setItem(DARK_MODE_KEY, enabled ? "1" : "0");
    } catch (e) {}
    refreshChartsForTheme(enabled);
  }

  function toggleDarkMode() {
    applyDarkMode(!isDarkMode());
  }

  function initDarkMode() {
    // Apply persisted preference immediately on load
    applyDarkMode(isDarkMode());

    // Button click
    var btn = document.getElementById("pmDarkModeBtn");
    if (btn) btn.addEventListener("click", toggleDarkMode);

    // Keyboard shortcut: Ctrl+Shift+Q
    document.addEventListener("keydown", function (e) {
      if (e.ctrlKey && e.shiftKey && e.key === "Q") {
        e.preventDefault();
        toggleDarkMode();
      }
    });
  }

  async function main() {
    try {
      flushTransferDebug();
      initDarkMode();
      wireTabs();
      wireTaskViewToggle();
      wireDevOnlyToggle();
      wireAnalyticsViewToggle();
      wireOkrTableViewToggle();
      wireSortingDelegation();
      loadFilterState();
      syncDateRangeBtnUI();
      initFilterControls();
      wireDateRangeFilter();
      wireClearFilters();
      wireOkrFilters();
      wireOkrRollupToggle();
      wireRecordModalLinks();
      wireSupportMessageListener();
      wireModalControls();
      wireDismissOverdueAlert();
      wireOtherStatusModal();
      wireAddButtons();
      fetchAndRenderInboxCount();
      wireRecurringFieldHider();
      wireAnalyticsSharedFilters();
      wireDrilldownCloseButtons();
      var recurringFilterBtn = document.getElementById("pmRecurringFilterBtn");
      if (recurringFilterBtn) {
        recurringFilterBtn.addEventListener("click", function () {
          state.recurringOnly = !state.recurringOnly;
          recurringFilterBtn.setAttribute(
            "aria-pressed",
            state.recurringOnly ? "true" : "false",
          );
          invalidateTaskCaches();
          applySearchAndFilters(true);
        });
      }
      wireJumpToTop();
      wireFeedbackWidget();
      initTour();

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
          PROJECT_IND.ticketNumber,
          PROJECT_IND.projectEndDate,
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
          TASK_IND.actualCompletionDate,
          TASK_IND.recurringCopied,
        ],
        [{ id: "categoryID", operator: "=", match: "form_9b302", gate: "AND" }],
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
          [8, 9, 10, 44, 11, 12, 13, 14, 16, 17, 18, 30, 39, 47],
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
      renderOverdueAlert();

      // Warn once if indicator 48 (recurringCopied) doesn't appear in any task row,
      // which likely means it hasn't been created in LEAF Form Editor yet.
      var ind48Key = "id" + TASK_IND.recurringCopied;
      var ind48Exists = taskRowsAll.some(function (r) {
        return r.s1 && r.s1[ind48Key] !== undefined;
      });
      if (!ind48Exists) {
        console.warn(
          "pm-dashboard: Indicator 48 (recurringCopied) may not be created in " +
            "LEAF Form Editor yet. Server-side recurring task deduplication will " +
            "not work until this indicator is added as a text field on the task form.",
        );
      }

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
      populateProjectOwnerDropdown(state.projectsAll);
      populateProjectStatusDropdown(state.projectsAll);
      populateProjectTypeDropdown(state.projectsAll);
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
      auditAllProjectStatuses();
    } catch (e) {
      console.error("Failed to load data.", e);
    } finally {
      await handleTransferFromSupport();
    }
  }

  document.addEventListener("DOMContentLoaded", main);
})();
