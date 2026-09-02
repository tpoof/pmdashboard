/**
 * LEAF Design System — design-system.js
 * Flat left-nav router. No top bar, no section switching.
 */

/* ─── ELEMENTS ─── */
const sidebarLinks = document.querySelectorAll(".sidebar__link");
const pages = document.querySelectorAll(".page");
const searchInput = document.getElementById("sidebarSearch");
const brandLink = document.querySelector(".sidebar__brand");

/* ─── SIDEBAR NAV ─── */
sidebarLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    navigateTo(link.dataset.page);
  });
});

/* ─── BRAND CLICK → OVERVIEW ─── */
brandLink?.addEventListener("click", (e) => {
  e.preventDefault();
  navigateTo("overview");
});

/* ─── HERO / CARD data-page LINKS ─── */
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-page]");
  if (
    !el ||
    el.classList.contains("sidebar__link") ||
    el.classList.contains("sidebar__brand")
  )
    return;
  e.preventDefault();
  navigateTo(el.dataset.page);
});

/* ─── CORE NAVIGATION ─── */
function navigateTo(pageKey) {
  if (!pageKey) return;

  // Show/hide pages
  pages.forEach((p) => {
    p.classList.toggle("page--active", p.id === "page" + cap(pageKey));
  });

  // Active sidebar link
  sidebarLinks.forEach((l) => {
    l.classList.toggle("sidebar__link--active", l.dataset.page === pageKey);
  });

  // Scroll content to top
  document
    .getElementById("mainContent")
    ?.scrollTo({ top: 0, behavior: "smooth" });

  // Update URL hash for deep linking
  history.replaceState(null, "", "#" + pageKey);
}

function cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ─── SIDEBAR SEARCH ─── */
searchInput?.addEventListener("input", () => {
  const q = searchInput.value.trim().toLowerCase();
  sidebarLinks.forEach((link) => {
    const text = link.textContent.toLowerCase();
    link.classList.toggle(
      "sidebar__link--hidden",
      q !== "" && !text.includes(q),
    );
  });
  // Show/hide headings if all children hidden
  document.querySelectorAll(".sidebar__heading").forEach((heading) => {
    const list = heading.nextElementSibling;
    if (!list) return;
    const anyVisible = [...list.querySelectorAll(".sidebar__link")].some(
      (l) => !l.classList.contains("sidebar__link--hidden"),
    );
    heading.style.display = q !== "" && !anyVisible ? "none" : "";
  });
});

/* ─── KEYBOARD: ESC clears search ─── */
searchInput?.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    searchInput.value = "";
    searchInput.dispatchEvent(new Event("input"));
    searchInput.blur();
  }
});

/* ─── LEAF API STUB ──────────────────────────────────────────────────────────
 *
 * Set baseURL and csrfToken when wiring real data.
 * Usage: LeafDS.api.query({ terms: [...], joins: ['data'] }).then(render)
 *
 * ─────────────────────────────────────────────────────────────────────────── */
const LeafDS = {
  config: {
    baseURL: "api/?a=",
    csrfToken: "",
  },
  api: {
    query(query) {
      const url =
        LeafDS.config.baseURL +
        "form/query/?q=" +
        encodeURIComponent(JSON.stringify(query));
      return fetch(url, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
      }).then((r) => {
        if (!r.ok) throw new Error("LEAF API " + r.status);
        return r.json();
      });
    },
    getRecord(recordID) {
      return fetch(LeafDS.config.baseURL + "form/" + recordID, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
      }).then((r) => r.json());
    },
    post(endpoint, payload) {
      const fd = new FormData();
      fd.append("CSRFToken", LeafDS.config.csrfToken);
      Object.entries(payload).forEach(([k, v]) => fd.append(k, v));
      return fetch(LeafDS.config.baseURL + endpoint, {
        method: "POST",
        body: fd,
      }).then((r) => r.json());
    },
  },
};

window.LeafDS = LeafDS;

/* ─── INIT ─── */
(function init() {
  const hash = window.location.hash.replace("#", "");
  navigateTo(hash || "overview");
})();
