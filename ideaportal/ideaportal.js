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
  title: "id" + IDEA_FIELDS.title,
  summary: "id" + IDEA_FIELDS.summary,
  benefit: "id" + IDEA_FIELDS.benefit,
  category: "id" + IDEA_FIELDS.category,
  impact: "id" + IDEA_FIELDS.impact,
  attachment: "id" + IDEA_FIELDS.attachment,
  status: "id" + IDEA_FIELDS.status,
  other_category: "id" + IDEA_FIELDS.other_category,
};

const VOTE_INDICATORS = {
  idea: "id" + VOTE_FIELDS.idea,
  user: "id" + VOTE_FIELDS.user,
};

const IDEA_GETDATA = [
  String(IDEA_FIELDS.category),
  String(IDEA_FIELDS.title),
  String(IDEA_FIELDS.status),
];

const VOTE_GETDATA = [
  String(VOTE_FIELDS.idea),
  String(VOTE_FIELDS.user),
];

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

let ideas = [];
let ideasRaw = [];
let ideasById = {};
let ideasVMById = {};
let ideaOwnerMap = {};
let voteCounts = {};
const portalConfig = window.leafIdeaPortal || {};
const debugEnabled = portalConfig && portalConfig.debug === true;

function sanitizeLeafValue(value) {
  return String(value || "").replace(/<!--|-->/g, "").trim();
}

function logDebug(message, data) {
  if (!debugEnabled) return;
  if (data !== undefined) {
    console.log("IdeaPortal debug:", message, data);
  } else {
    console.log("IdeaPortal debug:", message);
  }
}

function apiGetJson(url) {
  return fetch(url, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Request failed with status " + response.status);
      }
      return response.text();
    })
    .then(function (text) {
      try {
        return JSON.parse(text);
      } catch (error) {
        console.error("IdeaPortal API error", { url, error, text });
        throw error;
      }
    })
    .catch(function (error) {
      console.error("IdeaPortal API error", { url, error });
      throw error;
    });
}

function apiPostJson(url, data) {
  try {
    const body = new URLSearchParams();
    Object.entries(data || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      body.append(String(key), String(value));
    });

    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: body.toString(),
      credentials: "same-origin",
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Request failed with status " + response.status);
        }
        return response.text();
      })
      .then(function (text) {
        try {
          return JSON.parse(text);
        } catch (err) {
          return text;
        }
      })
      .catch(function (error) {
        console.error("IdeaPortal API error", { url, error });
        throw error;
      });
  } catch (error) {
    console.error("IdeaPortal API error", { url, error });
    return Promise.reject(error);
  }
}

const userID = sanitizeLeafValue(portalConfig.userID);
const csrfToken = sanitizeLeafValue(portalConfig.csrfToken);
let userVotes = (function () {
  try { return JSON.parse(localStorage.getItem("leafIdeaVotes") || "{}"); } catch (e) { return {}; }
})();
let votingInProgress = false;
let ideaSubmitInProgress = false;
let myIdeasCache = [];
let lastFocusedElement = null;
let lastRecordFocusedElement = null;

const state = {
  search: "",
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

function setPanelBusy(scope, isBusy) {
  const panel = ui.panels[scope];
  if (!panel) return;
  panel.setAttribute("aria-busy", isBusy ? "true" : "false");
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

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  lastFocusedElement = document.activeElement;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  setBackgroundHidden(true);
  bindFocusTrap(modal);
  const firstInput = modal.querySelector("input, select, textarea");
  const focusable = getFocusableElements(modal);
  const target = firstInput || focusable[0];
  if (target) target.focus();
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  setBackgroundHidden(false);
  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }
  lastFocusedElement = null;
}

function setBackgroundHidden(hidden) {
  const main = document.querySelector(".ip-wrap");
  if (main) {
    if (hidden) {
      main.setAttribute("aria-hidden", "true");
    } else {
      main.removeAttribute("aria-hidden");
    }
  }
  const jump = document.getElementById("ipJumpTopBtn");
  if (jump) {
    if (hidden) {
      jump.setAttribute("aria-hidden", "true");
    } else {
      jump.removeAttribute("aria-hidden");
    }
  }
}

function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden"));
}

