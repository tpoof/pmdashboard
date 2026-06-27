const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 200;
const RECORD_VIEW_URL =
  "https://leaf.va.gov/platform/ideas/index.php?a=printview&recordID=";

const FORM_IDS = {
  idea: "form_ae642",
  votes: "form_57e89",
};

const FORM_KEYS = {
  idea: FORM_IDS.idea.replace("form_", ""),
  votes: FORM_IDS.votes.replace("form_", ""),
};

const IDEA_FIELDS = {
  title: 5,
  summary: 6,
  benefit: 7,
  category: 8,
  impact: 9,
  attachment: 10,
  status: 12,
  other_category: 13,
};

const VOTE_FIELDS = {
  idea: 2,
  user: 3,
};

const IDEA_INDICATORS = {
  title: `id${IDEA_FIELDS.title}`,
  summary: `id${IDEA_FIELDS.summary}`,
  benefit: `id${IDEA_FIELDS.benefit}`,
  category: `id${IDEA_FIELDS.category}`,
  impact: `id${IDEA_FIELDS.impact}`,
  attachment: `id${IDEA_FIELDS.attachment}`,
  status: `id${IDEA_FIELDS.status}`,
  other_category: `id${IDEA_FIELDS.other_category}`,
};

const VOTE_INDICATORS = {
  idea: `id${VOTE_FIELDS.idea}`,
  user: `id${VOTE_FIELDS.user}`,
};

// Fields to retrieve for idea records
const IDEA_GETDATA = [
  String(IDEA_FIELDS.category),
  String(IDEA_FIELDS.title),
  String(IDEA_FIELDS.status),
];

// Fields to retrieve for vote records
const VOTE_GETDATA = [String(VOTE_FIELDS.idea), String(VOTE_FIELDS.user)];

// x-filterData values — keep s1 so indicator data is preserved,
// drop unused top-level metadata for bandwidth savings
const IDEA_FILTER_DATA = "recordID,title,created_date,userID,s1";
const VOTE_FILTER_DATA = "recordID,s1";

const CATEGORY_FALLBACK = [
  "Email Template",
  "Forms",
  "Inbox",
  "Nexus",
  "Print to PDF",
  "Report Builder",
  "Support",
  "Training",
  "User Access Groups",
  "User Interface",
  "Workflow",
];

const IMPACT_FALLBACK = [
  "Impacts National",
  "Impacts Regional",
  "Impacts Local Facility",
  "Impact is one or more, but not all users",
];

// Material Symbols Filled variation settings
const ICON_FILL = `'opsz' 24, 'wght' 400, 'FILL' 1, 'GRAD' 0`;

let ideas = [];
let ideasRaw = [];
let ideasById = {};
let ideasVMById = {};
let ideaOwnerMap = {};
let voteCounts = {};

const portalConfig = window.leafIdeaPortal || {};

/* ─────────────────────────────────────────────────────────────
   Utilities
───────────────────────────────────────────────────────────── */

function sanitizeLeafValue(value) {
  return String(value || "")
    .replace(/<!--|-->/g, "")
    .trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncateTitle(title, max = 100) {
  if (!title) return "";
  return title.length <= max ? title : `${title.substring(0, max).trimEnd()}…`;
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/* ─────────────────────────────────────────────────────────────
   API helpers (POST only — reads use LeafFormQuery)
───────────────────────────────────────────────────────────── */

async function apiPostJson(url, data) {
  const body = new URLSearchParams();
  Object.entries(data || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    body.append(String(key), String(value));
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: body.toString(),
    credentials: "same-origin",
  });

  if (!response.ok)
    throw new Error(`Request failed with status ${response.status}`);

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/* ─────────────────────────────────────────────────────────────
   State
───────────────────────────────────────────────────────────── */

const userID = sanitizeLeafValue(portalConfig.userID);
const csrfToken = sanitizeLeafValue(portalConfig.csrfToken);

let userVotes = (() => {
  try {
    return JSON.parse(localStorage.getItem("leafIdeaVotes") || "{}");
  } catch {
    return {};
  }
})();

let votingInProgress = false;
let ideaSubmitInProgress = false;
let implementedCount = 0;
let myIdeasCache = [];
let lastFocusedElement = null;
let lastRecordFocusedElement = null;
let resolvedVoterEmail = "";

const state = {
  search: "",
  categoryFilter: "all",
  pagination: {
    all: { page: 1, showAll: false },
    my: { page: 1, showAll: false },
  },
};

const sortState = {
  tblIdeas: { key: "", dir: "asc" },
  tblTopIdeas: { key: "", dir: "desc" },
  tblMyIdeas: { key: "", dir: "asc" },
};

const ui = {
  results: null,
  topResults: null,
  myResults: null,
  searchInput: null,
  searchBtn: null,
  status: { all: null, my: null },
  pagination: { all: null, my: null },
  pageInfo: { all: null, my: null },
  pageHint: { all: null, my: null },
  panels: { all: null, my: null },
};

/* ─────────────────────────────────────────────────────────────
   DOM cache
───────────────────────────────────────────────────────────── */

function cacheElements() {
  ui.results = document.getElementById("results");
  ui.topResults = document.getElementById("topResults");
  ui.myResults = document.getElementById("myResults");
  ui.searchInput = document.getElementById("searchInput");
  ui.searchBtn = document.getElementById("searchBtn");
  ui.status.all = document.getElementById("allStatus");
  ui.status.my = document.getElementById("myStatus");
  ui.pagination.all = document.getElementById("allPagination");
  ui.pagination.my = document.getElementById("myPagination");
  ui.pageInfo.all = document.getElementById("allPageInfo");
  ui.pageInfo.my = document.getElementById("myPageInfo");
  ui.pageHint.all = document.getElementById("allPageHint");
  ui.pageHint.my = document.getElementById("myPageHint");
  ui.panels.all = document.getElementById("panel-all");
  ui.panels.my = document.getElementById("panel-my");
}

/* ─────────────────────────────────────────────────────────────
   Toast
───────────────────────────────────────────────────────────── */

let _toastTimer = null;

function showToast(msg, isError = false) {
  const toast = document.getElementById("ipToast");
  if (!toast) return;
  toast.textContent = msg || "";
  toast.classList.toggle("is-error", isError);
  toast.classList.add("is-visible");
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(hideToast, 4000);
}

function hideToast() {
  document.getElementById("ipToast")?.classList.remove("is-visible");
}

/* ─────────────────────────────────────────────────────────────
   Stats strip
───────────────────────────────────────────────────────────── */

function renderStatsStrip(totalIdeas, implemented, totalVotes) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val.toLocaleString();
  };
  set("statTotalIdeas", totalIdeas);
  set("statImplemented", implemented);
  set("statTotalVotes", totalVotes);
}

/* ─────────────────────────────────────────────────────────────
   Category sidebar
───────────────────────────────────────────────────────────── */

