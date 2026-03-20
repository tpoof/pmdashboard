<!--{if $deleted > 0}-->
<div style="font-size: 36px"><img src="dynicons/?img=emblem-unreadable.svg&amp;w=96" alt="" style="float: left" /> Notice: This request has been marked as deleted.<br />
    <span class="buttonNorm" onclick="restoreRequest(<!--{$recordID|strip_tags}-->)"><img src="dynicons/?img=user-trash-full.svg&amp;w=32" alt="" /> Un-delete request</span>
</div><br style="clear: both" />
<hr />
<!--{/if}-->

<!-- Public view for all users -->
<!--
    PUBLIC VIEW — indicatorIDs: 5, 6, 7, 8, 13 (if Other), 9, 10
    Inserted inside the <!--{else}--> block of print_form_ideas.tpl
    Requires: $recordID, $portal_url, $form (standard LEAF printview vars)
-->

<!-- ── Skip link (accessibility: keyboard users jump past nav) ── -->
<a href="#pv-main" class="pv-skip-link">Skip to main content</a>

<!-- ── Scoped styles ── -->
<style>
<!--{literal}-->
/* ── Reset & scope ─────────────────────────────────── */
#public-view *,
#public-view *::before,
#public-view *::after {
    box-sizing: border-box;
}

/* ── Skip link ──────────────────────────────────────── */
.pv-skip-link {
    position: absolute;
    top: -9999px;
    left: 0;
    z-index: 9999;
    background: #1f2937;
    color: #ffffff;
    padding: 10px 16px;
    font-size: 15px;
    font-weight: 600;
    border-radius: 0 0 8px 0;
    text-decoration: none;
}
.pv-skip-link:focus {
    top: 0;
    outline: 3px solid #005ea2;
    outline-offset: 2px;
}

/* ── Wrapper ────────────────────────────────────────── */
#public-view {
    font-family: 'Source Sans 3', 'Source Sans Pro', sans-serif;
    color: #0f172a;
    background: #f6f8fb;
    min-height: 100vh;
    padding: 0 0 64px;
}

/* ── Back nav bar ───────────────────────────────────── */
.pv-topbar {
    background: #ffffff;
    border-bottom: 1px solid #cfd7e3;
    padding: 10px 20px;
}
.pv-back-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 15px;
    font-weight: 600;
    color: #005ea2;
    text-decoration: none;
    border-radius: 6px;
    padding: 4px 2px;
}
.pv-back-link:hover,
.pv-back-link:focus {
    color: #004a82;
    text-decoration: underline;
}
.pv-back-link:focus-visible {
    outline: 3px solid #005ea2;
    outline-offset: 2px;
    text-decoration: none;
}
.pv-back-link svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    aria-hidden: true;
}

/* ── Main content container ─────────────────────────── */
.pv-main {
    max-width: 820px;
    margin: 32px auto 0;
    padding: 0 20px;
}

/* ── Record ID + pills row ──────────────────────────── */
.pv-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 16px;
}
.pv-id-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 3px 10px;
    background: #1f1f1f;
    color: #ffffff;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.02em;
    line-height: 1.4;
}
.pv-pill {
    display: inline-flex;
    align-items: center;
    padding: 3px 12px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.4;
}
.pv-pill--category {
    background: #d9e8f6;
    color: #004a82;
    border: 1px solid #aacdec;
}
.pv-pill--impact {
    background: #dcfce7;
    color: #166534;
    border: 1px solid #86efac;
}

/* ── Page title (indicatorID 5) ─────────────────────── */
.pv-title {
    font-size: 26px;
    font-weight: 700;
    line-height: 1.25;
    margin: 0 0 24px;
    color: #0f172a;
}