function bindFocusTrap(container) {
  if (container.dataset.focusTrap === "true") return;
  container.dataset.focusTrap = "true";
  container.addEventListener("keydown", function (event) {
    if (event.key !== "Tab") return;
    const focusable = getFocusableElements(container);
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

function bindModalEvents() {
  document.querySelectorAll("[data-ip-open]").forEach((button) => {
    button.addEventListener("click", () => openModal(button.dataset.ipOpen));
  });

  document.querySelectorAll("[data-ip-close]").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.dataset.ipClose));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.querySelectorAll(".ip-modal.is-open").forEach((modal) => {
      closeModal(modal.id);
    });
  });
}

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

    const activeTab = target || tabs.find((tab) => tab.classList.contains("is-active")) || tabs[0];
    if (!activeTab) return;
    activeTab.classList.add("is-active");
    activeTab.setAttribute("aria-selected", "true");
    activeTab.setAttribute("tabindex", "0");

    const panelId = activeTab.dataset.ipTab;
    if (panelId) {
      const panel = document.getElementById("panel-" + panelId);
      if (panel) {
        panel.classList.add("is-active");
        panel.setAttribute("aria-hidden", "false");
      }
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", function () {
      syncTabs(tab);
    });

    tab.addEventListener("keydown", function (e) {
      const idx = tabs.indexOf(tab);
      let nextIdx = null;

      if (e.key === "ArrowRight") nextIdx = (idx + 1) % tabs.length;
      else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") nextIdx = 0;
      else if (e.key === "End") nextIdx = tabs.length - 1;

      if (nextIdx !== null) {
        e.preventDefault();
        tabs[nextIdx].focus();
        syncTabs(tabs[nextIdx]);
      }
    });
  });

  syncTabs();
}

function truncateTitle(title, max) {
  max = max || 100;
  if (!title) return "";
  if (title.length <= max) return title;
  return title.substring(0, max).trimEnd() + "\u2026";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function openRecordModal(title, url) {
  const modal = document.getElementById("ipRecordModal");
  const frame = document.getElementById("ipRecordModalFrame");
  const titleEl = document.getElementById("ipRecordModalTitle");
  const openTabBtn = document.getElementById("ipRecordModalOpenTabBtn");
  if (!modal || !frame || !titleEl) return;
  lastRecordFocusedElement = document.activeElement;
  titleEl.textContent = title || "Idea Details";
  frame.src = url;
  if (openTabBtn) openTabBtn.setAttribute("data-url", url || "");
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  setBackgroundHidden(true);
  bindFocusTrap(modal);
  const focusable = getFocusableElements(modal);
  if (focusable[0]) focusable[0].focus();
}

function closeRecordModal() {
  const modal = document.getElementById("ipRecordModal");
  const frame = document.getElementById("ipRecordModalFrame");
  const openTabBtn = document.getElementById("ipRecordModalOpenTabBtn");
  if (!modal || !frame) return;
  frame.src = "about:blank";
  if (openTabBtn) openTabBtn.setAttribute("data-url", "");
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  setBackgroundHidden(false);
  if (
    lastRecordFocusedElement &&
    typeof lastRecordFocusedElement.focus === "function"
  ) {
    lastRecordFocusedElement.focus();
  }
  lastRecordFocusedElement = null;
}

function bindRecordModal() {
  document.addEventListener("click", function (e) {
    const link = e.target.closest("a.ip-recordLink");
    if (!link) return;
    e.preventDefault();
    const url = link.getAttribute("href");
    const title = link.getAttribute("data-title") || "Idea Details";
    if (url) openRecordModal(title, url);
  });

  const closeBtn = document.getElementById("ipRecordModalCloseBtn");
  const openTabBtn = document.getElementById("ipRecordModalOpenTabBtn");
  const modal = document.getElementById("ipRecordModal");

  if (closeBtn) closeBtn.addEventListener("click", closeRecordModal);
  if (openTabBtn)
    openTabBtn.addEventListener("click", function () {
      const url = openTabBtn.getAttribute("data-url") || "";
      if (!url) return;
      window.open(url, "_blank", "noopener");
    });

  if (modal) {
    modal.addEventListener("click", function (e) {
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute("data-ip-record-close") === "1")
        closeRecordModal();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeRecordModal();
  });
}

function wireJumpToTop() {
  var btn = document.getElementById("ipJumpTopBtn");
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
    btn.classList.toggle("is-visible", needsScroll && scrollTop > 120);
  }

  btn.addEventListener("click", function () {
    var prefersReduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      window.scrollTo({ top: 0 });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  window.addEventListener("scroll", updateVisibility, { passive: true });
  window.addEventListener("resize", updateVisibility);
  updateVisibility();
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn.apply(this, args), delay);
  };
}

function getIdeaField(idea, s1Key, fallbackKey) {
  if (idea && idea.s1 && idea.s1[s1Key] !== undefined) {
    return idea.s1[s1Key];
  }
  if (idea && fallbackKey && idea[fallbackKey] !== undefined) {
    return idea[fallbackKey];
  }
  return "";
}

