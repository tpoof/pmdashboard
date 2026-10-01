# Known issues backlog

## Sysadmin nav bar overflows the page horizontally at 900-901px

- **Source:** leaf_header.js internal nav bar (`.lp-nav-internal`) and leaf_header.css
- **Impact:** about 475px of horizontal page scroll for sysadmins at 900-901px wide. Fails WCAG 1.4.10 Reflow for sysadmins.
- **Found:** while testing the home page hero split. Not caused by the hero change.
- **Fix:** needs a leaf_header.css fix.

## Grid modal mode would stack two modals

- **Source:** multigrid.js modal path (`data-trigger`)
- **Impact:** if multigrid.js is used with `data-trigger` again, a record opened from the grid modal opens leaf_header.js's form modal on top of it. z-index, Escape order and scroll lock would then need guards.
- **Status:** the modal path is unused on the home page, now that View My Requests restores the panel in place.

## Long request titles make a tall record-modal header

- **Source:** `.modal-hd-title` in leaf_header.css
- **Impact:** a 140-character title makes the header about 214px tall at 320px wide.
- **Fix:** clamp `.modal-hd-title` to 2-3 lines and put the full title in a `title` attribute. Every form modal shares this style, so test them all.

## Route dependency URLs resolve against the Launchpad, not the route

- **Source:** `collectLeafUIDepSrcs()` in leaf_header.js
- **Impact:** it reads `script.src` inside the DOMParser document, so relative dependency paths resolve against the Launchpad's URL instead of the fetched route's. `js/dialogController.js` only works because the Launchpad has its own copy. A route whose dependency exists only on its own site would load the wrong file or a 404.
- **Fix:** resolve each src against the route's directory (the same value used for `<base id="lp-route-base">`).

## Ideas route markup reuses the shell's IDs

- **Source:** ideas_v4.html (`#lp-root`, `#lp-main`, `#lp-nav-host`), mounted inside the Launchpad shell
- **Impact:** while Ideas is mounted, the page has two of each ID. The swap host comes first in the DOM, so `getElementById` returns Ideas' copy. That's harmless today, since the router caches its own elements and ideas_v4.js scopes `#lp-main` to its root. Duplicate IDs still fail WCAG 4.1.1 parsing checks in some tools.
- **Fix:** rename the Ideas IDs, or have ideas_v4.html render only its inner content.
