<!--{*
    print_form_ajax.tpl
    The request header block — title, metadata, tags.
    Injected into #formcontent by openContent() via AJAX.
    Depends on: leaf-forms.css
*}-->

<div class="lf-record-header lf-animate-in">

    <!--{* Status badge row *}-->
    <div class="lf-rh-top">
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <!--{if $submitted == 0}-->
                <span class="lf-badge lf-badge-inprogress">
                    <span class="lf-badge-dot"></span>In Progress
                </span>
            <!--{else}-->
                <span class="lf-badge lf-badge-submitted">
                    <span class="lf-badge-dot"></span>Submitted
                </span>
            <!--{/if}-->
        </div>
        <span class="lf-record-id">#<!--{$recordID|strip_tags}--></span>
    </div>

    <!--{* Title — editable if not submitted or user is admin *}-->
    <div id="requestTitle">
        <div class="lf-rh-title">
            <!--{$title|sanitize}--> <!--{$subtype|sanitize}-->
            <!--{if $submitted == 0 || $is_admin}-->
                <button
                    type="button"
                    class="lf-btn lf-btn-ghost lf-noprint"
                    style="font-size:.72rem; padding:3px 8px; margin-left:6px; vertical-align:middle"
                    aria-label="Edit request title"
                    onclick="changeTitle()"
                    onkeydown="if(event.keyCode==13){ changeTitle(); }">
                    ✎ Edit Title
                </button>
            <!--{/if}-->
        </div>
        <div class="lf-rh-subtitle"><!--{$categoryText|sanitize}--></div>
    </div>

    <!--{* Metadata row *}-->
    <div class="lf-rh-meta">
        <div class="lf-meta-item">
            <div class="lf-meta-label">Service</div>
            <div class="lf-meta-value">
                <!--{if $service != ''}-->
                    <!--{$service|sanitize}-->
                <!--{else}-->
                    <span class="lf-meta-value--muted">Not set</span>
                <!--{/if}-->
                <!--{if $submitted == 0}-->
                    <button
                        type="button"
                        class="lf-btn lf-btn-ghost lf-noprint"
                        style="font-size:.68rem; padding:2px 6px; margin-left:4px"
                        aria-label="Edit service"
                        onclick="changeService()"
                        onkeydown="if(event.keyCode==13){ changeService(); }">
                        ✎
                    </button>
                <!--{/if}-->
            </div>
        </div>
        <div class="lf-meta-item">
            <div class="lf-meta-label">Initiated By</div>
            <div class="lf-meta-value"><!--{$name|sanitize}--></div>
        </div>
        <div class="lf-meta-item"<!--{if $date == 0}--> style="display:none"<!--{/if}-->>
            <div class="lf-meta-label">Submitted</div>
            <div class="lf-meta-value">
                <!--{if $date > 0}-->
                    <!--{$date|date_format:"%A, %B %e, %Y"}-->
                <!--{else}-->
                    <span class="lf-meta-value--muted">Not yet submitted</span>
                <!--{/if}-->
            </div>
        </div>
    </div>

    <!--{* Tags / bookmarks strip *}-->
    <div
        class="lf-rh-tags<!--{if count($tags) == 0}--> lf-noprint<!--{/if}-->"
        id="tags"
        role="status"
        aria-live="polite"
        style="margin-top: 12px;">
        <!--{include file="print_form_ajax_tags.tpl" tags=$tags}-->
    </div>

</div>

<!--{* Form field sections rendered by print_subindicators.tpl *}-->
<div class="lf-tabs-wrap" style="margin-top: 14px;">
    <!--{include file=$printSubindicatorsTemplate form=$form orgchartPath=$orgchartPath}-->
</div>
