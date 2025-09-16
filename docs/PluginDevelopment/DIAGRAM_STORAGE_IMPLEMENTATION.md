# Diagram Storage Implementation Summary

## Date: January 17, 2025

## Overview
Implemented a database-backed diagram storage system for ArchiFlow to replace Draw.io's local storage with proper version management.

---

## The Challenge
Draw.io uses browser local storage by default, which caused:
- All diagram versions showing the same content (last edited)
- Draft selector popups appearing unexpectedly
- No proper version isolation
- Mixing of diagram content between versions

## The Solution Architecture

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Draw.io    │      │   ArchiFlow  │      │  PostgreSQL  │
│   (Editor)   │ ───> │   Frontend   │ ───> │   Database   │
│              │      │              │      │              │
│ No Storage!  │      │ Save/Load    │      │ diagram_data │
└──────────────┘      └──────────────┘      └──────────────┘
     ↑                                              ↓
     └────────── Load XML from specific version ────┘
```

---

## Implementation Details

### 1. Database Structure
```sql
archiflow.diagrams table:
- id (UUID) - Unique identifier
- site_id - Links to site
- version - Version number (v1.0, v2.0, etc.)
- title - Diagram title
- diagram_data (TEXT) - Full XML content of diagram ← KEY FIELD
- created_at, created_by - Metadata
- is_live - Deployment status
```

### 2. Key Functions Added

#### Save Current Diagram
```javascript
function saveCurrentDiagram() {
    // Requests XML from Draw.io
    iframe.contentWindow.postMessage({
        action: 'export',
        format: 'xml'
    }, '*');
}
```

#### Save to Database
```javascript
function saveDiagramToDatabase(xmlData) {
    // Sends actual XML to database via WebSocket
    sendToWebSocket('update_diagram', {
        diagramId: currentDiagram,
        diagramData: xmlData,
        userId: username
    });
}
```

#### Open Specific Version
```javascript
function openDiagram(diagramId) {
    // 1. Clear Draw.io local storage
    clearDrawioStorage();

    // 2. Load XML from database
    const diagram = diagrams.find(d => d.id === diagramId);

    // 3. Send to Draw.io via postMessage
    iframe.contentWindow.postMessage({
        action: 'load',
        xml: diagram.diagram_data
    }, '*');
}
```

### 3. WebSocket Handlers

#### Update Diagram
```javascript
case 'update_diagram':
    const updateResult = await VersionManager.updateDiagram(
        message.diagramId,
        message.diagramData
    );
```

#### Version Manager
```javascript
async updateDiagram(diagramId, diagramData) {
    const result = await pool.query(
        'UPDATE archiflow.diagrams SET diagram_data = $1 WHERE id = $2',
        [diagramData, diagramId]
    );
}
```

---

## UI Changes

### Added Save Button
```html
<button class="btn btn-sm btn-primary" onclick="saveCurrentDiagram()">
    💾 Save Current
</button>
```

### Removed/Fixed
- Removed draft selector popup
- Disabled Draw.io splash screen
- Attempted to disable local storage (partially successful)

---

## Current Workflow

1. **Select Site** → Loads diagrams for that site only
2. **Create/Open Diagram** → Loads specific version from DB
3. **Edit in Draw.io** → Visual editor only
4. **Click "💾 Save Current"** → Saves XML to database
5. **Switch Versions** → Each loads its own content

---

## Known Issues & Limitations

### Issues
1. **Draw.io Local Storage** - Cannot fully prevent Draw.io from using localStorage
2. **Ctrl+S Behavior** - Still saves to local storage instead of database
3. **PostMessage API** - Communication with Draw.io iframe is limited
4. **Export Function** - May not always capture the current state correctly

### Workarounds
- Always use "💾 Save Current" button instead of Ctrl+S
- Clear browser cache if diagrams get mixed up
- Reload page after saving important changes

---

## Future Improvements

### Short Term
1. Fix the export/import message handling
2. Add auto-save timer (every 30 seconds)
3. Show save status indicator
4. Add version comparison view

### Long Term
1. Replace Draw.io with custom diagram editor
2. Or fork Draw.io to remove local storage completely
3. Implement real-time collaboration
4. Add diagram change tracking/diff

---

## Files Modified

### Frontend
- `/netbox-archiflow-plugin/netbox_archiflow/templates/netbox_archiflow/editor.html`
  - Added save functions
  - Added message handlers
  - Modified diagram loading

### Backend
- `/drawio-for-Archiflow/archiflow-export/backend/websocket-server.js`
  - Added update_diagram handler

- `/drawio-for-Archiflow/archiflow-export/backend/database/version-manager.js`
  - Added updateDiagram function
  - Modified getDiagramsBySite to include diagram_data

### Database
- `archiflow.diagrams` table
  - diagram_data field stores full XML

---

## Testing Guide

### Create New Diagram
1. Select site from dropdown
2. Click "+ New Diagram"
3. Enter version and title
4. Draw something
5. Click "💾 Save Current"
6. Check database: `SELECT LENGTH(diagram_data) FROM archiflow.diagrams WHERE id = 'xxx';`

### Load Existing Diagram
1. Select site
2. Click "Open" on a version
3. Should load without popup
4. Content should match what was saved

### Switch Between Versions
1. Open v1.0, make changes, save
2. Open v2.0, make different changes, save
3. Go back to v1.0 - should show v1.0 content
4. Go back to v2.0 - should show v2.0 content

---

## Lessons Learned

1. **Draw.io Integration Challenges**
   - Draw.io is designed for standalone use with local storage
   - PostMessage API is limited and not well documented
   - Cannot fully control Draw.io's save behavior

2. **Better Approach Would Be**
   - Use Draw.io in "embed" mode with custom storage
   - Or use a different diagram library (e.g., mxGraph directly)
   - Or build custom diagram editor

3. **Database Design**
   - Storing XML as TEXT works but could be optimized
   - Consider JSONB for better querying
   - Add compression for large diagrams

---

## Conclusion

We successfully implemented a database-backed storage system for diagrams, though with some limitations due to Draw.io's architecture. The system works but requires users to explicitly save to database rather than relying on Draw.io's auto-save.

The sites dropdown issue was resolved, and the version management system is functional. Each diagram version now maintains its own content in the database, achieving the goal of proper version control for network diagrams.