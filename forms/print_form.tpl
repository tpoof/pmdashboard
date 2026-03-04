<!--{*
    print_form.tpl
    Full print/review view for a LEAF request.
    Depends on: leaf-forms.css (linked in site base or here)

    Tab structure:
      Tab 0  — Main Request   (ajaxIndex.php?a=printview)
      Tab N  — Each childform (ajaxIndex.php?a=internalonlyview&childCategoryID=X)
*}-->

<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/leaf-forms.css" />

<div class="lf-root">

<!--{* ── Deleted banner ────────────────────────────────────────── *}-->
<!--{if $deleted > 0}-->
<div class="lf-banner lf-banner-danger" style="margin: 16px 20px 0">
    <img src="dynicons/?img=emblem-unreadable.svg&amp;w=32" alt="" />
    <div>
        <strong>This request has been marked as cancelled</strong> and will be permanently deleted.
        <button
            type="button"
            class="lf-btn lf-btn-ghost"
            style="margin-left:12px"
            onclick="restoreRequest(<!--{$recordID|strip_tags}-->)">
            ↩ Restore Request
        </button>
    </div>
</div>
<!--{/if}-->

<!--{* ── Page grid ─────────────────────────────────────────────── *}-->
<div class="lf-page" id="maincontent">

    <!--{* ════════════════════════════════════════════════
        MAIN CONTENT COLUMN
        ════════════════════════════════════════════════ *}-->
    <main class="lf-page-main">

        <!--{* Progress bar (unsubmitted forms only) *}-->
        <!--{if $submitted == 0}-->
        <div class="lf-progress-row lf-animate-in lf-noprint" id="progressSidebar">
            <span class="lf-progress-label">Form completion</span>
            <div class="lf-progress-track">
                <div class="lf-progress-fill" id="progressBar" style="width:0%"></div>
            </div>
            <span class="lf-progress-pct" id="progressLabel">0%</span>
            <div id="submitContent" style="margin-left:8px"></div>
        </div>
        <!--{/if}-->

        <!--{* Workflow content (shown after submit) *}-->
        <div id="workflowcontent"></div>

        <!--{* Accessible status announcer *}-->
        <span
            class="lf-sr-only"
            aria-atomic="true"
            aria-live="polite"
            id="submitStatus"
            role="status">
        </span>

        <!--{* ── Tab navigation ──────────────────────────────── *}-->
        <div class="lf-tabs-wrap lf-animate-in" id="formTabsWrap">

            <div class="lf-tabs-header" role="tablist" id="formTabStrip">
                <!--{* Main request tab — always first *}-->
                <button
                    class="lf-tab-btn lf-active"
                    role="tab"
                    aria-selected="true"
                    aria-controls="lf-tab-0"
                    id="lf-tabctrl-0"
                    onclick="lfSwitchTab(0)">
                    Main Request
                </button>

                <!--{* One tab per child category *}-->
                <!--{section name=i loop=$childforms}-->
                <button
                    class="lf-tab-btn"
                    role="tab"
                    aria-selected="false"
                    aria-controls="lf-tab-<!--{$smarty.section.i.index+1}-->"
                    id="lf-tabctrl-<!--{$smarty.section.i.index+1}-->"
                    onclick="lfSwitchTab(<!--{$smarty.section.i.index+1}-->)">
                    <!--{$childforms[i].childCategoryName|sanitize}-->
                </button>
                <!--{/section}-->
            </div>

            <!--{* Main request panel *}-->
            <div
                class="lf-tab-panel lf-active"
                role="tabpanel"
                id="lf-tab-0"
                aria-labelledby="lf-tabctrl-0">
                <div id="formcontent">
                    <div class="lf-banner lf-banner-warning" style="margin:20px">
                        Loading&hellip;
                        <img src="images/largespinner.gif" alt="" style="margin-left:8px" />
                    </div>
                </div>
            </div>

            <!--{* Child category panels — content loaded on tab click *}-->
            <!--{section name=i loop=$childforms}-->
            <div
                class="lf-tab-panel"
                role="tabpanel"
                id="lf-tab-<!--{$smarty.section.i.index+1}-->"
                aria-labelledby="lf-tabctrl-<!--{$smarty.section.i.index+1}-->"
                data-child-category-id="<!--{$childforms[i].childCategoryID|strip_tags}-->"
                data-loaded="0">
                <!--{* Content injected on first activation *}-->
            </div>
            <!--{/section}-->

        </div>

    </main>

    <!--{* ════════════════════════════════════════════════
        SIDEBAR
        ════════════════════════════════════════════════ *}-->
    <aside class="lf-page-aside lf-noprint" id="toolbar">

        <!--{* ── Tools panel ─────────────────────────────── *}-->
        <div class="lf-panel">
            <div class="lf-panel-header lf-open" onclick="lfTogglePanel(this)" aria-expanded="true">
                <span class="lf-panel-title">Tools</span>
                <span class="lf-panel-chevron">▾</span>
            </div>
            <div class="lf-panel-body">
                <div class="lf-tool-list">
                    <!--{if $submitted == 0}-->
                    <button type="button" class="lf-tool-btn"
                        onclick="window.location='?a=view&amp;recordID=<!--{$recordID|strip_tags}-->'">
                        <span class="lf-tool-icon">✎</span> Edit this form
                    </button>
                    <!--{/if}-->
                    <button type="button" class="lf-tool-btn" onclick="viewHistory()">
                        <span class="lf-tool-icon">⏱</span> View History
                    </button>
                    <button type="button" class="lf-tool-btn"
                        onclick="window.location='mailto:?subject=FW:%20Request%20%23<!--{$recordID|strip_tags}-->%20-%20<!--{$title|escape:'url'}-->&amp;body=Request%20URL:%20<!--{if $smarty.server.HTTPS == on}-->https<!--{else}-->http<!--{/if}-->://<!--{$smarty.server.SERVER_NAME}--><!--{$smarty.server.REQUEST_URI|escape:'url'}-->%0A%0A'">
                        <span class="lf-tool-icon">✉</span> Write Email
                    </button>
                    <button type="button" class="lf-tool-btn" id="btn_printForm" title="Print this form">
                        <span class="lf-tool-icon">🖨</span> Print to PDF
                        <span style="font-size:.65rem; background:white; color:#d00; border:1px solid #ccc; padding:1px 4px; border-radius:3px; margin-left:4px">BETA</span>
                    </button>
                    <input type="hidden" id="abs_portal_path" value="<!--{$abs_portal_path}-->" />
                    <button type="button" class="lf-tool-btn" onclick="toggleBookmark()" id="tool_bookmarkText">
                        <span class="lf-tool-icon">🔖</span>
                        <span role="status" aria-live="polite">
                            <!--{if $bookmarked == ''}-->Add Bookmark<!--{else}-->Delete Bookmark<!--{/if}-->
                        </span>
                    </button>
                    <button type="button" class="lf-tool-btn" onclick="copyRequest()">
                        <span class="lf-tool-icon">⎘</span> Copy Request
                    </button>
                    <div class="lf-tool-sep"></div>
                    <!--{if $submitted == 0 || $is_admin}-->
                    <button type="button" class="lf-tool-btn lf-danger" id="btn_cancelRequest" onclick="cancelRequest()">
                        <span class="lf-tool-icon">✕</span> Cancel Request
                    </button>
                    <!--{/if}-->
                </div>
            </div>
        </div>

        <!--{* ── Comments panel ──────────────────────────── *}-->
        <div class="lf-panel" id="commentsPanel"<!--{if not $stepID > 0 && not $comments}--> style="display:none"<!--{/if}-->>
            <div class="lf-panel-header lf-open" onclick="lfTogglePanel(this)" aria-expanded="true">
                <span class="lf-panel-title">Comments</span>
                <span class="lf-panel-chevron">▾</span>
            </div>
            <div class="lf-panel-body">
                <div class="lf-comment-list" id="commentsList">
                    <!--{section name=i loop=$comments}-->
                    <div class="lf-comment-item">
                        <div class="lf-comment-meta">
                            <span class="lf-comment-author"><!--{$comments[i].name}--></span>
                            <span><!--{$comments[i].time|date_format:'%b %e'|escape}--></span>
                            <span>·</span>
                            <span><!--{$comments[i].actionTextPasttense|sanitize}--></span>
                        </div>
                        <div class="lf-comment-text"><!--{$comments[i].comment|sanitize}--></div>
                    </div>
                    <!--{/section}-->
                </div>

                <div id="notes"<!--{if not $stepID > 0}--> style="display:none"<!--{/if}-->>
                    <div class="lf-comment-input-row" style="margin-top:8px">
                        <input
                            type="hidden"
                            name="userID"
                            value="<!--{$userID|strip_tags}-->" />
                        <input
                            type="text"
                            id="note"
                            name="note"
                            class="lf-comment-input"
                            placeholder="Add a note…"
                            aria-label="Comment text" />
                        <button
                            type="button"
                            id="add_note"
                            class="lf-btn-post"
                            onclick="submitNote(<!--{$recordID|strip_tags}-->)">
                            Post
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!--{* ── Internal Use panel ──────────────────────── *}-->
        <div class="lf-panel">
            <div class="lf-panel-header lf-open" onclick="lfTogglePanel(this)" aria-expanded="true">
                <span class="lf-panel-title">Internal Use</span>
                <span class="lf-panel-chevron">▾</span>
            </div>
            <div class="lf-panel-body">
                <div class="lf-tool-list">
                    <button class="lf-int-tab lf-active" onclick="lfSwitchTab(0); lfSetActiveIntTab(this)">
                        <span class="lf-int-dot"></span> Main Request
                    </button>
                    <!--{section name=i loop=$childforms}-->
                    <button
                        class="lf-int-tab"
                        onclick="lfSwitchTab(<!--{$smarty.section.i.index+1}-->); lfSetActiveIntTab(this)">
                        <span class="lf-int-dot"></span>
                        <!--{$childforms[i].childCategoryName|sanitize}-->
                    </button>
                    <!--{/section}-->
                </div>
            </div>
        </div>

        <!--{* ── Admin Tools panel ───────────────────────── *}-->
        <!--{if $is_admin}-->
        <div class="lf-panel" id="adminTools">
            <div class="lf-panel-header lf-open" onclick="lfTogglePanel(this)" aria-expanded="true">
                <span class="lf-panel-title">Administrative Tools</span>
                <span class="lf-panel-chevron">▾</span>
            </div>
            <div class="lf-panel-body">
                <div class="lf-tool-list">
                    <!--{if $submitted != 0}-->
                    <button type="button" class="lf-tool-btn" onclick="admin_changeStep()">
                        <span class="lf-tool-icon">↗</span> Change Current Step
                    </button>
                    <!--{/if}-->
                    <button type="button" class="lf-tool-btn" onclick="changeService()">
                        <span class="lf-tool-icon">🏠</span> Change Service
                    </button>
                    <button type="button" class="lf-tool-btn" onclick="admin_changeForm()">
                        <span class="lf-tool-icon">📋</span> Change Form(s)
                    </button>
                    <button type="button" class="lf-tool-btn" onclick="admin_changeInitiator()">
                        <span class="lf-tool-icon">👤</span> Change Initiator
                    </button>
                </div>
            </div>
        </div>
        <!--{/if}-->

        <!--{* ── Security Permissions panel ──────────────── *}-->
        <div class="lf-panel">
            <div class="lf-panel-header" onclick="lfTogglePanel(this)" aria-expanded="false">
                <span class="lf-panel-title">Permissions</span>
                <span class="lf-panel-chevron">▾</span>
            </div>
            <div class="lf-panel-body lf-collapsed">
                <div class="lf-perm-list">
                    <div class="lf-perm-item">
                        <span>👁</span>
                        <span class="lf-perm-label">
                            <button type="button" class="lf-tool-btn" style="padding:0;font-size:.82rem" onclick="viewAccessLogsRead()">Read Access</button>
                        </span>
                        <span class="lf-perm-badge <!--{if $canRead}-->lf-perm-yes<!--{else}-->lf-perm-no<!--{/if}-->">
                            <!--{if $canRead}-->Granted<!--{else}-->Denied<!--{/if}-->
                        </span>
                    </div>
                    <div class="lf-perm-item">
                        <span>✎</span>
                        <span class="lf-perm-label">
                            <button type="button" class="lf-tool-btn" style="padding:0;font-size:.82rem" onclick="viewAccessLogsWrite()">Write Access</button>
                        </span>
                        <span class="lf-perm-badge <!--{if $canWrite}-->lf-perm-yes<!--{else}-->lf-perm-no<!--{/if}-->">
                            <!--{if $canWrite}-->Granted<!--{else}-->Denied<!--{/if}-->
                        </span>
                    </div>
                </div>
            </div>
        </div>

    </aside>

