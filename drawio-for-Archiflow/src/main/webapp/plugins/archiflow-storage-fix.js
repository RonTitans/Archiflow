/**
 * ArchiFlow Storage Provider Plugin for Draw.io
 * Adds "ArchiFlow Database" as a storage option in save dialogs
 */

Draw.loadPlugin(function(ui) {
    console.log('[ArchiFlow Storage Fix] Initializing storage provider...');

    // Helper function to show messages
    function showMessage(msg) {
        if (ui.showDialog) {
            const dlg = new mxUtils.alert(msg);
            ui.showDialog(dlg.container, 300, 100, true);
            setTimeout(function() {
                ui.hideDialog();
            }, 2000);
        } else {
            alert(msg);
        }
    }

    // Override save action
    const originalSave = ui.actions.get('save');
    if (originalSave) {
        const originalSaveFunct = originalSave.funct;
        ui.actions.get('save').funct = function() {
            console.log('[ArchiFlow Storage Fix] Save action triggered');

            // Show save dialog
            originalSaveFunct.apply(this, arguments);

            // Wait for dialog to appear and inject our option
            setTimeout(function() {
                injectArchiFlowOption();
            }, 100);
        };
    }

    // Override saveAs action
    const originalSaveAs = ui.actions.get('saveAs');
    if (originalSaveAs) {
        const originalSaveAsFunct = originalSaveAs.funct;
        ui.actions.get('saveAs').funct = function() {
            console.log('[ArchiFlow Storage Fix] SaveAs action triggered');

            // Show save dialog
            originalSaveAsFunct.apply(this, arguments);

            // Wait for dialog to appear and inject our option
            setTimeout(function() {
                injectArchiFlowOption();
            }, 100);
        };
    }

    // Function to inject ArchiFlow option
    function injectArchiFlowOption() {
        console.log('[ArchiFlow Storage Fix] Looking for save dialog...');

        // Try multiple times to find the dialog
        let attempts = 0;
        const maxAttempts = 10;

        const checkDialog = function() {
            attempts++;

            // Look for all dialogs
            const dialogs = document.querySelectorAll('.geDialog');
            console.log('[ArchiFlow Storage Fix] Found', dialogs.length, 'dialogs');

            let foundSelect = false;

            dialogs.forEach(function(dialog) {
                // Look for select elements in the dialog
                const selects = dialog.querySelectorAll('select');
                console.log('[ArchiFlow Storage Fix] Found', selects.length, 'selects in dialog');

                selects.forEach(function(select) {
                    // Log what we found
                    console.log('[ArchiFlow Storage Fix] Select options:', select.options.length);

                    // Check if this is the storage dropdown by looking at options
                    let isStorageSelect = false;
                    for (let i = 0; i < select.options.length; i++) {
                        const optionText = select.options[i].text;
                        console.log('[ArchiFlow Storage Fix] Option:', optionText);
                        if (optionText.includes('Device') ||
                            optionText.includes('Google') ||
                            optionText.includes('OneDrive') ||
                            optionText.includes('GitHub') ||
                            optionText.includes('Dropbox')) {
                            isStorageSelect = true;
                            break;
                        }
                    }

                    if (isStorageSelect && !select.querySelector('option[value="archiflow"]')) {
                        console.log('[ArchiFlow Storage Fix] Found storage select, adding ArchiFlow option');
                        foundSelect = true;

                        // Add ArchiFlow option
                        const option = document.createElement('option');
                        option.value = 'archiflow';
                        option.text = '🗄️ ArchiFlow Database';
                        select.insertBefore(option, select.firstChild);
                        select.value = 'archiflow';

                        // Store original onchange
                        const originalOnchange = select.onchange;

                        // Override onchange
                        select.onchange = function() {
                            console.log('[ArchiFlow Storage Fix] Storage selection changed to:', this.value);

                            if (this.value === 'archiflow') {
                                console.log('[ArchiFlow Storage Fix] ArchiFlow selected, overriding save button');

                                // Find save button in the same dialog
                                const buttons = dialog.querySelectorAll('button');
                                buttons.forEach(function(btn) {
                                    const btnText = btn.textContent || '';
                                    console.log('[ArchiFlow Storage Fix] Found button:', btnText);

                                    if (btnText.includes('Create') ||
                                        btnText.includes('Save') ||
                                        btnText.includes('OK')) {

                                        // Override the button click
                                        btn.onclick = function(e) {
                                            e.preventDefault();
                                            e.stopPropagation();

                                            console.log('[ArchiFlow Storage Fix] Save button clicked');

                                            // Get filename
                                            const inputs = dialog.querySelectorAll('input[type="text"]');
                                            let filename = 'diagram';
                                            if (inputs.length > 0) {
                                                filename = inputs[0].value || 'diagram';
                                            }

                                            console.log('[ArchiFlow Storage Fix] Filename:', filename);

                                            // Get the diagram XML
                                            const xml = mxUtils.getXml(ui.editor.getGraphXml());
                                            console.log('[ArchiFlow Storage Fix] Got XML, length:', xml.length);

                                            // Send to parent window
                                            if (window.parent && window.parent !== window) {
                                                window.parent.postMessage({
                                                    event: 'save',
                                                    action: 'save',
                                                    xml: xml,
                                                    title: filename
                                                }, '*');
                                                console.log('[ArchiFlow Storage Fix] Sent save message to parent');
                                            }

                                            // Close dialog
                                            ui.hideDialog();

                                            // Show success message
                                            showMessage('Saved to ArchiFlow Database!');

                                            // Mark as not modified
                                            ui.editor.modified = false;
                                            ui.editor.setStatus('');

                                            return false;
                                        };
                                    }
                                });
                            } else if (originalOnchange) {
                                originalOnchange.apply(this, arguments);
                            }
                        };

                        // Trigger change to activate our handler
                        const changeEvent = new Event('change', { bubbles: true });
                        select.dispatchEvent(changeEvent);
                    }
                });
            });

            // If we didn't find it and haven't exceeded attempts, try again
            if (!foundSelect && attempts < maxAttempts) {
                setTimeout(checkDialog, 200);
            }
        };

        checkDialog();
    }

    console.log('[ArchiFlow Storage Fix] Storage provider ready!');
});