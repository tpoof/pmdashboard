<!--{*
    form.tpl
    Guided step-by-step form editor.
    Depends on: leaf-forms.css

    Layout:
      - Sticky top progress bar
      - Center: single question card
      - Left drawer: question nav (collapses on mobile)
      - Right: minimal tools
*}-->
<link rel="stylesheet" href="css/leaf-forms.css" />

<div class="lf-root" id="lf-wizard">
<style>
/* ── Wizard-specific styles (not needed in print view) ── */
#lf-wizard {
    display: grid;
    grid-template-columns: 220px 1fr 180px;
    grid-template-rows: auto 1fr;
    gap: 0;
    min-height: calc(100vh - 60px);
    background: var(--lf-bg);
}

/* Nav tree */
#lf-navtree-col {
    grid-column: 1;
    grid-row: 1 / span 2;
    border-right: 1px solid var(--lf-border);
    background: var(--lf-surface);
    padding: 12px 8px;
    overflow-y: auto;
}

.lf-navtree-title {
    font-size: .69rem;
    font-weight: 600;
    letter-spacing: .07em;
    text-transform: uppercase;
    color: var(--lf-text-muted);
    padding: 4px 8px 8px;
}

.lf-navtree-btn {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
    padding: 7px 8px;
    border-radius: var(--lf-radius-sm);
    border: none;
    background: none;
    font-size: .81rem;
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
    font-size: .68rem;
    color: var(--lf-text-muted);
    min-width: 18px;
    padding-top: 1px;
    flex-shrink: 0;
}
.lf-navtree-btn.lf-active .lf-navtree-num { color: var(--lf-accent); }

/* Top progress area */
#lf-progress-area {
    grid-column: 2;
    grid-row: 1;
    background: var(--lf-surface);
    border-bottom: 1px solid var(--lf-border);
    padding: 10px 20px;
    display: flex;
    align-items: center;
    gap: 14px;
}

/* Question card */
#lf-question-col {
    grid-column: 2;
    grid-row: 2;
    padding: 24px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.lf-question-card {
    background: var(--lf-surface);
    border: 1px solid var(--lf-border);
    border-radius: var(--lf-radius-lg);
    box-shadow: var(--lf-shadow-sm);
    overflow: hidden;
}

.lf-question-card-body {
    padding: 24px 28px;
}

.lf-question-nav-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    border-top: 1px solid var(--lf-border);
    background: var(--lf-bg);
}

/* Tools col */
#lf-tools-col {
    grid-column: 3;
    grid-row: 1 / span 2;
    border-left: 1px solid var(--lf-border);
    background: var(--lf-surface);
    padding: 12px 10px;
}

/* Responsive */
@media (max-width: 820px) {
    #lf-wizard { grid-template-columns: 1fr 140px; }
    #lf-navtree-col { display: none; }
    #lf-question-col { grid-column: 1; }
}
@media (max-width: 560px) {
    #lf-wizard { grid-template-columns: 1fr; }
    #lf-tools-col { display: none; }
    #lf-question-col { grid-column: 1; }
}
</style>

<!--{* ── Nav tree ───────────────────────────────────────── *}-->
<nav id="lf-navtree-col" aria-label="Form questions">
    <div class="lf-navtree-title">Questions</div>
    <div id="navtree"></div>
</nav>

<!--{* ── Progress bar ─────────────────────────────────────── *}-->
<div id="lf-progress-area" class="lf-noprint">
    <span class="lf-progress-label">Progress</span>
    <div class="lf-progress-track">
        <div class="lf-progress-fill" id="progressBar" style="width:0%"></div>
    </div>
    <span class="lf-progress-pct" id="progressLabel">0%</span>
    <div id="progressControl" style="margin-left:8px"></div>
</div>

<!--{* ── Question area ────────────────────────────────────── *}-->
<main id="lf-question-col">
    <div class="lf-question-card" id="lf-question-card">
        <div class="lf-question-card-body">
            <img src="images/indicator.gif" id="loadIndicator" style="visibility:hidden;float:right" alt="" />
            <form id="record" enctype="multipart/form-data" action="javascript:void(0);">
                <div id="xhr" style="padding:0"></div>
                <input type="submit" value="Submit" aria-disabled="true" hidden />
            </form>
        </div>
        <div class="lf-question-nav-row lf-noprint">
            <button id="prevQuestion" type="button" class="lf-btn lf-btn-ghost">
                ← Previous
            </button>
            <button id="nextQuestion" type="button" class="lf-btn lf-btn-primary" disabled>
                Next →
            </button>
        </div>
    </div>

    <div id="lf-submit-area" style="display:none">
        <!--{* Submit control injected here when progress hits 100% *}-->
    </div>
</main>

<!--{* ── Tools column ────────────────────────────────────── *}-->
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

<!--{* ── Dialogs ──────────────────────────────────────────── *}-->
<div id="formContainer"></div>
<div id="xhrDialog" style="display:none"></div>
<div id="button_save" style="display:none"></div>
<div id="button_cancelchange" style="display:none"></div>
<!--{include file="site_elements/generic_confirm_xhrDialog.tpl"}-->