</div><!--{* /lf-page *}-->

<!--{* ── Dialog containers ────────────────────────────────────── *}-->
<div id="formContainer"></div>
<!--{include file="site_elements/generic_xhrDialog.tpl"}-->
<!--{include file="site_elements/generic_confirm_xhrDialog.tpl"}-->
<!--{include file="site_elements/generic_dialog.tpl"}-->
<!--{include file="site_elements/generic_OkDialog.tpl"}-->

</div><!--{* /lf-root *}-->

<script type="text/javascript" src="js/functions/toggleZoom.js"></script>
<script type="text/javascript" src="<!--{$app_js_path}-->/LEAF/sensitiveIndicator.js"></script>
<script type="text/javascript">
/* ─── State ──────────────────────────────────────────────────────── */
let currIndicatorID;
let currSeries;
var recordID   = <!--{$recordID|strip_tags}-->;
var serviceID  = <!--{$serviceID|strip_tags}-->;
let CSRFToken  = '<!--{$CSRFToken}-->';
let formPrintConditions = {};

<!--{if $bookmarked == ''}-->
    let bookmarkStatus = 0;
<!--{else}-->
    let bookmarkStatus = 1;
<!--{/if}-->

/* ─── Tab management ─────────────────────────────────────────────── */
let lfActiveTab = 0;

