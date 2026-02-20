<script>
  (function () {
    "use strict";

    // Put your indicatorID here (the field that should store LEAF-###)
    var INDICATOR_ID = 135;

     function formatKeyFromRecordId(recordId) {
      var n = Number(recordId);
      if (!Number.isFinite(n) || n < 0) return "LEAF-0";
      return "LEAF-" + String(n);
    }

    function getIndicatorInput(indicatorId) {
      // Most LEAF indicators render as name="<id>" and id="<id>"
      return (
        document.querySelector('input[name="' + indicatorId + '"]') ||
        document.getElementById(String(indicatorId)) ||
        document.querySelector('#xhrIndicator_' + indicatorId + '_1 input') ||
        null
      );
    }

    function lockField(el) {
      if (!el) return;

      // readonly still submits. disabled does not submit.
      el.readOnly = true;
      el.setAttribute("aria-readonly", "true");

      // extra lock so nobody can click into it and edit
      el.style.pointerEvents = "none";
      el.style.backgroundColor = "#f3f3f3";
    }

    function getRecordIdFromUrl() {
      // Tries common LEAF patterns. If not present yet, returns null.
      var href = String(window.location.href);

      // common query param patterns
      var m1 = href.match(/[?&]recordID=(\d+)/i);
      if (m1) return Number(m1[1]);

      // API edit URLs like .../api/form/564
      var m2 = href.match(/\/api\/form\/(\d+)(\/|$)/i);
      if (m2) return Number(m2[1]);

      return null;
    }

    function setKeyIfPossible() {
      var input = getIndicatorInput(INDICATOR_ID);
      if (!input) return;

      lockField(input);

      var rid = getRecordIdFromUrl();
      if (!rid) {
        // New record, ID not assigned yet
        if (!input.value) input.value = "LEAF-PENDING";
        return;
      }

      var key = formatKeyFromRecordId(rid);
      if (input.value !== key) {
        input.value = key;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    // Universal reload after submit for LEAF api submit endpoint
    function installAutoReloadAfterSubmit() {
      if (window.__leafAutoReloadAfterSubmitInstalled) return;
      window.__leafAutoReloadAfterSubmitInstalled = true;

      var RELOAD_DELAY_MS = 900;

      function isSubmitEndpoint(url) {
        try {
          var u = new URL(url, window.location.origin);
          return /\/api\/form\/\d+\/submit\/?$/.test(u.pathname);
        } catch (e) {
          return /\/api\/form\/\d+\/submit\/?/.test(String(url || ""));
        }
      }

      function reloadSoon() {
        setTimeout(function () {
          try { window.location.reload(); } catch (e) {}
        }, RELOAD_DELAY_MS);
      }

      // Watch for submit success and reload so the recordID exists and we can set LEAF-###
      if (window.fetch && !window.fetch.__leafAutoReloadHooked) {
        var origFetch = window.fetch;
        window.fetch = function (input, init) {
          var url = (typeof input === "string") ? input : (input && input.url);
          return origFetch.apply(this, arguments).then(function (resp) {
            try {
              if (url && isSubmitEndpoint(url) && resp && resp.ok) reloadSoon();
            } catch (e) {}
            return resp;
          });
        };
        window.fetch.__leafAutoReloadHooked = true;
      }

      if (window.XMLHttpRequest && !window.XMLHttpRequest.__leafAutoReloadHooked) {
        var OriginalXHR = window.XMLHttpRequest;

        function WrappedXHR() {
          var xhr = new OriginalXHR();
          var originalOpen = xhr.open;
          var originalSend = xhr.send;

          xhr.open = function (method, url) {
            xhr.__leafUrl = url;
            return originalOpen.apply(xhr, arguments);
          };

          xhr.send = function (body) {
            try {
              if (xhr.__leafUrl && isSubmitEndpoint(xhr.__leafUrl)) {
                xhr.addEventListener("load", function () {
                  try {
                    if (xhr.status >= 200 && xhr.status < 300) reloadSoon();
                  } catch (e) {}
                });
              }
            } catch (e) {}

            return originalSend.apply(xhr, arguments);
          };

          return xhr;
        }

        WrappedXHR.prototype = OriginalXHR.prototype;
        window.XMLHttpRequest = WrappedXHR;
        window.XMLHttpRequest.__leafAutoReloadHooked = true;
      }
    }

    function init() {
      installAutoReloadAfterSubmit();
      setKeyIfPossible();

      // Also retry shortly after load in case LEAF renders fields asynchronously
      setTimeout(setKeyIfPossible, 300);
      setTimeout(setKeyIfPossible, 900);
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  })();
</script>
