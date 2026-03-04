<!--
    print_subindicators_ajax.tpl
    Renders the VALUE portion of a single form field indicator.
    Called from print_subindicators.tpl for each $indicator.

    Layout rules (maps to leaf-forms.css):
      ROW  (.lf-field-row)  — text, number, numberspinner, date, time,
                               currency, radio, dropdown, checkbox, raw_data,
                               orgchart_group, orgchart_employee
      CARD (.lf-field-card) — textarea, multiselect, checkboxes,
                               fileupload, image, grid, orgchart_position,
                               and any format == '' (custom htmlPrint)
-->

<!--{* ── Sensitive field: masked overlay + toggle ─────────────────── *}-->
<!--{if $indicator.is_sensitive == 1}-->
    <div class="lf-sensitive-toggle-wrap">
        <label class="lf-sr-only" for="sensToggle_<!--{$indicator.indicatorID|strip_tags}-->_<!--{$indicator.series|strip_tags}-->">
            Show sensitive field
        </label>
        <input
            type="checkbox"
            id="sensToggle_<!--{$indicator.indicatorID|strip_tags}-->_<!--{$indicator.series|strip_tags}-->"
            class="lf-sr-only"
            onchange="lfToggleSensitive(<!--{$indicator.indicatorID|strip_tags}-->, <!--{$indicator.series|strip_tags}-->, this.checked)"
        />
        <button
            type="button"
            class="lf-btn lf-btn-ghost"
            style="font-size:.72rem; padding:3px 8px; margin-bottom:6px"
            onclick="lfToggleSensitiveBtn(<!--{$indicator.indicatorID|strip_tags}-->, <!--{$indicator.series|strip_tags}-->, this)"
            aria-label="Toggle sensitive field visibility"
        >👁 Show</button>
    </div>
    <div
        id="sensValue_<!--{$indicator.indicatorID|strip_tags}-->_<!--{$indicator.series|strip_tags}-->"
        class="lf-sensitive-content"
        style="filter: blur(4px); transition: filter .2s; user-select: none;"
    >
<!--{/if}-->

<!--{* ═══════════════════════════════════════════════════════════════
    ROW-TYPE FIELDS
    These are rendered inline by the parent .lf-field-row in
    print_subindicators.tpl — we only output the value markup here.
    ═══════════════════════════════════════════════════════════════ *}-->

<!--{if $indicator.format == 'text'}-->
    <span class="lf-field-value" id="data_<!--{$indicator.indicatorID}-->_<!--{$indicator.series}-->">
        <!--{$indicator.value|sanitize}-->
    </span>
    <!--{$indicator.htmlPrint}-->
    <script>
        if (typeof enableUserContentLinks === 'function') {
            enableUserContentLinks(document.getElementById('data_<!--{$indicator.indicatorID}-->_<!--{$indicator.series}-->'));
        }
    </script>
<!--{/if}-->

<!--{if $indicator.format == 'number' || $indicator.format == 'numberspinner'}-->
    <span class="lf-field-value lf-field-value--mono" id="data_<!--{$indicator.indicatorID}-->_<!--{$indicator.series}-->">
        <!--{$indicator.value|sanitize}-->
    </span>
    <!--{$indicator.htmlPrint}-->
<!--{/if}-->

<!--{if $indicator.format == 'radio'}-->
    <span class="lf-field-value" id="data_<!--{$indicator.indicatorID}-->_<!--{$indicator.series}-->">
        <!--{$indicator.value|sanitize}-->
    </span>
    <!--{$indicator.htmlPrint}-->
<!--{/if}-->

<!--{if $indicator.format == 'dropdown'}-->
    <span class="lf-field-value" id="data_<!--{$indicator.indicatorID}-->_<!--{$indicator.series}-->">
        <!--{$indicator.value|sanitize}-->
    </span>
    <!--{$indicator.htmlPrint}-->
<!--{/if}-->

<!--{if $indicator.format == 'checkbox'}-->
    <span class="lf-field-value" id="data_<!--{$indicator.indicatorID}-->_<!--{$indicator.series}-->">
        <!--{$indicator.value|sanitize}-->
    </span>
    <!--{$indicator.htmlPrint}-->
