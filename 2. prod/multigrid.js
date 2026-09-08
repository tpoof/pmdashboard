/*
 * ============================================================
 *  MULTI-SITE LEAF GRID  --  multigrid.js
 * ============================================================
 *
 *  Host this file on your LEAF server (e.g. /custom/multigrid.js)
 *  and embed it on any page with:
 *
 *    <div id="mst-root"></div>
 *    <script src="/custom/multigrid.js"
 *            data-user-id="<!--{$userID}-->"
 *            data-mount="mst-root"></script>
 *
 *  The data-user-id attribute carries the Smarty-rendered value from the
 *  embedding page. Smarty placeholders only render inside .tpl files parsed
 *  by the Smarty engine -- they will NOT render inside this external .js
 *  file, so they must be passed in this way rather than hardcoded here.
 *
 *  If data-mount is omitted, the script appends itself to <body>.
 *
 *  NOTE: This file intentionally uses plain ASCII only (no smart quotes,
 *  em dashes, box-drawing characters, etc.). Non-ASCII bytes in this file
 *  have previously been corrupted by upload/deploy pipelines with
 *  mismatched character encoding, which can silently break string
 *  literals or comment delimiters and cause syntax errors in production
 *  even though the file parses fine in an editor. Keep it ASCII-only.
 * ============================================================
 */
