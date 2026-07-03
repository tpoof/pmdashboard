/* ============================================================
   TEAM CONTINUITY CALENDAR — LEAF standalone app
   Pattern mirrors ideas_v2.js / project_v19.js:
     • Reads   → LeafFormQuery (global on LEAF sites)
     • Writes  → POST ./api/form/new  → POST ./api/form/{id} → submit
     • Records → opened in an iframe modal (printview)

   ============================================================
   ▼▼▼  CONFIG — FILL THIS IN AFTER YOU BUILD THE FORM  ▼▼▼
   ============================================================
   HOW TO GET THESE VALUES
   1. Build the "Calendar Entry" form in the Form Editor from the
      spec we agreed on (single, no-reviewer workflow step).
   2. Either:
        a) Report Builder → build a report on this form →
           JSON → "JavaScript Template" → copy the indicator IDs, OR
        b) Set window.leafCalendar.debug = true (in calendar.html),
           reload, and read the indicator list printed to the console.
   3. Replace every REPLACE_ME below with the real numeric ID.
   ------------------------------------------------------------ */
var CONFIG = {
  // Form category, e.g. "form_abc12"  (with the "form_" prefix)
  categoryID: "REPLACE_ME_form_xxxxx",

  // The BASE URL of THIS LEAF site's record printview.
  // ideas used: https://leaf.va.gov/platform/ideas/index.php?a=printview&recordID=
  // Change "ideas" to this site's slug. A relative fallback is used if left as-is.
  recordViewBase:
    "REPLACE_ME_https://leaf.va.gov/platform/<site>/index.php?a=printview&recordID=",

  // Numeric indicator IDs from the Calendar Entry form
  indicators: {
    entryDate: "REPLACE_ME", // Date       — the day the entry lands on
    entryType: "REPLACE_ME", // Dropdown   — Meeting Notes / Action Item / Out-of-Office / General Log
    title: "REPLACE_ME", // Text       — chip label
    body: "REPLACE_ME", // Textarea / rich text — details
    linked: "REPLACE_ME", // Textarea   — app-managed JSON list of {recordID, categoryID}
    status: "REPLACE_ME", // Dropdown   — Open / In Progress / Done / Carried Forward
    assignedTo: "REPLACE_ME", // Orgchart employee (empUID) — action-item owner
    dueDate: "REPLACE_ME", // Date       — action-item due date
    endDate: "REPLACE_ME", // Date       — OOO range end
    coveredBy: "REPLACE_ME", // Orgchart employee (empUID) — OOO coverage
  },

  // How many chips fit in a month cell before "+N more"
  monthCellChipLimit: 3,

  // Week starts on Sunday (0) or Monday (1)
  weekStartsOn: 0,
};
/* ▲▲▲  END CONFIG  ▲▲▲ */

/* ============================================================
   Runtime config from the page (Smarty-filled in LEAF)
   ============================================================ */
var pageConfig = window.leafCalendar || {};
var DEBUG = pageConfig.debug === true;

function sanitizeLeafValue(value) {
  return String(value || "")
    .replace(/<!--|-->/g, "")
    .trim();
}
var CSRF = sanitizeLeafValue(pageConfig.csrfToken);
var CURRENT_USER = sanitizeLeafValue(pageConfig.userID);

var TYPES = ["Meeting Notes", "Action Item", "Out-of-Office", "General Log"];
var TYPE_CLASS = {
  "Meeting Notes": "meeting",
  "Action Item": "action",
  "Out-of-Office": "ooo",
  "General Log": "log",
};

/* ============================================================
   State
   ============================================================ */
var state = {
  view: "month", // month | week | agenda
  cursor: startOfDay(new Date()), // the date the current view is centered on
  entries: [], // normalized entry view-models
  entriesByDate: {}, // 'YYYY-MM-DD' -> [entry]
  authors: {}, // userID -> display name
  filters: { type: "", author: "", search: "", showClosed: false },
  editing: null, // entry being edited (or null for new)
  draftLinks: [], // [{recordID, categoryID, title, formName}]
  draftAssigned: null, // {empUID, name}
  draftCovered: null, // {empUID, name}
};

/* ============================================================
   Small utilities
   ============================================================ */
function logDebug() {
  if (!DEBUG) return;
  console.log.apply(console, ["[Calendar]"].concat([].slice.call(arguments)));
}

function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeEntities(str) {
  if (!str || typeof str !== "string") return str;
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/g, "'");
}

function debounce(fn, delay) {
  var timer;
  return function () {
    var ctx = this,
      args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () {
      fn.apply(ctx, args);
    }, delay);
  };
}

function announce(msg, assertive) {
  var node = byId(assertive ? "cal-live-assertive" : "cal-live-polite");
  if (!node) return;
  node.textContent = "";
  setTimeout(function () {
    node.textContent = msg;
  }, 50);
}

function setStatus(msg, isError) {
  var el = byId("calStatus");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("is-error", !!isError);
}

/* ── Date helpers (local-time, no UTC drift) ─────────────── */
function startOfDay(d) {
  var x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function ymd(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}
function parseYMD(s) {
  if (!s) return null;
  var m = String(s)
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    var d = new Date(s);
    return isNaN(d) ? null : startOfDay(d);
  }
  return new Date(+m[1], +m[2] - 1, +m[3]);
}
function addDays(d, n) {
  var x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameDay(a, b) {
  return a && b && ymd(a) === ymd(b);
}
function isTodayDate(d) {
  return sameDay(d, new Date());
}

var MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
var DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
var DOW_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function orderedDow() {
  var out = [];
  for (var i = 0; i < 7; i++) out.push((CONFIG.weekStartsOn + i) % 7);
  return out;
}
function startOfWeek(d) {
  var x = startOfDay(d);
  var diff = (x.getDay() - CONFIG.weekStartsOn + 7) % 7;
  return addDays(x, -diff);
}
function fmtLongDate(d) {
  return (
    DOW_LONG[d.getDay()] +
    ", " +
    MONTHS[d.getMonth()] +
    " " +
    d.getDate() +
    ", " +
    d.getFullYear()
  );
}

/* ============================================================
   LEAF API helpers
   ============================================================ */
function recordViewURL(recordID) {
  var base = CONFIG.recordViewBase || "";
  if (!base || base.indexOf("REPLACE_ME") === 0) {
    // Relative fallback — works when the app is served from the site root
    return "index.php?a=printview&recordID=" + encodeURIComponent(recordID);
  }
  return base + encodeURIComponent(recordID);
}

function encodeBody(obj) {
  var body = new URLSearchParams();
  Object.keys(obj || {}).forEach(function (k) {
    var v = obj[k];
    if (v === undefined || v === null) return;
    body.append(String(k), String(v));
  });
  return body.toString();
}

// POST helper returning text (or parsed JSON when possible)
async function apiPost(url, dataObj) {
  var res = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-requested-with": "XMLHttpRequest",
    },
    body: encodeBody(dataObj),
  });
  if (!res.ok) throw new Error("POST " + url + " → HTTP " + res.status);
  var text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    return text;
  }
}

