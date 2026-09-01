(function () {
  "use strict";

  // Mirrors CustomerOverview's CONFIG.indicators pattern: name every
  // indicatorID by purpose instead of scattering raw numbers through the
  // code. Verify these against the "Blog Post" form in LEAF Form Editor
  // before changing them.
  const CONFIG = {
    categoryID: "form_3db88",
    // TODO: point this at the real blog index/listing page once one exists.
    blogIndexURL: "#",
    indicators: {
      title: 2,
      category: 3,
      publishDate: 4,
      // Still authored on the form, just not rendered here — it becomes
      // the executive summary on the (future) blog index page instead.
      leadParagraph: 5,
      body: 6, // Plain text; paragraphs are separated by a blank line
    },
  };

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

  function getAPIBase() {
    const href = window.location.href;
    return href.replace(/\/[^\/]*(\?.*)?(#.*)?$/, "");
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
      `${getAPIBase()}/api/form/query?q=${encodeURIComponent(JSON.stringify(q))}`,
      { credentials: "include" },
    );
    if (!r.ok) throw new Error("Query failed HTTP " + r.status);
    const data = await r.json();
    const rec = data && data[recordID];
    if (!rec) return null;
    return rec.s1 || rec;
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

  // The body field is authored through LEAF's native form as an ordinary
  // long-text field, not a custom block editor — LEAF may render a
  // textarea's line breaks back as literal <br> tags (same as the
  // Customer Hub's phase content), so normalize those to newlines before
  // splitting into paragraphs on blank lines. A block starting with "## "
  // is a lightweight, no-Form-Editor-changes-needed convention for a
  // section heading — tell authors about it in the body field's LEAF
  // Form Editor description (e.g. "Start a line with ## and a space to
  // make it a section heading.").
  function parseBodyParagraphs(raw) {
    if (!raw) return [];
    return raw
      .replace(/<br\s*\/?>/gi, "\n")
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((text) => {
        if (text.startsWith("## ")) {
          return { type: "heading", text: text.slice(3).replace(/\s+/g, " ").trim() };
        }
        return { type: "paragraph", text };
      });
  }

  function calcReadTime(blocks) {
    const words = blocks
      .map((b) => b.text)
      .join(" ")
      .split(/\s+/)
      .filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }

  function renderBody(blocks) {
    const container = byId("bp-body");
    container.innerHTML = "";
    blocks.forEach((block) => {
      const el = document.createElement(block.type === "heading" ? "h2" : "p");
      // Set decoded text via textContent (not interpolated into an HTML
      // string) so LEAF's pre-encoded entities aren't double-encoded.
      el.textContent = block.text;
      container.appendChild(el);
    });
  }

  async function loadPost() {
    const recordID = getRecordIDFromHash();
    if (!recordID) {
      showError("No post was specified.");
      return;
    }

    showLoading();
    try {
      const s1 = await fetchPostData(recordID);
      if (!s1) {
        showError("That post could not be found.");
        return;
      }

      const title = getField(s1, CONFIG.indicators.title);
      const category = getField(s1, CONFIG.indicators.category);
      const publishDate = getField(s1, CONFIG.indicators.publishDate);
      const bodyBlocks = parseBodyParagraphs(getField(s1, CONFIG.indicators.body));

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
      const minutes = calcReadTime(bodyBlocks);
      byId("bp-readtime").textContent = `${minutes} min read`;

      renderBody(bodyBlocks);

      showContent();
      byId("bp-title").focus();
    } catch (err) {
      console.error("[BlogPost]", err);
      showError("Something went wrong loading this post. Try refreshing the page.");
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