function lfSwitchTab(idx) {
    // Update tab buttons
    document.querySelectorAll('.lf-tab-btn[role="tab"]').forEach(function(btn, i) {
        btn.classList.toggle('lf-active', i === idx);
        btn.setAttribute('aria-selected', i === idx ? 'true' : 'false');
    });

    // Update panels
    document.querySelectorAll('.lf-tab-panel').forEach(function(panel, i) {
        panel.classList.toggle('lf-active', i === idx);
    });

    lfActiveTab = idx;

    // Load child category content on first activation
    if (idx > 0) {
        var panel = document.getElementById('lf-tab-' + idx);
        if (panel && panel.dataset.loaded === '0') {
            var catID = panel.dataset.childCategoryId;
            panel.innerHTML = '<div class="lf-banner lf-banner-warning" style="margin:20px">Loading&hellip; <img src="images/largespinner.gif" alt="" style="margin-left:8px"/></div>';
            $.ajax({
                type: 'GET',
                url: 'ajaxIndex.php?a=internalonlyview&recordID=<!--{$recordID|strip_tags}-->&childCategoryID=' + catID,
                dataType: 'text',
                success: function(res) {
                    panel.innerHTML = res;
                    panel.dataset.loaded = '1';
                    lfAlignSubheadings(panel);
                    handlePrintConditionalIndicators(formPrintConditions);
                    lfStaggerFields(panel);
                },
                error: function() {
                    panel.innerHTML = '<div class="lf-banner lf-banner-danger" style="margin:20px">Failed to load content.</div>';
                },
                cache: false
            });
        }
    }

    // Sync Internal Use sidebar buttons
    document.querySelectorAll('.lf-int-tab').forEach(function(btn, i) {
        btn.classList.toggle('lf-active', i === idx);
    });
}

function lfSetActiveIntTab(el) {
    document.querySelectorAll('.lf-int-tab').forEach(function(b) { b.classList.remove('lf-active'); });
    el.classList.add('lf-active');
}

/* ─── Panel accordion ────────────────────────────────────────────── */
function lfTogglePanel(header) {
    var isOpen = header.classList.toggle('lf-open');
    header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    var body = header.nextElementSibling;
    body.classList.toggle('lf-collapsed', !isOpen);
}

/* ─── Content loader (main tab) ──────────────────────────────────── */
function openContent(url) {
    var fc = document.getElementById('formcontent');
    fc.innerHTML = '<div class="lf-banner lf-banner-warning" style="margin:20px">Loading&hellip; <img src="images/largespinner.gif" alt="" style="margin-left:8px"/></div>';
    $.ajax({
        type: 'GET',
        url: url,
        dataType: 'text',
        success: function(res) {
            fc.innerHTML = res;
            lfAlignSubheadings(fc);
            handlePrintConditionalIndicators(formPrintConditions);
            lfStaggerFields(fc);
        },
        error: function(res) { fc.innerHTML = res.responseText || ''; },
        cache: false
    });
}

/* Re-trigger stagger animation when content loads */
function lfStaggerFields(container) {
    container.querySelectorAll('.lf-field-row, .lf-field-card, .lf-section-row').forEach(function(el) {
        el.style.animation = 'none';
        el.offsetHeight; // reflow
        el.style.animation = '';
    });
}

/* Equalise sub-heading heights for visual alignment */
function lfAlignSubheadings(container) {
    container.querySelectorAll('.lf-tabs-wrap, .lf-field-list').forEach(function(block) {
        var byRow = {};
        block.querySelectorAll('.lf-field-label').forEach(function(el) {
            var top = el.getBoundingClientRect().top;
            byRow[top] = byRow[top] ? Math.max(byRow[top], el.offsetHeight) : el.offsetHeight;
        });
        block.querySelectorAll('.lf-field-label').forEach(function(el) {
            var top = el.getBoundingClientRect().top;
            if (byRow[top]) el.style.minHeight = byRow[top] + 'px';
        });
    });
}

/* ─── Print support ──────────────────────────────────────────────── */
function openContentForPrint() {
    var fc = document.getElementById('formcontent');
    fc.innerHTML = '';
    $.ajax({
        type: 'GET',
        url: 'ajaxIndex.php?a=printview&recordID=<!--{$recordID|strip_tags}-->',
        dataType: 'text',
        success: function(res) {
            fc.insertAdjacentHTML('beforeend', res);
            lfAlignSubheadings(fc);
            handlePrintConditionalIndicators(formPrintConditions);
        },
        cache: false,
        async: false
    });
    <!--{section name=i loop=$childforms}-->
    $.ajax({
        type: 'GET',
        url: 'ajaxIndex.php?a=internalonlyview&recordID=<!--{$recordID|strip_tags}-->&childCategoryID=<!--{$childforms[i].childCategoryID|strip_tags}-->',
        dataType: 'text',
        success: function(res) {
            fc.insertAdjacentHTML('beforeend', res);
            lfAlignSubheadings(fc);
            handlePrintConditionalIndicators(formPrintConditions);
        },
        cache: false,
        async: false
    });
    <!--{/section}-->
}