function buildCategorySidebar(ideaList) {
  const catList = document.getElementById("catList");
  if (!catList) return;

  const counts = {};
  let total = 0;
  (ideaList || []).forEach((idea) => {
    const cat = (idea.category || "").trim() || "Uncategorized";
    counts[cat] = (counts[cat] || 0) + 1;
    total++;
  });

  const allCountEl = document.getElementById("ip-cat-count-all");
  if (allCountEl) allCountEl.textContent = total;

  // Remove previously injected items
  catList.querySelectorAll("li[data-cat]").forEach((li) => {
    if (!li.querySelector("[data-cat='all']")) catList.removeChild(li);
  });

  Object.keys(counts)
    .sort((a, b) => a.localeCompare(b))
    .forEach((cat) => {
      const li = document.createElement("li");
      li.setAttribute("data-cat", cat);
      li.innerHTML = `
      <button class="ip-catItem" data-cat="${escapeHtml(cat)}" type="button">
        <span>${escapeHtml(cat)}</span>
        <span class="ip-catCount">${counts[cat]}</span>
      </button>`;
      catList.appendChild(li);
    });

  catList.addEventListener("click", (e) => {
    const btn = e.target.closest(".ip-catItem");
    if (!btn) return;
    const cat = btn.getAttribute("data-cat") || "all";
    state.categoryFilter = cat;
    state.pagination.all.page = 1;
    catList
      .querySelectorAll(".ip-catItem")
      .forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    renderAllIdeas();
  });
}

/* ─────────────────────────────────────────────────────────────
   Recently added bar
───────────────────────────────────────────────────────────── */

function renderRecentChips(ideaList) {
  const bar = document.getElementById("ipRecentBar");
  const chips = document.getElementById("ipRecentChips");
  if (!bar || !chips) return;

  const list = ideaList || [];
  // Sort by created_date descending; fall back to recordID descending when
  // created_date is missing or zero (stripped by x-filterData on some sites).
  const recent = [...list]
    .filter((i) => i?.recordID)
    .sort((a, b) => {
      const aDate = Number(a.created_date) || 0;
      const bDate = Number(b.created_date) || 0;
      if (bDate !== aDate) return bDate - aDate;
      return Number(b.recordID) - Number(a.recordID);
    })
    .slice(0, 5);

  if (!recent.length) {
    bar.hidden = true;
    return;
  }

  chips.innerHTML = recent
    .map((idea) => {
      const label = escapeHtml(
        truncateTitle(idea.title || `Idea ${idea.recordID}`, 40),
      );
      const url = escapeHtml(
        idea.recordLink || `${RECORD_VIEW_URL}${idea.recordID}`,
      );
      const title = escapeHtml(idea.title || `Idea ${idea.recordID}`);
      return `<button class="ip-recentChip" type="button"
      data-chip-id="${escapeHtml(String(idea.recordID))}"
      data-chip-url="${url}"
      data-chip-title="${title}"
      aria-label="View idea: ${title}">${label}</button>`;
    })
    .join("");

  bar.hidden = false;
}

/* ─────────────────────────────────────────────────────────────
   My Activity sidebar
───────────────────────────────────────────────────────────── */

function updateMyActivity(myCount, votedCount) {
  const ideasEl = document.getElementById("myActivityIdeas");
  const votesEl = document.getElementById("myActivityVotes");
  if (ideasEl) ideasEl.textContent = myCount;
  if (votesEl) votesEl.textContent = votedCount;
}

/* ─────────────────────────────────────────────────────────────
   Status messages
───────────────────────────────────────────────────────────── */

function setPanelBusy(scope, isBusy) {
  ui.panels[scope]?.setAttribute("aria-busy", isBusy ? "true" : "false");
}

function setStatus(scope, message, type) {
  const el = ui.status[scope];
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    el.classList.remove("is-error", "is-loading");
    return;
  }
  el.textContent = message;
  el.hidden = false;
  el.classList.toggle("is-error", type === "error");
  el.classList.toggle("is-loading", type === "loading");
}

/* ─────────────────────────────────────────────────────────────
   Modal helpers
───────────────────────────────────────────────────────────── */

function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(
    (el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden"),
  );
}

function bindFocusTrap(container) {
  if (container.dataset.focusTrap === "true") return;
  container.dataset.focusTrap = "true";
  container.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const focusable = getFocusableElements(container);
    if (!focusable.length) {
      e.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

function setBackgroundHidden(hidden) {
  const main = document.querySelector(".ip-wrap");
  if (main) {
    hidden
      ? main.setAttribute("aria-hidden", "true")
      : main.removeAttribute("aria-hidden");
  }
  const jump = document.getElementById("ipJumpTopBtn");
  if (jump) {
    hidden
      ? jump.setAttribute("aria-hidden", "true")
      : jump.removeAttribute("aria-hidden");
  }
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  lastFocusedElement = document.activeElement;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  setBackgroundHidden(true);
  bindFocusTrap(modal);
  const target =
    modal.querySelector("input, select, textarea") ||
    getFocusableElements(modal)[0];
  target?.focus();
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  setBackgroundHidden(false);
  lastFocusedElement?.focus();
  lastFocusedElement = null;
}

function bindModalEvents() {
  document.querySelectorAll("[data-ip-open]").forEach((btn) => {
    btn.addEventListener("click", () => openModal(btn.dataset.ipOpen));
  });
  document.querySelectorAll("[data-ip-close]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.ipClose));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    document
      .querySelectorAll(".ip-modal.is-open")
      .forEach((m) => closeModal(m.id));
  });
}

/* ─────────────────────────────────────────────────────────────
   Tabs
───────────────────────────────────────────────────────────── */

function bindTabs() {
  const tabs = Array.from(document.querySelectorAll(".ip-tab"));
  const panels = Array.from(document.querySelectorAll(".ip-panel"));

  function syncTabs(target) {
    tabs.forEach((tab) => {
      tab.classList.remove("is-active");
      tab.setAttribute("aria-selected", "false");
      tab.setAttribute("tabindex", "-1");
    });
    panels.forEach((panel) => {
      panel.classList.remove("is-active");
      panel.setAttribute("aria-hidden", "true");
    });
    const active = target || tabs[0];
    if (!active) return;
    active.classList.add("is-active");
    active.setAttribute("aria-selected", "true");
    active.setAttribute("tabindex", "0");
    const panel = document.getElementById(`panel-${active.dataset.ipTab}`);
    if (panel) {
      panel.classList.add("is-active");
      panel.setAttribute("aria-hidden", "false");
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => syncTabs(tab));
    tab.addEventListener("keydown", (e) => {
      const idx = tabs.indexOf(tab);
      let next = null;
      if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
      else if (e.key === "ArrowLeft")
        next = (idx - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = tabs.length - 1;
      if (next !== null) {
        e.preventDefault();
        tabs[next].focus();
        syncTabs(tabs[next]);
      }
    });
  });

  syncTabs();
}

/* ─────────────────────────────────────────────────────────────
   Record modal
───────────────────────────────────────────────────────────── */

function openRecordModal(title, url) {
  const modal = document.getElementById("ipRecordModal");
  const frame = document.getElementById("ipRecordModalFrame");
  const titleEl = document.getElementById("ipRecordModalTitle");
  const openBtn = document.getElementById("ipRecordModalOpenTabBtn");
  if (!modal || !frame || !titleEl) return;
  lastRecordFocusedElement = document.activeElement;
  titleEl.textContent = title || "Idea Details";
  frame.src = url;
  if (openBtn) openBtn.setAttribute("data-url", url || "");
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  setBackgroundHidden(true);
  bindFocusTrap(modal);
  getFocusableElements(modal)[0]?.focus();
}

function closeRecordModal() {
  const modal = document.getElementById("ipRecordModal");
  const frame = document.getElementById("ipRecordModalFrame");
  const openBtn = document.getElementById("ipRecordModalOpenTabBtn");
  if (!modal || !frame) return;
  frame.src = "about:blank";
  if (openBtn) openBtn.setAttribute("data-url", "");
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  setBackgroundHidden(false);
  lastRecordFocusedElement?.focus();
  lastRecordFocusedElement = null;
}

function bindRecordModal() {
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a.ip-recordLink");
    if (link) {
      e.preventDefault();
      const url = link.getAttribute("href");
      const title = link.getAttribute("data-title") || "Idea Details";
      if (url) openRecordModal(title, url);
      return;
    }
    const chip = e.target.closest(".ip-recentChip");
    if (chip) {
      const url = chip.getAttribute("data-chip-url");
      const title = chip.getAttribute("data-chip-title") || "Idea Details";
      if (url) openRecordModal(title, url);
    }
  });

  document
    .getElementById("ipRecordModalCloseBtn")
    ?.addEventListener("click", closeRecordModal);

  document
    .getElementById("ipRecordModalOpenTabBtn")
    ?.addEventListener("click", function () {
      const url = this.getAttribute("data-url") || "";
      if (url) window.open(url, "_blank", "noopener");
    });

  document.getElementById("ipRecordModal")?.addEventListener("click", (e) => {
    if (e.target?.getAttribute("data-ip-record-close") === "1")
      closeRecordModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeRecordModal();
  });
}

