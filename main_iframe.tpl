{strip}<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    {if $tabText != ''}
    <title>{$tabText|sanitize} - {$title|sanitize} | {$city|sanitize}</title>
    {else}
    <title>{$title|sanitize} | {$city|sanitize}</title>
    {/if}
    <style type="text/css" media="screen">
        @import "{$app_js_path}/jquery/css/dcvamc/jquery-ui.custom.min.css";
{section name=i loop=$stylesheets}
        @import "{$stylesheets[i]}";
{/section}
        @import "css/style.css";
        @import "{$app_js_path}/jquery/chosen/chosen.min.css";
        @import "{$app_js_path}/jquery/trumbowyg/ui/trumbowyg.min.css";
        /* backwards compat */
        @import "{$app_js_path}/jquery/icheck/skins/square/blue.css";
    </style>
    <style type="text/css" media="print">
        @import "css/printer.css";
    </style>
    <script type="text/javascript" src="{$app_js_path}/jquery/jquery.min.js"></script>
    {if $useUI == true}
    <script type="text/javascript" src="{$app_js_path}/jquery/jquery-ui.custom.min.js"></script>
    <script type="text/javascript" src="js/dialogController.js"></script>
    <script type="text/javascript" src="{$app_js_path}/jquery/chosen/chosen.jquery.min.js"></script>
    <script type="text/javascript" src="{$app_js_path}/jquery/trumbowyg/trumbowyg.min.js"></script>
    <!--backwards compat -->
    <script type="text/javascript" src="{$app_js_path}/jquery/icheck/icheck.js"></script>
    {else if $useLiteUI == true}
    <script type="text/javascript" src="js/dialogController.js"></script>
    <script type="text/javascript" src="{$app_js_path}/jquery/chosen/chosen.jquery.min.js"></script>
    <script type="text/javascript" src="{$app_js_path}/jquery/trumbowyg/trumbowyg.min.js"></script>
    <!--backwards compat -->
    <script type="text/javascript" src="{$app_js_path}/jquery/icheck/icheck.js"></script>
    {/if}
{section name=i loop=$javascripts}
    <script type="text/javascript" src="{$javascripts[i]}"></script>
{/section}

    {* ── Launchpad universal header ──
       Kept in sync with main.tpl: if any of the 7 launchpad actions are ever
       rendered through the iframe template, they still get the universal
       nav's CSS/JS. This template has no legacy #header/#footer to suppress,
       so there's nothing else to gate here. *}
    {if $smarty.get.a == 'lp_home' || $smarty.get.a == 'lp_find_site' || $smarty.get.a == 'lp_form_library' || $smarty.get.a == 'lp_impact' || $smarty.get.a == 'lp_voc' || $smarty.get.a == 'lp_training_placeholder' || $smarty.get.a == 'lp_brand_guide'}
        <link rel="stylesheet" href="/launchpad/files/leaf_header_preprod.css" />
        <script src="/launchpad/files/leaf_header_preprod.js"></script>
    {/if}
</head>
<body>
<div id="body">
    <div id="content">
        {if $status != ''}
        <div class="alert"><span>{$status}</span></div>
        {/if}
        <div id="bodyarea">
            {$body}
        </div>
    </div>
</div>
</body>
</html>{/strip}