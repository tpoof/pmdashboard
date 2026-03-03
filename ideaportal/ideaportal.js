const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 200;

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


let ideas = [];
let voteCounts = {};
const portalConfig = window.leafIdeaPortal || {};

function sanitizeLeafValue(value) {
  return String(value || "").replace(/<!--|-->/g, "").trim();
}

const userID = sanitizeLeafValue(portalConfig.userID);
const csrfToken = sanitizeLeafValue(portalConfig.csrfToken);
let userVotes = {};
let votingInProgress = false;
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
  searchButton: null,
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
  ui.searchButton = document.getElementById("searchButton");
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
      return String(getIdeaField(idea, IDEA_INDICATORS.title, "title") || "");
    case "category":
      return String(getIdeaField(idea, IDEA_INDICATORS.category, "category") || "");
    case "status":
      return String(normalizeStatusLabel(getIdeaField(idea, IDEA_INDICATORS.status, "status")));
    case "votes":
      return votes[idea.recordID] || 0;
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
  const recordID = idea && idea.recordID ? String(idea.recordID) : "";
  const title = getIdeaField(idea, IDEA_INDICATORS.title, "title");
  const category = getIdeaField(idea, IDEA_INDICATORS.category, "category");
  const status = normalizeStatusLabel(getIdeaField(idea, IDEA_INDICATORS.status, "status"));
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

function buildIdeaRow(idea) {
  if (!idea || !idea.recordID) return "";
  const recordID = idea.recordID;
  const title = escapeHtml(getIdeaField(idea, IDEA_INDICATORS.title, "title"));
  const category = escapeHtml(getIdeaField(idea, IDEA_INDICATORS.category, "category"));
  const status = normalizeStatusLabel(getIdeaField(idea, IDEA_INDICATORS.status, "status"));
  const statusBadgeClass = getStatusBadgeClass(status);
  const statusMarkup = status
    ? `<span class="ip-badge ${statusBadgeClass}">${status}</span>`
    : "";
  const votes = voteCounts[recordID] || 0;
  const isVoted = userVotes[String(recordID)] === true;

  return `<tr data-record-id="${recordID}">
<td><a class="ip-recordLink" data-title="${title}" aria-haspopup="dialog" href="https://leaf.va.gov/platform/ideas/index.php?a=printview&recordID=${recordID}">${recordID}</a></td>
<td>${title}</td>
<td>${category}</td>
<td>${statusMarkup}</td>
<td class="ip-votes">${votes}</td>
<td class="ip-actionsCell">
<button class="ip-btn ip-btn--ghost ip-btn--icon ip-upvote${isVoted ? " is-voted" : ""}" data-record-id="${recordID}" ${isVoted ? "disabled" : ""} aria-label="Upvote">
<span aria-hidden="true">&#128077;</span>
</button>
<button class="ip-btn ip-btn--ghost ip-share" data-record-link="https://leaf.va.gov/platform/ideas/index.php?a=printview&recordID=${recordID}">Share</button>
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
    const aVotes = voteCounts[a.recordID] || 0;
    const bVotes = voteCounts[b.recordID] || 0;
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
  });
}

function updateVoteDom(ideanum) {
  const ideanumKey = String(ideanum);
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

  $.ajax({
    type: "POST",
    url: "./api/?a=form/new",
    dataType: "json",
    data: payload,
    cache: false,
  })
    .done(function (response) {
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
        alert("Thanks for voting!");
      } else {
        alert("Error processing vote.");
        userVotes[ideanumKey] = false;
        setVotedState(ideanumKey, false);
      }
    })
    .fail(function () {
      alert("Error processing vote.");
      userVotes[ideanumKey] = false;
      setVotedState(ideanumKey, false);
    })
    .always(function () {
      votingInProgress = false;
    });
}

function filterIdeasByUser() {
  if (!userID) return [];
  return ideas.filter((idea) => {
    const owner = idea.userID || "";
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
  setPanelBusy("all", true);
  setStatus("all", "Loading ideas...", "loading");

  return $.ajax({
    url: buildIdeasQueryUrl(),
    type: "GET",
    cache: false,
    dataType: "json",
  })
    .done(function (data) {
      ideas = Object.values(data || {});
      renderAllIdeas();
    })
    .fail(function (xhr, status, error) {
      console.error("AJAX Error: ", status, error);
      renderRows(ui.results, "", "Error loading data");
      setStatus("all", "Error loading data.", "error");
    })
    .always(function () {
      setPanelBusy("all", false);
    });
}

function fetchVotesData() {
  return $.ajax({
    url: buildVotesQueryUrl(),
    type: "GET",
    cache: false,
    dataType: "json",
  }).then(
    function (voteData) {
      voteCounts = {};
      userVotes = {};

      Object.values(voteData || {}).forEach((vote) => {
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
      return true;
    },
    function (xhr, status, error) {
      console.error("AJAX Error: ", status, error);
      return false;
    },
  );
}

function fetchUserSubmissions() {
  if (!userID) {
    myIdeasCache = [];
    setStatus("my", "No user ID found", "error");
    renderMyIdeas();
    return $.Deferred().resolve().promise();
  }

  setPanelBusy("my", true);
  setStatus("my", "Loading your ideas...", "loading");

  const query = {
    terms: [
      { id: "userID", operator: "=", match: userID, gate: "AND" },
      { id: "categoryID", operator: "=", match: FORM_IDS.idea, gate: "AND" },
      { id: "deleted", operator: "=", match: 0, gate: "AND" },
    ],
    joins: [],
    sort: {},
    getData: ["8", "5", "20"],
  };
  const queryString = encodeURIComponent(JSON.stringify(query));

  return $.ajax({
    url: `https://leaf.va.gov/platform/ideas/api/form/query/?q=${queryString}&x-filterData=recordID,title,created_date,userID`,
    type: "GET",
    cache: false,
    dataType: "json",
  })
    .done(function (data) {
      let userIdeas = Object.values(data || {}).map((idea) => {
        if (!idea.s1 && idea.recordID) {
          const match = ideas.find((item) => item.recordID === idea.recordID);
          return match ? match : idea;
        }
        return idea;
      });
      if (userIdeas.length === 0) {
        const fallbackIdeas = filterIdeasByUser();
        myIdeasCache = fallbackIdeas;
      } else {
        myIdeasCache = userIdeas;
      }
      renderMyIdeas();
      setStatus("my", "", "");
    })
    .fail(function (xhr, status, error) {
      console.error("AJAX Error: ", status, error);
      renderRows(ui.myResults, "", "Error loading user ideas");
      setStatus("my", "Error loading user ideas.", "error");
    })
    .always(function () {
      setPanelBusy("my", false);
    });
}