function buildIdeaViewModel(idea) {
  if (!idea || !idea.recordID) return null;
  const recordID = String(idea.recordID);
  const title = sanitizeLeafValue(getIdeaField(idea, IDEA_INDICATORS.title, "title"));
  const category = sanitizeLeafValue(getIdeaField(idea, IDEA_INDICATORS.category, "category"));
  const statusRaw = getIdeaField(idea, IDEA_INDICATORS.status, "status");
  const status = normalizeStatusLabel(sanitizeLeafValue(statusRaw));
  const votes = voteCounts[recordID] || 0;
  const isVoted = userVotes[recordID] === true;
  const createdDate = idea.created_date || "";
  return {
    recordID,
    title,
    category,
    status,
    votes,
    isVoted,
    created_date: createdDate,
    recordLink: RECORD_VIEW_URL + recordID,
  };
}

function buildIdeasViewModelList(rawIdeas, updateMaps) {
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
  if (updateMaps) {
    ideasVMById = vmMap;
  }
  return list;
}

function normalizeStatusLabel(status) {
  if (!status) return "";
  if (status.indexOf("(") >= 0 && status.indexOf(")") >= 0) {
    return status.replace("(", "").replace(")", "").trim();
  }
  return status;
}

function getIdeaSortValue(idea, key, votes) {
  if (!idea) return "";
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
      if (typeof idea.votes === "number") return idea.votes;
      return (votes && votes[idea.recordID]) || 0;
    default:
      return "";
  }
}

function sortIdeasList(list, votes, stateObj) {
  if (!stateObj || !stateObj.key) return list;
  const direction = stateObj.dir === "desc" ? -1 : 1;
  const safeList = list.filter((item) => item && item.recordID);
  return [...safeList].sort((a, b) => {
    const aVal = getIdeaSortValue(a, stateObj.key, votes);
    const bVal = getIdeaSortValue(b, stateObj.key, votes);
    const aNum = typeof aVal === "number";
    const bNum = typeof bVal === "number";
    if (aNum && bNum) {
      return (aVal - bVal) * direction;
    }
    return (
      String(aVal).localeCompare(String(bVal), undefined, {
        numeric: true,
        sensitivity: "base",
      }) * direction
    );
  });
}

function setSortState(tableId, key) {
  const stateObj = sortState[tableId] || { key: "", dir: "asc" };
  if (stateObj.key === key) {
    stateObj.dir = stateObj.dir === "asc" ? "desc" : "asc";
  } else {
    stateObj.key = key;
    stateObj.dir = "asc";
  }
  sortState[tableId] = stateObj;
}

function applySortClasses(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const stateObj = sortState[tableId];
  table.querySelectorAll(".ip-sortable").forEach((th) => {
    th.classList.remove("is-asc", "is-desc");
    const btn = th.querySelector(".ip-sortBtn");
    const key = btn ? btn.getAttribute("data-sort") : null;
    if (stateObj && key === stateObj.key) {
      th.classList.add(stateObj.dir === "asc" ? "is-asc" : "is-desc");
      th.setAttribute(
        "aria-sort",
        stateObj.dir === "asc" ? "ascending" : "descending",
      );
    } else {
      th.setAttribute("aria-sort", "none");
    }
  });
}

function getStatusBadgeClass(status) {
  switch (status) {
    case "New Submission":
      return "ip-badge--new";
    case "Under Review":
      return "ip-badge--review";
    case "In Progress":
      return "ip-badge--progress";
    case "Completed":
      return "ip-badge--done";
    case "Discarded":
      return "ip-badge--discarded";
    default:
      return "";
  }
}

function getIdeaSearchText(idea) {
  if (!idea) return "";
  const recordID = idea.recordID ? String(idea.recordID) : "";
  const title = idea.title || "";
  const category = idea.category || "";
  const status = normalizeStatusLabel(idea.status || "");
  return [recordID, title, category, status].join(" ").toLowerCase();
}

function filterIdeasList(list, query) {
  if (!query) return list;
  const q = query.toLowerCase();
  return list.filter((idea) => getIdeaSearchText(idea).includes(q));
}

