/* ============================================================
   LEAF Universal Breadcrumb  |  leaf_breadcrumb.js
   ─────────────────────────────────────────────────────────────
   Lives at /platform/designs/files/leaf_breadcrumb.js.
   Self-mounting, same pattern as leaf_nav.js: auto-injects its
   own stylesheet, and creates a host element right after the
   nav if the page doesn't provide one.

   IMPORTANT: include this script's <script> tag AFTER
   leaf_nav.js's tag, so the nav exists before this one looks
   for it.

   Usage on a page:

     <script>
       window.LEAF_BREADCRUMB = ["resources", { label: "Help Library" }];
       // or: ["about-leaf", { label: "Impact" }]
       // or: ["solutions", { label: "Form Library" }]
     </script>
     <script src="/platform/designs/files/leaf_breadcrumb.js"></script>

   Each entry in window.LEAF_BREADCRUMB is either:
     - a string key into CRUMB_GROUPS below (a shared, reusable
       crumb — edit CRUMB_GROUPS once to rename/repoint it on
       every page that uses it), or
     - a one-off object: { label: "...", href: "..." }
       (omit href on the last entry — it's treated as the
       current page automatically).

   "Launchpad" is always prepended automatically as the root
   crumb, so pages never need to declare it themselves.
   ============================================================ */

(function () {
  "use strict";

  /* ── Shared crumb groups — edit here to rename/repoint sitewide ── */
  var CRUMB_GROUPS = {
    "about-leaf": { label: "About LEAF" },
    "our-impact": {
      label: "Our Impact",
      href: "/platform/designs/report.php?a=impact",
    },
    solutions: { label: "Solutions" },
    resources: { label: "Resources" },
  };

  var HOME_CRUMB = {
    label: "Launchpad",
    href: "/platform/designs",
  }; /* TODO: change to "/launchpad" before deploying to production */

  function resolveCrumb(entry) {
    if (typeof entry === "string") {
      var group = CRUMB_GROUPS[entry];
      if (!group) {
        console.warn(`leaf_breadcrumb: unknown crumb group "${entry}"`);
        return { label: entry };
      }
      return group;
    }
    return entry;
  }

  function crumbHTML(crumb, isLast) {
    if (isLast || !crumb.href) {
      return `<span class="lp-bc-current" aria-current="page">${crumb.label}</span>`;
    }
    return `<a href="${crumb.href}">${crumb.label}</a>`;
  }

  function buildTrailHTML() {
    var pageTrail = Array.isArray(window.LEAF_BREADCRUMB)
      ? window.LEAF_BREADCRUMB
      : [];
    var trail = [HOME_CRUMB].concat(pageTrail.map(resolveCrumb));
    return trail
      .map(function (crumb, i) {
        var isLast = i === trail.length - 1;
        var sep =
          i > 0 ? '<span class="lp-bc-sep" aria-hidden="true">/</span>' : "";
        return sep + crumbHTML(crumb, isLast);
      })
      .join("");
  }

  /* ── Self-mount: stylesheet ── */
  function ensureStylesheet() {
    if (document.querySelector('link[href*="leaf_breadcrumb.css"]')) return;
    var thisScript =
      document.currentScript ||
      (function () {
        var scripts = document.getElementsByTagName("script");
        return scripts[scripts.length - 1];
      })();
    var src = thisScript && thisScript.getAttribute("src");
    if (!src) return;
    var cssHref = src.replace(/leaf_breadcrumb\.js(\?.*)?$/i, function (match) {
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
     Use an existing #lp-breadcrumb-host if the page provides
     one (lets a page control exact placement). Otherwise, drop
     it in right after the nav — or at the top of <body> if the
     nav isn't there yet for some reason. */
  function ensureHost() {
    var host = document.getElementById("lp-breadcrumb-host");
    if (host) return host;
    host = document.createElement("nav");
    host.id = "lp-breadcrumb-host";
    var nav = document.getElementById("lpNav");
    if (nav && nav.parentNode) {
      nav.parentNode.insertBefore(host, nav.nextSibling);
    } else {
      document.body.insertBefore(host, document.body.firstChild);
    }
    return host;
  }

  function render() {
    var host = ensureHost();
    host.outerHTML = `<nav class="lp-breadcrumb" id="lpBreadcrumb" aria-label="Breadcrumb">${buildTrailHTML()}</nav>`;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
