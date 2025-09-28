/**
 * ArchiFlow Save Interceptor
 * Completely override Draw.io's save dialogs and send data to our database
 */

// Wait for Draw.io to be fully loaded
window.addEventListener('load', function() {
    console.log('[ArchiFlow Save Interceptor] Initializing...');

    // Override the global save dialog
    if (typeof Draw !== 'undefined' && Draw.loadPlugin) {
        Draw.loadPlugin(function(ui) {
            console.log('[ArchiFlow Save Interceptor] Plugin loaded, overriding save...');

            // Store the original functions
            const originalSave = ui.actions.get('save').funct;
            const originalSaveAs = ui.actions.get('saveAs').funct;
            const originalExport = ui.actions.get('export').funct;

            // Override the save action
            ui.actions.get('save').funct = function() {
                console.log('[ArchiFlow Save Interceptor] Save intercepted!');

                // Get the current XML
                const xml = mxUtils.getXml(ui.editor.getGraphXml());
                console.log('[ArchiFlow Save Interceptor] Got XML, length:', xml.length);

                // Send to parent window
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage({
                        event: 'save',
                        action: 'save',
                        xml: xml,
                        title: ui.editor.filename || 'diagram'
                    }, '*');
                    console.log('[ArchiFlow Save Interceptor] Sent to parent');

                    // Show success message
                    ui.showMessage('Diagram saved to ArchiFlow database!', 2000);
                }

                // Don't call the original save (prevents dialog)
                return false;
            };

            // Override saveAs
            ui.actions.get('saveAs').funct = function() {
                console.log('[ArchiFlow Save Interceptor] SaveAs intercepted!');
                // Just call our save
                ui.actions.get('save').funct();
                return false;
            };

            // Override export
            if (ui.actions.get('export')) {
                ui.actions.get('export').funct = function() {
                    console.log('[ArchiFlow Save Interceptor] Export intercepted!');
                    const xml = mxUtils.getXml(ui.editor.getGraphXml());

                    if (window.parent && window.parent !== window) {
                        window.parent.postMessage({
                            event: 'export',
                            xml: xml,
                            data: xml
                        }, '*');
                    }

                    return false;
                };
            }

            // Override Ctrl+S keyboard shortcut
            const originalKeyHandler = ui.keyHandler.handler;
            ui.keyHandler.handler = function(evt) {
                if (evt.keyCode == 83 && (evt.ctrlKey || evt.metaKey)) { // Ctrl+S or Cmd+S
                    evt.preventDefault();
                    evt.stopPropagation();

                    console.log('[ArchiFlow Save Interceptor] Ctrl+S intercepted!');
                    ui.actions.get('save').funct();

                    return false;
                }
                return originalKeyHandler.apply(this, arguments);
            };

            // Also handle the save menu item
            const originalExecute = ui.menus.execute;
            ui.menus.execute = function(menu, parent) {
                if (menu && menu.funct && menu.funct.name && menu.funct.name.includes('save')) {
                    console.log('[ArchiFlow Save Interceptor] Menu save intercepted');
                    ui.actions.get('save').funct();
                    return false;
                }
                return originalExecute.apply(this, arguments);
            };

            console.log('[ArchiFlow Save Interceptor] Ready!');
        });
    } else {
        console.error('[ArchiFlow Save Interceptor] Draw.io not loaded yet, retrying...');
        setTimeout(arguments.callee, 500);
    }
});
