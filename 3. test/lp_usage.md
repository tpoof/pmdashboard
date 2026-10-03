# Launchpad click tracking: implementation patch

Decisions locked in: events are stored as LEAF form records, one record per page load, as a compact JSON batch. Tracking captures views, section impressions and clicks, with no user identifiers in the payload. Results are viewed on a Launchpad dashboard page (built next, not part of this patch).

Everything lives in `leaf_header.js` (already on every page, already holds the CSRF token and router), plus `data-*` attributes on `lp_home.html`. No new files, no external dependencies, no visible UI, no focus or ARIA changes. No new icons.

## 1. Create the LEAF form first

| Item        | Value                                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Site        | Same site as the feedback and newsletter forms (`service_requests_launchpad`). `TRACK_ROOT_URL` defaults to `FEEDBACK_ROOT_URL`. |
| Form        | "Launchpad Usage Tracking"                                                                                                       |
| Indicator   | One field, multi-line text, named "Event log (JSON)", not required                                                               |
| Workflow    | None needed. Records are intentionally never submitted.                                                                          |
| Permissions | Any VA user must be able to create records (same as the newsletter form). Restrict read access to the LEAF team (see flag 1).    |

Send me the form ID (`form_xxxxx`) and the indicator ID and I'll fill the two `REPLACE_ME` constants. Until they're filled, the tracker stays inert (same pattern as the announcement banner).

## 2. Edits to `leaf_header.js`

### Edit 1: constants. Paste right after `FEEDBACK_STEP_ID`.

```js
/* ── Usage tracking config ──
     One record per page load on TRACK_FORM_ID; the JSON event list is
     written to TRACK_INDICATOR_ID (multi-line text). Search "REPLACE_ME"
     to find these before promoting to production. */
var TRACK_ROOT_URL = FEEDBACK_ROOT_URL;
var TRACK_FORM_ID = "REPLACE_ME_TRACK_FORM_ID";
var TRACK_INDICATOR_ID = "REPLACE_ME_TRACK_INDICATOR_ID";
var TRACK_SYSADMIN = false;
var TRACK_MAX_EVENTS = 120;
var TRACK_FLUSH_MS = 60000;
var TRACK_DWELL_MS = 1000;
```

### Edit 2: tracker block. Paste just above the `ANNOUNCEMENT BANNER` section header.

