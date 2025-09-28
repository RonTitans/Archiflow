/**
 * ArchiFlow Storage Provider for Draw.io
 * Adds "ArchiFlow Database" as a storage option in Draw.io's save dialog
 */

Draw.loadPlugin(function(ui) {
    console.log('[ArchiFlow Storage] Initializing custom storage provider...');

    // Add ArchiFlow as a storage location
    const originalInit = ui.menus.init;
    ui.menus.init = function() {
        originalInit.apply(this, arguments);

        // Add ArchiFlow to the storage menu
        const originalPutItem = ui.menus.putItem;
        ui.menus.putItem = function(menu, key, parent, trigger, sprite, label) {
            if (key === 'saveAs') {
                // Add our custom save option
                const originalFunct = menu.funct;
                menu.funct = function() {
                    console.log('[ArchiFlow Storage] SaveAs menu opened');

                    // Call original to show dialog
                    const result = originalFunct.apply(this, arguments);

                    // Inject ArchiFlow option into the dialog
                    setTimeout(() => {
                        injectArchiFlowOption();
                    }, 100);

                    return result;
                };
            }
            return originalPutItem.apply(this, arguments);
        };
    };

    // Create custom ArchiFlow client
    const ArchiFlowClient = function(ui) {
        console.log('[ArchiFlow Storage] Creating ArchiFlow client');
        this.ui = ui;
    };

    ArchiFlowClient.prototype.getUser = function(success, error) {
        success({
            id: 'archiflow-user',
            displayName: 'ArchiFlow User',
            email: 'user@archiflow.local'
        });
    };

    ArchiFlowClient.prototype.loadFile = function(id, success, error) {
        console.log('[ArchiFlow Storage] Loading file:', id);
        // Request file from parent
        window.parent.postMessage({
            action: 'load_file',
            fileId: id
        }, '*');

        // Listen for response
        window.addEventListener('message', function handler(evt) {
            if (evt.data && evt.data.event === 'file_loaded') {
                window.removeEventListener('message', handler);
                success(evt.data.xml || '<mxfile></mxfile>');
            }
        });
    };

    ArchiFlowClient.prototype.saveFile = function(data, title, success, error) {
        console.log('[ArchiFlow Storage] Saving file:', title, 'Data length:', data.length);

        // Send to parent window
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                event: 'save',
                action: 'save',
                xml: data,
                title: title || 'Untitled Diagram'
            }, '*');

            // Show success
            success();
            ui.editor.setStatus('Saved to ArchiFlow Database');
            ui.editor.modified = false;
        } else {
            error('Could not connect to ArchiFlow');
        }
    };

    // Register ArchiFlow storage
    const StorageDialog = function(editorUi, fn, serviceCount) {
        const container = document.createElement('div');
        container.style.textAlign = 'center';
        container.style.padding = '20px';

        const title = document.createElement('h3');
        title.innerHTML = 'Save to ArchiFlow Database';
        container.appendChild(title);

        const desc = document.createElement('p');
        desc.innerHTML = 'Your diagram will be saved to the ArchiFlow database and synchronized with NetBox.';
        container.appendChild(desc);

        const saveBtn = mxUtils.button('Save to ArchiFlow', function() {
            const xml = mxUtils.getXml(editorUi.editor.getGraphXml());
            const title = editorUi.editor.filename || 'Untitled Diagram';

            // Save using our client
            const client = new ArchiFlowClient(editorUi);
            client.saveFile(xml, title,
                function() {
                    editorUi.hideDialog();
                    editorUi.showMessage('Saved to ArchiFlow Database', 2000);
                },
                function(err) {
                    editorUi.showError('Save Error', err);
                }
            );
        });
        saveBtn.className = 'geBtn gePrimaryBtn';
        saveBtn.style.margin = '10px';

        const cancelBtn = mxUtils.button('Cancel', function() {
            editorUi.hideDialog();
        });
        cancelBtn.className = 'geBtn';

        const buttons = document.createElement('div');
        buttons.appendChild(saveBtn);
        buttons.appendChild(cancelBtn);
        container.appendChild(buttons);

        this.container = container;
    };

    // Inject ArchiFlow option into save dialog
    function injectArchiFlowOption() {
        console.log('[ArchiFlow Storage] Injecting ArchiFlow option...');

        // Find the save dialog
        const dialogs = document.querySelectorAll('.geDialog');
        dialogs.forEach(dialog => {
            const selects = dialog.querySelectorAll('select');
            selects.forEach(select => {
                // Check if this is the storage location dropdown
                if (select.innerHTML.includes('Google Drive') || select.innerHTML.includes('OneDrive')) {
                    // Check if we already added our option
                    if (!select.innerHTML.includes('ArchiFlow Database')) {
                        console.log('[ArchiFlow Storage] Adding ArchiFlow option to dropdown');

                        // Add ArchiFlow option at the top
                        const option = document.createElement('option');
                        option.value = 'archiflow';
                        option.text = '🗄️ ArchiFlow Database';
                        select.insertBefore(option, select.firstChild);
                        select.value = 'archiflow';

                        // Override the select change handler
                        const originalOnchange = select.onchange;
                        select.onchange = function(evt) {
                            if (this.value === 'archiflow') {
                                console.log('[ArchiFlow Storage] ArchiFlow selected');

                                // Find the save button in the dialog
                                const saveButtons = dialog.querySelectorAll('button');
                                saveButtons.forEach(btn => {
                                    if (btn.textContent.includes('Save') || btn.textContent.includes('OK')) {
                                        // Override save button click
                                        btn.onclick = function(e) {
                                            e.preventDefault();
                                            e.stopPropagation();

                                            console.log('[ArchiFlow Storage] Save button clicked');

                                            // Get the filename
                                            const filenameInput = dialog.querySelector('input[type="text"]');
                                            const filename = filenameInput ? filenameInput.value : 'diagram';

                                            // Get the XML
                                            const xml = mxUtils.getXml(ui.editor.getGraphXml());

                                            // Send to parent
                                            if (window.parent && window.parent !== window) {
                                                window.parent.postMessage({
                                                    event: 'save',
                                                    action: 'save',
                                                    xml: xml,
                                                    title: filename
                                                }, '*');

                                                console.log('[ArchiFlow Storage] Sent save message to parent');

                                                // Close dialog
                                                ui.hideDialog();
                                                ui.showMessage('Saved to ArchiFlow Database!', 2000);
                                                ui.editor.setStatus('');
                                                ui.editor.modified = false;
                                            }

                                            return false;
                                        };
                                    }
                                });
                            } else if (originalOnchange) {
                                originalOnchange.apply(this, arguments);
                            }
                        };

                        // Trigger change to set up our handler
                        select.dispatchEvent(new Event('change'));
                    }
                }
            });
        });
    }

    // Override the save action
    const originalSave = ui.actions.get('save');
    if (originalSave) {
        const originalFunct = originalSave.funct;
        ui.actions.get('save').funct = function() {
            console.log('[ArchiFlow Storage] Save action triggered');

            // If we have a current diagram, save directly to ArchiFlow
            const xml = mxUtils.getXml(ui.editor.getGraphXml());
            const title = ui.editor.filename || 'diagram';

            if (window.parent && window.parent !== window) {
                // Check if Ctrl was held (force save dialog)
                if (ui.editor.graph.lastEvent && ui.editor.graph.lastEvent.ctrlKey) {
                    // Show save dialog with ArchiFlow option
                    originalFunct.apply(this, arguments);
                    setTimeout(() => {
                        injectArchiFlowOption();
                    }, 100);
                } else {
                    // Direct save to ArchiFlow
                    window.parent.postMessage({
                        event: 'save',
                        action: 'save',
                        xml: xml,
                        title: title
                    }, '*');

                    ui.showMessage('Saved to ArchiFlow Database!', 2000);
                    ui.editor.modified = false;
                }
            } else {
                originalFunct.apply(this, arguments);
            }
        };
    }

    console.log('[ArchiFlow Storage] Storage provider ready!');
});