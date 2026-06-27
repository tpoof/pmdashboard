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

  /* Base URL for the LEAF form that stores LEAF Team quick-links. */
  var LEAF_TEAM_FORM_BASE = "/platform/service_requests_launchpad";

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
          href: "/platform/designs/report.php?a=impact",
        },
        {
          icon: "route",
          title: "Roadmap",
          desc: "What's coming to LEAF",
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
          desc: "Explore real workflows from teams across the VA",
          href: "#",
        },
        {
          icon: "description",
          title: "Form Library",
          desc: "Forms and templates built by VA teams",
          href: "/platform/designs/report.php?a=form_library",
        },
        {
          icon: "cable",
          title: "Integrations",
          desc: "Connect LEAF to other systems and tools",
          href: "#",
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
          href: "/platform/designs/report.php?a=find_site",
        },
        { divider: true },
        {
          icon: "menu_book",
          title: "Help Library",
          desc: "Guides and documentation",
          href: "https://leaf.va.gov/platform/help_library/report.php?a=stephanie_test1",
        },
        {
          icon: "group",
          title: "Community of Practice",
          desc: "Connect with LEAF users VA-wide",
          href: "/platform/CoP/report.php?a=test_homepage",
        },
        {
          icon: "lightbulb",
          title: "Suggest an Idea",
          desc: "Submit an idea to improve LEAF",
          href: "/platform/ideas/report.php?a=v3",
        },
      ],
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
    /* Register Leadership so the hash router can load it inline */
    var leadershipKey = hrefToHashKey(INTERNAL_LEADERSHIP_ROUTE.href);
    if (leadershipKey) {
      ROUTE_MAP[leadershipKey] = INTERNAL_LEADERSHIP_ROUTE;
    }
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
  <a class="lp-internal-btn" href="/platform/projects/report.php?a=leadership">
    Leadership
  </a>
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
  <a class="dd-link" href="/platform/projects/report.php?a=leadership">
    <span class="dd-link-ico">
      <span class="material-symbols-outlined" aria-hidden="true">groups</span>
    </span>
    <span class="dd-link-text">
      <strong>Leadership</strong>
      <span>Platform leadership dashboard</span>
    </span>
  </a>
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
  /* Hardcoded path — CSS filename is always leaf_nav.css regardless
     of what version filename this JS is deployed as (leaf_nav_v2.js,
     leaf_nav_v3.js, etc.). Update this constant if the CSS ever moves. */
  var LEAF_NAV_CSS_HREF = "/platform/designs/files/leaf_nav.css";
  var LEAF_BREADCRUMB_CSS_HREF = "/platform/designs/files/leaf_breadcrumb.css";

  function ensureStylesheet() {
    /* Nav CSS — hardcoded so it loads correctly regardless of JS filename */
    if (
      !document.querySelector(
        'link[href*="leaf_nav.css"], link[href*="leaf-nav.css"]',
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
    if (!document.querySelector('link[href*="leaf_breadcrumb.css"]')) {
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
    if (!desktopHost && !mobileHost) return; /* group not met — nothing to do */

    var apiUrl =
      LEAF_TEAM_FORM_BASE +
      "/api/form/query" +
      "?q[0][id]=categoryID&q[0][operator]==&q[0][operand]=form_531cc" +
      "&indicators[]=" +
      LEAF_TEAM_LINK_NAME_INDICATOR_ID +
      "&indicators[]=" +
      LEAF_TEAM_LINK_URL_INDICATOR_ID +
      "&format=json";

    fetch(apiUrl, { credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        var records = Object.values(data);

        /* Build link items — filter out records with missing/bad data */
        var itemsHTML = records
          .map(function (rec) {
            var name = rec["s1"]["id" + LEAF_TEAM_LINK_NAME_INDICATOR_ID] || "";
            var url = rec["s1"]["id" + LEAF_TEAM_LINK_URL_INDICATOR_ID] || "";
            if (!name || !url) return "";
            if (!/^https?:\/\//i.test(url)) return "";
            return (
              '<li><a class="dd-link" href="' +
              url +
              '" data-nav-external>' +
              '<span class="dd-link-ico"><span class="material-symbols-outlined" aria-hidden="true">open_in_new</span></span>' +
              '<span class="dd-link-text"><strong>' +
              name +
              "</strong></span>" +
              "</a></li>"
            );
          })
          .join("");

        /* Replace the contents of each host <ul> — clears the loading placeholder */
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
        console.warn("[LP Nav] LEAF Team links fetch failed:", err.message);
        /* Clear spinner on failure so it doesn't spin forever */
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

    /* Populate LEAF Team dynamic links after the nav is in the DOM */
    fetchLeafTeamLinks();

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

  function reExecuteScripts(container) {
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
          var fn = new Function("document", "window", oldScript.textContent);
          fn(document, window);
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
    var trail = [{ label: "Launchpad", href: "/platform/designs" }];
    if (route) {
      if (route.section) trail.push({ label: route.section, href: null });
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
  function mountContent(el, sourceDoc, route) {
    var host = _swapHost;
    if (!host) {
      console.error("[LP] mountContent: swap host not found");
      return;
    }

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

    /* Re-execute scripts in the injected content */
    reExecuteScripts(wrapper);

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
      showSwapError("#");
      return;
    }

    var url = route.href;

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

        /* Scroll swap host to top */
        var host = getSwapHost();
        if (host) host.scrollTop = 0;
        window.scrollTo(0, 0);
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

      /* External-flagged links (e.g. LEAF Team quick-links) navigate away normally */
      if (link.hasAttribute("data-nav-external")) return;

      /* Modifier-key / middle-click → real new tab, no intercept */
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
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