/* ─────────────────────────────────────────────────────────────
   Jump to top + credit badge
───────────────────────────────────────────────────────────── */

function wireJumpToTop() {
  const btn = document.getElementById("ipJumpTopBtn");
  if (!btn) return;

  function updateVisibility() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
    );
    const clientHeight =
      window.innerHeight || document.documentElement.clientHeight;
    const needsScroll = scrollHeight - clientHeight > 80;
    btn.classList.toggle("is-visible", needsScroll && scrollTop > 120);
    const credit = document.getElementById("ipCreditBadge");
    if (credit) {
      credit.classList.toggle(
        "is-visible",
        scrollTop + clientHeight >= scrollHeight - 80,
      );
    }
  }

  btn.addEventListener("click", () => {
    const prefersReduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
  });

  window.addEventListener("scroll", updateVisibility, { passive: true });
  window.addEventListener("resize", updateVisibility);
  updateVisibility();
}

/* ─────────────────────────────────────────────────────────────
   Data helpers
───────────────────────────────────────────────────────────── */

function getIdeaField(idea, s1Key, fallbackKey) {
  if (idea?.s1?.[s1Key] !== undefined) return idea.s1[s1Key];
  if (fallbackKey && idea?.[fallbackKey] !== undefined)
    return idea[fallbackKey];
  return "";
}

function normalizeStatusLabel(status) {
  if (!status) return "";
  return status.replace(/[()]/g, "").trim();
}

function buildIdeaViewModel(idea) {
  if (!idea?.recordID) return null;
  const recordID = String(idea.recordID);
  const title = sanitizeLeafValue(
    getIdeaField(idea, IDEA_INDICATORS.title, "title"),
  );
  const category = sanitizeLeafValue(
    getIdeaField(idea, IDEA_INDICATORS.category, "category"),
  );
  const statusRaw = getIdeaField(idea, IDEA_INDICATORS.status, "status");
  const status = normalizeStatusLabel(sanitizeLeafValue(statusRaw));
  const votes = voteCounts[recordID] || 0;
  const isVoted = userVotes[recordID] === true;
  return {
    recordID,
    title,
    category,
    status,
    votes,
    isVoted,
    created_date: idea.created_date || "",
    recordLink: `${RECORD_VIEW_URL}${recordID}`,
  };
}

function buildIdeasViewModelList(rawIdeas, updateMaps = false) {
  const list = [];
  const vmMap = {};
  if (updateMaps) {
    ideasById = {};
    ideaOwnerMap = {};
  }

  (rawIdeas || []).forEach((idea) => {
    const vm = buildIdeaViewModel(idea);
    if (!vm) return;
    list.push(vm);
    vmMap[vm.recordID] = vm;
    if (updateMaps) {
      ideasById[vm.recordID] = idea;
      ideaOwnerMap[vm.recordID] = idea.userID || "";
    }
  });

  if (updateMaps) ideasVMById = vmMap;
  return list;
}

/* ─────────────────────────────────────────────────────────────
   Sort
───────────────────────────────────────────────────────────── */

function getIdeaSortValue(idea, key) {
  switch (key) {
    case "id":
      return Number(idea.recordID) || 0;
    case "title":
      return String(idea.title || "");
    case "category":
      return String(idea.category || "");
    case "status":
      return String(normalizeStatusLabel(idea.status || ""));
    case "votes":
      return typeof idea.votes === "number"
        ? idea.votes
        : voteCounts[idea.recordID] || 0;
    default:
      return "";
  }
}

function sortIdeasList(list, stateObj) {
  if (!stateObj?.key) return list;
  const dir = stateObj.dir === "desc" ? -1 : 1;
  return [...list.filter((i) => i?.recordID)].sort((a, b) => {
    const av = getIdeaSortValue(a, stateObj.key);
    const bv = getIdeaSortValue(b, stateObj.key);
    if (typeof av === "number" && typeof bv === "number")
      return (av - bv) * dir;
    return (
      String(av).localeCompare(String(bv), undefined, {
        numeric: true,
        sensitivity: "base",
      }) * dir
    );
  });
}

function setSortState(tableId, key) {
  const s = sortState[tableId] || { key: "", dir: "asc" };
  s.dir = s.key === key ? (s.dir === "asc" ? "desc" : "asc") : "asc";
  s.key = key;
  sortState[tableId] = s;
}

