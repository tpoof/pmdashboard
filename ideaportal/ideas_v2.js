/* ════════════════════════════════════════════════════════════════
   LEAF Idea Portal — ideas_v2.js
   Blueprint Pro integration + LeafFormQuery refactor
   ════════════════════════════════════════════════════════════════ */

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

const IDEA_GETDATA = [
  String(IDEA_FIELDS.category),
  String(IDEA_FIELDS.title),
  String(IDEA_FIELDS.status),
];

const VOTE_GETDATA = [String(VOTE_FIELDS.idea), String(VOTE_FIELDS.user)];

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

/* ─────────────────────────────────────────────────────────────
   Utilities
───────────────────────────────────────────────────────────── */

function sanitizeLeafValue(value) {
  return String(value || "")
    .replace(/<!--|-->/g, "")
    .trim();
}

function logDebug(message, data) {
  if (!debugEnabled) return;
  if (data !== undefined) {
    console.log("IdeaPortal debug:", message, data);
  } else {
    console.log("IdeaPortal debug:", message);
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncateTitle(title, max) {
  max = max || 100;
  if (!title) return "";
  if (title.length <= max) return title;
  return title.substring(0, max).trimEnd() + "…";
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn.apply(this, args), delay);
  };
}

/* ─────────────────────────────────────────────────────────────
   API helpers (POST only — reads now use LeafFormQuery)
───────────────────────────────────────────────────────────── */

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
          throw new Error(`Request failed with status ${response.status}`);
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

/* ─────────────────────────────────────────────────────────────
   State
───────────────────────────────────────────────────────────── */

const userID = sanitizeLeafValue(portalConfig.userID);
const csrfToken = sanitizeLeafValue(portalConfig.csrfToken);
let userVotes = (function () {
  try {
    return JSON.parse(localStorage.getItem("leafIdeaVotes") || "{}");
  } catch (e) {
    return {};
  }
})();
let votingInProgress = false;
let ideaSubmitInProgress = false;
let implementedCount = 0;
let myIdeasCache = [];
let lastFocusedElement = null;
let lastRecordFocusedElement = null;

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
   Toast (replaces showSuccessMessage + alert calls)
───────────────────────────────────────────────────────────── */

let _toastTimer = null;

function showToast(msg, isError) {
  const toast = document.getElementById("ipToast");
  if (!toast) return;
  toast.textContent = msg || "";
  toast.classList.toggle("is-error", !!isError);
  toast.classList.add("is-visible");
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(hideToast, 4000);
}

function hideToast() {
  const toast = document.getElementById("ipToast");
  if (toast) toast.classList.remove("is-visible");
}

/* ─────────────────────────────────────────────────────────────
   Debug Panel
───────────────────────────────────────────────────────────── */

