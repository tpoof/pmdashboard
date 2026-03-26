/**
 * LEAF Design System — app.js
 * Handles: top-nav routing, sidebar switching, page rendering,
 *          search overlay, and LEAF API integration hooks.
 */

/* ─── NAV STATE ─── */
const NAV_MAP = {
  home: { sidebar: "sidebarHome", defaultPage: "overview" },
  foundations: { sidebar: "sidebarFoundations", defaultPage: "color" },
  components: { sidebar: "sidebarComponents", defaultPage: "button" },
  patterns: { sidebar: "sidebarPatterns", defaultPage: "dashboard" },
  data: { sidebar: "sidebarData", defaultPage: "query-builder" },
};

let currentSection = "home";
let currentPage = "overview";

/* ─── ELEMENTS ─── */
const topNavLinks = document.querySelectorAll(".top-bar__nav-link");
const sidebarLinks = document.querySelectorAll(".sidebar__link");
const sidebarSects = document.querySelectorAll(".sidebar__section");
const pages = document.querySelectorAll(".page");
const searchToggle = document.getElementById("searchToggle");
const searchOverlay = document.getElementById("searchOverlay");
const searchClose = document.getElementById("searchClose");
const searchInput = document.getElementById("searchInput");

/* ─── TOP NAV ─── */
topNavLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const section = link.dataset.section;
    navigateTo(section, NAV_MAP[section]?.defaultPage);
  });
});

/* ─── SIDEBAR LINKS ─── */
sidebarLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    showPage(link.dataset.page);
    setActiveSidebarLink(link);
  });
});

/* ─── HERO / CARD DATA-NAV LINKS ─── */
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-nav]");
  if (!el) return;
  e.preventDefault();
  const target = el.dataset.nav;

  // Is it a top-level section?
  if (NAV_MAP[target]) {
    navigateTo(target, NAV_MAP[target].defaultPage);
    return;
  }
  // Otherwise treat as a page within the current section
  const link = document.querySelector(`.sidebar__link[data-page="${target}"]`);
  if (link) {
    showPage(target);
    setActiveSidebarLink(link);
  }
});

/* ─── CORE NAVIGATION ─── */
function navigateTo(section, page) {
  if (!NAV_MAP[section]) return;
  currentSection = section;

  // Update top nav active state
  topNavLinks.forEach((l) =>
    l.classList.toggle(
      "top-bar__nav-link--active",
      l.dataset.section === section,
    ),
  );

  // Show the correct sidebar panel
  sidebarSects.forEach((s) => {
    s.classList.toggle(
      "sidebar__section--hidden",
      s.id !== NAV_MAP[section].sidebar,
    );
  });

  // Show the requested page
  showPage(page || NAV_MAP[section].defaultPage);

  // Activate the correct sidebar link
  const targetLink = document.querySelector(
    `.sidebar__link[data-page="${page || NAV_MAP[section].defaultPage}"]`,
  );
  if (targetLink) setActiveSidebarLink(targetLink);
}

function showPage(pageKey) {
  currentPage = pageKey;
  pages.forEach((p) => {
    p.classList.toggle("page--active", p.id === "page" + capitalize(pageKey));
  });
  // Scroll top of content area
  document
    .getElementById("mainContent")
    ?.scrollTo({ top: 0, behavior: "smooth" });
}

function setActiveSidebarLink(activeLink) {
  sidebarLinks.forEach((l) => l.classList.remove("sidebar__link--active"));
  activeLink?.classList.add("sidebar__link--active");
}

function capitalize(str) {
  // Matches the ID convention: pageOverview, pageWhats-new, etc.
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ─── SEARCH OVERLAY ─── */
searchToggle?.addEventListener("click", () => {
  searchOverlay.classList.add("is-open");
  searchOverlay.setAttribute("aria-hidden", "false");
  setTimeout(() => searchInput?.focus(), 80);
});

searchClose?.addEventListener("click", closeSearch);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSearch();
  // Cmd/Ctrl+K shortcut
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    searchOverlay.classList.toggle("is-open");
    if (searchOverlay.classList.contains("is-open")) {
      searchOverlay.setAttribute("aria-hidden", "false");
      setTimeout(() => searchInput?.focus(), 80);
    } else {
      searchOverlay.setAttribute("aria-hidden", "true");
    }
  }
});

function closeSearch() {
  searchOverlay.classList.remove("is-open");
  searchOverlay.setAttribute("aria-hidden", "true");
  searchToggle?.focus();
}

/* ─── LEAF API INTEGRATION STUB ─────────────────────────────────────────────
 *
 * Replace the BASE_URL with your portal's URL when wiring real data.
 *
 * Usage:
 *   LeafDS.api.query({ ... }).then(data => renderComponent(data));
 *
 * ─────────────────────────────────────────────────────────────────────────── */
const LeafDS = {
  config: {
    baseURL: "api/?a=", // ← update to your LEAF portal path
    csrfToken: "", // ← populated at runtime from meta tag / template var
  },

  api: {
    /**
     * Perform a LEAF form query.
     * @param {Object} query  – LeafFormQuery-compatible query object
     * @returns {Promise}
     */
    query(query) {
      const url =
        LeafDS.config.baseURL +
        "form/query/?q=" +
        encodeURIComponent(JSON.stringify(query));
      return fetch(url, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
      }).then((r) => {
        if (!r.ok) throw new Error(`LEAF API error: ${r.status}`);
        return r.json();
      });
    },

    /**
     * Fetch a single record.
     * @param {number|string} recordID
     */
    getRecord(recordID) {
      return fetch(`${LeafDS.config.baseURL}form/${recordID}`, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
      }).then((r) => r.json());
    },

    /**
     * POST data to LEAF.
     * @param {string} endpoint  – e.g. 'form/new'
     * @param {Object} payload
     */
    post(endpoint, payload) {
      const formData = new FormData();
      formData.append("CSRFToken", LeafDS.config.csrfToken);
      Object.entries(payload).forEach(([k, v]) => formData.append(k, v));

      return fetch(LeafDS.config.baseURL + endpoint, {
        method: "POST",
        body: formData,
      }).then((r) => r.json());
    },
  },
};

/* Expose globally so inline scripts or future modules can reach it */
window.LeafDS = LeafDS;

/* ─── INIT ─── */
(function init() {
  // Check URL hash for deep linking (e.g. #components/button)
  const hash = window.location.hash.replace("#", "");
  if (hash) {
    const [section, page] = hash.split("/");
    if (NAV_MAP[section]) {
      navigateTo(section, page);
      return;
    }
  }
  // Default: show home / overview
  navigateTo("home", "overview");
})();

/* ─── UPDATE HASH ON NAVIGATION ─── */
const _origNavigateTo = navigateTo;
function navigateWithHash(section, page) {
  _origNavigateTo(section, page);
  history.replaceState(
    null,
    "",
    `#${section}/${page || NAV_MAP[section]?.defaultPage}`,
  );
}
// Override global reference
// (wrapped after the fact to avoid circular ref at parse time)
sidebarLinks.forEach((link) => {
  link.addEventListener("click", () => {
    const page = link.dataset.page;
    history.replaceState(null, "", `#${currentSection}/${page}`);
  });
});