function paginateList(list, page, pageSize, showAll) {
  if (showAll) {
    return { pageItems: list, pageCount: 1, page: 1 };
  }
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

function renderTableMessage(tbody, message, options) {
  if (!tbody) return;
  const retry = options && options.retry;
  const buttonHtml = retry
    ? ' <button type="button" class="ip-btn ip-btn--ghost ip-retry">Retry</button>'
    : "";
  tbody.innerHTML = `<tr><td colspan="6">${escapeHtml(message || "")} ${buttonHtml}</td></tr>`;
}

function setVoteButtonsDisabled(isDisabled) {
  document.querySelectorAll('.ip-upvote').forEach((button) => {
    if (isDisabled) {
      button.dataset.loadingDisabled = 'true';
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
      return;
    }
    if (button.dataset.loadingDisabled === 'true') {
      const voted = button.classList.contains('is-voted');
      button.disabled = voted;
      button.setAttribute('aria-disabled', voted ? 'true' : 'false');
      delete button.dataset.loadingDisabled;
    }
  });
}

function buildIdeaRow(idea) {
  if (!idea || !idea.recordID) return "";
  const recordID = String(idea.recordID);
  const titleRaw = idea.title || "";
  const title = escapeHtml(titleRaw);
  const titleDisplay = escapeHtml(truncateTitle(titleRaw));
  const category = escapeHtml(idea.category || "");
  const status = normalizeStatusLabel(idea.status || "");
  const statusBadgeClass = getStatusBadgeClass(status);
  const statusMarkup = status
    ? `<span class="ip-badge ${statusBadgeClass}">${status}</span>`
    : "";
  const votes = idea.votes || 0;
  const isVoted = idea.isVoted === true;
  const recordLink = idea.recordLink || RECORD_VIEW_URL + recordID;
  const labelTitle = title || `Idea ${recordID}`;

  return `<tr data-record-id="${recordID}">
<td><a class="ip-recordLink" data-title="${title}" aria-haspopup="dialog" href="${recordLink}">${recordID}</a></td>
<td title="${title}">${titleDisplay}</td>
<td>${category}</td>
<td>${statusMarkup}</td>
<td class="ip-votes">${votes}</td>
<td class="ip-actionsCell">
<button class="ip-btn ip-btn--ghost ip-btn--icon ip-upvote${isVoted ? " is-voted" : ""}" data-record-id="${recordID}" ${isVoted ? "disabled" : ""} aria-label="Vote for ${labelTitle}" aria-disabled="${isVoted ? "true" : "false"}" title="Vote for this idea">
<span class="material-symbols-outlined" aria-hidden="true">thumb_up</span>
</button>
<button class="ip-btn ip-btn--ghost ip-share" data-record-link="${recordLink}" aria-label="Share ${labelTitle}" title="Copy shareable link">Share</button>
</td>
</tr>`;
}

function updatePaginationUI(scope, totalCount, pageCount, page, showAll, allowToggle) {
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
  if (ui.pageInfo[scope]) {
    ui.pageInfo[scope].textContent = `Page ${page} of ${pageCount}`;
  }
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

function renderAllIdeas() {
  const filtered = filterIdeasList(ideas, state.search);
  const sorted = sortIdeasList(filtered, voteCounts, sortState.tblIdeas);
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

  const rowsHtml = pagination.pageItems.map(buildIdeaRow).join("");
  const emptyMessage = state.search ? "No matching ideas." : "No data found";
  renderRows(ui.results, rowsHtml, emptyMessage);
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
  const sorted = sortIdeasList(myIdeasCache, voteCounts, sortState.tblMyIdeas);
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

  const rowsHtml = pagination.pageItems.map(buildIdeaRow).join("");
  renderRows(ui.myResults, rowsHtml, "No ideas submitted");
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
  let sortedIdeas = ideas.filter((idea) => idea && idea.recordID);
  sortedIdeas = sortedIdeas.sort((a, b) => {
    const aVotes = a.votes || 0;
    const bVotes = b.votes || 0;
    return bVotes - aVotes;
  });

  let top10 = sortedIdeas.slice(0, 10);
  if (sortState.tblTopIdeas.key) {
    top10 = sortIdeasList(top10, voteCounts, sortState.tblTopIdeas);
  }

  applySortClasses("tblTopIdeas");

  const rowsHtml = top10.map(buildIdeaRow).join("");
  renderRows(ui.topResults, rowsHtml, "No data found");
}

function setVotedState(ideanum, isVoted) {
  const ideanumKey = String(ideanum);
  const buttons = document.querySelectorAll(
    `.ip-upvote[data-record-id='${ideanumKey}']`,
  );
  buttons.forEach((button) => {
    button.disabled = isVoted;
    button.classList.toggle("is-voted", isVoted);
    button.setAttribute("aria-disabled", isVoted ? "true" : "false");
  });
}

function updateVoteDom(ideanum) {
  const ideanumKey = String(ideanum);
  const ideaVM = ideasVMById[ideanumKey];
  if (ideaVM) {
    ideaVM.votes = voteCounts[ideanumKey] || 0;
    ideaVM.isVoted = true;
  }
  const myIdea = myIdeasCache.find((idea) => String(idea.recordID) === ideanumKey);
  if (myIdea) {
    myIdea.votes = voteCounts[ideanumKey] || 0;
    myIdea.isVoted = true;
  }
  const rows = document.querySelectorAll(`tr[data-record-id='${ideanumKey}']`);
  rows.forEach((row) => {
    const voteCell = row.querySelector(".ip-votes");
    if (voteCell) {
      voteCell.textContent = voteCounts[ideanumKey] || 0;
    }
  });
  setVotedState(ideanumKey, true);
}

function IdeaVotes(ideanum) {
  const ideanumKey = String(ideanum);
  if (votingInProgress) return;
  if (userVotes[ideanumKey]) {
    alert("You already voted on this idea.");
    return;
  }
  votingInProgress = true;

  userVotes[ideanumKey] = true;
  setVotedState(ideanumKey, true);

  const payload = {
    service: "",
    title: "Idea #" + ideanumKey,
    priority: 0,
    CSRFToken: csrfToken,
  };
  payload["numform_" + FORM_KEYS.votes] = 1;
  payload[VOTE_FIELDS.user] = userID;
  payload[VOTE_FIELDS.idea] = ideanumKey;

  console.log("[IdeaVotes] payload", payload);

  apiPostJson("./api/?a=form/new", payload)
    .then(function (response) {
      console.log("[IdeaVotes] raw response", response);
      var recordID = parseFloat(response);
      if (!isNaN(recordID) && isFinite(recordID) && recordID !== 0) {
        voteCounts[ideanumKey] = (voteCounts[ideanumKey] || 0) + 1;
        updateVoteDom(ideanumKey);
        renderTop10Ideas();
        if (sortState.tblIdeas.key === "votes") {
          renderAllIdeas();
        }
        if (sortState.tblMyIdeas.key === "votes") {
          renderMyIdeas();
        }
        try { localStorage.setItem("leafIdeaVotes", JSON.stringify(userVotes)); } catch (e) {}
        alert("Thanks for voting!");
      } else {
        console.error("[IdeaVotes] failed response:", response);
        alert("Error processing vote. See console for details.");
        userVotes[ideanumKey] = false;
        const ideaVM = ideasVMById[ideanumKey];
        if (ideaVM) ideaVM.isVoted = false;
        const myIdea = myIdeasCache.find((idea) => String(idea.recordID) === ideanumKey);
        if (myIdea) myIdea.isVoted = false;
        setVotedState(ideanumKey, false);
      }
    })
    .catch(function () {
      console.error("[IdeaVotes] request error");
      alert("Error processing vote. See console for details.");
      userVotes[ideanumKey] = false;
      const ideaVM = ideasVMById[ideanumKey];
      if (ideaVM) ideaVM.isVoted = false;
      const myIdea = myIdeasCache.find((idea) => String(idea.recordID) === ideanumKey);
      if (myIdea) myIdea.isVoted = false;
      setVotedState(ideanumKey, false);
    })
    .finally(function () {
      votingInProgress = false;
    });
}

function filterIdeasByUser() {
  if (!userID) return [];
  return ideas.filter((idea) => {
    const owner = ideaOwnerMap[String(idea.recordID)] || "";
    return owner === userID;
  });
}

function buildIdeasQueryUrl() {
  const query = {
    terms: [
      { id: "categoryID", operator: "=", match: FORM_IDS.idea, gate: "AND" },
      { id: "deleted", operator: "=", match: 0, gate: "AND" },
    ],
    joins: [],
    sort: { id: "created_date", direction: "desc" },
    getData: IDEA_GETDATA,
  };
  const queryString = encodeURIComponent(JSON.stringify(query));
  return `https://leaf.va.gov/platform/ideas/api/form/query/?q=${queryString}&x-filterData=recordID,title,created_date,userID`;
}

function buildVotesQueryUrl() {
  const query = {
    terms: [
      { id: "categoryID", operator: "=", match: FORM_IDS.votes, gate: "AND" },
      { id: "deleted", operator: "=", match: 0, gate: "AND" },
    ],
    joins: [],
    sort: {},
    getData: VOTE_GETDATA,
  };
  const queryString = encodeURIComponent(JSON.stringify(query));
  return `https://leaf.va.gov/platform/ideas/api/form/query/?q=${queryString}&x-filterData=recordID,title`;
}

function fetchIdeasData() {
  return apiGetJson(buildIdeasQueryUrl()).then(function (data) {
    return Object.values(data || {});
  });
}

function fetchVotesData() {
  return apiGetJson(buildVotesQueryUrl()).then(function (voteData) {
    voteCounts = {};
    userVotes = {};

    const votesList = Object.values(voteData || {});
    votesList.forEach((vote) => {
      let ideanum = vote.s1 && vote.s1[VOTE_INDICATORS.idea];
      let voter = vote.s1 && vote.s1[VOTE_INDICATORS.user];
      if (ideanum !== undefined && ideanum !== null && ideanum !== "") {
        const ideanumKey = String(ideanum);
        if (voteCounts[ideanumKey]) {
          voteCounts[ideanumKey]++;
        } else {
          voteCounts[ideanumKey] = 1;
        }
        if (voter && voter === userID) {
          userVotes[ideanumKey] = true;
        }
      }
    });
    try {
      var saved = JSON.parse(localStorage.getItem("leafIdeaVotes") || "{}");
      Object.keys(saved).forEach(function (k) { if (saved[k]) userVotes[k] = true; });
    } catch (e) {}
    return votesList.length;
  });
}

function fetchUserSubmissions() {
  if (!userID) {
    myIdeasCache = [];
    setStatus("my", "No user ID found", "error");
    renderMyIdeas();
    return Promise.resolve();
  }

  setPanelBusy("my", true);
  setStatus("my", "Loading your ideas...", "loading");
  renderTableMessage(ui.myResults, "Loading...");

  const query = {
    terms: [
      { id: "userID", operator: "=", match: userID, gate: "AND" },
      { id: "categoryID", operator: "=", match: FORM_IDS.idea, gate: "AND" },
      { id: "deleted", operator: "=", match: 0, gate: "AND" },
    ],
    joins: [],
    sort: {},
    getData: IDEA_GETDATA,
  };
  const queryString = encodeURIComponent(JSON.stringify(query));

  return apiGetJson(
    "https://leaf.va.gov/platform/ideas/api/form/query/?q=" +
      queryString +
      "&x-filterData=recordID,title,created_date,userID",
  )
    .then(function (data) {
      let userIdeas = Object.values(data || {}).map((idea) => {
        const recordKey = idea && idea.recordID ? String(idea.recordID) : "";
        if (!idea.s1 && recordKey && ideasById[recordKey]) {
          return ideasById[recordKey];
        }
        return idea;
      });
      if (userIdeas.length === 0) {
        const fallbackIdeas = filterIdeasByUser();
        myIdeasCache = fallbackIdeas;
      } else {
        myIdeasCache = buildIdeasViewModelList(userIdeas, false);
      }
      renderMyIdeas();
      setStatus("my", "", "");
    })
    .catch(function (error) {
      console.error("AJAX Error: ", error);
      renderTableMessage(ui.myResults, "Error loading user ideas.", { retry: true });
      setStatus("my", "Error loading user ideas.", "error");
    })
    .finally(function () {
      setPanelBusy("my", false);
    });
}

function loadIdeasAndVotes() {
  setPanelBusy("all", true);
  setStatus("all", "Loading ideas...", "loading");
  renderTableMessage(ui.results, "Loading...");
  renderTableMessage(ui.topResults, "Loading...");
  setVoteButtonsDisabled(true);

  const fetchStart = performance.now();

  return Promise.all([fetchIdeasData(), fetchVotesData()])
    .then(function ([ideasData, voteCount]) {
      const fetchEnd = performance.now();
      ideasRaw = ideasData;
      ideas = buildIdeasViewModelList(ideasRaw, true);
      const renderStart = performance.now();
      renderAllIdeas();
      renderTop10Ideas();
      setStatus("all", "", "");
      const renderEnd = performance.now();
      logDebug("Fetch duration (ms)", Math.round(fetchEnd - fetchStart));
      logDebug("Render duration (ms)", Math.round(renderEnd - renderStart));
      logDebug("Counts", {
        ideas: ideas.length,
        votes: voteCount,
        filtered: filterIdeasList(ideas, state.search).length,
      });
      return fetchUserSubmissions();
    })
    .catch(function (error) {
      console.error("IdeaPortal load error", error);
      renderTableMessage(ui.results, "Error loading ideas.", { retry: true });
      renderTableMessage(ui.topResults, "Error loading ideas.", { retry: true });
      setStatus("all", "Error loading data.", "error");
    })
    .finally(function () {
      setPanelBusy("all", false);
      setVoteButtonsDisabled(false);
    });
}

function getAttachmentValue() {
  const fileList = document.getElementById("fileList");
  const fileInput = document.getElementById("fileInput");
  let files = [];

  if (fileList) {
    files = Array.from(fileList.querySelectorAll("li"))
      .map((item) => item.textContent.trim())
      .filter(Boolean);
  }

  if (!files.length && fileInput && fileInput.files && fileInput.files.length) {
    files = Array.from(fileInput.files).map((file) => file.name).filter(Boolean);
  }

  return files.length ? files.join("\r\n") : "";
}

function NewIdea() {
  if (ideaSubmitInProgress) return;
  const form = document.getElementById("ideaForm");
  const submitButton = document.getElementById("submitButton");
  const titleInput = document.getElementById("inpTitle");
  const descriptionInput = document.getElementById("inpDescription");
  const benefitInput = document.getElementById("inpBenefit");
  const categoryInput = document.getElementById("inpCategory");
  const impactInput = document.getElementById("inpImpact");
  const otherCategoryInput = document.getElementById("inpOtherCategory");
  const submissionAlert = document.getElementById("submissionAlert");

  const titleValue = titleInput ? titleInput.value.trim() : "";
  const descriptionValue = descriptionInput ? descriptionInput.value.trim() : "";
  const benefitValue = benefitInput ? benefitInput.value.trim() : "";
  const categoryValue = categoryInput ? categoryInput.value.trim() : "";
  const impactValue = impactInput ? impactInput.value.trim() : "";
  const otherCategoryValue = otherCategoryInput ? otherCategoryInput.value.trim() : "";

  const payload = {
    service: "",
    title: titleValue || "Idea Submission",
    priority: 0,
    CSRFToken: csrfToken,
  };
  payload["numform_" + FORM_KEYS.idea] = 1;
  payload[IDEA_FIELDS.title] = titleValue;
  payload[IDEA_FIELDS.summary] = descriptionValue;
  payload[IDEA_FIELDS.benefit] = benefitValue;
  payload[IDEA_FIELDS.category] = categoryValue;
  payload[IDEA_FIELDS.impact] = impactValue;
  if (categoryValue === "Other" && otherCategoryValue) {
    payload[IDEA_FIELDS.other_category] = otherCategoryValue;
  }

  if (submitButton) submitButton.disabled = true;
  if (submissionAlert) submissionAlert.hidden = true;
  ideaSubmitInProgress = true;

  apiPostJson("./api/?a=form/new", payload)
    .then(function (response) {
      var recordID = parseFloat(response);
      if (!isNaN(recordID) && isFinite(recordID) && recordID !== 0) {
        // Capture files BEFORE any reset happens
        var fileInputEl = document.getElementById("fileInput");
        const filesToUpload = (fileInputEl && fileInputEl.files) ? Array.from(fileInputEl.files) : [];

        if (filesToUpload.length > 0) {
          const formData = new FormData();
          formData.append("CSRFToken", csrfToken);
          filesToUpload.forEach(file => {
            formData.append("10", file);
          });
          console.log("[IdeaUpload] uploading", filesToUpload.length, "file(s) to record", recordID);
          fetch(`./api/?a=form/${recordID}`, {
            method: "POST",
            credentials: "same-origin",
            body: formData,
          })
          .then(r => r.text())
          .then(uploadResponse => {
            console.log("[IdeaUpload] response", uploadResponse);
          })
          .catch(err => {
            console.warn("[IdeaUpload] file upload failed", err);
          });
        }

        alert("Your idea has been submitted successfully.");
        if (form) {
          form.reset();
          form.classList.remove("was-validated");
        }
        if (fileInputEl) fileInputEl.value = "";
        const fileList = document.getElementById("fileList");
        if (fileList) fileList.innerHTML = "";
        closeModal("addIdeaModal");
        updateTable();
      } else {
        alert("Error submitting idea.");
      }
    })
    .catch(function () {
      alert("Error submitting idea.");
    })
    .finally(function () {
      ideaSubmitInProgress = false;
      if (submitButton) submitButton.disabled = false;
    });
}

function updateTable() {
  return loadIdeasAndVotes();
}

function handleSortClick(sortBtn) {
  const key = sortBtn.getAttribute("data-sort");
  const table = sortBtn.closest("table");
  if (!table || !key) return;
  const tableId = table.getAttribute("id");
  setSortState(tableId, key);
  applySortClasses(tableId);

  if (tableId === "tblIdeas") {
    state.pagination.all.page = 1;
    renderAllIdeas();
  } else if (tableId === "tblTopIdeas") {
    renderTop10Ideas();
  } else if (tableId === "tblMyIdeas") {
    state.pagination.my.page = 1;
    renderMyIdeas();
  }
}

function handlePaginationAction(scope, action) {
  const pager = state.pagination[scope];
  if (!pager) return;

  if (action === "prev") {
    pager.page = Math.max(1, pager.page - 1);
  } else if (action === "next") {
    pager.page += 1;
  } else if (action === "toggle") {
    pager.showAll = !pager.showAll;
    pager.page = 1;
  }

  if (scope === "all") {
    renderAllIdeas();
  } else if (scope === "my") {
    renderMyIdeas();
  }
}

function bindDelegatedEvents() {
  const wrap = document.querySelector(".ip-wrap");
  if (!wrap) return;

  wrap.addEventListener("click", function (e) {
    const sortBtn = e.target.closest(".ip-sortBtn");
    if (sortBtn) {
      handleSortClick(sortBtn);
      return;
    }

    const retryBtn = e.target.closest(".ip-retry");
    if (retryBtn) {
      updateTable();
      return;
    }

    const upvoteBtn = e.target.closest(".ip-upvote");
    if (upvoteBtn) {
      if (upvoteBtn.disabled) return;
      const ideanum = upvoteBtn.getAttribute("data-record-id");
      IdeaVotes(ideanum);
      return;
    }

    const shareBtn = e.target.closest(".ip-share");
    if (shareBtn) {
      const recordLink = shareBtn.getAttribute("data-record-link");
      if (!recordLink) return;
      navigator.clipboard.writeText(recordLink).then(
        function () {
          alert("Idea link copied to clipboard.");
        },
        function (err) {
          console.error("Could not copy link: ", err);
        },
      );
      return;
    }

    const pageBtn = e.target.closest(".ip-pageBtn, .ip-pageToggle");
    if (pageBtn) {
      const scope = pageBtn.getAttribute("data-page-scope");
      const action = pageBtn.getAttribute("data-page-action");
      if (scope && action) {
        handlePaginationAction(scope, action);
      }
    }
  });
}

function applySearch(value) {
  state.search = value.trim();
  if (!state.pagination.all.showAll) {
    state.pagination.all.page = 1;
  }
  renderAllIdeas();
}

function bindSearch() {
  if (!ui.searchInput) return;
  const handler = debounce(function (event) {
    applySearch(event.target.value);
  }, SEARCH_DEBOUNCE_MS);

  ui.searchInput.addEventListener("input", handler);
  ui.searchInput.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applySearch(ui.searchInput.value);
  });

  if (ui.searchBtn) {
    ui.searchBtn.addEventListener("click", function () {
      applySearch(ui.searchInput.value);
    });
  }
}