async function apiGet(url) {
  var res = await fetch(url, {
    credentials: "same-origin",
    headers: {
      "x-requested-with": "XMLHttpRequest",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error("GET " + url + " → HTTP " + res.status);
  return res.json();
}

// Create a record of CONFIG.categoryID; returns the new numeric recordID
async function createRecord() {
  var numKey = "num" + String(CONFIG.categoryID).replace("form_", "");
  var payload = { CSRFToken: CSRF, title: "Calendar Entry" };
  payload[numKey] = numKey;
  payload["numform_" + String(CONFIG.categoryID).replace("form_", "")] = 1;
  var res = await apiPost("./api/form/new", payload);
  var id = parseInt(String(res).trim().replace(/^"|"$/g, ""), 10);
  if (!id || id <= 0) throw new Error("Record creation returned no ID: " + res);
  return id;
}

// Write indicator values to a record
async function writeIndicators(recordID, indicatorValues) {
  var payload = { CSRFToken: CSRF, series: 1 };
  Object.keys(indicatorValues).forEach(function (indID) {
    if (indID && indID !== "REPLACE_ME")
      payload[indID] = indicatorValues[indID];
  });
  return apiPost("./api/form/" + encodeURIComponent(recordID), payload);
}

// Submit a freshly-created record into its (single-step) workflow so it's live
async function submitRecord(recordID) {
  try {
    await apiPost("./api/form/" + encodeURIComponent(recordID) + "/submit", {
      CSRFToken: CSRF,
    });
  } catch (e) {
    logDebug("submit skipped/failed (record may already be live):", e.message);
  }
}

/* ============================================================
   Diagnostics — discover indicator IDs / categories
   Runs when window.leafCalendar.debug = true
   ============================================================ */
async function runDiagnostics() {
  console.log("=== CALENDAR DIAGNOSTICS ===");
  console.log("Configured categoryID:", CONFIG.categoryID);
  try {
    var cats = await apiGet("./api/workflow/categoriesUnabridged");
    console.log("--- Forms available on this site ---");
    (Array.isArray(cats) ? cats : Object.values(cats || {})).forEach(
      function (c) {
        console.log(
          "  " + (c.categoryID || c.id) + " => " + (c.categoryName || c.name),
        );
      },
    );
  } catch (e) {
    console.log("Could not list categories:", e.message);
  }

  if (CONFIG.categoryID && CONFIG.categoryID.indexOf("REPLACE_ME") !== 0) {
    try {
      var raw = String(CONFIG.categoryID).replace("form_", "");
      var inds = await apiGet(
        "./api/formEditor/indicator/list/category/" + raw,
      );
      console.log("--- Indicator IDs for " + CONFIG.categoryID + " ---");
      Object.keys(inds || {}).forEach(function (k) {
        var i = inds[k];
        console.log(
          "  id " +
            k +
            " | " +
            (i.name || i.description || "") +
            " | format: " +
            (i.format || i.input_type || ""),
        );
      });
      console.log(">>> Copy these numbers into CONFIG.indicators above.");
    } catch (e) {
      console.log(
        "Could not fetch indicator list — build the form first, then set categoryID.",
        e.message,
      );
    }
  } else {
    console.log(
      ">>> Set CONFIG.categoryID first, then reload to see indicator IDs.",
    );
  }
}

/* ============================================================
   Data loading — read all Calendar Entry records
   ============================================================ */
function indVal(series, indID) {
  if (!indID || indID === "REPLACE_ME") return "";
  if (!series) return "";
  // LEAF result shapes: s1.id{ID}.value | s1.id{ID} | s1[ID].value | s1[ID]
  var v = series["id" + indID];
  if (v && typeof v === "object" && "value" in v) v = v.value;
  if (v == null) {
    var v2 = series[indID];
    if (v2 && typeof v2 === "object" && "value" in v2) v2 = v2.value;
    v = v2;
  }
  return v == null ? "" : decodeEntities(String(v));
}

function safeParseLinks(raw) {
  if (!raw) return [];
  try {
    var arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return arr
        .map(function (o) {
          if (o == null) return null;
          if (typeof o === "number" || typeof o === "string") {
            return { recordID: String(o), categoryID: "" };
          }
          return {
            recordID: String(o.recordID || o.id || ""),
            categoryID: String(o.categoryID || ""),
          };
        })
        .filter(function (o) {
          return o && o.recordID;
        });
    }
  } catch (e) {
    /* fall through to delimiter parse */
  }
  // Fallback: comma/space separated recordIDs
  return String(raw)
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map(function (id) {
      return { recordID: id, categoryID: "" };
    });
}

function normalizeEntry(recordID, rec) {
  var series = rec.s1 || rec;
  var I = CONFIG.indicators;
  var type = indVal(series, I.entryType) || "General Log";
  var dateStr = indVal(series, I.entryDate);
  var d = parseYMD(dateStr) || parseYMD(rec.date) || null;
  return {
    recordID: String(recordID),
    type: type,
    typeClass: TYPE_CLASS[type] || "log",
    date: d,
    dateKey: d ? ymd(d) : "",
    title: indVal(series, I.title) || rec.title || "(untitled)",
    body: indVal(series, I.body),
    status: indVal(series, I.status),
    dueDate: parseYMD(indVal(series, I.dueDate)),
    endDate: parseYMD(indVal(series, I.endDate)),
    assignedTo: indVal(series, I.assignedTo),
    coveredBy: indVal(series, I.coveredBy),
    links: safeParseLinks(indVal(series, I.linked)),
    author: rec.userID || rec.initiatorName || "",
    authorName: rec.initiatorName || rec.userID || "",
    lastUpdated: rec.lastUpdated || "",
  };
}

async function loadEntries() {
  setStatus("Loading entries…");
  if (typeof LeafFormQuery === "undefined") {
    setStatus(
      "LeafFormQuery is not available — this page must run inside LEAF.",
      true,
    );
    throw new Error("LeafFormQuery missing");
  }
  var I = CONFIG.indicators;
  var q = new LeafFormQuery();
  q.addTerm("categoryID", "=", CONFIG.categoryID);
  q.addTerm("deleted", "=", 0);
  q.join("initiatorName");
  q.getData(
    [
      I.entryDate,
      I.entryType,
      I.title,
      I.body,
      I.linked,
      I.status,
      I.assignedTo,
      I.dueDate,
      I.endDate,
      I.coveredBy,
    ].filter(function (x) {
      return x && x !== "REPLACE_ME";
    }),
  );
  q.setExtraParams(
    "&x-filterData=recordID,title,userID,initiatorName,lastUpdated,s1",
  );

  var res = await q.execute();
  var entries = [];
  Object.keys(res || {}).forEach(function (rid) {
    var e = normalizeEntry(rid, res[rid]);
    if (e.date) entries.push(e);
  });

  state.entries = entries;
  indexEntries();
  buildAuthorFilter();
  await resolveLinkTitles();
  logDebug("Loaded entries:", entries.length);
  setStatus("");
}

function indexEntries() {
  var map = {};
  // Carry-forward: open/in-progress action items also appear on "today" until closed
  var todayKey = ymd(new Date());
  state.entries.forEach(function (e) {
    (map[e.dateKey] = map[e.dateKey] || []).push(e);

    // OOO ranges: also index each day between date..endDate
    if (e.type === "Out-of-Office" && e.endDate && e.endDate > e.date) {
      var cur = addDays(e.date, 1);
      while (cur <= e.endDate) {
        var k = ymd(cur);
        var clone = Object.assign({}, e, { _spanDay: true, dateKey: k });
        (map[k] = map[k] || []).push(clone);
        cur = addDays(cur, 1);
      }
    }

    // Carry-forward open action items onto today (if the entry is in the past)
    if (
      e.type === "Action Item" &&
      (e.status === "Open" ||
        e.status === "In Progress" ||
        e.status === "Carried Forward") &&
      e.dateKey &&
      e.dateKey < todayKey
    ) {
      if (todayKey !== e.dateKey) {
        var cf = Object.assign({}, e, {
          _carriedForward: true,
          dateKey: todayKey,
        });
        (map[todayKey] = map[todayKey] || []).push(cf);
      }
    }
  });
  state.entriesByDate = map;
}

function buildAuthorFilter() {
  var sel = byId("calFilterAuthor");
  if (!sel) return;
  var seen = {};
  state.entries.forEach(function (e) {
    if (e.author && !seen[e.author]) {
      seen[e.author] = e.authorName || e.author;
    }
  });
  state.authors = seen;
  var keep = sel.value;
  sel.innerHTML = '<option value="">Everyone</option>';
  Object.keys(seen)
    .sort(function (a, b) {
      return String(seen[a]).localeCompare(String(seen[b]));
    })
    .forEach(function (uid) {
      var o = document.createElement("option");
      o.value = uid;
      o.textContent = seen[uid];
      sel.appendChild(o);
    });
  sel.value = keep;
}

// Resolve titles for all linked records in one batched query, so chips show live names
async function resolveLinkTitles() {
  var ids = {};
  state.entries.forEach(function (e) {
    e.links.forEach(function (l) {
      if (l.recordID) ids[l.recordID] = true;
    });
  });
  var idList = Object.keys(ids);
  if (!idList.length || typeof LeafFormQuery === "undefined") return;
  try {
    var q = new LeafFormQuery();
    q.addTerm("recordID", "=", idList.join(","));
    q.join("categoryName");
    q.setExtraParams(
      "&x-filterData=recordID,title,categoryID,categoryName,categoryNames",
    );
    var res = await q.execute();
    var titleMap = {};
    Object.keys(res || {}).forEach(function (rid) {
      var r = res[rid];
      titleMap[rid] = {
        title: decodeEntities(r.title || "#" + rid),
        formName:
          r.categoryName ||
          (Array.isArray(r.categoryNames) ? r.categoryNames.join(", ") : "") ||
          "",
        categoryID: r.categoryID || "",
      };
    });
    state.entries.forEach(function (e) {
      e.links.forEach(function (l) {
        var m = titleMap[l.recordID];
        if (m) {
          l.title = m.title;
          l.formName = m.formName;
          if (!l.categoryID) l.categoryID = m.categoryID;
        } else if (!l.title) {
          l.title = "#" + l.recordID;
        }
      });
    });
  } catch (e) {
    logDebug("Link title resolution failed:", e.message);
  }
}

/* ============================================================
   Filtering
   ============================================================ */
function passesFilter(e) {
  var f = state.filters;
  if (f.type && e.type !== f.type) return false;
  if (f.author && e.author !== f.author) return false;
  if (
    !f.showClosed &&
    e.type === "Action Item" &&
    e.status === "Done" &&
    !e._carriedForward
  ) {
    // closed items hidden unless the toggle is on
    return false;
  }
  if (f.search) {
    var hay = (e.title + " " + stripHtml(e.body)).toLowerCase();
    if (hay.indexOf(f.search.toLowerCase()) === -1) return false;
  }
  return true;
}

function stripHtml(html) {
  if (!html) return "";
  var tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

function entriesForDay(dateKey) {
  var list = (state.entriesByDate[dateKey] || []).filter(passesFilter);
  // Stable order: type priority then title
  var order = {
    "Out-of-Office": 0,
    "Meeting Notes": 1,
    "Action Item": 2,
    "General Log": 3,
  };
  return list.sort(function (a, b) {
    return order[a.type] - order[b.type] || a.title.localeCompare(b.title);
  });
}

/* ============================================================
   Rendering — shared chip / helpers
   ============================================================ */
function chipLabel(e) {
  if (e._spanDay && e.type === "Out-of-Office") {
    return e.title + " (out)";
  }
  return e.title;
}

function chipHTML(e) {
  var cls = "cal-chip t-" + e.typeClass;
  if (e.type === "Action Item" && e.status === "Done") cls += " is-done";
  if (e._carriedForward) cls += " is-carried";
  var prefix = e._carriedForward ? "↺ " : "";
  return (
    '<button type="button" class="' +
    cls +
    '" data-record="' +
    escapeHtml(e.recordID) +
    '" ' +
    'title="' +
    escapeHtml(e.type + ": " + e.title) +
    '">' +
    escapeHtml(prefix) +
    escapeHtml(chipLabel(e)) +
    "</button>"
  );
}

/* ── Month view ──────────────────────────────────────────── */
function renderMonth() {
  var head = byId("calWeekHead");
  var grid = byId("calMonthGrid");
  if (!head || !grid) return;

  head.innerHTML = orderedDow()
    .map(function (d) {
      return "<div>" + DOW_SHORT[d] + "</div>";
    })
    .join("");

  var first = new Date(state.cursor.getFullYear(), state.cursor.getMonth(), 1);
  var gridStart = startOfWeek(first);
  var html = "";
  for (var i = 0; i < 42; i++) {
    var day = addDays(gridStart, i);
    var key = ymd(day);
    var outside = day.getMonth() !== state.cursor.getMonth();
    var list = entriesForDay(key);
    var limit = CONFIG.monthCellChipLimit;
    var shown = list.slice(0, limit);
    var extra = list.length - shown.length;

    html +=
      '<div class="cal-dayCell' +
      (outside ? " is-outside" : "") +
      (isTodayDate(day) ? " is-today" : "") +
      '" data-day="' +
      key +
      '" ' +
      'tabindex="0" role="button" aria-label="' +
      escapeHtml(fmtLongDate(day)) +
      ", " +
      list.length +
      ' entries">';
    html += '<span class="cal-dayNum">' + day.getDate() + "</span>";
    html += '<div class="cal-dayChips">';
    shown.forEach(function (e) {
      html += chipHTML(e);
    });
    if (extra > 0) {
      html +=
        '<button type="button" class="cal-moreLink" data-more="' +
        key +
        '">+' +
        extra +
        " more</button>";
    }
    html += "</div></div>";

    if (
      i >= 34 &&
      day.getMonth() !== state.cursor.getMonth() &&
      day.getDay() === orderedDow()[6]
    ) {
      // stop after the week that completes the month to avoid a trailing empty row
      if (
        day >
        new Date(state.cursor.getFullYear(), state.cursor.getMonth() + 1, 0)
      )
        break;
    }
  }
  grid.innerHTML = html;
}

/* ── Week view ───────────────────────────────────────────── */
function renderWeek() {
  var board = byId("calWeekBoard");
  if (!board) return;
  var start = startOfWeek(state.cursor);
  var html = "";
  for (var i = 0; i < 7; i++) {
    var day = addDays(start, i);
    var key = ymd(day);
    var list = entriesForDay(key);
    var today = isTodayDate(day);
    html += '<div class="cal-weekCol">';
    html +=
      '<div class="cal-weekColHead' +
      (today ? " is-today" : "") +
      '">' +
      '<div class="cal-weekDow">' +
      DOW_SHORT[day.getDay()] +
      "</div>" +
      '<div class="cal-weekDate">' +
      day.getDate() +
      "</div></div>";
    html += '<div class="cal-weekColBody" data-day="' + key + '">';
    if (!list.length) {
      html += '<span style="font-size:12px;color:#97a1ad">No entries</span>';
    } else {
      list.forEach(function (e) {
        var meta = weekCardMeta(e);
        html +=
          '<div class="cal-weekCard t-' +
          e.typeClass +
          '" data-record="' +
          escapeHtml(e.recordID) +
          '">' +
          '<div class="cal-weekCardType">' +
          escapeHtml(e.type) +
          (e._carriedForward ? " ↺" : "") +
          "</div>" +
          '<div class="cal-weekCardTitle">' +
          escapeHtml(e.title) +
          "</div>" +
          (meta ? '<div class="cal-weekCardMeta">' + meta + "</div>" : "") +
          "</div>";
      });
    }
    html += "</div></div>";
  }
  board.innerHTML = html;
}

function weekCardMeta(e) {
  var bits = [];
  if (e.type === "Action Item") {
    if (e.status) bits.push(escapeHtml(e.status));
    if (e.assignedTo) bits.push("👤 " + escapeHtml(peopleLabel(e.assignedTo)));
  }
  if (e.type === "Out-of-Office" && e.coveredBy)
    bits.push("Covered: " + escapeHtml(peopleLabel(e.coveredBy)));
  if (e.links && e.links.length) bits.push("🔗 " + e.links.length);
  return bits.join(" · ");
}

/* ── Agenda view ─────────────────────────────────────────── */
function renderAgenda() {
  var wrap = byId("calAgenda");
  if (!wrap) return;
  // Agenda spans the visible month, day by day, only days with entries
  var first = new Date(state.cursor.getFullYear(), state.cursor.getMonth(), 1);
  var last = new Date(
    state.cursor.getFullYear(),
    state.cursor.getMonth() + 1,
    0,
  );
  var html = "";
  var anyDay = false;
  for (var day = new Date(first); day <= last; day = addDays(day, 1)) {
    var key = ymd(day);
    var list = entriesForDay(key);
    if (!list.length) continue;
    anyDay = true;
    var today = isTodayDate(day);
    html += '<div class="cal-agendaDay">';
    html +=
      '<div class="cal-agendaDayHead' +
      (today ? " is-today" : "") +
      '">' +
      escapeHtml(fmtLongDate(day)) +
      '<span class="cal-agendaCount">' +
      list.length +
      " " +
      (list.length === 1 ? "entry" : "entries") +
      "</span></div>";
    html += '<div class="cal-agendaList">';
    list.forEach(function (e) {
      html += agendaItemHTML(e);
    });
    html += "</div></div>";
  }
  if (!anyDay) {
    html =
      '<div class="cal-emptyState"><span class="material-symbols-outlined">event_busy</span>' +
      "<p>No entries this month. Use <strong>New entry</strong> to add one.</p></div>";
  }
  wrap.innerHTML = html;
}

function agendaItemHTML(e) {
  var meta = [];
  if (e.type === "Action Item") {
    if (e.status) meta.push("Status: " + escapeHtml(e.status));
    if (e.assignedTo)
      meta.push("Assigned: " + escapeHtml(peopleLabel(e.assignedTo)));
    if (e.dueDate) meta.push("Due " + ymd(e.dueDate));
  }
  if (e.type === "Out-of-Office") {
    if (e.endDate && e.endDate > e.date) meta.push("Through " + ymd(e.endDate));
    if (e.coveredBy)
      meta.push("Covered by " + escapeHtml(peopleLabel(e.coveredBy)));
  }
  if (e.authorName) meta.push("by " + escapeHtml(e.authorName));
  var linkPill =
    e.links && e.links.length
      ? '<span class="cal-linkCountPill"><span class="material-symbols-outlined" style="font-size:15px">link</span>' +
        e.links.length +
        "</span>"
      : "";
  return (
    '<div class="cal-agendaItem t-' +
    e.typeClass +
    '" data-record="' +
    escapeHtml(e.recordID) +
    '">' +
    '<span class="cal-agendaBadge t-' +
    e.typeClass +
    '">' +
    escapeHtml(e.type) +
    (e._carriedForward ? " ↺" : "") +
    "</span>" +
    '<div class="cal-agendaBody"><div class="cal-agendaTitle">' +
    escapeHtml(e.title) +
    "</div>" +
    (meta.length
      ? '<div class="cal-agendaMeta">' +
        meta.join(" · ") +
        " " +
        linkPill +
        "</div>"
      : linkPill
        ? '<div class="cal-agendaMeta">' + linkPill + "</div>"
        : "") +
    "</div></div>"
  );
}

// Display label for an empUID we may have cached; falls back to the raw value
var peopleCache = {}; // empUID -> name
function peopleLabel(empUID) {
  if (!empUID) return "";
  return peopleCache[empUID] || String(empUID);
}

/* ── View switch ─────────────────────────────────────────── */
function render() {
  updateRangeLabel();
  byId("calMonthView").hidden = state.view !== "month";
  byId("calWeekView").hidden = state.view !== "week";
  byId("calAgendaView").hidden = state.view !== "agenda";
  if (state.view === "month") renderMonth();
  else if (state.view === "week") renderWeek();
  else renderAgenda();
}

function updateRangeLabel() {
  var el = byId("calRangeLabel");
  if (!el) return;
  if (state.view === "week") {
    var s = startOfWeek(state.cursor),
      e = addDays(s, 6);
    var label = MONTHS[s.getMonth()].slice(0, 3) + " " + s.getDate();
    label +=
      " – " +
      (s.getMonth() === e.getMonth()
        ? ""
        : MONTHS[e.getMonth()].slice(0, 3) + " ") +
      e.getDate() +
      ", " +
      e.getFullYear();
    el.textContent = label;
  } else {
    el.textContent =
      MONTHS[state.cursor.getMonth()] + " " + state.cursor.getFullYear();
  }
}

/* ============================================================
   Modal plumbing (focus trap + open/close)
   ============================================================ */
var modalStack = [];
function getFocusable(container) {
  return Array.prototype.slice
    .call(
      container.querySelectorAll(
        'a[href],button:not([disabled]),textarea,input:not([disabled]),select:not([disabled]),iframe,[tabindex]:not([tabindex="-1"]),[contenteditable="true"]',
      ),
    )
    .filter(function (el) {
      return el.offsetParent !== null || el === document.activeElement;
    });
}
function trapKey(e, modal) {
  if (e.key !== "Tab") return;
  var f = getFocusable(modal);
  if (!f.length) return;
  var first = f[0],
    last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}
function openModal(id) {
  var modal = byId(id);
  if (!modal) return;
  modal._lastFocus = document.activeElement;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  modal._trap = function (e) {
    trapKey(e, modal);
  };
  modal.addEventListener("keydown", modal._trap);
  modalStack.push(modal);
  var f = getFocusable(modal);
  if (f[0]) f[0].focus();
}
function closeModal(id) {
  var modal = byId(id);
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  if (modal._trap) modal.removeEventListener("keydown", modal._trap);
  modalStack = modalStack.filter(function (m) {
    return m !== modal;
  });
  if (modal._lastFocus && modal._lastFocus.focus) modal._lastFocus.focus();
}

/* ============================================================
   Record viewer (iframe)
   ============================================================ */
function openRecord(recordID, title) {
  var frame = byId("calRecordFrame");
  var titleEl = byId("calRecordModalTitle");
  var openTab = byId("calRecordOpenTab");
  var url = recordViewURL(recordID);
  if (titleEl) titleEl.textContent = title || "Record #" + recordID;
  if (openTab) openTab.href = url;
  if (frame) frame.src = url;
  openModal("calRecordModal");
}

/* ============================================================
   Entry modal — open / populate / conditional fields
   ============================================================ */
function typeToClass(t) {
  return TYPE_CLASS[t] || "log";
}

function applyConditionalFields(type) {
  byId("calCondAction").hidden = type !== "Action Item";
  byId("calCondOoo").hidden = type !== "Out-of-Office";
}

function openEntryModal(entry, presetDate) {
  state.editing = entry || null;
  state.draftLinks = entry
    ? entry.links.map(function (l) {
        return Object.assign({}, l);
      })
    : [];
  state.draftAssigned = null;
  state.draftCovered = null;

  byId("calEntryModalTitle").textContent = entry ? "Edit entry" : "New entry";
  byId("calSaveBtn").textContent = entry ? "Save changes" : "Save entry";
  byId("calDeleteBtn").hidden = !entry;
  byId("calEntryMsg").textContent = "";

  byId("calEntryRecordID").value = entry ? entry.recordID : "";
  byId("calFldDate").value =
    entry && entry.date ? ymd(entry.date) : presetDate || ymd(new Date());
  byId("calFldType").value = entry ? entry.type : "";
  byId("calFldTitle").value = entry ? entry.title : "";
  byId("calFldBody").innerHTML = entry ? entry.body || "" : "";
  byId("calFldBody").setAttribute(
    "data-placeholder",
    "Notes, decisions, links…",
  );

  byId("calFldStatus").value = entry && entry.status ? entry.status : "Open";
  byId("calFldDue").value = entry && entry.dueDate ? ymd(entry.dueDate) : "";
  byId("calFldEnd").value = entry && entry.endDate ? ymd(entry.endDate) : "";

  // People
  if (entry && entry.assignedTo)
    state.draftAssigned = {
      empUID: entry.assignedTo,
      name: peopleLabel(entry.assignedTo),
    };
  if (entry && entry.coveredBy)
    state.draftCovered = {
      empUID: entry.coveredBy,
      name: peopleLabel(entry.coveredBy),
    };
  renderPeopleSelected("assigned");
  renderPeopleSelected("covered");

  applyConditionalFields(entry ? entry.type : "");
  renderDraftLinks();
  openModal("calEntryModal");
}

function renderDraftLinks() {
  var wrap = byId("calLinkChips");
  if (!wrap) return;
  if (!state.draftLinks.length) {
    wrap.innerHTML =
      '<span style="font-size:13px;color:#97a1ad">No records linked yet.</span>';
    return;
  }
  wrap.innerHTML = state.draftLinks
    .map(function (l, idx) {
      var label = l.title || "#" + l.recordID;
      var form = l.formName
        ? ' <span class="cal-linkChipForm">· ' +
          escapeHtml(l.formName) +
          "</span>"
        : "";
      return (
        '<span class="cal-linkChip">' +
        '<span class="cal-linkChipMain" data-open-link="' +
        idx +
        '">' +
        '<span class="material-symbols-outlined" style="font-size:15px">description</span>' +
        escapeHtml(label) +
        "</span>" +
        form +
        '<button type="button" data-remove-link="' +
        idx +
        '" aria-label="Remove link">' +
        '<span class="material-symbols-outlined">close</span></button></span>'
      );
    })
    .join("");
}

/* ============================================================
   People picker (orgchart)
   ============================================================ */
function renderPeopleSelected(role) {
  var containerId =
    role === "assigned" ? "calAssignedSelected" : "calCoveredSelected";
  var searchId = role === "assigned" ? "calAssignedSearch" : "calCoveredSearch";
  var person = role === "assigned" ? state.draftAssigned : state.draftCovered;
  var el = byId(containerId);
  var search = byId(searchId);
  if (!el) return;
  if (person && person.empUID) {
    el.innerHTML =
      '<span class="cal-personChip">' +
      escapeHtml(person.name || person.empUID) +
      '<button type="button" data-clear-person="' +
      role +
      '" aria-label="Remove">' +
      '<span class="material-symbols-outlined">close</span></button></span>';
    if (search) search.style.display = "none";
  } else {
    el.innerHTML = "";
    if (search) search.style.display = "";
  }
}

async function searchPeople(term, role) {
  var listId = role === "assigned" ? "calAssignedResults" : "calCoveredResults";
  var listEl = byId(listId);
  if (!listEl) return;
  if (!term || term.length < 2) {
    listEl.hidden = true;
    return;
  }
  try {
    var res = await apiGet(
      "./api/orgchart/employee/search?q=" +
        encodeURIComponent(term) +
        "&noLimit=0",
    );
    var rows = Array.isArray(res) ? res : Object.values(res || {});
    if (!rows.length) {
      listEl.innerHTML = '<li aria-disabled="true">No matches</li>';
      listEl.hidden = false;
      return;
    }
    listEl.innerHTML = rows
      .slice(0, 8)
      .map(function (p) {
        var name = decodeEntities(
          p.lastName && p.firstName
            ? p.firstName + " " + p.lastName
            : p.name || p.userName || "#" + (p.empUID || ""),
        );
        var uid = p.empUID || p.empUID === 0 ? p.empUID : p.empUID || "";
        return (
          '<li role="option" data-empuid="' +
          escapeHtml(uid) +
          '" data-name="' +
          escapeHtml(name) +
          '" data-role="' +
          role +
          '">' +
          escapeHtml(name) +
          "<small>" +
          escapeHtml(p.userName || p.email || "") +
          "</small></li>"
        );
      })
      .join("");
    listEl.hidden = false;
  } catch (e) {
    listEl.innerHTML = '<li aria-disabled="true">Search unavailable</li>';
    listEl.hidden = false;
    logDebug("people search failed:", e.message);
  }
}

// Import an employee into the local orgchart so their empUID resolves later.
async function importEmployee(userName) {
  if (!userName) return;
  try {
    await apiPost(
      "./api/orgchart/employee/import/_" + encodeURIComponent(userName),
      { CSRFToken: CSRF },
    );
  } catch (e) {
    logDebug("employee import skipped:", e.message);
  }
}

function pickPerson(role, empUID, name, userName) {
  peopleCache[empUID] = name;
  if (role === "assigned")
    state.draftAssigned = { empUID: empUID, name: name, userName: userName };
  else state.draftCovered = { empUID: empUID, name: name, userName: userName };
  renderPeopleSelected(role);
  var listId = role === "assigned" ? "calAssignedResults" : "calCoveredResults";
  if (byId(listId)) byId(listId).hidden = true;
  if (userName) importEmployee(userName);
}

/* ============================================================
   Link picker — search across ALL forms
   ============================================================ */
var linkFormFilterReady = false;
async function ensureLinkFormFilter() {
  if (linkFormFilterReady) return;
  var sel = byId("calLinkFormFilter");
  if (!sel) return;
  try {
    var cats = await apiGet("./api/workflow/categoriesUnabridged");
    var arr = (Array.isArray(cats) ? cats : Object.values(cats || {})).filter(
      function (c) {
        return c && (c.categoryName || c.name);
      },
    );
    arr.sort(function (a, b) {
      return String(a.categoryName || a.name).localeCompare(
        String(b.categoryName || b.name),
      );
    });
    arr.forEach(function (c) {
      var o = document.createElement("option");
      o.value = c.categoryID || c.id;
      o.textContent = c.categoryName || c.name;
      sel.appendChild(o);
    });
    linkFormFilterReady = true;
  } catch (e) {
    logDebug("form filter load failed:", e.message);
  }
}

var linkSearchRun = debounce(function () {
  var term = byId("calLinkSearch").value.trim();
  var formFilter = byId("calLinkFormFilter").value;
  runLinkSearch(term, formFilter);
}, 250);

async function runLinkSearch(term, formFilter) {
  var out = byId("calLinkResults");
  if (!out) return;
  if (!term || term.length < 2) {
    out.innerHTML =
      '<p class="cal-linkHint">Type at least 2 characters to search across all forms.</p>';
    return;
  }
  out.innerHTML = '<p class="cal-linkHint">Searching…</p>';
  try {
    var q = new LeafFormQuery();
    q.addTerm("title", "LIKE", "%" + term + "%");
    q.addTerm("deleted", "=", 0);
    if (formFilter) q.addTerm("categoryID", "=", formFilter);
    q.join("categoryName");
    q.setLimit(40);
    q.setExtraParams(
      "&x-filterData=recordID,title,categoryID,categoryName,categoryNames",
    );
    var res = await q.execute();
    var rows = Object.keys(res || {}).map(function (rid) {
      var r = res[rid];
      return {
        recordID: rid,
        title: decodeEntities(r.title || "#" + rid),
        categoryID: r.categoryID || "",
        formName:
          r.categoryName ||
          (Array.isArray(r.categoryNames) ? r.categoryNames.join(", ") : "") ||
          "",
      };
    });
    if (!rows.length) {
      out.innerHTML =
        '<p class="cal-linkHint">No records match “' +
        escapeHtml(term) +
        "”.</p>";
      return;
    }
    var linkedIds = {};
    state.draftLinks.forEach(function (l) {
      linkedIds[l.recordID] = true;
    });
    out.innerHTML = rows
      .map(function (r) {
        var isLinked = !!linkedIds[r.recordID];
        return (
          '<div class="cal-linkResult' +
          (isLinked ? " is-linked" : "") +
          '" ' +
          'data-record="' +
          escapeHtml(r.recordID) +
          '" data-cat="' +
          escapeHtml(r.categoryID) +
          '" ' +
          'data-title="' +
          escapeHtml(r.title) +
          '" data-form="' +
          escapeHtml(r.formName) +
          '">' +
          '<div class="cal-linkResultMain"><div class="cal-linkResultTitle">' +
          escapeHtml(r.title) +
          "</div>" +
          '<div class="cal-linkResultMeta">' +
          escapeHtml(r.formName || "Form") +
          " · #" +
          escapeHtml(r.recordID) +
          "</div></div>" +
          '<span class="cal-linkResultAdd">' +
          (isLinked ? "✓ Linked" : "+ Add") +
          "</span></div>"
        );
      })
      .join("");
  } catch (e) {
    out.innerHTML =
      '<p class="cal-linkHint">Search failed. ' +
      escapeHtml(e.message) +
      "</p>";
  }
}

function toggleDraftLink(recordID, categoryID, title, formName) {
  var idx = state.draftLinks.findIndex(function (l) {
    return l.recordID === recordID;
  });
  if (idx >= 0) state.draftLinks.splice(idx, 1);
  else
    state.draftLinks.push({
      recordID: recordID,
      categoryID: categoryID,
      title: title,
      formName: formName,
    });
  renderDraftLinks();
  // reflect in the open search list
  var term = byId("calLinkSearch").value.trim();
  runLinkSearch(term, byId("calLinkFormFilter").value);
}

/* ============================================================
   Save / delete
   ============================================================ */
async function saveEntry() {
  var msg = byId("calEntryMsg");
  msg.textContent = "";
  var I = CONFIG.indicators;

  var type = byId("calFldType").value;
  var date = byId("calFldDate").value;
  var title = byId("calFldTitle").value.trim();

  if (!date) {
    msg.textContent = "Pick a date.";
    byId("calFldDate").focus();
    return;
  }
  if (!type) {
    msg.textContent = "Choose an entry type.";
    byId("calFldType").focus();
    return;
  }
  if (!title) {
    msg.textContent = "Add a title.";
    byId("calFldTitle").focus();
    return;
  }

  var saveBtn = byId("calSaveBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  // Build indicator payload
  var values = {};
  values[I.entryDate] = date;
  values[I.entryType] = type;
  values[I.title] = title;
  values[I.body] = byId("calFldBody").innerHTML.trim();
  values[I.linked] = JSON.stringify(
    state.draftLinks.map(function (l) {
      return { recordID: l.recordID, categoryID: l.categoryID || "" };
    }),
  );

  if (type === "Action Item") {
    values[I.status] = byId("calFldStatus").value;
    values[I.dueDate] = byId("calFldDue").value || "";
    values[I.assignedTo] = state.draftAssigned
      ? state.draftAssigned.empUID
      : "";
  } else {
    values[I.status] = "";
    values[I.dueDate] = "";
    values[I.assignedTo] = "";
  }
  if (type === "Out-of-Office") {
    values[I.endDate] = byId("calFldEnd").value || "";
    values[I.coveredBy] = state.draftCovered ? state.draftCovered.empUID : "";
  } else {
    values[I.endDate] = "";
    values[I.coveredBy] = "";
  }

  try {
    var recordID = byId("calEntryRecordID").value;
    var isNew = !recordID;
    if (isNew) {
      recordID = await createRecord();
    }
    await writeIndicators(recordID, values);
    if (isNew) await submitRecord(recordID);

    closeModal("calEntryModal");
    announce(isNew ? "Entry created." : "Entry saved.");
    setStatus("Reloading…");
    await loadEntries();
    render();
  } catch (e) {
    msg.textContent = "Save failed: " + e.message;
    logDebug("save error", e);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = state.editing ? "Save changes" : "Save entry";
  }
}

async function deleteEntry() {
  var recordID = byId("calEntryRecordID").value;
  if (!recordID) return;
  if (!window.confirm("Delete this entry? This can't be undone.")) return;
  try {
    // LEAF soft-delete endpoint
    await apiPost("./api/form/" + encodeURIComponent(recordID) + "/delete", {
      CSRFToken: CSRF,
    });
    closeModal("calEntryModal");
    announce("Entry deleted.");
    await loadEntries();
    render();
  } catch (e) {
    byId("calEntryMsg").textContent = "Delete failed: " + e.message;
  }
}

/* ============================================================
   Day peek popover ("+N more")
   ============================================================ */
function openDayPeek(dateKey, anchorEl) {
  var peek = byId("calDayPeek");
  if (!peek) return;
  var d = parseYMD(dateKey);
  var list = entriesForDay(dateKey);
  peek.innerHTML =
    '<div class="cal-dayPeekHead">' +
    escapeHtml(fmtLongDate(d)) +
    '<button type="button" data-close-peek aria-label="Close"><span class="material-symbols-outlined">close</span></button></div>' +
    list
      .map(function (e) {
        return chipHTML(e);
      })
      .join("");
  peek.hidden = false;
  var r = anchorEl.getBoundingClientRect();
  var top = window.scrollY + r.bottom + 4;
  var left = window.scrollX + r.left;
  left = Math.min(left, window.scrollX + window.innerWidth - 320);
  peek.style.top = top + "px";
  peek.style.left = Math.max(8, left) + "px";
}
function closeDayPeek() {
  var p = byId("calDayPeek");
  if (p) p.hidden = true;
}

/* ============================================================
   Event wiring
   ============================================================ */
function wireControls() {
  // Navigation
  byId("calPrevBtn").addEventListener("click", function () {
    navigate(-1);
  });
  byId("calNextBtn").addEventListener("click", function () {
    navigate(1);
  });
  byId("calTodayBtn").addEventListener("click", function () {
    state.cursor = startOfDay(new Date());
    render();
  });

  // View toggle
  document.querySelectorAll(".cal-viewBtn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".cal-viewBtn").forEach(function (b) {
        b.classList.remove("is-active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
      state.view = btn.getAttribute("data-view");
      render();
    });
  });

  // Filters
  byId("calFilterType").addEventListener("change", function () {
    state.filters.type = this.value;
    render();
  });
  byId("calFilterAuthor").addEventListener("change", function () {
    state.filters.author = this.value;
    render();
  });
  byId("calShowClosed").addEventListener("change", function () {
    state.filters.showClosed = this.checked;
    render();
  });
  byId("calFilterSearch").addEventListener(
    "input",
    debounce(function () {
      state.filters.search = byId("calFilterSearch").value.trim();
      render();
    }, 200),
  );
  byId("calClearFilters").addEventListener("click", function () {
    state.filters = { type: "", author: "", search: "", showClosed: false };
    byId("calFilterType").value = "";
    byId("calFilterAuthor").value = "";
    byId("calFilterSearch").value = "";
    byId("calShowClosed").checked = false;
    render();
  });

  // Add
  byId("calAddBtn").addEventListener("click", function () {
    openEntryModal(null);
  });

  // Delegated clicks across views
  document.addEventListener("click", onDelegatedClick);

  // Day cell keyboard
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (!byId("calDayPeek").hidden) {
        closeDayPeek();
        return;
      }
      if (modalStack.length) closeModal(modalStack[modalStack.length - 1].id);
    }
    var cell = e.target.closest && e.target.closest(".cal-dayCell");
    if (cell && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      openEntryModal(null, cell.getAttribute("data-day"));
    }
  });

  // Modal close buttons / backdrops
  document.querySelectorAll("[data-close]").forEach(function (el) {
    el.addEventListener("click", function () {
      var which = el.getAttribute("data-close");
      var map = {
        entry: "calEntryModal",
        link: "calLinkModal",
        record: "calRecordModal",
      };
      closeModal(map[which]);
      if (which === "record") byId("calRecordFrame").src = "about:blank";
    });
  });

  // Entry form
  byId("calEntryForm").addEventListener("submit", function (e) {
    e.preventDefault();
    saveEntry();
  });
  byId("calDeleteBtn").addEventListener("click", deleteEntry);
  byId("calFldType").addEventListener("change", function () {
    applyConditionalFields(this.value);
  });

  // Rich text toolbar
  byId("calFldBodyToolbar").addEventListener("click", function (e) {
    var b = e.target.closest("[data-cmd]");
    if (!b) return;
    e.preventDefault();
    byId("calFldBody").focus();
    document.execCommand(b.getAttribute("data-cmd"), false, null);
  });

  // People pickers
  wirePeople("assigned", "calAssignedSearch", "calAssignedResults");
  wirePeople("covered", "calCoveredSearch", "calCoveredResults");

  // Link picker
  byId("calLinkAddBtn").addEventListener("click", function () {
    ensureLinkFormFilter();
    byId("calLinkSearch").value = "";
    byId("calLinkResults").innerHTML =
      '<p class="cal-linkHint">Type at least 2 characters to search across all forms.</p>';
    openModal("calLinkModal");
    setTimeout(function () {
      byId("calLinkSearch").focus();
    }, 50);
  });
  byId("calLinkSearch").addEventListener("input", linkSearchRun);
  byId("calLinkFormFilter").addEventListener("change", linkSearchRun);

  // Jump to top
  var jump = byId("calJumpTop");
  window.addEventListener("scroll", function () {
    jump.hidden = window.scrollY < 400;
  });
  jump.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Close peek on outside click
  document.addEventListener("click", function (e) {
    var peek = byId("calDayPeek");
    if (peek.hidden) return;
    if (!peek.contains(e.target) && !e.target.closest("[data-more]"))
      closeDayPeek();
  });
}