function loadIdeasAndVotes() {
  return fetchIdeasData()
    .then(function () {
      return fetchVotesData();
    })
    .then(function () {
      setStatus("all", "", "");
      renderAllIdeas();
      renderTop10Ideas();
      return fetchUserSubmissions();
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

  return files.length ? files.join("
") : "";
}

function NewIdea() {
  const form = document.getElementById("ideaForm");
  const submitButton = document.getElementById("submitButton");
  const titleInput = document.getElementById("inpTitle");
  const descriptionInput = document.getElementById("inpDescription");
  const benefitInput = document.getElementById("inpBenefit");
  const categoryInput = document.getElementById("inpCategory");
  const impactInput = document.getElementById("inpImpact");
  const submissionAlert = document.getElementById("submissionAlert");

  const titleValue = titleInput ? titleInput.value.trim() : "";
  const descriptionValue = descriptionInput ? descriptionInput.value.trim() : "";
  const benefitValue = benefitInput ? benefitInput.value.trim() : "";
  const categoryValue = categoryInput ? categoryInput.value.trim() : "";
  const impactValue = impactInput ? impactInput.value.trim() : "";

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

  const attachmentValue = getAttachmentValue();
  if (attachmentValue) {
    payload[IDEA_FIELDS.attachment] = attachmentValue;
  }

  if (submitButton) submitButton.disabled = true;
  if (submissionAlert) submissionAlert.hidden = true;

  $.ajax({
    type: "POST",
    url: "./api/?a=form/new",
    dataType: "json",
    data: payload,
    cache: false,
  })
    .done(function (response) {
      var recordID = parseFloat(response);
      if (!isNaN(recordID) && isFinite(recordID) && recordID !== 0) {
        alert("Your idea has been submitted successfully.");
        if (form) {
          form.reset();
          form.classList.remove("was-validated");
        }
        const fileList = document.getElementById("fileList");
        if (fileList) fileList.innerHTML = "";
        closeModal("addIdeaModal");
        updateTable();
      } else {
        alert("Error submitting idea.");
      }
    })
    .fail(function () {
      alert("Error submitting idea.");
    })
    .always(function () {
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

  if (ui.searchButton) {
    ui.searchButton.addEventListener("click", function () {
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
  cacheElements();
  bindModalEvents();
  bindTabs();
  bindRecordModal();
  bindDelegatedEvents();
  bindSearch();
  bindFileInput();
  wireJumpToTop();
  initValidation();
  loadIdeasAndVotes();
});
