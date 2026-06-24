/* ============================================================
   LEAF Universal Nav  |  leaf_nav.js
   ─────────────────────────────────────────────────────────────
   Lives at /platform/designs/files/leaf_nav.js — every page
   should point here directly so there's exactly one copy to
   edit.

   Self-mounting: this script auto-injects its own stylesheet
   and, if the host page doesn't already have one, creates the
   <div id="lp-nav-host"> for itself. That means a brand-new
   page only needs ONE line added to it, right before </head>
   or </body>:

       <script src="/platform/designs/files/leaf_nav.js"></script>

   Existing pages that already link leaf_nav.css and/or include
   a #lp-nav-host placeholder keep working exactly as before —
   this script detects what's already on the page and won't
   duplicate it.

   Nav content lives in one place (NAV_SECTIONS below) and is
   used to build both the desktop dropdowns and the mobile
   accordion, so links only ever need to be edited once.
   ============================================================ */

(function () {
  "use strict";

  /* ── Nav content (single source of truth for desktop + mobile) ── */
  var NAV_SECTIONS = [
    {
      label: "What is LEAF?",
      items: [
        {
          icon: "bar_chart",
          title: "Our Impact",
          desc: "See how LEAF has transformed VA workflows across the country",
          href: "#", // placeholder — intentional, page not live yet
        },
        {
          icon: "route",
          title: "Roadmap",
          desc: "Upcoming features and platform improvements",
          href: "#", // placeholder — intentional, page not live yet
        },
      ],
    },
    {
      label: "Solutions",
      items: [
        {
          icon: "library_books",
          title: "Use Cases",
          desc: "Browse real-life VA workflows built with LEAF",
          href: "#",
        },
        {
          icon: "description",
          title: "Form Library",
          desc: "Ready-to-use templates for common VA processes",
          href: "#",
        },
        {
          icon: "cable",
          title: "Integrations",
          desc: "Connect LEAF with other VA systems and tools",
          href: "#",
        },
      ],
    },
    {
      label: "Resources",
      items: [
        {
          icon: "location_on",
          title: "Find your local LEAF site",
          desc: "Search for LEAF at your VA facility",
          href: "report.php?a=Find_my_site",
        },
        { divider: true },
        {
          icon: "menu_book",
          title: "Help library",
          desc: "Guides, tutorials, and documentation",
          href: "/platform/help_library/",
          external: true,
        },
        {
          icon: "group",
          title: "Community of practice",
          desc: "Connect with LEAF users across VA",
          href: "/platform/CoP/",
          external: true,
        },
        {
          icon: "lightbulb",
          title: "Suggest an idea",
          desc: "Share feature requests with the LEAF team",
          href: "?go=idea",
          external: true,
        },
      ],
    },
  ];

  /* ── Markup builders (shared by desktop dropdowns + mobile accordion) ── */
  function linkHTML(item) {
    if (item.divider) return '<hr class="dd-divider" aria-hidden="true">';
    var target = item.external
      ? ' target="_blank" rel="noopener noreferrer"'
      : "";
    return `
      <li>
        <a class="dd-link" href="${item.href}"${target}>
          <span class="dd-link-ico">
            <span class="material-symbols-outlined" aria-hidden="true">${item.icon}</span>
          </span>
          <span class="dd-link-text">
            <strong>${item.title}</strong>
            <span>${item.desc}</span>
          </span>
        </a>
      </li>`;
  }

  function desktopSectionHTML(section, i) {
    return `
      <li class="dd-item" id="dd-item-${i}">
        <button class="dd-trigger" aria-expanded="false" aria-haspopup="true" aria-controls="dd-${i}">
          ${section.label} <span class="dd-chevron" aria-hidden="true">⌄</span>
        </button>
        <div class="dd-panel" id="dd-${i}" hidden>
          <ul class="dd-list">
            ${section.items.map(linkHTML).join("")}
          </ul>
        </div>
      </li>`;
  }

  function mobileSectionHTML(section, i) {
    return `
      <li class="acc-item" id="acc-item-${i}">
        <button class="acc-trigger" aria-expanded="false" aria-controls="acc-${i}">
          ${section.label} <span class="dd-chevron" aria-hidden="true">⌄</span>
        </button>
        <div class="acc-panel" id="acc-${i}" hidden>
          <ul class="dd-list">
            ${section.items.map(linkHTML).join("")}
          </ul>
        </div>
      </li>`;
  }

  function buildNavHTML() {
    var desktopItems = NAV_SECTIONS.map(desktopSectionHTML).join("");
    var mobileItems = NAV_SECTIONS.map(mobileSectionHTML).join("");
    return `
<nav class="lp-nav" id="lpNav" aria-label="Launchpad navigation">
  <div class="lp-nav-in">
    <ul class="lp-nav-links" role="list">
      ${desktopItems}
    </ul>

    <button class="lp-nav-toggle" id="lpNavToggle" type="button" aria-expanded="false" aria-controls="lpMobilePanel" aria-label="Menu">
      <span class="lp-nav-toggle-icon" aria-hidden="true"><span></span><span></span><span></span></span>
    </button>

    <div class="lp-mobile-panel" id="lpMobilePanel" hidden>
      <ul class="lp-accordion" role="list">
        ${mobileItems}
      </ul>
    </div>
  </div>
</nav>`;
  }

  /* ── Self-mount: stylesheet ──
     If the page already links leaf_nav.css (or leaf-nav.css)
     directly, leave it alone. Otherwise, derive the CSS path
     from this <script>'s own src and inject a <link> for it. */
  function ensureStylesheet() {
    if (
      document.querySelector(
        'link[href*="leaf_nav.css"], link[href*="leaf-nav.css"]',
      )
    ) {
      return;
    }
    var thisScript =
      document.currentScript ||
      (function () {
        var scripts = document.getElementsByTagName("script");
        return scripts[scripts.length - 1];
      })();
    var src = thisScript && thisScript.getAttribute("src");
    if (!src) return;
    var cssHref = src.replace(/leaf[_-]nav\.js(\?.*)?$/i, function (match) {
      return match.replace(/\.js/i, ".css");
    });
    if (cssHref === src) return; // src didn't match the expected pattern
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssHref;
    document.head.appendChild(link);
  }
  ensureStylesheet();

  /* ── Self-mount: host element ──
     Use the existing #lp-nav-host if the page already has one;
     otherwise create one at the very top of <body>. */
  function ensureHost() {
    var host = document.getElementById("lp-nav-host");
    if (host) return host;
    host = document.createElement("div");
    host.id = "lp-nav-host";
    document.body.insertBefore(host, document.body.firstChild);
    return host;
  }

  /* ── Inject nav into placeholder ── */
  function inject() {
    var host = ensureHost();
    host.outerHTML = buildNavHTML();
    wire();
  }

  /* ── Wire interactions ── */
  function wire() {
    var nav = document.getElementById("lpNav");
    var navToggle = document.getElementById("lpNavToggle");
    var mobilePanel = document.getElementById("lpMobilePanel");
    var lastFocusedTrigger = null;

    /* Scroll shadow */
    if (nav) {
      var onScroll = function () {
        nav.classList.toggle(
          "scrolled",
          (window.pageYOffset || document.documentElement.scrollTop) > 4,
        );
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }

    /* ── Desktop dropdowns ── */
    function closeAllDropdowns(except) {
      document.querySelectorAll(".dd-item.open").forEach(function (item) {
        if (item === except) return;
        item.classList.remove("open");
        var btn = item.querySelector(".dd-trigger");
        var panel = item.querySelector(".dd-panel");
        if (btn) btn.setAttribute("aria-expanded", "false");
        if (panel) panel.setAttribute("hidden", "");
      });
    }

    document.querySelectorAll(".dd-trigger").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.closest(".dd-item");
        var panel = document.getElementById(btn.getAttribute("aria-controls"));
        var isOpen = item.classList.contains("open");
        closeAllDropdowns(null);
        if (!isOpen) {
          item.classList.add("open");
          btn.setAttribute("aria-expanded", "true");
          if (panel) panel.removeAttribute("hidden");
          lastFocusedTrigger = btn;
        }
      });
    });

    /* ── Mobile accordion (each section toggles independently) ── */
    function closeAllAccordions() {
      document.querySelectorAll(".acc-item.open").forEach(function (item) {
        item.classList.remove("open");
        var btn = item.querySelector(".acc-trigger");
        var panel = item.querySelector(".acc-panel");
        if (btn) btn.setAttribute("aria-expanded", "false");
        if (panel) panel.setAttribute("hidden", "");
      });
    }

    document.querySelectorAll(".acc-trigger").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.closest(".acc-item");
        var panel = document.getElementById(btn.getAttribute("aria-controls"));
        var isOpen = item.classList.contains("open");
        if (isOpen) {
          item.classList.remove("open");
          btn.setAttribute("aria-expanded", "false");
          if (panel) panel.setAttribute("hidden", "");
        } else {
          item.classList.add("open");
          btn.setAttribute("aria-expanded", "true");
          if (panel) panel.removeAttribute("hidden");
        }
      });
    });

    /* ── Mobile menu open/close ── */
    function openMobileMenu() {
      if (!navToggle || !mobilePanel) return;
      navToggle.classList.add("open");
      navToggle.setAttribute("aria-expanded", "true");
      mobilePanel.removeAttribute("hidden");
      document.body.style.overflow = "hidden";
    }
    function closeMobileMenu(returnFocus) {
      if (!navToggle || !mobilePanel) return;
      navToggle.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
      mobilePanel.setAttribute("hidden", "");
      document.body.style.overflow = "";
      closeAllAccordions();
      if (returnFocus) navToggle.focus();
    }
    if (navToggle) {
      navToggle.addEventListener("click", function () {
        if (navToggle.classList.contains("open")) {
          closeMobileMenu(false);
        } else {
          closeAllDropdowns(null);
          openMobileMenu();
        }
      });
    }

    /* Close the mobile menu after a link inside it is followed */
    if (mobilePanel) {
      mobilePanel.addEventListener("click", function (e) {
        if (e.target.closest("a")) closeMobileMenu(false);
      });
    }

    /* Auto-close the mobile menu if the viewport grows past the breakpoint */
    window.addEventListener("resize", function () {
      if (
        window.innerWidth > 640 &&
        navToggle &&
        navToggle.classList.contains("open")
      ) {
        closeMobileMenu(false);
      }
    });

    /* Close on outside click */
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".dd-item")) closeAllDropdowns(null);
      if (
        navToggle &&
        navToggle.classList.contains("open") &&
        !e.target.closest(".lp-mobile-panel") &&
        !e.target.closest(".lp-nav-toggle")
      ) {
        closeMobileMenu(false);
      }
    });

    /* Close on Escape, returning focus to whatever trigger was open */
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      closeAllDropdowns(null);
      if (lastFocusedTrigger) {
        lastFocusedTrigger.focus();
        lastFocusedTrigger = null;
      }
      if (navToggle && navToggle.classList.contains("open")) {
        closeMobileMenu(true);
      }
    });
  }

  /* ── Run on DOM ready ── */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
