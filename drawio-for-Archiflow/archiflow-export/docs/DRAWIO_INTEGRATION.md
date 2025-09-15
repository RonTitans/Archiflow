# Draw.io Integration Guide

## Overview

ArchiFlow can be integrated with Draw.io in three ways:
1. **Plugin Method** - Inject into existing Draw.io
2. **Fork Method** - Modify Draw.io source code
3. **Wrapper Method** - Embed Draw.io with external controls

## Method 1: Plugin Integration (Limited)

### Limitations
- Draw.io web version has strict CSP (Content Security Policy)
- Cannot inject external scripts directly
- Limited UI modification capabilities

### Desktop App Solution
```javascript
// Works in Draw.io Desktop App
Draw.loadPlugin('archiflow-plugin.js');
```

## Method 2: Fork Integration (Recommended)

### Step 1: Fork Draw.io
```bash
git clone https://github.com/jgraph/drawio.git
cd drawio
```

### Step 2: Add ArchiFlow to Draw.io

#### A. Copy Files
```bash
# Copy ArchiFlow backend
cp -r archiflow-export/backend src/main/webapp/archiflow

# Copy plugins
cp archiflow-export/frontend/plugins/* src/main/webapp/plugins/
```

#### B. Modify `src/main/webapp/js/diagramly/App.js`
```javascript
// Add to App.js constructor
this.archiflow = new ArchiFlow(this);

// Add ArchiFlow menu
this.archiflow.addMenuItems(this.menus);
```

#### C. Create `src/main/webapp/js/diagramly/ArchiFlow.js`
```javascript
function ArchiFlow(app) {
    this.app = app;
    this.mcpClient = new MCPClient('ws://localhost:3333');
    
    // Add toolbar buttons
    this.addToolbarButtons = function() {
        const toolbar = app.editor.toolbar;
        
        toolbar.addItem('spacer');
        toolbar.addItem('glue');
        
        // IP Allocation button
        toolbar.addButton('archiflow-ip', 'Allocate IP', 
            'images/ip-icon.png', () => {
                this.showIPAllocationDialog();
            });
        
        // Network Device button
        toolbar.addButton('archiflow-device', 'Add Device',
            'images/router-icon.png', () => {
                this.showDeviceSelector();
            });
    };
    
    // Add right-click menu
    this.addContextMenu = function() {
        const graph = app.editor.graph;
        const original = graph.popupMenuHandler.factoryMethod;
        
        graph.popupMenuHandler.factoryMethod = function(menu, cell, evt) {
            original.apply(this, arguments);
            
            menu.addSeparator();
            menu.addItem('Allocate IP', null, () => {
                ArchiFlow.allocateIP(cell);
            });
        };
    };
}
```

### Step 3: Build Modified Draw.io
```bash
cd src/main/webapp
npm install
npm run build

# Serve the built app
npm run start
```

## Method 3: Wrapper Application (Most Flexible)

### Create Standalone ArchiFlow App

```html
<!DOCTYPE html>
<html>
<head>
    <title>ArchiFlow Network Manager</title>
    <style>
        .container {
            display: flex;
            height: 100vh;
        }
        .drawio-frame {
            flex: 1;
            border: none;
        }
        .archiflow-panel {
            width: 300px;
            background: #f5f5f5;
            padding: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Draw.io iframe -->
        <iframe id="drawio" 
                class="drawio-frame"
                src="https://embed.diagrams.net/?embed=1&proto=json">
        </iframe>
        
        <!-- ArchiFlow Control Panel -->
        <div class="archiflow-panel">
            <h2>ArchiFlow Controls</h2>
            
            <button onclick="allocateIP()">Allocate IP</button>
            <button onclick="addDevice()">Add Device</button>
            <button onclick="saveDigram()">Save</button>
            
            <div id="ip-pools"></div>
            <div id="device-list"></div>
        </div>
    </div>
    
    <script>
        // Communication with Draw.io
        const drawio = document.getElementById('drawio');
        let drawioAPI = null;
        
        // Initialize when Draw.io loads
        window.addEventListener('message', function(evt) {
            if (evt.data.event === 'init') {
                drawioAPI = {
                    frame: drawio,
                    origin: evt.origin
                };
                initArchiFlow();
            }
            
            if (evt.data.event === 'select') {
                onCellSelected(evt.data.cells);
            }
        });
        
        // Send action to Draw.io
        function sendAction(action, params) {
            drawioAPI.frame.contentWindow.postMessage(
                JSON.stringify({action, ...params}),
                drawioAPI.origin
            );
        }
        
        // ArchiFlow functions
        function allocateIP() {
            // Get selected cell
            sendAction('getSelectedCells');
            
            // Call MCP tool
            fetch('/api/allocate-ip', {
                method: 'POST',
                body: JSON.stringify({
                    poolId: 'POOL-001',
                    assetId: selectedCell.id
                })
            }).then(res => res.json())
              .then(data => {
                  // Update cell with IP
                  sendAction('updateCell', {
                      id: selectedCell.id,
                      value: selectedCell.value + '\n' + data.ip
                  });
              });
        }
        
        function addDevice() {
            const xml = `
                <mxCell id="2" value="Router\n10.0.1.1" 
                        style="shape=router" 
                        vertex="1" parent="1">
                    <mxGeometry x="100" y="100" 
                                width="80" height="80"/>
                </mxCell>
            `;
            
            sendAction('addCell', {xml});
        }
    </script>
</body>
</html>
```

## Draw.io PostMessage API

### Available Actions

| Action | Description | Parameters |
|--------|-------------|------------|
| `load` | Load diagram | `{xml: string}` |
| `export` | Export diagram | `{format: 'xml\|png\|svg'}` |
| `addCell` | Add new cell | `{xml: string}` |
| `updateCell` | Update cell | `{id, value, style}` |
| `getSelectedCells` | Get selection | none |

### Example Communication
```javascript
// Send to Draw.io
iframe.contentWindow.postMessage(JSON.stringify({
    action: 'load',
    xml: diagramXML
}), '*');

// Receive from Draw.io
window.addEventListener('message', (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.event === 'select') {
        console.log('Selected:', msg.cells);
    }
});
```

## Security Considerations

### CORS Headers
```javascript
// Backend server must allow Draw.io origin
res.setHeader('Access-Control-Allow-Origin', 'https://app.diagrams.net');
```

### CSP Policy
```html
<!-- If self-hosting Draw.io -->
<meta http-equiv="Content-Security-Policy" 
      content="script-src 'self' http://localhost:*">
```

## Testing Integration

### 1. Test MCP Connection
```bash
# Start MCP server
node backend/mcp-server.js

# Test with curl
curl -X POST http://localhost:3333/tools/call \
  -d '{"name":"get-ip-pools","arguments":{}}'
```

### 2. Test Draw.io Communication
```javascript
// In browser console
const iframe = document.querySelector('iframe');
iframe.contentWindow.postMessage(
    JSON.stringify({action: 'load', xml: '<mxfile>...</mxfile>'}),
    '*'
);
```

### 3. Test Full Flow
1. Load Draw.io
2. Add network device
3. Allocate IP
4. Verify IP appears on shape
5. Save diagram
6. Reload and verify persistence

## Troubleshooting

### Issue: CSP Blocks Plugin
**Solution**: Use wrapper method or fork Draw.io

### Issue: WebSocket Connection Fails
**Solution**: Check MCP server is running on port 3333

### Issue: PostMessage Not Working
**Solution**: Verify origin and add event listeners before iframe loads

---

For more details, see the main README and API documentation.