function bindFileInput() {
  const fileInput = document.getElementById("fileInput");
  const fileList = document.getElementById("fileList");
  if (!fileInput || !fileList) return;

  fileInput.addEventListener("change", function () {
    const files = fileInput.files || [];
    fileList.innerHTML = "";
    Array.from(files).forEach((file) => {
      const listItem = document.createElement("li");
      listItem.textContent = file.name;
      fileList.appendChild(listItem);
    });
  });
}

function populateSelect(select, options, appendOther) {
  var placeholder = select.options[0];
  select.innerHTML = "";
  if (placeholder) {
    select.appendChild(placeholder);
  }
  options.forEach(function (label) {
    var opt = document.createElement("option");
    opt.value = label;
    opt.textContent = label;
    select.appendChild(opt);
  });
  if (appendOther) {
    var otherOpt = document.createElement("option");
    otherOpt.value = "Other";
    otherOpt.textContent = "Other";
    select.appendChild(otherOpt);
  }
}

function bindCategoryChange() {
  var categorySelect = document.getElementById("inpCategory");
  var otherWrapper = document.getElementById("otherCategoryWrapper");
  var otherInput = document.getElementById("inpOtherCategory");
  if (!categorySelect || !otherWrapper || !otherInput) return;

  categorySelect.addEventListener("change", function () {
    if (categorySelect.value === "Other") {
      otherWrapper.style.display = "";
      otherInput.required = true;
    } else {
      otherWrapper.style.display = "none";
      otherInput.value = "";
      otherInput.required = false;
      otherInput.removeAttribute("aria-invalid");
    }
  });
}

