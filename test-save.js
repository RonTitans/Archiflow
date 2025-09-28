const WebSocket = require('ws');

// Test saving a diagram via WebSocket
const ws = new WebSocket('ws://localhost:3333');

const testXml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel dx="1422" dy="763" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169">
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="test-1" value="Test Device" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="340" y="280" width="120" height="60" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>`;

ws.on('open', () => {
    console.log('Connected to WebSocket server');

    // First, get diagrams to find one to update
    ws.send(JSON.stringify({
        action: 'get_diagrams_by_site',
        siteId: 1  // Assuming site ID 1 exists
    }));
});

ws.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('Received:', message.action);

    if (message.action === 'get_diagrams_by_site' && message.diagrams && message.diagrams.length > 0) {
        const diagram = message.diagrams[0];
        console.log(`Found diagram: ${diagram.title} (ID: ${diagram.id})`);
        console.log('Current data length:', diagram.diagram_data ? diagram.diagram_data.length : 0);

        // Now update it with test data
        console.log('Sending update_diagram with test XML...');
        ws.send(JSON.stringify({
            action: 'update_diagram',
            diagramId: diagram.id,
            diagramData: testXml
        }));
    } else if (message.action === 'update_diagram') {
        if (message.success) {
            console.log('✅ Update successful!');
            console.log('Message:', message.message);
        } else {
            console.log('❌ Update failed:', message.message);
        }
        ws.close();
    }
});

ws.on('error', (error) => {
    console.error('WebSocket error:', error);
});

ws.on('close', () => {
    console.log('Disconnected from WebSocket server');
    process.exit(0);
});