(function () {
  "use strict";

  // -- Resolve config from the embedding <script> tag's data-attributes --
  var thisScript = document.currentScript;
  var cfg = {
    userID: thisScript ? thisScript.dataset.userId : undefined,
    mountId: thisScript ? thisScript.dataset.mount : undefined,
    triggerId: thisScript ? thisScript.dataset.trigger : undefined,
  };

  /*
   *  SOURCE_SITES -- one entry per fetchable LEAF site (independent
   *  recordID sequence, independent query). This is the fetch layer:
   *  every entry here gets its own fetchSiteData() call regardless of
   *  how the tabs above group them.
   *
   *  Required per source:
   *    url         - Full URL to the LEAF_Request_Portal, with trailing slash
   *    name        - Label used in per-source contexts (error messages, etc.)
   *    description - Continuation clause used in the single-site summary
   *                   heading: "<Site Name> -- Showing N <description>"
   *    allRequestsLabel - The "Site" value this source rolls up to in the
   *                   All Requests table (3 values total: "Site Creations",
   *                   "National Support", "Ideas" -- Service Requests and
   *                   Support both roll up to "National Support" there).
   *
   *  Set isLaunchpad: true on a site to use the Date/Project/Status
   *  (with Site Ready button) column layout instead of the default
   *  Date Initiated/UID/Title/Status layout.
   *
   *  Set nationalSupportLabel on a site to have it participate in the
   *  National Support merged tab, tagged with that label in the Source
   *  column.
   */
  var SOURCE_SITES = {
    siteCreations: {
      url: "https://leaf.va.gov/launchpad/",
      name: "Site Creations",
      description: "the LEAF sites you've created",
      isLaunchpad: true,
      allRequestsLabel: "Site Creations",
    },
    serviceRequests: {
      url: "https://leaf.va.gov/platform/service_requests_launchpad/",
      name: "Service Requests",
      description:
        "your case studies, spotlight nominations, training requests, and feedback submissions",
      nationalSupportLabel: "Service Requests",
      allRequestsLabel: "National Support",
    },
    support: {
      url: "https://leaf.va.gov/platform/support/",
      name: "Support",
      description: "your LEAF National consultation requests",
      nationalSupportLabel: "Support",
      allRequestsLabel: "National Support",
    },
    ideas: {
      url: "https://leaf.va.gov/platform/ideas/",
      name: "Ideas",
      description: "the ideas you've submitted to improve LEAF",
      isIdeas: true,
      allRequestsLabel: "Ideas",
    },
    // Add more sources here
  };

  /*
   *  TABS -- the visible tablist. Each tab points at one or more
   *  SOURCE_SITES keys:
   *    kind: "all"    - aggregates every source below into one table,
   *                     with client-side site filter chips
   *    kind: "merged" - combines >1 source into one table (National
   *                     Support), tagging each row with its source
   *    kind: "single" - one source, one table -- unchanged from the
   *                     original per-site behavior
   *
   *  Order here is tab order. "All Requests" is first and active by
   *  default; Site Creations, National Support, and Ideas remain as
   *  full standalone tabs after it (additive, not a replacement).
   */
  var TABS = [
    {
      id: "all",
      name: "All Requests",
      kind: "all",
      sourceKeys: ["siteCreations", "serviceRequests", "support", "ideas"],
      description: "requests across every LEAF site you use",
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
      sourceKeys: ["serviceRequests", "support"],
      description: "your service requests and support consultations",
    },
    {
      id: "ideas",
      name: "Ideas",
      kind: "single",
      sourceKeys: ["ideas"],
    },
  ];

  // Site filter chips for the All Requests tab -- the 3 allRequestsLabel
  // values, all on by default. Client-side show/hide only (no re-fetch).
  var ALL_REQUESTS_SITE_LABELS = ["Site Creations", "National Support", "Ideas"];
  var allRequestsFilters = {
    "Site Creations": true,
    "National Support": true,
    Ideas: true,
  };

  var MONTH_ABBR = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "June",
    "July",
    "Aug",
    "Sept",
    "Oct",
    "Nov",
    "Dec",
  ];
  var REQUESTOR_FIELD_ID = "userID";

  // -- Current user ---------------------------------------------------------
  // Prefer the value passed via data-attribute (rendered server-side by Smarty
  // on the embedding page). Fall back to a `session` global if present.
  var CURRENT_USER_ID =
    cfg.userID &&
    cfg.userID.indexOf("{$") === -1 &&
    cfg.userID.indexOf("<!--") === -1
      ? cfg.userID
      : typeof session !== "undefined" && session && session.userID
        ? session.userID
        : cfg.userID;

  // -- User display-name cache -----------------------------------------------
  var userNameCache = {};
  async function resolveUserName(userID) {
    if (!userID) return { name: "-", fallback: false };
    if (userNameCache[userID] !== undefined) return userNameCache[userID];
    try {
      // PLACEHOLDER: replace with your actual lookup, e.g.:
      // const resp = await fetch('/api/users/' + encodeURIComponent(userID), { credentials: 'include' });
      // if (!resp.ok) throw new Error('lookup failed');
      // const person = await resp.json();
      // const result = { name: person.displayName || person.name || userID, fallback: false };
      // userNameCache[userID] = result;
      // return result;
      throw new Error("no lookup endpoint configured");
    } catch (e) {
      var result = { name: String(userID), fallback: true };
      userNameCache[userID] = result;
      return result;
    }
  }

  // -- Query ------------------------------------------------------------------
  // For Site Creations specifically, also request data fields 17/21/22
  // (server, root directory, site name) via getData -- these populate
  // rec.s1.id17/id21/id22, which the Status column uses to build the
  // "Site Ready" link. Mirrors the native Launchpad search widget's
  // query.getData(17/21/22).
  //
  // For Ideas specifically, request data field 12 -- a custom status field
  // defined on that form -- which the Status column uses instead of the
  // generic workflow lastStatus field. Also exclude submissions created
  // from form_57e89 (categoryID), which should never appear in this view.
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

  // -- Status helpers -----------------------------------------------------
  // Every per-origin Status rule lives here, once, and is reused by both
  // the single-site tab renderers (buildHeaders/buildLaunchpadHeaders,
  // which write into a LeafFormGrid/DOM callback) and the merged-table
  // renderers below (which build an HTML string for a row that may have
  // come from any of several origins). Routing by origin here rather
  // than duplicating/rewriting the logic is what makes the merge safe.

  // Plain-text status -> HTML, with red-italic styling for "Not Submitted".
  function statusHTMLFor(text) {
    if (text === "Not Submitted") {
      return '<span class="mst-status-not-submitted">' + text + "</span>";
    }
    return "<span>" + text + "</span>";
  }

  function setStatusCellText(el, text) {
    el.innerHTML = statusHTMLFor(text);
  }

  // Generic (non-Launchpad, non-Ideas) status text: the workflow's own
  // lastStatus field. This is the fallback both Service Requests and
  // Support use today -- see the NOTE on nationalSupportStatusText below.
  function genericStatusText(rec) {
    return rec && rec.lastStatus ? rec.lastStatus : "Not Submitted";
  }

  // Ideas' custom status field (indicatorID 12), in place of lastStatus.
  function ideasStatusText(rec) {
    var v =
      rec && rec.s1 && rec.s1.id12 !== undefined && rec.s1.id12 !== null
        ? rec.s1.id12
        : "";
    return v || "Not Submitted";
  }

  // Site Creations' "Site Ready" logic: a link once the site's server
  // fields (s1.id17/id21/id22) are populated, otherwise a dash. Returns
  // HTML (this column is a button/action, not plain text, so it doesn't
  // go through statusHTMLFor).
  function launchpadStatusHTML(rec) {
    rec = rec || {};
    if (
      rec.s1 !== undefined &&
      rec.s1.id17 !== undefined &&
      rec.s1.id22 !== undefined &&
      rec.s1.id21 !== undefined &&
      rec.s1.id21 !== ""
    ) {
      var siteURL =
        "https://" + rec.s1.id17 + "/" + rec.s1.id22 + "/" + rec.s1.id21;
      return (
        '<a href="' +
        siteURL +
        '" class="mst-site-ready-btn" target="_blank">Site Ready</a>'
      );
    }
    return "-";
  }

  // FLAG: routes a merged-table row's Status cell by its source key.
  // Site Creations and Ideas each get their own real per-site logic
  // above. Service Requests and Support both fall through to the
  // generic lastStatus branch -- that's correct today because neither
  // one has ever needed a custom status field (unlike Ideas' id12), so
  // merging them didn't change their status logic at all. If either
  // Service Requests or Support ever grows a custom status field of its
  // own, this is the one place (plus nationalSupportStatusText below)
  // that would need a per-source branch added -- right now this
  // function can't tell them apart once merged.
  function statusTextForSource(sourceKey, rec) {
    var source = SOURCE_SITES[sourceKey];
    if (source.isIdeas) return ideasStatusText(rec);
    return genericStatusText(rec);
  }

  function allRequestsStatusHTML(sourceKey, rec) {
    var source = SOURCE_SITES[sourceKey];
    if (source.isLaunchpad) return launchpadStatusHTML(rec);
    return statusHTMLFor(statusTextForSource(sourceKey, rec));
  }

  // Same FLAG as statusTextForSource above: National Support's Status
  // column has no way today to distinguish Service Requests from
  // Support -- both use the generic lastStatus fallback.
  function nationalSupportStatusHTML(sourceKey, rec) {
    return statusHTMLFor(statusTextForSource(sourceKey, rec));
  }

  // -- Column header builder (single-site tabs only) ---------------------
  function buildHeaders(site) {
    if (site.isLaunchpad) {
      return buildLaunchpadHeaders(site);
    }

    return [
      {
        name: "Date Initiated",
        indicatorID: "dateInitiated",
        editable: false,
        callback: function (data, blob) {
          var rec = blob[data.recordID];
          var text = "";
          if (rec && rec.date) {
            text = new Date(rec.date * 1000).toLocaleDateString();
          }
          document.getElementById(data.cellContainerID).textContent = text;
        },
      },
      {
        name: "UID",
        indicatorID: "uid",
        editable: false,
        callback: function (data, blob) {
          document.getElementById(data.cellContainerID).innerHTML =
            '<a target="_blank" href="' +
            site.url +
            "index.php?a=printview&recordID=" +
            data.recordID +
            '">' +
            data.recordID +
            "</a>";
        },
      },
      {
        name: "Title",
        indicatorID: "title",
        editable: false,
        callback: function (data, blob) {
          var title =
            blob[data.recordID] && blob[data.recordID].title
              ? blob[data.recordID].title
              : "";
          document.getElementById(data.cellContainerID).innerHTML =
            '<a href="' +
            site.url +
            "index.php?a=printview&recordID=" +
            data.recordID +
            '" target="_blank">' +
            title +
            "</a>";
        },
      },
      {
        name: "Status",
        indicatorID: "currentStatus",
        editable: false,
        callback: function (data, blob) {
          var rec = blob[data.recordID];
          var el = document.getElementById(data.cellContainerID);
          if (site.isIdeas) {
            setStatusCellText(el, ideasStatusText(rec));
          } else {
            setStatusCellText(el, genericStatusText(rec));
          }
        },
      },
    ];
  }

  // -- Launchpad-specific columns: Date, Project, Status (with Site Ready) ----
  // Mirrors the native Launchpad "welcome back" search widget's renderResult():
  //   Date    -- abbreviated month + day (+ year if not current year)
  //   Project -- recordID badge + title link
  //   Status  -- "Pending X" / "Waiting for X" text, OR a "Site Ready" button
  //              once the site's server fields (s1.id17/id21/id22) are
  //              populated, matching the native widget's logic exactly.
  function buildLaunchpadHeaders(site) {
    return [
      {
        name: "Date",
        indicatorID: "date",
        editable: false,
        callback: function (data, blob) {
          var rec = blob[data.recordID];
          var text = "";
          if (rec && rec.date) {
            var date = new Date(rec.date * 1000);
            var now = new Date();
            var year =
              now.getFullYear() !== date.getFullYear()
                ? " " + date.getFullYear()
                : "";
            text = MONTH_ABBR[date.getMonth()] + " " + date.getDate() + year;
          }
          document.getElementById(data.cellContainerID).textContent = text;
        },
      },
      {
        name: "Project",
        indicatorID: "title",
        editable: false,
        callback: function (data, blob) {
          var rec = blob[data.recordID] || {};
          var title = rec.title || "";
          document.getElementById(data.cellContainerID).innerHTML =
            requestCellHTML(
              site.url + "index.php?a=printview&recordID=" + data.recordID,
              data.recordID,
              title,
            );
        },
      },
      {
        name: "Status",
        indicatorID: "currentStatus",
        editable: false,
        callback: function (data, blob) {
          var rec = blob[data.recordID] || {};
          document.getElementById(data.cellContainerID).innerHTML =
            launchpadStatusHTML(rec);
        },
      },
    ];
  }

  // Shared "badge recordID + title link" cell, used by Site Creations'
  // Project column and by the All Requests Request column.
  function requestCellHTML(link, recordID, title) {
    return (
      '<span class="mst-lp-recid">' +
      '<a href="' +
      link +
      '" tabindex="-1" target="_blank">' +
      recordID +
      "</a>" +
      "</span> " +
      '<a href="' +
      link +
      '" target="_blank">' +
      title +
      "</a>"
    );
  }

  // ============================================================
  //  Runtime
  // ============================================================

  var siteState = {}; // keyed by source.url -- { data, rendered, error }
  var mstRootEl = null; // set by buildShell -- the container passed to buildAndLoadGrid

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

  async function fetchSiteData(site) {
    var rawQuery = myRecordsQuery(site);
    var extraParams = rawQuery.extraParams || "";
    var query = Object.assign({}, rawQuery);
    delete query.extraParams;

    if (typeof LeafFormQuery !== "undefined") {
      var q = new LeafFormQuery();
      q.setRootURL(site.url);
      q.importQuery(query);
      // importQuery() drops `sort` -- apply it explicitly or results come back unordered.
      if (query.sort && query.sort.column) {
        q.sort(query.sort.column, query.sort.direction || "DESC");
      }
      // `limit` is also dropped by importQuery(), but that's fine: execute()
      // treats limit as undefined and falls through to getBulkData(), which
      // paginates internally using its own batchSize (500).
      if (extraParams) {
        q.setExtraParams(extraParams);
      }
      return q.execute();
    }

    // Raw fetch fallback with pagination.
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

  // -- Row view-models -----------------------------------------------------
  // Every merged/all-requests row carries a composite `key` of
  // `${site.url}__${recordID}` (per-source recordIDs are NOT globally
  // unique -- Site Creations, Service Requests, Support, and Ideas are
  // four independent LEAF sites, each with their own recordID sequence,
  // so two different sources can easily produce the same numeric ID).
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

  // FLAG: sorting merged rows by recordID (the original single-site
  // default) stops meaning anything once rows come from more than one
  // source -- each source's recordID sequence is independent, so
  // "recordID desc" no longer approximates recency across sites. Both
  // merged views below sort by date instead. This is an explicit
  // deviation from the original per-site table's recordID-desc sort;
  // the task only specified date-desc for All Requests, but the same
  // reasoning applies to National Support once two sources are combined,
  // so it uses the same sort for consistency.
  function sortByDateDesc(rows) {
    rows.sort(function (a, b) {
      return b.dateEpoch - a.dateEpoch;
    });
    return rows;
  }

  // -- Single-site table fallback (used when LeafFormGrid isn't available) --
  function renderTable(site, bodyEl, data) {
    var records = Object.keys(data).map(function (id) {
      var rec = data[id] || {};
      return {
        recordID: id,
        rec: rec,
        userID: rec[REQUESTOR_FIELD_ID] || null,
        service: rec.service || "",
        title: rec.title || "",
        statusText: rec.lastStatus || "Not Submitted",
        date: rec.date ? new Date(rec.date * 1000).toLocaleDateString() : "",
      };
    });

    records.sort(function (a, b) {
      return b.recordID - a.recordID;
    });

    var headCells =
      "<th>Date Initiated</th><th>UID</th><th>Title</th><th>Status</th>";
    var colCount = 4;

    var html =
      '<div class="ip-tableWrap"><table class="ip-table"><thead><tr>' +
      headCells +
      "</tr></thead><tbody>";

    if (records.length === 0) {
      html +=
        '<tr><td colspan="' +
        colCount +
        '" style="text-align:center; color:var(--c-muted);">No records found.</td></tr>';
    }

    records.forEach(function (r) {
      var link = site.url + "index.php?a=printview&recordID=" + r.recordID;
      html +=
        '<tr data-recordid="' +
        r.recordID +
        '">' +
        "<td>" +
        r.date +
        "</td>" +
        '<td><a href="' +
        link +
        '" target="_blank">' +
        r.recordID +
        "</a></td>" +
        '<td><a href="' +
        link +
        '" target="_blank">' +
        r.title +
        "</a></td>" +
        "<td>" +
        statusHTMLFor(r.statusText) +
        "</td>" +
        "</tr>";
    });

    html += "</tbody></table></div>";
    bodyEl.innerHTML = html;

    records.forEach(function (r) {
      if (!r.userID) return;
      var row = bodyEl.querySelector(
        'tr[data-recordid="' + r.recordID + '"] .mst-requestor-cell',
      );
      if (!row) return;
      resolveUserName(r.userID).then(function (result) {
        row.textContent = result.name;
        if (result.fallback) {
          row.title = "Directory lookup unavailable";
          row.style.fontStyle = "italic";
        }
      });
    });
  }

  // -- Merged tables (National Support, All Requests) ---------------------
  // Shared wrapper: builds rows from every source in the tab, sorts them,
  // hands them to a table-builder, and appends a pending/error banner so
  // the tab renders whatever's already resolved instead of blocking on
  // the slowest fetch.
  function renderMergedTab(tab, bodyEl, tableBuilder) {
    var rows = sortByDateDesc(rowsForSources(tab.sourceKeys));
    var erroredKeys = tab.sourceKeys.filter(isSourceErrored);
    var pending = tab.sourceKeys.some(isSourcePending);

    var html = "";
    erroredKeys.forEach(function (k) {
      html +=
        '<p class="ip-error">Error loading data from ' +
        SOURCE_SITES[k].url +
        ". Check your network access and permissions.</p>";
    });
    html += tableBuilder(rows);
    if (pending) {
      html +=
        '<p class="mst-loading-more" role="status">Loading more requests&hellip;</p>';
    }

    bodyEl.innerHTML = html;
    return rows;
  }

  function buildNationalSupportTable(rows) {
    var head =
      "<th>Date Initiated</th><th>UID</th><th>Title</th><th>Status</th><th>Source</th>";
    var body = rows
      .map(function (r) {
        var dateText = r.rec.date
          ? new Date(r.rec.date * 1000).toLocaleDateString()
          : "";
        var title = r.rec.title || "";
        return (
          '<tr data-rowkey="' +
          r.key +
          '">' +
          "<td>" +
          dateText +
          "</td>" +
          '<td><a href="' +
          r.link +
          '" target="_blank">' +
          r.recordID +
          "</a></td>" +
          '<td><a href="' +
          r.link +
          '" target="_blank">' +
          title +
          "</a></td>" +
          "<td>" +
          nationalSupportStatusHTML(r.sourceKey, r.rec) +
          "</td>" +
          "<td>" +
          SOURCE_SITES[r.sourceKey].nationalSupportLabel +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    if (!rows.length) {
      body =
        '<tr><td colspan="5" style="text-align:center; color:var(--c-muted);">No records found.</td></tr>';
    }

    return (
      '<div class="ip-tableWrap"><table class="ip-table"><thead><tr>' +
      head +
      "</tr></thead><tbody>" +
      body +
      "</tbody></table></div>"
    );
  }

  function buildAllRequestsTable(rows) {
    var head = "<th>Date</th><th>Site</th><th>Request</th><th>Status</th>";
    var body = rows
      .map(function (r) {
        var dateText = r.rec.date
          ? new Date(r.rec.date * 1000).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "";
        var title = r.rec.title || "";
        var siteLabel = r.site.allRequestsLabel;
        return (
          '<tr data-rowkey="' +
          r.key +
          '" data-site-label="' +
          siteLabel +
          '">' +
          "<td>" +
          dateText +
          "</td>" +
          "<td>" +
          siteLabel +
          "</td>" +
          "<td>" +
          requestCellHTML(r.link, r.recordID, title) +
          "</td>" +
          "<td>" +
          allRequestsStatusHTML(r.sourceKey, r.rec) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    if (!rows.length) {
      body =
        '<tr><td colspan="4" style="text-align:center; color:var(--c-muted);">No records found.</td></tr>';
    }

    return (
      '<div class="ip-tableWrap"><table class="ip-table"><thead><tr>' +
      head +
      "</tr></thead><tbody>" +
      body +
      "</tbody></table></div>"
    );
  }

  // -- All Requests site filter chips ---------------------------------------
  // Real toggle-button semantics (aria-pressed), wrapped in a labeled
  // role="group" -- not a bare CSS-class toggle. Client-side show/hide
  // only; never triggers a re-fetch.
  function buildAllRequestsFilterChipsHTML() {
    var chips = ALL_REQUESTS_SITE_LABELS.map(function (label) {
      var pressed = allRequestsFilters[label];
      return (
        '<button type="button" class="mst-filter-chip' +
        (pressed ? " is-pressed" : "") +
        '" data-site-filter="' +
        label +
        '" aria-pressed="' +
        pressed +
        '">' +
        '<span class="mst-filter-chip-check" aria-hidden="true">' +
        (pressed ? "&#10003;" : "") +
        "</span> " +
        label +
        "</button>"
      );
    }).join("");
    return (
      '<div class="mst-filter-group" role="group" aria-label="Filter All Requests by site">' +
      chips +
      "</div>"
    );
  }

  function applyAllRequestsFilters(bodyEl) {
    bodyEl.querySelectorAll("tr[data-site-label]").forEach(function (row) {
      var label = row.getAttribute("data-site-label");
      row.hidden = !allRequestsFilters[label];
    });
  }

  function wireAllRequestsFilterChips(containerEl, bodyEl) {
    containerEl.querySelectorAll("[data-site-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var label = btn.getAttribute("data-site-filter");
        allRequestsFilters[label] = !allRequestsFilters[label];
        var pressed = allRequestsFilters[label];
        btn.setAttribute("aria-pressed", String(pressed));
        btn.classList.toggle("is-pressed", pressed);
        var check = btn.querySelector(".mst-filter-chip-check");
        if (check) check.innerHTML = pressed ? "&#10003;" : "";
        applyAllRequestsFilters(bodyEl);
      });
    });
  }

  function renderAllRequestsTab(tab, bodyEl) {
    renderMergedTab(tab, bodyEl, buildAllRequestsTable);
    bodyEl.insertAdjacentHTML("afterbegin", buildAllRequestsFilterChipsHTML());
    wireAllRequestsFilterChips(bodyEl, bodyEl);
    applyAllRequestsFilters(bodyEl);
  }

  // -- Single-source tab (Site Creations, Ideas) ---------------------------
  // Unchanged in spirit from the original per-site renderGrid(): uses
  // LeafFormGrid when available, falls back to renderTable(), and only
  // draws once per resolved fetch (LeafFormGrid render is a one-shot).
  function renderSingleSourceTab(tab, bodyEl, tabIndex) {
    var sourceKey = tab.sourceKeys[0];
    var source = SOURCE_SITES[sourceKey];
    var state = siteState[stateKey(source)];
    if (!state) return;

    if (state.error) {
      bodyEl.innerHTML =
        '<p class="ip-error">Error loading data from ' +
        source.url +
        ". Check your network access and permissions.</p>";
      return;
    }
    if (!state.data || state.rendered) return;

    if (typeof LeafFormGrid !== "undefined") {
      var gridID = "mst-grid-" + tabIndex;
      if (!document.getElementById(gridID)) {
        var div = document.createElement("div");
        div.id = gridID;
        bodyEl.appendChild(div);
      }
      var grid = new LeafFormGrid(gridID);
      grid.setRootURL(source.url);
      grid.hideIndex();
      grid.setDataBlob(state.data);
      grid.setData(Object.values(state.data));
      grid.setHeaders(buildHeaders(source));
      grid.sort("recordID", "desc");
      grid.renderBody();
    } else {
      renderTable(source, bodyEl, state.data);
    }

    state.rendered = true;
  }

  // -- Tab dispatch ----------------------------------------------------------
  function renderTabContent(tabIndex) {
    var tab = TABS[tabIndex];
    var bodyEl = document.getElementById("mst-body-" + tabIndex);
    if (!tab || !bodyEl) return;

    if (tab.kind === "single") {
      renderSingleSourceTab(tab, bodyEl, tabIndex);
    } else if (tab.kind === "merged") {
      renderMergedTab(tab, bodyEl, buildNationalSupportTable);
    } else if (tab.kind === "all") {
      renderAllRequestsTab(tab, bodyEl);
    }
  }

  function getActiveTabIndex() {
    var activeBtn = mstRootEl && mstRootEl.querySelector(".ip-tab.is-active");
    if (!activeBtn) return 0;
    var idx = parseInt(activeBtn.id.replace("mst-tab-", ""), 10);
    return isNaN(idx) ? 0 : idx;
  }

  function activateTab(idx) {
    document.querySelectorAll(".ip-tab").forEach(function (btn, i) {
      var active = i === idx;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
      btn.setAttribute("tabindex", active ? "0" : "-1");
    });
    document.querySelectorAll(".ip-panel").forEach(function (panel, i) {
      panel.classList.toggle("is-active", i === idx);
    });
    updateSiteSummaryForTab(idx);
    renderTabContent(idx);
  }

  // -- Summary line: "<Tab Name> -- Showing N <description>" -----------
  // For single-source tabs this is exact (one fetch, one count). For
  // merged/all tabs the count is a running total of whatever's resolved
  // so far, with a "+" suffix while any of that tab's sources are still
  // pending -- consistent with rendering partial results rather than
  // blocking on the slowest fetch.
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
    rootEl.innerHTML =
      '<div class="smarty-root">' +
      '<div class="ip-wrap">' +
      '<p class="mst-help-text mst-help-sites">Select a tab to view your requests. All Requests combines every LEAF site you use.</p>' +
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
            document.getElementById("mst-tab-" + next).focus();
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
      '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>' +
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
      ".mst-container .ip-table{width:100%;border-collapse:collapse;table-layout:auto;background:#fff;min-width:840px;font-size:16px;}",
      ".mst-container .ip-table th,.mst-container .ip-table td{border:1px solid var(--c-gray20,#c9c9c9);padding:10px;vertical-align:top;word-wrap:break-word;overflow-wrap:anywhere;text-align:left;}",
      '.mst-container .ip-table th{background:var(--c-blue10,#d9e8f6);font-family:"Public Sans",sans-serif;font-weight:700;color:var(--lp-hl,#1a4480);user-select:none;}',
      ".mst-container .ip-table tbody tr:hover{background:var(--lp-bg-alt,#eff6fb);}",
      ".mst-container .ip-table td a{color:var(--lp-accent,#005ea2);text-decoration:none;}",
      ".mst-container .ip-table td a:hover{text-decoration:underline;}",
      ".mst-container .ip-error{color:#b91c1c;font-size:14px;font-weight:600;}",
      ".mst-container .mst-status-not-submitted{color:#b91c1c;font-style:italic;font-size:0.875em;}",

      /* -- Launchpad-specific column styling -- */
      ".mst-container .mst-lp-recid a{display:inline-flex;align-items:center;justify-content:center;padding:4px 10px;background:var(--c-text,#1b1b1b);color:#fff !important;border-radius:var(--r,5px);font-weight:900;font-size:1em;line-height:1;text-decoration:none;text-align:center;}",
      ".mst-container .mst-lp-recid a:hover,.mst-container .mst-lp-recid a:focus{background:var(--c-muted,#3d4551);color:#fff !important;}",
      ".mst-container .mst-site-ready-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:var(--r,5px);border:1px solid var(--c-blue20,#aacdec);background:var(--lp-bg-alt,#eff6fb);color:var(--lp-accent,#005ea2);font-weight:700;text-decoration:none;}",
      ".mst-container .mst-site-ready-btn:hover{background:var(--c-blue10,#d9e8f6);text-decoration:none;}",
      ".mst-container .mst-site-ready-btn:focus-visible{outline:3px solid var(--lp-accent,#005ea2);outline-offset:2px;}",

      /* -- All Requests site filter chips -- */
      ".mst-container .mst-filter-group{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px 0;}",
      '.mst-container .mst-filter-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--c-blue20,#aacdec);background:var(--lp-bg,#fff);color:var(--c-muted,#3d4551);border-radius:999px;padding:6px 14px;font-family:"Public Sans",sans-serif;font-weight:700;font-size:0.875rem;cursor:pointer;transition:background .15s,color .15s,border-color .15s;}',
      ".mst-container .mst-filter-chip:hover{border-color:var(--lp-accent,#005ea2);}",
      ".mst-container .mst-filter-chip:focus-visible{outline:3px solid var(--lp-accent,#005ea2);outline-offset:2px;}",
      ".mst-container .mst-filter-chip.is-pressed{background:var(--lp-accent,#005ea2);border-color:var(--lp-accent,#005ea2);color:#fff;}",
      ".mst-container .mst-filter-chip-check{display:inline-block;width:1em;}",

      /* -- Partial-loading indicator (All Requests / National Support) -- */
      ".mst-container .mst-loading-more{margin:10px 0 0;font-size:0.875rem;font-style:italic;color:var(--c-muted,#3d4551);}",

      "@media (max-width:780px){.mst-container .ip-tabs{width:100%;flex-wrap:wrap;justify-content:center;}.mst-container .ip-tabsRow{justify-content:center;}.mst-container .ip-table{display:block;overflow-x:auto;white-space:nowrap;}}",

      /* -- Modal shell -- */
      ".mst-modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;z-index:1000;}",
      ".mst-modal-overlay[hidden]{display:none;}",
      ".mst-modal{background:var(--lp-bg,#fff);border-radius:var(--r-lg,8px);max-width:1200px;width:100%;max-height:calc(100vh - 80px);box-shadow:0 20px 60px rgba(0,0,0,.3);margin:auto 0;display:flex;flex-direction:column;overflow:hidden;}",
      ".mst-modal-hd{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 24px;border-bottom:1px solid var(--c-blue10,#d9e8f6);background:var(--lp-bg,#fff);border-radius:var(--r-lg,8px) var(--r-lg,8px) 0 0;flex:0 0 auto;}",
      '.mst-modal-title{margin:0;font-family:"Public Sans",sans-serif;font-size:1.35rem;font-weight:800;color:var(--lp-hl,#1a4480);}',
      ".mst-modal-close{border:0;background:transparent;cursor:pointer;color:var(--c-muted,#3d4551);padding:8px;border-radius:999px;line-height:0;flex:0 0 auto;}",
      ".mst-modal-close:hover{background:var(--lp-bg-alt,#eff6fb);}",
      ".mst-modal-close:focus-visible{outline:3px solid var(--lp-accent,#005ea2);outline-offset:2px;}",
      ".mst-modal-body{padding:20px 24px 28px;overflow-y:auto;flex:1 1 auto;position:relative;}",
      /* LeafFormGrid's base stylesheet applies position:sticky;top:0 directly
         to its <thead>/<th> elements. Inside our modal's shorter internal
         scroll container that sticks the header mid-table instead of at the
         top, overlapping rows. Override with a selector specific enough to
         beat LEAF's own rule. */
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
  function onSourceSettled(sourceKey) {
    var activeIdx = getActiveTabIndex();
    var tab = TABS[activeIdx];
    if (!tab || tab.sourceKeys.indexOf(sourceKey) === -1) return;
    updateSiteSummaryForTab(activeIdx);
    renderTabContent(activeIdx);
  }

  async function buildAndLoadGrid(rootEl) {
    buildShell(rootEl);

    var sourceKeys = Object.keys(SOURCE_SITES);
    sourceKeys.forEach(function (key) {
      siteState[stateKey(SOURCE_SITES[key])] = {
        data: null,
        rendered: false,
        error: null,
      };
    });

    // Paint whatever's already known (nothing yet, but this also covers
    // modal re-entry) before kicking off the fetches below.
    updateSiteSummaryForTab(getActiveTabIndex());
    renderTabContent(getActiveTabIndex());

    var fetches = sourceKeys.map(function (key) {
      var source = SOURCE_SITES[key];
      return fetchSiteData(source)
        .then(function (data) {
          siteState[stateKey(source)].data = data;
          onSourceSettled(key);
        })
        .catch(function (err) {
          siteState[stateKey(source)].error = err;
          console.error("[MultiSiteGrid] failed:", source.url, err);
          onSourceSettled(key);
        });
    });

    await Promise.allSettled(fetches);
  }

  function init() {
    injectStyles();

    var trigger = cfg.triggerId ? document.getElementById(cfg.triggerId) : null;

    if (trigger) {
      // Modal mode: build the overlay lazily, load grid data on first open only.
      trigger.addEventListener("click", openModal);
      return;
    }

    // Fallback: no trigger button configured -- mount inline exactly where
    // data-mount points (or append to body), same as before.
    var rootEl = cfg.mountId ? document.getElementById(cfg.mountId) : null;
    if (!rootEl) {
      rootEl = document.createElement("div");
      document.body.appendChild(rootEl);
    }
    rootEl.classList.add("mst-container");
    buildAndLoadGrid(rootEl);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