function applySortClasses(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const s = sortState[tableId];
  table.querySelectorAll(".ip-sortable").forEach((th) => {
    th.classList.remove("is-asc", "is-desc");
    const key = th.querySelector(".ip-sortBtn")?.getAttribute("data-sort");
    if (s && key === s.key) {
      th.classList.add(s.dir === "asc" ? "is-asc" : "is-desc");
      th.setAttribute(
        "aria-sort",
        s.dir === "asc" ? "ascending" : "descending",
      );
    } else {
      th.setAttribute("aria-sort", "none");
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   Row builder
───────────────────────────────────────────────────────────── */

function getStatusBadgeClass(status) {
  const map = {
    "New Submission": "ip-badge--new",
    "Under Review": "ip-badge--review",
    "In Progress": "ip-badge--progress",
    Completed: "ip-badge--done",
    Discarded: "ip-badge--discarded",
    Draft: "ip-badge--draft",
  };
  return map[status] || "";
}

function buildIdeaRow(idea) {
  if (!idea?.recordID) return "";
  const recordID = String(idea.recordID);
  const titleRaw = idea.title || "";
  const title = escapeHtml(titleRaw);
  const titleDisplay = escapeHtml(truncateTitle(titleRaw));
  const category = escapeHtml(idea.category || "");

  // Show "Draft" when status is empty (not-submitted records)
  const statusLabel = idea.status || "Draft";
  const statusBadgeClass = getStatusBadgeClass(statusLabel);
  const statusMarkup = `<span class="ip-badge ${statusBadgeClass}">${statusLabel}</span>`;

  const votes = idea.votes || 0;
  const isVoted = idea.isVoted === true;
  const recordLink = idea.recordLink || `${RECORD_VIEW_URL}${recordID}`;
  const labelTitle = title || `Idea ${recordID}`;
  const voteLabel = isVoted
    ? `Already voted for ${labelTitle}`
    : `Vote for ${labelTitle}`;

  return `
    <tr data-record-id="${recordID}">
      <td>
        <a class="ip-recordLink"
           data-title="${title}"
           aria-haspopup="dialog"
           href="${escapeHtml(recordLink)}">#${recordID}</a>
      </td>
      <td title="${title}">${titleDisplay}</td>
      <td>${category}</td>
      <td>${statusMarkup}</td>
      <td class="ip-votes">${votes}</td>
      <td class="ip-actionsCell">
        <button class="ip-btn ip-btn--ghost ip-btn--icon ip-upvote${isVoted ? " is-voted" : ""}"
          data-record-id="${recordID}"
          ${isVoted ? "disabled" : ""}
          aria-label="${voteLabel}"
          aria-disabled="${isVoted}"
          title="${isVoted ? "Already voted" : "Vote for this idea"}">
          <span class="material-symbols-outlined" style="font-variation-settings:${ICON_FILL}" aria-hidden="true">thumb_up</span>
        </button>
        <button class="ip-btn ip-btn--ghost ip-share"
          data-record-link="${escapeHtml(recordLink)}"
          aria-label="Copy link for ${labelTitle}"
          title="Copy shareable link">
          <span class="material-symbols-outlined" style="font-variation-settings:${ICON_FILL}" aria-hidden="true">share</span>
          Share
        </button>
      </td>
    </tr>`;
}

/* ─────────────────────────────────────────────────────────────
   Filter
───────────────────────────────────────────────────────────── */

function getIdeaSearchText(idea) {
  return [
    idea.recordID ? String(idea.recordID) : "",
    idea.title || "",
    idea.category || "",
    normalizeStatusLabel(idea.status || ""),
  ]
    .join(" ")
    .toLowerCase();
}

function filterIdeasList(list, query) {
  let filtered = list;
  if (state.categoryFilter && state.categoryFilter !== "all") {
    filtered = filtered.filter(
      (i) => (i.category || "").trim() === state.categoryFilter,
    );
  }
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter((i) => getIdeaSearchText(i).includes(q));
  }
  return filtered;
}

/* ─────────────────────────────────────────────────────────────
   Pagination
───────────────────────────────────────────────────────────── */

function paginateList(list, page, pageSize, showAll) {
  if (showAll) return { pageItems: list, pageCount: 1, page: 1 };
  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  return {
    pageItems: list.slice(start, start + pageSize),
    pageCount,
    page: safePage,
  };
}

function renderRows(tbody, rowsHtml, emptyMessage) {
  if (!tbody) return;
  tbody.innerHTML = rowsHtml || `<tr><td colspan="6">${emptyMessage}</td></tr>`;
}

function renderTableMessage(tbody, message, opts = {}) {
  if (!tbody) return;
  const btn = opts.retry
    ? ` <button type="button" class="ip-btn ip-btn--ghost ip-retry">Retry</button>`
    : "";
  tbody.innerHTML = `<tr><td colspan="6">${escapeHtml(message || "")}${btn}</td></tr>`;
}

function updatePaginationUI(
  scope,
  totalCount,
  pageCount,
  page,
  showAll,
  allowToggle,
) {
  const container = ui.pagination[scope];
  if (!container) return;
  if (totalCount < PAGE_SIZE) {
    container.hidden = true;
    return;
  }
  container.hidden = false;

  const prevBtn = container.querySelector('[data-page-action="prev"]');
  const nextBtn = container.querySelector('[data-page-action="next"]');
  const toggleBtn = container.querySelector('[data-page-action="toggle"]');

  if (prevBtn) prevBtn.disabled = showAll || page <= 1;
  if (nextBtn) nextBtn.disabled = showAll || page >= pageCount;
  if (ui.pageInfo[scope])
    ui.pageInfo[scope].textContent = `Page ${page} of ${pageCount}`;
  if (toggleBtn) {
    toggleBtn.hidden = !allowToggle;
    toggleBtn.textContent = showAll ? "Show pages" : "Show all";
    toggleBtn.setAttribute("aria-pressed", showAll ? "true" : "false");
  }
  if (ui.pageHint[scope]) {
    ui.pageHint[scope].textContent = showAll
      ? "Showing all results. Large lists may be slow."
      : `Showing ${PAGE_SIZE} per page.`;
  }
}

/* ─────────────────────────────────────────────────────────────
   Render panels
───────────────────────────────────────────────────────────── */

function renderAllIdeas() {
  const filtered = filterIdeasList(ideas, state.search);
  const sorted = sortIdeasList(filtered, sortState.tblIdeas);
  applySortClasses("tblIdeas");

  const shouldPaginate = sorted.length >= PAGE_SIZE;
  if (!shouldPaginate) {
    state.pagination.all.showAll = true;
    state.pagination.all.page = 1;
  }
  const showAll = shouldPaginate ? state.pagination.all.showAll : true;
  const pagination = paginateList(
    sorted,
    state.pagination.all.page,
    PAGE_SIZE,
    showAll,
  );
  state.pagination.all.page = pagination.page;

  renderRows(
    ui.results,
    pagination.pageItems.map(buildIdeaRow).join(""),
    state.search ? "No matching ideas." : "No data found",
  );
  updatePaginationUI(
    "all",
    sorted.length,
    pagination.pageCount,
    pagination.page,
    showAll,
    shouldPaginate,
  );
}

function renderMyIdeas() {
  const sorted = sortIdeasList(myIdeasCache, sortState.tblMyIdeas);
  applySortClasses("tblMyIdeas");

  const shouldPaginate = sorted.length >= PAGE_SIZE;
  if (!shouldPaginate) {
    state.pagination.my.showAll = true;
    state.pagination.my.page = 1;
  }
  const showAll = shouldPaginate ? state.pagination.my.showAll : true;
  const pagination = paginateList(
    sorted,
    state.pagination.my.page,
    PAGE_SIZE,
    showAll,
  );
  state.pagination.my.page = pagination.page;

  renderRows(
    ui.myResults,
    pagination.pageItems.map(buildIdeaRow).join(""),
    "No ideas submitted",
  );
  updatePaginationUI(
    "my",
    sorted.length,
    pagination.pageCount,
    pagination.page,
    showAll,
    shouldPaginate,
  );
}

function renderTop10Ideas() {
  if (!ui.topResults) return;
  let top10 = [...ideas]
    .filter((i) => i?.recordID)
    .sort((a, b) => (b.votes || 0) - (a.votes || 0))
    .slice(0, 10);
  if (sortState.tblTopIdeas.key)
    top10 = sortIdeasList(top10, sortState.tblTopIdeas);
  applySortClasses("tblTopIdeas");
  renderRows(ui.topResults, top10.map(buildIdeaRow).join(""), "No data found");
}

/* ─────────────────────────────────────────────────────────────
   Vote state helpers
───────────────────────────────────────────────────────────── */

function setVoteButtonsDisabled(isDisabled) {
  document.querySelectorAll(".ip-upvote").forEach((btn) => {
    if (isDisabled) {
      btn.dataset.loadingDisabled = "true";
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
    } else if (btn.dataset.loadingDisabled === "true") {
      const voted = btn.classList.contains("is-voted");
      btn.disabled = voted;
      btn.setAttribute("aria-disabled", voted ? "true" : "false");
      delete btn.dataset.loadingDisabled;
    }
  });
}

function setVotedState(recordID, isVoted) {
  document
    .querySelectorAll(`.ip-upvote[data-record-id="${recordID}"]`)
    .forEach((btn) => {
      btn.disabled = isVoted;
      btn.classList.toggle("is-voted", isVoted);
      btn.setAttribute("aria-disabled", isVoted ? "true" : "false");
    });
}

function updateVoteDom(recordID) {
  const key = String(recordID);

  [
    ideasVMById[key],
    myIdeasCache.find((i) => String(i.recordID) === key),
  ].forEach((item) => {
    if (!item) return;
    item.votes = voteCounts[key] || 0;
    item.isVoted = true;
  });

  document
    .querySelectorAll(`tr[data-record-id="${key}"] .ip-votes`)
    .forEach((cell) => {
      cell.textContent = voteCounts[key] || 0;
    });
  setVotedState(key, true);
}

/* ─────────────────────────────────────────────────────────────
   Voter email resolution — orgchart API → userID fallback
───────────────────────────────────────────────────────────── */

function isRealEmail(str) {
  return typeof str === "string" && str.includes("@") && !str.includes("<!--");
}

async function resolveVoterEmail() {
  if (!userID) return;
  try {
    const res = await fetch(
      `/platform/orgchart/api/employee/search?q=userName:${encodeURIComponent(userID)}&noLimit=0&_=${Date.now()}`,
      { credentials: "same-origin" },
    );
    if (res.ok) {
      const data = await res.json();
      const employees = Array.isArray(data) ? data : Object.values(data || {});
      const match = employees.find(
        (e) =>
          e &&
          (e.userName === userID || e.userName === userID.split("\\").pop()),
      );
      const email = match?.Email || match?.email || "";
      if (isRealEmail(email)) {
        resolvedVoterEmail = email;
        return;
      }
    }
  } catch (err) {
    console.warn("[resolveVoterEmail] orgchart API failed:", err);
  }
  // Last resort — userID so votes still record something identifiable
  resolvedVoterEmail = userID;
  console.warn(
    "[resolveVoterEmail] Could not resolve email; falling back to userID",
  );
}

/* ─────────────────────────────────────────────────────────────
   Vote submit
───────────────────────────────────────────────────────────── */

async function IdeaVotes(recordID) {
  const key = String(recordID);
  if (votingInProgress) return;
  if (userVotes[key]) {
    showToast("You already voted on this idea.", true);
    return;
  }

  votingInProgress = true;
  userVotes[key] = true;
  setVotedState(key, true);

  const payload = {
    service: "",
    title: `Idea #${key}`,
    priority: 0,
    CSRFToken: csrfToken,
    [`numform_${FORM_KEYS.votes}`]: 1,
    [VOTE_FIELDS.user]: resolvedVoterEmail || userID,
    [VOTE_FIELDS.idea]: key,
  };

  try {
    const response = await apiPostJson("./api/?a=form/new", payload);
    const newID = parseFloat(response);

    if (!isNaN(newID) && isFinite(newID) && newID !== 0) {
      voteCounts[key] = (voteCounts[key] || 0) + 1;
      updateVoteDom(key);
      renderTop10Ideas();
      if (sortState.tblIdeas.key === "votes") renderAllIdeas();
      if (sortState.tblMyIdeas.key === "votes") renderMyIdeas();

      try {
        localStorage.setItem("leafIdeaVotes", JSON.stringify(userVotes));
      } catch {}

      const totalVotes = Object.values(voteCounts).reduce((s, n) => s + n, 0);
      renderStatsStrip(ideas.length, implementedCount, totalVotes);
      showToast("Thanks for voting!");
      updateMyActivity(
        myIdeasCache.length,
        Object.values(userVotes).filter(Boolean).length,
      );
    } else {
      throw new Error(`Unexpected response: ${response}`);
    }
  } catch (err) {
    console.error("[IdeaVotes] error:", err);
    showToast("Error processing vote. Please try again.", true);
    userVotes[key] = false;
    [
      ideasVMById[key],
      myIdeasCache.find((i) => String(i.recordID) === key),
    ].forEach((item) => {
      if (item) item.isVoted = false;
    });
    setVotedState(key, false);
  } finally {
    votingInProgress = false;
  }
}

/* ─────────────────────────────────────────────────────────────
   Data fetches — direct REST (LeafFormQuery's stepID handling
   without a status join silently returns 0 on this site)
───────────────────────────────────────────────────────────── */

async function leafFetchQuery(queryObj, filterData) {
  const q = JSON.stringify(queryObj);
  const url = `./api/form/query/?q=${encodeURIComponent(q)}&x-filterData=${encodeURIComponent(filterData)}&_=${Date.now()}`;
  const res = await fetch(url, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchIdeasData() {
  try {
    const data = await leafFetchQuery(
      {
        terms: [
          {
            id: "categoryID",
            operator: "=",
            match: FORM_IDS.idea,
            gate: "AND",
          },
          { id: "deleted", operator: "=", match: 0, gate: "AND" },
          { id: "stepID", operator: "!=", match: "notSubmitted", gate: "AND" },
        ],
        joins: [],
        sort: { id: "created_date", direction: "desc" },
        getData: IDEA_GETDATA,
      },
      IDEA_FILTER_DATA,
    );
    const result = Object.values(data || {});
    return result;
  } catch (err) {
    throw err;
  }
}

async function fetchVotesData() {
  try {
    const voteData = await leafFetchQuery(
      {
        terms: [
          {
            id: "categoryID",
            operator: "=",
            match: FORM_IDS.votes,
            gate: "AND",
          },
          { id: "deleted", operator: "=", match: 0, gate: "AND" },
        ],
        joins: [],
        sort: {},
        getData: VOTE_GETDATA,
      },
      VOTE_FILTER_DATA,
    );

    voteCounts = {};
    userVotes = {};

    const votesList = Object.values(voteData || {});
    votesList.forEach((vote) => {
      const ideanum = vote.s1?.[VOTE_INDICATORS.idea];
      const voter = vote.s1?.[VOTE_INDICATORS.user];
      if (ideanum !== undefined && ideanum !== null && ideanum !== "") {
        const key = String(ideanum);
        voteCounts[key] = (voteCounts[key] || 0) + 1;
        // Match on resolvedVoterEmail first; fall back to userID for records
        // stored before the email migration or when email didn't resolve.
        const voterIdentity = resolvedVoterEmail || userID;
        if (voter && voterIdentity && voter === voterIdentity) {
          userVotes[key] = true;
        }
      }
    });

    // Merge locally-cached votes (optimistic from past sessions)
    try {
      const saved = JSON.parse(localStorage.getItem("leafIdeaVotes") || "{}");
      Object.keys(saved).forEach((k) => {
        if (saved[k]) userVotes[k] = true;
      });
    } catch {}
    return votesList.length;
  } catch (err) {
    throw err;
  }
}

async function fetchUserSubmissions() {
  if (!userID) {
    myIdeasCache = [];
    setStatus("my", "Sign in to view your ideas.", "error");
    renderMyIdeas();
    return;
  }

  setPanelBusy("my", true);
  setStatus("my", "Loading your ideas…", "loading");
  renderTableMessage(ui.myResults, "Loading…");

  try {
    // No stepID filter — includes the user's own drafts intentionally.
    // Filter out vote records (title starts with "Idea #") which share userID.
    const data = await leafFetchQuery(
      {
        terms: [
          {
            id: "categoryID",
            operator: "=",
            match: FORM_IDS.idea,
            gate: "AND",
          },
          { id: "userID", operator: "=", match: userID, gate: "AND" },
          { id: "deleted", operator: "=", match: 0, gate: "AND" },
        ],
        joins: [],
        sort: { id: "created_date", direction: "desc" },
        getData: IDEA_GETDATA,
      },
      IDEA_FILTER_DATA,
    );

    const userIdeas = Object.values(data || {})
      .filter(
        (idea) => idea?.recordID && !(idea.title || "").startsWith("Idea #"),
      )
      .map((idea) => {
        const key = String(idea.recordID);
        if (ideasById[key]) {
          // Record exists in the public submitted query — use enriched data as-is
          return ideasById[key];
        }
        // Not in the submitted set — it's a draft. Clear the status indicator so
        // buildIdeaRow falls back to the "Draft" label.
        return {
          ...idea,
          s1: { ...(idea.s1 || {}), [IDEA_INDICATORS.status]: "" },
        };
      });

    myIdeasCache = buildIdeasViewModelList(userIdeas, false);
    renderMyIdeas();
    setStatus("my", "", "");
    updateMyActivity(
      myIdeasCache.length,
      Object.values(userVotes).filter(Boolean).length,
    );
  } catch (err) {
    console.error("fetchUserSubmissions error:", err);
    renderTableMessage(ui.myResults, "Error loading your ideas.", {
      retry: true,
    });
    setStatus("my", "Error loading your ideas.", "error");
  } finally {
    setPanelBusy("my", false);
  }
}

/* ─────────────────────────────────────────────────────────────
   Main load
───────────────────────────────────────────────────────────── */

async function loadIdeasAndVotes() {
  setPanelBusy("all", true);
  setStatus("all", "Loading ideas…", "loading");
  renderTableMessage(ui.results, "Loading…");
  renderTableMessage(ui.topResults, "Loading…");
  setVoteButtonsDisabled(true);

  const fetchStart = performance.now();

  // Resolve voter email before fetching votes so the "did I vote" check
  // in fetchVotesData() uses the correct identity.
  await resolveVoterEmail();

  try {
    const [ideasData] = await Promise.all([fetchIdeasData(), fetchVotesData()]);

    ideasRaw = ideasData;
    ideas = buildIdeasViewModelList(ideasRaw, true);

    implementedCount = ideas.filter((i) => i.status === "Completed").length;
    const totalVotes = Object.values(voteCounts).reduce((s, n) => s + n, 0);

    renderStatsStrip(ideas.length, implementedCount, totalVotes);
    buildCategorySidebar(ideas);
    renderRecentChips(ideas);

    renderAllIdeas();
    renderTop10Ideas();
    setStatus("all", "", "");

    await fetchUserSubmissions();
  } catch (err) {
    console.error("IdeaPortal load error", err);
    renderTableMessage(ui.results, "Error loading ideas.", { retry: true });
    renderTableMessage(ui.topResults, "Error loading ideas.", { retry: true });
    setStatus("all", "Error loading data.", "error");
  } finally {
    setPanelBusy("all", false);
    setVoteButtonsDisabled(false);
  }
}

/* ─────────────────────────────────────────────────────────────
   Workflow advance (idea submission)
───────────────────────────────────────────────────────────── */

async function advanceWorkflow(recordID) {
  try {
    await fetch(`./api/form/${recordID}/submit`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ CSRFToken: csrfToken }),
    });

    const stepRes = await fetch(`./api/formWorkflow/${recordID}/currentStep`, {
      credentials: "same-origin",
    });
    const stepData = await stepRes.json();

    const firstStep = Array.isArray(stepData) ? stepData[0] : stepData;
    const depID = firstStep?.dependencyID;
    const actionType =
      firstStep?.dependencyActions?.[0]?.actionType || "submit";

    const applyRes = await fetch(`./api/formWorkflow/${recordID}/apply`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        CSRFToken: csrfToken,
        actionType,
        dependencyID: depID,
      }),
    });
  } catch (err) {
    console.warn("[Workflow] advance failed:", err);
  }
}

