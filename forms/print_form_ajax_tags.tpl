<!--{*
    print_form_ajax_tags.tpl
    Renders bookmark tags inside the record header tag strip.
    Included by print_form_ajax.tpl and updated via updateTags() AJAX.
*}-->
<!--{foreach from=$tags item=tag}-->
    <span class="lf-tag">🔖 <!--{$tag|sanitize}--></span>
<!--{/foreach}-->
