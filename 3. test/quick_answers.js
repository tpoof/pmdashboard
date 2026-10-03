/* LEAF Quick Answers engine
   Shared by the Quick Answers page and, later, the support form's
   suggestion panel: loads answers, ranks them against typed text, and
   renders compact cards. Typed text never leaves the browser; only answer
   IDs and hit/miss outcomes are tracked. */
(function () {
  "use strict";

  const SCRIPT_SRC = document.currentScript && document.currentScript.src;

  const CONFIG = {
    source: "sample", // "sample" or "leaf"
    sampleFile: "quick_answers_sample.json",
    leaf: {
      apiBase: "/platform/FAQ/",
      publishedStatus: "Published",
      limit: 500,
      // indicatorIDs from the FAQ form. Search "REPLACE_ME" before going live.
      indicators: {
        question: "REPLACE_ME_QUESTION",
        shortAnswer: "REPLACE_ME_SHORT_ANSWER",
        steps: "REPLACE_ME_STEPS",
        topic: "REPLACE_ME_TOPIC",
        keywords: "REPLACE_ME_KEYWORDS",
        contacts: "REPLACE_ME_CONTACTS",
        lastUpdated: "REPLACE_ME_LAST_UPDATED",
        inSupportForm: "REPLACE_ME_IN_SUPPORT_FORM",
      },
    },
    minScore: 4,
    maxResults: 5,
    recentDays: 30,
  };

  const SUPPORT_URL =
    "https://leaf.va.gov/platform/support/report.php?a=LEAF_Start_Request&id=form_ba7de&title=Consultation+Request+from+Quick+Answers";

  const DOMPURIFY_SRC =
    "https://leaf.va.gov/app/libs/js/dompurify/dompurify.min.js";

  const STOPWORDS = new Set(
    "a an the to of in on for and or is are was be my me i it do does how can why what when where with that this am im have has leaf".split(
      " ",
    ),
  );

  function stem(word) {
    let w = word;
    if (w.length > 4) {
      if (w.endsWith("ing")) w = w.slice(0, -3);
      else if (w.endsWith("ed")) w = w.slice(0, -2);
      else if (w.endsWith("es")) w = w.slice(0, -2);
      else if (w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
    }
    if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
    return w;
  }

  function tokens(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/'/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w && !STOPWORDS.has(w))
      .map(stem);
  }

  function prepare(entry) {
    const phrases = (entry.keywords || []).map(tokens).filter((p) => p.length);
    return Object.assign({}, entry, {
      _question: new Set(tokens(entry.question)),
      _keywords: new Set(phrases.flat()),
      _phrases: phrases.filter((p) => p.length > 1),
      _answer: new Set(tokens(entry.shortAnswer)),
      _topic: new Set(tokens(entry.topic)),
    });
  }

  // Weights: question 3, keyword 2, answer text 1, topic 1, multi-word keyword phrase 3 per word.
  function search(query, answers, limit) {
    const queryTokens = tokens(query);
    const unique = [...new Set(queryTokens)];
    if (!unique.length) return [];
    const joined = " " + queryTokens.join(" ") + " ";

    return answers
      .map((entry) => {
        let score = 0;
        unique.forEach((t) => {
          if (entry._question.has(t)) score += 3;
          if (entry._keywords.has(t)) score += 2;
          if (entry._answer.has(t)) score += 1;
          if (entry._topic.has(t)) score += 1;
        });
        entry._phrases.forEach((p) => {
          if (joined.includes(" " + p.join(" ") + " ")) score += 3 * p.length;
        });
        return { entry, score };
      })
      .filter((r) => r.score >= CONFIG.minScore)
      .sort(
        (a, b) =>
          b.score - a.score || a.entry.question.localeCompare(b.entry.question),
      )
      .slice(0, limit || CONFIG.maxResults)
      .map((r) => r.entry);
  }

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

  function getField(s1, indicatorID) {
    const v = s1 ? s1[`id${indicatorID}`] : null;
    return v == null ? "" : decodeEntities(String(v).trim());
  }

  // One contact per line: "Name | link (optional) | note (optional)".
  function parseContacts(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map((line) => line.split("|").map((part) => part.trim()))
      .filter((parts) => parts[0])
      .map(([name, url, note]) => ({ name, url: url || "", note: note || "" }));
  }

  function isRecent(raw) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw || "");
    if (!m) return false;
    const updated = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((today - updated) / 86400000);
    return days >= 0 && days <= CONFIG.recentDays;
  }

  function safeUrl(value) {
    if (!value) return "";
    try {
      const u = new URL(value, window.location.href);
      return /^https?:$/.test(u.protocol) ? u.href : "";
    } catch (e) {
      return "";
    }
  }

  function ensureDompurify() {
    if (window.DOMPurify) return Promise.resolve();
    const existing = document.querySelector(`script[src="${DOMPURIFY_SRC}"]`);
    const warn = () =>
      console.warn(
        "[QuickAnswers] DOMPurify failed to load; steps will show as plain text.",
      );
    if (existing) {
      return new Promise((resolve) => {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => {
          warn();
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
        warn();
        resolve();
      };
      document.head.appendChild(s);
    });
  }

  async function fetchSample() {
    const url = SCRIPT_SRC
      ? new URL(CONFIG.sampleFile, SCRIPT_SRC).href
      : "./files/" + CONFIG.sampleFile;
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) throw new Error("Sample answers failed HTTP " + res.status);
    const data = await res.json();
    return data.answers || [];
  }

  async function fetchLeaf() {
    const { apiBase, indicators, publishedStatus, limit } = CONFIG.leaf;
    if (
      Object.values(indicators).some((v) => String(v).startsWith("REPLACE_ME"))
    ) {
      throw new Error("FAQ form indicators are not configured");
    }
    const q = {
      terms: [{ id: "recordID", operator: ">", match: 0, gate: "AND" }],
      joins: [],
      sort: {},
      getData: Object.values(indicators),
      limit,
    };
    const res = await fetch(
      `${apiBase}api/form/query?q=${encodeURIComponent(JSON.stringify(q))}`,
      { credentials: "include" },
    );
    if (!res.ok) throw new Error("Query failed HTTP " + res.status);
    const data = await res.json();

    return Object.entries(data || {})
      .filter(([, rec]) => rec.lastStatus === publishedStatus)
      .map(([recordID, rec]) => {
        const s1 = rec.s1 || rec;
        const f = (key) => getField(s1, indicators[key]);
        return {
          id: String(recordID),
          question: f("question"),
          shortAnswer: f("shortAnswer"),
          steps: f("steps"),
          topic: f("topic"),
          keywords: f("keywords")
            .split(/\r?\n/)
            .map((k) => k.trim())
            .filter(Boolean),
          contacts: parseContacts(f("contacts")),
          lastUpdated: f("lastUpdated"),
          inSupportForm: /^(yes|true|on|1)$/i.test(f("inSupportForm")),
        };
      });
  }

  async function load() {
    const [raw] = await Promise.all([
      CONFIG.source === "leaf" ? fetchLeaf() : fetchSample(),
      ensureDompurify(),
    ]);
    const answers = raw
      .filter((e) => e.question && e.shortAnswer)
      .map(prepare)
      .sort((a, b) => a.question.localeCompare(b.question));
    return { answers };
  }

  function track(label, id) {
    if (window.LPTrack) {
      window.LPTrack.event("quick-answers", id ? `${label}:${id}` : label);
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function setSteps(container, html) {
    if (window.DOMPurify) {
      container.innerHTML = window.DOMPurify.sanitize(html, {
        FORBID_ATTR: ["style"],
      });
    } else {
      container.textContent = String(html).replace(/<[^>]*>/g, " ");
    }
  }

  function supportLink(options) {
    const opts = options || {};
    const a = el(
      "a",
      opts.className || "btn btn-pri",
      opts.label || "Request support",
    );
    a.href = SUPPORT_URL;
    a.dataset.action = "form-modal";
    a.dataset.modalSrc = SUPPORT_URL + "&iframe=1";
    a.dataset.modalTitle = "Request Support";
    a.dataset.track = opts.trackLabel || "request-support";
    return a;
  }

  function renderContacts(contacts) {
    if (!contacts || !contacts.length) return null;
    const wrap = el("div", "qa-contact");
    const label = el("p", "qa-contact-label", "Contact");
    const list = el("ul", "qa-contact-list");

    contacts.forEach((c) => {
      const li = el("li", "qa-contact-item");
      const url = safeUrl(c.url);
      if (url) {
        const a = el("a", "qa-link", c.name);
        a.href = url;
        a.dataset.track = "contact";
        if (new URL(url).origin !== window.location.origin) {
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.append(el("span", "qa-sr-only", " (opens in new tab)"));
        }
        li.append(a);
      } else {
        li.append(el("strong", "qa-contact-name", c.name));
      }
      if (c.note) li.append(el("span", "qa-contact-note", " " + c.note));
      list.append(li);
    });

    wrap.append(label, list);
    return wrap;
  }

  function renderCard(entry, options) {
    const level = (options && options.headingLevel) || 2;
    const recent = isRecent(entry.lastUpdated);
    const card = el("article", recent ? "qa-card qa-card--updated" : "qa-card");
    card.dataset.id = entry.id;

    card.append(el("h" + level, "qa-card-title", entry.question));
    if (recent) card.append(el("span", "qa-updated", "Updated recently"));
    card.append(el("p", "qa-short", entry.shortAnswer));

    const contacts = renderContacts(entry.contacts);
    if (contacts) card.append(contacts);

    if (entry.steps) {
      const details = el("details", "qa-steps");
      details.append(el("summary", "", "Show steps"));
      const body = el("div", "qa-steps-body");
      setSteps(body, entry.steps);
      details.append(body);
      details.addEventListener("toggle", () => {
        if (details.open) track("open", entry.id);
      });
      card.append(details);
    }

    return card;
  }

  window.LPQuickAnswers = {
    load,
    search,
    renderCard,
    supportLink,
    track,
    get source() {
      return CONFIG.source;
    },
  };
})();
