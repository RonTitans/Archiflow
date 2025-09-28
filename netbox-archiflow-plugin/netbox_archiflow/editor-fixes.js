// FIXES FOR ARCHIFLOW EDITOR
// Add these changes to editor.html

// 1. FIX: Don't auto-load Draw.io on page load
// FIND THIS (around line 933):
//    iframe.src = 'http://localhost:8081/archiflow-loader.html?splash=0';
// REPLACE WITH:
//    // Don't load Draw.io until user opens a diagram
//    console.log('Draw.io will load when you open or create a diagram');

// 2. FIX: Update openDiagram to wait longer and send correct format
function openDiagram(diagramId) {
    currentDiagram = diagramId;
    const diagram = diagrams.find(d => d.id === diagramId);

    console.log('Opening diagram:', diagram);
    console.log('Diagram data length:', diagram?.diagram_data?.length || 0);

    const iframe = document.getElementById('archiflow-frame');

    // Get the diagram XML or create empty
    let diagramXml = getEmptyDiagram();

    if (diagram && diagram.diagram_data) {
        // Check if the data is valid
        if (diagram.diagram_data.length > 100 && diagram.diagram_data.includes('mxGraphModel')) {
            diagramXml = diagram.diagram_data;
            console.log('✅ Using saved diagram data');
        } else {
            console.log('⚠️ Diagram data seems invalid, using empty diagram');
        }
    } else {
        console.log('📝 No diagram data found, creating new');
    }

    // Force reload iframe with Draw.io
    iframe.src = 'about:blank';

    setTimeout(() => {
        // Load Draw.io fresh for this diagram
        const drawioUrl = `http://localhost:8081/archiflow-loader.html?splash=0&modified=0&chrome=0`;
        iframe.src = drawioUrl;

        // Wait for Draw.io to load, then send the diagram
        iframe.onload = function() {
            // Wait 5 seconds for plugin to fully initialize
            setTimeout(() => {
                console.log('📤 Sending diagram to Draw.io via postMessage...');

                // Send as regular object (NOT JSON string)
                iframe.contentWindow.postMessage({
                    action: 'load',
                    xml: diagramXml,
                    title: diagram?.title || 'Untitled'
                }, '*');

                console.log('✅ Load message sent, XML length:', diagramXml.length);
            }, 5000); // Wait 5 seconds for plugin to be ready
        };
    }, 100);

    // Update info
    if (diagram) {
        document.getElementById('current-diagram-info').textContent =
            `Currently editing: ${diagram.version} - ${diagram.title} ${diagram.is_live ? '(LIVE)' : ''}`;
    }

    // Reset save status
    updateSaveStatus('saved');
    isDirty = false;
}

// 3. FIX: Update createNewVersion to open the diagram after creating
function createNewVersion() {
    if (!currentSite) {
        alert('Please select a site first');
        return;
    }

    const version = prompt('Enter version number (e.g., v1.0):');
    if (version) {
        const title = prompt('Enter diagram title:');
        if (title) {
            // Create with proper initial XML
            const initialXml = getEmptyDiagram();

            // Send to WebSocket to save
            sendToWebSocket('save_version', {
                siteId: currentSite,
                siteName: sites.find(s => s.id == currentSite)?.name || 'Unknown',
                version: version,
                title: title,
                description: 'New diagram',
                diagramData: initialXml, // Use proper XML, not empty string
                userId: '{{ user.username }}'
            });

            // Reload diagrams and auto-open the new one
            setTimeout(() => {
                loadDiagrams(currentSite);

                // Wait for diagrams to load, then open the new one
                setTimeout(() => {
                    const newDiagram = diagrams.find(d =>
                        d.version === version &&
                        d.title === title &&
                        d.site_id == currentSite
                    );
                    if (newDiagram) {
                        console.log('Auto-opening new diagram:', newDiagram.id);
                        openDiagram(newDiagram.id);
                    }
                }, 1000);
            }, 500);
        }
    }
}