const PortalDebug = (function () {
  function el(id) {
    return document.getElementById(id);
  }

  function color(status) {
    if (status === "success") return "#4ade80";
    if (status === "error") return "#f87171";
    if (status === "loading") return "#facc15";
    return "#94a3b8";
  }

  function icon(status) {
    if (status === "success") return "✅";
    if (status === "error") return "❌";
    if (status === "loading") return "⏳";
    return "○";
  }

  const state = {
    dom: "initializing",
    leaf: "unknown",
    ideas: { status: "pending", count: 0, error: null },
    votes: { status: "pending", count: 0, error: null },
    stats: { total: "—", implemented: "—", votes: "—" },
    initFired: false,
    tables: { results: 0, topResults: 0, myResults: 0 },
  };

  function render() {
    const panel = el("ipDebugPanel");
    if (!panel) return;

    const domEl = el("ipDbgDom");
    if (domEl) {
      domEl.textContent = `🌐 DOM readyState: ${state.dom}`;
      domEl.style.color =
        state.dom === "complete" || state.dom === "interactive"
          ? "#4ade80"
          : "#facc15";
    }

    const leafEl = el("ipDbgLeaf");
    if (leafEl) {
      const ok = typeof LeafFormQuery !== "undefined";
      leafEl.textContent = `📦 LeafFormQuery: ${ok ? "available ✅" : "NOT FOUND ❌"}`;
      leafEl.style.color = ok ? "#4ade80" : "#f87171";
    }

    const userEl = el("ipDbgUser");
    if (userEl) {
      const uid = (window.leafIdeaPortal || {}).userID || "(none)";
      const isReal = uid && !uid.includes("<!--");
      userEl.textContent = `👤 userID: ${isReal ? uid.substring(0, 20) : "(Smarty not rendering — check CMS)"}`;
      userEl.style.color = isReal ? "#4ade80" : "#f87171";
    }

    const initEl = el("ipDbgInit");
    if (initEl) {
      initEl.textContent = `🔧 init fired: ${state.initFired ? "yes ✅" : "NO — not yet (possible DOMContentLoaded miss)"}`;
      initEl.style.color = state.initFired ? "#4ade80" : "#f87171";
    }

    const ideasEl = el("ipDbgIdeas");
    if (ideasEl) {
      const i = state.ideas;
      ideasEl.textContent = `${icon(i.status)} Ideas query: ${i.status}${i.count ? ` — ${i.count} records` : ""}${i.error ? ` | ERR: ${i.error}` : ""}`;
      ideasEl.style.color = color(i.status);
    }

    const votesEl = el("ipDbgVotes");
    if (votesEl) {
      const v = state.votes;
      votesEl.textContent = `${icon(v.status)} Votes query: ${v.status}${v.count ? ` — ${v.count} records` : ""}${v.error ? ` | ERR: ${v.error}` : ""}`;
      votesEl.style.color = color(v.status);
    }

    const statsEl = el("ipDbgStats");
    if (statsEl) {
      statsEl.textContent = `📊 Stats → total: ${state.stats.total} | implemented: ${state.stats.implemented} | votes: ${state.stats.votes}`;
    }

    const tableEl = el("ipDbgTable");
    if (tableEl) {
      const t = state.tables;
      tableEl.textContent = `📋 Rows rendered → All: ${t.results} | Top10: ${t.topResults} | Mine: ${t.myResults}`;
    }
  }

  function wireToggle() {
    const btn = el("ipDbgToggle");
    const body = el("ipDbgBody");
    const icon = el("ipDbgToggleIcon");
    if (!btn || !body) return;
    btn.addEventListener("click", function () {
      const hidden = body.style.display === "none";
      body.style.display = hidden ? "grid" : "none";
      if (icon) icon.textContent = hidden ? "▼" : "▲";
    });
  }

  return {
    init: function () {
      wireToggle();
      state.dom = document.readyState;
      render();
    },
    set: function (key, value) {
      const parts = key.split(".");
      let obj = state;
      for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
      obj[parts[parts.length - 1]] = value;
      render();
    },
    error: function (msg) {
      const errEl = el("ipDbgErr");
      if (errEl) {
        errEl.style.display = "block";
        errEl.textContent = `🚨 ${msg}`;
      }
      render();
    },
    render,
  };
})();

/* ─────────────────────────────────────────────────────────────
   Stats strip
───────────────────────────────────────────────────────────── */

function renderStatsStrip(totalIdeas, implemented, totalVotes) {
  const ideasEl = document.getElementById("statTotalIdeas");
  const implementedEl = document.getElementById("statImplemented");
  const votesEl = document.getElementById("statTotalVotes");
  if (ideasEl) ideasEl.textContent = totalIdeas.toLocaleString();
  if (implementedEl) implementedEl.textContent = implemented.toLocaleString();
  if (votesEl) votesEl.textContent = totalVotes.toLocaleString();
  PortalDebug.set("stats.total", totalIdeas);
  PortalDebug.set("stats.implemented", implemented);
  PortalDebug.set("stats.votes", totalVotes);
}

/* ─────────────────────────────────────────────────────────────
   Category sidebar
───────────────────────────────────────────────────────────── */