/* ─────────────────────────────────────────────────────────────
   Idea form
───────────────────────────────────────────────────────────── */

async function NewIdea(advanceOnSuccess) {
  const form = document.getElementById("ideaForm");
  const submitBtn = document.getElementById("submitButton");
  const saveBtn = document.getElementById("saveDraftButton");
  const fileInputEl = document.getElementById("fileInput");

  const val = (id) => document.getElementById(id)?.value.trim() || "";
  const titleValue = val("inpTitle");
  const descValue = val("inpDescription");
  const benefitValue = val("inpBenefit");
  const categoryValue = val("inpCategory");
  const impactValue = val("inpImpact");
  const otherCatValue = val("inpOtherCategory");

  if (submitBtn) submitBtn.disabled = true;
  if (saveBtn) saveBtn.disabled = true;
  ideaSubmitInProgress = true;

  try {
    const payload = {
      service: "",
      title: titleValue || "Idea Submission",
      priority: 0,
      CSRFToken: csrfToken,
      [`numform_${FORM_KEYS.idea}`]: 1,
      [IDEA_FIELDS.title]: titleValue,
      [IDEA_FIELDS.summary]: descValue,
      [IDEA_FIELDS.benefit]: benefitValue,
      [IDEA_FIELDS.category]: categoryValue,
      [IDEA_FIELDS.impact]: impactValue,
    };
    if (categoryValue === "Other" && otherCatValue) {
      payload[IDEA_FIELDS.other_category] = otherCatValue;
    }

    const response = await apiPostJson("./api/?a=form/new", payload);
    const newID = parseFloat(response);

    if (!isNaN(newID) && isFinite(newID) && newID !== 0) {
      // File upload — fire and forget
      const files = fileInputEl?.files ? Array.from(fileInputEl.files) : [];
      if (files.length) {
        const fd = new FormData();
        fd.append("CSRFToken", csrfToken);
        files.forEach((f) => fd.append("10", f));
        fetch(`./api/?a=form/${newID}`, {
          method: "POST",
          credentials: "same-origin",
          body: fd,
        }).catch((err) => console.warn("[IdeaUpload] file upload failed", err));
      }

      form?.reset();
      form?.classList.remove("was-validated");
      if (fileInputEl) fileInputEl.value = "";
      const fileList = document.getElementById("fileList");
      if (fileList) fileList.innerHTML = "";
      closeModal("addIdeaModal");

      if (advanceOnSuccess) {
        await advanceWorkflow(newID);
        showToast("Your idea has been submitted successfully.");
        await loadIdeasAndVotes();
      } else {
        showToast("Idea saved. You can find it in My Ideas.");
        await fetchUserSubmissions();
      }
    } else {
      throw new Error(`Unexpected response: ${response}`);
    }
  } catch (err) {
    console.warn("[NewIdea] error:", err);
    showToast("Error submitting idea. Please try again.", true);
  } finally {
    ideaSubmitInProgress = false;
    if (submitBtn) submitBtn.disabled = false;
    if (saveBtn) saveBtn.disabled = false;
  }
}

