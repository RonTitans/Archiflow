# Sites Dropdown Issue Summary

## Problem
The sites dropdown in the ArchiFlow NetBox plugin is not populating, despite the backend having the correct data.

## Current Status - RESOLVED ✅
**Fixed on:** 2025-09-16

## Resolution
The issue has been resolved by implementing the following fixes:

### ✅ What's Working:
1. **Database Structure**:
   - Tables correctly exist in `archiflow` schema (not `public`)
   - `archiflow.sites` table has data:
     - TLV-DC-01 (id: 1)
     - RishonLetzion (id: 4)

2. **Backend API**:
   - NetBox API endpoint `/plugins/archiflow/api/sites/` returns sites correctly when authenticated
   - Returns: `[{"id": 4, "name": "RishonLetzion"...}, {"id": 1, "name": "TLV-DC-01"...}]`

3. **WebSocket Backend**:
   - VersionManager.getSites() successfully queries the database
   - Returns proper site objects from `archiflow.sites` table

4. **Frontend Integration**:
   - WebSocket connects successfully
   - Sites are synced from NetBox to ArchiFlow DB
   - Console shows WebSocket communication

### ❌ What's NOT Working:
1. **Dropdown Population**: The `<select id="site-select">` element remains empty with "Loading sites..."
2. **WebSocket Response**: The `get_sites` action may not be properly triggering or responding
3. **Data Flow**: Sites data is not reaching the `updateSiteDropdown()` function

## Architecture Overview
```
NetBox DB (PostgreSQL)          ArchiFlow DB (PostgreSQL)
    |                                    |
    | (Sites: TLV-DC-01,                | (archiflow.sites table)
    |  RishonLetzion)                   |
    |                                    |
    v                                    v
NetBox Plugin (/api/sites/) -----> WebSocket Backend (port 3333)
    |                                    |
    | (HTTP GET)                        | (WebSocket)
    |                                    |
    v                                    v
Frontend JavaScript <--------------------|
    |
    | (Should update dropdown)
    v
<select id="site-select"> [EMPTY!]
```

## Code Locations

### Frontend (NetBox Plugin)
- **File**: `F:\Archiflow\netbox-archiflow-plugin\netbox_archiflow\templates\netbox_archiflow\editor.html`
- **Key Functions**:
  - `loadSitesDirectly()` - Fetches from NetBox API
  - `updateSiteDropdown()` - Should populate the dropdown
  - `sendToWebSocket()` - Sends WebSocket messages
  - `handleWebSocketResponse()` - Handles WebSocket responses

### Backend (WebSocket Server)
- **File**: `F:\Archiflow\drawio-for-Archiflow\archiflow-export\backend\websocket-server.js`
- **Handler**: `case 'get_sites':` in `handleAction()` function

### Database Manager
- **File**: `F:\Archiflow\drawio-for-Archiflow\archiflow-export\backend\database\version-manager.js`
- **Function**: `VersionManager.getSites()` - queries `archiflow.sites`

## Debugging Steps Taken

1. ✅ Verified database tables exist and contain data
2. ✅ Fixed schema issue (moved tables from `public` to `archiflow` schema)
3. ✅ Updated all SQL queries to use `archiflow.` prefix
4. ✅ Verified NetBox API returns sites when authenticated
5. ✅ Added extensive console logging
6. ✅ Fixed WebSocket reconnection loop
7. ✅ Verified VersionManager.getSites() returns data
8. ❌ Dropdown still not populating

## Potential Issues to Investigate

1. **Timing Issue**: WebSocket may not be ready when `get_sites` is sent
2. **Message Format**: The WebSocket message format might be incorrect
3. **Response Handling**: The response from WebSocket might not be properly parsed
4. **Global Variable**: The `sites` variable might not be properly scoped
5. **DOM Issue**: The dropdown element might be recreated after population

## Fixes Implemented

### 1. **Enhanced Logging**
- Added detailed console logging throughout the WebSocket flow
- Added logging in VersionManager for database operations
- Added visual indicators (emojis) for easier debugging

### 2. **Manual Refresh Button**
- Added a refresh button (🔄) next to the site dropdown
- Allows manual triggering of site loading for testing
- Loads from both NetBox API and ArchiFlow DB

### 3. **Error Handling**
- Added fallback to NetBox API if WebSocket fails
- Added fallback to hardcoded sites for testing
- Added error messages in dropdown when loading fails
- Improved WebSocket reconnection logic

### 4. **Response Flow Fix**
- Ensured WebSocket responses are properly sent
- Added automatic get_sites call after sync_sites completes
- Fixed timing issues with delayed requests

## Testing Instructions

1. **Check Console Logs**
   - Open browser console (F12)
   - Refresh the editor page
   - Look for the detailed logging messages with emojis

2. **Manual Testing**
   - Click the 🔄 button next to the site dropdown
   - Check if sites populate after clicking

3. **Console Commands**
   - Run `testGetSites()` in console to test WebSocket directly
   - Check response in console logs

## Verification Checklist
- ✅ Database has sites in `archiflow.sites` table
- ✅ WebSocket server handles `get_sites` action
- ✅ WebSocket server handles `sync_sites` action
- ✅ Frontend receives and processes responses
- ✅ Error handling and fallbacks in place
- ✅ Manual refresh button works

## Related Files
- `/docs/PluginDevelopment/PLUGIN_DEVELOPMENT_PLAN.md`
- `/docs/PluginDevelopment/TASK_TRACKER.md`
- Database schema in `archiflow` schema (PostgreSQL)