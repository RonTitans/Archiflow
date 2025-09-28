/**
 * ArchiFlow Simple Save Plugin
 * Intercepts Ctrl+S and saves directly to database
 */

Draw.loadPlugin(function(ui) {
    console.log('[ArchiFlow Simple Save] Initializing...');

    // Function to save to ArchiFlow
    function saveToArchiFlow() {
        console.log('[ArchiFlow Simple Save] Saving diagram...');

        try {
            // Get the current diagram XML from Draw.io's editor
            const xml = mxUtils.getXml(ui.editor.getGraphXml());
            console.log('[ArchiFlow Simple Save] Got XML, length:', xml.length);

            // Get the filename
            const filename = ui.editor.filename || 'diagram.drawio';

            // Send to parent window (NetBox)
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                    event: 'save',
                    action: 'save',
                    xml: xml,
                    title: filename,
                    timestamp: new Date().toISOString()
                }, '*');

                console.log('[ArchiFlow Simple Save] Sent to parent window');

                // Mark as saved
                ui.editor.setModified(false);

                // Show status
                ui.editor.setStatus('Saved to ArchiFlow Database');

                // Clear status after 3 seconds
                setTimeout(function() {
                    ui.editor.setStatus('');
                }, 3000);
            } else {
                console.log('[ArchiFlow Simple Save] Not in iframe, saving locally');
                // If not in iframe, could fall back to local storage or download
            }

        } catch (error) {
            console.error('[ArchiFlow Simple Save] Error:', error);
            ui.editor.setStatus('Save failed: ' + error.message);
        }
    }

    // Override the save action completely
    const originalSave = ui.actions.get('save');
    if (originalSave) {
        ui.actions.get('save').funct = function() {
            console.log('[ArchiFlow Simple Save] Save action triggered');
            saveToArchiFlow();
            return false; // Prevent default save dialog
        };
    }

    // Also override saveAs to use same function
    const originalSaveAs = ui.actions.get('saveAs');
    if (originalSaveAs) {
        ui.actions.get('saveAs').funct = function() {
            console.log('[ArchiFlow Simple Save] SaveAs action triggered');
            saveToArchiFlow();
            return false; // Prevent default save dialog
        };
    }

    // Intercept Ctrl+S / Cmd+S keyboard shortcut
    const originalKeyHandler = ui.keyHandler.getFunction;
    ui.keyHandler.getFunction = function(evt) {
        if (evt.keyCode == 83 && (evt.ctrlKey || evt.metaKey)) { // S key with Ctrl/Cmd
            console.log('[ArchiFlow Simple Save] Ctrl+S intercepted');
            evt.preventDefault();
            evt.stopPropagation();
            saveToArchiFlow();
            return null; // Prevent default handling
        }
        return originalKeyHandler.apply(this, arguments);
    };

    // Listen for load requests from parent
    window.addEventListener('message', function(evt) {
        if (evt.data && evt.data.action === 'load' && evt.data.xml) {
            console.log('[ArchiFlow Simple Save] Load request received');

            try {
                // Parse the XML
                const doc = mxUtils.parseXml(evt.data.xml);
                const node = doc.documentElement;

                // Load into editor
                ui.editor.setGraphXml(node);

                // Set filename if provided
                if (evt.data.title) {
                    ui.editor.filename = evt.data.title;
                }

                // Mark as not modified
                ui.editor.setModified(false);

                console.log('[ArchiFlow Simple Save] Diagram loaded successfully');
            } catch (error) {
                console.error('[ArchiFlow Simple Save] Load error:', error);
            }
        }
    });

    // Add visual indicator that ArchiFlow save is active
    if (ui.toolbar) {
        const status = document.createElement('div');
        status.style.cssText = 'position:absolute;top:5px;right:150px;padding:5px 10px;background:#4CAF50;color:white;border-radius:3px;font-size:12px;';
        status.innerHTML = '🗄️ ArchiFlow Save Active';
        document.body.appendChild(status);

        // Hide after 3 seconds
        setTimeout(function() {
            status.style.display = 'none';
        }, 3000);
    }

    console.log('[ArchiFlow Simple Save] Ready - Ctrl+S will save to ArchiFlow Database');
});