/* ─── Indicator AJAX ─────────────────────────────────────────────── */
function getForm(indicatorID, series) {
    form.dialog().show();
    form.setPostModifyCallback(function() {
        getIndicator(indicatorID, series);
        updateProgress();
        form.dialog().hide();
    });
    form.getForm(indicatorID, series);
}

function getIndicator(indicatorID, series) {
    $.ajax({
        type: 'GET',
        url: 'ajaxIndex.php?a=getprintindicator&recordID=<!--{$recordID|strip_tags}-->&indicatorID=' + indicatorID + '&series=' + series,
        dataType: 'text',
        success: function(response) {
            var ph = document.getElementById('PHindicator_' + indicatorID + '_' + series);
            if (ph) {
                ph.classList.remove('lf-missing');
            }
            var xhr = document.getElementById('xhrIndicator_' + indicatorID + '_' + series);
            if (xhr) {
                xhr.innerHTML = response;
                xhr.animate([{opacity:0, transform:'translateY(4px)'},{opacity:1, transform:'translateY(0)'}], {duration:200});
            }
            handlePrintConditionalIndicators(formPrintConditions);
        },
        error: function() { console.warn('Error loading indicator', indicatorID); },
        cache: false
    });
}

function getIndicatorLog(indicatorID, series) {
    dialog_message.setContent(
        'Modifications made to this field:' +
        '<table class="agenda" style="background:white"><thead><tr><th>Date/Author</th><th>Data</th></tr></thead>' +
        '<tbody id="history_' + indicatorID + '"></tbody></table>'
    );
    dialog_message.indicateBusy();
    dialog_message.show();
    $.ajax({
        type: 'GET',
        url: 'api/form/<!--{$recordID|strip_tags}-->/' + indicatorID + '/' + series + '/history',
        success: function(res) {
            var prev = '';
            res.slice().reverse().forEach(function(curr, i) {
                var date = new Date(curr.timestamp * 1000);
                var data = i > 0 ? diffString(prev, curr.data) : curr.data;
                document.getElementById('history_' + indicatorID).insertAdjacentHTML(
                    'afterbegin',
                    '<tr><td>' + date.toString() + '<br/><b>' + curr.name + '</b></td>' +
                    '<td><span class="lf-field-value" style="font-size:15px">' + data + '</span></td></tr>'
                );
                prev = curr.data;
            });
            dialog_message.indicateIdle();
        },
        error: function(res) { dialog_message.setContent(res); dialog_message.indicateIdle(); },
        cache: false
    });
}

/* ─── Sensitive field toggle ─────────────────────────────────────── */
function lfToggleSensitiveBtn(indID, series, btn) {
    var content = document.getElementById('sensValue_' + indID + '_' + series);
    if (!content) return;
    var hidden = content.style.filter !== 'none' && content.style.filter !== '';
    if (hidden) {
        content.style.filter = 'none';
        btn.textContent = '🙈 Hide';
        toggleSensitiveIndicator(indID, series, true);
    } else {
        content.style.filter = 'blur(4px)';
        btn.textContent = '👁 Show';
        toggleSensitiveIndicator(indID, series, false);
    }
}

/* ─── Progress ───────────────────────────────────────────────────── */
function updateProgress() {
    $.ajax({
        type: 'GET',
        url: './api/form/<!--{$recordID|strip_tags}-->/progress',
        dataType: 'json',
        success: function(response) {
            var fill  = document.getElementById('progressBar');
            var label = document.getElementById('progressLabel');
            if (fill)  fill.style.width  = response + '%';
            if (label) label.textContent  = response + '%';

            if (response >= 100 && '<!--{$submitted}-->' === '0') {
                var sidebar = document.getElementById('progressSidebar');
                if (sidebar) sidebar.style.display = 'none';
                $.ajax({
                    type: 'GET',
                    url: 'ajaxIndex.php?a=getsubmitcontrol&recordID=<!--{$recordID|strip_tags}-->',
                    dataType: 'text',
                    success: function(res) {
                        var sc = document.getElementById('submitContent');
                        if (sc) sc.innerHTML = res;
                    },
                    cache: false
                });
            }
        },
        error: function() { console.warn('Error fetching progress'); },
        cache: false
    });
}

/* ─── Tags / Bookmarks ───────────────────────────────────────────── */
function updateTags() {
    $.ajax({
        type: 'GET',
        url: './api/form/<!--{$recordID|strip_tags}-->/tags',
        success: function(res) {
            var el = document.getElementById('tags');
            if (!el) return;
            el.innerHTML = res.length
                ? res.map(function(t) { return '<span class="lf-tag">🔖 ' + t + '</span>'; }).join('')
                : '';
        },
        cache: false
    });
}

function toggleBookmark() {
    if (bookmarkStatus === 0) {
        addBookmark(); bookmarkStatus = 1;
        document.querySelector('#tool_bookmarkText span[role="status"]').textContent = 'Delete Bookmark';
    } else {
        removeBookmark(); bookmarkStatus = 0;
        document.querySelector('#tool_bookmarkText span[role="status"]').textContent = 'Add Bookmark';
    }
}

function addBookmark() {
    $.ajax({
        type: 'POST', url: 'ajaxIndex.php?a=addbookmark&recordID=<!--{$recordID|strip_tags}-->',
        data: { CSRFToken: CSRFToken }, success: function() { updateTags(); },
        error: function() { console.warn('Error adding bookmark'); }
    });
}

function removeBookmark() {
    $.ajax({
        type: 'POST', url: 'ajaxIndex.php?a=removebookmark&recordID=<!--{$recordID|strip_tags}-->',
        data: { CSRFToken: CSRFToken }, success: function() { updateTags(); },
        error: function() { console.warn('Error removing bookmark'); }
    });
}

/* ─── Notes / Comments ───────────────────────────────────────────── */
function submitNote(recordID) {
    var noteVal = document.getElementById('note').value.trim();
    if (!noteVal) return;
    $.ajax({
        type: 'POST',
        url: './api/note/' + recordID,
        data: { note: noteVal, userID: '<!--{$userID|strip_tags}-->', CSRFToken: CSRFToken },
        success: function(response) {
            document.getElementById('note').value = '';
            addNote(response);
            dialog_ok.setTitle('Note Posted');
            dialog_ok.setContent('Your note has been posted. <b style="color:#dc2626">This does not send notifications.</b>');
            dialog_ok.setSaveHandler(function() { dialog_ok.clearDialog(); dialog_ok.hide(); });
            dialog_ok.show();
        },
        error: function() { console.warn('Error submitting note'); }
    });
}