```js
/* ─────────────────────────────────────────────────────────────
     USAGE TRACKING
     Anonymous view / impression / click counts. One LEAF record per
     page load: created on the first event, then overwritten with the
     full event list on each flush. The record is never submitted —
     the create → write → submit chain can't finish during unload.

     Markup: data-track-section="name" on a section (impressions, and
     scopes clicks inside it); data-track="label" on a link or button
     (falls back to data-href, aria-label, then text; clicks inside
     data-track-mask are labelled "requests-grid", never by their text);
     data-track-norage on controls meant to be clicked repeatedly.
     Pages can add events with window.LPTrack.event(section, label).
     Event types: v view, i impression, c click, e custom,
     p page load (ms), f friction (kind:detail).
     Entry source: ?src=<tag> on the link, else a bucket of the referrer.
     ?lp_track_debug=1 logs events to the console and sends nothing.
  ───────────────────────────────────────────────────────────── */
var _trk = {
  on: false,
  debug: false,
  dead: false,
  dirty: false,
  fails: 0,
  t0: Date.now(),
  vp: "l",
  src: "direct",
  errors: 0,
  taps: [],
  route: "",
  events: [],
  overflow: 0,
  rid: 0,
  creating: null,
  io: null,
  scanTimer: null,
  seen: new Set(),
  dwell: new Map(),
  observed: new WeakSet(),
};

function trackClean(value, max) {
  return String(value == null ? "" : value)
    .replace(/\(opens in new tab\)/gi, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function trackPost(path, obj, keepalive) {
  return fetch(TRACK_ROOT_URL + path, {
    method: "POST",
    credentials: "same-origin",
    keepalive: !!keepalive,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-requested-with": "XMLHttpRequest",
    },
    body: feedbackEncodeBody(obj),
  }).then(function (res) {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.text();
  });
}

function trackEnsureRecord() {
  if (_trk.rid) return Promise.resolve(_trk.rid);
  if (_trk.creating) return _trk.creating;
  var body = { CSRFToken: CSRF_TOKEN, title: "Launchpad visit" };
  body["num" + TRACK_FORM_ID] = "on";
  _trk.creating = trackPost("api/form/new", body, false)
    .then(function (text) {
      var id = parseInt(String(text).trim().replace(/^"|"$/g, ""), 10);
      if (!id || id <= 0) throw new Error("no record id returned");
      _trk.rid = id;
      return id;
    })
    .catch(function (err) {
      _trk.dead = true;
      console.warn("[LP Track] disabled:", err.message);
      return 0;
    });
  return _trk.creating;
}

function trackPush(type, section, label, route) {
  if (!_trk.on || _trk.dead) return;
  var t = Math.round((Date.now() - _trk.t0) / 1000);
  var at = route || _trk.route;
  var last = _trk.events[_trk.events.length - 1];
  if (
    last &&
    last[0] === t &&
    last[1] === type &&
    last[2] === at &&
    last[3] === section &&
    last[4] === label
  ) {
    return;
  }
  _trk.dirty = true;
  if (_trk.events.length >= TRACK_MAX_EVENTS) {
    _trk.overflow++;
    return;
  }
  var ev = [t, type, at, section, label];
  _trk.events.push(ev);
  if (_trk.debug) {
    console.log("[LP Track]", ev.join(" | "));
  } else if (!_trk.rid) {
    trackEnsureRecord();
  }
}

function trackFlush(leaving) {
  if (!_trk.on || _trk.dead || _trk.debug || !_trk.dirty) return;
  if (!_trk.rid) {
    if (!leaving) {
      trackEnsureRecord().then(function (id) {
        if (id) trackFlush(false);
      });
    }
    return;
  }
  _trk.dirty = false;
  var body = { recordID: _trk.rid, CSRFToken: CSRF_TOKEN };
  body[TRACK_INDICATOR_ID] = JSON.stringify({
    v: 1,
    vp: _trk.vp,
    src: _trk.src,
    x: _trk.overflow,
    ev: _trk.events,
  });
  trackPost("api/form/" + _trk.rid, body, leaving).then(
    function () {
      _trk.fails = 0;
    },
    function (err) {
      _trk.dirty = true;
      if (++_trk.fails >= 3) _trk.dead = true;
      console.warn("[LP Track] write failed:", err.message);
    },
  );
}

/* Sections count once per view, after TRACK_DWELL_MS inside the
     middle 60% of the viewport (works for sections taller than it). */
function trackOnIntersect(entries) {
  entries.forEach(function (entry) {
    var el = entry.target;
    if (!entry.isIntersecting) {
      clearTimeout(_trk.dwell.get(el));
      _trk.dwell.delete(el);
      return;
    }
    var name = el.getAttribute("data-track-section");
    if (_trk.dwell.has(el) || _trk.seen.has(_trk.route + "|" + name)) return;
    _trk.dwell.set(
      el,
      setTimeout(function () {
        _trk.dwell.delete(el);
        var key = _trk.route + "|" + name;
        if (_trk.seen.has(key)) return;
        _trk.seen.add(key);
        trackPush("i", trackClean(name, 30), "");
      }, TRACK_DWELL_MS),
    );
  });
}

function trackScan(reset) {
  if (!_trk.io) return;
  document.querySelectorAll("[data-track-section]").forEach(function (el) {
    if (reset) {
      _trk.io.unobserve(el);
    } else if (_trk.observed.has(el)) {
      return;
    }
    _trk.observed.add(el);
    _trk.io.observe(el);
  });
}

/* Milliseconds from start until the page's content is in, rounded to
     100 ms. Home loads with the shell itself and is not measured. */
function trackLoad(route, start) {
  var ms = Math.round((Date.now() - start) / 100) * 100;
  trackPush("p", "", String(ms), trackRouteKey(route));
}

function trackFriction(label, route) {
  trackPush("f", "", trackClean(label, 48), route && trackRouteKey(route));
}

function trackRouteKey(key) {
  return (
    String(key || "")
      .toLowerCase()
      .replace(/[^a-z0-9_:-]/g, "")
      .slice(0, 40) || "unknown"
  );
}

/* ?src=<tag> on a shared link wins; otherwise a bucket of the
     referrer host (the host only, never the path). */
function trackSource() {
  var tag = /[?&]src=([A-Za-z0-9_-]{1,20})(?:[&#]|$)/.exec(
    window.location.search,
  );
  if (tag) return "tag:" + tag[1].toLowerCase();
  if (!document.referrer) return "direct";
  var host;
  try {
    host = new URL(document.referrer).hostname.toLowerCase();
  } catch (e) {
    return "other";
  }
  if (host === window.location.hostname) return "leaf-site";
  if (/(^|\.)teams\.(microsoft|cloud\.microsoft)(\.com)?$/.test(host)) {
    return "teams";
  }
  if (/(^|\.)sharepoint\.com$/.test(host)) return "sharepoint";
  if (/(^|\.)va\.gov$/.test(host)) return "va-site";
  return "other";
}

/* Hash key, or "not_found:<key>" for a stale link — those are
     worth seeing in the data. */
function trackView(key) {
  if (!_trk.on) return;
  _trk.route = trackRouteKey(key);
  _trk.seen.clear();
  trackPush("v", "", "");
  trackScan(true);
}

function trackSectionFor(el) {
  var sec = el.closest("[data-track-section]");
  if (sec) return trackClean(sec.getAttribute("data-track-section"), 30);
  if (el.closest("#lpHeader")) return "header";
  if (el.closest(".lp-announcement")) return "announcement";
  return "";
}

function trackLabelFor(el) {
  var explicit = el.getAttribute("data-track");
  if (explicit) return trackClean(explicit, 40);
  /* Inside data-track-mask, text is user content (request titles). */
  if (el.closest("[data-track-mask]")) return "requests-grid";
  var href = el.getAttribute("data-href");
  if (href) return trackClean(hrefToHashKey(href), 40);
  return trackClean(el.getAttribute("aria-label") || el.textContent, 40);
}

var TRACK_INTERACTIVE =
  "a[href], button, input, select, textarea, label, summary, [role], [tabindex], [data-action], [data-track]";

function trackDescribe(el) {
  var tag = el.tagName.toLowerCase();
  if (tag === "img" && el.getAttribute("alt")) {
    return "img:" + trackClean(el.getAttribute("alt"), 28);
  }
  var cls = typeof el.className === "string" ? el.className.split(" ")[0] : "";
  return trackClean(cls ? tag + "." + cls : tag, 32);
}

/* Four clicks within 1.5 s on the same element. */
function trackIsRage(el) {
  var now = Date.now();
  _trk.taps = _trk.taps.filter(function (tap) {
    return tap.el === el && now - tap.at < 1500;
  });
  _trk.taps.push({ el: el, at: now });
  if (_trk.taps.length < 4) return false;
  _trk.taps = [];
  return true;
}

/* Untagged areas stay untracked: only header, announcement, tagged
     sections, and elements carrying their own data-track. */
function trackOnClick(e) {
  var target = e.target;
  if (!target || !target.closest) return;
  var el = target.closest(
    "a[href], button, [role='button'], [data-action], [data-track]",
  );
  if (el && el.disabled) return;
  var section = trackSectionFor(el || target);
  if (!section && !(el && el.hasAttribute("data-track"))) return;

  if (!el) {
    /* Nothing interactive here: a dead click if it still looks
         clickable. Mouse-only handlers without a role may false-positive. */
    if (
      !target.closest(TRACK_INTERACTIVE) &&
      window.getComputedStyle(target).cursor === "pointer"
    ) {
      trackPush(
        "f",
        section,
        trackClean("dead-click:" + trackDescribe(target), 48),
      );
    }
    return;
  }

  var label = trackLabelFor(el);
  if (!label) return;
  trackPush("c", section || "page", label);
  if (!el.hasAttribute("data-track-norage") && trackIsRage(el)) {
    trackPush("f", section || "page", trackClean("rage-click:" + label, 48));
  }
}

function initTracking() {
  window.LPTrack = {
    event: function (section, label) {
      trackPush("e", trackClean(section, 30), trackClean(label, 40));
    },
  };

  _trk.debug = /[?&]lp_track_debug=1(&|$)/.test(window.location.search);
  var configured =
    TRACK_FORM_ID.indexOf("REPLACE_ME") !== 0 &&
    TRACK_INDICATOR_ID.indexOf("REPLACE_ME") !== 0 &&
    !!CSRF_TOKEN;
  if (IS_SYSADMIN && !TRACK_SYSADMIN && !_trk.debug) return;
  if (!_trk.debug && !configured) return;
  if (!window.IntersectionObserver || !window.WeakSet) return;

  _trk.on = true;
  _trk.src = trackSource();
  var w = window.innerWidth;
  _trk.vp = w < 640 ? "s" : w < 1024 ? "m" : "l";
  _trk.io = new IntersectionObserver(trackOnIntersect, {
    rootMargin: "-20% 0px -20% 0px",
    threshold: 0,
  });

  /* Capture phase: runs before the router's handlers navigate away. */
  document.addEventListener("click", trackOnClick, true);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") trackFlush(true);
  });
  window.addEventListener("pagehide", function () {
    trackFlush(true);
  });
  setInterval(function () {
    trackFlush(false);
  }, TRACK_FLUSH_MS);

  /* File and line only; the message text is never recorded. Script
       errors from other origins arrive without a filename and are skipped. */
  window.addEventListener("error", function (e) {
    if (!e.filename || _trk.errors >= 5) return;
    _trk.errors++;
    var file = String(e.filename).split("?")[0].split("/").pop();
    trackFriction("js-error:" + file + ":" + (e.lineno || 0));
  });

  /* Picks up sections that render after mount (spliced pages,
       JS-built lists). */
  new MutationObserver(function () {
    clearTimeout(_trk.scanTimer);
    _trk.scanTimer = setTimeout(function () {
      trackScan(false);
    }, 300);
  }).observe(document.body, { childList: true, subtree: true });
}
```

