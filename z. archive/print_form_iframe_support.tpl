<!--{if $deleted > 0}-->
<div style="font-size: 36px"><img src="dynicons/?img=emblem-unreadable.svg&amp;w=96" alt="" style="float: left" /> Notice: This request has been marked as deleted.<br />
    <span class="buttonNorm" onclick="restoreRequest(<!--{$recordID|strip_tags}-->)"><img src="dynicons/?img=user-trash-full.svg&amp;w=32" alt="" /> Un-delete request</span>
</div><br style="clear: both" />
<hr />
<!--{/if}-->

<!-- Main content area (anything under the heading) -->
<div id="maincontent" style="width: 99%">

<!--{if $empMembership['groupID'][226]}-->
<div class="noprint pm-transfer-wrap">
    <button type="button" class="tools pm-transfer-btn" onclick="transferToPMDashboard()" title="Transfer to LEAF Projects">
        <img src="dynicons/?img=go-next.svg&amp;w=32" alt="" aria-hidden="true" style="vertical-align: middle" /> Transfer to LEAF Projects
    </button>
</div>
<!--{/if}-->

<div id="formcontent"><div style="border: 2px solid black; text-align: center; font-size: 24px; font-weight: bold; background: white; padding: 16px; width: 95%">Loading... <img src="images/largespinner.gif" alt="" /></div></div>
</div>

<style type="text/css">
    .pm-transfer-wrap {
        padding-bottom: 12px;
    }
    .pm-transfer-btn {
        background: #c5ee93 !important;
        color: #000 !important;
        cursor: pointer;
    }
    .pm-transfer-btn:hover,
    .pm-transfer-btn:focus {
        background: #7fb135 !important;
        color: #fff !important;
        cursor: pointer;
    }
</style>

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

function transferToPMDashboard() {
    var params = new URLSearchParams(window.location.search || "");
    var id = params.get("recordID");
    if (!id) return;
    var modal = document.getElementById('pmTransferModal');
    if (!modal) return;
    modal.dataset.recordId = id;
    modal.hidden = false;
    document.getElementById('pmTransferChoiceTask').focus();
}

function doTransferAs(type) {
    var modal = document.getElementById('pmTransferModal');
    var id = modal ? modal.dataset.recordId : '';
    if (!id) return;
    modal.hidden = true;
    var param = type === 'project' ? 'transferProjectFromSupport' : 'transferFromSupport';
    var url = 'https://leaf.va.gov/platform/projects/?tab=' + (type === 'project' ? 'projects' : 'tasks') +
        '&' + param + '=' + encodeURIComponent(id);
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'pmTransferNavigate', url: url }, '*');
    } else {
        window.location.href = url;
    }
}

function closeTransferModal() {
    var modal = document.getElementById('pmTransferModal');
    if (modal) modal.hidden = true;
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeTransferModal();
});

function wirePortalLink148() {
    var nodes = document.querySelectorAll("[id^='xhrIndicator_148_']");
    if (!nodes || !nodes.length) return;
    nodes.forEach(function(el) {
        if (!el || el.querySelector("a.pm-portal-link")) return;
        var text = (el.textContent || "").trim();
        var match = text.match(/^(Support|UX)\s*Ticket\s*#(\d+)/i);
        var ticketType = "support";
        var ticketId = "";
        if (!match) return;
        ticketType = match[1].toLowerCase();
        ticketId = match[2];
        var urlBase =
            ticketType === "ux"
                ? "/platform/ux/index.php?a=printview&recordID="
                : "/platform/support/index.php?a=printview&recordID=";
        var url = urlBase + encodeURIComponent(ticketId);
        var link = document.createElement("a");
        link.href = "#";
        link.className = "pm-portal-link";
        link.setAttribute("data-portal-url", url);
        link.textContent =
            (ticketType === "ux" ? "UX Ticket #" : "Support Ticket #") +
            ticketId;
        el.innerHTML = "";
        el.appendChild(link);
    });
}

function initPortalLinkWatcher() {
    var target = document.getElementById("formcontent");
    if (!target || target.__pmPortalLinkObserver) return;
    var observer = new MutationObserver(function() {
        wirePortalLink148();
    });
    observer.observe(target, {
        childList: true,
        subtree: true,
        characterData: true
    });
    target.__pmPortalLinkObserver = observer;
}

document.addEventListener("click", function(event) {
    var link = event.target.closest("a.pm-portal-link");
    if (!link) return;
    event.preventDefault();
    var portalUrl = link.getAttribute("data-portal-url") || "";
    if (!portalUrl) return;
    var linkText = (link.textContent || "").trim();
    if (window.parent && window.parent !== window) {
        window.parent.postMessage(
            { type: "pm-open-modal", title: linkText, url: portalUrl },
            window.location.origin
        );
    } else {
        window.location.href = portalUrl;
    }
});


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
            wirePortalLink148();
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

    <!--{if $childCategoryID == ''}-->
    openContent('ajaxIndex.php?a=printview&recordID=<!--{$recordID|strip_tags}-->');
    <!--{else}-->
    openContent('ajaxIndex.php?a=internalonlyview&recordID=<!--{$recordID|strip_tags}-->&childCategoryID=<!--{$childCategoryID}-->');
    <!--{/if}-->

    initPortalLinkWatcher();
});