/* ── Cards ──────────────────────────────────────────── */
.pv-card {
    background: #ffffff;
    border: 1px solid #cfd7e3;
    border-radius: 14px;
    padding: 22px 24px;
    margin-bottom: 14px;
}
.pv-card-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #475569;
    margin: 0 0 10px;
    display: block;
}
.pv-card-body {
    font-size: 16px;
    line-height: 1.7;
    color: #0f172a;
    margin: 0;
}
.pv-card-body p {
    margin: 0 0 0.75em;
}
.pv-card-body p:last-child {
    margin-bottom: 0;
}

/* ── Two-column grid ────────────────────────────────── */
.pv-two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-bottom: 14px;
}
@media (max-width: 560px) {
    .pv-two-col {
        grid-template-columns: 1fr;
    }
    .pv-title {
        font-size: 20px;
    }
}

/* ── Divider inside a card ──────────────────────────── */
.pv-card-divider {
    border: none;
    border-top: 1px solid #cfd7e3;
    margin: 14px 0;
}

/* ── Sub-question (Category: Other) ────────────────── */
.pv-sub-card {
    background: #f8fafc;
    border: 1px solid #cfd7e3;
    border-radius: 10px;
    padding: 14px 16px;
    margin-top: 10px;
}
.pv-sub-card .pv-card-label {
    color: #64748b;
}

/* ── No-data state ──────────────────────────────────── */
.pv-empty {
    font-size: 15px;
    color: #64748b;
    font-style: italic;
}

/* ── Attachments grid ───────────────────────────────── */
.pv-attach-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 4px;
}