<!--{/if}-->

<!--{if $indicator.format == 'date'}-->
    <span class="lf-field-value lf-date" id="data_<!--{$indicator.indicatorID}-->_<!--{$indicator.series}-->">
        <!--{if $indicator.value != '' && $indicator.value != '[protected data]'}-->
            <!--{$indicator.value|date_format:"%A, %B %e, %Y"}-->
        <!--{/if}-->
    </span>
    <!--{$indicator.htmlPrint}-->
<!--{/if}-->

<!--{if $indicator.format == 'time'}-->
    <span class="lf-field-value" id="data_<!--{$indicator.indicatorID}-->_<!--{$indicator.series}-->">
        <!--{if $indicator.value != '' && $indicator.value != '[protected data]'}-->
            <!--{$indicator.value|date_format:"%l:%M %p"}-->
        <!--{/if}-->
    </span>
    <!--{$indicator.htmlPrint}-->
<!--{/if}-->

<!--{if $indicator.format == 'currency'}-->
    <span class="lf-field-value lf-currency" id="data_<!--{$indicator.indicatorID}-->_<!--{$indicator.series}-->">
        <!--{if is_numeric($indicator.value)}-->
            <!--{if $indicator.value < 0}-->-<!--{/if}-->$<!--{$indicator.value|abs|number_format:2:".":","}-->
        <!--{/if}-->
    </span>
    <!--{$indicator.htmlPrint}-->
<!--{/if}-->

<!--{if $indicator.format == 'raw_data'}-->
    <textarea
        class="lf-field-value"
        id="data_<!--{$indicator.indicatorID}-->_<!--{$indicator.series}-->"
        style="display: none"
    ><!--{$indicator.value|sanitize}--></textarea>
    <!--{$indicator.htmlPrint}-->
<!--{/if}-->

<!--{if $indicator.format == 'orgchart_group'}-->
    <span class="lf-field-value" id="data_<!--{$indicator.indicatorID}-->_<!--{$indicator.series}-->">
        <!--{if $indicator.value != ''}-->
            <!--{if $indicator.displayedValue != ''}-->
                <!--{$indicator.displayedValue|sanitize}-->
            <!--{else}-->
                Group #<!--{$indicator.value|escape}--> not found
                <span class="lf-field-value--muted">(recorded <!--{$indicator.timestamp|date_format}--> by <!--{$indicator.userID|escape}-->)</span>
            <!--{/if}-->
        <!--{else}-->
            <span class="lf-field-value--empty">Unassigned</span>
        <!--{/if}-->
    </span>
<!--{/if}-->

<!--{if $indicator.format == 'orgchart_employee'}-->
    <span class="lf-field-value" id="data_<!--{$indicator.indicatorID}-->_<!--{$indicator.series}-->">
        <!--{if trim($indicator.value) != ''}-->
            <!--{if $indicator.displayedValue != ''}-->
                <a href="<!--{$orgchartPath}-->/?a=view_employee&empUID=<!--{$indicator.value|escape}-->">
                    <!--{$indicator.displayedValue|sanitize}-->
                </a>
            <!--{else}-->
                empUID #<!--{$indicator.value|escape}--> (disabled account)
                <span class="lf-field-value--muted">(recorded <!--{$indicator.timestamp|date_format}--> by <!--{$indicator.userID|escape}-->)</span>
            <!--{/if}-->
        <!--{else}-->
            <span class="lf-field-value--empty">Unassigned</span>
        <!--{/if}-->
    </span>
<!--{/if}-->


<!--{* ═══════════════════════════════════════════════════════════════
    CARD-TYPE FIELDS
    These get their own padded block. The parent .lf-field-card
    wrapper is emitted by print_subindicators.tpl.
    ═══════════════════════════════════════════════════════════════ *}-->

<!--{if $indicator.format == '' || $indicator.format == null}-->
    <!--{$indicator.htmlPrint}-->
<!--{/if}-->