### Edit 3: `inject()`. Two small changes.

Find:

```js
    buildRouteMap();

    if (isLaunchpad()) {
```

Replace with:

```js
    buildRouteMap();
    initTracking();

    if (isLaunchpad()) {
```

Find:

```js
    } else {
      var current = resolveCurrentRoute();
      if (current && current !== "home") {
```

Replace with:

```js
    } else {
      var current = resolveCurrentRoute();
      trackView(
        hrefToHashKey(window.location.pathname + window.location.search) ||
          "page",
      );
      if (current && current !== "home") {
```

### Edit 4: `router()`. Three one-line additions.

```js
var articleLink = raw.match(/^#help_library-article-(\d+)$/i);
if (articleLink) {
  trackView("help_library"); // add
  loadView("help_library", ROUTE_MAP.help_library, articleLink[1]);
  return;
}

var key = raw.replace(/^#/, "").toLowerCase();
key = LEGACY_HASH_KEY_ALIASES[key] || key;

if (!key || key === "home" || key === "lp_home") {
  trackView("home"); // add
  showLaunchpadHome();
  return;
}

var route = ROUTE_MAP[key];
trackView(route ? key : "not_found:" + key); // add
loadView(key, route);
```

(Delete the `// add` markers when pasting.)

### Edit 5: page load time and load failures. `loadView()` and `mountIframe()`.