function addNote(response) {
    if (typeof response !== 'object' || response === null) return;
    var list = document.getElementById('commentsList');
    if (!list) return;
    list.insertAdjacentHTML('beforeend',
        '<div class="lf-comment-item">' +
            '<div class="lf-comment-meta"><span class="lf-comment-author">' + response.user_name + '</span><span>' + response.date + '</span></div>' +
            '<div class="lf-comment-text">' + response.note + '</div>' +
        '</div>'
    );
}

/* ─── Restore / Cancel ───────────────────────────────────────────── */
function restoreRequest() {
    $.ajax({
        type: 'POST', url: 'ajaxIndex.php?a=restore',
        data: { restore: <!--{$recordID|strip_tags|escape}-->, CSRFToken: CSRFToken },
        success: function(response) {
            if (response > 0) window.location.href = 'index.php?a=printview&recordID=<!--{$recordID|strip_tags}-->';
        },
        error: function() { console.warn('Error restoring request'); }
    });
}

function cancelRequest() {
    dialog_confirm.setContent(
        '<div style="display:flex;align-items:flex-start;gap:12px">' +
            '<img src="dynicons/?img=process-stop.svg&w=40" alt="" style="flex-shrink:0"/>' +
            '<div>Are you sure you want to cancel this request?<br/><br/>' +
            '<label for="cancel_comment" style="font-size:.82rem;font-weight:500">Comments:</label><br/>' +
            '<textarea id="cancel_comment" cols=30 rows=3 placeholder="Enter comment (optional)"' +
            ' style="width:100%;resize:vertical;margin-top:4px;border:1px solid #e2e5ea;border-radius:6px;padding:6px;font-family:inherit;font-size:.83rem"></textarea>' +
            '</div></div>'
    );
    dialog_confirm.setSaveHandler(function() {
        $.ajax({
            type: 'POST',
            url: 'api/form/<!--{$recordID|strip_tags|escape}-->/cancel',
            data: { CSRFToken: CSRFToken, comment: document.getElementById('cancel_comment').value },
            success: function(response) {
                if (response == 1) {
                    window.location.href = 'index.php?a=cancelled_request&cancelled=<!--{$recordID|strip_tags}-->';
                } else { alert(response); }
            },
            error: function() { console.warn('Error cancelling request'); },
            cache: false
        });
    });
    dialog_confirm.show();
    document.getElementById('cancel_comment').focus();
}

/* ─── Title / Service / Workflow changes ────────────────────────────*/
function changeTitle() {
    dialog.setContent(
        '<label for="titleInput" style="font-size:.83rem;font-weight:500">Title:</label><br/>' +
        '<input type="text" id="titleInput" style="width:100%;margin-top:4px;border:1px solid #e2e5ea;border-radius:6px;padding:7px 10px;font-size:.88rem;font-family:inherit" value="<!--{$title|escape:'quotes'}-->" />'
    );
    dialog.show();
    dialog.setSaveHandler(function() {
        $.ajax({
            type: 'POST', url: 'api/form/<!--{$recordID|strip_tags}-->/title',
            data: { title: document.getElementById('titleInput').value, CSRFToken: CSRFToken },
            success: function(res) {
                if (res != null) document.getElementById('requestTitle').innerHTML = res;
                dialog.hide();
            },
            error: function() { console.warn('Error changing title'); }
        });
    });
}

function changeService() {
    dialog.setTitle('Change Service');
    dialog.setContent('<label id="newService_label" for="newService">Select new service:</label><br/><div id="changeService" style="margin-top:8px"></div>');
    dialog.show();
    dialog.indicateBusy();
    dialog.setSaveHandler(function() { alert('Please wait for service list to load.'); });
    $.ajax({
        type: 'GET', url: './api/system/services', dataType: 'json',
        success: function(res) {
            var svc = '<select id="newService" class="chosen" style="width:100%">';
            for (var i in res) {
                svc += '<option value="' + res[i].groupID + '">' + res[i].groupTitle + '</option>';
            }
            svc += '</select>';
            document.getElementById('changeService').innerHTML = svc;
            $('.chosen').chosen({ disable_search_threshold: 6 });
            $('#newService_chosen input.chosen-search-input').attr('role', 'combobox').attr('aria-labelledby', 'newService_label');
            dialog.indicateIdle();
            dialog.setSaveHandler(function() {
                $.ajax({
                    type: 'POST', url: 'api/form/<!--{$recordID|strip_tags}-->/service',
                    data: { serviceID: $('#newService').val(), CSRFToken: CSRFToken },
                    success: function() { window.location.href = 'index.php?a=printview&recordID=<!--{$recordID|strip_tags}-->'; },
                    error: function() { console.warn('Error changing service'); }
                });
                dialog.hide();
            });
        },
        error: function() { console.warn('Error fetching services'); },
        cache: false
    });
}

/* ─── Access logs ────────────────────────────────────────────────── */
function viewAccessLogsRead() {
    var logs = '<!--{foreach from=$accessLogs["read"] item=log}--><li><!--{$log}--></li><!--{/foreach}-->';
    dialog_message.setTitle('Read Access');
    dialog_message.setContent('<ul>' + logs + '</ul>');
    dialog_message.show();
    dialog_message.indicateIdle();
}

function viewAccessLogsWrite() {
    var logs = '<!--{foreach from=$accessLogs["write"] item=log}--><li><!--{$log}--></li><!--{/foreach}-->';
    dialog_message.setTitle('Write Access');
    dialog_message.setContent('<ul>' + logs + '</ul>');
    dialog_message.show();
    dialog_message.indicateIdle();
}

/* ─── History ────────────────────────────────────────────────────── */
function viewHistory() {
    dialog_message.setContent('');
    dialog_message.show();
    dialog_message.indicateBusy();
    $.ajax({
        type: 'GET', url: 'ajaxIndex.php?a=getstatus&recordID=<!--{$recordID|strip_tags}-->',
        dataType: 'text',
        success: function(res) { dialog_message.setContent(res); dialog_message.indicateIdle(); },
        error: function() { console.warn('Error loading history'); },
        cache: false
    });
}

/* ─── Conditional field visibility ──────────────────────────────── */
const valIncludesMultiselOption = (values = [], arrOptions = []) => {
    let vals = values.map(v => v.replaceAll('\r', '').trim());
    return vals.some(v => arrOptions.includes(v));
};