/* ─────────────────────────────────────────────────────────────
   Form selects + validation
───────────────────────────────────────────────────────────── */

function populateSelect(select, options, appendOther = false) {
  if (!select) return;
  const placeholder = select.options[0];
  select.innerHTML = "";
  if (placeholder) select.appendChild(placeholder);
  options.forEach((opt) => {
    const label = typeof opt === "string" ? opt : opt.label || opt.name || opt;
    const el = document.createElement("option");
    el.value = label;
    el.textContent = label;
    select.appendChild(el);
  });
  if (appendOther) {
    const other = document.createElement("option");
    other.value = "Other";
    other.textContent = "Other";
    select.appendChild(other);
  }
}

async function loadCategoryOptions() {
  try {
    const res = await fetch(
      "/platform/ideas/ajaxIndex.php?a=getindicator&indicatorID=8&series=1&recordID=0",
      { credentials: "same-origin" },
    );
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const sel = doc.querySelector("select#8");
    if (!sel || !sel.options.length) throw new Error("no options");
    populateSelect(
      document.getElementById("inpCategory"),
      Array.from(sel.options)
        .map((o) => o.value)
        .filter(Boolean),
      false,
    );
  } catch {
    populateSelect(
      document.getElementById("inpCategory"),
      CATEGORY_FALLBACK,
      true,
    );
  }
}