In `loadView`, add a start time before the loading state:

```js
var loadStart = Date.now();
showSwapLoading();
```

After `mountContent(...)` succeeds for that route:

```js
trackLoad(hrefToHashKey(route.href), loadStart);
```

In that function's `.catch` handler:

```js
trackFriction("load-fail", hrefToHashKey(route.href));
```

In `mountIframe`, add `var loadStart = Date.now();` before the iframe `src` is set, and in its `load` handler:

```js
if (!iframe.getAttribute("data-tracked")) {
  iframe.setAttribute("data-tracked", "1");
  trackLoad(hrefToHashKey(route.href), loadStart);
}
```

Use whatever the local variable for the route is called in each function. The home route is not timed because it loads with the shell.

## 3. Edits to `lp_home.html`

Add these attributes. Nothing else in the markup changes.

| Element                                                        | Attribute to add                    |
| -------------------------------------------------------------- | ----------------------------------- |
| `<section class="hero" ...>`                                   | `data-track-section="hero"`         |
| Hero "Build a new site" link                                   | `data-track="build-site"`           |
| Hero `<a href="#find_site" ...>`                               | `data-track="find-site"`            |
| `<button id="mst-open-btn" ...>`                               | `data-track="view-my-requests"`     |
| `<section class="hero-requests" ...>` (the requests panel)     | `data-track-section="my-requests"`  |
| `<div id="mst-root">`                                          | `data-track-mask`                   |
| `<button id="mst-hide-btn" ...>`                               | `data-track="hide-requests"`        |
| `<section id="lp-finder" ...>`                                 | `data-track-section="finder"`       |
| `.finder-cta-primary` link                                     | `data-track="build-site"`           |
| `#finderCtaLinkMatch`                                          | `data-track="talk-to-team"`         |
| `#finderCtaLinkNoMatch`                                        | `data-track="request-consultation"` |
| `.finder-readmore` link                                        | `data-track="read-more"`            |
| `<section id="lp-solutions" ...>`                              | `data-track-section="how-it-works"` |
| Features `<section class="section section-alt" ...>`           | `data-track-section="features"`     |
| Awards `<section class="section" aria-labelledby="awards-h2">` | `data-track-section="awards"`       |
| `<section id="lp-resources" ...>`                              | `data-track-section="newsletter"`   |
| Cost Estimator link                                            | `data-track="cost-estimator"`       |
| Nominate a Spotlight link                                      | `data-track="spotlight-nomination"` |
| Teams Channel link                                             | `data-track="teams-channel"`        |
| Office of Information and Technology link                      | `data-track="oit"`                  |