</div><!--{* /lf-root *}-->

<script type="text/javascript">
/* ─── State ──────────────────────────────────────────────── */
var currIndicatorID = 0;
var currSeries      = 0;
var CSRFToken       = '<!--{$CSRFToken}-->';
var form;
var formStructure   = [];
var currFormPosition = 0;

/* ─── Navigation ─────────────────────────────────────────── */
function getForm(indicatorID, series) {
    document.querySelectorAll('.lf-navtree-btn').forEach(function(b) { b.classList.remove('lf-active'); });
    var active = document.getElementById('lf-nav-' + currFormPosition);
    if (active) active.classList.add('lf-active');
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

/* ─── Progress ───────────────────────────────────────────── */
function updateProgress(focusNext) {
    $.ajax({
        type: 'GET',
        url: './api/form/<!--{$recordID}-->/progress',
        dataType: 'json',
        success: function(response) {
            var fill  = document.getElementById('progressBar');
            var label = document.getElementById('progressLabel');
            if (fill)  fill.style.width  = response + '%';
            if (label) label.textContent  = response + '%';

            if (response >= 100) {
                var ctrl = document.getElementById('progressControl');
                if (ctrl) ctrl.innerHTML =
                    '<button type="button" class="lf-btn lf-btn-primary" onclick="manualSaveChange()" id="saveBtn">' +
                    '💾 Save Change</button>';
            }
            window.scrollTo(0, 0);
            if (focusNext) {
                var nextBtn = document.getElementById('nextQuestion');
                if (nextBtn) nextBtn.focus();
            }
        },
        error: function(e) { console.warn('Progress error', e); },
        cache: false
    });
}

function manualSaveChange() {
    var btn = document.getElementById('saveBtn');
    if (btn) btn.textContent = 'Saving…';
    setTimeout(function() { if (btn) btn.textContent = '💾 Save Change'; }, 1200);
    form.setPostModifyCallback(function() {
        getForm(formStructure[currFormPosition].indicatorID, formStructure[currFormPosition].series);
    });
    form.dialog().clickSave();
}

/* ─── Cancel ─────────────────────────────────────────────── */
function cancelRequest() {
    dialog_confirm.setContent(
        '<div style="display:flex;align-items:center;gap:12px">' +
        '<img src="dynicons/?img=process-stop.svg&w=40" alt=""/>' +
        'Are you sure you want to cancel this request?</div>'
    );
    dialog_confirm.setSaveHandler(function() {
        $.ajax({
            type: 'POST',
            url: './api/form/<!--{$recordID}-->/cancel',
            data: { CSRFToken: CSRFToken },
            success: function(response) {
                if (response > 0) window.location.href = 'index.php?a=cancelled_request&cancelled=<!--{$recordID}-->';
            },
            cache: false
        });
    });
    dialog_confirm.show();
}

/* ─── Init ───────────────────────────────────────────────── */
$(function() {
    $('#progressBar').progressbar({ max: 100 });

    form = new LeafForm('formContainer');
    form.initCustom('xhrDialog', 'xhr', 'loadIndicator', 'button_save', 'button_cancelchange');
    form.setRecordID(<!--{$recordID}-->);

    dialog_confirm = new dialogController('confirm_xhrDialog', 'confirm_xhr', 'confirm_loadIndicator', 'confirm_button_save', 'confirm_button_cancelchange');

    updateProgress();

    // Build nav tree from form structure
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
                var label = item.desc.length > 28 ? item.desc.substr(0, 28) + '…' : item.desc;
                buf += '<button type="button" id="lf-nav-' + idx + '" class="lf-navtree-btn"' +
                    ' onclick="currFormPosition=' + idx + '; treeClick(' + item.indicatorID + ', ' + item.series + ')"' +
                    ' onkeydown="if(event.keyCode===13||event.keyCode===32){currFormPosition=' + idx + ';treeClick(' + item.indicatorID + ',' + item.series + ')}">' +
                    '<span class="lf-navtree-num">' + counter + '</span>' + label +
                    '</button>';
                counter++;
            });
            document.getElementById('navtree').innerHTML = buf;

            if (formStructure.length > 0) {
                getForm(formStructure[0].indicatorID, formStructure[0].series);
                document.getElementById('lf-nav-0').classList.add('lf-active');
            }
        },
        error: function(e) { console.warn('Form structure error', e); }
    });

    // Next / Prev
    document.querySelectorAll('#nextQuestion, #nextQuestion2').forEach(function(btn) {
        btn.removeAttribute('disabled');
        btn.addEventListener('click', function() {
            form.dialog().indicateBusy();
            form.setPostModifyCallback(function() { getNext(); updateProgress(true); });
            form.dialog().clickSave();
        });
    });

    document.querySelectorAll('#prevQuestion').forEach(function(btn) {
        btn.addEventListener('click', function() {
            form.dialog().indicateBusy();
            form.setPostModifyCallback(function() { getPrev(); updateProgress(true); });
            form.dialog().clickSave();
        });
    });
});
</script>
