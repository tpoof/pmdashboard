<!--{*
    form.tpl
    Guided step-by-step form editor.

    Layout:
      Left  (220px) — Question nav tree
      Center (1fr)  — Progress bar row + question card + prev/next
      Right (176px) — Tools
*}-->

<link rel="stylesheet" href="css/leaf-forms.css" id="lf-stylesheet" />
<script>
(function() {
    var base = window.location.pathname.replace(/\/[^\/]*$/, '/');
    document.getElementById('lf-stylesheet').href = base + 'css/leaf-forms.css';
})();
</script>

<div class="lf-root" id="lf-wizard">
<style>
/* ── Design tokens inlined so wizard renders even if external CSS is delayed ── */
#lf-wizard {
    --lf-bg:             #f4f5f7;
    --lf-surface:        #ffffff;
    --lf-border:         #e2e5ea;
    --lf-border-hover:   #c8cdd8;
    --lf-text-primary:   #1a1d23;
    --lf-text-secondary: #5a6171;
    --lf-text-muted:     #9299a5;
    --lf-accent:         #3d6ef5;
    --lf-accent-light:   #eef2ff;
    --lf-accent-dark:    #2551d4;
    --lf-danger:         #dc2626;
    --lf-danger-light:   #fee2e2;
    --lf-radius-sm:      6px;
    --lf-radius-lg:      14px;
    --lf-shadow-sm:      0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.04);
    --lf-font-sans:      'DM Sans', system-ui, -apple-system, sans-serif;
    --lf-font-mono:      'DM Mono', ui-monospace, monospace;

    display: grid;
    grid-template-columns: 220px 1fr 176px;
    grid-template-rows: auto 1fr;
    min-height: calc(100vh - 80px);
    background: var(--lf-bg);
    font-family: var(--lf-font-sans);
    font-size: 15px;
    color: var(--lf-text-primary);
    box-sizing: border-box;
}
#lf-wizard *, #lf-wizard *::before, #lf-wizard *::after { box-sizing: border-box; }

/* ── Left nav ──────────────────────────────────────── */
#lf-navtree-col {
    grid-column: 1;
    grid-row: 1 / span 2;
    border-right: 1px solid var(--lf-border);
    background: var(--lf-surface);
    padding: 14px 8px;
    overflow-y: auto;
}
.lf-navtree-title {
    font-size: .67rem;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--lf-text-muted);
    padding: 2px 10px 10px;
}
.lf-navtree-btn {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    border-radius: var(--lf-radius-sm);
    border: none;
    background: none;
    font-family: var(--lf-font-sans);
    font-size: .82rem;
    color: var(--lf-text-secondary);
    text-align: left;
    cursor: pointer;
    line-height: 1.4;
    transition: background .1s, color .1s;
}
.lf-navtree-btn:hover { background: var(--lf-bg); color: var(--lf-text-primary); }
.lf-navtree-btn.lf-active {
    background: var(--lf-accent-light);
    color: var(--lf-accent);
    font-weight: 500;
}
.lf-navtree-num {
    font-family: var(--lf-font-mono);
    font-size: .67rem;
    color: var(--lf-text-muted);
    min-width: 16px;
    padding-top: 2px;
    flex-shrink: 0;
    text-align: right;
}
.lf-navtree-btn.lf-active .lf-navtree-num { color: var(--lf-accent); }

/* ── Progress row ──────────────────────────────────── */
#lf-progress-area {
    grid-column: 2;
    grid-row: 1;
    background: var(--lf-surface);
    border-bottom: 1px solid var(--lf-border);
    padding: 10px 22px;
    display: flex;
    align-items: center;
    gap: 12px;
}
.lf-progress-label {
    font-size: .78rem;
    font-weight: 500;
    color: var(--lf-text-secondary);
    white-space: nowrap;
}
.lf-progress-track {
    flex: 1;
    height: 6px;
    background: var(--lf-bg);
    border-radius: 999px;
    overflow: hidden;
    border: 1px solid var(--lf-border);
}
.lf-progress-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #3d6ef5 0%, #7c9fff 100%);
    transition: width .5s ease;
}
.lf-progress-pct {
    font-size: .78rem;
    font-weight: 700;
    color: var(--lf-accent);
    white-space: nowrap;
    min-width: 34px;
    text-align: right;
}

