LEAF UI Map - Repo Archeology Report

1. UI Rendering Surfaces & Tech Stacks  


A. PHP + Smarty Templates (PRIMARY rendering engine)

The dominant rendering path. PHP controllers (index.php) use Smarty to assemble .tpl files into full
HTML pages.

┌────────────────────────────────┬──────────────────────────────────────┐
│ Evidence │ Path │
├────────────────────────────────┼──────────────────────────────────────┤
│ Portal entry point │ LEAF_Request_Portal/index.php │
├────────────────────────────────┼──────────────────────────────────────┤
│ Nexus entry point │ LEAF_Nexus/index.php │
├────────────────────────────────┼──────────────────────────────────────┤
│ Admin entry point │ LEAF_Request_Portal/admin/index.php │
├────────────────────────────────┼──────────────────────────────────────┤
│ Smarty engine │ app/libs/smarty/Smarty.class.php │
├────────────────────────────────┼──────────────────────────────────────┤
│ Autoloader (bootstraps Smarty) │ app/libs/loaders/Leaf_autoloader.php │
└────────────────────────────────┴──────────────────────────────────────┘

Pattern: PHP controllers do $main = new Smarty; then $main->assign('body', ...) and
$main->fetch('main.tpl').

B. jQuery + jQuery UI (PRIMARY client-side framework)

jQuery is the workhorse for all DOM manipulation, AJAX, dialogs, and interactive components.

┌────────────────────────────┬────────────────────────────────────────────────┐
│ Evidence │ Path │
├────────────────────────────┼────────────────────────────────────────────────┤
│ jQuery core │ app/libs/js/jquery/jquery.min.js │
├────────────────────────────┼────────────────────────────────────────────────┤
│ jQuery UI │ app/libs/js/jquery/jquery-ui.custom.min.js │
├────────────────────────────┼────────────────────────────────────────────────┤
│ jQuery Chosen (dropdowns) │ app/libs/js/jquery/chosen/chosen.jquery.min.js │
├────────────────────────────┼────────────────────────────────────────────────┤
│ Trumbowyg (WYSIWYG editor) │ app/libs/js/jquery/trumbowyg/trumbowyg.min.js │
├────────────────────────────┼────────────────────────────────────────────────┤
│ iCheck (checkboxes) │ app/libs/js/jquery/icheck/icheck.js │
└────────────────────────────┴────────────────────────────────────────────────┘

C. Vue 3 (NEWER, limited to 2 admin features)

Vue 3 is used for the Form Editor and Site Designer admin tools. Built via webpack in docker/vue-app/,
compiled output lands in app/libs/js/vue-dest/.

┌──────────────────────────┬────────────────────────────────────────────────────────┐
│ Evidence │ Path │
├──────────────────────────┼────────────────────────────────────────────────────────┤
│ Vue 3 runtime │ app/libs/js/vue3/vue.global.prod.js │
├──────────────────────────┼────────────────────────────────────────────────────────┤
│ Form Editor (source) │ docker/vue-app/src/form_editor/LEAF_FormEditor_main.js │
├──────────────────────────┼────────────────────────────────────────────────────────┤
│ Site Designer (source) │ docker/vue-app/src/site_designer/LEAF_Designer_main.js │
├──────────────────────────┼────────────────────────────────────────────────────────┤
│ Form Editor (compiled) │ app/libs/js/vue-dest/form_editor/LEAF_FormEditor.js │
├──────────────────────────┼────────────────────────────────────────────────────────┤
│ Site Designer (compiled) │ app/libs/js/vue-dest/site_designer/LEAF_Designer.js │
└──────────────────────────┴────────────────────────────────────────────────────────┘

D. Vanilla JavaScript (SIGNIFICANT - custom UI "components")

Several large vanilla JS constructors act as the core reusable UI layer, rendering HTML via template
literals and jQuery.

┌──────────────────────┬────────────────────────────────────────────┐
│ Evidence │ Path │
├──────────────────────┼────────────────────────────────────────────┤
│ Grid/table rendering │ app/libs/js/LEAF/formGrid.js │
├──────────────────────┼────────────────────────────────────────────┤
│ Search interface │ app/libs/js/LEAF/formSearch.js │
├──────────────────────┼────────────────────────────────────────────┤
│ Query builder │ app/libs/js/LEAF/formQuery.js │
├──────────────────────┼────────────────────────────────────────────┤
│ Dialog controller │ LEAF_Request_Portal/js/dialogController.js │
├──────────────────────┼────────────────────────────────────────────┤
│ Inbox view │ libs/js/LEAF/inbox/view_inbox.js │
└──────────────────────┴────────────────────────────────────────────┘

