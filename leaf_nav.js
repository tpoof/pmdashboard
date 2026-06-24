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

   ── Accessibility (WCAG 2.1 AA / Section 508) ───────────────
   • Skip navigation link auto-injected at top of <body>
     (targets #main-content; auto-added to first <main> if absent)
   • Disclosure navigation pattern — aria-expanded only, no
     aria-haspopup, so there's no role mismatch with the panel
   • External links announce "(opens in new tab)" to screen readers
   • Mobile toggle aria-label toggles "Open menu" / "Close menu"
   • Mobile panel traps focus while open; Escape returns focus
   • window.LEAF_NAV_CURRENT = "Section Label" marks active
     section with aria-current="true" for screen readers
   • prefers-reduced-motion: all animations suppressed in CSS
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
          href: "https://leaf.va.gov/platform/help_library/report.php?a=stephanie_test1",
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
          href: "/platform/ideas/",
          external: true,
        },
      ],
    },
  ];

  /* ── Markup builders (shared by desktop dropdowns + mobile accordion) ── */
  function linkHTML(item) {
    if (item.divider) return '<hr class="dd-divider" aria-hidden="true">';
    /* All nav links open in-panel on left-click (intercepted below).
       Ctrl/Cmd/middle-click still opens a real new tab naturally via the href.
       No target="_blank" needed — it would conflict with the intercept. */
    return `
      <li>
        <a class="dd-link" href="${item.href}">
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
    /* Disclosure navigation pattern: aria-expanded only, no aria-haspopup.
       This avoids a role mismatch (haspopup implies role="menu" which the
       panel doesn't have). Tab key navigates into the open panel naturally. */
    var isCurrent =
      window.LEAF_NAV_CURRENT &&
      window.LEAF_NAV_CURRENT.trim().toLowerCase() ===
        section.label.trim().toLowerCase();
    var currentAttr = isCurrent ? ' aria-current="true"' : "";
    return `
      <li class="dd-item" id="dd-item-${i}">
        <button class="dd-trigger" aria-expanded="false" aria-controls="dd-${i}"${currentAttr}>
          ${section.label} <span class="dd-chevron" aria-hidden="true"><span class="material-symbols-outlined">arrow_drop_down</span></span>
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
          ${section.label} <span class="dd-chevron" aria-hidden="true"><span class="material-symbols-outlined">arrow_drop_down</span></span>
        </button>
        <div class="acc-panel" id="acc-${i}" hidden>
          <ul class="dd-list">
            ${section.items.map(linkHTML).join("")}
          </ul>
        </div>
      </li>`;
  }

  /* ── Panel HTML (self-injected alongside the nav) ── */
  function buildPanelHTML() {
    return `<div
      id="lpInlinePanel"
      class="lp-inline-panel"
      role="dialog"
      aria-modal="true"
      aria-label="LEAF page panel"
      hidden>
      <div class="lp-inline-bar">
        <button
          class="lp-inline-back"
          id="lpInlineClose"
          type="button"
          aria-label="Close and return to Launchpad">
          <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
          Back to Launchpad
        </button>
      </div>
      <div class="lp-inline-loading" id="lpInlineLoading" aria-hidden="true">
        <span class="lp-inline-spinner"></span>
      </div>
      <iframe
        id="lpInlineFrame"
        src=""
        class="lp-inline-frame"
        title="Page content"
        frameborder="0">
      </iframe>
    </div>`;
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

    <button class="lp-nav-toggle" id="lpNavToggle" type="button" aria-expanded="false" aria-controls="lpMobilePanel" aria-label="Open menu">
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

  /* ── Skip navigation link ──
     Injected as the very first child of <body> so it's the first
     Tab stop on the page. Visually hidden until focused.
     Targets #main-content. If no element with that ID exists on
     the page, this script adds it to the first <main> element,
     or to the first block-level element after the nav. */
  function ensureSkipLink() {
    if (document.getElementById("lp-skip-nav")) return;
    var skip = document.createElement("a");
    skip.id = "lp-skip-nav";
    skip.className = "lp-skip-link";
    skip.href = "#main-content";
    skip.textContent = "Skip to main content";
    document.body.insertBefore(skip, document.body.firstChild);
  }

  function ensureMainContentTarget() {
    if (document.getElementById("main-content")) return;
    var main = document.querySelector("main");
    if (main) {
      main.id = "main-content";
      return;
    }
    /* Fall back: first sibling element after the nav */
    var nav = document.getElementById("lpNav");
    if (nav && nav.nextElementSibling) {
      nav.nextElementSibling.id = "main-content";
    }
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
    if (cssHref === src) return;
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
    ensureSkipLink();
    var host = ensureHost();
    host.outerHTML = buildNavHTML();
    ensureMainContentTarget();
    ensurePanel();
    wire();
  }

  /* ── Self-mount: inline panel ──
     Only injects if #lpInlinePanel isn't already on the page
     (e.g. launchpadv3.html already has it baked in). */
  function ensurePanel() {
    if (document.getElementById("lpInlinePanel")) return;
    var container = document.createElement("div");
    container.innerHTML = buildPanelHTML();
    document.body.appendChild(container.firstElementChild);
    wirePanelClose();
  }

  /* ── Wire the panel's close button, Escape, focus trap,
     spinner hide-on-load, and new-tab link sync ── */
  function wirePanelClose() {
    var panel = document.getElementById("lpInlinePanel");
    var frame = document.getElementById("lpInlineFrame");
    var loading = document.getElementById("lpInlineLoading");
    var closeBtn = document.getElementById("lpInlineClose");
    if (!panel || !frame || !closeBtn) return;

    function closePanel() {
      console.log("[LP Panel] closePanel called");
      frame.src = "";
      panel.setAttribute("hidden", "");
      document.body.style.overflow = "";
      var trigger = document.querySelector(".dd-trigger");
      if (trigger) trigger.focus();
    }

    /* ── iframe chrome suppression via MutationObserver ──
        The load event fires too early on LEAF Programmer pages (the wrapper
        loads first, then Programmer content is injected). A MutationObserver
        watches the iframe document and hides LEAF chrome (#header, .lp-nav,
        .lp-breadcrumb) the instant each element appears, regardless of how
        many load cycles the page goes through. */
    var iframeObserver = null;

    function suppressIframeChrome(iDoc) {
      if (!iDoc) return;
      /* Inject stylesheet once — guard against duplicates */
      if (!iDoc.getElementById("lp-iframe-overrides")) {
        var style = iDoc.createElement("style");
        style.id = "lp-iframe-overrides";
        style.textContent = [
          "#header { display: none !important; }",
          ".lp-nav { display: none !important; }",
          ".lp-breadcrumb { display: none !important; }",
        ].join(" ");
        (iDoc.head || iDoc.documentElement).appendChild(style);
        console.log(
          "[LP Panel] iframe chrome suppressed (style injected) \u2713",
        );
      }
      /* Also imperatively hide already-rendered elements in case style
          injection raced with rendering */
      ["#header", ".lp-nav", ".lp-breadcrumb"].forEach(function (sel) {
        var el = iDoc.querySelector(sel);
        if (el) el.style.setProperty("display", "none", "important");
      });
    }

    function startObservingIframe() {
      if (iframeObserver) {
        iframeObserver.disconnect();
        iframeObserver = null;
      }
      try {
        var iDoc = frame.contentDocument || frame.contentWindow.document;
        if (!iDoc) return;
        suppressIframeChrome(iDoc);
        iframeObserver = new MutationObserver(function () {
          suppressIframeChrome(iDoc);
        });
        iframeObserver.observe(iDoc.documentElement || iDoc.body, {
          childList: true,
          subtree: true,
        });
        console.log("[LP Panel] MutationObserver started on iframe \u2713");
      } catch (err) {
        console.log(
          "[LP Panel] Could not observe iframe (cross-origin?):",
          err.message,
        );
      }
    }

    /* Re-run on every load cycle so we catch the Programmer page injection */
    frame.addEventListener("load", function () {
      if (loading) loading.setAttribute("hidden", "");
      startObservingIframe();
    });

    /* Show spinner when a new URL is opened; disconnect stale observer */
    panel.addEventListener("lp:open", function () {
      if (loading) loading.removeAttribute("hidden");
      if (iframeObserver) {
        iframeObserver.disconnect();
        iframeObserver = null;
      }
    });

    closeBtn.addEventListener("click", closePanel);

    /* Escape closes the panel */
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hasAttribute("hidden")) {
        closePanel();
      }
    });

    /* Focus trap: cycle within the panel while it's open */
    panel.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var focusable = Array.prototype.slice.call(
        panel.querySelectorAll(
          'button:not([disabled]), a[href]:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  /* ── Focus trap helpers ──
     Used by the mobile panel to keep keyboard focus inside while open. */
  function getFocusableElements(container) {
    return Array.prototype.slice.call(
      container.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
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

    /* ── Desktop dropdowns (disclosure pattern) ── */
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

    /* ── Inline panel: intercept left-clicks on nav links ──
       Placed here (after closeAllDropdowns is defined) so it can
       safely call it. Bubble phase (no capture flag) so preventDefault
       reliably cancels navigation across all browsers. */
    function openInlinePanel(url) {
      console.log("[LP Panel] openInlinePanel called:", url);

      var panel = document.getElementById("lpInlinePanel");
      var frame = document.getElementById("lpInlineFrame");
      var loading = document.getElementById("lpInlineLoading");

      console.log("[LP Panel] Elements found:", {
        panel: !!panel,
        frame: !!frame,
        loading: !!loading,
      });

      if (!panel || !frame) {
        console.warn(
          "[LP Panel] ABORT — #lpInlinePanel or #lpInlineFrame not found in DOM.",
        );
        return false;
      }

      if (loading) loading.removeAttribute("hidden");
      console.log("[LP Panel] Setting iframe src to:", url);
      frame.src = url;
      panel.removeAttribute("hidden");
      document.body.style.overflow = "hidden";

      var ev = new CustomEvent("lp:open", { detail: { url: url } });
      panel.dispatchEvent(ev);
      console.log("[LP Panel] lp:open event dispatched");

      var closeBtn = document.getElementById("lpInlineClose");
      if (closeBtn) closeBtn.focus();
      console.log("[LP Panel] Panel opened successfully ✓");
      return true;
    }

    document.addEventListener("click", function (e) {
      var link = e.target.closest(".dd-link");
      if (!link) return;

      console.log("[LP Nav] dd-link clicked:", link);
      console.log(
        "[LP Nav] modifier keys — ctrl:",
        e.ctrlKey,
        "meta:",
        e.metaKey,
        "shift:",
        e.shiftKey,
        "button:",
        e.button,
      );

      // Let modifier-key / middle-clicks pass through to browser (real new tab)
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
        console.log(
          "[LP Nav] Modifier key detected — letting browser handle (new tab)",
        );
        return;
      }

      var href = link.getAttribute("href");
      console.log("[LP Nav] href:", href);

      if (!href || href === "#") {
        console.log(
          "[LP Nav] href is empty or # — skipping panel, no navigation",
        );
        return;
      }

      e.preventDefault();
      console.log("[LP Nav] preventDefault() called — navigation cancelled");

      closeAllDropdowns(null);
      console.log("[LP Nav] Opening panel for:", href);
      openInlinePanel(href);
    });

    /* ── Mobile accordion ── */
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
      navToggle.setAttribute("aria-label", "Close menu");
      mobilePanel.removeAttribute("hidden");
      document.body.style.overflow = "hidden";
      /* Move focus to the first focusable element in the panel */
      var focusable = getFocusableElements(mobilePanel);
      if (focusable.length) focusable[0].focus();
    }

    function closeMobileMenu(returnFocus) {
      if (!navToggle || !mobilePanel) return;
      navToggle.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", "Open menu");
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

    /* ── Focus trap for mobile panel ──
       While the panel is open, Tab and Shift+Tab cycle within it.
       Any focus leaving the panel (e.g. via mouse click outside)
       is handled by the outside-click listener below. */
    if (mobilePanel) {
      mobilePanel.addEventListener("keydown", function (e) {
        if (e.key !== "Tab") return;
        /* Only trap when the panel is actually visible */
        if (mobilePanel.hasAttribute("hidden")) return;

        var focusable = getFocusableElements(mobilePanel);
        if (!focusable.length) return;

        var first = focusable[0];
        var last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          /* Shift+Tab from first element → wrap to last */
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          /* Tab from last element → wrap to first */
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
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