/* ── Question column ───────────────────────────────── */
#lf-question-col {
    grid-column: 2;
    grid-row: 2;
    padding: 22px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
}
.lf-question-card {
    background: var(--lf-surface);
    border: 1px solid var(--lf-border);
    border-radius: var(--lf-radius-lg);
    box-shadow: var(--lf-shadow-sm);
    overflow: hidden;
}
.lf-question-card-body {
    padding: 24px 28px 20px;
}
.lf-question-nav-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 11px 20px;
    border-top: 1px solid var(--lf-border);
    background: var(--lf-bg);
    gap: 10px;
}

/* ── Shared button styles ──────────────────────────── */
.lf-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border-radius: var(--lf-radius-sm);
    padding: 7px 14px;
    font-size: .82rem;
    font-weight: 500;
    font-family: var(--lf-font-sans);
    border: 1px solid transparent;
    cursor: pointer;
    transition: background .12s, border-color .12s, color .12s;
    white-space: nowrap;
}
.lf-btn:disabled { opacity: .4; cursor: default; pointer-events: none; }
.lf-btn-ghost {
    background: var(--lf-surface);
    border-color: var(--lf-border);
    color: var(--lf-text-secondary);
}
.lf-btn-ghost:hover {
    background: var(--lf-bg);
    border-color: var(--lf-border-hover);
    color: var(--lf-text-primary);
}
.lf-btn-primary {
    background: var(--lf-accent);
    color: #fff;
    border-color: var(--lf-accent);
}
.lf-btn-primary:hover { background: var(--lf-accent-dark); }

/* Save Change button (injected by JS when 100%) */
#lf-save-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--lf-accent);
    color: #fff;
    border: none;
    border-radius: var(--lf-radius-sm);
    padding: 6px 13px;
    font-size: .81rem;
    font-weight: 500;
    font-family: var(--lf-font-sans);
    cursor: pointer;
    white-space: nowrap;
    transition: background .12s;
}
#lf-save-btn:hover { background: var(--lf-accent-dark); }

/* ── Right tools ───────────────────────────────────── */
#lf-tools-col {
    grid-column: 3;
    grid-row: 1 / span 2;
    border-left: 1px solid var(--lf-border);
    background: var(--lf-surface);
    padding: 14px 10px;
}
.lf-tool-list { display: flex; flex-direction: column; gap: 1px; }
.lf-tool-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    border-radius: var(--lf-radius-sm);
    font-size: .83rem;
    font-family: var(--lf-font-sans);
    color: var(--lf-text-primary);
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    transition: background .1s;
}
.lf-tool-btn:hover { background: var(--lf-bg); }
.lf-tool-btn.lf-danger { color: var(--lf-danger); }
.lf-tool-btn.lf-danger:hover { background: var(--lf-danger-light); }
.lf-tool-icon { font-size: .9rem; width: 16px; text-align: center; flex-shrink: 0; opacity: .7; }
.lf-tool-sep { height: 1px; background: var(--lf-border); margin: 5px 0; }

/* ── Responsive ────────────────────────────────────── */
@media (max-width: 860px) {
    #lf-wizard { grid-template-columns: 180px 1fr 140px; }
}
@media (max-width: 680px) {
    #lf-wizard { grid-template-columns: 1fr 140px; }
    #lf-navtree-col { display: none; }
    #lf-question-col { grid-column: 1; }
}
@media (max-width: 480px) {
    #lf-wizard { grid-template-columns: 1fr; }
    #lf-tools-col { display: none; }
}

/* ── Print ─────────────────────────────────────────── */
@media print {
    #lf-navtree-col, #lf-progress-area, .lf-question-nav-row, #lf-tools-col { display: none !important; }
    #lf-question-col { padding: 0; }
    .lf-question-card { border: none; box-shadow: none; }
}
</style>

<!--{* ── Left: question nav tree ───────────────────── *}-->
<nav id="lf-navtree-col" aria-label="Form questions">
    <div class="lf-navtree-title">Sections</div>
    <div id="navtree"></div>
</nav>

<!--{* ── Center top: progress ───────────────────────── *}-->
<div id="lf-progress-area" class="lf-noprint">
    <span class="lf-progress-label">Progress</span>
    <div class="lf-progress-track">
        <div class="lf-progress-fill" id="progressBar" style="width:0%"></div>
    </div>
    <span class="lf-progress-pct" id="progressLabel">0%</span>
    <div id="progressControl" style="margin-left:4px"></div>
</div>