</script>

<style>
/* Transfer modal */
.pm-transferOverlay{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;}
.pm-transferOverlay[hidden]{display:none!important;}
.pm-transferBackdrop{position:absolute;inset:0;background:rgba(0,0,0,.45);}
.pm-transferDialog{position:relative;width:min(92vw,440px);background:#fff;border-radius:16px;border:1px solid rgba(0,0,0,.12);box-shadow:0 6px 16px rgba(15,23,42,.12);display:flex;flex-direction:column;animation:pmFadeIn .15s ease;}
@keyframes pmFadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
.pm-transferHeader{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#f8fafc;border-bottom:1px solid #dbe1e8;border-radius:16px 16px 0 0;}
.pm-transferTitle{font-weight:900;font-size:1rem;color:#1f2933;margin:0;}
.pm-transferClose{border:0;background:transparent;font-size:18px;cursor:pointer;min-width:36px;min-height:36px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;color:#3f4a57;line-height:1;}
.pm-transferClose:hover{background:#dbe1e8;color:#1f2933;}
.pm-transferBody{padding:16px;}
.pm-transferPrompt{margin:0 0 12px;color:#3f4a57;font-size:.95rem;}
.pm-transferChoices{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.pm-transferChoice{display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 12px;border:2px solid #dbe1e8;border-radius:12px;background:#fff;cursor:pointer;font-weight:700;font-size:.95rem;color:#1f2933;text-align:center;transition:border-color .15s,background .15s,box-shadow .15s;box-shadow:0 1px 2px rgba(16,24,40,.08);}
.pm-transferChoice:hover{border-color:#2563eb;background:#e7efff;color:#1d4ed8;box-shadow:0 4px 12px rgba(37,99,235,.15);}
.pm-transferChoice:focus-visible{outline:2px solid #0b5cab;outline-offset:2px;}
.pm-transferChoice:active{transform:translateY(1px);}
.pm-transferChoiceIcon{font-size:28px;line-height:1;}
.pm-transferChoiceLabel{font-weight:800;font-size:1rem;}
.pm-transferChoiceDesc{font-weight:400;font-size:.82rem;color:#3f4a57;line-height:1.35;}
.pm-transferChoice:hover .pm-transferChoiceDesc{color:#1d4ed8;}
</style>

<!-- Transfer to LEAF Projects modal -->
<div id="pmTransferModal" class="pm-transferOverlay" role="dialog" aria-modal="true"
     aria-labelledby="pmTransferModalTitle" hidden>
    <div class="pm-transferBackdrop" onclick="closeTransferModal()" aria-hidden="true"></div>
    <div class="pm-transferDialog">
        <div class="pm-transferHeader">
            <h2 class="pm-transferTitle" id="pmTransferModalTitle">Transfer to LEAF Projects</h2>
            <button type="button" class="pm-transferClose" onclick="closeTransferModal()"
                    aria-label="Close">&times;</button>
        </div>
        <div class="pm-transferBody">
            <p class="pm-transferPrompt">How would you like to transfer this record?</p>
            <div class="pm-transferChoices">
                <button type="button" class="pm-transferChoice" id="pmTransferChoiceTask"
                        onclick="doTransferAs('task')">
                    <span class="pm-transferChoiceIcon" aria-hidden="true">&#9989;</span>
                    <span class="pm-transferChoiceLabel">As a Task</span>
                    <span class="pm-transferChoiceDesc">Add to the Tasks table with ticket reference</span>
                </button>
                <button type="button" class="pm-transferChoice" id="pmTransferChoiceProject"
                        onclick="doTransferAs('project')">
                    <span class="pm-transferChoiceIcon" aria-hidden="true">&#128193;</span>
                    <span class="pm-transferChoiceLabel">As a Project</span>
                    <span class="pm-transferChoiceDesc">Create a new Project with ticket reference</span>
                </button>
            </div>
        </div>
    </div>
</div>
