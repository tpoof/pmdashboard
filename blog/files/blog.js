(function () {
  "use strict";

  // Mirrors CustomerOverview's CONFIG.indicators pattern: name every
  // indicatorID by purpose instead of scattering raw numbers through the
  // code. Verify these against the "Blog Post" form in LEAF Form Editor
  // before changing them. Kept in sync with lp_blog_preprod.html's copy.
  const CONFIG = {
    // Hardcoded rather than derived from window.location — this page can be
    // loaded from a directory other than the Blog Post form's own site
    // (e.g. during preprod testing), and a derived base silently pointed
    // requests at the wrong site's api/form/query, returning no results.
    apiBase: "/platform/blog",
    categoryID: "form_3db88",
    indicators: {
      title: 2,
      category: 3,
      publishDate: 4,
      // Still authored on the form, just not rendered here — it becomes
      // the executive summary on the (future) blog index page instead.
      leadParagraph: 5,
      body: 6, // Trumbowyg-authored HTML, sanitized before rendering
      featuredImage: 7,
      featuredImageAlt: 8,
    },
    // Matches the "Blog" entry registered in leaf_header_preprod.js's own
    // NAV_SECTIONS (Knowledge Center). Relative (no host), so it resolves
    // correctly against whichever host actually serves the page — no
    // preprod/production swap needed.
    blogIndexURL: "/launchpad/report.php?a=lp_blog",
  };

  // LEAF's own rich-text (Trumbowyg) fields store real HTML, and
  // leaf_header.js already sanitizes untrusted HTML before mounting it
  // (its announcement banner) via this exact DOMPurify build — reusing it
  // here rather than adding a second copy of the same dependency.
  const DOMPURIFY_SRC =
    "https://leaf.va.gov/app/libs/js/dompurify/dompurify.min.js";

  function ensureDompurify() {
    if (window.DOMPurify) return Promise.resolve();
    const existing = document.querySelector(`script[src="${DOMPURIFY_SRC}"]`);
    if (existing) {
      return new Promise((resolve) => {
        if (window.DOMPurify) return resolve();
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => {
          console.warn(
            "[BlogPost] DOMPurify failed to load — body will not render.",
          );
          resolve();
        });
      });
    }
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = DOMPURIFY_SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        console.warn(
          "[BlogPost] DOMPurify failed to load — body will not render.",
        );
        resolve();
      };
      document.head.appendChild(s);
    });
  }

  const byId = (id) => document.getElementById(id);

  function decodeEntities(str) {
    if (!str || typeof str !== "string") return str;
    return str
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&apos;/g, "'");
  }

  // Record to display is read from the URL hash, matching Customer_Page.html
  // (getRecordIDFromHash), not a ?a= query param.
  function getRecordIDFromHash() {
    const hash = window.location.hash.replace("#", "").trim();
    return /^\d+$/.test(hash) ? hash : "";
  }

  // LEAF stores s1 values keyed as 'id' + indicatorID.
  function getField(s1, indicatorID) {
    if (!s1) return "";
    const v = s1[`id${indicatorID}`];
    if (v == null) return "";
    return decodeEntities(String(v).trim());
  }

  function announce(message, assertive) {
    const node = byId(assertive ? "bp-live-assertive" : "bp-live-polite");
    if (!node) return;
    node.textContent = "";
    setTimeout(() => {
      node.textContent = message;
    }, 60);
  }

  function showLoading() {
    byId("bp-loading").style.display = "";
    byId("bp-error").style.display = "none";
    byId("bp-content").style.display = "none";
  }

  function showError(message) {
    byId("bp-loading").style.display = "none";
    byId("bp-content").style.display = "none";
    const errEl = byId("bp-error");
    errEl.textContent = message;
    errEl.style.display = "";
    announce(message, true);
  }

  function showContent() {
    byId("bp-loading").style.display = "none";
    byId("bp-error").style.display = "none";
    byId("bp-content").style.display = "";
    announce("Post loaded.", false);
  }

  async function fetchPostData(recordID) {
    const q = {
      terms: [{ id: "recordIDs", operator: "=", match: recordID, gate: "AND" }],
      joins: [],
      sort: {},
      getData: Object.values(CONFIG.indicators).map(String),
    };
    const r = await fetch(
      `${CONFIG.apiBase}/api/form/query?q=${encodeURIComponent(JSON.stringify(q))}`,
      { credentials: "include" },
    );
    if (!r.ok) throw new Error("Query failed HTTP " + r.status);
    const data = await r.json();
    const rec = data && data[recordID];
    if (!rec) return null;
    return rec.s1 || rec;
  }

  // Featured image is a File Upload indicator — LEAF doesn't return a plain
  // URL for those from api/form/query, so pull the rendered print-view HTML
  // and read the <img> LEAF already put in it (same trick as the Customer
  // Hub's phase attachments, and the same img[src*="image.php"] selector
  // ideas.js/ideas_v2.js/ideas_v4.js all use against this same endpoint).
  // forms/print_subindicators_ajax.tpl — a server-rendered LEAF template,
  // not another JS guess — confirms image.php is genuinely how this LEAF
  // install serves indicator images. Still: verify against a real record
  // with a featured image before shipping, since getprintindicator's
  // markup for a plain top-level File Upload indicator could differ from
  // the subindicator case that template covers.
  async function fetchIndicatorHTML(recordID, indicatorID) {
    return fetch(
      `${CONFIG.apiBase}/ajaxIndex.php?a=getprintindicator&recordID=${encodeURIComponent(recordID)}&indicatorID=${encodeURIComponent(indicatorID)}&series=1`,
      {
        credentials: "include",
        headers: { "x-requested-with": "XMLHttpRequest" },
      },
    )
      .then((r) => r.text())
      .catch(() => "");
  }

  function parseImageSrcFromHTML(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const img = tmp.querySelector('img[src*="image.php"]');
    return img ? img.getAttribute("src") || "" : "";
  }

  function formatDate(raw) {
    if (!raw) return "";
    // Parse y-m-d manually so a date-only string doesn't shift a day under
    // UTC-vs-local timezone conversion.
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    const d = m
      ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
      : new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  // Body is authored through LEAF's native Trumbowyg rich-text editor, so
  // it's already real HTML (<p>, <strong>, <h2>, <ul>, ...) — sanitize with
  // DOMPurify (the same convention leaf_header.js already uses for
  // untrusted HTML) and mount it directly rather than re-deriving structure
  // from plain text. Returns the rendered word count so the caller can
  // compute read time from the same sanitized pass instead of a second one.
  function renderBody(bodyHTML) {
    const container = byId("bp-body-content");
    if (!window.DOMPurify) {
      container.textContent = "";
      console.warn(
        "[BlogPost] Rendering body as empty — DOMPurify unavailable.",
      );
      return 0;
    }
    // FORBID_ATTR strips inline style attributes so pasted content (from
    // Word, Google Docs, etc.) can't override the page's font/color and
    // break visual consistency — LEAF's own CSS controls all typography.
    container.innerHTML = window.DOMPurify.sanitize(bodyHTML, {
      FORBID_ATTR: ["style"],
    });
    return (container.textContent || "").trim().split(/\s+/).filter(Boolean)
      .length;
  }

  function calcReadTime(wordCount) {
    return Math.max(1, Math.round(wordCount / 200));
  }

  async function loadPost() {
    const recordID = getRecordIDFromHash();
    if (!recordID) {
      showError("No post was specified.");
      return;
    }

    showLoading();
    try {
      const [s1] = await Promise.all([
        fetchPostData(recordID),
        ensureDompurify(),
      ]);
      if (!s1) {
        showError("That post could not be found.");
        return;
      }

      const title = getField(s1, CONFIG.indicators.title);
      const category = getField(s1, CONFIG.indicators.category);
      const publishDate = getField(s1, CONFIG.indicators.publishDate);
      const bodyHTML = getField(s1, CONFIG.indicators.body);
      const imageAlt = getField(s1, CONFIG.indicators.featuredImageAlt);

      byId("bp-title").textContent = title || "Untitled post";
      document.title = title || "Blog post";

      const categoryEl = byId("bp-category");
      if (category) {
        categoryEl.textContent = category;
        categoryEl.style.display = "";
      } else {
        categoryEl.style.display = "none";
      }

      byId("bp-date").textContent = formatDate(publishDate);

      const wordCount = renderBody(bodyHTML);
      byId("bp-readtime").textContent = `${calcReadTime(wordCount)} min read`;

      const imageHTML = await fetchIndicatorHTML(
        recordID,
        CONFIG.indicators.featuredImage,
      );
      const imageSrc = parseImageSrcFromHTML(imageHTML);
      const figureEl = byId("bp-image-figure");
      const imgEl = byId("bp-image");
      if (imageSrc) {
        imgEl.src = imageSrc;
        imgEl.alt = imageAlt || "";
        figureEl.hidden = false;
      } else {
        figureEl.hidden = true;
        // A non-empty response with no matching <img> means the selector
        // in parseImageSrcFromHTML doesn't match this LEAF install's real
        // markup — surface that instead of silently just hiding the image.
        if (imageHTML.trim()) {
          console.warn(
            "[BlogPost] featured image indicator returned HTML but no img[src*='image.php'] was found — parseImageSrcFromHTML may need updating.",
            imageHTML,
          );
        }
      }

      showContent();
      byId("bp-title").focus();
    } catch (err) {
      console.error("[BlogPost]", err);
      showError(
        "Something went wrong loading this post. Try refreshing the page.",
      );
    }
  }

  function wireBackLinks() {
    document
      .querySelectorAll(".bp-back-link, footer.bp-footer a")
      .forEach((a) => {
        a.href = CONFIG.blogIndexURL;
      });
  }

  window.addEventListener("hashchange", loadPost);
  document.addEventListener("DOMContentLoaded", () => {
    wireBackLinks();
    loadPost();
  });
})();
