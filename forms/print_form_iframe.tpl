<!--{*
    print_form_iframe.tpl
    Lightweight iframe wrapper for the print/review view.
    Depends on: leaf-forms.css
*}-->
<link rel="stylesheet" href="css/leaf-forms.css" />

<div class="lf-root">

<!--{if $deleted > 0}-->
<div class="lf-banner lf-banner-danger lf-animate-in" style="margin:16px 16px 0">
    <img src="dynicons/?img=emblem-unreadable.svg&amp;w=32" alt="" />
    <div>
        <strong>This request has been marked as deleted.</strong>
        <button
            type="button"
            class="lf-btn lf-btn-ghost"
            style="margin-left:12px"
            onclick="restoreRequest(<!--{$recordID|strip_tags}-->)">
            ↩ Un-delete request
        </button>
    </div>
</div>
<hr style="border:none;border-top:1px solid var(--lf-border);margin:16px 0" />
<!--{/if}-->

<div id="maincontent" style="padding: 0 12px 40px">
    <div id="formcontent">
        <div class="lf-banner lf-banner-warning lf-animate-in" style="margin:16px 0">
            Loading&hellip; <img src="images/largespinner.gif" alt="" style="margin-left:8px" />
        </div>
    </div>
</div>

<!--{* Dialogs *}-->
<div id="formContainer"></div>
<!--{include file="site_elements/generic_xhrDialog.tpl"}-->
<!--{include file="site_elements/generic_confirm_xhrDialog.tpl"}-->
<!--{include file="site_elements/generic_dialog.tpl"}-->

</div><!--{* /lf-root *}-->

<script type="text/javascript" src="js/functions/toggleZoom.js"></script>
<script type="text/javascript">
var currIndicatorID;
var currSeries;
var recordID  = <!--{$recordID}-->;
var serviceID = <!--{$serviceID}-->;
var CSRFToken = '<!--{$CSRFToken}-->';

/* ─── Content loader ─────────────────────────────────── */
function openContent(url) {
    var fc = document.getElementById('formcontent');
    fc.innerHTML = '<div class="lf-banner lf-banner-warning" style="margin:16px 0">Loading&hellip; <img src="images/largespinner.gif" alt="" style="margin-left:8px"/></div>';
    $.ajax({
        type: 'GET', url: url, dataType: 'text',
        success: function(res) {
            fc.innerHTML = res;
            lfAlignSubheadings(fc);
        },
        error: function(res) { fc.innerHTML = res.responseText || ''; },
        cache: false
    });
}

function lfAlignSubheadings(container) {
    container.querySelectorAll('.lf-field-list').forEach(function(block) {
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

/* ─── Indicator refresh ──────────────────────────────── */
function getForm(indicatorID, series) {
    form.dialog().show();
    form.setPostModifyCallback(function() {
        getIndicator(indicatorID, series);
        form.dialog().hide();
    });
    form.getForm(indicatorID, series);
}

function getIndicatorLog(indicatorID, series) {
    dialog_message.setContent(
        'Modifications:<table class="agenda" style="background:white"><thead><tr><th>Date/Author</th><th>Data</th></tr></thead>' +
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

function getIndicator(indicatorID, series) {
    $.ajax({
        type: 'GET',
        url: 'ajaxIndex.php?a=getprintindicator&recordID=<!--{$recordID|strip_tags}-->&indicatorID=' + indicatorID + '&series=' + series,
        dataType: 'text',
        success: function(response) {
            var ph = document.getElementById('PHindicator_' + indicatorID + '_' + series);
            if (ph) ph.classList.remove('lf-missing');
            var xhr = document.getElementById('xhrIndicator_' + indicatorID + '_' + series);
            if (xhr) {
                xhr.innerHTML = response;
                xhr.animate([{opacity:0},{opacity:1}], {duration:200});
            }
        },
        error: function() { console.warn('Error loading indicator', indicatorID); },
        cache: false
    });
}

function hideForm() { dialog.hide(); }

function restoreRequest() {
    $.ajax({
        type: 'POST', url: 'ajaxIndex.php?a=restore',
        data: { restore: <!--{$recordID}-->, CSRFToken: CSRFToken },
        success: function(response) {
            if (response > 0) window.location.href = 'index.php?a=printview&recordID=<!--{$recordID|strip_tags}-->';
        }
    });
}

/* ─── Init ───────────────────────────────────────────── */
$(function() {
    form           = new LeafForm('formContainer');
    dialog         = new dialogController('xhrDialog',        'xhr',              'loadIndicator',            'button_save',         'button_cancelchange');
    dialog_message = new dialogController('genericDialog',     'genericDialogxhr', 'genericDialogloadIndicator','genericDialogbutton_save','genericDialogbutton_cancelchange');
    dialog_confirm = new dialogController('confirm_xhrDialog', 'confirm_xhr',      'confirm_loadIndicator',    'confirm_button_save', 'confirm_button_cancelchange');

    form.setRecordID(<!--{$recordID}-->);

    <!--{if $childCategoryID == ''}-->
        openContent('ajaxIndex.php?a=printview&recordID=<!--{$recordID|strip_tags}-->');
    <!--{else}-->
        openContent('ajaxIndex.php?a=internalonlyview&recordID=<!--{$recordID|strip_tags}-->&childCategoryID=<!--{$childCategoryID}-->');
    <!--{/if}-->
});
</script>