<!--{if $indicator.format == 'textarea'}-->
    <div class="lf-field-card-value lf-field-card-value--textarea" id="data_<!--{$indicator.indicatorID}-->_<!--{$indicator.series}-->">
        <!--{$indicator.value|replace:'  ':'&nbsp;&nbsp;'|sanitize}-->
    </div>
    <!--{$indicator.htmlPrint}-->
    <script>
        if (typeof enableUserContentLinks === 'function') {
            enableUserContentLinks(document.getElementById('data_<!--{$indicator.indicatorID}-->_<!--{$indicator.series}-->'));
        }
    </script>
<!--{/if}-->

<!--{if $indicator.format == 'multiselect'}-->
    <div class="lf-field-card-value">
        <!--{assign var='idx' value=0}-->
        <div class="lf-chip-list" id="data_<!--{$indicator.indicatorID}-->_<!--{$indicator.series}-->">
            <!--{foreach from=$indicator.value item=option}-->
                <input type="hidden" name="<!--{$indicator.indicatorID}-->[<!--{$idx}-->]" value="no" />
                <!--{if $indicator.value[$idx] != 'no'}-->
                    <span class="lf-chip lf-chip--check"><!--{$option|sanitize}--></span>
                <!--{/if}-->
                <!--{assign var='idx' value=$idx+1}-->
            <!--{/foreach}-->
        </div>
    </div>
    <!--{$indicator.htmlPrint}-->
<!--{/if}-->

<!--{if $indicator.format == 'checkboxes'}-->
    <div class="lf-field-card-value">
        <!--{assign var='idx' value=0}-->
        <div class="lf-chip-list" id="data_<!--{$indicator.indicatorID}-->_<!--{$indicator.series}-->">
            <!--{foreach from=$indicator.value item=option}-->
                <input type="hidden" name="<!--{$indicator.indicatorID}-->[<!--{$idx}-->]" value="no" />
                <!--{if $indicator.value[$idx] != 'no' && $indicator.value[$idx] !== ''}-->
                    <span class="lf-chip lf-chip--check"><!--{$option|sanitize}--></span>
                <!--{/if}-->
                <!--{assign var='idx' value=$idx+1}-->
            <!--{/foreach}-->
        </div>
    </div>
    <!--{$indicator.htmlPrint}-->
<!--{/if}-->

<!--{if $indicator.format == 'fileupload'}-->
    <div class="lf-field-card-value" id="data_<!--{$indicator.indicatorID}-->_<!--{$indicator.series}-->">
        <!--{if $indicator.value[0] != ''}-->
            <!--{assign var='idx' value=0}-->
            <div class="lf-file-list">
            <!--{foreach from=$indicator.value item=file}-->
                <a
                    href="<!--{$portal_url}-->file.php?form=<!--{$recordID}-->&amp;id=<!--{$indicator.indicatorID}-->&amp;series=<!--{$indicator.series}-->&amp;file=<!--{$idx}-->"
                    target="_blank"
                    class="lf-file-item"
                >
                    <span class="lf-file-ext"><!--{$file|lower|regex_replace:'/.*\.([a-z0-9]+)$/':'$1'}--></span>
                    <!--{$file}-->
                </a>
                <!--{assign var='idx' value=$idx+1}-->
            <!--{/foreach}-->
            </div>
        <!--{else}-->
            <span class="lf-field-value--empty">No files attached.</span>
        <!--{/if}-->
    </div>
<!--{/if}-->