async function loadImpactOptions() {
  try {
    const res = await fetch(
      "/platform/ideas/ajaxIndex.php?a=getindicator&indicatorID=9&series=1&recordID=0",
      { credentials: "same-origin" },
    );
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const sel = doc.querySelector("select#9");
    if (!sel || !sel.options.length) throw new Error("no options");
    populateSelect(
      document.getElementById("inpImpact"),
      Array.from(sel.options)
        .map((o) => o.value)
        .filter(Boolean),
      false,
    );
  } catch {
    populateSelect(
      document.getElementById("inpImpact"),
      IMPACT_FALLBACK,
      false,
    );
  }
}

function bindCategoryChange() {
  const categorySelect = document.getElementById("inpCategory");
  const otherWrapper = document.getElementById("otherCategoryWrapper");
  const otherInput = document.getElementById("inpOtherCategory");
  if (!categorySelect || !otherWrapper || !otherInput) return;

  categorySelect.addEventListener("change", () => {
    const isOther = categorySelect.value === "Other";
    otherWrapper.style.display = isOther ? "" : "none";
    otherInput.required = isOther;
    if (!isOther) {
      otherInput.value = "";
      otherInput.removeAttribute("aria-invalid");
    }
  });
}

function initValidation() {
  document.querySelectorAll(".needs-validation").forEach((form) => {
    // Re-check validity on every input/change so errors clear as user fixes them
    form.addEventListener("input", (e) => {
      const target = e.target;
      if (!target) return;
      if (target.checkValidity?.()) {
        target.removeAttribute("aria-invalid");
      } else {
        target.setAttribute("aria-invalid", "true");
      }
    });
    form.addEventListener("change", (e) => {
      const target = e.target;
      if (!target) return;
      if (target.checkValidity?.()) {
        target.removeAttribute("aria-invalid");
      } else {
        target.setAttribute("aria-invalid", "true");
      }
    });
  });
}

/* ─────────────────────────────────────────────────────────────
   Event delegation
───────────────────────────────────────────────────────────── */

function handleSortClick(sortBtn) {
  const key = sortBtn.getAttribute("data-sort");
  const tableId = sortBtn.closest("table")?.getAttribute("id");
  if (!tableId || !key) return;
  setSortState(tableId, key);
  applySortClasses(tableId);
  if (tableId === "tblIdeas") {
    state.pagination.all.page = 1;
    renderAllIdeas();
  } else if (tableId === "tblTopIdeas") renderTop10Ideas();
  else if (tableId === "tblMyIdeas") {
    state.pagination.my.page = 1;
    renderMyIdeas();
  }
}

function handlePaginationAction(scope, action) {
  const pager = state.pagination[scope];
  if (!pager) return;
  if (action === "prev") pager.page = Math.max(1, pager.page - 1);
  else if (action === "next") pager.page += 1;
  else if (action === "toggle") {
    pager.showAll = !pager.showAll;
    pager.page = 1;
  }
  if (scope === "all") renderAllIdeas();
  else if (scope === "my") renderMyIdeas();
}

