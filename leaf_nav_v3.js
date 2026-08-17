/* ============================================================
   LEAF Universal Nav  |  leaf_nav.js  |  v4
   ─────────────────────────────────────────────────────────────
   Lives at /launchpad/files/leaf_nav_v3.js — every page
   should point here directly so there's exactly one copy to
   edit.

   Self-mounting: this script auto-injects its own stylesheet
   and, if the host page doesn't already have one, creates the
   <div id="lp-nav-host"> for itself. That means a brand-new
   page only needs ONE line added to it, right before </head>
   or </body>:

       <script src="/launchpad/files/leaf_nav_v3.js"></script>

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

  /* ── Internal section config ────────────────────────────────────
     Placeholder group IDs and indicator IDs — swap in real values
     before promoting to production.

     LEADERSHIP_GROUP_ID    : Smarty group that can see the Leadership link.
     LEAF_TEAM_GROUP_ID     : Smarty group that can see the entire LEAF Team
                              dropdown (and the Internal button itself).
     LEAF_TEAM_LINK_NAME_INDICATOR_ID : Indicator ID for the link label field
                              on the /platform/service_requests_launchpad/ form.
     LEAF_TEAM_LINK_URL_INDICATOR_ID  : Indicator ID for the link URL field
                              on the same form.

     These constants drive the Smarty conditionals embedded in the
     buildInternalNavHTML() template string and the fetch call in
     fetchLeafTeamLinks(). Search "REPLACE_ME" to find all touch-points. */

  var LEADERSHIP_GROUP_ID = "REPLACE_ME_LEADERSHIP_GROUP_ID";
  var LEAF_TEAM_GROUP_ID = "REPLACE_ME_LEAF_TEAM_GROUP_ID";
  var LEAF_TEAM_LINK_NAME_INDICATOR_ID = 479;
  var LEAF_TEAM_LINK_URL_INDICATOR_ID = 480;

  /* Base URL for the LEAF form that stores LEAF Team quick-links.
     Must be absolute — this JS runs on the launchpad URL which is
     a different origin path, so a relative URL would resolve wrong.
     window.location.origin gives us the correct host (e.g.
     https://leaf.va.gov) regardless of which page loads this file. */
  var LEAF_TEAM_FORM_BASE =
    window.location.origin + "/platform/service_requests_launchpad";

  /* ── Nav content (single source of truth for desktop + mobile) ──
     href values here are the canonical URLs used by the router.
     Hash keys are derived from the ?a= param value automatically.
     Placeholder hrefs (#) are skipped by the router. */
  var NAV_SECTIONS = [
    {
      label: "About LEAF",
      items: [
        {
          icon: "bar_chart",
          title: "Our Impact",
          desc: "LEAF's impact across the VA enterprise",
          href: "/launchpad/report.php?a=lp_impact",
        },
        {
          icon: "route",
          title: "Roadmap",
          desc: "What's coming to LEAF",
          href: "/launchpad/report.php?a=lp_roadmap",
          hidden: true,
        },
      ],
    },
    {
      label: "Solutions",
      items: [
        {
          icon: "library_books",
          title: "Use Cases",
          desc: "Explore real workflows from teams across the VA",
          href: "#",
          hidden: true,
        },
        {
          icon: "description",
          title: "Form Library",
          desc: "Forms and templates built by VA teams",
          href: "/launchpad/report.php?a=lp_form_library",
        },
        {
          icon: "cable",
          title: "Integrations",
          desc: "Connect LEAF to other systems and tools",
          href: "/launchpad/report.php?a=lp_integrations",
          hidden: true,
        },
      ],
    },
    {
      label: "Resources",
      items: [
        {
          icon: "location_on",
          title: "Find a LEAF Site",
          desc: "Locate a LEAF site at your VA facility",
          href: "/launchpad/report.php?a=lp_find_site",
        },
        {
          icon: "group",
          title: "Community of Practice",
          desc: "Connect with LEAF users VA-wide",
          href: "/platform/CoP",
        },
        {
          icon: "lightbulb",
          title: "Suggest an Idea",
          desc: "Submit an idea to improve LEAF",
          href: "https://leaf.va.gov/platform/ideas",
        },
        {
          icon: "privacy_tip",
          title: "Privacy & Compliance",
          desc: "LEAF privacy and compliance resources",
          href: "https://leaf.va.gov/platform/privacy/resources.php?a=resources",
        },
      ],
    },
    {
      label: "Knowledge Center",
      items: [
        {
          icon: "school",
          title: "Learn",
          desc: "Structured courses and training",
          href: "#",
          hidden: true,
        },
        {
          icon: "menu_book",
          title: "Help Library",
          desc: "Guides and documentation",
          href: "https://leaf.va.gov/platform/help_library/report.php?a=homepage",
        },
        {
          icon: "quiz",
          title: "FAQ",
          desc: "Quick answers to common questions",
          href: "#",
          hidden: true,
        },
      ],
    },
  ];

  /* ── Sub-routes: pages nested under a nav item (not in the dropdown) ──
     These get registered in ROUTE_MAP at init so the hash router can
     load them and breadcrumbs get the correct 4-level trail. */
  var SUBROUTES = [
    {
      href: "/launchpad/report.php?a=lp_brand_guide",
      title: "Brand Guide",
      section: "About LEAF",
      parent: {
        label: "Our Impact",
        href: "/launchpad/report.php?a=lp_impact",
      },
    },
    {
      href: "/launchpad/report.php?a=lp_voc",
      title: "Voice of the Customer",
      section: "About LEAF",
      parent: {
        label: "Roadmap",
        href: "/launchpad/report.php?a=lp_roadmap",
      },
    },
  ];

  /* ── Router: hash key → { href, title, section } lookup table ──
     Built once at init from NAV_SECTIONS. Hash key is the ?a= param
     value (e.g. "impact", "find_site"). The launchpad's own ?a=
     param is never read — the hash is the sole client-side router.
     Leadership is also registered here even though it lives in the
     separate INTERNAL_SECTION — it still hash-routes. */
  var ROUTE_MAP = {};

  /* Static definition for the Leadership internal link so the router
     knows about it. LEAF Team links navigate away and are NOT registered. */
  var INTERNAL_LEADERSHIP_ROUTE = {
    href: "/platform/projects/report.php?a=leadership",
    title: "Leadership",
    section: "Internal",
  };

  function buildRouteMap() {
    NAV_SECTIONS.forEach(function (section) {
      section.items.forEach(function (item) {
        if (item.divider || !item.href || item.href === "#" || item.hidden)
          return;
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
    /* Register sub-routes (pages nested under a nav item) */
    SUBROUTES.forEach(function (route) {
      var key = hrefToHashKey(route.href);
      if (key) ROUTE_MAP[key] = route;
    });

    /* Register Leadership so the hash router can load it inline */
    var leadershipKey = hrefToHashKey(INTERNAL_LEADERSHIP_ROUTE.href);
    if (leadershipKey) {
      ROUTE_MAP[leadershipKey] = INTERNAL_LEADERSHIP_ROUTE;
    }
  }

  /* Derive a hash key from any href.
     "/launchpad/report.php?a=lp_find_site" → "lp_find_site"
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
    /* Use <button data-href> instead of <a href> so the browser status
       bar never previews the destination URL on hover. Navigation is
       handled by wireLinkIntercept() which reads data-href. */
    return `
      <li>
        <button class="dd-link" data-href="${item.href}">
          <span class="dd-link-ico">
            <span class="material-symbols-outlined" aria-hidden="true">${item.icon}</span>
          </span>
          <span class="dd-link-text">
            <strong>${item.title}</strong>
            <span>${item.desc}</span>
          </span>
        </button>
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
            ${section.items
              .filter(function (item) {
                return !item.hidden;
              })
              .map(linkHTML)
              .join("")}
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
            ${section.items
              .filter(function (item) {
                return !item.hidden;
              })
              .map(linkHTML)
              .join("")}
          </ul>
        </div>
      </li>`;
  }

  /* ─────────────────────────────────────────────────────────────
     INTERNAL NAV SECTION
     Right-aligned group rendered as:

       [ 🔒 Internal ]  [ Leadership ]  [ LEAF Team ▾ ]
                         (direct link)   (dropdown)

     Smarty group conditionals gate each element:
       - Entire group  → LEAF_TEAM_GROUP_ID  (outer wrapper)
       - Leadership    → LEADERSHIP_GROUP_ID (individual link)
       - LEAF Team     → LEAF_TEAM_GROUP_ID  (same as outer;
                         redundant but explicit for clarity)

     NOTE: Smarty tags below are processed server-side via the
     PHP/Smarty wrapper. If you see literal "<!--{if" strings in
     rendered HTML the wrapper is not processing this file — run
     ?leafNavDebug=1 (group 12 members only) for a diagnosis.
  ───────────────────────────────────────────────────────────── */
  function buildInternalNavHTML(leadershipGroupID, leafTeamGroupID) {
    /* ── Desktop: flat group of items ── */
    var desktopInternal =
      `
<!--{if $empMembership['groupID'][` +
      leafTeamGroupID +
      `]}-->
<div class="lp-nav-internal" role="navigation" aria-label="Internal team links">

  <!-- "Internal" label — non-interactive, purely visual -->
  <span class="lp-internal-label" aria-hidden="true">
    <span class="material-symbols-outlined lp-internal-label-icon" aria-hidden="true">lock</span>
    Internal
  </span>

  <!-- Vertical rule separating label from buttons -->
  <span class="lp-internal-rule" aria-hidden="true"></span>

<!--{if $empMembership['groupID'][` +
      leadershipGroupID +
      `]}-->
  <!-- Leadership: direct hash-routed link -->
  <button class="lp-internal-btn" data-href="/platform/projects/report.php?a=leadership">
    Leadership
  </button>
<!--{/if}-->

  <!-- LEAF Team: dropdown trigger + panel -->
  <div class="dd-item dd-item--internal" id="dd-item-leaf-team" style="position:relative;">
    <button class="lp-internal-btn lp-internal-btn--dd dd-trigger"
            aria-expanded="false"
            aria-controls="dd-leaf-team"
            aria-haspopup="false">
      LEAF Team
      <span class="dd-chevron" aria-hidden="true">
        <span class="material-symbols-outlined">arrow_drop_down</span>
      </span>
    </button>
    <div class="dd-panel dd-panel--internal" id="dd-leaf-team" hidden>
      <ul class="dd-list" id="lpNavLeafTeamLinks" aria-live="polite">
        <!-- Dynamic links injected by fetchLeafTeamLinks() -->
        <li class="lp-internal-loading">
          <span class="material-symbols-outlined" aria-hidden="true">sync</span>
          Loading links…
        </li>
      </ul>
    </div>
  </div>

</div>
<!--{/if}-->`;

    /* ── Mobile: appended at bottom of accordion ── */
    var mobileInternal =
      `
<!--{if $empMembership['groupID'][` +
      leafTeamGroupID +
      `]}-->

<!-- Mobile separator before Internal section -->
<li class="lp-internal-mobile-item" role="separator" aria-hidden="true">
  <div class="lp-mobile-internal-sep">
    <span class="material-symbols-outlined" aria-hidden="true">lock</span>
    Internal
  </div>
</li>

<!--{if $empMembership['groupID'][` +
      leadershipGroupID +
      `]}-->
<li class="lp-internal-mobile-item">
  <button class="dd-link" data-href="/platform/projects/report.php?a=leadership">
    <span class="dd-link-ico">
      <span class="material-symbols-outlined" aria-hidden="true">groups</span>
    </span>
    <span class="dd-link-text">
      <strong>Leadership</strong>
      <span>Platform leadership dashboard</span>
    </span>
  </button>
</li>
<!--{/if}-->

<li class="lp-internal-mobile-item acc-item acc-item--internal" id="acc-item-leaf-team">
  <button class="acc-trigger" aria-expanded="false" aria-controls="acc-leaf-team">
    LEAF Team
    <span class="dd-chevron" aria-hidden="true">
      <span class="material-symbols-outlined">arrow_drop_down</span>
    </span>
  </button>
  <div class="acc-panel" id="acc-leaf-team" hidden>
    <ul class="dd-list" id="lpNavLeafTeamLinksMobile" aria-live="polite">
      <li class="lp-internal-loading">
        <span class="material-symbols-outlined" aria-hidden="true">sync</span>
        Loading links…
      </li>
    </ul>
  </div>
</li>

<!--{/if}-->`;

    return { desktop: desktopInternal, mobile: mobileInternal };
  }

  function buildNavHTML() {
    var desktopItems = NAV_SECTIONS.map(desktopSectionHTML).join("");
    var mobileItems = NAV_SECTIONS.map(mobileSectionHTML).join("");
    var internal = buildInternalNavHTML(
      LEADERSHIP_GROUP_ID,
      LEAF_TEAM_GROUP_ID,
    );
    return `
<nav class="lp-nav" id="lpNav" aria-label="Launchpad navigation">
  <div class="lp-nav-in">

    <!-- Left: public nav sections -->
    <ul class="lp-nav-links" role="list">
      ${desktopItems}
    </ul>

    <!-- Right: internal group (margin-left:auto pushes it to the edge) -->
    ${internal.desktop}

    <!-- Mobile hamburger toggle -->
    <button class="lp-nav-toggle" id="lpNavToggle" type="button"
            aria-expanded="false" aria-controls="lpMobilePanel" aria-label="Open menu">
      <span class="lp-nav-toggle-icon" aria-hidden="true">
        <span></span><span></span><span></span>
      </span>
    </button>

    <!-- Mobile panel -->
    <div class="lp-mobile-panel" id="lpMobilePanel" hidden>
      <ul class="lp-accordion" role="list">
        ${mobileItems}
        ${internal.mobile}
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
  /* Hardcoded path — pinned to the v3 CSS filenames so this v3 JS
     always loads its v3 companions and never the v2/legacy files. */
  var LEAF_NAV_CSS_HREF = "/launchpad/files/leaf_nav_v3.css";
  var LEAF_BREADCRUMB_CSS_HREF = "/launchpad/files/leaf_breadcrumb_v3.css";

  function ensureStylesheet() {
    /* Nav CSS — hardcoded so it loads correctly regardless of JS filename */
    if (
      !document.querySelector(
        'link[href*="leaf_nav_v3.css"], link[href*="leaf-nav-v3.css"]',
      )
    ) {
      var navLink = document.createElement("link");
      navLink.rel = "stylesheet";
      navLink.href = LEAF_NAV_CSS_HREF;
      document.head.appendChild(navLink);
    }
    /* Breadcrumb CSS — needed on the launchpad so the router-injected
       breadcrumb is styled without leaf_breadcrumb.js having to run.
       Safe to load on all pages — it's a small file and causes no conflicts. */
    if (!document.querySelector('link[href*="leaf_breadcrumb_v3.css"]')) {
      var bcLink = document.createElement("link");
      bcLink.rel = "stylesheet";
      bcLink.href = LEAF_BREADCRUMB_CSS_HREF;
      document.head.appendChild(bcLink);
    }

    /* ── Internal section styles ──────────────────────────────────
       Injected here so leaf_nav_v2.js is fully self-contained.
       When promoting to production, move all rules below into
       leaf_nav.css and delete this block.

       The .lp-nav-in flex patch is needed because leaf_nav.css
       does not currently account for a sibling element after
       .lp-nav-links. Move that rule to leaf_nav.css too. */
    if (!document.getElementById("lp-nav-internal-styles")) {
      var style = document.createElement("style");
      style.id = "lp-nav-internal-styles";
      style.textContent = [
        /* ── dd-link button reset ───────────────────────────────
           .dd-link is now a <button> (not <a>) so the browser
           status bar never shows the destination URL on hover.
           These rules make it look and behave identically to the
           old anchor version. */
        "button.dd-link {",
        "  width: 100%;",
        "  text-align: left;",
        "  background: none;",
        "  border: none;",
        "  font: inherit;",
        "  cursor: pointer;",
        "  padding: 10px 12px;",
        "}",

        /* ── lp-nav-in flex patch ───────────────────────────────
           Ensures the nav bar is a flex row so margin-left:auto
           on .lp-nav-internal actually pushes it to the right.
           !important beats any LEAF global override. */
        ".lp-nav .lp-nav-in {",
        "  display: flex !important;",
        "  align-items: center !important;",
        "  width: 100%;",
        "}",

        /* ── Internal group container ───────────────────────────
           Sits as a flex sibling after .lp-nav-links.
           margin-left:auto is the sole mechanism that pushes it
           to the far right — no absolute positioning needed.
           The background container uses nav palette values so it
           reads as "part of the nav" but clearly distinct.
           It is non-interactive (role=presentation on the bg
           itself) — all WCAG contrast obligations are met by
           the text and icon elements inside, not the container. */
        ".lp-nav-internal {",
        "  display: flex;",
        "  align-items: center;",
        "  gap: 4px;",
        "  margin-left: auto;",
        "  flex-shrink: 0;",
        "  padding: 4px 10px 4px 8px;",
        "  background: #eff6fb;" /* --nav-hover-bg tint */,
        "  border: 1px solid #d9e8f6;" /* --nav-panel-bd */,
        "  border-radius: 8px;" /* --nav-r-lg */,
        "  box-shadow: inset 0 1px 2px rgba(0,10,60,0.04);" /* very subtle depth */,
        "}",

        /* ── 'Internal' text label ──────────────────────────────
           Visual-only — not a button. aria-hidden on the whole
           span so screen readers skip it (the nav landmark +
           button labels cover the context). */
        ".lp-internal-label {",
        "  display: inline-flex;",
        "  align-items: center;",
        "  gap: 3px;",
        "  font-family: inherit;",
        "  font-size: 0.72rem;",
        "  font-weight: 700;",
        "  letter-spacing: 0.06em;",
        "  text-transform: uppercase;",
        "  color: #3d4551;" /* --nav-muted — meets 4.5:1 on #eff6fb */,
        "  user-select: none;",
        "  white-space: nowrap;",
        "  padding: 0 2px;",
        "}",
        ".lp-internal-label-icon {",
        "  font-size: 13px !important;",
        "  line-height: 1;",
        "}",

        /* ── Vertical rule between label and buttons ────────────*/
        ".lp-internal-rule {",
        "  display: inline-block;",
        "  width: 1px;",
        "  height: 18px;",
        "  background: #aacdec;" /* --nav-border */,
        "  margin: 0 4px;",
        "  flex-shrink: 0;",
        "}",

        /* ── Shared button style (Leadership + LEAF Team) ───────
           Matches .dd-trigger shape exactly: border-radius 5px
           (--nav-r), no border, transparent background.
           The container background provides the visual distinction.
           Font values copied verbatim from .dd-trigger. */
        ".lp-internal-btn {",
        "  display: inline-flex;",
        "  align-items: center;",
        "  gap: 4px;",
        "  padding: 7px 13px;" /* matches .dd-trigger padding */,
        "  border-radius: 5px;" /* --nav-r */,
        "  border: none;",
        "  background: transparent;",
        "  color: #3d4551;" /* --nav-muted */,
        '  font-family: "Public Sans", sans-serif;',
        "  font-size: 0.9rem;",
        "  font-weight: 600;",
        "  text-decoration: none;",
        "  white-space: nowrap;",
        "  cursor: pointer;",
        "  transition: color 0.15s, background 0.15s;",
        "  line-height: 1.4;",
        "}",
        ".lp-internal-btn:hover {",
        "  background: #ffffff;",
        "  color: #005ea2;",
        "  text-decoration: none;",
        "}",
        ".lp-internal-btn:focus-visible {",
        "  outline: 3px solid #005ea2;",
        "  outline-offset: 2px;",
        "}",

        /* ── LEAF Team dropdown trigger (extends .lp-internal-btn) */
        ".lp-internal-btn--dd {",
        "  /* inherits all .lp-internal-btn rules */",
        "}",
        ".dd-item--internal.open .lp-internal-btn--dd {",
        "  background: #ffffff;",
        "  color: #005ea2;",
        "}",

        /* ── LEAF Team dropdown panel ───────────────────────────
           Positioned relative to dd-item--internal (inline-block
           parent). right:0 aligns panel's right edge to button's
           right edge so it doesn't bleed off screen. */
        ".dd-panel--internal {",
        "  right: 0;",
        "  left: auto;",
        "  min-width: 220px;",
        "  border-top: 3px solid #f59e0b;",
        "}",

        /* ── Loading placeholder row ────────────────────────────*/
        ".lp-internal-loading {",
        "  display: flex;",
        "  align-items: center;",
        "  gap: 6px;",
        "  padding: 10px 14px;",
        "  font-size: 0.85rem;",
        "  opacity: 0.55;",
        "  pointer-events: none;",
        "}",
        ".lp-internal-loading .material-symbols-outlined {",
        "  font-size: 16px !important;",
        "  animation: lp-spin 1s linear infinite;",
        "}",
        "@keyframes lp-spin { to { transform: rotate(360deg); } }",

        /* ── Icon FOUT prevention ────────────────────────────────
           Hide Material Symbols glyphs until the font is ready
           so the raw icon names never flash as plain text.
           The transition is only on the ready class so cached
           fonts snap in instantly; first-load gets a soft fade. */
        "#lpNav .material-symbols-outlined { opacity: 0; }",
        "#lpNav.lp-icons-ready .material-symbols-outlined { opacity: 1; transition: opacity 0.15s ease; }",

        /* ── Mobile: Internal section separator ─────────────── */
        ".lp-mobile-internal-sep {",
        "  display: flex;",
        "  align-items: center;",
        "  gap: 5px;",
        "  padding: 10px 16px 6px;",
        "  font-size: 0.72rem;",
        "  font-weight: 700;",
        "  letter-spacing: 0.07em;",
        "  text-transform: uppercase;",
        "  color: #3d4551;" /* --nav-muted — visible on white mobile panel */,
        "  border-top: 1px solid #d9e8f6;" /* --nav-panel-bd */,
        "  margin-top: 4px;",
        "}",
        ".lp-mobile-internal-sep .material-symbols-outlined {",
        "  font-size: 14px !important;",
        "}",

        /* ── Responsive: mirror leaf_nav.css breakpoint (640px) ──
           Desktop (≥641px): hide mobile accordion internal items.
           Mobile (≤640px): hide the desktop internal group;
             the accordion items handle internal links instead. */
        "@media (max-width: 640px) {",
        "  .lp-nav-internal { display: none !important; }",
        "}",
        "@media (min-width: 641px) {",
        "  .lp-internal-mobile-item { display: none !important; }",
        "}",
      ].join("\n");
      document.head.appendChild(style);
    }
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
     LEAF TEAM DYNAMIC LINKS
     Fetches quick-link records from the service_requests_launchpad
     form. Each record contributes:
       indicator LEAF_TEAM_LINK_NAME_INDICATOR_ID → link label
       indicator LEAF_TEAM_LINK_URL_INDICATOR_ID  → link href
     Populates #lpNavLeafTeamLinks (desktop) and
     #lpNavLeafTeamLinksMobile (mobile) after nav is in the DOM.
     Links rendered here use data-nav-external so the launchpad
     link intercept skips them — they navigate away rather than
     hash-routing.
     Silently no-ops if the containers aren't present (user isn't
     in LEAF_TEAM_GROUP_ID and Smarty never emitted the elements).
  ───────────────────────────────────────────────────────────── */
  function fetchLeafTeamLinks() {
    var desktopHost = document.getElementById("lpNavLeafTeamLinks");
    var mobileHost = document.getElementById("lpNavLeafTeamLinksMobile");
    if (!desktopHost && !mobileHost) return;

    /* Build query using the JSON-encoded ?q= format that LEAF's
       api/form/query endpoint actually expects. The query string
       param format (?q[0][id]=...) causes 500s — only LeafFormQuery
       uses that internally. Direct fetch must use encodeURIComponent
       on a stringified query object, matching CustomerOverview.html
       and project_v*.js patterns. */
    var queryObj = {
      terms: [
        { id: "categoryID", operator: "=", match: "form_531cc", gate: "AND" },
        { id: "stepID", operator: "=", match: "notDeleted", gate: "AND" },
      ],
      joins: [],
      sort: {},
      getData: [
        String(LEAF_TEAM_LINK_NAME_INDICATOR_ID),
        String(LEAF_TEAM_LINK_URL_INDICATOR_ID),
      ],
    };

    var apiUrl =
      LEAF_TEAM_FORM_BASE +
      "/api/form/query?q=" +
      encodeURIComponent(JSON.stringify(queryObj)) +
      "&format=json";

    var isDebug = /[?&]leafNavDebug=1/.test(window.location.search);

    if (isDebug) {
      console.group("[LP Nav Debug] fetchLeafTeamLinks");
      console.log("Fetch URL:", apiUrl);
      console.log("LEAF_TEAM_FORM_BASE:", LEAF_TEAM_FORM_BASE);
      console.log("window.location.origin:", window.location.origin);
      console.log("Query object:", JSON.stringify(queryObj, null, 2));
      console.log("#lpNavLeafTeamLinks in DOM:", !!desktopHost);
      console.log("#lpNavLeafTeamLinksMobile in DOM:", !!mobileHost);
    }

    fetch(apiUrl, {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "x-requested-with": "XMLHttpRequest",
      },
    })
      .then(function (r) {
        if (isDebug) {
          console.log("HTTP status:", r.status, r.statusText);
          console.log("Response URL (actual):", r.url);
        }
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        if (isDebug) {
          console.log("Raw response data:", data);
          console.log("Record count:", Object.keys(data).length);
          Object.entries(data).forEach(function (entry) {
            var id = entry[0],
              rec = entry[1];
            console.log(
              "Record " + id + ":",
              "name=" +
                (rec["s1"] &&
                  rec["s1"]["id" + LEAF_TEAM_LINK_NAME_INDICATOR_ID]),
              "url=" +
                (rec["s1"] &&
                  rec["s1"]["id" + LEAF_TEAM_LINK_URL_INDICATOR_ID]),
            );
          });
          console.groupEnd();
        }

        var records = Object.values(data);

        var itemsHTML = records
          .map(function (rec) {
            var name = rec["s1"]["id" + LEAF_TEAM_LINK_NAME_INDICATOR_ID] || "";
            var url = rec["s1"]["id" + LEAF_TEAM_LINK_URL_INDICATOR_ID] || "";
            if (!name || !url) return "";
            if (!/^https?:\/\//i.test(url)) return "";
            return (
              '<li><a class="dd-link" href="' +
              url +
              '" data-nav-external target="_blank" rel="noopener noreferrer">' +
              '<span class="dd-link-text"><strong>' +
              name +
              "</strong></span>" +
              '<span class="lp-sr-only">(opens in new tab)</span>' +
              "</a></li>"
            );
          })
          .join("");

        function populate(host) {
          if (!host) return;
          host.innerHTML =
            itemsHTML ||
            '<li class="lp-internal-loading" style="opacity:0.45;">' +
              '<span class="material-symbols-outlined" aria-hidden="true">link_off</span>' +
              "No links found</li>";
        }

        populate(desktopHost);
        populate(mobileHost);
      })
      .catch(function (err) {
        if (isDebug) {
          console.error("[LP Nav Debug] Fetch failed:", err);
          console.groupEnd();
        }
        console.warn("[LP Nav] LEAF Team links fetch failed:", err.message);
        function clearLoading(host) {
          if (!host) return;
          host.innerHTML =
            '<li class="lp-internal-loading" style="opacity:0.45;">' +
            '<span class="material-symbols-outlined" aria-hidden="true">cloud_off</span>' +
            "Links unavailable</li>";
        }
        clearLoading(desktopHost);
        clearLoading(mobileHost);
      });
  }

  /* ─────────────────────────────────────────────────────────────
     SMARTY / PHP WRAPPER DEBUG UTILITY
     Only runs when ALL of:
       1. ?leafNavDebug=1 is in the query string
       2. Smarty rendered the LEAF Team group check as true
          (i.e., the user is in LEAF_TEAM_GROUP_ID / group 12)
     Renders an amber dismissible banner + console group with:
       - Whether Smarty processed this file at all
       - Whether each group constant resolved to a real ID
       - Whether $empMembership evaluated (banner visible = yes)
  ───────────────────────────────────────────────────────────── */
  function runNavDebug() {
    /* Only show to LEAF Team members — the LEAF_TEAM_GROUP_ID
       constant is a Smarty-rendered value. If Smarty didn't run,
       it will still be the literal placeholder string. */
    var isLeafTeamMember =
      LEAF_TEAM_GROUP_ID !== "REPLACE_ME_LEAF_TEAM_GROUP_ID";

    /* Detect whether Smarty processed this file at all by checking
       if any constant still holds its literal placeholder. */
    var smartyRan = LEADERSHIP_GROUP_ID !== "REPLACE_ME_LEADERSHIP_GROUP_ID";
    var leadershipResolved =
      smartyRan && /^\d+$/.test(String(LEADERSHIP_GROUP_ID));
    var leafTeamResolved =
      LEAF_TEAM_GROUP_ID !== "REPLACE_ME_LEAF_TEAM_GROUP_ID" &&
      /^\d+$/.test(String(LEAF_TEAM_GROUP_ID));
    var nameIndResolved = Number.isInteger(LEAF_TEAM_LINK_NAME_INDICATOR_ID);
    var urlIndResolved = Number.isInteger(LEAF_TEAM_LINK_URL_INDICATOR_ID);

    /* Console output — always logged when param present, group check aside */
    console.group("[LEAF Nav Debug] Smarty/PHP wrapper diagnostics");
    console.log(
      "Smarty processed this file:",
      smartyRan ? "✅ YES" : "❌ NO — constants are still placeholder strings",
    );
    console.log(
      "LEADERSHIP_GROUP_ID resolved:",
      leadershipResolved
        ? "✅ " + LEADERSHIP_GROUP_ID
        : "❌ " + LEADERSHIP_GROUP_ID,
    );
    console.log(
      "LEAF_TEAM_GROUP_ID resolved:",
      leafTeamResolved
        ? "✅ " + LEAF_TEAM_GROUP_ID
        : "❌ " + LEAF_TEAM_GROUP_ID,
    );
    console.log(
      "LEAF_TEAM_LINK_NAME_INDICATOR_ID resolved:",
      nameIndResolved
        ? "✅ " + LEAF_TEAM_LINK_NAME_INDICATOR_ID
        : "❌ " + LEAF_TEAM_LINK_NAME_INDICATOR_ID,
    );
    console.log(
      "LEAF_TEAM_LINK_URL_INDICATOR_ID resolved:",
      urlIndResolved
        ? "✅ " + LEAF_TEAM_LINK_URL_INDICATOR_ID
        : "❌ " + LEAF_TEAM_LINK_URL_INDICATOR_ID,
    );
    console.log(
      "Current user in LEAF Team group (banner visible):",
      isLeafTeamMember ? "✅ YES" : "❌ NO",
    );
    console.log(
      "#lpNavLeafTeamLinks in DOM:",
      !!document.getElementById("lpNavLeafTeamLinks")
        ? "✅ YES"
        : "❌ NO (Smarty gated it out or group check failed)",
    );
    console.groupEnd();

    /* Visual banner — only shown to LEAF Team members */
    if (!isLeafTeamMember) return;

    var rows = [
      ["Smarty processed this file", smartyRan ? "✅ YES" : "❌ NO"],
      [
        "LEADERSHIP_GROUP_ID",
        leadershipResolved
          ? "✅ " + LEADERSHIP_GROUP_ID
          : "❌ still placeholder",
      ],
      [
        "LEAF_TEAM_GROUP_ID",
        leafTeamResolved ? "✅ " + LEAF_TEAM_GROUP_ID : "❌ still placeholder",
      ],
      [
        "LEAF_TEAM_LINK_NAME_INDICATOR_ID",
        nameIndResolved
          ? "✅ " + LEAF_TEAM_LINK_NAME_INDICATOR_ID
          : "❌ still placeholder",
      ],
      [
        "LEAF_TEAM_LINK_URL_INDICATOR_ID",
        urlIndResolved
          ? "✅ " + LEAF_TEAM_LINK_URL_INDICATOR_ID
          : "❌ still placeholder",
      ],
      [
        "$empMembership evaluated (you see this)",
        "✅ YES — you are in LEAF Team group",
      ],
      [
        "#lpNavLeafTeamLinks in DOM",
        document.getElementById("lpNavLeafTeamLinks") ? "✅ YES" : "❌ NO",
      ],
    ];

    var rowHTML = rows
      .map(function (r) {
        return (
          "<tr>" +
          '<td style="padding:3px 10px 3px 0;font-weight:600;white-space:nowrap;">' +
          r[0] +
          "</td>" +
          '<td style="padding:3px 0;">' +
          r[1] +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    var banner = document.createElement("div");
    banner.id = "lpNavDebugBanner";
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-label", "LEAF Nav debug panel");
    banner.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "right:0",
      "z-index:99999",
      "background:#fffbeb",
      "border-bottom:3px solid #f59e0b",
      "padding:12px 16px",
      "font-family:monospace",
      "font-size:13px",
      "color:#1c1917",
      "box-shadow:0 2px 8px rgba(0,0,0,.15)",
    ].join(";");

    banner.innerHTML =
      '<div style="display:flex;align-items:flex-start;gap:12px;">' +
      '<span class="material-symbols-outlined" aria-hidden="true" style="font-size:20px;color:#d97706;flex-shrink:0;margin-top:2px;">bug_report</span>' +
      '<div style="flex:1;">' +
      '<strong style="display:block;margin-bottom:6px;">LEAF Nav — Smarty/PHP Debug <span style="font-weight:400;color:#78716c;">(visible to LEAF Team only · remove ?leafNavDebug=1 to hide)</span></strong>' +
      "<table>" +
      rowHTML +
      "</table>" +
      "</div>" +
      "<button onclick=\"document.getElementById('lpNavDebugBanner').remove()\" " +
      'style="background:none;border:none;cursor:pointer;font-size:18px;line-height:1;padding:0;color:#78716c;" ' +
      'aria-label="Dismiss debug banner">' +
      '<span class="material-symbols-outlined" aria-hidden="true">close</span>' +
      "</button>" +
      "</div>";

    /* Push page content down so banner doesn't overlap nav */
    document.body.style.paddingTop =
      "calc(" + (document.body.style.paddingTop || "0px") + " + 110px)";
    document.body.insertBefore(banner, document.body.firstChild);
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
    ensureJumpToTop();

    /* Populate LEAF Team dynamic links after the nav is in the DOM */
    fetchLeafTeamLinks();

    /* Reveal icons once the Material Symbols font is loaded.
       fonts.ready resolves immediately when fonts are cached,
       so repeat visits get no perceptible delay. */
    document.fonts.ready.then(function () {
      var nav = document.getElementById("lpNav");
      if (nav) nav.classList.add("lp-icons-ready");
    });

    /* Debug panel — only when ?leafNavDebug=1 is present */
    if (/[?&]leafNavDebug=1/.test(window.location.search)) {
      runNavDebug();
    }
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

  /* Guard: tracks dep URLs already injected so ensureLeafUIDeps
     never logs or re-injects on repeated mountContent calls. */
  var _loadedDepSrcs = new Set();

  /* Guard: URL currently being fetched — prevents stacked concurrent
     loadView calls for the same or a rapid-fire different route. */
  var _currentLoadUrl = null;

  /* Guard: suppresses the hashchange → router() path while deferred
     init functions are draining, preventing any hash side-effect
     inside those inits from re-triggering a full navigation. */
  var _routerSuppressed = false;

  /* Scripts that must never re-execute inside a fetched page context.
     Shell-level scripts (nav, breadcrumb) manage the outer document —
     re-running them injects duplicate elements and undoes router state. */
  var SCRIPT_BLOCKLIST = [
    "leaf_nav",
    "leaf_breadcrumb",
    "leaf-nav",
    "leaf-breadcrumb",
  ];

  function isBlocklistedScript(src) {
    return SCRIPT_BLOCKLIST.some(function (term) {
      return src.indexOf(term) > -1;
    });
  }

  /* ─────────────────────────────────────────────────────────────
     DEPENDENCY LAZY-LOADER
     Some fetched pages (Help Library, Form Library) require jQuery
     UI and dialogController.js which aren't on the launchpad page.
     loadScriptSequential() injects them into <head> in order,
     waiting for each load event before proceeding.
     ensureLeafUIDeps() scans the fetched document's <script> tags,
     detects which deps are needed, and loads only what's missing.
  ───────────────────────────────────────────────────────────── */
  function loadScriptSequential(srcs) {
    /* Returns a promise that resolves after all srcs are loaded in order */
    return srcs.reduce(function (chain, src) {
      return chain.then(function () {
        return new Promise(function (resolve, reject) {
          /* Already in DOM — skip */
          if (document.querySelector('script[src="' + src + '"]')) {
            resolve();
            return;
          }
          var s = document.createElement("script");
          s.src = src;
          s.async = false;
          s.onload = resolve;
          s.onerror = function () {
            console.warn("[LP] Failed to load dependency:", src);
            resolve(); /* resolve anyway so remaining scripts still run */
          };
          document.head.appendChild(s);
        });
      });
    }, Promise.resolve());
  }

  /* Known external dependencies that fetched-page inline scripts may
     assume are already loaded and executed. Each entry's `test` regex
     is matched against every external <script src> found in the fetched
     document. Add new deps here — do NOT rely on reExecuteScripts()'s
     generic script loop for anything an inline script calls synchronously;
     that loop appends external <script src> tags to <head> but does not
     await their load/execution before running the next script, so any
     inline script depending on one can race it (see VAFacilityHelper
     "is not defined" errors on fetched pages that need it). */
  var LEAF_UI_DEP_PATTERNS = [
    { name: "jquery-ui", test: /jquery-ui/i },
    { name: "dialogController", test: /dialogController/i },
    { name: "VAFacilityHelper", test: /VAFacilityHelper/i },
  ];

  /* Scans a document for known dependency <script src> tags and returns
     the matched, absolute URLs. Must be called BEFORE suppressChrome()
     strips #header/#footer/.noprint — those regions are exactly where
     LEAF's shared global helpers (e.g. VAFacilityHelper.js) tend to be
     included from, and once suppressChrome removes those nodes the
     script is gone for good, so this has to run first. */
  function collectLeafUIDepSrcs(doc) {
    var scriptSrcs = Array.prototype.map.call(
      doc.querySelectorAll("script[src]"),
      function (s) {
        return s.src;
      } /* already absolute after DOMParser */,
    );

    var found = [];
    LEAF_UI_DEP_PATTERNS.forEach(function (dep) {
      var src = scriptSrcs.find(function (s) {
        return dep.test.test(s);
      });
      if (src) found.push(src);
    });
    return found;
  }

  function ensureLeafUIDeps(depScriptSrcs) {
    var toLoad = (depScriptSrcs || []).filter(function (src) {
      return !_loadedDepSrcs.has(src);
    });

    if (!toLoad.length) return Promise.resolve();

    console.warn("[LP] Lazy-loading LEAF UI deps for fetched page:", toLoad);
    return loadScriptSequential(toLoad).then(function () {
      toLoad.forEach(function (src) {
        _loadedDepSrcs.add(src);
      });
    });
  }

  function reExecuteScripts(container) {
    /* NOTE: reExecuteScripts is now called AFTER ensureLeafUIDeps()
       resolves, so jQuery UI is guaranteed available when inline
       scripts that call $(...).dialog() run. */
    var scripts = Array.prototype.slice.call(
      container.querySelectorAll("script"),
    );

    scripts.forEach(function (oldScript) {
      if (
        oldScript.textContent &&
        oldScript.textContent.indexOf("document.write") > -1
      ) {
        console.warn("[LP] Skipped script containing document.write");
        return;
      }

      if (oldScript.src) {
        var src = oldScript.src;
        if (isBlocklistedScript(src)) return;
        if (_seenExternalScripts[src]) return;
        _seenExternalScripts[src] = true;

        var newScript = document.createElement("script");
        newScript.src = src;
        newScript.async = false;
        if (oldScript.type) newScript.type = oldScript.type;
        document.head.appendChild(newScript);
      } else if (oldScript.textContent && oldScript.textContent.trim()) {
        try {
          /* Pass a mock location reflecting the route URL so any
             script that reads location.search, location.href, or
             location.pathname gets the fetched page's URL rather
             than the launchpad's URL. This prevents "undefined"
             appearing in search fields that initialise from URL params.

             Also pass a mock document that overrides readyState to
             "loading" so fetched pages that gate their init on
             readyState (e.g. ideas_v2.js) take the DOMContentLoaded
             listener path rather than calling initPortal() immediately
             before the content is in the DOM.

             DOMContentLoaded listeners registered on mockDoc are
             captured in window.__lpDeferredInits and drained after
             mount — NOT dispatched as a real DOMContentLoaded event,
             which would retrigger the nav's own init and cause an
             infinite re-mount loop. */
          window.__lpDeferredInits = window.__lpDeferredInits || [];

          var mockDoc = new Proxy(document, {
            get: function (target, prop, receiver) {
              if (prop === "readyState") return "loading";
              if (prop === "addEventListener") {
                return function (type, fn, opts) {
                  if (type === "DOMContentLoaded") {
                    /* Capture for deferred drain — never register on real document */
                    window.__lpDeferredInits.push(fn);
                  } else {
                    document.addEventListener(type, fn, opts);
                  }
                };
              }
              var value = target[prop];
              /* Native methods must stay bound to the real document —
                 returning them unbound through the Proxy's receiver
                 reintroduces the same "Illegal invocation" failure. */
              if (typeof value === "function") {
                return value.bind(target);
              }
              return value;
            },
          });

          /* mockLocation: intercepts navigation calls from re-executed inline
             scripts so that links/buttons using location.href = url,
             location.assign(url), or location.replace(url) inside fetched
             pages hash-route to known routes instead of navigating away.
             Unknown URLs (external links, non-LEAF pages) fall through to
             the real window.location so normal navigation still works.
             NOTE: scripts that use window.location.href (not the local
             location binding) bypass this mock and navigate normally — that
             is intentional; only inline scripts using the location parameter
             are intercepted. */
          function _lpNavigate(url) {
            if (!url) return;
            var key = hrefToHashKey(url);
            if (key && ROUTE_MAP[key]) {
              /* Known route → hash-route it (triggers router via hashchange) */
              var newHash = "#" + key;
              if (window.location.hash === newHash) {
                /* Same hash already set — fire router manually */
                router();
              } else {
                window.location.hash = newHash;
              }
            } else {
              /* Unknown route → let the browser navigate normally */
              window.location.href = url;
            }
          }

          var _mockLocationHref = window.__lpRouteHref || window.location.href;
          var mockLocation = {
            search: window.__lpRouteSearch || "",
            pathname: window.__lpRouteHref
              ? window.__lpRouteHref.split("?")[0]
              : window.location.pathname,
            hash: "",
            origin: window.location.origin,
            host: window.location.host,
            hostname: window.location.hostname,
            protocol: window.location.protocol,
            reload: function () {
              window.location.reload();
            },
            assign: function (url) {
              _lpNavigate(url);
            },
            replace: function (url) {
              _lpNavigate(url);
            },
            toString: function () {
              return _mockLocationHref;
            },
          };
          Object.defineProperty(mockLocation, "href", {
            get: function () {
              return _mockLocationHref;
            },
            set: function (url) {
              _lpNavigate(url);
            },
            enumerable: true,
            configurable: true,
          });
          /* Wrap the real window so that window.location.href = url
             and window.location.assign/replace() in re-executed scripts
             are also intercepted — not just the local `location` binding.
             All other window properties fall through to the real window. */
          var mockWindow = new Proxy(window, {
            get: function (target, prop) {
              if (prop === "location") return mockLocation;
              var val = target[prop];
              return typeof val === "function" ? val.bind(target) : val;
            },
            set: function (target, prop, value) {
              if (prop === "location") {
                _lpNavigate(String(value));
                return true;
              }
              target[prop] = value;
              return true;
            },
          });

          var fn = new Function(
            "document",
            "window",
            "location",
            oldScript.textContent,
          );
          fn(mockDoc, mockWindow, mockLocation);
        } catch (err) {
          console.warn("[LP] Inline script execution error:", err.message);
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

  /* ── Suggested links for the "missing route" error state ────────
     One item per top-level NAV_SECTIONS group (the first non-"#" href
     in each), so the list stays in sync with NAV_SECTIONS automatically
     rather than needing a second hand-maintained list. Rendered as
     .dd-link buttons with data-href so wireLinkIntercept() (already
     listens for .dd-link clicks) hash-routes them with no extra wiring. */
  function buildErrorSuggestedLinksHTML() {
    var items = NAV_SECTIONS.map(function (section) {
      return section.items.find(function (item) {
        return item.href && item.href !== "#" && !item.hidden;
      });
    }).filter(Boolean);

    return items
      .map(function (item) {
        return (
          '<button class="dd-link lp-error-suggest-link" data-href="' +
          item.href +
          '" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #d9e8f6;border-radius:5px;font-size:13px;">' +
          '<span class="material-symbols-outlined" aria-hidden="true" style="font-size:16px;">' +
          item.icon +
          "</span>" +
          "<span>" +
          item.title +
          "</span>" +
          "</button>"
        );
      })
      .join("");
  }

  /* ── Error state ──────────────────────────────────────────────
     Two distinct causes get two distinct messages + recovery paths:
       "missing" — hash has no ROUTE_MAP entry (a true 404, e.g. an
                   old bookmark to a since-renamed hash key). No
                   retry makes sense here; offer a way out instead.
       "fetch"   — route exists but the request failed (network
                   error, non-2xx, empty content). Likely transient;
                   offer retry + open-in-new-tab.
     `url` is the route's href — used for the retry/new-tab actions
     on the "fetch" state; unused (may be null) for "missing". */
  function showSwapError(url, reason) {
    var host = getSwapHost();
    if (!host) return;

    /* showSwapLoading() is normally what clears this on the way in —
       but the "missing route" path (no ROUTE_MAP entry) never calls
       showSwapLoading(), so the host stayed hidden even though this
       function wrote content into it. Clear it here unconditionally
       so showSwapError() is correct no matter what ran before it. */
    host.removeAttribute("hidden");

    if (reason === "missing") {
      host.innerHTML =
        '<div class="lp-swap-error lp-swap-error--missing" role="alert" style="text-align:center;padding:2rem 1.5rem;">' +
        '<span class="material-symbols-outlined lp-swap-error-ico" aria-hidden="true" style="font-size:32px;color:#6b7280;">wrong_location</span>' +
        '<p class="lp-swap-error-msg" style="font-weight:600;font-size:16px;margin:12px 0 4px;">This page doesn\'t exist</p>' +
        '<p style="font-size:13px;color:#6b7280;margin:0 0 20px;">It may have moved or the link is outdated.</p>' +
        '<div style="display:flex;justify-content:center;margin-bottom:24px;">' +
        '<button class="lp-panel-link btn btn-primary" data-href="report.php?a=launchpad">' +
        '<span class="material-symbols-outlined" aria-hidden="true">home</span> Back to Launchpad' +
        "</button>" +
        "</div>" +
        '<div style="border-top:1px solid #d9e8f6;padding-top:16px;text-align:left;max-width:420px;margin:0 auto;">' +
        '<p style="font-size:12px;color:#9ca3af;margin:0 0 8px;">Try one of these instead</p>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
        buildErrorSuggestedLinksHTML() +
        "</div>" +
        "</div>" +
        "</div>";
      return;
    }

    /* "fetch" (default/fallback) */
    host.innerHTML =
      '<div class="lp-swap-error lp-swap-error--fetch" role="alert" style="text-align:center;padding:2rem 1.5rem;">' +
      '<span class="material-symbols-outlined lp-swap-error-ico" aria-hidden="true" style="font-size:32px;color:#b45309;">cloud_off</span>' +
      '<p class="lp-swap-error-msg" style="font-weight:600;font-size:16px;margin:12px 0 4px;">This page is temporarily unavailable</p>' +
      '<p style="font-size:13px;color:#6b7280;margin:0 0 20px;">We reached the site but couldn\'t load the content. This is usually temporary.</p>' +
      '<div style="display:flex;gap:8px;justify-content:center;">' +
      '<button class="lp-panel-link btn btn-primary" data-href="' +
      url +
      '">' +
      '<span class="material-symbols-outlined" aria-hidden="true">refresh</span> Try again' +
      "</button>" +
      '<a class="lp-swap-error-link btn btn-sec" href="' +
      url +
      '" target="_blank" rel="noopener noreferrer">' +
      '<span class="material-symbols-outlined" aria-hidden="true">open_in_new</span>' +
      "Open in a new tab" +
      "</a>" +
      "</div>" +
      "</div>";
  }

  /* ─────────────────────────────────────────────────────────────
     ELEMENT CACHE
     Resolved once at router init. Using cached references means
     show/hide never relies on getElementById — so ID reassignment
     can never break visibility toggling. IDs never change after init.
  ───────────────────────────────────────────────────────────── */
  var _lpMain = null; /* launchpad home <main id="lp-main"> */
  var _swapHost = null; /* swap container [data-lp-swap-host] */

  function initElementCache() {
    _lpMain = document.getElementById("lp-main");
    _swapHost =
      document.querySelector("[data-lp-swap-host]") ||
      document.getElementById("lpSwapHost");
  }

  /* ─────────────────────────────────────────────────────────────
     SHOW / HIDE
     Explicit inline display style beats any stylesheet rule,
     including LEAF's own overrides. IDs never change — the skip
     link always targets #lp-main (home) or #lpSwapHost (fetched).
  ───────────────────────────────────────────────────────────── */
  function showLaunchpadHome() {
    if (_lpMain) _lpMain.style.display = "";
    if (_swapHost) {
      _swapHost.style.display = "none";
      _swapHost.innerHTML = "";
    }

    /* Remove the route base tag so the launchpad's own relative
       paths aren't affected when returning to the home view */
    var routeBase = document.getElementById("lp-route-base");
    if (routeBase) routeBase.remove();
    window.__lpRouteHref = "";
    window.__lpRouteSearch = "";

    /* Skip link → home */
    var skip = document.getElementById("lp-skip-nav");
    if (skip) skip.href = "#lp-main";

    document.title = "LEAF Launchpad";
    announce("Returned to Launchpad home");
    updateNavCurrent(null);
  }

  function showSwapView() {
    if (_lpMain) _lpMain.style.display = "none";
    if (_swapHost) _swapHost.style.display = "";

    /* Skip link → fetched content */
    var skip = document.getElementById("lp-skip-nav");
    if (skip) skip.href = "#lpSwapHost";
  }

  /* ─────────────────────────────────────────────────────────────
     BREADCRUMB
     Rendered directly into the top of the swap host on every
     view load — no dependency on leaf_breadcrumb.js timing.
     Trail: LEAF Launchpad → [Section] → [Page Title]
  ───────────────────────────────────────────────────────────── */
  function buildBreadcrumbHTML(route) {
    /* Matches leaf_breadcrumb.js output exactly — flat children inside
       <nav class="lp-breadcrumb">, same .lp-bc-sep and .lp-bc-current
       spans, so leaf_breadcrumb.css styles it without any extra rules. */
    var trail = [
      { label: "Launchpad", href: "/launchpad/report.php?a=lp_home" },
    ];
    if (route) {
      if (route.section) trail.push({ label: route.section, href: null });
      if (route.parent)
        trail.push({ label: route.parent.label, href: route.parent.href });
      trail.push({ label: route.title, href: null, current: true });
    }

    var inner = trail
      .map(function (crumb, i) {
        var isLast = i === trail.length - 1;
        var sep =
          i > 0 ? '<span class="lp-bc-sep" aria-hidden="true">/</span>' : "";
        var node =
          isLast || !crumb.href
            ? '<span class="lp-bc-current" aria-current="page">' +
              crumb.label +
              "</span>"
            : '<a href="' + crumb.href + '">' + crumb.label + "</a>";
        return sep + node;
      })
      .join("");

    return (
      '<nav class="lp-breadcrumb" id="lpBreadcrumb" aria-label="Breadcrumb">' +
      inner +
      "</nav>"
    );
  }

  /* ─────────────────────────────────────────────────────────────
     MOUNT CONTENT
  ───────────────────────────────────────────────────────────── */
  function mountContent(el, sourceDoc, route, depScriptSrcs) {
    var host = _swapHost;
    if (!host) {
      console.error("[LP] mountContent: swap host not found");
      return;
    }

    /* ── Base URL injection ───────────────────────────────────────
       Fetched pages (Ideas, Help Library, etc.) make relative API
       calls like ./api/form/query. When their scripts re-execute
       inside the launchpad document, those relative URLs resolve
       against the launchpad's own URL instead of the fetched page's
       origin — causing 404s and empty data.

       Fix: inject a <base href> into <head> pointing to the fetched
       page's directory BEFORE reExecuteScripts() runs, so all
       relative fetch/XHR calls inside injected scripts resolve
       correctly. A <base> inside a <div> is invalid and ignored by
       browsers — it must be in <head>.

       We remove the previous route's <base> first, then add the new
       one. On return to launchpad home the base is removed entirely
       so the launchpad's own relative paths aren't affected.

       Derived from route.href:
         /platform/projects/report.php?a=ideas
         → base href: https://leaf.va.gov/platform/projects/
    ───────────────────────────────────────────────────────────── */
    var existingBase = document.getElementById("lp-route-base");
    if (existingBase) existingBase.remove();

    if (route && route.href) {
      var routeHref = route.href;
      var dir;
      if (/^https?:\/\//i.test(routeHref)) {
        /* Already absolute — strip filename+query to get directory.
           e.g. https://leaf.va.gov/platform/help_library/report.php?a=x
                → https://leaf.va.gov/platform/help_library/           */
        dir = routeHref.replace(/[^/]*(\?.*)?$/, "") || "/";
      } else {
        /* Relative path — prepend origin.
           e.g. /platform/projects/report.php?a=ideas
                → https://leaf.va.gov/platform/projects/               */
        var relDir = routeHref.replace(/[^/]*(\?.*)?$/, "") || "/";
        dir = window.location.origin + relDir;
      }
      var newBase = document.createElement("base");
      newBase.id = "lp-route-base";
      newBase.href = dir;
      document.head.insertBefore(newBase, document.head.firstChild);
    }

    /* Expose the route's original URL on window so fetched page scripts
       that read window.location.search or URL params get the right values
       instead of the launchpad's own URL params (which would be empty or
       wrong, causing "undefined" to appear in search fields). */
    window.__lpRouteHref = route ? route.href : "";
    window.__lpRouteSearch =
      route && route.href.indexOf("?") > -1
        ? "?" + route.href.split("?")[1]
        : "";

    /* Breadcrumb bar above content */
    var bc = document.createElement("div");
    bc.innerHTML = buildBreadcrumbHTML(route);

    /* Content wrapper */
    var wrapper = document.createElement("div");
    wrapper.className = "lp-swap-content";
    while (el.firstChild) {
      wrapper.appendChild(el.firstChild);
    }

    host.innerHTML = "";
    host.appendChild(bc.firstElementChild);
    host.appendChild(wrapper);

    /* Lazy-load any LEAF UI dependencies the fetched page needs
       (e.g. jquery-ui, dialogController, VAFacilityHelper) before
       re-executing its inline scripts. depScriptSrcs was scanned in
       loadView() BEFORE chrome suppression, so deps that live inside
       #header/#footer/.noprint are still caught. reExecuteScripts
       runs only after all deps load. */
    ensureLeafUIDeps(depScriptSrcs).then(function () {
      reExecuteScripts(wrapper);

      /* After scripts run, call any deferred page init functions.
         Fetched pages that gate on readyState (e.g. ideas_v2.js) have
         their inline scripts executed with mockDoc.readyState="loading"
         so they register their init as a DOMContentLoaded listener on
         the real document instead of calling it immediately.

         We do NOT dispatch a synthetic DOMContentLoaded — that would
         retrigger the nav's own DOMContentLoaded listener and cause
         an infinite re-mount loop.

         Instead, we maintain a registry: each fetched page's inline
         script can push to window.__lpDeferredInits, and we drain
         that queue here after mount. ideas_v2.js and similar pages
         register via document.addEventListener('DOMContentLoaded', fn)
         which we intercept via the mockDoc proxy. */
      setTimeout(function () {
        if (window.__lpDeferredInits && window.__lpDeferredInits.length) {
          _routerSuppressed = true;
          var inits = window.__lpDeferredInits.splice(0);
          inits.forEach(function (fn) {
            try {
              fn();
            } catch (e) {
              console.warn("[LP] Deferred init error:", e.message);
            }
          });
          /* Re-enable router after any sync hash side-effects settle */
          setTimeout(function () {
            _routerSuppressed = false;
          }, 0);
        }
      }, 0);
    });

    /* Update document title */
    var fetchedTitle = sourceDoc.title;
    if (fetchedTitle) document.title = fetchedTitle;

    /* Announce view change to screen readers */
    announce(
      (route && route.title ? route.title : fetchedTitle || "Page") + " loaded",
    );

    /* Move focus to swap host */
    host.focus();
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
      showSwapView();
      showSwapError(null, "missing");
      announce("This page doesn't exist.");
      return;
    }

    var url = route.href;

    /* Prevent stacked fetches: if this URL is already in-flight, bail. */
    if (_currentLoadUrl === url) return;
    _currentLoadUrl = url;

    showSwapView();
    showSwapLoading();
    updateNavCurrent(route.section);

    fetch(url, {
      credentials: "include",
      headers: {
        /* Tell LEAF this is a normal browser navigation, not an AJAX
           call. Without Accept: text/html some LEAF pages detect the
           fetch and serve a stripped / read-only response. */
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Cache-Control": "no-cache",
      },
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

        /* Scan for known external UI/helper dependencies BEFORE chrome
           suppression runs. Some LEAF pages (e.g. steph_search) load
           helpers like VAFacilityHelper.js from inside the header
           include — suppressChrome() deletes #header/#footer/.noprint
           wholesale, so if we scanned afterward (as ensureLeafUIDeps
           used to, via the already-stripped doc) that <script src>
           would already be gone and the dep would silently never load,
           leaving content scripts to throw "X is not defined". */
        var depScriptSrcs = collectLeafUIDepSrcs(doc);

        /* Suppress chrome elements in the parsed document */
        suppressChrome(doc);

        /* Extract content zone */
        var contentEl = extractContent(doc);

        if (!contentEl || contentEl.innerHTML.trim().length === 0) {
          throw new Error("Content extraction returned empty result");
        }

        /* Mount into swap host */
        mountContent(contentEl, doc, route, depScriptSrcs);
        _currentLoadUrl = null;

        /* Scroll swap host to top */
        var host = getSwapHost();
        if (host) host.scrollTop = 0;
        window.scrollTo(0, 0);
      })
      .catch(function (err) {
        _currentLoadUrl = null;
        console.error("[LP Router] Fetch failed for", url, ":", err.message);
        showSwapError(url, "fetch");
        announce(
          "This page is temporarily unavailable. Try again or open it in a new tab.",
        );
      });
  }

  /* ─────────────────────────────────────────────────────────────
     ROUTER
     Reads window.location.hash and dispatches to the right view.
     Called on init and on every hashchange event.
  ───────────────────────────────────────────────────────────── */
  function router() {
    /* Bail if suppressed during deferred-init drain to prevent
       hash side-effects inside init functions re-triggering navigation. */
    if (_routerSuppressed) return;

    var raw = window.location.hash; /* e.g. "#find_site" or "" */
    var key = raw.replace(/^#/, "").toLowerCase();

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
      /* ── Plain <a href> links inside fetched page content ───────────
         Nav buttons (.dd-link etc.) use data-href and are caught below.
         Links inside loaded pages are regular <a> tags — they bypass
         the nav-button check entirely and trigger full page navigation.
         Intercept them here: if the href maps to a known ROUTE_MAP entry,
         push the hash. Unknown hrefs (external, in-page anchors, API
         paths) fall through and the browser handles them normally. */
      var contentLink = e.target.closest("[data-lp-swap-host] a[href]");
      if (contentLink && !contentLink.hasAttribute("data-nav-external")) {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
          /* modifier-key clicks open a real tab — don't intercept */
        } else {
          var contentHref = contentLink.getAttribute("href");
          if (contentHref && contentHref !== "#") {
            var contentKey = hrefToHashKey(contentHref);
            if (contentKey && ROUTE_MAP[contentKey]) {
              e.preventDefault();
              var contentHash = "#" + contentKey;
              if (window.location.hash === contentHash) {
                router();
              } else {
                window.location.hash = contentHash;
              }
              return;
            }
            /* Not a known route — let browser navigate normally */
          }
        }
      }

      /* Match nav dropdown links, internal buttons, and footer quick-resource links.
         .dd-link elements are now <button data-href> — no href attribute —
         so the browser status bar never previews the destination URL on hover.
         .lp-internal-btn elements (Leadership) also use data-href.
         .dd-link[data-nav-external] are <a> tags (LEAF Team links) — left alone. */
      var link = e.target.closest(".dd-link, .lp-panel-link, .lp-internal-btn");
      if (!link) return;

      /* External-flagged <a> links (LEAF Team quick-links) navigate away normally */
      if (link.hasAttribute("data-nav-external")) return;

      /* Modifier-key / middle-click → real new tab, no intercept */
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
        return;
      }

      /* Read href from data-href (buttons) or href attribute (legacy <a> fallback) */
      var href = link.getAttribute("data-href") || link.getAttribute("href");
      if (!href || href === "#") return;

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
    /* Cache element references once — used by show/hide throughout */
    initElementCache();

    /* hashchange drives back/forward navigation */
    window.addEventListener("hashchange", function () {
      router();
    });

    /* Wire link intercept (replaces Option A panel opener) */
    wireLinkIntercept();

    /* Run router on init to handle deep-linked URLs */
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

  /* ─────────────────────────────────────────────────────────────
     JUMP TO TOP
     Injected once by the nav so every page that loads leaf_nav.js
     gets the button automatically — no per-page markup needed.

     Scroll container: window is ALWAYS used. #lpSwapHost has no
     overflow set in launchpad.css, so fetched content scrolls the
     window — not the element itself. Calling swapHost.scrollTo()
     on an element without overflow silently no-ops, which was the
     original bug.

     Click handler uses belt-and-suspenders scrolling so it works in
     VA iframe contexts and browsers that silently ignore
     { behavior: "smooth" }:
       1. document.documentElement.scrollTop = 0  (immediate, universal)
       2. document.body.scrollTop = 0             (Safari fallback)
       3. window.scrollTo({ top:0, behavior:'smooth' })  (progressive)
  ───────────────────────────────────────────────────────────── */
  function ensureJumpToTop() {
    if (document.getElementById("leaf-jump-top")) return;

    var btn = document.createElement("button");
    btn.id = "leaf-jump-top";
    btn.type = "button";
    btn.setAttribute("aria-label", "Back to top");
    btn.setAttribute("aria-hidden", "true");
    btn.tabIndex = -1;
    btn.innerHTML =
      '<span class="material-symbols-outlined" aria-hidden="true">arrow_upward</span>';
    document.body.appendChild(btn);

    function update() {
      var top =
        window.pageYOffset ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0;
      var vis = top > 120;
      btn.classList.toggle("lp-jump-vis", vis);
      btn.setAttribute("aria-hidden", String(!vis));
      btn.tabIndex = vis ? 0 : -1;
    }

    btn.addEventListener("click", function () {
      /* Direct assignment first — works in all environments including
         VA iframe contexts where window.scrollTo may be silently ignored. */
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      try {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (e) {}
    });

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
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

    /* Covers both public .dd-trigger buttons and the internal .dd-trigger--internal */
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