<!--{* ── Center: question card ──────────────────────── *}-->
<main id="lf-question-col">
    <div class="lf-question-card" id="lf-question-card">
        <div class="lf-question-card-body">
            <img src="images/indicator.gif" id="loadIndicator"
                 style="visibility:hidden; float:right; margin-left:8px" alt="" />
            <form id="record" enctype="multipart/form-data" action="javascript:void(0);">
                <div id="xhr"></div>
                <input type="submit" value="Submit" aria-disabled="true" hidden />
            </form>
        </div>
        <div class="lf-question-nav-row lf-noprint">
            <button id="prevQuestion" type="button" class="lf-btn lf-btn-ghost"
                style="visibility:hidden" aria-hidden="true">
                ← Previous
            </button>
            <button id="nextQuestion" type="button" class="lf-btn lf-btn-primary" disabled>
                Next →
            </button>
        </div>
    </div>
</main>

<!--{* ── Right: tools ───────────────────────────────── *}-->
<aside id="lf-tools-col" class="lf-noprint">
    <div class="lf-navtree-title">Tools</div>
    <div class="lf-tool-list">
        <button type="button" class="lf-tool-btn"
            onclick="window.location='?a=printview&amp;recordID=<!--{$recordID}-->'"
            title="View full form">
            <span class="lf-tool-icon">⊞</span> Full view
        </button>
        <div class="lf-tool-sep"></div>
        <button type="button" class="lf-tool-btn lf-danger" onclick="cancelRequest()">
            <span class="lf-tool-icon">✕</span> Cancel
        </button>
    </div>
</aside>

<!--{* ── Dialogs ─────────────────────────────────────── *}-->
<div id="formContainer"></div>
<div id="xhrDialog"           style="display:none"></div>
<div id="button_save"         style="display:none"></div>
<div id="button_cancelchange" style="display:none"></div>
<!--{include file="site_elements/generic_confirm_xhrDialog.tpl"}-->

