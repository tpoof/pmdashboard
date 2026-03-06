<script type="text/javascript">
/**
 * LEAF Auto-Submit Script
 * Creates a new record and automatically submits it to the first workflow step.
 *
 * CONFIGURATION: Update the values in the CONFIG object below to match your form.
 */

const CONFIG = {
    // Form setup
    formID: '68e7f',          // Your form ID from the Form Editor (appears after "numform_")
    title: 'New Request',     // Title for the new record
    service: '',              // Service ID number, or leave blank
    priority: 0,             // Lower numbers = higher priority

    // Pre-populated fields (indicatorID: value)
    // Add as many as needed, or leave empty
    fields: {
        // 123: 'Some prefilled value',
        // 456: 'Another value',
    },

    // Workflow submission
    dependencyID: 1,          // The dependency ID for the first workflow step
    actionType: 'submit',     // The action type to apply (e.g., 'submit', 'approve')
    comment: 'Automatically submitted via script',

    // After submission, redirect to the new record
    redirectAfterSubmit: true,
};

$(function() {
    // --- Step 1: Create the new record ---
    var postData = {
        CSRFToken: '<!--{$CSRFToken}-->',
        title: CONFIG.title,
        priority: CONFIG.priority,
        service: CONFIG.service,
    };

    // Set the form selector (numform_FORM_ID must equal 1)
    postData['numform_' + CONFIG.formID] = 1;

    // Add any pre-populated field values
    for (var indicatorID in CONFIG.fields) {
        postData[indicatorID] = CONFIG.fields[indicatorID];
    }

    $.ajax({
        type: 'POST',
        url: './api/?a=form/new',
        dataType: 'json',
        data: postData,
        success: function(response) {
            var recordID = parseFloat(response);

            if (isNaN(recordID) || !isFinite(recordID) || recordID === 0) {
                alert('Error creating record:\n' + response + '\n\nPlease contact your system administrator.');
                return;
            }

            console.log('Record created: ' + recordID);

            // --- Step 2: Submit to the first workflow step ---
            $.ajax({
                type: 'POST',
                url: './api/?a=formWorkflow/' + recordID + '/apply',
                dataType: 'json',
                data: {
                    CSRFToken: '<!--{$CSRFToken}-->',
                    dependencyID: CONFIG.dependencyID,
                    actionType: CONFIG.actionType,
                    comment: CONFIG.comment,
                },
                success: function(workflowResponse) {
                    console.log('Workflow action applied to record ' + recordID);

                    if (CONFIG.redirectAfterSubmit) {
                        window.location = 'index.php?a=view&recordID=' + recordID;
                    }
                },
                error: function(xhr, status, error) {
                    alert('Record #' + recordID + ' was created, but the workflow action failed:\n' + error + '\n\nPlease contact your system administrator.');
                },
                cache: false
            });
        },
        error: function(xhr, status, error) {
            alert('Error creating record:\n' + error + '\n\nPlease contact your system administrator.');
        },
        cache: false
    });
});
</script>