function handlePrintConditionalIndicators(formPrintConditions = {}) {
    const multiChoiceFormats = ['multiselect', 'checkboxes'];
    for (let c in formPrintConditions) {
        const childFormat = formPrintConditions[c].format;
        const childFormatIsEnabled = childFormat !== 'raw_data';
        const conditions = formPrintConditions[c].conditions;
        let comparison = false;
        let outcomes = [];
        if (conditions.some(c => c.selectedOutcome.toLowerCase() === 'hide')) outcomes.push('hide');
        if (conditions.some(c => c.selectedOutcome.toLowerCase() === 'show')) outcomes.push('show');
        if (outcomes.length !== 1) continue;
        const outcome = outcomes[0];

        for (let i in conditions) {
            if (comparison === true) break;
            const parentFormat = conditions[i].parentFormat.toLowerCase();
            const elParentInd = document.getElementById('data_' + conditions[i].parentIndID + '_1');
            const selectedParentOptionsLI = Array.from(document.querySelectorAll(
                '#xhrIndicator_' + conditions[i].parentIndID + '_1 > span > ul > li'
            ));
            let arrParVals = selectedParentOptionsLI.map(li => li.textContent.trim());
            const elChildInd = document.getElementById('subIndicator_' + conditions[i].childIndID + '_1');

            if (childFormatIsEnabled && (elParentInd !== null || selectedParentOptionsLI.length > 0)) {
                let val = multiChoiceFormats.includes(parentFormat)
                    ? arrParVals
                    : [(elParentInd?.textContent || '').trim()];
                val = val.filter(v => v !== '');
                let compVal = $('<div/>').html(conditions[i].selectedParentValue).text().trim().split('\n').map(v => v.trim());
                const op = conditions[i].selectedOp;
                switch (op) {
                    case '==': comparison = valIncludesMultiselOption(val, compVal); break;
                    case '!=': comparison = !valIncludesMultiselOption(val, compVal); break;
                    case 'lt': case 'lte': case 'gt': case 'gte':
                        const nums = val.filter(v => !isNaN(v)).map(Number);
                        const comp = compVal.filter(v => !isNaN(v)).map(Number);
                        const orEq = op.includes('e'), gtr = op.includes('g');
                        if (comp.length > 0) {
                            for (let n of nums) {
                                comparison = gtr
                                    ? (orEq ? n >= Math.max(...comp) : n > Math.max(...comp))
                                    : (orEq ? n <= Math.min(...comp) : n < Math.min(...comp));
                                if (comparison) break;
                            }
                        }
                        break;
                }
                if (elChildInd) {
                    elChildInd.style.display = (outcome === 'hide')
                        ? (comparison ? 'none' : 'block')
                        : (comparison ? 'block' : 'none');
                }
            }
        }
    }
}

/* ─── Copy Request ───────────────────────────────────────────────── */
function getChildrenIndicatorIDs(indicators) {
    let children = [];
    if (indicators !== null && typeof indicators === 'object') {
        Object.values(indicators).forEach(function(indicator) {
            if (indicator.indicatorID !== undefined) children.push(indicator.indicatorID);
            if (indicator.child !== undefined) children = children.concat(getChildrenIndicatorIDs(indicator.child));
        });
    }
    return children;
}

function copyRequest() {
    $('body').on('click', '.pickAndChooseAll', function(e) {
        $('.pickAndChoose').prop('checked', e.target.checked);
    }).on('click', '.pickAndChoose', function() {
        $('.pickAndChooseAll').prop('checked', $('.pickAndChoose').length === $('.pickAndChoose:checked').length);
    });
    dialog.setTitle('Copy Request <!--{$title|escape:'quotes'}-->');
    dialog.show();
    dialog.indicateBusy();
    let serviceOptions = '', series = 1, pickAndChoose = [];
    let pickAndChooseOptions = '<label class="checkable leaf_check" style="float:none"><input class="ischecked leaf_check pickAndChooseAll" checked type="checkbox"><span class="leaf_check"></span>All</label>';
    let createData = { CSRFToken: CSRFToken };

    Promise.all([
        $.ajax({ type:'GET', url:'api/service', success: function(res) {
            Object.values(res).forEach(function(r) {
                serviceOptions += '<option value="' + r.serviceID + '"' + (parseInt(r.serviceID) === parseInt(serviceID) ? ' selected' : '') + '>' + r.service + '</option>';
            });
        }}),
        $.ajax({ type:'GET', url:'api/form/<!--{$recordID|strip_tags}-->/recordinfo', success: function(res) {
            Object.values(res.categories).forEach(c => createData['num' + c] = 'num' + c);
        }}),
        $.ajax({ type:'GET', url:'api/form/<!--{$recordID|strip_tags}-->/data/tree', success: function(res) {
            Object.values(res).forEach(function(r) {
                pickAndChoose.push({ name: r.name, children: getChildrenIndicatorIDs(r.child).concat(r.indicatorID) });
            });
        }})
    ]).then(function() {
        pickAndChoose.forEach(function(opt) {
            var name = XSSHelpers.stripAllTags(new DOMParser().parseFromString(opt.name, 'text/html').body.textContent || '');
            pickAndChooseOptions += '<label class="checkable leaf_check" style="float:none"><input checked class="ischecked leaf_check pickAndChoose" name="pickAndChoose[]" type="checkbox" value="' + JSON.stringify(opt.children) + '"><span class="leaf_check"></span>' + name + '</label>';
        });
        dialog.setContent(
            '<div id="copy_request_error" style="display:none;margin:0 0 .75rem;padding:.5rem;background:#ffc;line-height:1.5"></div>' +
            '<label style="font-size:.82rem;font-weight:500">Title:</label><br/>' +
            '<input id="title" type="text" value="<!--{$title|escape:'quotes'}-->" style="width:100%;margin:4px 0 12px;border:1px solid #e2e5ea;border-radius:6px;padding:7px 10px;font-family:inherit;font-size:.88rem"/>' +
            (serviceOptions ? '<div id="serviceWrapper"><label style="font-size:.82rem;font-weight:500">Service:</label><br/><select class="chosen" id="service" style="width:100%">' + serviceOptions + '</select><br/><br/></div>' : '') +
            '<label style="font-size:.82rem;font-weight:500">Priority:</label><br/><select class="chosen" id="priority"><option value="-10">EMERGENCY</option><option value="0" selected>Normal</option></select><br/><br/>' +
            '<fieldset><legend style="font-size:.8rem;font-weight:600">Sections to Copy</legend>' + pickAndChooseOptions + '</fieldset>'
        );
        dialog.indicateIdle();
        if (!serviceOptions) $('#serviceWrapper').hide();
        $('.chosen').chosen({ disable_search_threshold: 6 });

        dialog.setSaveHandler(function() {
            createData = { ...createData, title: $('#title').val(), service: $('#service').val(), priority: $('#priority').val() };
            let updateData = { series: series, CSRFToken: CSRFToken };
            let chosenSections = $("input[name='pickAndChoose[]']:checked").map(function() { return JSON.parse($(this).val()); }).get().flat();

            $.ajax({ type:'POST', url:'./api/form/new', data: createData, success: function(res) {
                var newID = +res;
                if (newID > 0) {
                    if (chosenSections.length > 0) {
                        let fileData = [];
                        $.ajax({ type:'GET', url:'api/form/<!--{$recordID|strip_tags}-->/data', async:false, success: function(res) {
                            Object.values(res).forEach(function(r) {
                                if (chosenSections.includes(r[series].indicatorID)) {
                                    if ((r[series].format === 'fileupload' || r[series].format === 'image') && Array.isArray(r[series].value)) {
                                        r[series].value.forEach(function(f) { fileData.push({ fileName:f, series:series, indicatorID:r[series].indicatorID }); });
                                        updateData[r[series].indicatorID] = r[series].value.join('\r\n');
                                    } else { updateData[r[series].indicatorID] = r[series].value; }
                                }
                            });
                        }});
                        $.ajax({ type:'POST', url:'./api/form/' + newID, data: updateData, async:false });
                        fileData.forEach(function(f) {
                            $.ajax({ type:'POST', url:'./api/form/files/copy', async:false,
                                data: { CSRFToken:CSRFToken, recordID:<!--{$recordID|strip_tags}-->, newRecordID:newID, indicatorID:f.indicatorID, fileName:f.fileName, series:f.series }
                            });
                        });
                    }
                    window.location = 'index.php?a=view&recordID=' + newID;
                    dialog.hide();
                } else {
                    var err = document.getElementById('copy_request_error');
                    if (err) { err.style.display = 'block'; err.innerHTML = '<b>Request could not be copied:</b><br>' + res; }
                }
            }, error: function() { console.warn('Error creating new form'); }});
        });
    }).catch(function(err) { console.warn('Copy request error', err); });
}

