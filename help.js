/* =========================================================================
   LEAF Project Dashboard — Help & Reference page behavior
   Handles: sidebar search/filter, jump-link navigation with scroll-spy
   highlighting, and the back-to-top button. No external dependencies.
   ========================================================================= */

(() => {
  "use strict";

  /**
   * Wire up the sidebar search box to filter the nav list.
   * Matches against each item's `data-keywords` attribute and its
   * visible link text. Shows the "no topics match" message when
   * everything is filtered out.
   */
  const initSearch = () => {
    const searchInput = document.querySelector("#helpSearchInput");
    const navList = document.querySelector("#helpNavList");
    const navEmpty = document.querySelector("#helpNavEmpty");
    if (!searchInput || !navList || !navEmpty) return;

    const navItems = [...navList.querySelectorAll(".help-navItem")];

    const itemMatches = (item, term) => {
      const keywords = (item.dataset.keywords || "").toLowerCase();
      const linkText = (
        item.querySelector(".help-navLink")?.textContent || ""
      ).toLowerCase();
      const subText = [...item.querySelectorAll(".help-navSubLink")]
        .map((link) => link.textContent.toLowerCase())
        .join(" ");
      return `${keywords} ${linkText} ${subText}`.includes(term);
    };

    const applyFilter = () => {
      const term = searchInput.value.trim().toLowerCase();
      let visibleCount = 0;

      navItems.forEach((item) => {
        const matches = term === "" || itemMatches(item, term);
        item.classList.toggle("is-hidden", !matches);
        if (matches) visibleCount += 1;
      });

      navEmpty.hidden = visibleCount !== 0;
    };

    searchInput.addEventListener("input", applyFilter);
  };

  /**
   * Wire up smooth scrolling for jump links (top-level + sub-section)
   * so clicking a sidebar entry scrolls the matching section into view
   * and updates the URL hash without an abrupt jump.
   */
  const initJumpLinks = () => {
    const links = [
      ...document.querySelectorAll(".help-navLink, .help-navSubLink"),
    ];
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    links.forEach((link) => {
      link.addEventListener("click", (event) => {
        const href = link.getAttribute("href") || "";
        if (!href.startsWith("#")) return;

        const target = document.querySelector(href);
        if (!target) return;

        event.preventDefault();
        target.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "start",
        });
        target.focus({ preventScroll: true });
        history.replaceState(null, "", href);
      });
    });
  };

  /**
   * Highlight the sidebar entry for whichever section (or sub-section)
   * is currently in view, using an IntersectionObserver. Top-level
   * sections light up `.help-navLink`; sub-sections inside "Inside a
   * Project" also light up the matching `.help-navSubLink`.
   */
  const initScrollSpy = () => {
    const main = document.querySelector("#helpMain");
    if (!main) return;

    const sections = [...main.querySelectorAll(".help-section[id]")];
    const subSections = [...main.querySelectorAll(".help-subTitle[id]")];
    const trackedHeadings = [...sections, ...subSections];
    if (trackedHeadings.length === 0) return;

    const navLinks = [
      ...document.querySelectorAll(".help-navLink, .help-navSubLink"),
    ];

    const setActive = (id) => {
      const target = `#${id}`;
      navLinks.forEach((link) => {
        const isActive = link.getAttribute("href") === target;
        link.classList.toggle("is-active", isActive);
        if (isActive) {
          link.setAttribute("aria-current", "true");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    };

    let currentId = null;
    const visibleHeadings = new Map();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleHeadings.set(entry.target.id, entry.boundingClientRect.top);
          } else {
            visibleHeadings.delete(entry.target.id);
          }
        });

        if (visibleHeadings.size === 0) return;

        // Pick the visible heading closest to the top of the viewport.
        const [topId] = [...visibleHeadings.entries()].sort(
          (a, b) => a[1] - b[1],
        )[0];

        if (topId !== currentId) {
          currentId = topId;
          setActive(topId);
        }
      },
      {
        rootMargin: "-10% 0px -70% 0px",
        threshold: 0,
      },
    );

    trackedHeadings.forEach((heading) => observer.observe(heading));
  };

  /**
   * Show the back-to-top button once the page has scrolled down, and
   * scroll smoothly back to the top when clicked.
   */
  const initJumpTop = () => {
    const jumpTop = document.querySelector("#helpJumpTop");
    if (!jumpTop) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    jumpTop.hidden = false;

    const onScroll = () => {
      jumpTop.classList.toggle("is-visible", window.scrollY > 400);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    jumpTop.addEventListener("click", () => {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    });
  };

  const init = () => {
    initSearch();
    initJumpLinks();
    initScrollSpy();
    initJumpTop();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