/* Image attachment ─────────────────────────────────── */
.pv-attach-figure {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.pv-attach-btn {
    display: block;
    padding: 0;
    background: none;
    border: 2px solid #cfd7e3;
    border-radius: 10px;
    cursor: pointer;
    transition: border-color 0.15s ease;
    line-height: 0;
    width: 130px;
}
.pv-attach-btn:hover,
.pv-attach-btn:focus {
    border-color: #005ea2;
}
.pv-attach-btn:focus-visible {
    outline: 3px solid #005ea2;
    outline-offset: 2px;
}
.pv-attach-thumb {
    width: 126px;
    height: 96px;
    object-fit: cover;
    border-radius: 8px;
    display: block;
}
.pv-attach-caption {
    font-size: 12px;
    color: #475569;
    max-width: 130px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: block;
}

/* File attachment ──────────────────────────────────── */
.pv-file-list {
    list-style: none;
    padding: 0;
    margin: 4px 0 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.pv-file-item {
    display: flex;
    align-items: center;
    gap: 10px;
}
.pv-file-icon {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    background: #d9e8f6;
    border: 1px solid #aacdec;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.pv-file-icon svg {
    width: 16px;
    height: 16px;
    color: #004a82;
}
.pv-file-link {
    font-size: 15px;
    font-weight: 600;
    color: #005ea2;
    text-decoration: underline;
    text-underline-offset: 2px;
    word-break: break-word;
}
.pv-file-link:hover,
.pv-file-link:focus {
    color: #004a82;
}
.pv-file-link:focus-visible {
    outline: 3px solid #005ea2;
    outline-offset: 2px;
    border-radius: 2px;
}
<!--{/literal}-->
</style>

<!-- ── Back nav ─────────────────────────────────────────────────────────── -->
<div class="pv-topbar" role="navigation" aria-label="Breadcrumb">
    <a href="index.php" class="pv-back-link">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false">
            <path d="M10 12L6 8l4-4"/>
        </svg>
        All Ideas
    </a>
</div>

<!-- ── Main ─────────────────────────────────────────────────────────────── -->
<main class="pv-main" id="pv-main" tabindex="-1">

    <!-- Record ID + dynamic pills (populated by JS below) -->
    <div class="pv-meta" role="group" aria-label="Idea metadata">
        <span class="pv-id-badge" aria-label="Idea number <!--{$recordID|strip_tags}-->">#<!--{$recordID|strip_tags}--></span>
        <!-- .pv-pill--category and .pv-pill--impact injected by JS after AJAX load -->
        <span id="pv-category-pill" class="pv-pill pv-pill--category" aria-live="polite" hidden></span>
        <span id="pv-impact-pill"   class="pv-pill pv-pill--impact"   aria-live="polite" hidden></span>
    </div>

    <!-- ── indicatorID 5: Title of idea ──────────────────────────────── -->
    <h1 class="pv-title" id="pv-heading-5">
        <span id="pv-value-5" aria-live="polite">
            <span class="pv-empty">Loading&hellip;</span>
        </span>
    </h1>

    <!-- ── indicatorID 6: Detailed summary ───────────────────────────── -->
    <section class="pv-card" aria-labelledby="pv-label-6">
        <span class="pv-card-label" id="pv-label-6">Detailed summary of your idea</span>
        <div class="pv-card-body" id="pv-value-6" aria-live="polite">
            <span class="pv-empty">Loading&hellip;</span>
        </div>
    </section>

    <!-- ── Two-column: benefit (7) + category/impact (8, 9) ─────────── -->
    <div class="pv-two-col">

        <!-- Benefit (indicatorID 7) -->
        <section class="pv-card" aria-labelledby="pv-label-7">
            <span class="pv-card-label" id="pv-label-7">Benefit of implementing the idea</span>
            <div class="pv-card-body" id="pv-value-7" aria-live="polite">
                <span class="pv-empty">Loading&hellip;</span>
            </div>
        </section>

        <!-- Category (8) + Impact (9) stacked in one card -->
        <section class="pv-card" aria-labelledby="pv-label-8">
            <span class="pv-card-label" id="pv-label-8">Category</span>
            <div class="pv-card-body" id="pv-value-8" aria-live="polite">
                <span class="pv-empty">Loading&hellip;</span>
            </div>

            <!-- Sub-question: indicatorID 13 (only shown if category = Other) -->
            <div id="pv-subq-13" hidden>
                <div class="pv-sub-card" aria-labelledby="pv-label-13">
                    <span class="pv-card-label" id="pv-label-13">Please specify your category</span>
                    <div class="pv-card-body" id="pv-value-13" aria-live="polite"></div>
                </div>
            </div>

            <hr class="pv-card-divider" role="separator" />

            <span class="pv-card-label" id="pv-label-9">Impact of idea</span>
            <div class="pv-card-body" id="pv-value-9" aria-live="polite">
                <span class="pv-empty">Loading&hellip;</span>
            </div>
        </section>

    </div><!-- /.pv-two-col -->

    <!-- ── indicatorID 10: Attachments ───────────────────────────────── -->
    <section class="pv-card" aria-labelledby="pv-label-10">
        <span class="pv-card-label" id="pv-label-10">Attachments</span>
        <div id="pv-value-10" aria-live="polite" aria-label="Attachments loading">
            <span class="pv-empty">Loading&hellip;</span>
        </div>
    </section>

</main>

<!-- ── Data loader ──────────────────────────────────────────────────────── -->
<script>
var _pvRecordID  = <!--{$recordID|strip_tags|escape:'javascript'}-->;
var _pvPortalURL = '<!--{$portal_url|escape:'javascript'}-->';
</script>
<script>
<!--{literal}-->
(function() {
    var recordID  = _pvRecordID;
    var portalURL = _pvPortalURL;

    /*
     * Map of indicatorID -> config
     *   target  : DOM id to write the text/HTML value into
     *   onValue : optional callback(rawText) fired once data arrives
     */
    var fields = [
        { id: 5,  target: 'pv-value-5'  },
        { id: 6,  target: 'pv-value-6'  },
        { id: 7,  target: 'pv-value-7'  },
        { id: 8,  target: 'pv-value-8',
          onValue: function(text) {
              /* Show the category pill in the meta row */
              var pill = document.getElementById('pv-category-pill');
              if (pill && text.trim() !== '') {
                  pill.textContent = text.trim();
                  pill.removeAttribute('hidden');
              }
              /* If the user chose "Other", reveal the sub-question slot */
              if (text.trim().toLowerCase() === 'other') {
                  var subq = document.getElementById('pv-subq-13');
                  if (subq) { subq.removeAttribute('hidden'); }
                  loadIndicator(13);
              }
          }
        },
        { id: 9,  target: 'pv-value-9',
          onValue: function(text) {
              /* Show the impact pill in the meta row */
              var pill = document.getElementById('pv-impact-pill');
              if (pill && text.trim() !== '') {
                  pill.textContent = text.trim();
                  pill.removeAttribute('hidden');
              }
          }
        },
        { id: 10, target: 'pv-value-10', isAttachment: true }
    ];

    /* ── Render a plain-text / html field ────────────────────────────── */
    function renderText(el, html) {
        var trimmed = html ? html.trim() : '';
        if (trimmed === '' || trimmed === 'N/A') {
            el.innerHTML = '<span class="pv-empty">Not provided</span>';
        } else {
            el.innerHTML = trimmed;
        }
    }

    /* ── Extract readable text from an HTML fragment ─────────────────── */
    function extractText(html) {
        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        return (tmp.textContent || tmp.innerText || '').trim();
    }

    /* ── Render attachments (image or file) from raw AJAX HTML ───────── */
    function renderAttachments(el, html) {
        var tmp = document.createElement('div');
        tmp.innerHTML = html;

        /* Collect images */
        var imgs = tmp.querySelectorAll('img[src*="image.php"]');
        /* Collect file links */
        var links = tmp.querySelectorAll('a[href*="file.php"]');

        /* No attachments at all */
        if (imgs.length === 0 && links.length === 0) {
            el.innerHTML = '<span class="pv-empty">No attachments provided.</span>';
            return;
        }

        var out = '<div class="pv-attach-grid">';

        /* Images ────────────────────────────────────── */
        imgs.forEach(function(img, i) {
            var src    = img.getAttribute('src') || '';
            var altRaw = img.getAttribute('alt') || '';
            /* Strip LEAF's "image upload: " prefix from alt text */
            var filename = altRaw.replace(/^image upload:\s*/i, '').trim() || ('Image ' + (i + 1));
            /* Full-size URL for the popup (same path, larger display) */
            var fullURL = src;

            out += '<figure class="pv-attach-figure">';
            out +=   '<button type="button" class="pv-attach-btn"'
                  +        ' onclick="window.open(\'' + fullURL.replace(/'/g, "\\'") + '\',\'pv_img_' + i + '\',\'width=750,height=750,resizable=yes,scrollbars=yes\')"'
                  +        ' aria-label="View full size: ' + filename.replace(/"/g, '&quot;') + '"'
                  +  '>';
            out +=     '<img src="' + src + '"'
                  +         ' alt="' + filename.replace(/"/g, '&quot;') + '"'
                  +         ' class="pv-attach-thumb"'
                  +         ' loading="lazy"'
                  +         ' onerror="this.closest(\'.pv-attach-btn\').setAttribute(\'aria-label\',\'Image could not load: ' + filename.replace(/"/g, '&quot;') + '\')"'
                  +    '/>';
            out +=   '</button>';
            out +=   '<span class="pv-attach-caption" aria-hidden="true" title="' + filename.replace(/"/g, '&quot;') + '">' + filename + '</span>';
            out += '</figure>';
        });

        /* File downloads ────────────────────────────── */
        if (links.length > 0) {
            out += '<ul class="pv-file-list" aria-label="Downloadable files">';
            links.forEach(function(a) {
                var href     = a.getAttribute('href') || '#';
                var filename = (a.textContent || '').trim() || 'Download file';
                out += '<li class="pv-file-item">';
                out +=   '<span class="pv-file-icon" aria-hidden="true">';
                out +=     '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false">';
                out +=       '<path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z"/>';
                out +=       '<path d="M9 2v4h4"/>';
                out +=     '</svg>';
                out +=   '</span>';
                out +=   '<a href="' + href + '" target="_blank" rel="noopener noreferrer" class="pv-file-link"'
                      +       ' aria-label="Download ' + filename.replace(/"/g, '&quot;') + ' (opens in new tab)"'
                      +  '>' + filename + '</a>';
                out += '</li>';
            });
            out += '</ul>';
        }

        out += '</div>';
        el.innerHTML = out;
    }

    /* ── Core: fetch one indicator via LEAF's AJAX endpoint ─────────── */
    function loadIndicator(indicatorID, cfg) {
        /* cfg is optional (for the on-demand indicator 13 load) */
        cfg = cfg || { target: 'pv-value-' + indicatorID, isAttachment: false };

        var el = document.getElementById(cfg.target || 'pv-value-' + indicatorID);
        if (!el) { return; }

        $.ajax({
            type: 'GET',
            url: 'ajaxIndex.php?a=getprintindicator'
                + '&recordID=' + encodeURIComponent(recordID)
                + '&indicatorID=' + encodeURIComponent(indicatorID)
                + '&series=1',
            dataType: 'text',
            cache: false,
            success: function(html) {
                if (cfg.isAttachment) {
                    renderAttachments(el, html);
                } else {
                    renderText(el, html);
                    if (typeof cfg.onValue === 'function') {
                        cfg.onValue(extractText(html));
                    }
                }
            },
            error: function() {
                el.innerHTML = '<span class="pv-empty">Could not load this field.</span>';
            }
        });
    }

    /* ── Kick off all field loads on DOM ready ───────────────────────── */
    $(function() {
        fields.forEach(function(cfg) {
            loadIndicator(cfg.id, cfg);
        });
    });

}());
<!--{/literal}-->
</script>


<!-- DIALOG BOXES -->
<div id="formContainer"></div>
<!--{include file="site_elements/generic_xhrDialog.tpl"}-->
<!--{include file="site_elements/generic_confirm_xhrDialog.tpl"}-->
<!--{include file="site_elements/generic_dialog.tpl"}-->

<script type="text/javascript" src="js/functions/toggleZoom.js"></script>
<script type="text/javascript">
var currIndicatorID;
var currSeries;
var recordID = <!--{$recordID}-->;
var serviceID = <!--{$serviceID}-->;
var CSRFToken = '<!--{$CSRFToken}-->';


function getForm(indicatorID, series) {
	form.dialog().show();
	form.setPostModifyCallback(function() {
        getIndicator(indicatorID, series);
        updateProgress();
        form.dialog().hide();
	});
	form.getForm(indicatorID, series);
}

function getIndicatorLog(indicatorID, series) {
	dialog_message.setContent('Modifications made to this field:<table class="agenda" style="background-color: white"><thead><tr><th>Date/Author</th><th>Data</th></tr></thead><tbody id="history_'+ indicatorID +'"></tbody></table>');
    dialog_message.indicateBusy();
    dialog_message.show();

    $.ajax({
        type: 'GET',
        url: "api/form/<!--{$recordID|strip_tags}-->/" + indicatorID + "/" + series + '/history',
        success: function(res) {
        	var numChanges = res.length;
        	var prev = '';
        	for(var i = 0; i < numChanges; i++) {
        		curr = res.pop();
        		date = new Date(curr.timestamp * 1000);
        		data = curr.data;

        		if(i != 0) {
        			data = diffString(prev, data);
        		}

        		$('#history_' + indicatorID).prepend('<tr><td>'+ date.toString() +'<br /><b>'+ curr.name +'</b></td><td><span class="printResponse" style="font-size: 16px">'+ data +'</span></td></tr>');
        		prev = curr.data;
        	}

            dialog_message.indicateIdle();
        },
        error: function(res) {
            dialog_message.setContent(res);
            dialog_message.indicateIdle();
        },
        cache: false
    });
}

function getIndicator(indicatorID, series) {
    $.ajax({
        type: 'GET',
        url: "ajaxIndex.php?a=getprintindicator&recordID=<!--{$recordID|strip_tags}-->&indicatorID=" + indicatorID + "&series=" + series,
        dataType: 'text',
        success: function(response) {
            if($("#PHindicator_" + indicatorID + "_" + series).hasClass("printheading_missing")) {
                $("#PHindicator_" + indicatorID + "_" + series).removeClass("printheading_missing");
                $("#PHindicator_" + indicatorID + "_" + series).addClass("printheading");
            }
            $("#xhrIndicator_" + indicatorID + "_" + series).empty().html(response);
            $("#xhrIndicator_" + indicatorID + "_" + series).fadeOut(250, function() {
                $("#xhrIndicator_" + indicatorID + "_" + series).fadeIn(250);
            });
        },
        cache: false
    });
}

function hideForm() {
    dialog.hide();
}

function restoreRequest() {
	$.ajax({
		type: 'POST',
		url: "ajaxIndex.php?a=restore",
		data: {restore: <!--{$recordID}-->,
            CSRFToken: '<!--{$CSRFToken}-->'},
        success: function(response) {
            if(response > 0) {
                window.location.href="index.php?a=printview&recordID=<!--{$recordID|strip_tags}-->";
            }
        }
	});
}

function openContent(url) {
    $("#formcontent").html('<div style="border: 2px solid black; text-align: center; font-size: 24px; font-weight: bold; background: white; padding: 16px; width: 95%">Loading... <img src="images/largespinner.gif" alt="" /></div>');
    $.ajax({
    	type: 'GET',
    	url: url,
    	dataType: 'text',  // IE9 issue
    	success: function(res) {
    		$('#formcontent').empty().html(res);

    		// make box size more predictable
    		$('.printmainblock').each(function() {
                var boxSizer = {};
    			$(this).find('.printsubheading').each(function() {
    				layer = $(this).position().top;
    				if(boxSizer[layer] == undefined) {
    					boxSizer[layer] = $(this).height();
    				}
    				if($(this).height() > boxSizer[layer]) {
    					boxSizer[layer] = $(this).height();
    				}
    			});
    			$(this).find('.printsubheading').each(function() {
    				layer = $(this).position().top;
    				if(boxSizer[layer] != undefined) {
                        $(this).height(boxSizer[layer]);
    				}
                });
    		});
    	},
    	error: function(res) {
    		$('#formcontent').empty().html(res);
    	},
    	cache: false
    });
}


function scrollPage(id) {
	if($(document).height() < $('#'+id).offset().top + 100) {
		$('html, body').animate({scrollTop: $('#'+id).offset().top}, 500);
	}
}

// attempt to force a consistent width for the sidebar if there is enough desktop resolution
var lastScreenSize = null;

$(function() {
    form = new LeafForm('formContainer');
    form.setRecordID(<!--{$recordID}-->);

    /* General popup window */
    dialog = new dialogController('xhrDialog', 'xhr', 'loadIndicator', 'button_save', 'button_cancelchange');
    dialog_message = new dialogController('genericDialog', 'genericDialogxhr', 'genericDialogloadIndicator', 'genericDialogbutton_save', 'genericDialogbutton_cancelchange');
    dialog_confirm = new dialogController('confirm_xhrDialog', 'confirm_xhr', 'confirm_loadIndicator', 'confirm_button_save', 'confirm_button_cancelchange');

    <!--{if $empMembership['groupID'][226]}-->
    <!--{if $childCategoryID == ''}-->
    openContent('ajaxIndex.php?a=printview&recordID=<!--{$recordID|strip_tags}-->');
    <!--{else}-->
    openContent('ajaxIndex.php?a=internalonlyview&recordID=<!--{$recordID|strip_tags}-->&childCategoryID=<!--{$childCategoryID}-->');
    <!--{/if}-->
    <!--{/if}-->

});

</script>
