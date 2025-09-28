/**
 * ArchiFlow Debug Save Plugin
 * Debug version to figure out why saves are empty
 */

Draw.loadPlugin(function(ui) {
    console.log('[ArchiFlow Debug] Plugin initializing...');

    // Function to save to ArchiFlow database
    function saveToArchiFlow() {
        console.log('[ArchiFlow Debug] saveToArchiFlow called');

        try {
            // Debug: Check if ui.editor exists
            if (!ui.editor) {
                console.error('[ArchiFlow Debug] ui.editor is undefined!');
                return;
            }

            // Debug: Check if graph exists
            if (!ui.editor.graph) {
                console.error('[ArchiFlow Debug] ui.editor.graph is undefined!');
                return;
            }

            // Debug: Get graph XML
            const graphXml = ui.editor.getGraphXml();
            console.log('[ArchiFlow Debug] graphXml:', graphXml);

            if (!graphXml) {
                console.error('[ArchiFlow Debug] getGraphXml() returned null/undefined');
                return;
            }

            // Debug: Convert to string
            const xml = mxUtils.getXml(graphXml);
            console.log('[ArchiFlow Debug] XML string length:', xml.length);
            console.log('[ArchiFlow Debug] XML preview:', xml.substring(0, 200));

            // Get filename
            const filename = ui.editor.filename || 'diagram.drawio';
            console.log('[ArchiFlow Debug] Filename:', filename);

            // Check if we're in an iframe
            if (window.parent && window.parent !== window) {
                console.log('[ArchiFlow Debug] In iframe, sending to parent');

                // Send the message
                const message = {
                    event: 'save',
                    action: 'save',
                    xml: xml,
                    title: filename,
                    timestamp: new Date().toISOString(),
                    debug: {
                        xmlLength: xml.length,
                        xmlEmpty: xml.length === 0,
                        xmlPreview: xml.substring(0, 100)
                    }
                };

                console.log('[ArchiFlow Debug] Sending message:', message);
                window.parent.postMessage(message, '*');

                // Update UI
                ui.editor.setModified(false);
                ui.editor.setStatus('Saved to ArchiFlow (Debug)');

                setTimeout(function() {
                    ui.editor.setStatus('');
                }, 3000);
            } else {
                console.log('[ArchiFlow Debug] Not in iframe');
            }
        } catch (error) {
            console.error('[ArchiFlow Debug] Error in saveToArchiFlow:', error);
            console.error('[ArchiFlow Debug] Stack:', error.stack);
        }
    }

    // Override save action
    const originalSave = ui.actions.get('save');
    if (originalSave) {
        console.log('[ArchiFlow Debug] Overriding save action');
        ui.actions.get('save').funct = function() {
            console.log('[ArchiFlow Debug] Save action triggered (Ctrl+S)');
            saveToArchiFlow();
            return false; // Don't show dialog
        };
    } else {
        console.error('[ArchiFlow Debug] Could not find save action!');
    }

    // Also check the editor state
    console.log('[ArchiFlow Debug] Editor state:');
    console.log('  - ui.editor exists:', !!ui.editor);
    console.log('  - ui.editor.graph exists:', !!ui.editor.graph);
    console.log('  - ui.editor.getGraphXml exists:', typeof ui.editor.getGraphXml);

    // Add a test button to manually trigger save
    setTimeout(function() {
        const testBtn = document.createElement('button');
        testBtn.innerHTML = '🧪 Test Save';
        testBtn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;padding:10px;background:#ff0;';
        testBtn.onclick = function() {
            console.log('[ArchiFlow Debug] Manual test save clicked');
            saveToArchiFlow();
        };
        document.body.appendChild(testBtn);
    }, 2000);

    console.log('[ArchiFlow Debug] Plugin ready');
});