</div><!--{* /lf-root #lf-wizard *}-->

<script type="text/javascript">
/* ─── State ──────────────────────────────────────────── */
var currIndicatorID  = 0;
var currSeries       = 0;
var CSRFToken        = '<!--{$CSRFToken}-->';
var form;
var formStructure    = [];
var currFormPosition = 0;

/* ─── Navigation ─────────────────────────────────────── */
function getForm(indicatorID, series) {
    document.querySelectorAll('.lf-navtree-btn').forEach(function(b) {
        b.classList.remove('lf-active');
    });
    var btn = document.getElementById('lf-nav-' + currFormPosition);
    if (btn) btn.classList.add('lf-active');
    // Show Previous only when not on the first field
    var prevBtn = document.getElementById('prevQuestion');
    if (prevBtn) {
        prevBtn.style.visibility = currFormPosition > 0 ? 'visible' : 'hidden';
        prevBtn.setAttribute('aria-hidden', currFormPosition > 0 ? 'false' : 'true');
    }
    form.getForm(indicatorID, series);
}

function getNext() {
    currFormPosition++;
    if (currFormPosition < formStructure.length) {
        getForm(formStructure[currFormPosition].indicatorID, formStructure[currFormPosition].series);
    } else {
        var iframeParam = <!--{if $isIframe}-->'&iframe=1'<!--{else}-->''<!--{/if}-->;
        window.location.href = 'index.php?a=printview&recordID=<!--{$recordID}-->' + iframeParam;
    }
}

function getPrev() {
    currFormPosition = Math.max(0, currFormPosition - 1);
    getForm(formStructure[currFormPosition].indicatorID, formStructure[currFormPosition].series);
}

function treeClick(indicatorID, series) {
    form.setPostModifyCallback(function() {
        getForm(indicatorID, series);
        updateProgress();
    });
    form.dialog().clickSave();
}

/* ─── Progress ───────────────────────────────────────── */
var progressUserHasInteracted = false; // don't show Save Change on initial load

function updateProgress(focusNext) {
    $.ajax({
        type: 'GET',
        url: './api/form/<!--{$recordID}-->/progress',
        dataType: 'json',
        success: function(pct) {
            var fill  = document.getElementById('progressBar');
            var label = document.getElementById('progressLabel');
            if (fill)  fill.style.width  = pct + '%';
            if (label) label.textContent  = pct + '%';
            // Only show Save Change if the user has navigated/interacted,
            // preventing the false 100% on a new empty form initial load
            if (pct >= 100 && progressUserHasInteracted) {
                var ctrl = document.getElementById('progressControl');
                if (ctrl && !document.getElementById('lf-save-btn')) {
                    ctrl.innerHTML =
                        '<button type="button" id="lf-save-btn" onclick="manualSaveChange()">💾 Save Change</button>';
                }
            }
            window.scrollTo(0, 0);
            if (focusNext) {
                var b = document.getElementById('nextQuestion');
                if (b) b.focus();
            }
        },
        error: function(e) { console.warn('Progress error', e); },
        cache: false
    });
}

function manualSaveChange() {
    var btn = document.getElementById('lf-save-btn');
    if (btn) btn.textContent = 'Saving…';
    setTimeout(function() {
        var b = document.getElementById('lf-save-btn');
        if (b) b.innerHTML = '💾 Save Change';
    }, 1200);
    form.setPostModifyCallback(function() {
        getForm(formStructure[currFormPosition].indicatorID, formStructure[currFormPosition].series);
    });
    form.dialog().clickSave();
}

/* ─── Cancel ─────────────────────────────────────────── */
function cancelRequest() {
    dialog_confirm.setContent(
        '<div style="display:flex;align-items:center;gap:14px">' +
        '<img src="dynicons/?img=process-stop.svg&w=40" alt=""/>' +
        '<span>Are you sure you want to cancel this request?</span></div>'
    );
    dialog_confirm.setSaveHandler(function() {
        $.ajax({
            type: 'POST',
            url: './api/form/<!--{$recordID}-->/cancel',
            data: { CSRFToken: CSRFToken },
            success: function(response) {
                if (response > 0) {
                    window.location.href = 'index.php?a=cancelled_request&cancelled=<!--{$recordID}-->';
                }
            },
            cache: false
        });
    });
    dialog_confirm.show();
}

/* ─── Init ───────────────────────────────────────────── */
$(function() {
    form = new LeafForm('formContainer');
    form.initCustom('xhrDialog', 'xhr', 'loadIndicator', 'button_save', 'button_cancelchange');
    form.setRecordID(<!--{$recordID}-->);

    dialog_confirm = new dialogController(
        'confirm_xhrDialog', 'confirm_xhr', 'confirm_loadIndicator',
        'confirm_button_save', 'confirm_button_cancelchange'
    );

    updateProgress();

    /* Build nav tree from API */
    $.ajax({
        type: 'GET',
        url: './api/form/<!--{$recordID}-->',
        success: function(res) {
            var counter = 1;
            for (var i in res.items) {
                for (var j in res.items[i].children) {
                    formStructure.push({
                        category:    res.items[i].name,
                        desc:        res.items[i].children[j].desc,
                        indicatorID: res.items[i].children[j].indicatorID,
                        series:      res.items[i].children[j].series
                    });
                }
            }
            var buf = '';
            formStructure.forEach(function(item, idx) {
                var label = item.desc.length > 30 ? item.desc.substr(0, 30) + '…' : item.desc;
                buf +=
                    '<button type="button" id="lf-nav-' + idx + '" class="lf-navtree-btn"' +
                    ' onclick="currFormPosition=' + idx + ';treeClick(' + item.indicatorID + ',' + item.series + ')"' +
                    ' onkeydown="if(event.keyCode===13||event.keyCode===32){currFormPosition=' + idx + ';treeClick(' + item.indicatorID + ',' + item.series + ')}">' +
                    '<span class="lf-navtree-num">' + counter + '</span>' + label +
                    '</button>';
                counter++;
            });
            document.getElementById('navtree').innerHTML = buf;
            if (formStructure.length > 0) {
                getForm(formStructure[0].indicatorID, formStructure[0].series);
                var first = document.getElementById('lf-nav-0');
                if (first) first.classList.add('lf-active');
            }
        },
        error: function(e) { console.warn('Form structure error', e); }
    });

    /* Next / Prev */
    document.querySelectorAll('#nextQuestion').forEach(function(btn) {
        btn.removeAttribute('disabled');
        btn.addEventListener('click', function() {
            progressUserHasInteracted = true;
            form.dialog().indicateBusy();
            form.setPostModifyCallback(function() { getNext(); updateProgress(true); });
            form.dialog().clickSave();
        });
    });
    document.querySelectorAll('#prevQuestion').forEach(function(btn) {
        btn.addEventListener('click', function() {
            progressUserHasInteracted = true;
            form.dialog().indicateBusy();
            form.setPostModifyCallback(function() { getPrev(); updateProgress(true); });
            form.dialog().clickSave();
        });
    });
});
</script>