function wirePeople(role, searchId, listId) {
  var search = byId(searchId);
  var list = byId(listId);
  if (!search) return;
  search.addEventListener(
    "input",
    debounce(function () {
      searchPeople(search.value.trim(), role);
    }, 250),
  );
  list.addEventListener("click", function (e) {
    var li = e.target.closest("li[data-empuid]");
    if (!li) return;
    var uname = li.querySelector("small")
      ? li.querySelector("small").textContent
      : "";
    pickPerson(
      role,
      li.getAttribute("data-empuid"),
      li.getAttribute("data-name"),
      uname,
    );
    search.value = "";
  });
}

function onDelegatedClick(e) {
  // Open a record chip / card
  var recEl = e.target.closest("[data-record]");
  if (
    recEl &&
    !e.target.closest("[data-remove-link],[data-open-link],[data-close]")
  ) {
    var rid = recEl.getAttribute("data-record");
    var entry = state.entries.find(function (x) {
      return x.recordID === rid;
    });
    if (entry) {
      openEntryModal(entry);
    }
    return;
  }

  // "+N more"
  var more = e.target.closest("[data-more]");
  if (more) {
    e.stopPropagation();
    openDayPeek(more.getAttribute("data-more"), more);
    return;
  }

  // close peek button
  if (e.target.closest("[data-close-peek]")) {
    closeDayPeek();
    return;
  }

  // Empty day cell / week column body → new entry for that day
  var body = e.target.closest(".cal-weekColBody");
  if (body && !e.target.closest("[data-record]")) {
    openEntryModal(null, body.getAttribute("data-day"));
    return;
  }
  var cell = e.target.closest(".cal-dayCell");
  if (cell && e.target === cell) {
    openEntryModal(null, cell.getAttribute("data-day"));
    return;
  }
  var chips = e.target.closest(".cal-dayChips");
  if (cell && !chips && !e.target.closest("[data-record],[data-more]")) {
    openEntryModal(null, cell.getAttribute("data-day"));
    return;
  }

  // Draft link chip: open record
  var openLink = e.target.closest("[data-open-link]");
  if (openLink) {
    var l = state.draftLinks[+openLink.getAttribute("data-open-link")];
    if (l) openRecord(l.recordID, l.title);
    return;
  }
  // Draft link chip: remove
  var rmLink = e.target.closest("[data-remove-link]");
  if (rmLink) {
    state.draftLinks.splice(+rmLink.getAttribute("data-remove-link"), 1);
    renderDraftLinks();
    return;
  }
  // Clear a picked person
  var clearP = e.target.closest("[data-clear-person]");
  if (clearP) {
    var role = clearP.getAttribute("data-clear-person");
    if (role === "assigned") state.draftAssigned = null;
    else state.draftCovered = null;
    renderPeopleSelected(role);
    return;
  }
  // Link search result add/remove
  var lr = e.target.closest(".cal-linkResult");
  if (lr) {
    toggleDraftLink(
      lr.getAttribute("data-record"),
      lr.getAttribute("data-cat"),
      lr.getAttribute("data-title"),
      lr.getAttribute("data-form"),
    );
    return;
  }
}

function navigate(dir) {
  if (state.view === "week") state.cursor = addDays(state.cursor, dir * 7);
  else
    state.cursor = new Date(
      state.cursor.getFullYear(),
      state.cursor.getMonth() + dir,
      1,
    );
  render();
}

/* ============================================================
   Init
   ============================================================ */
async function main() {
  wireControls();
  render(); // paints the empty grid immediately

  if (DEBUG) {
    await runDiagnostics();
  }

  if (String(CONFIG.categoryID).indexOf("REPLACE_ME") === 0) {
    setStatus(
      "Calendar not configured yet — set CONFIG.categoryID and indicator IDs in calendar.js.",
      true,
    );
    return;
  }

  try {
    await loadEntries();
    render();
  } catch (e) {
    setStatus("Could not load entries. " + e.message, true);
    logDebug("load failed", e);
  }
}

document.addEventListener("DOMContentLoaded", main);