E. Legacy Vue 2 (two inline instances)

Two older Vue components, not using SFCs or build tools:

Evidence: Conditions editor
Path: LEAF_Request_Portal/js/vue_conditions_editor/LEAF_conditions_editor.js
────────────────────────────────────────
Evidence: Combined inbox editor
Path: LEAF_Request_Portal/js/combined_inbox_editor/src/combined_inbox_editor.vue.js

F. No React, No Angular, No Bootstrap, No Tailwind

- Bootstrap: NOT present. The word "bootstrap" appears only in Smarty/PHP autoloader context
  (libs/smarty/bootstrap.php).
- USWDS: NOT used as a package, but USWDS color tokens are manually reimplemented in
  docker/vue-app/src/sass/leaf-colors.scss.
- No component framework (no React, Angular, Svelte, etc.)

---

2. Reusable UI Pattern Locations

A. Template Directories (Smarty .tpl files)

┌──────────────────────────────────────┬────────────┬─────────────────────┐
│ Directory │ File count │ Purpose │
├──────────────────────────────────────┼────────────┼─────────────────────┤
│ LEAF_Request_Portal/templates/ │ ~38 files │ Portal page views │
├──────────────────────────────────────┼────────────┼─────────────────────┤
│ LEAF_Request_Portal/admin/templates/ │ ~35 files │ Admin panel modules │
├──────────────────────────────────────┼────────────┼─────────────────────┤
│ LEAF_Nexus/templates/ │ ~30 files │ Org chart views │
├──────────────────────────────────────┼────────────┼─────────────────────┤
│ LEAF_Nexus/admin/templates/ │ ~14 files │ Nexus admin │
└──────────────────────────────────────┴────────────┴─────────────────────┘

B. Shared Template Fragments ("site_elements")

These are the closest thing to reusable UI components:

Path: LEAF_Request_Portal/templates/site_elements/generic_xhrDialog.tpl
What it provides: AJAX dialog with Save/Cancel
────────────────────────────────────────
Path: LEAF_Request_Portal/templates/site_elements/generic_confirm_xhrDialog.tpl
What it provides: Confirmation dialog
────────────────────────────────────────
Path: LEAF_Request_Portal/templates/site_elements/generic_OkDialog.tpl
What it provides: Simple OK dialog
────────────────────────────────────────
Path: LEAF_Request_Portal/templates/site_elements/generic_dialog.tpl
What it provides: Base dialog wrapper
────────────────────────────────────────
Path: LEAF_Request_Portal/admin/templates/partial_layouts/left_side_nav.tpl
What it provides: Left nav partial

C. Shared JS "Components" (constructor-based)

┌────────────────────────────────────────────┬─────────────────────────────────────────────────────┐
│ Path │ Pattern provided │
├────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
│ app/libs/js/LEAF/formGrid.js │ Data table with sorting, pagination, sticky headers │
├────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
│ app/libs/js/LEAF/formQuery.js │ Query builder with batching and progress │
├────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
│ app/libs/js/LEAF/formSearch.js │ Search interface │
├────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
│ LEAF_Request_Portal/js/dialogController.js │ jQuery UI dialog wrapper with validation │
├────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
│ LEAF_Nexus/js/employeeSelector.js │ Employee picker │
├────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
│ LEAF_Nexus/js/positionSelector.js │ Position picker │
└────────────────────────────────────────────┴─────────────────────────────────────────────────────┘

D. Vue 3 Component Directories

┌──────────────────────────────────────────────┬─────────────────────────────────────┐
│ Path │ What │
├──────────────────────────────────────────────┼─────────────────────────────────────┤
│ docker/vue-app/src/common/components/ │ Shared Vue components (3 files) │
├──────────────────────────────────────────────┼─────────────────────────────────────┤
│ docker/vue-app/src/form_editor/components/ │ Form Editor components (~15 files) │
├──────────────────────────────────────────────┼─────────────────────────────────────┤
│ docker/vue-app/src/site_designer/components/ │ Site Designer components (~4 files) │
└──────────────────────────────────────────────┴─────────────────────────────────────┘

Representative shared Vue components:

- docker/vue-app/src/common/components/LeafFormDialog.js - Modal dialog
- docker/vue-app/src/common/components/BasicConfirmDialog.js - Confirm dialog
- docker/vue-app/src/common/components/HistoryDialog.js - History viewer

E. Shared API Helpers

┌─────────────────────────────────────┬─────────────────────────┐
│ Path │ Purpose │
├─────────────────────────────────────┼─────────────────────────┤
│ app/libs/js/portal/LEAFPortalAPI.js │ Portal REST API wrapper │
├─────────────────────────────────────┼─────────────────────────┤
│ app/libs/js/nexus/LEAFNexusAPI.js │ Nexus REST API wrapper │
├─────────────────────────────────────┼─────────────────────────┤
│ app/libs/js/LEAF/XSSHelpers.js │ XSS sanitization │
└─────────────────────────────────────┴─────────────────────────┘

F. Report Templates (reusable patterns)

LEAF_Request_Portal/templates/reports/ contains ~15 report templates that all follow the same
LeafFormGrid + LeafFormQuery pattern:

- LEAF_Request_Portal/templates/reports/LEAF_mass_action.tpl
- LEAF_Request_Portal/templates/reports/LEAF_Timeline_Explorer.tpl
- LEAF_Request_Portal/templates/reports/LEAF_Inbox.tpl
- LEAF_Request_Portal/templates/reports/LEAF_Data_Visualizer.tpl

---

3. Styling Sources

A. Global CSS Entry Points

File: app/libs/css/leaf.css
Scope: All pages
Size: 9 lines (minified)
Role: Global compiled styles (fonts, base)
────────────────────────────────────────
File: LEAF_Request_Portal/css/style.css
Scope: Portal
Size: 1,667 lines
Role: Portal-specific styles
────────────────────────────────────────
File: LEAF_Nexus/css/style.css
Scope: Nexus
Size: (separate)
Role: Nexus-specific styles
────────────────────────────────────────
File: LEAF_Request_Portal/admin/css/style.css
Scope: Admin
Size: (separate)
Role: Admin panel styles

B. CSS Loading Chain (from main.tpl)

jquery-ui.custom.min.css (jQuery UI theme)
{dynamic stylesheets} (per-page)
css/style.css (portal/nexus main)
chosen.min.css (dropdown styling)
trumbowyg.min.css (WYSIWYG editor)
icheck blue.css (checkbox styling)

C. SCSS (Vue apps only)

┌────────────────────────────────────────────────────────┬──────────────────────────────────────────┐
│ File │ Purpose │
├────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
│ docker/vue-app/src/sass/styles.scss │ Entry point: imports leaf + colors + nav │
├────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
│ docker/vue-app/src/sass/leaf.scss │ Global overrides, font-face declarations │
├────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
│ docker/vue-app/src/sass/leaf-colors.scss │ USWDS color utility classes │
├────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
│ docker/vue-app/src/sass/leaf-nav.scss │ Navigation styles │
├────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
│ docker/vue-app/src/form_editor/LEAF_FormEditor.scss │ Form editor specific │
├────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
│ docker/vue-app/src/common/LEAF_Vue_Dialog\_\_Common.scss │ Shared dialog styles │
└────────────────────────────────────────────────────────┴──────────────────────────────────────────┘

D. Design Tokens

CSS Custom Properties: Found only in one file:

- LEAF_Request_Portal/js/vue_conditions_editor/LEAF_conditions_editor.css defines --charcoal,
  --dark-navy, --base-navy, --cyan, --lt-cyan

SCSS Variables (Vue apps only):

- docker/vue-app/src/sass/leaf.scss: $usa-gray: #dfe1e2, $btn-green: #008a17, $base_navy: #005EA2

USWDS-inspired utility classes: docker/vue-app/src/sass/leaf-colors.scss reimplements ~60 USWDS
background and text color classes (e.g., .bg-blue-50, .text-red-50).

No formal design token file (no JSON/YAML token definitions). Colors are hardcoded in individual CSS
files.

E. Fonts

- Public Sans (USWDS standard font) - app/libs/css/fonts/public-sans/
- Source Sans Pro - app/libs/css/fonts/source-sans-pro/
- Font Awesome (solid) - app/libs/css/fonts/fontawesome/
- Verdana - set as font-family in LEAF_Request_Portal/css/style.css:2 (the actual body font for legacy
  pages)

