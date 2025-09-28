/**
 * ArchiFlow Save Plugin for Draw.io
 * This plugin intercepts Draw.io's save operations and sends them to our database
 */

Draw.loadPlugin(function(ui) {
    console.log('[ArchiFlow Save Plugin] Initializing...');

    // Store original save function
    const originalSave = ui.save;
    const originalSaveFile = ui.saveFile;

    // Override the save function
    ui.save = function(name) {
        console.log('[ArchiFlow Save Plugin] Save triggered');

        // Get the current XML
        const xml = mxUtils.getXml(ui.editor.getGraphXml());
        console.log('[ArchiFlow Save Plugin] Got XML, length:', xml.length);

        // Send to parent window (NetBox)
        if (window.parent !== window) {
            window.parent.postMessage({
                event: 'save',
                action: 'save',
                xml: xml,
                title: name || ui.editor.filename || 'Untitled'
            }, '*');
            console.log('[ArchiFlow Save Plugin] Sent save message to parent');
        }

        // Call original save (for local storage)
        if (originalSave) {
            originalSave.apply(this, arguments);
        }
    };

    // Override saveFile function
    ui.saveFile = function(forceDialog) {
        console.log('[ArchiFlow Save Plugin] SaveFile triggered');

        const xml = mxUtils.getXml(ui.editor.getGraphXml());

        // Send to parent
        if (window.parent !== window) {
            window.parent.postMessage({
                event: 'save',
                action: 'save',
                xml: xml,
                title: ui.editor.filename || 'Untitled'
            }, '*');
        }

        // Don't call original saveFile - we handle it
        ui.showDialog(new Dialogs.MessageDialog(ui, 'Diagram saved to ArchiFlow database', 'Save Complete').container, 200, 100, true);
    };

    // Add export handler
    ui.actions.addAction('export...', function() {
        const xml = mxUtils.getXml(ui.editor.getGraphXml());

        if (window.parent !== window) {
            window.parent.postMessage({
                event: 'export',
                xml: xml,
                data: xml
            }, '*');
        }
    });

    // Listen for save requests from parent
    window.addEventListener('message', function(evt) {
        console.log('[ArchiFlow Save Plugin] Message received:', evt.data);

        if (evt.data && evt.data.action === 'export') {
            const xml = mxUtils.getXml(ui.editor.getGraphXml());
            window.parent.postMessage({
                event: 'export',
                xml: xml,
                data: xml
            }, '*');
        }
    });

    // Auto-save every 30 seconds
    setInterval(function() {
        if (ui.editor && ui.editor.modified) {
            console.log('[ArchiFlow Save Plugin] Auto-saving...');
            const xml = mxUtils.getXml(ui.editor.getGraphXml());

            if (window.parent !== window) {
                window.parent.postMessage({
                    event: 'autosave',
                    xml: xml
                }, '*');
            }
        }
    }, 30000);

    console.log('[ArchiFlow Save Plugin] Ready');
});