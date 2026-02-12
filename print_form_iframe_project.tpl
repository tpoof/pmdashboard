<!--{if $deleted > 0}-->
<div style="font-size: 36px"><img src="dynicons/?img=emblem-unreadable.svg&amp;w=96" alt="" style="float: left" /> Notice: This request has been marked as deleted.<br />
    <span class="buttonNorm" onclick="restoreRequest(<!--{$recordID|strip_tags}-->)"><img src="dynicons/?img=user-trash-full.svg&amp;w=32" alt="" /> Un-delete request</span>
</div><br style="clear: both" />
<hr />
<!--{/if}-->

<!-- Main content area (anything under the heading) -->
<div id="maincontent" style="width: 99%">

<div id="formcontent"><div style="border: 2px solid black; text-align: center; font-size: 24px; font-weight: bold; background: white; padding: 16px; width: 95%">Loading... <img src="images/largespinner.gif" alt="" /></div></div>
</div>

<!-- DIALOG BOXES -->
<div id="formContainer"></div>
<!--{include file="site_elements/generic_xhrDialog.tpl"}-->
<!--{include file="site_elements/generic_confirm_xhrDialog.tpl"}-->
<!--{include file="site_elements/generic_dialog.tpl"}-->

<style type="text/css">
    .pmSandboxLink {
        font-family: monospace;
        font-size: 20px;
        letter-spacing: 0.01rem;
        line-height: 150%;
        font-weight: inherit;
    }
</style>

<script type="text/javascript" src="js/functions/toggleZoom.js"></script>
<script type="text/javascript">
var currIndicatorID;
var currSeries;
var recordID = <!--{$recordID}-->;
var serviceID = <!--{$serviceID}-->;
var CSRFToken = '<!--{$CSRFToken}-->';

function wireSandboxTicket18() {
    var nodes = document.querySelectorAll("[id^='xhrIndicator_18_']");
    if (!nodes || !nodes.length) return;
    nodes.forEach(function(el) {
        if (!el || el.querySelector("a.pmSandboxLink")) return;
        var text = (el.textContent || "").trim();
        var match = text.match(/Sandbox\s*Ticket\s*#(\d+)/i);
        if (!match) return;
        var ticketId = match[1];
        var url =
            "/platform/support/index.php?a=printview&recordID=" +
            encodeURIComponent(ticketId);
        var link = document.createElement("a");
        link.href = "#";
        link.className = "pmSandboxLink";
        link.setAttribute("data-sandbox-url", url);
        link.textContent = "Support Ticket #" + ticketId;
        el.innerHTML = "";
        el.appendChild(link);
    });
}

function decodeEntities(text) {
    var ta = document.createElement("textarea");
    ta.innerHTML = String(text || "");
    return ta.value;
}

function parseDependenciesValue(raw) {
    var text = String(raw || "").trim();
    if (!text) return [];
    try {
        var parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed;
    } catch (e1) {}
    try {
        var decoded = decodeEntities(text);
        var parsed2 = JSON.parse(decoded);
        if (Array.isArray(parsed2)) return parsed2;
    } catch (e2) {}
    return [];
}

function extractDependencyRows(items) {
    if (!items || !items.length) return [];
    return items
        .map(function(item) {
            if (item == null) return null;
            if (typeof item === "string" || typeof item === "number") {
                return { id: String(item).trim(), title: "" };
            }
            if (typeof item === "object") {
                var id =
                    item.id ||
                    item.recordID ||
                    item.recordId ||
                    item.ID ||
                    "";
                var title =
                    item.title ||
                    item.name ||
                    item.label ||
                    item.description ||
                    "";
                return { id: String(id || "").trim(), title: String(title || "") };
            }
            return null;
        })
        .filter(function(row) {
            return row && row.id;
        });
}

function buildDependenciesTable(rows) {
    var table = document.createElement("table");
    table.className = "agenda pm-deps-table";
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";

    var hasTitle = rows.some(function(r) {
        return r.title;
    });

    var thead = document.createElement("thead");
    var headRow = document.createElement("tr");
    var thId = document.createElement("th");
    thId.textContent = "Dependency ID";
    headRow.appendChild(thId);
    if (hasTitle) {
        var thTitle = document.createElement("th");
        thTitle.textContent = "Title";
        headRow.appendChild(thTitle);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    rows.forEach(function(r) {
        var tr = document.createElement("tr");
        var tdId = document.createElement("td");
        var link = document.createElement("a");
        link.href =
            "index.php?a=printview&recordID=" + encodeURIComponent(r.id);
        link.textContent = r.id;
        tdId.appendChild(link);
        tr.appendChild(tdId);
        if (hasTitle) {
            var tdTitle = document.createElement("td");
            tdTitle.textContent = r.title || "";
            tr.appendChild(tdTitle);
        }
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
}

function wireDependencies17() {
    var nodes = document.querySelectorAll(
        "[id^='data_17_'], [id^='xhrIndicator_17_']"
    );
    if (!nodes || !nodes.length) return;
    nodes.forEach(function(el) {
        if (!el || el.getAttribute("data-pm-deps-rendered") === "1") return;
        var raw = "";
        if (el.tagName === "TEXTAREA") {
            raw = el.value || "";
        } else {
            raw = el.textContent || "";
        }
        var rows = extractDependencyRows(parseDependenciesValue(raw));
        if (!rows.length) return;
        var table = buildDependenciesTable(rows);
        el.innerHTML = "";
        el.appendChild(table);
        el.setAttribute("data-pm-deps-rendered", "1");
    });
}

function initSandboxTicketWatcher() {
    var target = document.getElementById("formcontent");
    if (!target || target.__pmSandboxObserver) return;
    var observer = new MutationObserver(function() {
        wireSandboxTicket18();
        wireDependencies17();
    });
    observer.observe(target, {
        childList: true,
        subtree: true,
        characterData: true
    });
    target.__pmSandboxObserver = observer;
}

document.addEventListener("click", function(event) {
    var link = event.target.closest("a.pmSandboxLink");
    if (!link) return;
    event.preventDefault();
    var sandboxUrl = link.getAttribute("data-sandbox-url") || "";
    if (!sandboxUrl) return;
    var linkText = (link.textContent || "").trim();
    if (window.parent && window.parent !== window) {
        window.parent.postMessage(
            { type: "pm-open-modal", title: linkText, url: sandboxUrl },
            window.location.origin
        );
    } else {
        window.location.href = sandboxUrl;
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
            wireSandboxTicket18();
            wireDependencies17();
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
            wireSandboxTicket18();
            wireDependencies17();
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

    initSandboxTicketWatcher();
});

</script>