function bindDelegatedEvents() {
  const wrap = document.querySelector(".ip-wrap");
  if (!wrap) return;

  wrap.addEventListener("click", (e) => {
    const sortBtn = e.target.closest(".ip-sortBtn");
    if (sortBtn) {
      handleSortClick(sortBtn);
      return;
    }

    const retryBtn = e.target.closest(".ip-retry");
    if (retryBtn) {
      loadIdeasAndVotes();
      return;
    }

    const upvoteBtn = e.target.closest(".ip-upvote");
    if (upvoteBtn && !upvoteBtn.disabled) {
      IdeaVotes(upvoteBtn.getAttribute("data-record-id"));
      return;
    }

    const shareBtn = e.target.closest(".ip-share");
    if (shareBtn) {
      const link = shareBtn.getAttribute("data-record-link");
      if (!link) return;
      navigator.clipboard
        .writeText(link)
        .then(() => showToast("Idea link copied to clipboard."))
        .catch((err) => console.error("Could not copy link:", err));
      return;
    }

    const pageBtn = e.target.closest(".ip-pageBtn, .ip-pageToggle");
    if (pageBtn) {
      handlePaginationAction(
        pageBtn.getAttribute("data-page-scope"),
        pageBtn.getAttribute("data-page-action"),
      );
    }
  });
}

function applySearch(value) {
  state.search = value.trim();
  if (!state.pagination.all.showAll) state.pagination.all.page = 1;
  renderAllIdeas();
}

function bindSearch() {
  if (!ui.searchInput) return;
  const handler = debounce(
    (e) => applySearch(e.target.value),
    SEARCH_DEBOUNCE_MS,
  );
  ui.searchInput.addEventListener("input", handler);
  ui.searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applySearch(ui.searchInput.value);
    }
  });
  ui.searchBtn?.addEventListener("click", () =>
    applySearch(ui.searchInput.value),
  );
}

function bindFileInput() {
  const fileInput = document.getElementById("fileInput");
  const fileList = document.getElementById("fileList");
  if (!fileInput || !fileList) return;
  fileInput.addEventListener("change", () => {
    fileList.innerHTML = Array.from(fileInput.files || [])
      .map((f) => `<li>${escapeHtml(f.name)}</li>`)
      .join("");
  });
}

function bindMySearch() {
  const input = document.getElementById("mySearchInput");
  const btn = document.getElementById("mySearchBtn");
  if (!input) return;
  const handler = debounce(() => {
    const q = input.value.toLowerCase();
    document.querySelectorAll("#myResults tr").forEach((row) => {
      row.style.display = row.textContent.toLowerCase().includes(q)
        ? ""
        : "none";
    });
  }, SEARCH_DEBOUNCE_MS);
  input.addEventListener("input", handler);
  btn?.addEventListener("click", handler);
}

/* ─────────────────────────────────────────────────────────────
   Init
───────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────
   My Activity — clickable rows
───────────────────────────────────────────────────────────── */

function switchToMyIdeasTab() {
  const myTab = document.querySelector('.ip-tab[data-ip-tab="my"]');
  if (!myTab) return;
  myTab.click();
  myTab.scrollIntoView({ behavior: "smooth", block: "nearest" });
  myTab.focus();
}

function openVotedModal() {
  const modal = document.getElementById("ipVotedModal");
  const tableBody = document.getElementById("ipVotedTableBody");
  const table = document.getElementById("ipVotedTable");
  const empty = document.getElementById("ipVotedModalEmpty");
  if (!modal || !tableBody || !table || !empty) return;

  // Build rows from userVotes (keyed by recordID) + ideasVMById for details
  const votedIDs = Object.keys(userVotes).filter((k) => userVotes[k] === true);

  if (!votedIDs.length) {
    table.hidden = true;
    empty.hidden = false;
  } else {
    const rows = votedIDs
      .map((id) => {
        const idea = ideasVMById[id];
        if (!idea) {
          // Vote exists but idea not in public set (e.g. deleted/draft)
          return `<tr>
          <td><span style="color:var(--ip-muted)">#${escapeHtml(id)}</span></td>
          <td style="color:var(--ip-muted);font-style:italic">Idea not available</td>
          <td>—</td><td>—</td><td>—</td>
        </tr>`;
        }
        const title = escapeHtml(truncateTitle(idea.title || `Idea ${id}`));
        const titleFull = escapeHtml(idea.title || `Idea ${id}`);
        const category = escapeHtml(idea.category || "");
        const statusLabel = idea.status || "Draft";
        const statusBadgeClass = getStatusBadgeClass(statusLabel);
        const votes = idea.votes || 0;
        const recordLink = escapeHtml(
          idea.recordLink || `${RECORD_VIEW_URL}${id}`,
        );
        return `<tr>
        <td><a class="ip-recordLink" href="${recordLink}" data-title="${titleFull}" aria-haspopup="dialog">#${escapeHtml(id)}</a></td>
        <td title="${titleFull}">${title}</td>
        <td>${category}</td>
        <td><span class="ip-badge ${statusBadgeClass}">${escapeHtml(statusLabel)}</span></td>
        <td>${votes}</td>
      </tr>`;
      })
      .join("");

    tableBody.innerHTML = rows;
    table.hidden = false;
    empty.hidden = true;
  }

  lastFocusedElement = document.activeElement;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  setBackgroundHidden(true);
  bindFocusTrap(modal);
  document.getElementById("ipVotedModalCloseBtn")?.focus();
}

function closeVotedModal() {
  const modal = document.getElementById("ipVotedModal");
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  setBackgroundHidden(false);
  lastFocusedElement?.focus();
  lastFocusedElement = null;
}

function bindVotedModal() {
  document
    .getElementById("ipVotedModalCloseBtn")
    ?.addEventListener("click", closeVotedModal);
  document
    .getElementById("ipVotedModalBackdrop")
    ?.addEventListener("click", closeVotedModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const modal = document.getElementById("ipVotedModal");
      if (modal?.classList.contains("is-open")) closeVotedModal();
    }
  });
}

function bindActivityButtons() {
  document
    .getElementById("actMyIdeasBtn")
    ?.addEventListener("click", switchToMyIdeasTab);
  document
    .getElementById("actVotedBtn")
    ?.addEventListener("click", openVotedModal);
}

function initPortal() {
  cacheElements();
  bindModalEvents();
  bindTabs();
  bindRecordModal();
  bindVotedModal();
  bindActivityButtons();
  bindDelegatedEvents();
  bindSearch();
  bindMySearch();
  bindFileInput();
  bindCategoryChange();
  loadCategoryOptions();
  loadImpactOptions();
  wireJumpToTop();
  initValidation();

  document
    .getElementById("saveDraftButton")
    ?.addEventListener("click", async () => {
      const form = document.getElementById("ideaForm");
      if (!form) return;
      const titleVal = document.getElementById("inpTitle")?.value.trim();
      if (!titleVal) {
        form.classList.add("was-validated");
        document.getElementById("inpTitle")?.focus();
        return;
      }
      await NewIdea(false);
    });

  document
    .getElementById("submitButton")
    ?.addEventListener("click", async () => {
      const form = document.getElementById("ideaForm");
      if (!form) return;
      form.classList.add("was-validated");
      // reportValidity() checks all fields including selects and returns false
      // if any required field is empty, preventing premature submission.
      if (!form.reportValidity()) return;
      await NewIdea(true);
    });

  loadIdeasAndVotes().catch((err) => {
    console.error("loadIdeasAndVotes failed", err);
  });
}

// Fire init as soon as DOM is available
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPortal);
} else {
  initPortal();
}