/* ─── Admin tools ────────────────────────────────────────────────── */
<!--{if $is_admin}-->
var currentRecordID = <!--{$recordID|strip_tags}-->;

async function admin_changeStep() {
    dialog.setTitle('Change Step');
    dialog.setContent(
        '<label id="newStep_label" for="newStep">Set to this step:</label><br/>' +
        '<div id="changeStep" style="margin-top:8px"></div><br/>' +
        '<label style="font-size:.82rem;font-weight:500">Comments:</label><br/>' +
        '<textarea id="changeStep_comment" style="width:100%;padding:6px;border:1px solid #e2e5ea;border-radius:6px;font-family:inherit;font-size:.83rem;resize:vertical" aria-label="Comments"></textarea><br/><br/>' +
        '<label class="checkable leaf_check" style="float:none"><input id="showAllSteps" type="checkbox"><span class="leaf_check"></span>Show steps from other workflows</label>'
    );
    dialog.show();
    dialog.indicateBusy();

    let currentStepData = await $.ajax({ type:'GET', url:'api/formWorkflow/' + currentRecordID + '/currentStep', dataType:'json', cache:false });
    let workflows = {};
    for (let i in currentStepData) workflows[currentStepData[i].workflowID] = 1;
    if (Object.keys(workflows).length === 0) {
        let last = await $.ajax({ type:'GET', url:'api/formWorkflow/' + currentRecordID + '/lastAction', dataType:'json', cache:false });
        if (last) workflows[last.workflowID] = 1;
    }

    $.ajax({ type:'GET', url:'api/workflow/steps', dataType:'json', cache:false, success: function(res) {
        let steps = '<select id="newStep" class="chosen" style="width:100%">', steps2 = '', count = 0;
        for (let i in res) {
            if (Object.keys(workflows).length === 0 || workflows[res[i].workflowID] !== undefined) {
                steps += '<option value="' + res[i].stepID + '">' + res[i].description + ': ' + res[i].stepTitle + '</option>';
                count++;
            }
            steps2 += '<option value="' + res[i].stepID + '">' + res[i].description + ' - ' + res[i].stepTitle + '</option>';
        }
        if (count === 0) steps += steps2;
        steps += '</select>';
        document.getElementById('changeStep').innerHTML = steps;
        $('#showAllSteps').on('click', function() {
            var ns = $('#newStep');
            ns.html($('#showAllSteps').is(':checked') ? steps2 : steps);
            ns.trigger('chosen:updated');
        });
        $('.chosen').chosen({ width:'100%', disable_search_threshold:6 });
        $('#newStep_chosen input.chosen-search-input').attr('role','combobox').attr('aria-labelledby','newStep_label');
        dialog.indicateIdle();
        dialog.setSaveHandler(function() {
            $.ajax({ type:'POST', url:'api/formWorkflow/' + currentRecordID + '/step',
                data: { stepID: $('#newStep').val(), comment: $('#changeStep_comment').val(), CSRFToken: CSRFToken },
                success: function() { window.location.href = 'index.php?a=printview&recordID=' + currentRecordID; },
                error: function() { console.warn('Error changing step'); }
            });
            dialog.hide();
        });
    }});
}

