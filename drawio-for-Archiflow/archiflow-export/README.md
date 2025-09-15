# ArchiFlow Network Manager

Complete network management system for Draw.io with IP allocation, templates, and CRM integration.

## 🚨 IMPORTANT: Development Rules

**This is a self-contained ArchiFlow module. ALL development happens here.**

- ✅ All ArchiFlow code goes in this folder (`archiflow-export/`)
- ❌ DO NOT create files in the main Draw.io source (`../src/`)
- ❌ DO NOT modify Draw.io core files

## 📁 Project Structure

```
archiflow-export/
├── backend/               # MCP Server & Business Logic
│   ├── mcp-tools/        # MCP tool implementations
│   ├── database/         # Storage layer
│   ├── mock-data/        # Test data (IP pools, assets)
│   └── services/         # Network shapes, templates
│
├── frontend/             # UI Components
│   ├── plugins/          # Draw.io plugins
│   └── standalone-app/   # Web application
│
├── tests/                # Test suites
└── docs/                 # Documentation
```

## 🚀 Quick Start

### Option 1: Standalone ArchiFlow App
```bash
# Install dependencies
npm install

# Start MCP server and plugin server
npm run dev

# Open in browser
http://localhost:8080/test
```

### Option 2: Integrate with Draw.io Fork

1. Copy `frontend/plugins/` to your Draw.io fork's plugin directory
2. Copy `backend/` to your server
3. Update Draw.io's configuration to load ArchiFlow plugin

### Option 3: Embed in Your CRM

```html
<!-- In your CRM page -->
<iframe src="https://app.diagrams.net/?embed=1"></iframe>
<script src="archiflow-plugin.js"></script>
```

## 🔧 Features Implemented

### ✅ Completed (Sprints 1-4)
- **Diagram Management**: Save/load/export diagrams
- **Network Devices**: 10 device types with Cisco-style icons
- **IP Management**: Allocate/release IPs from pools
- **Templates**: Reusable network templates with variables
- **MCP Tools**: 24 backend tools for programmatic control

### 🚧 Pending (Sprint 5)
- **UI Integration**: Custom menus and toolbars in Draw.io
- **Visual Feedback**: Alerts and notifications
- **Property Panels**: Device metadata editing

## 📡 MCP Tools Available

| Tool | Purpose | Status |
|------|---------|--------|
| `save-diagram` | Save diagram to database | ✅ |
| `load-diagram` | Load diagram from database | ✅ |
| `export-diagram` | Export as PNG/SVG/XML | ✅ |
| `add-network-device` | Add router/switch/firewall | ✅ |
| `allocate-ip` | Assign IP from pool | ✅ |
| `release-ip` | Return IP to pool | ✅ |
| `get-ip-pools` | List available pools | ✅ |
| `get-ip-usage` | Usage statistics | ✅ |
| `create-template` | Create reusable template | ✅ |
| `apply-template` | Apply with variables | ✅ |

## 🔌 Integration Methods

### 1. As Draw.io Plugin
```javascript
// In Draw.io console
(function() {
    const script = document.createElement('script');
    script.src = 'path/to/archiflow-plugin.js';
    document.head.appendChild(script);
})();
```

### 2. As MCP Client
```javascript
const ws = new WebSocket('ws://localhost:3333');
ws.send(JSON.stringify({
    method: 'tools/call',
    params: {
        name: 'allocate-ip',
        arguments: { poolId: 'POOL-001', assetId: 'DEVICE-001' }
    }
}));
```

### 3. As Embedded App
```html
<div id="archiflow-container">
    <iframe src="drawio-url"></iframe>
    <div id="archiflow-controls">
        <!-- Custom UI controls here -->
    </div>
</div>
```

## 🗂️ Database Schema

### IP Pools
```json
{
  "id": "POOL-001",
  "name": "Management Network",
  "network": "10.0.1.0/24",
  "available": ["10.0.1.22", "10.0.1.23"],
  "allocations": [
    {"ip": "10.0.1.20", "assetId": "RTR-001"}
  ]
}
```

### Diagram Storage
```json
{
  "id": "diagram-001",
  "name": "Branch Network",
  "xml": "<mxfile>...</mxfile>",
  "version": 1,
  "created_by": "admin",
  "created_at": "2025-08-31T12:00:00Z"
}
```

## 🛠️ Development

### Build from Source
```bash
# TypeScript compilation
npm run build

# Run tests
npm test

# Start development server
npm run dev
```

### Adding New MCP Tools
1. Create tool in `backend/mcp-tools/`
2. Register in MCP server
3. Add UI trigger in plugin

## 📋 Roadmap

- [x] Sprint 1: Basic Save/Load
- [x] Sprint 2: Network Devices
- [x] Sprint 3: IP Management
- [x] Sprint 4: Templates
- [ ] Sprint 5: UI Integration
- [ ] Sprint 6: Full CRM Sync

## 📝 License

MIT License - Use freely in your projects

## 🤝 Contributing

This is the extracted ArchiFlow module. To contribute:
1. Fork the repository
2. Add your features
3. Submit pull request

---

**Note**: This is a standalone export of the ArchiFlow module. For the complete MCP server implementation, see the parent repository.