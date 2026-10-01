/*
 * MULTI-SITE LEAF GRID -- multigrid.js
 *
 * Host on the LEAF server and embed with:
 *   <div id="mst-root"></div>
 *   <script src="/custom/multigrid.js"
 *           data-user-id="<!--{$userID}-->" data-mount="mst-root"></script>
 *
 * data-user-id carries the Smarty-rendered value from the embedding .tpl --
 * Smarty placeholders don't render inside this external .js file, so it
 * must be passed in via the attribute. Omit data-mount to append to <body>.
 *
 * Optional attributes:
 *   data-trigger="<id>"      open the grid in a modal from that button
 *   data-compact="true"      smaller inline grid (Date / Request / Status)
 *   data-hero-target="<id>"  hero element whose layout classes are set by
 *                            applyLayout() (see "Hero layout" below)
 *   data-is-sysadmin="1"     enables the Alt+Shift+F first-time preview
 *
 * ASCII-only: non-ASCII bytes here have previously been corrupted by
 * deploy pipelines, silently breaking strings/comments. Keep it ASCII.
 *
 * All tabs render through the single renderDataTable() below rather
 * than mixing a third-party grid widget with hand-rolled HTML, so chrome
 * and sort behavior stay identical across tabs, including the merged ones
 * (which combine rows from more than one LEAF site).
 */