function buildCategorySidebar(ideaList) {
  const catList = document.getElementById("catList");
  if (!catList) return;

  // Count ideas per category
  const counts = {};
  let totalCount = 0;
  (ideaList || []).forEach((idea) => {
    const cat = (idea.category || "").trim() || "Uncategorized";
    counts[cat] = (counts[cat] || 0) + 1;
    totalCount++;
  });

  // Build sorted category items
  const sorted = Object.keys(counts).sort((a, b) => a.localeCompare(b));

  // Update "All" count
  const allCountEl = document.getElementById("ip-cat-count-all");
  if (allCountEl) allCountEl.textContent = totalCount;

  // Remove existing dynamic items (keep "All")
  Array.from(catList.querySelectorAll("li[data-cat]")).forEach((li) => {
    if (li.querySelector("[data-cat='all']")) return;
    catList.removeChild(li);
  });

  sorted.forEach((cat) => {
    const li = document.createElement("li");
    li.setAttribute("data-cat", cat);
    li.innerHTML = `<button class="ip-catItem" data-cat="${escapeHtml(cat)}" type="button">
      <span>${escapeHtml(cat)}</span>
      <span class="ip-catCount">${counts[cat]}</span>
    </button>`;
    catList.appendChild(li);
  });

  // Wire click events
  catList.addEventListener("click", function (e) {
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

  // Sort by created_date DESC, take top 5
  const recent = [...(ideaList || [])]
    .filter((i) => i && i.created_date)
    .sort((a, b) => {
      const aDate = Number(a.created_date) || 0;
      const bDate = Number(b.created_date) || 0;
      return bDate - aDate;
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
        idea.recordLink || RECORD_VIEW_URL + idea.recordID,
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

/* ─────────────────────────────────────────────────────────────
   Modal helpers
───────────────────────────────────────────────────────────── */

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
    if (hidden) main.setAttribute("aria-hidden", "true");
    else main.removeAttribute("aria-hidden");
  }
  const jump = document.getElementById("ipJumpTopBtn");
  if (jump) {
    if (hidden) jump.setAttribute("aria-hidden", "true");
    else jump.removeAttribute("aria-hidden");
  }
}

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

    const activeTab =
      target ||
      tabs.find((tab) => tab.classList.contains("is-active")) ||
      tabs[0];
    if (!activeTab) return;
    activeTab.classList.add("is-active");
    activeTab.setAttribute("aria-selected", "true");
    activeTab.setAttribute("tabindex", "0");

    const panelId = activeTab.dataset.ipTab;
    if (panelId) {
      const panel = document.getElementById(`panel-${panelId}`);
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
      else if (e.key === "ArrowLeft")
        nextIdx = (idx - 1 + tabs.length) % tabs.length;
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

/* ─────────────────────────────────────────────────────────────
   Record modal
───────────────────────────────────────────────────────────── */

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
    // Table row links
    const link = e.target.closest("a.ip-recordLink");
    if (link) {
      e.preventDefault();
      const url = link.getAttribute("href");
      const title = link.getAttribute("data-title") || "Idea Details";
      if (url) openRecordModal(title, url);
      return;
    }

    // Recently-added chips
    const chip = e.target.closest(".ip-recentChip");
    if (chip) {
      const url = chip.getAttribute("data-chip-url");
      const title = chip.getAttribute("data-chip-title") || "Idea Details";
      if (url) openRecordModal(title, url);
      return;
    }
  });

  const closeBtn = document.getElementById("ipRecordModalCloseBtn");
  const openTabBtn = document.getElementById("ipRecordModalOpenTabBtn");
  const modal = document.getElementById("ipRecordModal");

  if (closeBtn) closeBtn.addEventListener("click", closeRecordModal);
  if (openTabBtn) {
    openTabBtn.addEventListener("click", function () {
      const url = openTabBtn.getAttribute("data-url") || "";
      if (url) window.open(url, "_blank", "noopener");
    });
  }

  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target?.getAttribute?.("data-ip-record-close") === "1")
        closeRecordModal();
    });
  }

  document.addEventListener("keydown", function (e) {
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
      const nearBottom = scrollTop + clientHeight >= scrollHeight - 80;
      credit.classList.toggle("is-visible", nearBottom);
    }
  }

  btn.addEventListener("click", function () {
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
  if (status.includes("(") && status.includes(")")) {
    return status.replace("(", "").replace(")", "").trim();
  }
  return status;
}

function buildIdeaViewModel(idea) {
  if (!idea || !idea.recordID) return null;
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
  if (updateMaps) ideasVMById = vmMap;
  return list;
}

/* ─────────────────────────────────────────────────────────────
   Sort
───────────────────────────────────────────────────────────── */

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
  if (!stateObj?.key) return list;
  const direction = stateObj.dir === "desc" ? -1 : 1;
  return [...list.filter((i) => i?.recordID)].sort((a, b) => {
    const aVal = getIdeaSortValue(a, stateObj.key, votes);
    const bVal = getIdeaSortValue(b, stateObj.key, votes);
    if (typeof aVal === "number" && typeof bVal === "number")
      return (aVal - bVal) * direction;
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
    const key = btn?.getAttribute("data-sort");
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

/* ─────────────────────────────────────────────────────────────
   Row builder (template literals)
───────────────────────────────────────────────────────────── */

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

function buildIdeaRow(idea) {
  if (!idea?.recordID) return "";
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
  const voteLabel = isVoted
    ? `You've already voted for ${labelTitle}`
    : `Vote for ${labelTitle}`;
  const votedTip = isVoted
    ? "You've already voted for this idea"
    : "Vote for this idea";

  return `<tr data-record-id="${recordID}">
  <td><a class="ip-recordLink" data-title="${title}" aria-haspopup="dialog" href="${escapeHtml(recordLink)}">${recordID}</a></td>
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
      title="${votedTip}">
      <span class="material-symbols-outlined" aria-hidden="true">thumb_up</span>
    </button>
    <button class="ip-btn ip-btn--ghost ip-share"
      data-record-link="${escapeHtml(recordLink)}"
      aria-label="Copy link for ${labelTitle}"
      title="Copy shareable link">Share</button>
  </td>
</tr>`;
}

/* ─────────────────────────────────────────────────────────────
   Filter
───────────────────────────────────────────────────────────── */

function getIdeaSearchText(idea) {
  if (!idea) return "";
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

  // Category pre-filter
  if (state.categoryFilter && state.categoryFilter !== "all") {
    const cat = state.categoryFilter;
    filtered = filtered.filter((idea) => (idea.category || "").trim() === cat);
  }

  // Text search
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter((idea) => getIdeaSearchText(idea).includes(q));
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

function renderTableMessage(tbody, message, options) {
  if (!tbody) return;
  const retry = options?.retry;
  const buttonHtml = retry
    ? ' <button type="button" class="ip-btn ip-btn--ghost ip-retry">Retry</button>'
    : "";
  tbody.innerHTML = `<tr><td colspan="6">${escapeHtml(message || "")} ${buttonHtml}</td></tr>`;
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

  const emptyMessage = state.search ? "No matching ideas." : "No data found";
  const rowsHtml = pagination.pageItems.map(buildIdeaRow).join("");
  renderRows(ui.results, rowsHtml, emptyMessage);
  PortalDebug.set("tables.results", pagination.pageItems.length);
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

  const myRowsHtml = pagination.pageItems.map(buildIdeaRow).join("");
  renderRows(ui.myResults, myRowsHtml, "No ideas submitted");
  PortalDebug.set("tables.myResults", pagination.pageItems.length);
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
  let sorted = ideas
    .filter((i) => i?.recordID)
    .sort((a, b) => (b.votes || 0) - (a.votes || 0));
  let top10 = sorted.slice(0, 10);
  if (sortState.tblTopIdeas.key)
    top10 = sortIdeasList(top10, voteCounts, sortState.tblTopIdeas);
  applySortClasses("tblTopIdeas");
  const topHtml = top10.map(buildIdeaRow).join("");
  renderRows(ui.topResults, topHtml, "No data found");
  PortalDebug.set("tables.topResults", top10.length);
}

/* ─────────────────────────────────────────────────────────────
   Vote state helpers
───────────────────────────────────────────────────────────── */

function setVoteButtonsDisabled(isDisabled) {
  document.querySelectorAll(".ip-upvote").forEach((button) => {
    if (isDisabled) {
      button.dataset.loadingDisabled = "true";
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
    } else if (button.dataset.loadingDisabled === "true") {
      const voted = button.classList.contains("is-voted");
      button.disabled = voted;
      button.setAttribute("aria-disabled", voted ? "true" : "false");
      delete button.dataset.loadingDisabled;
    }
  });
}

function setVotedState(ideanum, isVoted) {
  const key = String(ideanum);
  document
    .querySelectorAll(`.ip-upvote[data-record-id="${key}"]`)
    .forEach((button) => {
      button.disabled = isVoted;
      button.classList.toggle("is-voted", isVoted);
      button.setAttribute("aria-disabled", isVoted ? "true" : "false");
    });
}

function updateVoteDom(ideanum) {
  const key = String(ideanum);
  const ideaVM = ideasVMById[key];
  if (ideaVM) {
    ideaVM.votes = voteCounts[key] || 0;
    ideaVM.isVoted = true;
  }

  const myIdea = myIdeasCache.find((i) => String(i.recordID) === key);
  if (myIdea) {
    myIdea.votes = voteCounts[key] || 0;
    myIdea.isVoted = true;
  }

  document.querySelectorAll(`tr[data-record-id="${key}"]`).forEach((row) => {
    const voteCell = row.querySelector(".ip-votes");
    if (voteCell) voteCell.textContent = voteCounts[key] || 0;
  });
  setVotedState(key, true);
}

/* ─────────────────────────────────────────────────────────────
   Vote submit
───────────────────────────────────────────────────────────── */

function IdeaVotes(ideanum) {
  const key = String(ideanum);
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
  };
  payload[`numform_${FORM_KEYS.votes}`] = 1;
  payload[VOTE_FIELDS.user] = userID;
  payload[VOTE_FIELDS.idea] = key;

  logDebug("[IdeaVotes] payload", payload);

  apiPostJson("./api/?a=form/new", payload)
    .then(function (response) {
      logDebug("[IdeaVotes] raw response", response);
      const recordID = parseFloat(response);
      if (!isNaN(recordID) && isFinite(recordID) && recordID !== 0) {
        voteCounts[key] = (voteCounts[key] || 0) + 1;
        updateVoteDom(key);
        renderTop10Ideas();
        if (sortState.tblIdeas.key === "votes") renderAllIdeas();
        if (sortState.tblMyIdeas.key === "votes") renderMyIdeas();
        try {
          localStorage.setItem("leafIdeaVotes", JSON.stringify(userVotes));
        } catch (e) {}

        // Update stats strip total votes
        const totalVotes = Object.values(voteCounts).reduce(
          (sum, n) => sum + n,
          0,
        );
        renderStatsStrip(ideas.length, implementedCount, totalVotes);

        showToast("Thanks for voting!");
        // Update my activity
        updateMyActivity(
          myIdeasCache.length,
          Object.values(userVotes).filter(Boolean).length,
        );
      } else {
        console.error("[IdeaVotes] failed response:", response);
        showToast("Error processing vote. See console for details.", true);
        userVotes[key] = false;
        const ideaVM = ideasVMById[key];
        if (ideaVM) ideaVM.isVoted = false;
        const myIdea = myIdeasCache.find((i) => String(i.recordID) === key);
        if (myIdea) myIdea.isVoted = false;
        setVotedState(key, false);
      }
    })
    .catch(function () {
      console.error("[IdeaVotes] request error");
      showToast("Error processing vote. See console for details.", true);
      userVotes[key] = false;
      const ideaVM = ideasVMById[key];
      if (ideaVM) ideaVM.isVoted = false;
      const myIdea = myIdeasCache.find((i) => String(i.recordID) === key);
      if (myIdea) myIdea.isVoted = false;
      setVotedState(key, false);
    })
    .finally(function () {
      votingInProgress = false;
    });
}

/* ─────────────────────────────────────────────────────────────
   Data fetches — LeafFormQuery
───────────────────────────────────────────────────────────── */

async function fetchIdeasData() {
  PortalDebug.set("ideas.status", "loading");
  try {
    const query = new LeafFormQuery();
    query.addTerm("categoryID", "=", FORM_IDS.idea);
    query.addTerm("deleted", "=", 0);
    query.addTerm("stepID", "!=", "notSubmitted");
    query.sort("created_date", "DESC");
    query.getData(IDEA_GETDATA);
    query.setExtraParams("&x-filterData=recordID,title,created_date,userID");
    query.onProgress((count) => {
      setStatus("all", `Loading ideas… (${count} records)`, "loading");
      PortalDebug.set("ideas.count", count);
    });
    const result = Object.values((await query.execute()) || {});
    PortalDebug.set("ideas.count", result.length);
    PortalDebug.set("ideas.status", "success");
    return result;
  } catch (err) {
    PortalDebug.set("ideas.status", "error");
    PortalDebug.set("ideas.error", String(err));
    PortalDebug.error(`Ideas query failed: ${err}`);
    throw err;
  }
}

async function fetchVotesData() {
  PortalDebug.set("votes.status", "loading");
  try {
    const query = new LeafFormQuery();
    query.addTerm("categoryID", "=", FORM_IDS.votes);
    query.addTerm("deleted", "=", 0);
    query.getData(VOTE_GETDATA);
    query.setExtraParams("&x-filterData=recordID,title");
    query.onProgress((count) => {
      setStatus("all", `Loading votes… (${count} records)`, "loading");
      PortalDebug.set("votes.count", count);
    });

    const voteData = (await query.execute()) || {};
    voteCounts = {};
    userVotes = {};

    const votesList = Object.values(voteData);
    votesList.forEach((vote) => {
      const ideanum = vote.s1?.[VOTE_INDICATORS.idea];
      const voter = vote.s1?.[VOTE_INDICATORS.user];
      if (ideanum !== undefined && ideanum !== null && ideanum !== "") {
        const key = String(ideanum);
        voteCounts[key] = (voteCounts[key] || 0) + 1;
        if (voter && voter === userID) userVotes[key] = true;
      }
    });

    // Merge locally-cached votes (optimistic from past sessions)
    try {
      const saved = JSON.parse(localStorage.getItem("leafIdeaVotes") || "{}");
      Object.keys(saved).forEach((k) => {
        if (saved[k]) userVotes[k] = true;
      });
    } catch (e) {}

    PortalDebug.set("votes.count", votesList.length);
    PortalDebug.set("votes.status", "success");
    return votesList.length;
  } catch (err) {
    PortalDebug.set("votes.status", "error");
    PortalDebug.set("votes.error", String(err));
    PortalDebug.error(`Votes query failed: ${err}`);
    throw err;
  }
}

async function fetchUserSubmissions() {
  if (!userID) {
    myIdeasCache = [];
    setStatus("my", "No user ID found", "error");
    renderMyIdeas();
    return;
  }

  setPanelBusy("my", true);
  setStatus("my", "Loading your ideas…", "loading");
  renderTableMessage(ui.myResults, "Loading…");

  try {
    const query = new LeafFormQuery();
    query.addTerm("userID", "=", userID);
    query.addTerm("deleted", "=", 0);
    query.getData(IDEA_GETDATA);
    query.setExtraParams("&x-filterData=recordID,title,created_date,userID");
    query.onProgress((count) =>
      setStatus("my", `Loading… (${count} records)`, "loading"),
    );

    const data = (await query.execute()) || {};
    const userIdeas = Object.values(data)
      .filter((idea) => {
        if (!idea?.recordID) return false;
        // Filter out vote records (title starts with "Idea #")
        if ((idea.title || "").startsWith("Idea #")) return false;
        return true;
      })
      .map((idea) => {
        // Enrich with full data from ideasById if available
        const key = String(idea.recordID);
        return ideasById && ideasById[key] ? ideasById[key] : idea;
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
    renderTableMessage(ui.myResults, "Error loading user ideas.", {
      retry: true,
    });
    setStatus("my", "Error loading user ideas.", "error");
  } finally {
    setPanelBusy("my", false);
  }
}

/* ─────────────────────────────────────────────────────────────
   Main load
───────────────────────────────────────────────────────────── */

function loadIdeasAndVotes() {
  setPanelBusy("all", true);
  setStatus("all", "Loading ideas…", "loading");
  renderTableMessage(ui.results, "Loading…");
  renderTableMessage(ui.topResults, "Loading…");
  setVoteButtonsDisabled(true);

  const fetchStart = performance.now();

  return Promise.all([fetchIdeasData(), fetchVotesData()])
    .then(async ([ideasData, voteCount]) => {
      const fetchEnd = performance.now();
      ideasRaw = ideasData;
      ideas = buildIdeasViewModelList(ideasRaw, true);

      // Compute implemented count (ideas with "Completed" status)
      implementedCount = ideas.filter((i) => i.status === "Completed").length;

      const totalVotes = Object.values(voteCounts).reduce(
        (sum, n) => sum + n,
        0,
      );
      renderStatsStrip(ideas.length, implementedCount, totalVotes);
      buildCategorySidebar(ideas);
      renderRecentChips(ideas);

      const renderStart = performance.now();
      renderAllIdeas();
      renderTop10Ideas();
      setStatus("all", "", "");
      const renderEnd = performance.now();

      logDebug("Fetch duration (ms)", Math.round(fetchEnd - fetchStart));
      logDebug("Render duration (ms)", Math.round(renderEnd - renderStart));
      logDebug("Counts", { ideas: ideas.length, votes: voteCount });

      await fetchUserSubmissions();
    })
    .catch(function (error) {
      console.error("IdeaPortal load error", error);
      renderTableMessage(ui.results, "Error loading ideas.", { retry: true });
      renderTableMessage(ui.topResults, "Error loading ideas.", {
        retry: true,
      });
      setStatus("all", "Error loading data.", "error");
    })
    .finally(function () {
      setPanelBusy("all", false);
      setVoteButtonsDisabled(false);
    });
}

function updateTable() {
  return loadIdeasAndVotes();
}

/* ─────────────────────────────────────────────────────────────
   Idea form helpers
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
    logDebug("[Workflow] current step:", stepData);

    const firstStep = Array.isArray(stepData) ? stepData[0] : stepData;
    const depID = firstStep?.dependencyID;
    const actions = firstStep?.dependencyActions;
    const actionType =
      (Array.isArray(actions) && actions[0]?.actionType) || "submit";

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
    const applyData = await applyRes.text();
    logDebug("[Workflow] advance response:", applyData);
    return applyData;
  } catch (err) {
    console.warn("[Workflow] advance failed:", err);
  }
}

async function NewIdea(advanceOnSuccess) {
  const form = document.getElementById("ideaForm");
  const submitButton = document.getElementById("submitButton");
  const saveButton = document.getElementById("saveDraftButton");

  const titleValue = document.getElementById("inpTitle")?.value.trim() || "";
  const descriptionValue =
    document.getElementById("inpDescription")?.value.trim() || "";
  const benefitValue =
    document.getElementById("inpBenefit")?.value.trim() || "";
  const categoryValue =
    document.getElementById("inpCategory")?.value.trim() || "";
  const impactValue = document.getElementById("inpImpact")?.value.trim() || "";
  const otherCategoryInput = document.getElementById("inpOtherCategory");
  const otherCategoryValue = otherCategoryInput
    ? otherCategoryInput.value.trim()
    : "";

  if (submitButton) submitButton.disabled = true;
  if (saveButton) saveButton.disabled = true;
  ideaSubmitInProgress = true;

  try {
    const payload = {
      service: "",
      title: titleValue || "Idea Submission",
      priority: 0,
      CSRFToken: csrfToken,
    };
    payload[`numform_${FORM_KEYS.idea}`] = 1;
    payload[IDEA_FIELDS.title] = titleValue;
    payload[IDEA_FIELDS.summary] = descriptionValue;
    payload[IDEA_FIELDS.benefit] = benefitValue;
    payload[IDEA_FIELDS.category] = categoryValue;
    payload[IDEA_FIELDS.impact] = impactValue;
    if (categoryValue === "Other" && otherCategoryValue) {
      payload[IDEA_FIELDS.other_category] = otherCategoryValue;
    }

    const response = await apiPostJson("./api/?a=form/new", payload);
    const recordID = parseFloat(response);

    if (!isNaN(recordID) && isFinite(recordID) && recordID !== 0) {
      // File upload — fire and forget
      const fileInputEl = document.getElementById("fileInput");
      const filesToUpload = fileInputEl?.files
        ? Array.from(fileInputEl.files)
        : [];
      if (filesToUpload.length > 0) {
        const formData = new FormData();
        formData.append("CSRFToken", csrfToken);
        filesToUpload.forEach((file) => formData.append("10", file));
        fetch(`./api/?a=form/${recordID}`, {
          method: "POST",
          credentials: "same-origin",
          body: formData,
        }).catch((err) => console.warn("[IdeaUpload] file upload failed", err));
      }

      if (form) {
        form.reset();
        form.classList.remove("was-validated");
      }
      if (fileInputEl) fileInputEl.value = "";
      const fileList = document.getElementById("fileList");
      if (fileList) fileList.innerHTML = "";
      closeModal("addIdeaModal");

      if (advanceOnSuccess) {
        await advanceWorkflow(recordID);
        showToast("Your idea has been submitted successfully.");
        updateTable();
      } else {
        showToast("Idea saved. You can find it in My Ideas.");
      }
      fetchUserSubmissions();
    } else {
      showToast("Error submitting idea. Please try again.", true);
    }
  } catch (err) {
    console.warn("[NewIdea] error:", err);
    showToast("Error submitting idea. Please try again.", true);
  } finally {
    ideaSubmitInProgress = false;
    if (submitButton) submitButton.disabled = false;
    if (saveButton) saveButton.disabled = false;
  }
}

/* ─────────────────────────────────────────────────────────────
   Form selects + validation
───────────────────────────────────────────────────────────── */

function populateSelect(select, options, appendOther) {
  if (!select) return;
  const placeholder = select.options[0];
  select.innerHTML = "";
  if (placeholder) select.appendChild(placeholder);
  options.forEach((opt) => {
    const el = document.createElement("option");
    const label = typeof opt === "string" ? opt : opt.label || opt.name || opt;
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

function loadCategoryOptions() {
  fetch(
    "/platform/ideas/ajaxIndex.php?a=getindicator&indicatorID=8&series=1&recordID=0",
    {
      credentials: "same-origin",
    },
  )
    .then((r) => r.text())
    .then((html) => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const select = doc.querySelector("select#8");
      if (!select || !select.options.length)
        throw new Error("no options found");
      populateSelect(
        document.getElementById("inpCategory"),
        Array.from(select.options)
          .map((o) => o.value)
          .filter(Boolean),
        false,
      );
    })
    .catch(() => {
      populateSelect(
        document.getElementById("inpCategory"),
        CATEGORY_FALLBACK,
        true,
      );
    });
}

function loadImpactOptions() {
  fetch(
    "/platform/ideas/ajaxIndex.php?a=getindicator&indicatorID=9&series=1&recordID=0",
    {
      credentials: "same-origin",
    },
  )
    .then((r) => r.text())
    .then((html) => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const select = doc.querySelector("select#9");
      if (!select || !select.options.length)
        throw new Error("no options found");
      populateSelect(
        document.getElementById("inpImpact"),
        Array.from(select.options)
          .map((o) => o.value)
          .filter(Boolean),
        false,
      );
    })
    .catch(() => {
      populateSelect(
        document.getElementById("inpImpact"),
        IMPACT_FALLBACK,
        false,
      );
    });
}

function bindCategoryChange() {
  const categorySelect = document.getElementById("inpCategory");
  const otherWrapper = document.getElementById("otherCategoryWrapper");
  const otherInput = document.getElementById("inpOtherCategory");
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
  document.querySelectorAll(".needs-validation").forEach((form) => {
    form.addEventListener("input", function (event) {
      const target = event.target;
      if (target?.classList.contains("ip-input")) {
        if (target.checkValidity()) target.removeAttribute("aria-invalid");
      }
      if (target?.id === "inpOtherCategory" && target.value.trim()) {
        target.removeAttribute("aria-invalid");
      }
    });
  });
}

/* ─────────────────────────────────────────────────────────────
   Event delegation
───────────────────────────────────────────────────────────── */

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
      IdeaVotes(upvoteBtn.getAttribute("data-record-id"));
      return;
    }

    const shareBtn = e.target.closest(".ip-share");
    if (shareBtn) {
      const recordLink = shareBtn.getAttribute("data-record-link");
      if (!recordLink) return;
      navigator.clipboard.writeText(recordLink).then(
        () => showToast("Idea link copied to clipboard."),
        (err) => {
          console.error("Could not copy link:", err);
        },
      );
      return;
    }

    const pageBtn = e.target.closest(".ip-pageBtn, .ip-pageToggle");
    if (pageBtn) {
      const scope = pageBtn.getAttribute("data-page-scope");
      const action = pageBtn.getAttribute("data-page-action");
      if (scope && action) handlePaginationAction(scope, action);
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
    (event) => applySearch(event.target.value),
    SEARCH_DEBOUNCE_MS,
  );
  ui.searchInput.addEventListener("input", handler);
  ui.searchInput.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applySearch(ui.searchInput.value);
  });
  if (ui.searchBtn) {
    ui.searchBtn.addEventListener("click", () =>
      applySearch(ui.searchInput.value),
    );
  }
}

function bindFileInput() {
  const fileInput = document.getElementById("fileInput");
  const fileList = document.getElementById("fileList");
  if (!fileInput || !fileList) return;

  fileInput.addEventListener("change", function () {
    fileList.innerHTML = "";
    Array.from(fileInput.files || []).forEach((file) => {
      const li = document.createElement("li");
      li.textContent = file.name;
      fileList.appendChild(li);
    });
  });
}

/* ─────────────────────────────────────────────────────────────
   My Ideas search (panel-local)
───────────────────────────────────────────────────────────── */

function bindMySearch() {
  const input = document.getElementById("mySearchInput");
  const btn = document.getElementById("mySearchBtn");
  if (!input) return;

  const handler = debounce(function () {
    const q = input.value.toLowerCase();
    document.querySelectorAll("#myResults tr").forEach((row) => {
      row.style.display = row.textContent.toLowerCase().includes(q)
        ? ""
        : "none";
    });
  }, SEARCH_DEBOUNCE_MS);

  input.addEventListener("input", handler);
  if (btn) btn.addEventListener("click", handler);
}

/* ─────────────────────────────────────────────────────────────
   Init
───────────────────────────────────────────────────────────── */

function initPortal() {
  if (window.$ || window.jQuery) {
    console.warn("IdeaPortal: jQuery is loaded but no longer required.");
  }

  PortalDebug.set("initFired", true);
  PortalDebug.set("dom", document.readyState);

  cacheElements();
  bindModalEvents();
  bindTabs();
  bindRecordModal();
  bindDelegatedEvents();
  bindSearch();
  bindMySearch();
  bindFileInput();
  bindCategoryChange();
  loadCategoryOptions();
  loadImpactOptions();

  document
    .getElementById("saveDraftButton")
    ?.addEventListener("click", async function () {
      const form = document.getElementById("ideaForm");
      if (!form) return;
      const titleVal = document.getElementById("inpTitle")?.value.trim();
      if (!titleVal) {
        document.getElementById("inpTitle")?.focus();
        form.classList.add("was-validated");
        return;
      }
      await NewIdea(false);
    });

  document
    .getElementById("submitButton")
    ?.addEventListener("click", async function () {
      const form = document.getElementById("ideaForm");
      if (!form) return;
      form.classList.add("was-validated");
      if (!form.checkValidity()) return;
      await NewIdea(true);
    });

  wireJumpToTop();
  initValidation();

  try {
    updateTable();
  } catch (err) {
    console.error("updateTable failed", err);
    PortalDebug.error(`updateTable threw: ${err}`);
  }
}

// Wire debug panel immediately (doesn't need DOM fully loaded)
PortalDebug.init();

/// Robust init: fire immediately if DOM is already ready (CMS fragment case),
// otherwise wait for DOMContentLoaded.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPortal);
} else {
  // DOMContentLoaded already fired — call directly
  initPortal();
}