function initValidation() {
  "use strict";

  var forms = document.querySelectorAll(".needs-validation");
  Array.prototype.slice.call(forms).forEach(function (form) {
    form.addEventListener(
      "input",
      function (event) {
        var target = event.target;
        if (target && target.classList.contains("ip-input")) {
          if (target.checkValidity()) {
            target.removeAttribute("aria-invalid");
          }
        }
        if (target && target.id === "inpOtherCategory" && target.value.trim()) {
          target.removeAttribute("aria-invalid");
        }
      },
      false,
    );
    form.addEventListener(
      "submit",
      function (event) {
        var inputs = form.querySelectorAll(".ip-input");
        inputs.forEach(function (input) {
          if (!input.checkValidity()) {
            input.setAttribute("aria-invalid", "true");
          } else {
            input.removeAttribute("aria-invalid");
          }
        });
        var categoryEl = form.querySelector("#inpCategory");
        var otherCatEl = form.querySelector("#inpOtherCategory");
        if (otherCatEl && categoryEl && categoryEl.value === "Other") {
          if (!otherCatEl.value.trim()) {
            otherCatEl.setAttribute("aria-invalid", "true");
          } else {
            otherCatEl.removeAttribute("aria-invalid");
          }
        }
        if (!form.checkValidity()) {
          event.preventDefault();
          event.stopPropagation();
        } else {
          event.preventDefault();
          if (typeof NewIdea === "function") {
            NewIdea();
          }
        }
        form.classList.add("was-validated");
      },
      false,
    );
  });
}

document.addEventListener("DOMContentLoaded", function () {
  if (window.$ || window.jQuery) {
    console.warn("IdeaPortal:  is loaded but no longer required.");
  }
  cacheElements();
  bindModalEvents();
  bindTabs();
  bindRecordModal();
  bindDelegatedEvents();
  bindSearch();
  bindFileInput();
  bindCategoryChange();
  populateSelect(document.getElementById("inpCategory"), CATEGORY_FALLBACK, true);
  populateSelect(document.getElementById("inpImpact"), IMPACT_FALLBACK, false);
  wireJumpToTop();
  initValidation();
  try {
    updateTable();
  } catch (err) {
    console.error("updateTable failed", err);
  }
});