<!--{if $indicator.format == 'image'}-->
    <div class="lf-field-card-value" id="data_<!--{$indicator.indicatorID}-->_<!--{$indicator.series}-->">
        <!--{if $indicator.value[0] != ''}-->
            <!--{assign var='idx' value=0}-->
            <!--{foreach from=$indicator.value item=file}-->
                <!--{if $indicator.value != '[protected data]'}-->
                    <img
                        class="lf-image-preview"
                        alt="<!--{$file}-->"
                        src="<!--{$portal_url}-->image.php?form=<!--{$recordID}-->&amp;id=<!--{$indicator.indicatorID}-->&amp;series=<!--{$indicator.series}-->&amp;file=<!--{$idx}-->"
                        onclick="window.open('<!--{$portal_url}-->image.php?form=<!--{$recordID}-->&amp;id=<!--{$indicator.indicatorID}-->&amp;series=<!--{$indicator.series}-->&amp;file=<!--{$idx}-->', '_blank')"
                    />
                    <!--{assign var='idx' value=$idx+1}-->
                <!--{else}-->
                    <span class="lf-field-value--empty">[protected data]</span>
                <!--{/if}-->
            <!--{/foreach}-->
        <!--{else}-->
            <span class="lf-field-value--empty">No image available.</span>
        <!--{/if}-->
    </div>
<!--{/if}-->

<!--{if $indicator.format == 'orgchart_position'}-->
    <div class="lf-field-card-value" id="data_<!--{$indicator.indicatorID}-->_<!--{$indicator.series}-->">
        <!--{if trim($indicator.value) != ''}-->
            <!--{if $indicator.displayedValue != ''}-->
                <!--{$indicator.displayedValue|sanitize}-->
            <!--{else}-->
                Loading&hellip;
            <!--{/if}-->
            <script>
            (function() {
                $.ajax({
                    type: 'GET',
                    url: '<!--{$orgchartPath}-->/api/position/<!--{$indicator.value|escape}-->',
                    dataType: 'json',
                    success: function(data) {
                        var el = document.getElementById('data_<!--{$indicator.indicatorID}-->_<!--{$indicator.series}-->');
                        if (!el) return;
                        if (data.title) {
                            el.innerHTML =
                                '<a href="<!--{$orgchartPath}-->/?a=view_position&positionID=<!--{$indicator.value|escape}-->" target="_blank" class="lf-file-item" style="margin-top:4px">' +
                                    data.title + ' — ' + (data[2]?.data || '') + '</a>';
                            if (data[3] && data[3].data) {
                                data[3].data.forEach(function(f) {
                                    el.insertAdjacentHTML('beforeend',
                                        '<br/><a class="lf-file-item" target="_blank" href="<!--{$orgchartPath}-->/file.php?categoryID=2&UID=<!--{$indicator.value}-->&indicatorID=3&file=' +
                                        encodeURIComponent(f) + '">' +
                                        '<span class="lf-file-ext">doc</span>' + f + '</a>'
                                    );
                                });
                            }
                        } else {
                            el.textContent = 'Position #<!--{$indicator.value|escape}--> not found';
                        }
                    }
                });
            })();
            </script>
        <!--{else}-->
            <span class="lf-field-value--empty">Unassigned</span>
        <!--{/if}-->
    </div>
<!--{/if}-->

<!--{if $indicator.format == 'grid' && ($indicator.isMasked == 0 || $indicator.value == '')}-->
    <div class="lf-field-card-value">
        <div class="lf-grid-scroll" id="data_<!--{$indicator.indicatorID}-->_<!--{$indicator.series}-->">
            <table class="table" id="grid_<!--{$indicator.indicatorID}-->_<!--{$indicator.series}-->_<!--{$recordID}-->_output" style="word-wrap:break-word; text-align:center; width:100%">
                <thead></thead>
                <tbody></tbody>
            </table>
        </div>
        <script>
            (function() {
                var g = new gridInput(<!--{$indicator.options[0]}-->, <!--{$indicator.indicatorID}-->, <!--{$indicator.series}-->, <!--{$recordID}-->);
                $(function() { g.output(<!--{$indicator.value|json_encode}-->); });
            })();
        </script>
    </div>
<!--{/if}-->

<!--{* ── Close sensitive wrapper ─────────────────────────────────── *}-->
<!--{if $indicator.is_sensitive == 1}-->
    </div><!--{* /lf-sensitive-content *}-->
<!--{/if}-->

<!--{* ── Recurse into child indicators ────────────────────────────── *}-->
<!--{include file=$printSubindicatorsTemplate form=$indicator.child depth=$depth+4 recordID=$recordID}-->
