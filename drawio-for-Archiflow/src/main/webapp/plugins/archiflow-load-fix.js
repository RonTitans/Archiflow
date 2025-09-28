/**
 * ArchiFlow Load Fix Plugin
 * Ensures diagrams load properly when opened
 */

Draw.loadPlugin(function(ui) {
    console.log('[ArchiFlow Load Fix] Initializing...');

    // Signal that we're ready to receive messages
    if (window.parent && window.parent !== window) {
        setTimeout(function() {
            window.parent.postMessage({
                event: 'plugin_ready',
                ready: true
            }, '*');
            console.log('[ArchiFlow Load Fix] Signaled ready to parent');
        }, 500);
    }

    // Listen for load messages
    window.addEventListener('message', function(evt) {
        // Log all messages for debugging
        if (evt.data) {
            console.log('[ArchiFlow Load Fix] Message received:', evt.data.action || evt.data.event || 'unknown');
        }

        // Handle both JSON string and object
        let data = evt.data;
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
                console.log('[ArchiFlow Load Fix] Parsed JSON message');
            } catch (e) {
                // Not JSON
                return;
            }
        }

        // Check for load action
        if (data && data.action === 'load' && data.xml) {
            console.log('[ArchiFlow Load Fix] Loading diagram, size:', data.xml.length);

            try {
                // Parse and set the XML
                const doc = mxUtils.parseXml(data.xml);
                const node = doc.documentElement;

                // Clear current diagram first
                ui.editor.graph.model.clear();
                ui.editor.graph.view.scale = 1;

                // Load the new diagram
                ui.editor.setGraphXml(node);

                // Set filename if provided
                if (data.title) {
                    ui.editor.filename = data.title;
                }

                // Mark as not modified
                ui.editor.setModified(false);

                // Center the diagram
                ui.editor.graph.center(true, true);

                console.log('[ArchiFlow Load Fix] ✅ Diagram loaded successfully');

                // Send confirmation
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage({
                        event: 'diagram_loaded',
                        success: true,
                        title: data.title
                    }, '*');
                }
            } catch (error) {
                console.error('[ArchiFlow Load Fix] ❌ Load error:', error);

                // Send error back
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage({
                        event: 'diagram_loaded',
                        success: false,
                        error: error.message
                    }, '*');
                }
            }
        }
    });

    console.log('[ArchiFlow Load Fix] Ready to receive diagrams');
});