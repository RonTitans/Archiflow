# ArchiFlow Diagram Cache Issue Report
**Date:** September 28, 2025
**Time:** ~11:30 UTC
**Project:** ArchiFlow - NetBox & Draw.io Integration Platform

## Executive Summary
The ArchiFlow plugin for NetBox has a critical caching issue where Draw.io persists diagram content across different diagram instances within the same browser session. When creating new diagrams, they display content from previously edited diagrams (specifically "ROUTER-4786" in this case) instead of starting with an empty canvas.

## Problem Description

### Expected Behavior
1. User creates a new diagram (e.g., diagram "12")
2. Draw.io should load with a completely empty canvas
3. Each diagram should be isolated from others

### Actual Behavior
1. User creates a new diagram
2. Draw.io loads with content from a previously edited diagram (ROUTER-4786)
3. All new diagrams show the same cached content
4. The database correctly stores empty diagram templates (522 bytes)
5. The issue only occurs within the same browser session

### Verification
- **Database Status:** ✅ Correctly stores empty diagram XML
- **Incognito Mode:** ✅ Works correctly (starts empty)
- **Regular Browser:** ❌ Shows cached content from previous diagrams

## Technical Investigation

### Root Cause
Draw.io maintains diagram state in JavaScript memory within the browser session. This state persists even when:
- The iframe is completely destroyed and recreated
- localStorage, sessionStorage, and cookies are cleared
- New unique IDs are generated for each diagram
- Cache-busting parameters are added to URLs

### Components Involved
1. **NetBox Plugin** (`/netbox-archiflow-plugin/`)
   - `editor.html` - Main editor interface
   - Handles diagram creation and loading

2. **Draw.io Integration** (`/drawio-for-Archiflow/`)
   - `archiflow-loader.html` - Loader for Draw.io
   - `archiflow-complete.js` - Main ArchiFlow plugin
   - Custom save/load mechanisms

3. **Backend Services**
   - WebSocket server (port 3333)
   - PostgreSQL database (ArchiFlow schema)
   - Docker containers for all services

## Attempted Solutions

### 1. Storage Clearing (PARTIAL SUCCESS)
```javascript
localStorage.clear();
sessionStorage.clear();
// Clear all cookies
// Clear IndexedDB
```
**Result:** Clears storage but doesn't affect in-memory cache

### 2. Iframe Recreation (FAILED)
```javascript
// Completely destroy and recreate iframe
const newIframe = document.createElement('iframe');
newIframe.id = 'archiflow-frame';
parent.replaceChild(newIframe, iframe);
```
**Result:** New iframe still loads with cached content

### 3. Cache-Busting Parameters (FAILED)
```javascript
const drawioUrl = `...?t=${timestamp}&rid=${randomId}&local=0&draft=0`;
```
**Result:** URLs are unique but content still cached

### 4. Data URI with Empty Diagram (FAILED)
```javascript
const emptyDiagram = '<mxfile>...</mxfile>';
const dataUri = `data:application/xml;base64,${btoa(emptyDiagram)}`;
```
**Result:** Draw.io ignores the data URI and loads cached content

### 5. Nuclear Clear in Plugin (FAILED)
```javascript
ui.editor.graph.model.clear();
ui.editor.graph.view.clear();
// Create brand new model and view
```
**Result:** Graph is cleared but immediately repopulated with cached content

### 6. Iframe Sandboxing (CAUSED ERRORS)
```javascript
newIframe.setAttribute('sandbox', 'allow-same-origin allow-scripts...');
```
**Result:** Broke functionality due to cross-origin restrictions

### 7. Page Reload on New Diagram (WORKS BUT DISRUPTIVE)
```javascript
window.location.reload(true);
```
**Result:** Clears cache but disrupts workflow

## Current Status

### What Works
- ✅ Diagram saving to database
- ✅ WebSocket communication
- ✅ Plugin loading and initialization
- ✅ Incognito/private browsing mode
- ✅ Page refresh (F5) clears cache

### What Doesn't Work
- ❌ Cache isolation between diagrams in same session
- ❌ Clearing Draw.io's in-memory state programmatically
- ❌ Preventing Draw.io from auto-loading cached content

## Recommendations

### Short-term Workarounds
1. Use incognito/private browsing for creating truly new diagrams
2. Refresh the page (F5) when switching between unrelated diagrams
3. Clear browser cache between diagram creation sessions

### Long-term Solutions Needed
1. **Investigate Draw.io's internal state management**
   - Find where Draw.io stores the cached diagram
   - Implement a proper clear mechanism

2. **Consider alternative approaches**
   - Use different Draw.io instances for each diagram
   - Implement server-side rendering of diagrams
   - Fork Draw.io to add proper cache control

3. **Contact Draw.io/diagrams.net team**
   - Report the caching issue
   - Request API for complete state reset

## Files Modified During Troubleshooting
- `/netbox-archiflow-plugin/netbox_archiflow/templates/netbox_archiflow/editor.html`
- `/drawio-for-Archiflow/src/main/webapp/plugins/archiflow-complete.js`
- `/drawio-for-Archiflow/src/main/webapp/archiflow-loader.html`
- `/drawio-for-Archiflow/archiflow-export/backend/websocket-server.js`
- `/drawio-for-Archiflow/archiflow-export/backend/database/version-manager.js`

## Impact
This issue significantly impacts usability as users cannot create truly independent diagrams without workarounds. It affects the core functionality of the ArchiFlow plugin, making it difficult to manage multiple network diagrams effectively.

## Next Steps
1. Document workarounds for users
2. Investigate Draw.io source code for state management
3. Consider implementing a "force clear" button that reloads the page
4. Evaluate alternative diagramming libraries if issue persists

---
*Report generated after extensive troubleshooting session with multiple attempted fixes*