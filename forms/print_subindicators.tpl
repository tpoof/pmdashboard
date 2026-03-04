<!--{strip}-->
<!--{*
    print_subindicators.tpl
    Renders a list of form indicators as either:
      .lf-field-row  — for simple/short value field types
      .lf-field-card — for rich/long value field types

    CARD formats: textarea, multiselect, checkboxes, fileupload,
                  image, grid, orgchart_position, '' (custom htmlPrint)
    ROW  formats: everything else
*}-->

<!--{if !isset($depth)}--><!--{assign var='depth' value=0}--><!--{/if}-->

<!--{if $form}-->
<div class="lf-field-list<!--{if $depth == 0}--> lf-field-list--animate<!--{/if}-->">

<!--{foreach from=$form item=indicator}-->

    <!--{* ── Register conditional display logic ───────────────────── *}-->
    <!--{if $indicator.conditions != '' && $indicator.conditions !== 'null'}-->
    <script>
        if (typeof formPrintConditions !== 'undefined') {
            formPrintConditions["id<!--{$indicator.indicatorID}-->"] = {
                conditions: <!--{$indicator.conditions|strip_tags}-->,
                format: '<!--{$indicator.format}-->'
            };
        }
    </script>
    <!--{/if}-->

    <!--{*
        Determine layout variant.
        CARD_FORMATS is checked inline since Smarty doesn't have a native "in_array".
        We use a cascade of format checks.
    *}-->

    <!--{if
        $indicator.format == 'textarea'     ||
        $indicator.format == 'multiselect'  ||
        $indicator.format == 'checkboxes'   ||
        $indicator.format == 'fileupload'   ||
        $indicator.format == 'image'        ||
        $indicator.format == 'grid'         ||
        $indicator.format == 'orgchart_position' ||
        $indicator.format == null           ||
        $indicator.format == ''
    }-->
        <!--{assign var='useCard' value=true}-->
    <!--{else}-->
        <!--{assign var='useCard' value=false}-->
    <!--{/if}-->


    <!--{* ════════════════════════════════════════════════
        DEPTH 0 — top-level indicators
        ════════════════════════════════════════════════ *}-->
    <!--{if $depth == 0}-->

        <!--{if $useCard}-->
        <!--{* CARD layout *}-->
        <div class="lf-field-card<!--{if $indicator.required == 1 && $indicator.isEmpty == true}--> lf-missing<!--{/if}-->"
             id="subIndicator_<!--{$indicator.indicatorID|strip_tags}-->_<!--{$indicator.series|strip_tags}-->">

            <div class="lf-field-card-header">
                <span class="lf-field-card-num"><!--{counter}--></span>
                <div class="lf-field-card-label"
                     id="PHindicator_<!--{$indicator.indicatorID|strip_tags}-->_<!--{$indicator.series|strip_tags}-->"
                     class="<!--{if $indicator.required == 1 && $indicator.isEmpty == true}-->lf-missing<!--{/if}-->">

                    <!--{$indicator.name|sanitizeRichtext|strip_tags}-->

                    <!--{if $indicator.is_sensitive == 1}-->
                        <span class="lf-sensitive-label">Sensitive</span>
                    <!--{/if}-->

                    <!--{if $indicator.isWritable == 0}-->
                        <span class="lf-readonly-label">Read-only</span>
                    <!--{/if}-->

                    <!--{if $date < $indicator.timestamp && $date > 0}-->
                        <span class="lf-field-updated">Updated</span>
                    <!--{/if}-->
                </div>

                <!--{if $indicator.isWritable != 0}-->
                <button type="button"
                    class="lf-field-edit"
                    aria-label="Edit <!--{$indicator.name|sanitizeRichtext|strip_tags}--> field"
                    onclick="getForm(<!--{$indicator.indicatorID|strip_tags}-->, <!--{$indicator.series|strip_tags}-->)"
                    onkeydown="if(event.keyCode==13){getForm(<!--{$indicator.indicatorID|strip_tags}-->, <!--{$indicator.series|strip_tags}-->);}">
                    ✎ Edit
                </button>
                <!--{/if}-->

                <!--{if $date < $indicator.timestamp && $date > 0}-->
                <button type="button"
                    class="lf-btn lf-btn-ghost lf-noprint"
                    style="font-size:.7rem;padding:3px 7px"
                    aria-label="View history for <!--{$indicator.name|sanitizeRichtext|strip_tags}-->"
                    onclick="getIndicatorLog(<!--{$indicator.indicatorID|strip_tags}-->, <!--{$indicator.series|strip_tags}-->)"
                    onkeydown="if(event.keyCode==13){getIndicatorLog(<!--{$indicator.indicatorID|strip_tags}-->, <!--{$indicator.series|strip_tags}-->);}">
                    ⏱ History
                </button>
                <!--{/if}-->
            </div>

            <div class="<!--{if $indicator.is_sensitive == 1}-->lf-sensitive-field<!--{/if}-->"
                 id="xhrIndicator_<!--{$indicator.indicatorID|strip_tags}-->_<!--{$indicator.series|strip_tags}-->">
                <!--{include file=$printSubindicatorsAjaxTemplate}-->
            </div>
        </div>

        <!--{else}-->
        <!--{* ROW layout *}-->
        <div class="lf-field-row<!--{if $indicator.required == 1 && $indicator.isEmpty == true}--> lf-missing<!--{/if}-->"
             id="subIndicator_<!--{$indicator.indicatorID|strip_tags}-->_<!--{$indicator.series|strip_tags}-->">

            <span class="lf-field-num"><!--{counter}--></span>

            <div class="lf-field-label"
                 id="PHindicator_<!--{$indicator.indicatorID|strip_tags}-->_<!--{$indicator.series|strip_tags}-->">

                <!--{if $indicator.isWritable == 0}-->
                    <span onclick="void(0)" title="indicatorID: <!--{$indicator.indicatorID|strip_tags}-->">
                        <!--{$indicator.name|sanitizeRichtext|strip_tags}-->
                    </span>
                <!--{else}-->
                    <span style="cursor:pointer" title="indicatorID: <!--{$indicator.indicatorID|strip_tags}-->"
                          onclick="getForm(<!--{$indicator.indicatorID|strip_tags}-->, <!--{$indicator.series|strip_tags}-->)">
                        <!--{$indicator.name|sanitizeRichtext|strip_tags}-->
                    </span>
                <!--{/if}-->

                <!--{if $indicator.is_sensitive == 1}-->
                    <span class="lf-sensitive-label">Sensitive</span>
                <!--{/if}-->

                <!--{if $indicator.isWritable == 0}-->
                    <span class="lf-readonly-label">Read-only</span>
                <!--{/if}-->

                <!--{if $date < $indicator.timestamp && $date > 0}-->
                    <span class="lf-field-updated">Updated</span>
                <!--{/if}-->
            </div>

            <div class="<!--{if $indicator.is_sensitive == 1}-->lf-sensitive-field<!--{/if}-->"
                 id="xhrIndicator_<!--{$indicator.indicatorID|strip_tags}-->_<!--{$indicator.series|strip_tags}-->">
                <!--{include file=$printSubindicatorsAjaxTemplate}-->
            </div>

            <!--{if $indicator.isWritable != 0}-->
            <button type="button"
                class="lf-field-edit lf-noprint"
                aria-label="Edit <!--{$indicator.name|sanitizeRichtext|strip_tags}-->"
                onclick="getForm(<!--{$indicator.indicatorID|strip_tags}-->, <!--{$indicator.series|strip_tags}-->)"
                onkeydown="if(event.keyCode==13){getForm(<!--{$indicator.indicatorID|strip_tags}-->, <!--{$indicator.series|strip_tags}-->);}">
                ✎ Edit
            </button>
            <!--{else}-->
            <span></span><!--{* grid placeholder *}-->
            <!--{/if}-->

        </div>
        <!--{/if}--><!--{* end depth==0 row/card split *}-->


    <!--{* ════════════════════════════════════════════════
        DEPTH > 0 — child / sub-indicators
        Rendered inside their parent card body
        ════════════════════════════════════════════════ *}-->
    <!--{else}-->

        <div class="lf-field-sub<!--{if $indicator.required == 1 && $indicator.isEmpty == true}--> lf-missing<!--{/if}-->"
             id="subIndicator_<!--{$indicator.indicatorID|strip_tags}-->_<!--{$indicator.series|strip_tags}-->"
             style="padding: 8px 0 0 <!--{$depth}-->px; border-top: 1px solid var(--lf-border);">

            <!--{if $indicator.name != ''}-->
            <div class="lf-field-label" style="margin-bottom:4px"
                 id="PHindicator_<!--{$indicator.indicatorID|strip_tags}-->_<!--{$indicator.series|strip_tags}-->">

                <!--{$indicator.name|sanitizeRichtext|strip_tags}-->

                <!--{if $indicator.is_sensitive == 1}-->
                    <span class="lf-sensitive-label">Sensitive</span>
                <!--{/if}-->

                <!--{if $date < $indicator.timestamp && $date > 0}-->
                    &nbsp;<button type="button"
                        class="lf-btn lf-btn-ghost lf-noprint"
                        style="font-size:.68rem;padding:2px 6px"
                        onclick="getIndicatorLog(<!--{$indicator.indicatorID|strip_tags}-->, <!--{$indicator.series|strip_tags}-->)"
                        onkeydown="if(event.keyCode==13){getIndicatorLog(<!--{$indicator.indicatorID|strip_tags}-->, <!--{$indicator.series|strip_tags}-->);}">
                        ⏱ History
                    </button>
                <!--{/if}-->
            </div>
            <!--{/if}-->

            <div class="<!--{if $indicator.is_sensitive == 1}-->lf-sensitive-field<!--{/if}-->"
                 id="xhrIndicator_<!--{$indicator.indicatorID|strip_tags}-->_<!--{$indicator.series|strip_tags}-->">
                <!--{include file=$printSubindicatorsAjaxTemplate}-->
            </div>
        </div>

    <!--{/if}--><!--{* end depth check *}-->

<!--{/foreach}-->

</div><!--{* /lf-field-list *}-->
<!--{/if}--><!--{* /if $form *}-->
<!--{/strip}-->