Finder topic buttons, the topic arrows and the clear button are inside `#lp-finder`, so they're counted automatically (labels come from their text or `aria-label`). Header nav clicks are counted automatically (labels come from each item's route key).

### Finder CTA fix: make the two consult buttons open the support form

Both buttons are `href="#"` with no handler. This reuses the nav's Request Support form (`form_ba7de`) through the existing `form-modal` handler. The `title` value is my assumption, chosen so the support team can tell where the request came from; change it if you prefer another label.

Replace the opening tag of `#finderCtaLinkMatch`:

```html
<a
  href="https://leaf.va.gov/platform/support/report.php?a=LEAF_Start_Request&id=form_ba7de&title=Consultation+Request+from+Launchpad+Finder"
  class="finder-cta-btn finder-cta-secondary"
  id="finderCtaLinkMatch"
  data-action="form-modal"
  data-modal-src="https://leaf.va.gov/platform/support/report.php?a=LEAF_Start_Request&id=form_ba7de&title=Consultation+Request+from+Launchpad+Finder&iframe=1"
  data-modal-title="Request Support"
  data-track="talk-to-team"
></a>
```

Replace the opening tag of `#finderCtaLinkNoMatch`:

```html
<a
  href="https://leaf.va.gov/platform/support/report.php?a=LEAF_Start_Request&id=form_ba7de&title=Consultation+Request+from+Launchpad+Finder"
  class="btn btn-pri"
  id="finderCtaLinkNoMatch"
  data-action="form-modal"
  data-modal-src="https://leaf.va.gov/platform/support/report.php?a=LEAF_Start_Request&id=form_ba7de&title=Consultation+Request+from+Launchpad+Finder&iframe=1"
  data-modal-title="Request Support"
  data-track="request-consultation"
></a>
```

(These two replace the `data-track` rows for those buttons in the table above.) A plain click opens the modal; Ctrl/Cmd-click falls back to the `href` in a new tab.

### Newsletter result events

In the newsletter script, inside `subscribe(email).then(() => { ... })` add as the first line:

```js
window.LPTrack?.event("newsletter", "subscribed");
```

and inside its `.catch((err) => { ... })` add:

```js
window.LPTrack?.event("newsletter", "subscribe-error");
```

### Finder search outcome

Typed searches are reported as hit or miss only. The text is never recorded. In the LEAF Finder script, add above `function render()`:

```js
let searchTimer;
function reportSearch(query, matchCount) {
  clearTimeout(searchTimer);
  if (!query) return;
  searchTimer = setTimeout(() => {
    window.LPTrack?.event(
      "finder",
      matchCount ? "search-match" : "search-no-match",
    );
  }, 1500);
}
```

In `render()`, add `reportSearch("", 0);` just before the `return;` in the `if (!query && !activeTopic)` branch, and add `reportSearch(query, matched.length);` after `toggleNextSteps(matched.length > 0);`.

### Requests panel: hide rate and privacy mask

`view_homepage.tpl` shows the requests grid inline in the hero, with a Hide button. The three attributes above give you:

- **Hide rate:** Hide clicks divided by "Seen" on the My requests panel row in the dashboard's Sections table. Hide clicks also appear under Key actions.
- **Grid engagement:** every click inside `#mst-root` (tabs, sorting, request links) is recorded as `requests-grid`. `data-track-mask` makes the tracker ignore the element text there, so request titles and record IDs are never logged. Without the mask, clicking a request link would store its title.

Apply the same three attributes to the `lp_home.html` copy of the hero if it has the panel.

### Exempt repeat-click controls from rage detection

Add `data-track-norage` to the finder topic arrow buttons (previous / next), or fast paging will be flagged as rage clicks:

```html
<button type="button" data-track="finder-next" data-track-norage></button>
```

### Tag shared links with `?src=`

Add `?src=newsletter`, `?src=teams-post` and so on to links you share. Up to 20 letters, digits, `-` or `_`. Untagged visits fall back to a bucket of the referrer host: `direct`, `teams`, `sharepoint`, `leaf-site`, `va-site`, `other`. The path and query string are never recorded.

## 4. What gets recorded

One JSON value per visit: `{"v":1,"vp":"l","src":"direct","x":0,"ev":[[t,type,route,section,label], ...]}`

| Field     | Meaning                                                                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `t`       | Seconds since page load                                                                                                                             |
| `type`    | `v` view, `i` impression, `c` click, `e` custom event, `p` page load (label is milliseconds, rounded to 100), `f` friction (label is `kind:detail`) |
| `route`   | Hash key (`home`, `find_site`, `help_library`, ...) or `not_found:<key>` for a stale link                                                           |
| `section` | `data-track-section` name, `header`, `announcement`, or `page`                                                                                      |
| `label`   | `data-track` value, else the nav route key, `aria-label`, or trimmed text (max 40 chars)                                                            |
| `vp`      | Viewport bucket: `s` under 640px, `m` under 1024px, `l` above                                                                                       |
| `src`     | Entry source: `tag:<name>` from `?src=`, else `direct`, `teams`, `sharepoint`, `leaf-site`, `va-site`, `other`                                      |
| `x`       | Events dropped after the 120-event cap                                                                                                              |