(function () {
  "use strict";

  // Smarty here uses plain { / } delimiters, not the <!--{ / }-->
  // convention data-user-id was written assuming (meant to degrade to
  // an HTML comment if ever served unprocessed) -- so <!-- and -->
  // render as literal static text around the real value, e.g. userID 42
  // renders as "<!---->42<!---->", not "42". Strips those markers
  // before the value is used.
  function stripSmartyCommentWrapper(raw) {
    return typeof raw === "string" ? raw.replace(/<!--|-->/g, "").trim() : raw;
  }

  // -- Resolve config from the embedding <script> tag's data-attributes --
  var thisScript = document.currentScript;
  var cfg = {
    userID: stripSmartyCommentWrapper(
      thisScript ? thisScript.dataset.userId : undefined,
    ),
    mountId: thisScript ? thisScript.dataset.mount : undefined,
    triggerId: thisScript ? thisScript.dataset.trigger : undefined,
    compact: !!(thisScript && thisScript.dataset.compact === "true"),
    heroTargetId: thisScript ? thisScript.dataset.heroTarget : undefined,
    isSysadmin: /^(1|true|yes)$/i.test(
      stripSmartyCommentWrapper(
        (thisScript && thisScript.dataset.isSysadmin) || "",
      ),
    ),
  };

  /*
   * SOURCE_SITES -- one entry per fetchable LEAF site (own recordID
   * sequence, own fetchSiteData() call). allRequestsLabel is this source's
   * "Site" value in the All Requests table; isLaunchpad:true switches to
   * the Date/Project/Status (Site Ready) column layout.
   */
  var SOURCE_SITES = {
    siteCreations: {
      url: "https://leaf.va.gov/launchpad/",
      name: "Site Creations",
      description: "LEAF sites you've requested",
      isLaunchpad: true,
      allRequestsLabel: "Site Creations",
    },
    serviceRequests: {
      url: "https://leaf.va.gov/platform/service_requests_launchpad/",
      name: "Service Requests",
      description:
        "your case studies, spotlight nominations, training requests, and feedback submissions",
      allRequestsLabel: "National Support",
    },
    support: {
      url: "https://leaf.va.gov/platform/support/",
      name: "Support",
      description: "your LEAF National consultation requests",
      allRequestsLabel: "National Support",
    },
    learn: {
      url: "https://leaf.va.gov/platform/learn/",
      name: "Learn",
      description: "your LEAF National learning requests",
      isLearn: true,
      allRequestsLabel: "National Support",
    },
    ideas: {
      url: "https://leaf.va.gov/platform/ideas/",
      name: "Ideas",
      description: "ideas you've submitted to improve LEAF",
      isIdeas: true,
      allRequestsLabel: "Ideas",
    },
    // Add more sources here
  };

  /*
   * TABS -- kind "all" aggregates every source into one table, "merged"
   * combines >1 source into one table (no per-row Source column), "single"
   * is one source/one table. Order here is tab display order.
   */
  var TABS = [
    {
      id: "all",
      name: "All Requests",
      kind: "all",
      sourceKeys: ["siteCreations", "serviceRequests", "support", "learn", "ideas"],
      description: "LEAF National requests",
    },
    {
      id: "siteCreations",
      name: "Site Creations",
      kind: "single",
      sourceKeys: ["siteCreations"],
    },
    {
      id: "nationalSupport",
      name: "National Support",
      kind: "merged",
      sourceKeys: ["serviceRequests", "support", "learn"],
      description: "support requests and consultations",
    },
    {
      id: "ideas",
      name: "Ideas",
      kind: "single",
      sourceKeys: ["ideas"],
    },
  ];

  // Prefer data-user-id (Smarty-rendered server-side, comment-wrapper
  // already stripped above); fall back to a `session` global if
  // present. A leftover "{$"/"{if" substring means Smarty never ran at
  // all (a different failure mode than the comment-wrapper one) --
  // still treated as invalid.
  var CURRENT_USER_ID =
    cfg.userID &&
    cfg.userID.indexOf("{$") === -1 &&
    cfg.userID.indexOf("{if") === -1
      ? cfg.userID
      : typeof session !== "undefined" && session && session.userID
        ? session.userID
        : cfg.userID;

  // -- Hero layout -------------------------------------------------------------
  // applyLayout() is the only code that sets the hero's layout classes:
  //   has-requests  user has records (stored hint until the data confirms)
  //   is-returning  two-column hero: records, not collapsed, not previewing
  //   is-preview    sysadmin first-time preview
  // Stored hints are applied before any fetch to avoid layout shift; the
  // fetched data then corrects hasRecords.
  // localStorage: only prevents layout shift and is always verified with data.
  var RETURNING_KEY = "lp-mst-returning:" + CURRENT_USER_ID;
  // sessionStorage: Hide should last only for the current browser session.
  var COLLAPSED_KEY = "lp-mst-collapsed:" + CURRENT_USER_ID;
  var HIDE_BTN_ID = "mst-hide-btn";
  var SHOW_BTN_ID = "mst-open-btn";
  var HEADING_ID = "hero-requests-h2";
  var heroTargetEl = cfg.heroTargetId
    ? document.getElementById(cfg.heroTargetId)
    : null;

  // Storage can be blocked (private mode, policy); fail silently. The
  // accessor itself can throw, so it is read inside the try.
  function storageGet(area, key) {
    try {
      return window[area].getItem(key);
    } catch (e) {
      return null;
    }
  }
  function storageSet(area, key, value) {
    try {
      if (value === null) window[area].removeItem(key);
      else window[area].setItem(key, value);
    } catch (e) {}
  }

  // Remove the collapsed hint older builds kept in localStorage. Never read
  // it: a stale value must not collapse the panel. Delete after launch.
  storageSet("localStorage", COLLAPSED_KEY, null);

  var layout = {
    hasRecords: storageGet("localStorage", RETURNING_KEY) === "1",
    collapsed: storageGet("sessionStorage", COLLAPSED_KEY) === "1",
    preview: false,
  };

  function applyLayout() {
    if (!heroTargetEl) return;
    var cl = heroTargetEl.classList;
    cl.toggle("has-requests", layout.hasRecords && !layout.preview);
    cl.toggle(
      "is-returning",
      layout.hasRecords && !layout.collapsed && !layout.preview,
    );
    cl.toggle("is-preview", layout.preview);
  }

  // Runs synchronously: the script tag sits right after the hero markup.
  applyLayout();

  // Same clear-then-set pattern as leaf_header.js, so repeats re-announce.
  function announce(msg) {
    var region = document.getElementById("lp-live-region");
    if (!region) return;
    region.textContent = "";
    setTimeout(function () {
      region.textContent = msg;
    }, 50);
  }

  function isShown(el) {
    return !!(el && el.getClientRects().length);
  }

  // Site Creations needs getData 17/21/22 (server/dir/site name) for the
  // Site Ready link. Ideas needs getData 12 (custom status field) and
  // excludes categoryID form_57e89 submissions, which shouldn't appear here.
  function myRecordsQuery(site) {
    var query = {
      terms: [
        { id: "userID", operator: "=", match: CURRENT_USER_ID, gate: "AND" },
        { id: "deleted", operator: "=", match: 0, gate: "AND" },
      ],
      joins: ["service", "status"],
      sort: { column: "recordID", direction: "DESC" },
      limit: 500,
      extraParams:
        "&x-filterData=recordID,userID,title,service,date,lastStatus,stepTitle,stepID,blockingStepID,submitted,deleted",
    };

    if (site && site.isLaunchpad) {
      query.getData = [17, 21, 22];
    }
    if (site && site.isIdeas) {
      query.getData = [12];
      query.terms.push({
        id: "categoryID",
        operator: "!=",
        match: "form_57e89",
        gate: "AND",
      });
    }

    return query;
  }

  // Escapes user-entered values before they're concatenated into markup.
  function escapeHTML(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  var NEW_TAB_SR = '<span class="sr-only">(opens in new tab)</span>';

  // Appended to the printview URL for the record modal's iframe.
  var RECORD_MODAL_PARAMS = "&iframe=1";

  // Shared MM/DD/YYYY formatter for all tabs (replaces old locale-dependent
  // toLocaleDateString() calls, so every tab's Date column matches).
  function formatDateMDY(epochSeconds) {
    if (!epochSeconds) return "";
    var d = new Date(epochSeconds * 1000);
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    return mm + "/" + dd + "/" + String(d.getFullYear());
  }

  // Status helpers: all per-origin Status logic lives here once and is
  // reused by every column builder, which is what keeps merged tabs safe.

  // Plain-text status -> HTML, with red-italic styling for "Not Submitted".
  function statusHTMLFor(text) {
    if (text === "Not Submitted") {
      return '<span class="mst-status-not-submitted">' + text + "</span>";
    }
    return "<span>" + escapeHTML(text) + "</span>";
  }

  // Ideas uses its custom id12 status field; Learn is self-paced, so it's
  // Completed once submitted. Service Requests/Support share lastStatus.
  // FLAG: those two can't be told apart once merged -- if either ever needs
  // its own status field, add a per-source branch here.
  function statusTextForSource(sourceKey, rec) {
    var source = SOURCE_SITES[sourceKey];
    if (source.isIdeas) {
      var v =
        rec && rec.s1 && rec.s1.id12 !== undefined && rec.s1.id12 !== null
          ? rec.s1.id12
          : "";
      return v || "Not Submitted";
    }
    if (source.isLearn) {
      // submitted can arrive as a string; Number() also maps null to 0.
      return rec && Number(rec.submitted) > 0 ? "Completed" : "In Progress";
    }
    return rec && rec.lastStatus ? rec.lastStatus : "Not Submitted";
  }

  // Site Ready link once s1.id17/id21/id22 are populated, else a dash.
  // Returns HTML directly (not via statusHTMLFor) since this is a button.
  // Site Ready link rule: a *.va.gov host (no port, path or @) plus plain
  // root/site path segments. Anything else falls back to "-".
  var SITE_READY_HOST_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.va\.gov$/i;
  var SITE_READY_SEGMENT_RE = /^[A-Za-z0-9_-]+$/;
  function isValidSiteReadyParts(host, root, site) {
    return (
      SITE_READY_HOST_RE.test(host) &&
      SITE_READY_SEGMENT_RE.test(root) &&
      SITE_READY_SEGMENT_RE.test(site)
    );
  }

  function launchpadStatusHTML(rec) {
    rec = rec || {};
    var s1 = rec.s1;
    if (
      s1 &&
      s1.id17 != null &&
      s1.id22 != null &&
      s1.id21 != null &&
      isValidSiteReadyParts(
        String(s1.id17).trim(),
        String(s1.id22),
        String(s1.id21),
      )
    ) {
      // Scheme is always https://; never taken from the data.
      var siteURL =
        "https://" +
        escapeHTML(String(s1.id17).trim()) +
        "/" +
        escapeHTML(s1.id22) +
        "/" +
        escapeHTML(s1.id21);
      return (
        '<a href="' +
        siteURL +
        '" class="mst-site-ready-btn" target="_blank" rel="noopener noreferrer">Site Ready' +
        NEW_TAB_SR +
        "</a>"
      );
    }
    return "-";
  }

  // All Requests' Status column: routes to launchpadStatusHTML for Site
  // Creations rows, the generic/Ideas text logic for everything else.
  function allRequestsStatusHTML(sourceKey, rec) {
    var source = SOURCE_SITES[sourceKey];
    if (source.isLaunchpad) return launchpadStatusHTML(rec);
    return statusHTMLFor(statusTextForSource(sourceKey, rec));
  }

  // Sort key for Launchpad Status: no numeric/text value exists, just
  // "has a Site Ready link" or not.
  function launchpadStatusSortValue(rec) {
    return launchpadStatusHTML(rec) === "-" ? "-" : "Site Ready";
  }

  // Shared "badge recordID + title link" cell used by every Request/Project
  // column. The badge is tabindex="-1" so keyboard users reach one link per row.
  // Both open leaf_header.js's shared form modal (data-action="form-modal");
  // href stays as the Ctrl/Cmd/Shift/middle-click fallback.
  function requestCellHTML(link, recordID, title) {
    var attrs =
      ' href="' +
      escapeHTML(link) +
      '" data-action="form-modal" data-modal-src="' +
      escapeHTML(link + RECORD_MODAL_PARAMS) +
      '" data-modal-title="' +
      escapeHTML("Request #" + recordID + ": " + title) +
      '"';
    return (
      '<span class="mst-lp-recid"><a' +
      attrs +
      ' tabindex="-1">' +
      escapeHTML(recordID) +
      "</a></span> <a" +
      attrs +
      ">" +
      escapeHTML(title) +
      "</a>"
    );
  }

  // Material Symbols arrow icons, inlined per this codebase's convention
  // (bare svg, sized via CSS on the containing .mst-sort-btn class).
  var SORT_ASC_SVG =
    '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M440-160v-487L216-423l-56-57 320-320 320 320-56 57-224-224v487h-80Z"/></svg>';
  var SORT_DESC_SVG =
    '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M440-800v487L216-537l-56 57 320 320 320-320-56-57-224 224v-487h-80Z"/></svg>';

  // -- Column definitions: one builder per table shape --
  // Each column has getValue(row) (plain value, for sorting) and
  // render(row) (cell HTML) -- split so richly-marked-up cells can still
  // sort on plain text.

  // Shared 3-column layout (Date Initiated, Request, Status) for National
  // Support and Ideas, using requestCellHTML() so all tabs match.
  function buildGenericColumns() {
    return [
      {
        name: "Date Initiated",
        getValue: function (row) {
          return row.dateEpoch;
        },
        render: function (row) {
          return formatDateMDY(row.rec.date);
        },
      },
      {
        name: "Request",
        // Sorts by title, not recordID -- recordIDs are independent per
        // site, so a numeric sort is meaningless once sources are merged.
        getValue: function (row) {
          return (row.rec.title || "").toLowerCase();
        },
        render: function (row) {
          return requestCellHTML(row.link, row.recordID, row.rec.title || "");
        },
      },
      {
        name: "Status",
        getValue: function (row) {
          return statusTextForSource(row.sourceKey, row.rec);
        },
        render: function (row) {
          return statusHTMLFor(statusTextForSource(row.sourceKey, row.rec));
        },
      },
    ];
  }

  // Site Creations layout: Date, Project, Status. FLAG: Status here is a
  // "Site Ready" link/dash, not status text -- the one cell that
  // legitimately differs in content from the other tabs' Status column.
  function buildLaunchpadColumns() {
    return [
      {
        name: "Date",
        getValue: function (row) {
          return row.dateEpoch;
        },
        render: function (row) {
          return formatDateMDY(row.rec.date);
        },
      },
      {
        name: "Project",
        getValue: function (row) {
          return (row.rec.title || "").toLowerCase();
        },
        render: function (row) {
          return requestCellHTML(row.link, row.recordID, row.rec.title || "");
        },
      },
      {
        name: "Status",
        getValue: function (row) {
          return launchpadStatusSortValue(row.rec);
        },
        render: function (row) {
          return launchpadStatusHTML(row.rec);
        },
      },
    ];
  }

  // All Requests layout: Date, Site, Request, Status -- Status routes by
  // source origin via allRequestsStatusHTML() rather than re-deriving logic here.
  function buildAllRequestsColumns() {
    return [
      {
        name: "Date",
        getValue: function (row) {
          return row.dateEpoch;
        },
        render: function (row) {
          return formatDateMDY(row.rec.date);
        },
      },
      {
        name: "Site",
        getValue: function (row) {
          return row.site.allRequestsLabel;
        },
        render: function (row) {
          return row.site.allRequestsLabel;
        },
      },
      {
        name: "Request",
        getValue: function (row) {
          return (row.rec.title || "").toLowerCase();
        },
        render: function (row) {
          return requestCellHTML(row.link, row.recordID, row.rec.title || "");
        },
      },
      {
        name: "Status",
        getValue: function (row) {
          var source = SOURCE_SITES[row.sourceKey];
          return source.isLaunchpad
            ? launchpadStatusSortValue(row.rec)
            : statusTextForSource(row.sourceKey, row.rec);
        },
        render: function (row) {
          return allRequestsStatusHTML(row.sourceKey, row.rec);
        },
      },
    ];
  }

  // Compact layout (data-compact): Date, Request (with site label beneath),
  // Status. Sort values match buildAllRequestsColumns().
  function buildCompactColumns() {
    var all = buildAllRequestsColumns();
    var request = all[2];
    return [
      all[0],
      {
        name: "Request",
        getValue: request.getValue,
        render: function (row) {
          return (
            request.render(row) +
            '<span class="mst-site">' +
            row.site.allRequestsLabel +
            "</span>"
          );
        },
      },
      all[3],
    ];
  }

  // -- Runtime --

  var siteState = {}; // keyed by source.url -- { data, rendered, error, loading }
  var mstRootEl = null; // set by buildShell -- the container passed to buildAndLoadGrid
  var sortState = {}; // keyed by tab.id -- { columnIndex, direction }
  var activeTabIdx = 0; // source of truth for the active tab; DOM is re-synced from it

  function stateKey(source) {
    return source.url;
  }

  function isSourcePending(key) {
    var s = siteState[stateKey(SOURCE_SITES[key])];
    return !s || (!s.data && !s.error);
  }
  function isSourceErrored(key) {
    var s = siteState[stateKey(SOURCE_SITES[key])];
    return !!(s && s.error);
  }

  // Shown in place of a table until a tab has anything to show. Visible
  // text only: aria-busy marks the panels and the live region reports the
  // outcome (see updateBusy/announceLoadResult).
  var LOADING_HTML =
    '<p class="mst-loading">Loading your requests&hellip;</p>';

  // One message per failed source, then a single Retry for all failed sources.
  function errorBlockHTML(erroredKeys) {
    if (!erroredKeys.length) return "";
    return (
      '<div class="mst-error">' +
      erroredKeys
        .map(function (k) {
          return (
            '<p class="ip-error">Error loading data from ' +
            SOURCE_SITES[k].url +
            ". Check your network access and permissions.</p>"
          );
        })
        .join("") +
      '<button type="button" class="mst-retry-btn">Retry</button>' +
      "</div>"
    );
  }

  async function fetchSiteData(site) {
    var rawQuery = myRecordsQuery(site);
    var extraParams = rawQuery.extraParams || "";
    var query = Object.assign({}, rawQuery);
    delete query.extraParams;

    // Always raw fetch, never LeafFormQuery: a spliced route can define that
    // global mid-session, and a retry must behave like the first load.
    var results = {};
    var batchSize = query.limit || 500;
    var offset = 0;

    while (true) {
      var pagedQuery = Object.assign({}, query, {
        limit: batchSize,
        limitOffset: offset,
      });
      var resp = await fetch(
        site.url +
          "api/form/query?q=" +
          encodeURIComponent(JSON.stringify(pagedQuery)) +
          extraParams,
        { credentials: "include" },
      );
      if (!resp.ok) {
        throw new Error("HTTP " + resp.status + " from " + site.url);
      }

      var batch = await resp.json();

      if (batch && typeof batch === "object" && !Array.isArray(batch)) {
        Object.assign(results, batch);
      }

      var leafHeader =
        resp.headers.get("LEAF-Query") || resp.headers.get("leaf-query") || "";
      var batchCount =
        batch && typeof batch === "object" && !Array.isArray(batch)
          ? Object.keys(batch).length
          : 0;

      if (batchCount < batchSize && leafHeader !== "continue") {
        break;
      }
      offset += batchSize;
    }

    return results;
  }

  // Row key is `${site.url}__${recordID}` -- recordIDs aren't globally
  // unique since each LEAF site has its own independent sequence.
  function rowsForSource(sourceKey) {
    var source = SOURCE_SITES[sourceKey];
    var state = siteState[stateKey(source)];
    if (!state || !state.data) return [];
    return Object.keys(state.data).map(function (recordID) {
      var rec = state.data[recordID] || {};
      return {
        key: source.url + "__" + recordID,
        recordID: recordID,
        sourceKey: sourceKey,
        site: source,
        rec: rec,
        dateEpoch: rec.date || 0,
        link: source.url + "index.php?a=printview&recordID=" + recordID,
      };
    });
  }

  function rowsForSources(sourceKeys) {
    var rows = [];
    sourceKeys.forEach(function (k) {
      rows = rows.concat(rowsForSource(k));
    });
    return rows;
  }

  // Shared table renderer used by all tabs. Header is a real <button>
  // (Enter/Space work without extra keyboard handling); aria-sort on the
  // <th> tracks state. Sort state persists per tab.id so switching tabs
  // doesn't reset the user's chosen sort.
  function renderDataTable(bodyEl, tableId, columns, rows, opts) {
    opts = opts || {};
    var state = sortState[tableId];
    if (!state) {
      state = {
        columnIndex: opts.defaultSortIndex != null ? opts.defaultSortIndex : 0,
        direction: opts.defaultSortDir || "desc",
      };
      sortState[tableId] = state;
    }

    function sortedRows() {
      var col = columns[state.columnIndex];
      if (!col) return rows;
      var copy = rows.slice();
      copy.sort(function (a, b) {
        var va = col.getValue(a);
        var vb = col.getValue(b);
        var cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return state.direction === "asc" ? cmp : -cmp;
      });
      return copy;
    }

    function draw() {
      var sorted = sortedRows();

      var headHTML = columns
        .map(function (col, i) {
          var dir = i === state.columnIndex ? state.direction : null;
          var ariaSort =
            dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none";
          // No icon for unsorted state -- aria-sort on the <th> is the
          // source of truth for AT users; the icon is sighted-user only.
          var iconHTML = "";
          if (dir === "asc") {
            iconHTML =
              '<span class="material-symbols-outlined" aria-hidden="true">' +
              SORT_ASC_SVG +
              "</span>";
          } else if (dir === "desc") {
            iconHTML =
              '<span class="material-symbols-outlined" aria-hidden="true">' +
              SORT_DESC_SVG +
              "</span>";
          }
          return (
            '<th scope="col" aria-sort="' +
            ariaSort +
            '">' +
            '<button type="button" class="mst-sort-btn" data-col-index="' +
            i +
            '">' +
            col.name +
            iconHTML +
            "</button></th>"
          );
        })
        .join("");

      var rowsHTML = sorted
        .map(function (row) {
          return (
            '<tr data-rowkey="' +
            escapeHTML(row.key) +
            '">' +
            columns
              .map(function (col) {
                return "<td>" + col.render(row) + "</td>";
              })
              .join("") +
            "</tr>"
          );
        })
        .join("");

      if (!sorted.length) {
        rowsHTML =
          '<tr><td colspan="' +
          columns.length +
          '" class="mst-empty">No records found.</td></tr>';
      }

      var tableClass = "ip-table" + (opts.extraTableClass ? " " + opts.extraTableClass : "");
      // Focusable region so keyboard users can scroll the compact table.
      var wrapAttrs = cfg.compact
        ? ' tabindex="0" role="region" aria-label="Your requests, scrollable"'
        : "";
      var tableHTML =
        '<div class="ip-tableWrap"' +
        wrapAttrs +
        '><table class="' +
        tableClass +
        '"><thead><tr>' +
        headHTML +
        "</tr></thead><tbody>" +
        rowsHTML +
        "</tbody></table></div>";

      bodyEl.innerHTML = (opts.beforeHTML || "") + tableHTML + (opts.afterHTML || "");

      bodyEl.querySelectorAll(".mst-sort-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var idx = parseInt(btn.getAttribute("data-col-index"), 10);
          if (state.columnIndex === idx) {
            state.direction = state.direction === "asc" ? "desc" : "asc";
          } else {
            state.columnIndex = idx;
            state.direction = "asc";
          }
          draw();
          var refocus = bodyEl.querySelectorAll(".mst-sort-btn")[idx];
          if (refocus) refocus.focus();
        });
      });
    }

    draw();
  }

  // -- Single-source tab (Site Creations, Ideas) ---------------------------
  function renderSingleSourceTab(tab, bodyEl) {
    var sourceKey = tab.sourceKeys[0];
    var source = SOURCE_SITES[sourceKey];
    var state = siteState[stateKey(source)];
    if (!state) return;

    if (state.error) {
      bodyEl.innerHTML = errorBlockHTML([sourceKey]);
      return;
    }
    if (!state.data) {
      bodyEl.innerHTML = LOADING_HTML;
      return;
    }

    var rows = rowsForSource(sourceKey);
    var columns = cfg.compact
      ? buildCompactColumns()
      : source.isLaunchpad
        ? buildLaunchpadColumns()
        : buildGenericColumns();
    renderDataTable(bodyEl, tab.id, columns, rows, {
      defaultSortIndex: 0,
      defaultSortDir: "desc",
      extraTableClass: cfg.compact ? "mst-table-compact" : "",
    });
  }

  // Renders whatever's already resolved per source and appends a
  // pending/error banner, rather than blocking on the slowest fetch.
  function renderMergedTab(tab, bodyEl, columns) {
    var rows = rowsForSources(tab.sourceKeys);
    var erroredKeys = tab.sourceKeys.filter(isSourceErrored);
    var pending = tab.sourceKeys.some(isSourcePending);

    // Nothing settled yet: a loading message, not an empty "No records" table.
    if (tab.sourceKeys.every(isSourcePending)) {
      bodyEl.innerHTML = LOADING_HTML;
      return;
    }

    var beforeHTML = errorBlockHTML(erroredKeys);
    var afterHTML = pending
      ? '<p class="mst-loading-more">Loading more requests&hellip;</p>'
      : "";

    renderDataTable(bodyEl, tab.id, columns, rows, {
      defaultSortIndex: 0,
      defaultSortDir: "desc",
      beforeHTML: beforeHTML,
      afterHTML: afterHTML,
      extraTableClass: cfg.compact
        ? "mst-table-compact"
        : tab.kind === "all"
          ? "mst-table-all"
          : "",
    });
  }

  // -- Tab dispatch ----------------------------------------------------------
  function renderTabContent(tabIndex) {
    var tab = TABS[tabIndex];
    var bodyEl = mstRootEl && mstRootEl.querySelector("#mst-body-" + tabIndex);
    if (!tab || !bodyEl) return;

    if (tab.kind === "single") {
      renderSingleSourceTab(tab, bodyEl);
    } else if (cfg.compact) {
      renderMergedTab(tab, bodyEl, buildCompactColumns());
    } else if (tab.kind === "merged") {
      renderMergedTab(tab, bodyEl, buildGenericColumns());
    } else if (tab.kind === "all") {
      renderMergedTab(tab, bodyEl, buildAllRequestsColumns());
    }
  }

  function getActiveTabIndex() {
    return activeTabIdx;
  }

  // Scoped to mstRootEl: other pages (e.g. the Ideas route) reuse the
  // .ip-tab/.ip-panel classes, and this must never touch theirs.
  // Also re-asserts state: exactly one active tab and panel.
  function activateTab(idx) {
    if (!mstRootEl) return;
    activeTabIdx = idx;
    mstRootEl.querySelectorAll(".ip-tab").forEach(function (btn, i) {
      var active = i === idx;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
      btn.setAttribute("tabindex", active ? "0" : "-1");
    });
    mstRootEl.querySelectorAll(".ip-panel").forEach(function (panel, i) {
      panel.classList.toggle("is-active", i === idx);
    });
    updateSiteSummaryForTab(idx);
    renderTabContent(idx);
  }

  // Summary line: "<Tab Name> -- Showing N <description>". Single-source
  // tabs show an exact count; merged/all tabs show a running total with a
  // "+" suffix while sources are still pending.
  function updateSiteSummaryForTab(idx) {
    var el = mstRootEl && mstRootEl.querySelector("#mst-site-summary");
    if (!el) return;
    var tab = TABS[idx];
    if (!tab) return;

    var name, description, countText;

    if (tab.kind === "single") {
      var source = SOURCE_SITES[tab.sourceKeys[0]];
      var state = siteState[stateKey(source)];
      name = source.name;
      description = source.description;
      countText =
        state && state.data ? String(Object.keys(state.data).length) : "...";
    } else {
      name = tab.name;
      description = tab.description;
      var loadedCount = 0;
      var anyLoaded = false;
      tab.sourceKeys.forEach(function (k) {
        var s = siteState[stateKey(SOURCE_SITES[k])];
        if (s && s.data) {
          loadedCount += Object.keys(s.data).length;
          anyLoaded = true;
        }
      });
      var pending = tab.sourceKeys.some(isSourcePending);
      countText = anyLoaded
        ? String(loadedCount) + (pending ? "+" : "")
        : "...";
    }

    el.innerHTML =
      '<span class="mst-site-summary-name">' +
      name +
      "</span>" +
      '<span class="mst-site-summary-sep"> -- </span>' +
      '<span class="mst-site-summary-desc">Showing ' +
      countText +
      " " +
      (description || "") +
      "</span>";
  }

  function buildShell(rootEl) {
    mstRootEl = rootEl;
    activeTabIdx = 0;
    rootEl.innerHTML =
      '<div class="smarty-root">' +
      '<div class="ip-wrap">' +
      '<p class="mst-help-text mst-help-sites">Select a tab to view your LEAF National requests.</p>' +
      '<div class="ip-tabsRow"><ul class="ip-tabs" id="mst-tablist" role="tablist" aria-label="LEAF Sites" style="list-style:none; margin:0;"></ul></div>' +
      '<p class="mst-site-summary" id="mst-site-summary"></p>' +
      '<div id="mst-panels"></div>' +
      "</div>" +
      "</div>";

    var tabList = rootEl.querySelector("#mst-tablist");
    var panelsRoot = rootEl.querySelector("#mst-panels");

    TABS.forEach(function (tab, i) {
      var li = document.createElement("li");
      li.setAttribute("role", "presentation");
      li.style.margin = "0";

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ip-tab" + (i === 0 ? " is-active" : "");
      btn.id = "mst-tab-" + i;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", i === 0 ? "true" : "false");
      btn.setAttribute("aria-controls", "mst-panel-" + i);
      btn.setAttribute("tabindex", i === 0 ? "0" : "-1");
      btn.textContent = tab.name;

      btn.addEventListener(
        "click",
        (function (idx) {
          return function () {
            activateTab(idx);
          };
        })(i),
      );

      btn.addEventListener(
        "keydown",
        (function (idx) {
          return function (e) {
            var next = idx;
            if (e.key === "ArrowRight") {
              next = (idx + 1) % TABS.length;
            } else if (e.key === "ArrowLeft") {
              next = (idx - 1 + TABS.length) % TABS.length;
            } else {
              return;
            }
            e.preventDefault();
            activateTab(next);
            mstRootEl.querySelector("#mst-tab-" + next).focus();
          };
        })(i),
      );

      li.appendChild(btn);
      tabList.appendChild(li);
    });

    TABS.forEach(function (tab, i) {
      var panel = document.createElement("div");
      panel.className = "ip-panel" + (i === 0 ? " is-active" : "");
      panel.id = "mst-panel-" + i;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", "mst-tab-" + i);

      panel.innerHTML = '<div id="mst-body-' + i + '"></div>';
      panelsRoot.appendChild(panel);
    });
  }

  // -- Modal shell: overlay, focus trap, Escape-to-close, focus return --------
  // Only used with data-trigger; the Launchpad home pages mount inline instead.
  var modalState = {
    overlay: null,
    bodyEl: null,
    lastFocused: null,
    built: false, // grid shell + data fetch kicked off
    keydownHandler: null,
  };

  function buildModalShell() {
    var overlay = document.createElement("div");
    overlay.className = "mst-modal-overlay";
    overlay.id = "mst-modal-overlay";
    overlay.hidden = true;

    overlay.innerHTML =
      '<div class="mst-modal" role="dialog" aria-modal="true" aria-labelledby="mst-modal-title">' +
      '<div class="mst-modal-hd">' +
      '<h2 class="mst-modal-title" id="mst-modal-title">View My Requests (LEAF National Requests)</h2>' +
      '<button type="button" class="mst-modal-close" id="mst-modal-close" aria-label="Close dialog">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>' +
      "</button>" +
      "</div>" +
      '<div class="mst-modal-body" id="mst-modal-body"></div>' +
      "</div>";

    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });
    overlay
      .querySelector("#mst-modal-close")
      .addEventListener("click", closeModal);

    modalState.overlay = overlay;
    modalState.bodyEl = overlay.querySelector("#mst-modal-body");
    modalState.bodyEl.classList.add("mst-container");
    wireRetry(modalState.bodyEl);
  }

  function getFocusable(container) {
    return Array.prototype.slice
      .call(
        container.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ),
      )
      .filter(function (el) {
        return el.offsetParent !== null;
      });
  }

  function trapFocus(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
      return;
    }
    if (e.key !== "Tab") return;

    var focusable = getFocusable(modalState.overlay);
    if (focusable.length === 0) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  async function openModal() {
    if (!modalState.overlay) buildModalShell();

    modalState.lastFocused = document.activeElement;
    modalState.overlay.hidden = false;
    document.body.style.overflow = "hidden";

    modalState.keydownHandler = trapFocus;
    document.addEventListener("keydown", modalState.keydownHandler);

    if (!modalState.built) {
      modalState.built = true;
      await buildAndLoadGrid(modalState.bodyEl);
    }

    var focusable = getFocusable(modalState.overlay);
    (
      focusable[0] || modalState.overlay.querySelector(".mst-modal-close")
    ).focus();
  }

  function closeModal() {
    if (!modalState.overlay || modalState.overlay.hidden) return;
    modalState.overlay.hidden = true;
    document.body.style.overflow = "";
    if (modalState.keydownHandler) {
      document.removeEventListener("keydown", modalState.keydownHandler);
    }
    if (
      modalState.lastFocused &&
      typeof modalState.lastFocused.focus === "function"
    ) {
      modalState.lastFocused.focus();
    }
  }

  // -- Inject scoped stylesheet once -------------------------------------------
  function injectStyles() {
    if (document.getElementById("mst-styles")) return;
    var style = document.createElement("style");
    style.id = "mst-styles";
    style.textContent = [
      ".mst-container{color-scheme:light;}",
      ".mst-container *{box-sizing:border-box;}",
      '.mst-container .ip-wrap{max-width:var(--max,1200px);margin:0 auto;padding:0 8px;font-family:"Source Sans 3","Source Sans Pro",sans-serif;color:var(--c-text,#1b1b1b);}',
      ".mst-container .ip-header{display:none;}",
      ".mst-container .ip-panelDesc{font-size:0.875rem;color:var(--c-muted,#3d4551);margin:0 0 0.5rem 0;line-height:1.5;}",
      ".mst-container .ip-tab:focus-visible,.mst-container .ip-table td a:focus-visible{outline:3px solid var(--lp-accent,#005ea2);outline-offset:2px;}",
      ".mst-container .ip-tabs{display:inline-flex;gap:6px;padding:6px;background:var(--lp-bg-alt,#eff6fb);border-radius:999px;border:1px solid var(--c-blue10,#d9e8f6);}",
      ".mst-container .ip-tabsRow{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:6px;flex-wrap:wrap;}",
      '.mst-container .ip-tab{border:0;background:transparent;padding:8px 16px;border-radius:999px;font-family:"Public Sans",sans-serif;font-weight:700;font-size:16px;cursor:pointer;color:var(--c-muted,#3d4551);border-bottom:3px solid transparent;transition:border-color .2s,color .2s;}',
      ".mst-container .ip-tab.is-active{background:var(--lp-bg,#fff);color:var(--lp-accent,#005ea2);box-shadow:0 2px 8px rgba(0,10,40,.06);border-bottom:3px solid var(--lp-accent,#005ea2);}",
      ".mst-container .ip-tab:hover:not(.is-active){border-bottom:3px solid var(--c-blue20,#aacdec);color:var(--lp-hl,#1a4480);}",
      ".mst-container .ip-panel{display:none;}",
      ".mst-container .ip-panel.is-active{display:block;}",
      ".mst-container .ip-tableWrap{background:var(--lp-bg,#fff);border-radius:var(--r-lg,8px);padding:20px;box-shadow:0 2px 8px rgba(0,10,40,.06);border:1px solid var(--c-blue10,#d9e8f6);overflow-x:auto;width:100%;}",

      // Shared table chrome -- identical header, borders, padding, striping across tabs.
      ".mst-container .ip-table{width:100%;border-collapse:collapse;table-layout:auto;background:#fff;min-width:840px;font-size:16px;}",
      ".mst-container .ip-table td{border:1px solid var(--c-gray20,#c9c9c9);padding:10px;vertical-align:top;word-wrap:break-word;overflow-wrap:anywhere;text-align:left;}",
      '.mst-container .ip-table th{border:1px solid var(--c-gray20,#c9c9c9);padding:0;vertical-align:top;text-align:left;background:var(--c-blue10,#d9e8f6);font-family:"Public Sans",sans-serif;font-weight:700;color:var(--lp-hl,#1a4480);user-select:none;}',
      ".mst-container .ip-table tbody tr:nth-child(even){background:var(--c-gray5,#f0f0f0);}",
      ".mst-container .ip-table tbody tr:hover{background:var(--lp-bg-alt,#eff6fb);}",
      ".mst-container .ip-table td a{color:var(--lp-accent,#005ea2);text-decoration:none;}",
      ".mst-container .ip-table td a:hover{text-decoration:underline;}",
      ".mst-container .ip-error{color:#b91c1c;font-size:14px;font-weight:600;}",
      ".mst-container .mst-loading{margin:10px 0;font-size:0.875rem;color:var(--c-muted,#3d4551);}",
      ".mst-container .mst-error{display:flex;flex-direction:column;align-items:flex-start;gap:8px;margin:0 0 10px;}",
      ".mst-container .mst-error .ip-error{margin:0;overflow-wrap:anywhere;}",
      ".mst-container .mst-retry-btn{display:inline-flex;align-items:center;min-height:32px;padding:6px 14px;border-radius:var(--r,5px);border:1px solid var(--c-blue20,#aacdec);background:var(--lp-bg-alt,#eff6fb);color:var(--lp-accent,#005ea2);font:inherit;font-weight:700;cursor:pointer;}",
      ".mst-container .mst-retry-btn:hover{background:var(--c-blue10,#d9e8f6);}",
      ".mst-container .mst-retry-btn:focus-visible{outline:3px solid var(--lp-accent,#005ea2);outline-offset:2px;}",
      ".mst-container .mst-status-not-submitted{color:#b91c1c;font-style:italic;font-size:0.875em;}",
      ".mst-container .mst-empty{text-align:center;color:var(--c-muted,#3d4551);}",

      // Real <button> header controls handle Enter/Space activation natively.
      '.mst-container .mst-sort-btn{display:flex;align-items:center;gap:4px;width:100%;border:0;background:transparent;color:inherit;font:inherit;font-weight:700;text-align:left;cursor:pointer;padding:10px;}',
      ".mst-container .mst-sort-btn:hover{background:var(--c-blue20,#aacdec);}",
      ".mst-container .mst-sort-btn:focus-visible{outline:3px solid var(--lp-accent,#005ea2);outline-offset:-3px;}",
      // Sized via the containing .mst-sort-btn class (same technique as
      // .hero-kicker/.btn/.feat-ico icons in view_homepage.tpl).
      ".mst-container .mst-sort-btn .material-symbols-outlined svg{width:1rem;height:1rem;}",

      /* -- Launchpad-specific column styling -- */
      ".mst-container .mst-lp-recid a{display:inline-flex;align-items:center;justify-content:center;padding:4px 10px;background:var(--c-text,#1b1b1b);color:#fff !important;border-radius:var(--r,5px);font-weight:900;font-size:1em;line-height:1;text-decoration:none;text-align:center;}",
      ".mst-container .mst-lp-recid a:hover,.mst-container .mst-lp-recid a:focus{background:var(--c-muted,#3d4551);color:#fff !important;}",
      ".mst-container .mst-site-ready-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:var(--r,5px);border:1px solid var(--c-blue20,#aacdec);background:var(--lp-bg-alt,#eff6fb);color:var(--lp-accent,#005ea2);font-weight:700;text-decoration:none;}",
      ".mst-container .mst-site-ready-btn:hover{background:var(--c-blue10,#d9e8f6);text-decoration:none;}",
      ".mst-container .mst-site-ready-btn:focus-visible{outline:3px solid var(--lp-accent,#005ea2);outline-offset:2px;}",

      // Date/Site/Status fixed-width & non-wrapping, Request flexible & wraps --
      // same nth-child + width/white-space technique used elsewhere in .ip-table.
      ".mst-container .mst-table-all th:nth-child(1),.mst-container .mst-table-all td:nth-child(1){width:110px;white-space:nowrap;}",
      ".mst-container .mst-table-all th:nth-child(2),.mst-container .mst-table-all td:nth-child(2){width:140px;white-space:nowrap;}",
      ".mst-container .mst-table-all th:nth-child(3),.mst-container .mst-table-all td:nth-child(3){width:auto;white-space:normal;word-wrap:break-word;overflow-wrap:break-word;}",
      ".mst-container .mst-table-all th:nth-child(4),.mst-container .mst-table-all td:nth-child(4){width:130px;white-space:nowrap;}",

      /* -- Partial-loading indicator (All Requests / National Support) -- */
      ".mst-container .mst-loading-more{margin:10px 0 0;font-size:0.875rem;font-style:italic;color:var(--c-muted,#3d4551);}",

      "@media (max-width:780px){.mst-container .ip-tabs{width:100%;flex-wrap:wrap;justify-content:center;}.mst-container .ip-tabsRow{justify-content:center;}.mst-container .ip-table{display:block;overflow-x:auto;white-space:nowrap;}}",

      /* -- Compact inline grid (data-compact) -- */
      ".mst-container.mst-compact{container-type:inline-size;}",
      ".mst-container.mst-compact .mst-help-text{display:none;}",
      ".mst-container.mst-compact .ip-wrap{padding:0;max-width:none;}",
      ".mst-container.mst-compact .ip-tabs{display:flex;flex-wrap:wrap;gap:4px;padding:5px;border-radius:var(--r-lg,8px);}",
      ".mst-container.mst-compact .ip-tab{padding:6px 12px;font-size:.875rem;}",
      ".mst-container.mst-compact .ip-tableWrap{position:relative;max-height:340px;overflow:auto;padding:0;}",
      ".mst-container.mst-compact .ip-tableWrap:focus-visible{outline:3px solid var(--lp-accent,#005ea2);outline-offset:2px;}",
      // Beats the 780px rule above that turns .ip-table into a nowrap block.
      ".mst-container.mst-compact .ip-table{display:table;white-space:normal;min-width:0;font-size:.9rem;}",
      ".mst-container.mst-compact .ip-table thead th{position:sticky;top:0;z-index:1;}",
      ".mst-container.mst-compact .mst-site{display:block;font-size:.78rem;color:var(--c-muted,#3d4551);}",
      ".mst-container .mst-table-compact th:nth-child(1),.mst-container .mst-table-compact td:nth-child(1){white-space:nowrap;width:1%;}",
      ".mst-container .mst-table-compact th:nth-child(3),.mst-container .mst-table-compact td:nth-child(3){white-space:nowrap;}",
      // At 480px and under, Status wraps between words so Request gets the width.
      "@container (max-width:480px){.mst-container.mst-compact .ip-tab{padding:6px 10px;}.mst-container.mst-compact .ip-tableWrap{max-height:300px;}.mst-container.mst-compact .mst-table-compact th:nth-child(3),.mst-container.mst-compact .mst-table-compact td:nth-child(3){white-space:normal;overflow-wrap:break-word;}.mst-container.mst-compact .mst-site-ready-btn{padding:6px 8px;text-align:center;}}",
      "@media (max-width:480px){.mst-container.mst-compact .ip-tab{padding:6px 10px;}.mst-container.mst-compact .ip-tableWrap{max-height:300px;}.mst-container.mst-compact .mst-table-compact th:nth-child(3),.mst-container.mst-compact .mst-table-compact td:nth-child(3){white-space:normal;overflow-wrap:break-word;}.mst-container.mst-compact .mst-site-ready-btn{padding:6px 8px;text-align:center;}}",

      /* -- Modal shell -- */
      ".mst-modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;z-index:1000;}",
      ".mst-modal-overlay[hidden]{display:none;}",
      ".mst-modal{background:var(--lp-bg,#fff);border-radius:var(--r-lg,8px);max-width:1200px;width:100%;max-height:calc(100vh - 80px);box-shadow:0 20px 60px rgba(0,0,0,.3);margin:auto 0;display:flex;flex-direction:column;overflow:hidden;}",
      ".mst-modal-hd{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 24px;border-bottom:1px solid var(--c-blue10,#d9e8f6);background:var(--lp-bg,#fff);border-radius:var(--r-lg,8px) var(--r-lg,8px) 0 0;flex:0 0 auto;}",
      '.mst-modal-title{margin:0;font-family:"Public Sans",sans-serif;font-size:1.35rem;font-weight:800;color:var(--lp-hl,#1a4480);}',
      ".mst-modal-close{border:0;background:transparent;cursor:pointer;color:var(--c-muted,#3d4551);padding:8px;border-radius:999px;line-height:0;flex:0 0 auto;}",
      ".mst-modal-close:hover{background:var(--lp-bg-alt,#eff6fb);}",
      ".mst-modal-close:focus-visible{outline:3px solid var(--lp-accent,#005ea2);outline-offset:2px;}",
      // Sized via .mst-modal-close (not the <svg> itself); px not rem so it
      // can't shift with a different root font-size.
      ".mst-modal-close svg{width:24px;height:24px;}",
      ".mst-modal-body{padding:20px 24px 28px;overflow-y:auto;flex:1 1 auto;position:relative;}",
      /* Defensive: if a page embedding this modal also loads LeafFormGrid's
         CSS elsewhere, its thead sticky positioning would otherwise leak in. */
      ".mst-modal-body table thead,",
      ".mst-modal-body table thead tr,",
      ".mst-modal-body table thead th,",
      ".mst-modal-body .ip-table thead,",
      ".mst-modal-body .ip-table thead tr,",
      ".mst-modal-body .ip-table thead th{",
      "position:static !important;",
      "top:auto !important;",
      "inset:auto !important;",
      "z-index:auto !important;",
      "}",
      "@media (prefers-reduced-motion: no-preference){.mst-modal-overlay{animation:mst-fade .15s ease-out;}}",
      "@keyframes mst-fade{from{opacity:0;}to{opacity:1;}}",

      /* -- Helper text -- */
      ".mst-help-text{font-size:0.8125rem;color:var(--c-muted,#3d4551);margin:0 0 10px 0;line-height:1.4;}",
      ".mst-help-text.mst-help-sites{margin-bottom:6px;}",

      /* -- Site summary heading: "<Tab Name> -- Showing N <description>" -- */
      ".mst-site-summary{margin:0 0 18px 0;padding:10px 0 14px 0;border-bottom:1px solid var(--c-blue10,#d9e8f6);font-size:1rem;line-height:1.4;}",
      '.mst-site-summary-name{font-family:"Public Sans",sans-serif;font-weight:800;color:var(--lp-hl,#1a4480);font-size:1.05rem;}',
      ".mst-site-summary-sep{color:var(--c-gray20,#c9c9c9);}",
      ".mst-site-summary-desc{color:var(--c-muted,#3d4551);}",
    ].join("\n");
    document.head.appendChild(style);
  }

  // -- Entry point --------------------------------------------------------------

  // Return user = at least one record in any source. Shows the grid as soon
  // as any source has records; falls back to first-time only once every
  // source has settled with none (including when all of them errored).
  function updateReturningState() {
    if (!heroTargetEl) return;
    var total = 0;
    var allSettled = true;
    Object.keys(siteState).forEach(function (k) {
      var s = siteState[k];
      if (s.data && typeof s.data === "object") {
        total += Object.keys(s.data).length;
      } else if (!s.error) {
        allSettled = false;
      }
    });

    // The collapsed hint is left alone: it applies again once records exist.
    if (total > 0) {
      layout.hasRecords = true;
      storageSet("localStorage", RETURNING_KEY, "1");
      applyLayout();
    } else if (allSettled) {
      layout.hasRecords = false;
      storageSet("localStorage", RETURNING_KEY, null);
      applyLayout();
    }
  }

  // Hide collapses the panel to the centered hero; View My Requests shows the
  // already-loaded grid again (no refetch). Hide focuses View My Requests;
  // showing focuses the panel heading, since Hide sits below the table.
  function setCollapsed(on) {
    layout.collapsed = on;
    storageSet("sessionStorage", COLLAPSED_KEY, on ? "1" : null);
    applyLayout();
  }

  function wireHeroToggle() {
    var hideBtn = document.getElementById(HIDE_BTN_ID);
    var showBtn = document.getElementById(SHOW_BTN_ID);
    var heading = document.getElementById(HEADING_ID);
    if (hideBtn) {
      hideBtn.addEventListener("click", function () {
        setCollapsed(true);
        if (showBtn) showBtn.focus();
        announce(
          "National LEAF Requests panel hidden. Use View My Requests to show it again.",
        );
      });
    }
    if (showBtn) {
      showBtn.addEventListener("click", function () {
        setCollapsed(false);
        if (heading) heading.focus();
        announce("National LEAF Requests panel shown on the home page.");
      });
    }
  }

  async function fetchFirstName() {
    var userID = String(CURRENT_USER_ID || "").trim();
    if (!userID || /[{<]/.test(userID)) return null;
    var cacheKey = "hl.firstName." + userID;
    var cached = storageGet("sessionStorage", cacheKey);
    if (cached) return cached;
    try {
      var resp = await fetch(
        "../platform/orgchart/api/employee/search?q=userName:" +
          encodeURIComponent(userID) +
          "&noLimit=0&_=" +
          Date.now(),
        { credentials: "same-origin" },
      );
      if (!resp.ok) return null;
      var data = await resp.json();
      var employees = Array.isArray(data) ? data : Object.values(data || {});
      var fullID = userID.toLowerCase();
      var bareID = fullID.split("\\").pop();
      var match = employees.find(function (e) {
        var name = String((e && e.userName) || "").toLowerCase();
        return name !== "" && (name === fullID || name === bareID);
      });
      var first = String((match && match.firstName) || "").trim();
      if (!first) return null;
      storageSet("sessionStorage", cacheKey, first);
      return first;
    } catch (e) {
      return null;
    }
  }

  function renderGreeting() {
    var nameEl = document.querySelector(
      "#" + HEADING_ID + " .hero-requests-name",
    );
    if (!nameEl) return;
    fetchFirstName().then(function (first) {
      if (first) nameEl.textContent = ", " + first;
    });
  }

  // Sysadmin first-time preview, toggled with Alt+Shift+F (no visible UI; the
  // live region is the only feedback). In memory only: no storage writes, no
  // refetch; reloading the page leaves preview.
  function isTextEntry(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    var tag = el.tagName;
    if (tag === "TEXTAREA" || tag === "SELECT") return true;
    if (tag !== "INPUT") return false;
    return !/^(button|submit|reset|checkbox|radio|range|color|file|image)$/i.test(
      el.type,
    );
  }

  function togglePreview() {
    layout.preview = !layout.preview;
    applyLayout();
    // Keep focus on something visible if the focused control just hid.
    if (!isShown(document.activeElement)) {
      var target = layout.preview
        ? heroTargetEl.querySelector(".hero-actions a, .hero-actions button")
        : document.getElementById(layout.collapsed ? SHOW_BTN_ID : HEADING_ID);
      if (isShown(target)) target.focus();
    }
    announce(
      layout.preview
        ? "Admin preview on. Showing the first-time view."
        : "Admin preview off. Showing your normal view.",
    );
  }

  function wirePreview() {
    if (!cfg.isSysadmin || !heroTargetEl) return;
    // Capture phase: a page-level handler that stops propagation (main.tpl
    // loads jQuery UI and other scripts) cannot swallow the shortcut.
    document.addEventListener(
      "keydown",
      function (e) {
        if (!(e.altKey && e.shiftKey && e.code === "KeyF") || e.repeat) return;
        // No records means the user already sees the first-time view.
        if (!layout.preview && !layout.hasRecords) return;
        if (document.querySelector(".lp-modal:not([hidden])")) return;
        if (isTextEntry(document.activeElement)) return;
        e.preventDefault();
        togglePreview();
      },
      true,
    );
  }

  // leaf_header.js returns focus to the link that opened the record modal.
  // If the grid re-rendered meanwhile, that node is gone, so focus the same
  // row's link, else the scroll region, else the active tab.
  var recordModalTrigger = null;
  var recordModalObserver = null;

  function restoreRecordModalFocus() {
    var t = recordModalTrigger;
    recordModalTrigger = null;
    if (!t || t.el.isConnected || !mstRootEl) return;
    var panel = mstRootEl.querySelector(".ip-panel.is-active");
    var row =
      panel &&
      panel.querySelector('tr[data-rowkey="' + CSS.escape(t.rowKey) + '"]');
    var target =
      (row && row.querySelector('a[data-action="form-modal"]:not([tabindex])')) ||
      (panel && panel.querySelector(".ip-tableWrap[tabindex]")) ||
      mstRootEl.querySelector('.ip-tab[aria-selected="true"]');
    if (target) target.focus();
  }

  function wireRecordModalFocus(rootEl) {
    rootEl.addEventListener("click", function (e) {
      var link = e.target.closest('a[data-action="form-modal"]');
      if (!link || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) {
        return;
      }
      var tr = link.closest("tr");
      recordModalTrigger = {
        el: link,
        rowKey: tr ? tr.getAttribute("data-rowkey") : "",
      };
      // leaf_header.js builds #lpFormModal on first open, after this handler.
      setTimeout(function () {
        var modal = document.getElementById("lpFormModal");
        if (!modal || recordModalObserver) return;
        recordModalObserver = new MutationObserver(function () {
          if (modal.hasAttribute("hidden")) restoreRecordModalFocus();
        });
        recordModalObserver.observe(modal, {
          attributes: true,
          attributeFilter: ["hidden"],
        });
      }, 0);
    });
  }

  function onSourceSettled(sourceKey) {
    updateReturningState();
    var activeIdx = getActiveTabIndex();
    var tab = TABS[activeIdx];
    if (!tab || tab.sourceKeys.indexOf(sourceKey) === -1) return;
    updateSiteSummaryForTab(activeIdx);
    renderTabContent(activeIdx);
  }

  // Fetches the given sources (clearing any earlier error) and re-renders
  // as each settles. Used for the first load, Retry, and lp:home-shown.
  function loadSources(sourceKeys) {
    var fetches = sourceKeys.map(function (key) {
      var source = SOURCE_SITES[key];
      var state = siteState[stateKey(source)];
      state.error = null;
      state.loading = true;
      return fetchSiteData(source)
        .then(function (data) {
          state.data = data;
        })
        .catch(function (err) {
          state.error = err;
          console.error("[MultiSiteGrid] failed:", source.url, err);
        })
        .then(function () {
          state.loading = false;
          updateBusy();
          onSourceSettled(key);
        });
    });
    updateBusy();
    // Show the loading state now for sources that just went back to pending.
    updateSiteSummaryForTab(getActiveTabIndex());
    renderTabContent(getActiveTabIndex());
    return Promise.allSettled(fetches);
  }

  // aria-busy on the panels while any source is in flight.
  function updateBusy() {
    var panels = mstRootEl && mstRootEl.querySelector("#mst-panels");
    if (!panels) return;
    var busy = Object.keys(siteState).some(function (k) {
      return siteState[k].loading;
    });
    if (busy) panels.setAttribute("aria-busy", "true");
    else panels.removeAttribute("aria-busy");
  }

  // Live-region summary once a batch of sources settles.
  function announceLoadResult(sourceKeys, afterRetry) {
    var failed = sourceKeys.filter(isSourceErrored);
    if (!failed.length) {
      announce("Your requests have loaded.");
      return;
    }
    var names = failed
      .map(function (k) {
        return SOURCE_SITES[k].name;
      })
      .join(", ");
    announce(
      afterRetry
        ? "Some requests still could not be loaded: " + names + ". Try again later."
        : "Some requests could not be loaded: " + names + ". Use Retry to try again.",
    );
  }

  // Sources with no data that aren't already in flight (errored, or never loaded).
  function unloadedSourceKeys() {
    return Object.keys(SOURCE_SITES).filter(function (key) {
      var s = siteState[stateKey(SOURCE_SITES[key])];
      return s && !s.data && !s.loading;
    });
  }

  // Retry re-renders the panel, which removes the button, so focus moves
  // to the active tab and the outcome is announced.
  function retryFailedSources() {
    var keys = Object.keys(SOURCE_SITES).filter(isSourceErrored);
    if (!keys.length) return;
    var tabBtn = mstRootEl.querySelector("#mst-tab-" + getActiveTabIndex());
    if (tabBtn) tabBtn.focus();
    loadSources(keys).then(function () {
      announceLoadResult(keys, true);
    });
  }

  function wireRetry(rootEl) {
    rootEl.addEventListener("click", function (e) {
      if (e.target.closest(".mst-retry-btn")) retryFailedSources();
    });
  }

  // leaf_header.js fires lp:home-shown when the router returns to home.
  // Re-sync tab state (another route may have shown while this was hidden)
  // and fetch only sources that never loaded; succeeded ones are kept.
  function wireHomeShown() {
    document.addEventListener("lp:home-shown", function () {
      if (!mstRootEl) return;
      activateTab(getActiveTabIndex());
      var keys = unloadedSourceKeys();
      if (!keys.length) return;
      loadSources(keys).then(function () {
        announceLoadResult(keys, false);
      });
    });
  }

  async function buildAndLoadGrid(rootEl) {
    buildShell(rootEl);

    var sourceKeys = Object.keys(SOURCE_SITES);
    sourceKeys.forEach(function (key) {
      siteState[stateKey(SOURCE_SITES[key])] = {
        data: null,
        rendered: false,
        error: null,
        loading: false,
      };
    });

    await loadSources(sourceKeys);
    // Skip when the grid isn't on screen (another route, or first-time view);
    // lp:home-shown reports any failure once home is shown.
    if (isShown(rootEl)) announceLoadResult(sourceKeys, false);
  }

  function init() {
    injectStyles();

    var trigger = cfg.triggerId ? document.getElementById(cfg.triggerId) : null;

    if (trigger) {
      // Modal mode: build the overlay lazily, load grid data on first open only.
      trigger.addEventListener("click", openModal);
      return;
    }

    // Fallback: no trigger configured -- mount inline at data-mount (or
    // append to body).
    var rootEl = cfg.mountId ? document.getElementById(cfg.mountId) : null;
    if (!rootEl) {
      rootEl = document.createElement("div");
      document.body.appendChild(rootEl);
    }
    rootEl.classList.add("mst-container");
    if (cfg.compact) rootEl.classList.add("mst-compact");
    wireRecordModalFocus(rootEl);
    wireRetry(rootEl);
    wireHomeShown();
    wireHeroToggle();
    renderGreeting();
    wirePreview();
    buildAndLoadGrid(rootEl);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
