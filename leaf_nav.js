/* ============================================================
   LEAF Universal Nav  |  leaf-nav.js
   ─────────────────────────────────────────────────────────────
   Injects the nav HTML into #lp-nav-host and wires up all
   interactions (scroll shadow, dropdowns, keyboard nav).

   Usage on any page:
     1. Add a placeholder where you want the nav:
          <div id="lp-nav-host"></div>
     2. Link the stylesheet and this script in <head>:
          <link rel="stylesheet" href="leaf-nav.css">
          <script src="leaf-nav.js"></script>
   ============================================================ */

(function () {
  "use strict";

  /* ── Nav HTML ── */
  var NAV_HTML = `
<nav class="lp-nav" id="lpNav" aria-label="Launchpad navigation">
  <div class="lp-nav-in">
    <ul class="lp-nav-links" role="list">

      <li class="dd-item" id="dd-item-0">
        <button class="dd-trigger" aria-expanded="false" aria-haspopup="true" data-dd="0">
          What is LEAF? <span class="dd-chevron" aria-hidden="true">⌄</span>
        </button>
        <div class="dd-panel" id="dd-0" hidden>
          <ul class="dd-list">
            <li>
              <a class="dd-link" href="#">
                <span class="dd-link-ico">
                  <span class="material-symbols-outlined" aria-hidden="true">bar_chart</span>
                </span>
                <span class="dd-link-text">
                  <strong>Our Impact</strong>
                  <span>See how LEAF has transformed VA workflows across the country</span>
                </span>
              </a>
            </li>
            <li>
              <a class="dd-link" href="#">
                <span class="dd-link-ico">
                  <span class="material-symbols-outlined" aria-hidden="true">route</span>
                </span>
                <span class="dd-link-text">
                  <strong>Roadmap</strong>
                  <span>Upcoming features and platform improvements</span>
                </span>
              </a>
            </li>
          </ul>
        </div>
      </li>

      <li class="dd-item" id="dd-item-1">
        <button class="dd-trigger" aria-expanded="false" aria-haspopup="true" data-dd="1">
          Solutions <span class="dd-chevron" aria-hidden="true">⌄</span>
        </button>
        <div class="dd-panel" id="dd-1" hidden>
          <ul class="dd-list">
            <li>
              <a class="dd-link" href="#">
                <span class="dd-link-ico">
                  <span class="material-symbols-outlined" aria-hidden="true">library_books</span>
                </span>
                <span class="dd-link-text">
                  <strong>Use Cases</strong>
                  <span>Browse real-life VA workflows built with LEAF</span>
                </span>
              </a>
            </li>
            <li>
              <a class="dd-link" href="#">
                <span class="dd-link-ico">
                  <span class="material-symbols-outlined" aria-hidden="true">description</span>
                </span>
                <span class="dd-link-text">
                  <strong>Form Library</strong>
                  <span>Ready-to-use templates for common VA processes</span>
                </span>
              </a>
            </li>
            <li>
              <a class="dd-link" href="#">
                <span class="dd-link-ico">
                  <span class="material-symbols-outlined" aria-hidden="true">cable</span>
                </span>
                <span class="dd-link-text">
                  <strong>Integrations</strong>
                  <span>Connect LEAF with other VA systems and tools</span>
                </span>
              </a>
            </li>
          </ul>
        </div>
      </li>

      <li class="dd-item" id="dd-item-2">
        <button class="dd-trigger" aria-expanded="false" aria-haspopup="true" data-dd="2">
          Resources <span class="dd-chevron" aria-hidden="true">⌄</span>
        </button>
        <div class="dd-panel" id="dd-2" hidden>
          <ul class="dd-list">
            <li>
              <a class="dd-link" href="report.php?a=Find_my_site">
                <span class="dd-link-ico">
                  <span class="material-symbols-outlined" aria-hidden="true">location_on</span>
                </span>
                <span class="dd-link-text">
                  <strong>Find your local LEAF site</strong>
                  <span>Search for LEAF at your VA facility</span>
                </span>
              </a>
            </li>
            <hr class="dd-divider" aria-hidden="true">
            <li>
              <a class="dd-link" href="/platform/help_library/" target="_blank" rel="noopener noreferrer">
                <span class="dd-link-ico">
                  <span class="material-symbols-outlined" aria-hidden="true">menu_book</span>
                </span>
                <span class="dd-link-text">
                  <strong>Help library</strong>
                  <span>Guides, tutorials, and documentation</span>
                </span>
              </a>
            </li>
            <li>
              <a class="dd-link" href="/platform/CoP/" target="_blank" rel="noopener noreferrer">
                <span class="dd-link-ico">
                  <span class="material-symbols-outlined" aria-hidden="true">group</span>
                </span>
                <span class="dd-link-text">
                  <strong>Community of practice</strong>
                  <span>Connect with LEAF users across VA</span>
                </span>
              </a>
            </li>
            <li>
              <a class="dd-link" href="?go=idea" target="_blank" rel="noopener noreferrer">
                <span class="dd-link-ico">
                  <span class="material-symbols-outlined" aria-hidden="true">lightbulb</span>
                </span>
                <span class="dd-link-text">
                  <strong>Suggest an idea</strong>
                  <span>Share feature requests with the LEAF team</span>
                </span>
              </a>
            </li>
          </ul>
        </div>
      </li>

    </ul>
  </div>
</nav>`;

  /* ── Inject nav into placeholder ── */
  function inject() {
    var host = document.getElementById("lp-nav-host");
    if (!host) return;
    host.outerHTML = NAV_HTML;
    wire();
  }

  /* ── Wire interactions ── */
  function wire() {
    /* Scroll shadow */
    var nav = document.getElementById("lpNav");
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

    /* Close all open dropdowns, optionally except one */
    function closeAll(except) {
      document.querySelectorAll(".dd-item.open").forEach(function (item) {
        if (item === except) return;
        item.classList.remove("open");
        var btn = item.querySelector(".dd-trigger");
        var panel = item.querySelector(".dd-panel");
        if (btn) btn.setAttribute("aria-expanded", "false");
        if (panel) panel.setAttribute("hidden", "");
      });
    }

    /* Toggle on trigger click */
    document.querySelectorAll(".dd-trigger").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.closest(".dd-item");
        var ddId = btn.getAttribute("data-dd");
        var panel = ddId ? document.getElementById("dd-" + ddId) : null;
        var isOpen = item.classList.contains("open");
        closeAll(null);
        if (!isOpen) {
          item.classList.add("open");
          btn.setAttribute("aria-expanded", "true");
          if (panel) panel.removeAttribute("hidden");
        }
      });
    });

    /* Close on outside click */
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".dd-item")) closeAll(null);
    });

    /* Close on Escape */
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAll(null);
    });
  }

  /* ── Run on DOM ready ── */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