F. Icons

- dynicons: SVG icon system at app/libs/dynicons/ - PHP-based dynamic SVG resizer used via URL
  dynicons/?img=icon-name.svg&w=16
- Font Awesome (fa-solid) for Vue components
- USA icons: minimal, app/libs/img/usa-icons/unfold_more.svg

---

4. UI Map Summary

Where UI Is Defined

Layer: Page shell/layout
Tech: Smarty .tpl
Location: _/templates/main.tpl (Portal + Nexus)
────────────────────────────────────────
Layer: Page content
Tech: Smarty .tpl
Location: _/templates/_.tpl (~120 files total)
────────────────────────────────────────
Layer: Interactive components
Tech: jQuery + vanilla JS
Location: app/libs/js/LEAF/ + _/js/_.js
────────────────────────────────────────
Layer: Modern admin tools
Tech: Vue 3
Location: docker/vue-app/src/ (source), app/libs/js/vue-dest/ (built)
────────────────────────────────────────
Layer: Reusable dialog fragments
Tech: Smarty .tpl
Location: _/templates/site_elements/

Where Styles Come From

┌───────────────────────────────────┬─────────────────────────────────────┐
│ Source │ Scope │
├───────────────────────────────────┼─────────────────────────────────────┤
│ app/libs/css/leaf.css (minified) │ Global base │
├───────────────────────────────────┼─────────────────────────────────────┤
│ LEAF_Request_Portal/css/style.css │ Portal (1,667 lines, Verdana-based) │
├───────────────────────────────────┼─────────────────────────────────────┤
│ jQuery UI theme CSS │ Dialog chrome, datepickers │
├───────────────────────────────────┼─────────────────────────────────────┤
│ SCSS compiled via webpack │ Vue components only │
├───────────────────────────────────┼─────────────────────────────────────┤
│ Inline styles in .tpl files │ Widespread │
└───────────────────────────────────┴─────────────────────────────────────┘

Top 5 Most Repeated UI Patterns

1. Data Grid (LeafFormGrid) - Used in search, reports, inbox, admin views. Renders sortable tables with
   sticky headers and pagination.


    - Evidence: app/libs/js/LEAF/formGrid.js, used in 15+ .tpl files

2. XHR Dialog (dialogController + generic_xhrDialog.tpl) - Modal dialog with Save/Cancel buttons,
   loading indicator, AJAX content loading.


    - Evidence: LEAF_Request_Portal/js/dialogController.js,

_/templates/site_elements/generic_xhrDialog.tpl 3. Form Query + Search (LeafFormQuery + LeafFormSearch) - Programmatic query builder with batched API
calls, tied to grid rendering. - Evidence: app/libs/js/LEAF/formQuery.js, app/libs/js/LEAF/formSearch.js 4. Button with dynicon - <button class="buttonNorm"><img src="dynicons/?img=X.svg&w=16" />
Label</button> - appears in 15+ template files. - Evidence: LEAF_Request_Portal/templates/menu.tpl, _/templates/site_elements/\*.tpl 5. Nav Menu with popup - Header menu pattern using toggleMenuPopup(), aria-expanded, aria-controls with
controlled popover divs. - Evidence: LEAF_Request_Portal/templates/menu.tpl

Best 5 Canonical Pattern Files

File: LEAF_Request_Portal/templates/main.tpl
Why canonical: The master layout. Shows how every page is assembled: CSS loading order, JS loading,
header/body/footer structure.
────────────────────────────────────────
File: app/libs/js/LEAF/formGrid.js
Why canonical: The most reused JS component. Shows the pattern for building interactive UI: constructor

    function, jQuery DOM manipulation, template literals, public API via return object.

────────────────────────────────────────
File: LEAF_Request_Portal/js/dialogController.js
Why canonical: The dialog pattern. Shows how modals work: jQuery UI .dialog(), validation, save/cancel
flow.
────────────────────────────────────────
File: LEAF_Request_Portal/templates/view_search.tpl
Why canonical: A representative full page. Shows how LeafFormGrid + LeafFormQuery + dialogController
are
composed together in a Smarty template.
────────────────────────────────────────
File: docker/vue-app/src/common/components/LeafFormDialog.js
Why canonical: The Vue 3 dialog pattern. Shows the "modern" approach: Vue 3 options API,
provide/inject,
manual DOM manipulation for draggable modals, accessibility focus management.
