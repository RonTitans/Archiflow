# ArchiFlow Development Guide

## 🚨 Golden Rule: ALL ArchiFlow Development Happens Here

This `archiflow-export` folder is the ONLY location for ArchiFlow development.

## Project Structure

```
archiflow-export/               ← YOU ARE HERE
├── backend/                    ← Backend services
│   ├── simple-server.js       ← Main WebSocket/HTTP server
│   ├── database/              ← Storage layer
│   └── mcp-tools/             ← MCP tool implementations
├── frontend/                   ← Frontend code
│   ├── plugins/               ← Draw.io plugins
│   │   └── archiflow-main.js ← Main plugin file
│   └── components/            ← UI components
├── docs/                      ← Documentation
│   ├── PRD_ArchiFlow*.md     ← Product Requirements
│   ├── TASKS.md              ← Sprint tasks tracking
│   └── METADATA_SCHEMA.md    ← Data structure specs
├── tests/                     ← Test suites
├── test-archiflow.html        ← Plugin test launcher
└── package.json              ← Dependencies

❌ NEVER TOUCH:
../src/                       ← Draw.io core (DO NOT MODIFY)
```

## Quick Start

### 1. Start Backend Server
```bash
cd archiflow-export
npm install
npm run dev
```

Server runs on:
- WebSocket: `ws://localhost:3333`
- HTTP API: `http://localhost:8080`

### 2. Test the Plugin
1. Open `test-archiflow.html` in browser
2. Click "Test WebSocket Connection" - should show ✓
3. Click "Launch Draw.io with ArchiFlow Plugin"
4. Check browser console for `[ArchiFlow] Plugin initialized`
5. Look for "ArchiFlow" menu in Draw.io menubar

### 3. Development Workflow

#### Adding New Features:
1. Check `docs/TASKS.md` for current sprint
2. Create files ONLY in `archiflow-export/`
3. Update plugin: `frontend/plugins/archiflow-main.js`
4. Update backend: `backend/simple-server.js`
5. Test using `test-archiflow.html`
6. Update `docs/TASKS.md` when complete

#### File Creation Rules:
```
✅ CREATE HERE:
archiflow-export/frontend/plugins/my-plugin.js
archiflow-export/backend/services/my-service.js
archiflow-export/frontend/components/my-dialog.js

❌ NEVER CREATE:
../src/main/webapp/plugins/anything.js
../src/main/webapp/js/anything.js
../anything-outside-archiflow-export
```

## Current Status

### ✅ Completed (Sprint 1-4):
- Backend server with WebSocket
- IP allocation system
- Device catalog
- Basic plugin structure
- Test environment

### 🔄 In Progress (Sprint 5):
- UI dialogs for IP management
- Device property panels
- Template system UI
- Connection status indicators

### Testing Commands

```bash
# Start server (from archiflow-export/)
npm run dev

# Watch server logs
# You'll see connections, IP allocations, etc.

# Test WebSocket directly
curl http://localhost:8080/archiflow/models

# Open test page
# file:///F:/drawio-dev/archiflow-export/test-archiflow.html
```

## Important Files

| File | Purpose |
|------|---------|
| `frontend/plugins/archiflow-main.js` | Main Draw.io plugin |
| `backend/simple-server.js` | WebSocket/HTTP server |
| `test-archiflow.html` | Test launcher |
| `docs/TASKS.md` | Sprint tracking |
| `docs/METADATA_SCHEMA.md` | Data structure spec |

## Tips

1. **Server must be running** before testing plugin
2. **Check console** for `[ArchiFlow]` messages
3. **WebSocket status** shown in bottom-right of Draw.io
4. **All paths** are relative to `archiflow-export/`
5. **Never commit** without being asked

## Troubleshooting

### Plugin not loading?
- Check server is running: `npm run dev`
- Check browser console for errors
- Verify path in URL: `?plugins=1&p=../../../archiflow-export/frontend/plugins/archiflow-main.js`

### WebSocket not connecting?
- Server running on port 3333?
- Check firewall/antivirus
- Try `ws://127.0.0.1:3333` instead of localhost

### Can't see ArchiFlow menu?
- Plugin loaded? Check console
- Try manual load via console (see test-archiflow.html)
- Clear browser cache

---

**Remember: ALL development happens in `archiflow-export/`. Never modify Draw.io core files!**