function admin_changeForm() {
    dialog.setTitle('Change Form(s)');
    dialog.setContent('Select Forms:<br/><div id="changeForm" style="margin-top:8px"></div>');
    dialog.show();
    dialog.indicateBusy();
    $.ajax({ type:'GET', url:'./api/workflow/categoriesUnabridged', dataType:'json', cache:false, success: function(res) {
        var cats = '';
        for (var i in res) {
            var warn = res[i].visible === -1 ? ' <span style="color:#dc2626;font-size:.75rem">(unpublished)</span>' : '';
            cats += '<label class="checkable leaf_check" for="cat_' + res[i].categoryID + '" style="float:none">' +
                '<input type="checkbox" class="icheck admin_changeForm leaf_check" id="cat_' + res[i].categoryID + '" name="categories[]" value="' + res[i].categoryID + '"/>' +
                '<span class="leaf_check"></span>' + res[i].categoryName + warn + '</label>';
        }
        document.getElementById('changeForm').innerHTML = cats;
        dialog.indicateIdle();
        dialog.setSaveHandler(function() {
            var data = { 'categories[]': [], CSRFToken: CSRFToken };
            $('.admin_changeForm:checked').each(function() { data['categories[]'].push($(this).val()); });
            $.ajax({ type:'POST', url:'api/form/<!--{$recordID|strip_tags}-->/types', data: data,
                success: function() { window.location.href = 'index.php?a=printview&recordID=<!--{$recordID|strip_tags}-->'; }
            });
            dialog.hide();
        });
        var q = { terms:[{ id:'recordID', operator:'=', match:'<!--{$recordID|strip_tags}-->' }], joins:['categoryNameUnabridged'] };
        $.ajax({ type:'GET', url:'./api/form/query', data:{ q: JSON.stringify(q) }, dataType:'json', cache:false,
            success: function(res) {
                var ids = res[<!--{$recordID|strip_tags|escape}-->].categoryIDsUnabridged;
                $('label.checkable input').each(function() { $(this).prop('checked', ids.some(id => id === this.value)); });
            }
        });
    }});
}

function admin_changeInitiator() {
    dialog.setTitle('Change Initiator');
    dialog.setContent('Select employee:<br/><div id="empSel_changeInitiator"></div><input type="hidden" id="changeInitiator"/>');
    dialog.show();
    dialog.indicateBusy();
    dialog.setSaveHandler(function() {
        var val = document.getElementById('changeInitiator').value;
        if (!val) { alert('Please select an employee.'); return; }
        $.ajax({ type:'POST', url:'./api/form/<!--{$recordID|strip_tags}-->/initiator',
            data: { CSRFToken: CSRFToken, initiator: val },
            success: function() { location.reload(); },
            error: function() { console.warn('Error changing initiator'); }
        });
    });
    function init_empSel() {
        var empSel = new employeeSelector('empSel_changeInitiator');
        empSel.apiPath  = '<!--{$orgchartPath}-->/api/';
        empSel.rootPath = '<!--{$orgchartPath}-->/';
        empSel.setSelectHandler(function() {
            if (empSel.selectionData[empSel.selection]) document.getElementById('changeInitiator').value = empSel.selectionData[empSel.selection].userName;
        });
        empSel.setResultHandler(function() {
            if (empSel.selectionData[empSel.selection]) document.getElementById('changeInitiator').value = empSel.selectionData[empSel.selection].userName;
        });
        empSel.initialize();
        dialog.indicateIdle();
    }
    if (typeof employeeSelector === 'undefined') {
        $('head').append('<link rel="stylesheet" href="<!--{$orgchartPath}-->/css/employeeSelector.css"/>');
        $.ajax({ type:'GET', url:'<!--{$orgchartPath}-->/js/employeeSelector.js', dataType:'script', success: init_empSel });
    } else { init_empSel(); }
}
<!--{/if}-->

/* ─── Init ───────────────────────────────────────────────────────── */
this.portalAPI = LEAFRequestPortalAPI();
this.portalAPI.setBaseURL('api/?a=');
this.portalAPI.setCSRFToken('<!--{$CSRFToken}-->');

$(function() {
    form     = new LeafForm('formContainer');
    print    = new printer();
    workflow = new LeafWorkflow('workflowcontent', '<!--{$CSRFToken}-->');

    form.setRecordID(<!--{$recordID|strip_tags|escape}-->);

    dialog         = new dialogController('xhrDialog',         'xhr',               'loadIndicator',           'button_save',          'button_cancelchange');
    dialog_message = new dialogController('genericDialog',      'genericDialogxhr',  'genericDialogloadIndicator','genericDialogbutton_save','genericDialogbutton_cancelchange');
    dialog_ok      = new dialogController('ok_xhrDialog',       'ok_xhr',            'ok_loadIndicator',        'confirm_button_ok',    'confirm_button_cancelchange');
    dialog_confirm = new dialogController('confirm_xhrDialog',  'confirm_xhr',       'confirm_loadIndicator',   'confirm_button_save',  'confirm_button_cancelchange');

    $('#btn_printForm').on('click', function() {
        openContentForPrint();
        print.printForm(recordID);
    });

    <!--{if $submitted > 0}-->
        workflow.getWorkflow(<!--{$recordID|strip_tags|escape}-->);
    <!--{/if}-->

    <!--{if $submitted == 0}-->
        updateProgress();
    <!--{/if}-->

    // Keyboard: Enter on note input posts the note
    $(window).keydown(function(e) {
        if (e.keyCode === 13 && ($('#note').is(':focus') || $('#add_note').is(':focus'))) {
            e.preventDefault();
            submitNote(<!--{$recordID|strip_tags}-->);
        }
    });

    // Comment panel visibility
    var step = parseInt(<!--{$stepID|strip_tags}-->);
    var commentsPanel = document.getElementById('commentsPanel');
    if (commentsPanel) {
        if (step > 0) {
            commentsPanel.style.display = 'block';
            document.getElementById('notes').style.display = 'block';
        } else if (step === 0 && document.querySelector('.lf-comment-item')) {
            commentsPanel.style.display = 'block';
            document.getElementById('notes').style.display = 'none';
        } else {
            commentsPanel.style.display = 'none';
        }
    }

    // Scroll dialog menu with page
    var elParentForm = document.querySelector('[id^="LeafForm"][id$="_record"]');
    var elFormMenu   = document.getElementById('form-xhr-cancel-save-menu');
    window.addEventListener('scroll', function() {
        if (elParentForm && elFormMenu) {
            var y = elParentForm.getBoundingClientRect().y;
            elFormMenu.style.top = y > 0 ? '0px' : (-y) + 'px';
        }
    });

    // Load initial content into the main tab
    <!--{if $childCategoryID == ''}-->
        openContent('ajaxIndex.php?a=printview&recordID=<!--{$recordID|strip_tags}-->');
    <!--{else}-->
        // Deep-linked to a specific child category — activate that tab
        var catID = '<!--{$childCategoryID|strip_tags}-->';
        var tabs = document.querySelectorAll('.lf-tab-panel[data-child-category-id]');
        tabs.forEach(function(panel, i) {
            if (panel.dataset.childCategoryId === catID) lfSwitchTab(i + 1);
        });
        openContent('ajaxIndex.php?a=internalonlyview&recordID=<!--{$recordID|strip_tags}-->&childCategoryID=<!--{$childCategoryID|strip_tags}-->');
    <!--{/if}-->
});
</script>