Friction kinds: `dead-click:<element>` (a click on something that looks clickable, with a pointer cursor, but isn't a link or control), `rage-click:<label>` (4 clicks on one element within 1.5 seconds), `load-fail`, and `js-error:<file>:<line>` (file and line only, never the message, max 5 per visit).

Rules: an impression counts once per view after the section has sat in the middle 60% of the viewport for 1 second. Clicks only count inside `header`, `announcement`, tagged sections, or elements with their own `data-track`. Sysadmins are not tracked (flip `TRACK_SYSADMIN` to change). The record is written on tab hide, page leave, and every 60 seconds while there are new events.

## 5. Test it

1. Open `report.php?a=lp_home&lp_track_debug=1`. Events print in the console and nothing is sent. Works for sysadmins and before the form exists.
2. After the form IDs are filled in, load the page as a non-sysadmin, click around, switch tabs, then open the new record in the form. Confirm it contains the JSON.
3. Confirm the record shows up where you plan to report from (flag 2).

## 6. Review: what I'd fix or verify before shipping

1. **The data is not fully anonymous at the storage layer.** The JSON has no identifiers, but LEAF stamps every record with the creating user's ID. Anyone with read access to the form can see who made which record. Restrict read access to the LEAF team, and confirm with your privacy or ISSO contact before launch. If that isn't acceptable, this storage choice needs rethinking.
2. **Unsubmitted records: probably fine, still verify.** I deliberately never submit, so the overwrite-on-flush approach works. `multigrid.js` already shows unsubmitted records coming back from `api/form/query` (it labels them "Not Submitted"), which is encouraging, but that query filters by user rather than by form. Confirm with one real tracking record. Report Builder's behavior is unchecked.
3. **Audit history may grow.** If LEAF keeps a history row per indicator overwrite (I believe it does, but haven't verified), each flush adds a row holding the full JSON. If that's a problem, set `TRACK_FLUSH_MS` very high so it only writes on tab hide and page leave.
4. **Payload size vs the field limit: unverified.** A 120-event visit is roughly 8 KB. Confirm the multi-line text field accepts that, or lower `TRACK_MAX_EVENTS`.
5. **Record volume.** One record per page load, including refreshes and bots. There is no sampling yet. If volume becomes a problem, sampling or a daily rollup job is the next step.
6. **Finder consult buttons were dead.** `#finderCtaLinkMatch` and `#finderCtaLinkNoMatch` were `href="#"` with no handler. The fix is in section 3. Two things to confirm: that `form_ba7de` on the support site is the right form for these requests, and that you want the `title` label I chose.
7. **Blind spots.** Anything inside iframes (Help Library, form modals) is invisible. External links count the click, not the arrival. Free-text finder queries are not logged, so "no match" shows how often but not what people typed.
8. **Labels fall back to visible text.** If copy changes, the label changes and the history splits. Put `data-track` on anything you want to trend over time.
9. **Sysadmin exclusion depends on `data-is-sysadmin`.** The header comment in `lp_home.html` says it's still hardcoded to `"0"`, though the tag in the file I read has the real Smarty conditional. If the live page is still hardcoded, internal clicks will be counted.
10. **Rare out-of-order write.** A tab-hide write can overtake an in-flight periodic write. Worst case is a slightly older snapshot, since every write holds the full list.
11. **Tested in a simulated browser only.** I ran the tracker in jsdom with a stubbed IntersectionObserver and stubbed API calls (clicks, labels, dwell, once-per-view impressions, caps, failure shutdown, sysadmin skip, debug mode). It has not run in a real browser or against the real LEAF API.

12. **Dead-click false positives.** A click on an element with `cursor: pointer` and a mouse-only handler but no role or tabindex is logged as dead even though it works. The Awards images have a pointer cursor but aren't links, so expect them to show up; whether that's a real problem is your call (they may deserve a link).
13. **Rage-click false positives.** Anything meant to be clicked repeatedly looks like rage. Use `data-track-norage` on those.
14. **Bounce definition.** One page view and no tracked clicks. A visitor who reads the whole page and leaves counts as a bounce, and so does someone who uses only controls in untagged areas. Read it as "didn't interact", not "unhappy".
15. **Where people go next** is built from the order of page views in a visit. "Left or stayed" can't tell leaving from staying on the page, and external-link clicks are counted as clicks, not arrivals.
16. **Load time** covers pages loaded into the shell, measured from route start to content mounted. Home isn't timed. The slow threshold is 3 seconds (`SLOW_MS` in `lp_usage.html`).
17. **Leaving before the record exists loses data.** The first event creates the record; if the visitor leaves before that call returns, nothing is written. Fast bounces are slightly undercounted.
18. **Dashboard tested with sample and synthetic data only.** I checked bounce 50%, next-step split, per-source bounce, load median and p90, and the dead-click row against a hand-built four-visit dataset, plus an accessibility scan. Real API behavior is untested.

19. **Hide rate is slightly understated.** A panel counts as seen after 1 second in view, so a visitor who hides it faster than that adds a hide but no view. I haven't seen the live `multigrid.js` (the project copy is the older modal version), so I can't confirm whether Hide remembers its state or what Show does. If reopening is done by the View My Requests button, those clicks are counted there.
20. **The mask is by attribute.** Anything new rendered inside `#mst-root` is covered automatically, but links added to the grid outside it would fall back to their text.

## 7. Dashboard page: `lp_usage.html`

New sysadmin-only page ("Launchpad Usage"), styled and gated like the Leadership Hub. It shows visits, page views, clicks, click rate per section, most-clicked items, key actions, finder outcomes, pages viewed (including broken links), and screen sizes, with time-range and screen-size filters. All numbers are computed in the browser from the tracking records.

Until the two `REPLACE_ME` values in its `CONFIG` are filled in, it shows generated sample data under a visible "Sample data" banner, so it can't be mistaken for real numbers.

### Edit A: `leaf_header.js`, register the route

Add next to the other `INTERNAL_*_ROUTE` constants:

```js
var INTERNAL_USAGE_ROUTE = {
  href: "/launchpad/report.php?a=lp_usage",
  title: "Launchpad Usage",
  section: "Internal",
  parent: {
    label: "Leadership",
    href: "/launchpad/report.php?a=lp_leadership",
  },
};
```

In `buildRouteMap()`, after the Admin registration:

```js
var usageKey = hrefToHashKey(INTERNAL_USAGE_ROUTE.href);
if (usageKey) {
  ROUTE_MAP[usageKey] = INTERNAL_USAGE_ROUTE;
}
```

In `HREF_HASH_KEY_OVERRIDES`, next to the `lp_team` entry:

```js
    "/launchpad/report.php?a=lp_usage": "usage",
```

### Edit B: `lp_leadership.html`, add a card

Add as the last card inside `.ldh-grid` (it uses icons already in the project, so there is no new icon to download):

```html
<!-- 7. Launchpad Usage -->
<a
  class="ldh-card"
  href="/launchpad/report.php?a=lp_usage"
  role="listitem"
  aria-label="Launchpad Usage: views, impressions, and clicks"
>
  <div class="ldh-card-top">
    <span class="ldh-icon" aria-hidden="true">
      <span class="material-symbols-outlined" aria-hidden="true"
        ><svg viewBox="0 -960 960 960" fill="currentColor">
          <path
            d="M284-277h60v-205h-60v205Zm332 0h60v-420h-60v420Zm-166 0h60v-118h-60v118Zm0-205h60v-60h-60v60ZM180-120q-24 0-42-18t-18-42v-600q0-24 18-42t42-18h600q24 0 42 18t18 42v600q0 24-18 42t-42 18H180Z"
          /></svg
      ></span>
    </span>
    <span class="ldh-chip ldh-chip--live">Live</span>
  </div>
  <h2 class="ldh-card-title">Launchpad Usage</h2>
  <p class="ldh-card-desc">
    Page views, section impressions, and clicks across the Launchpad.
  </p>
  <span class="ldh-card-action" aria-hidden="true">
    Open dashboard
    <span class="material-symbols-outlined" aria-hidden="true"
      ><svg viewBox="0 -960 960 960" fill="currentColor">
        <path
          d="M686-450H160v-60h526L438-758l42-42 320 320-320 320-42-42 248-248Z"
        /></svg
    ></span>
  </span>
</a>
```

### Edit C: publish `lp_usage.html` as `report.php?a=lp_usage`, the same way you publish the other `lp_*` pages. I don't know your exact publishing steps, so I haven't spelled them out.

### What the dashboard shows

Visits, page views, clicks, clicks per visit and bounce rate; sections (seen, clicked, click rate); most-clicked items; where people go next from a chosen starting page (default Home); key actions and finder outcomes; entry sources with bounce rate; screen sizes; pages viewed (stale links flagged); page load time per page (typical, slowest 1 in 10, share at 3 seconds or more); and friction events with the visits affected.

### How it reads the data

It queries the tracking form from `service_requests_launchpad` in batches of 500 (up to 10,000 visits), skips unreadable records and reports how many, and asks the API to leave creator IDs out of the response. Every label is HTML-escaped before display.

### Dashboard review: what I'd verify before shipping

1. **Query behavior is modeled on your other pages, not tested against this form.** It uses the `recordID > 0` term and no server-side sort (per the `lp_blog.html` comments), `rec.date` for the visit date, `rec.s1.id<indicator>` for the JSON, and `x-filterData=recordID,date`. `multigrid.js` uses the same `date`, `s1` and `x-filterData` pieces, but the `categoryID` term and the combination as a whole need one real run.
2. **Entity-encoded JSON.** If the API returns the text HTML-encoded, the page decodes common entities and retries. If both attempts fail the record is skipped and counted in the status line.
3. **10,000-visit ceiling.** Past that, the status line says older visits are missing. A daily rollup would be the fix at that volume.
4. **Sysadmin read access.** The page only works if sysadmins can read the tracking form's records. If the form's read permission is limited to a smaller group, the page shows its load-error message.
5. **Accessibility.** The tests found no structural issues (tables have captions and row/column headers, scroll regions are keyboard-focusable, bars are decorative with the numbers beside them, forced-colors mode is handled). **Color contrast was not tested** since the test environment can't compute it; check the muted text and bar colors in a real browser. I removed `role="contentinfo"` from this page's footer because it is nested in `<main>`. The Leadership Hub has the same pattern and I did not change it.
6. **Landmarks.** It uses the same `<main id="lp-main">` as the other pages, so it carries the nested-`<main>` issue already in your backlog.
7. **Mirror the tracking attributes and CTA fix in `view_homepage.tpl`.** It looks like a copy of the same homepage. I did not diff it, so check it before cutover.
