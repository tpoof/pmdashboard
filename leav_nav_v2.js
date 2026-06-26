/* ============================================================
   LEAF Universal Nav  |  leaf_nav.js  |  v4
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

   ── Option B: Hash router (Launchpad v4) ────────────────────
   On the launchpad page (report.php?a=launchpad), nav link
   left-clicks push a hash and trigger a fetch+inject cycle:

   1. Hash is pushed to window.location → hashchange fires
   2. Router maps hash key → URL from NAV_SECTIONS
   3. fetch(url) → DOMParser → extract #content
   4. Chrome suppression strips #header, #footer, nav, etc.
   5. Safe script re-execution re-appends <script> nodes
   6. Injected into #lpSwapHost; launchpad <main> hidden
   7. Breadcrumb updates to reflect current view
   8. Live region announces new page to screen readers

   Back button works natively via hash history.
   Modifier-key clicks (Ctrl/Cmd/middle) always open real tabs.
   Pages not on the launchpad are unaffected.

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
   • SPA view changes announced via #lp-live-region (aria-live)
   • Focus moved to #lpSwapHost after each view load
   • document.title updated to fetched page title on each view
   • prefers-reduced-motion: all animations suppressed in CSS
   ============================================================ */

(function () {
  "use strict";

  /* ── Nav content (single source of truth for desktop + mobile) ──
     href values here are the canonical URLs used by the router.
     Hash keys are derived from the ?a= param value automatically.
     Placeholder hrefs (#) are skipped by the router. */
  var NAV_SECTIONS = [
    {
      label: "What is LEAF?",
      items: [
        {
          icon: "bar_chart",
          title: "Our Impact",
          desc: "See how LEAF has transformed VA workflows across the country",
          href: "/platform/designs/report.php?a=impact",
        },
        {
          icon: "route",
          title: "Roadmap",
          desc: "Upcoming features and platform improvements",
          href: "#",
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
          href: "/platform/designs/report.php?a=form_library",
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
          href: "/platform/designs/report.php?a=find_site",
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
          href: "/platform/CoP/report.php?a=test_homepage",
        },
        {
          icon: "lightbulb",
          title: "Suggest an idea",
          desc: "Share feature requests with the LEAF team",
          href: "/platform/ideas/report.php?a=v3",
        },
      ],
    },
  ];

  /* ── Router: hash key → { href, title, section } lookup table ──
     Built once at init from NAV_SECTIONS. Hash key is the ?a= param
     value (e.g. "impact", "find_site"). The launchpad's own ?a=
     param is never read — the hash is the sole client-side router. */
  var ROUTE_MAP = {};

  function buildRouteMap() {
    NAV_SECTIONS.forEach(function (section) {
      section.items.forEach(function (item) {
        if (item.divider || !item.href || item.href === "#") return;
        var key = hrefToHashKey(item.href);
        if (key) {
          ROUTE_MAP[key] = {
            href: item.href,
            title: item.title,
            section: section.label,
          };
        }
      });
    });
  }

  /* Derive a hash key from any href.
     "/platform/designs/report.php?a=find_site" → "find_site"
     "report.php?a=Find_my_site"               → "find_my_site" (lowercased)
     Absolute URLs with different origin handled gracefully. */
  function hrefToHashKey(href) {
    if (!href || href === "#") return null;
    var match = href.match(/[?&]a=([^&#]+)/i);
    if (match) return match[1].toLowerCase();
    /* Fall back: use last path segment for hrefs without ?a= */
    var pathMatch = href.replace(/\/$/, "").match(/([^/?#]+)$/);
    return pathMatch ? pathMatch[1].toLowerCase() : null;
  }

  /* ── Detect whether we're on the launchpad ──
     The router only activates on report.php?a=launchpad.
     All other pages get the nav only — no router, no fetch. */
  function isLaunchpad() {
    /* Check for the swap host placeholder — present only on the launchpad page */
    if (document.getElementById("lpSwapHost")) return true;
    if (document.getElementById("lp-main")) return true;
    return false;
  }

  /* ─────────────────────────────────────────────────────────────
     MARKUP BUILDERS
     Shared by desktop dropdowns + mobile accordion
  ───────────────────────────────────────────────────────────── */
  function linkHTML(item) {
    if (item.divider) return '<hr class="dd-divider" aria-hidden="true">';
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

  /* ─────────────────────────────────────────────────────────────
     SKIP NAVIGATION LINK
     Injected as the very first child of <body>. Visually hidden
     until focused. Targets #main-content (which we reassign
     depending on current view state in the router).
  ───────────────────────────────────────────────────────────── */
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
    var nav = document.getElementById("lpNav");
    if (nav && nav.nextElementSibling) {
      nav.nextElementSibling.id = "main-content";
    }
  }

  /* ─────────────────────────────────────────────────────────────
     SELF-MOUNT: STYLESHEET
  ───────────────────────────────────────────────────────────── */
  /* Hardcoded path — CSS filename is always leaf_nav.css regardless
     of what version filename this JS is deployed as (leaf_nav_v2.js,
     leaf_nav_v3.js, etc.). Update this constant if the CSS ever moves. */
  var LEAF_NAV_CSS_HREF = "/platform/designs/files/leaf_nav.css";

  function ensureStylesheet() {
    /* Already linked by the page directly — leave it alone */
    if (
      document.querySelector(
        'link[href*="leaf_nav.css"], link[href*="leaf-nav.css"]',
      )
    ) {
      return;
    }
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = LEAF_NAV_CSS_HREF;
    document.head.appendChild(link);
    console.log("[LP Nav] Stylesheet injected:", LEAF_NAV_CSS_HREF);
  }
  ensureStylesheet();

  /* ─────────────────────────────────────────────────────────────
     SELF-MOUNT: HOST ELEMENT
  ───────────────────────────────────────────────────────────── */
  function ensureHost() {
    var host = document.getElementById("lp-nav-host");
    if (host) return host;
    host = document.createElement("div");
    host.id = "lp-nav-host";
    document.body.insertBefore(host, document.body.firstChild);
    return host;
  }

  /* ─────────────────────────────────────────────────────────────
     SELF-MOUNT: SWAP HOST
     The persistent container that receives fetched page content.
     Only injected on the launchpad page. Hidden by default.
  ───────────────────────────────────────────────────────────── */
  function ensureSwapHost() {
    /* Mark existing element with stable attribute if present */
    var existing = document.getElementById("lpSwapHost");
    if (existing) {
      existing.setAttribute("data-lp-swap-host", "");
      return;
    }
    var host = document.createElement("div");
    host.id = "lpSwapHost";
    host.setAttribute("data-lp-swap-host", ""); /* stable lookup anchor */
    host.setAttribute("hidden", "");
    host.setAttribute("tabindex", "-1");
    host.setAttribute("aria-label", "Page content");
    /* Insert after nav, before everything else */
    var nav = document.getElementById("lpNav");
    if (nav && nav.parentNode) {
      nav.parentNode.insertBefore(host, nav.nextSibling);
    } else {
      document.body.appendChild(host);
    }
  }

  /* ─────────────────────────────────────────────────────────────
     SELF-MOUNT: LIVE REGION
     Announces view changes to screen readers without moving focus.
     aria-live="polite" waits for current speech to finish.
  ───────────────────────────────────────────────────────────── */
  function ensureLiveRegion() {
    if (document.getElementById("lp-live-region")) return;
    var region = document.createElement("div");
    region.id = "lp-live-region";
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    region.className = "lp-sr-only";
    document.body.appendChild(region);
  }

  function announce(msg) {
    var region = document.getElementById("lp-live-region");
    if (!region) return;
    /* Clear then set to ensure re-announcement of same text */
    region.textContent = "";
    setTimeout(function () {
      region.textContent = msg;
    }, 50);
  }

  /* ─────────────────────────────────────────────────────────────
     INJECT
  ───────────────────────────────────────────────────────────── */
  function inject() {
    ensureSkipLink();
    var host = ensureHost();
    host.outerHTML = buildNavHTML();
    ensureMainContentTarget();

    if (isLaunchpad()) {
      buildRouteMap();
      ensureSwapHost();
      ensureLiveRegion();
      wireRouter();
    }

    wire();
  }

  /* ─────────────────────────────────────────────────────────────
     CHROME SUPPRESSION LIST
     Applied to the parsed DOMParser document before extraction.
     Covers both old Smarty template (DIV#header, DIV#footer) and
     new template (HEADER#header, FOOTER#footer.noprint).
  ───────────────────────────────────────────────────────────── */
  var CHROME_SELECTORS = [
    "#header",
    "#footer",
    ".noprint",
    "#lp-skip-nav",
    "#nav-skip-link",
    "#LeafSession_dialog",
    "#lpInlinePanel",
    "#lpSwapHost",
    ".lp-nav",
    "#lp-nav-host",
    ".lp-breadcrumb",
    "#lp-breadcrumb-host",
    "#lp-live-region",
  ];

  /* ─────────────────────────────────────────────────────────────
     CONTENT EXTRACTION
     Priority order:
       1. [data-lp-content]  — explicit opt-in (add to pages over time)
       2. #content            — stable Smarty template contract
       3. #bodyarea           — one level deeper, safety net
       4. <main>              — generic semantic fallback
       5. body minus chrome   — last resort
  ───────────────────────────────────────────────────────────── */
  function suppressChrome(doc) {
    CHROME_SELECTORS.forEach(function (sel) {
      var els = doc.querySelectorAll(sel);
      els.forEach(function (el) {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
    });
  }

  function extractContent(doc) {
    /* 1. Explicit opt-in */
    var el = doc.querySelector("[data-lp-content]");
    if (el) return el;

    /* 2. Smarty #content div — consistent across both template generations */
    el = doc.getElementById("content");
    if (el && el.innerHTML.trim().length > 0) return el;

    /* 3. #bodyarea — one level deeper */
    el = doc.getElementById("bodyarea");
    if (el && el.innerHTML.trim().length > 0) return el;

    /* 4. <main> — semantic fallback */
    el = doc.querySelector("main");
    if (el && el.innerHTML.trim().length > 0) return el;

    /* 5. Body minus chrome — last resort: return body itself
       (chrome already stripped by suppressChrome) */
    return doc.body;
  }

  /* ─────────────────────────────────────────────────────────────
     SAFE SCRIPT RE-EXECUTION
     Inline scripts: wrapped in new Function() to avoid top-level
     var declarations stomping outer window globals.
     External scripts: re-appended to <head> with a new node so
     the browser fetches and executes them.
     Guards: document.write calls are skipped (they'd overwrite
     the outer page). Scripts already loaded by src are tracked
     in a seen-set to avoid duplicate execution across navigations.
  ───────────────────────────────────────────────────────────── */
  var _seenExternalScripts = {};

  function reExecuteScripts(container) {
    var scripts = Array.prototype.slice.call(
      container.querySelectorAll("script"),
    );

    scripts.forEach(function (oldScript) {
      /* Skip scripts that would destroy the outer document */
      if (
        oldScript.textContent &&
        oldScript.textContent.indexOf("document.write") > -1
      ) {
        console.warn("[LP Router] Skipped script containing document.write");
        return;
      }

      if (oldScript.src) {
        /* External script — deduplicate by src across navigations */
        var src = oldScript.src;
        if (_seenExternalScripts[src]) {
          console.log(
            "[LP Router] Skipping already-loaded external script:",
            src,
          );
          return;
        }
        _seenExternalScripts[src] = true;

        var newScript = document.createElement("script");
        newScript.src = src;
        newScript.async = false;
        if (oldScript.type) newScript.type = oldScript.type;
        document.head.appendChild(newScript);
        console.log("[LP Router] Re-executed external script:", src);
      } else if (oldScript.textContent && oldScript.textContent.trim()) {
        /* Inline script — execute via new Function to scope top-level vars */
        try {
          /* Pass document and window explicitly so scripts that reference
             them still work, while top-level var leakage is contained */
          var fn = new Function("document", "window", oldScript.textContent);
          fn(document, window);
          console.log(
            "[LP Router] Re-executed inline script (" +
              oldScript.textContent.trim().length +
              " chars)",
          );
        } catch (err) {
          console.warn(
            "[LP Router] Inline script execution error:",
            err.message,
          );
        }
      }
    });
  }

  /* ─────────────────────────────────────────────────────────────
     SWAP HOST: LOADING / ERROR / CONTENT STATES
  ───────────────────────────────────────────────────────────── */
  /* Helper: find swap host by stable data attribute regardless of
     what id it currently holds (it temporarily holds "main-content") */
  function getSwapHost() {
    /* Primary: stable data attribute — survives any id reassignment */
    return (
      document.querySelector("[data-lp-swap-host]") ||
      document.getElementById("lpSwapHost")
    );
  }

  function showSwapLoading() {
    var host = getSwapHost();
    if (!host) return;
    host.innerHTML =
      '<div class="lp-swap-loading" aria-hidden="true">' +
      '<span class="lp-swap-spinner"></span>' +
      "</div>";
    host.removeAttribute("hidden");
  }

  function showSwapError(url) {
    var host = getSwapHost();
    if (!host) return;
    host.innerHTML =
      '<div class="lp-swap-error" role="alert">' +
      '<span class="material-symbols-outlined lp-swap-error-ico" aria-hidden="true">error_outline</span>' +
      '<p class="lp-swap-error-msg">This page couldn\'t be loaded.</p>' +
      '<a class="lp-swap-error-link btn btn-sec" href="' +
      url +
      '" target="_blank" rel="noopener noreferrer">' +
      '<span class="material-symbols-outlined" aria-hidden="true">open_in_new</span>' +
      "Open in a new tab" +
      "</a>" +
      "</div>";
  }

  function mountContent(el, sourceDoc, route) {
    var host = getSwapHost();
    if (!host) {
      console.error("[LP Router] mountContent: swap host not found in DOM");
      return;
    }
    console.log(
      "[LP Router] mountContent: host found —",
      host.id,
      "hidden?",
      host.hasAttribute("hidden"),
    );

    /* Build the content wrapper */
    var wrapper = document.createElement("div");
    wrapper.className = "lp-swap-content";

    /* Move children rather than cloning to preserve event listeners
       attached during script execution in the parsed doc */
    while (el.firstChild) {
      wrapper.appendChild(el.firstChild);
    }

    host.innerHTML = "";
    host.appendChild(wrapper);

    /* Re-execute scripts found in the wrapper */
    reExecuteScripts(wrapper);

    /* Update document title */
    var fetchedTitle = sourceDoc.title;
    if (fetchedTitle) document.title = fetchedTitle;

    /* Announce to screen readers */
    announce(
      (route && route.title ? route.title : fetchedTitle || "Page") + " loaded",
    );

    /* Move focus to swap host so screen readers read from here */
    host.focus();
  }

  /* ─────────────────────────────────────────────────────────────
     LAUNCHPAD HOME: SHOW / HIDE
     When showing a fetched view, the launchpad's own <main> hides.
     When returning home (empty hash), it shows again.
     The skip link target (#main-content) swaps accordingly.
  ───────────────────────────────────────────────────────────── */
  /* ── Skip link target management ──
     Both #lp-main and #lpSwapHost keep their IDs permanently.
     We move id="main-content" by reassigning it on the currently
     visible element — but we do it AFTER the hidden toggle so the
     element is already visible when it receives the id.
     Root cause of original bug: id was swapped before hidden was
     removed, so getElementById("lpSwapHost") returned null when
     mountContent tried to unhide it. */
  function showLaunchpadHome() {
    var lpMain = document.getElementById("lp-main");
    var swapHost = document.getElementById("lpSwapHost");

    /* 1. Show home */
    if (lpMain) lpMain.removeAttribute("hidden");

    /* 2. Hide and clear swap host */
    if (swapHost) {
      swapHost.setAttribute("hidden", "");
      swapHost.removeAttribute("id"); /* release main-content id if held */
      swapHost.innerHTML = "";
    }

    /* 3. Restore skip link target to home — AFTER visibility change */
    if (lpMain) lpMain.id = "main-content";

    document.title =
      "LEAF Launchpad — Your Platform for Digital Transformation";
    announce("Returned to Launchpad home");

    updateNavCurrent(null);
    updateBreadcrumb(null, null);

    console.log(
      "[LP Router] showLaunchpadHome complete — lp-main visible, swapHost hidden",
    );
  }

  function showSwapView() {
    var lpMain = document.getElementById("lp-main");
    var swapHost = document.getElementById("lpSwapHost");

    /* 1. Hide home, release its main-content id */
    if (lpMain) {
      lpMain.setAttribute("hidden", "");
      lpMain.removeAttribute("id");
    }

    /* 2. Unhide swap host — id="lpSwapHost" stays intact */
    if (swapHost) swapHost.removeAttribute("hidden");

    /* 3. Assign skip link target to swap host — AFTER it's visible */
    if (swapHost) swapHost.id = "main-content";

    console.log(
      "[LP Router] showSwapView complete — lpSwapHost id now:",
      swapHost ? swapHost.id : "MISSING",
      "hidden?",
      swapHost ? swapHost.hasAttribute("hidden") : "MISSING",
    );
  }

  /* ─────────────────────────────────────────────────────────────
     BREADCRUMB UPDATE
     Sets window.LEAF_BREADCRUMB if the breadcrumb system reads it,
     and also directly manipulates .lp-breadcrumb DOM if present.
     Breadcrumb trail: Home > [Section] > [Page]
  ───────────────────────────────────────────────────────────── */
  function updateBreadcrumb(route, hash) {
    var crumbs = [{ label: "LEAF Launchpad", href: "report.php?a=launchpad" }];

    if (route) {
      if (route.section) {
        crumbs.push({ label: route.section, href: null });
      }
      crumbs.push({ label: route.title, href: null, current: true });
    }

    window.LEAF_BREADCRUMB = crumbs;

    /* If the breadcrumb element is already in the DOM, update it directly */
    var bc = document.querySelector(".lp-breadcrumb");
    if (!bc) return;

    var ol = bc.querySelector("ol, ul, nav");
    if (!ol) return;

    ol.innerHTML = crumbs
      .map(function (crumb, i) {
        var isLast = i === crumbs.length - 1;
        if (isLast) {
          return (
            '<li><span aria-current="page">' + crumb.label + "</span></li>"
          );
        }
        return (
          "<li>" +
          (crumb.href
            ? '<a href="' + crumb.href + '">' + crumb.label + "</a>"
            : "<span>" + crumb.label + "</span>") +
          "</li>"
        );
      })
      .join("");
  }

  /* ─────────────────────────────────────────────────────────────
     NAV CURRENT STATE
     Marks the active section's trigger with aria-current.
  ───────────────────────────────────────────────────────────── */
  function updateNavCurrent(sectionLabel) {
    document.querySelectorAll(".dd-trigger").forEach(function (btn) {
      btn.removeAttribute("aria-current");
    });
    if (!sectionLabel) return;
    document.querySelectorAll(".dd-trigger").forEach(function (btn) {
      if (
        btn.textContent
          .trim()
          .toLowerCase()
          .indexOf(sectionLabel.trim().toLowerCase()) === 0
      ) {
        btn.setAttribute("aria-current", "true");
      }
    });
    window.LEAF_NAV_CURRENT = sectionLabel;
  }

  /* ─────────────────────────────────────────────────────────────
     FETCH + INJECT
     Core router action. Fetches url, parses, suppresses chrome,
     extracts #content, mounts into swap host.
  ───────────────────────────────────────────────────────────── */
  function loadView(hash, route) {
    if (!route) {
      console.warn("[LP Router] No route found for hash:", hash);
      showSwapError("#");
      return;
    }

    var url = route.href;
    console.log("[LP Router] loadView:", hash, "→", url);

    showSwapView();
    showSwapLoading();
    updateNavCurrent(route.section);

    fetch(url, {
      credentials: "same-origin" /* send session cookies so auth works */,
      headers: { "X-Requested-With": "XMLHttpRequest" },
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error(
            "HTTP " + response.status + " " + response.statusText,
          );
        }
        return response.text();
      })
      .then(function (html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, "text/html");

        /* Suppress chrome elements in the parsed document */
        suppressChrome(doc);

        /* Extract content zone */
        var contentEl = extractContent(doc);

        if (!contentEl || contentEl.innerHTML.trim().length === 0) {
          throw new Error("Content extraction returned empty result");
        }

        /* Mount into swap host */
        mountContent(contentEl, doc, route);

        /* Update breadcrumb */
        updateBreadcrumb(route, hash);

        /* Scroll swap host to top */
        var host = getSwapHost();
        if (host) host.scrollTop = 0;
        window.scrollTo(0, 0);

        console.log("[LP Router] View loaded:", route.title);
      })
      .catch(function (err) {
        console.error("[LP Router] Fetch failed for", url, ":", err.message);
        showSwapError(url);
        announce("This page couldn't be loaded. Try opening it in a new tab.");
      });
  }

  /* ─────────────────────────────────────────────────────────────
     ROUTER
     Reads window.location.hash and dispatches to the right view.
     Called on init and on every hashchange event.
  ───────────────────────────────────────────────────────────── */
  function router() {
    var raw = window.location.hash; /* e.g. "#find_site" or "" */
    var key = raw.replace(/^#/, "").toLowerCase();

    console.log("[LP Router] router() hash:", raw, "key:", key);

    if (!key || key === "home" || key === "launchpad") {
      showLaunchpadHome();
      return;
    }

    var route = ROUTE_MAP[key];
    loadView(key, route);
  }

  /* ─────────────────────────────────────────────────────────────
     LINK INTERCEPT
     Replaces Option A's click handler. Left-clicking a .dd-link
     or .lp-panel-link pushes a hash instead of navigating.
     Modifier-key and middle-clicks fall through to the browser.
  ───────────────────────────────────────────────────────────── */
  function wireLinkIntercept() {
    document.addEventListener("click", function (e) {
      /* Match both nav dropdown links and footer quick-resource links */
      var link = e.target.closest(".dd-link, .lp-panel-link");
      if (!link) return;

      /* Modifier-key / middle-click → real new tab, no intercept */
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
        console.log("[LP Router] Modifier key — passing through to browser");
        return;
      }

      var href = link.getAttribute("href");
      if (!href || href === "#") return; /* placeholder — ignore */

      e.preventDefault();
      closeAllDropdowns(null);

      /* Derive hash key from href */
      var key = hrefToHashKey(href);
      if (!key) {
        /* Unrecognised href — fall back to direct navigation */
        window.location.href = href;
        return;
      }

      /* Push hash → triggers hashchange → router() */
      var newHash = "#" + key;
      if (window.location.hash === newHash) {
        /* Same hash clicked again — re-run router manually
           (hashchange won't fire if hash hasn't changed) */
        router();
      } else {
        window.location.hash = newHash;
      }
    });
  }

  /* ─────────────────────────────────────────────────────────────
     WIRE ROUTER
     Called only on the launchpad page.
  ───────────────────────────────────────────────────────────── */
  function wireRouter() {
    /* hashchange drives back/forward navigation */
    window.addEventListener("hashchange", function () {
      router();
    });

    /* Wire link intercept (replaces Option A panel opener) */
    wireLinkIntercept();

    /* Run router on init to handle deep-linked URLs
       (e.g. user bookmarked report.php?a=launchpad#find_site) */
    router();
  }

  /* ─────────────────────────────────────────────────────────────
     FOCUS TRAP HELPERS
  ───────────────────────────────────────────────────────────── */
  function getFocusableElements(container) {
    return Array.prototype.slice.call(
      container.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
  }

  /* closeAllDropdowns is referenced by wireLinkIntercept above,
     so it's declared here at module scope and assigned in wire() */
  var closeAllDropdowns = function () {};

  /* ─────────────────────────────────────────────────────────────
     WIRE INTERACTIONS
     Desktop dropdowns, mobile accordion, scroll shadow, Escape.
     Unchanged from v3 except closeAllDropdowns is now module-scoped
     so wireLinkIntercept can call it.
  ───────────────────────────────────────────────────────────── */
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
    closeAllDropdowns = function (except) {
      document.querySelectorAll(".dd-item.open").forEach(function (item) {
        if (item === except) return;
        item.classList.remove("open");
        var btn = item.querySelector(".dd-trigger");
        var panel = item.querySelector(".dd-panel");
        if (btn) btn.setAttribute("aria-expanded", "false");
        if (panel) panel.setAttribute("hidden", "");
      });
    };

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

    /* ── Focus trap for mobile panel ── */
    if (mobilePanel) {
      mobilePanel.addEventListener("keydown", function (e) {
        if (e.key !== "Tab") return;
        if (mobilePanel.hasAttribute("hidden")) return;
        var focusable = getFocusableElements(mobilePanel);
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      });
    }

    /* Close mobile menu after a link inside it is followed */
    if (mobilePanel) {
      mobilePanel.addEventListener("click", function (e) {
        if (e.target.closest("a")) closeMobileMenu(false);
      });
    }

    /* Auto-close mobile menu if viewport grows past breakpoint */
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
