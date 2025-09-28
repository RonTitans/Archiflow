# ArchiFlow Storage Integration Status Report
## Date: 2025-01-28

## Executive Summary
We are attempting to integrate Draw.io's native save mechanism with the ArchiFlow database. The user wants to press Ctrl+S in Draw.io and see "ArchiFlow Database" as a storage option alongside Google Drive, OneDrive, etc. When selected, diagrams should save to the PostgreSQL database instead of cloud storage.

## Current Objective
**User Requirement:** "I expect to use Draw.io saving mechanism but I want it in my DB"

### What Should Happen:
1. User presses Ctrl+S in Draw.io
2. Save dialog appears with storage location dropdown
3. Dropdown includes "🗄️ ArchiFlow Database" as first option
4. User selects ArchiFlow and clicks Save
5. Diagram XML is sent to NetBox via postMessage
6. NetBox saves to PostgreSQL database
7. Success message shown to user

### What Actually Happens:
1. User presses Ctrl+S
2. Default Draw.io save dialog appears
3. **Storage dropdown shows only default options (Device, Google Drive, etc.)**
4. **ArchiFlow Database option is NOT visible**
5. Error in console: "Uncaught TypeError: ui.showMessage is not a function"

## Technical Architecture

### Current Setup:
```
NetBox (Django) → iframe → Draw.io (served at localhost:8081)
                            ↓
                    Needs to load plugin
                            ↓
                    Plugin should inject storage option
```

### Files Created/Modified:

1. **archiflow-storage-provider.js** (Original attempt)
   - Location: `/drawio-for-Archiflow/archiflow-export/`
   - Issue: Not being loaded properly

2. **archiflow-complete.js** (Main plugin with storage provider appended)
   - Location: `/src/main/webapp/plugins/`
   - Size: 101KB (includes storage provider code)
   - Issue: Storage provider section not executing correctly

3. **archiflow-storage-fix.js** (Improved version)
   - Location: `/src/main/webapp/plugins/`
   - Features: Better error handling, detailed logging, multiple injection attempts
   - Issue: Not loading when using the loader

4. **archiflow-loader.html**
   - Purpose: Loads Draw.io and injects plugins
   - Issue: Cross-origin restrictions prevent proper plugin injection

## Key Problems Identified

### 1. Plugin Loading Issue
- **Problem**: Draw.io requires plugins to be loaded via specific methods
- **Attempted Solutions**:
  - Direct URL parameter: `?plugins=1&p=plugins/archiflow-storage-fix.js`
  - Script injection via loader
  - PostMessage communication
- **Result**: Plugin loads but storage provider code doesn't execute at right time

### 2. Timing Issue
- **Problem**: Save dialog DOM elements don't exist when plugin tries to modify them
- **Attempted Solutions**:
  - setTimeout delays
  - Multiple retry attempts
  - MutationObserver (not yet implemented)
- **Result**: Still missing the right moment to inject

### 3. Cross-Origin Restrictions
- **Problem**: NetBox (port 8000) embedding Draw.io (port 8081)
- **Impact**: Cannot directly manipulate Draw.io DOM from NetBox
- **Workaround Needed**: Must use Draw.io's plugin system

### 4. Draw.io API Compatibility
- **Problem**: `ui.showMessage` function doesn't exist in current Draw.io version
- **Fixed**: Using fallback to mxUtils.alert
- **Status**: Error resolved but functionality still not working

## What We Know Works
1. ✅ Draw.io loads successfully in iframe
2. ✅ Basic plugin loading mechanism works
3. ✅ PostMessage communication between frames works
4. ✅ WebSocket connection to backend works
5. ✅ Database save functionality works (when triggered manually)

## What Doesn't Work
1. ❌ ArchiFlow option doesn't appear in save dialog dropdown
2. ❌ Storage provider plugin code not executing at correct time
3. ❌ Loader cannot inject scripts due to cross-origin policy
4. ❌ Direct plugin URL parameter not triggering storage provider

## Alternative Approaches to Consider

### Option 1: Override Save Completely
Instead of modifying the save dialog, completely replace the save action:
- Intercept Ctrl+S
- Skip Draw.io dialog entirely
- Save directly to ArchiFlow
- Show custom success message

### Option 2: Custom Toolbar Button
Add a prominent "Save to ArchiFlow" button in Draw.io toolbar:
- Easier to implement
- More visible to users
- Avoids dialog modification issues

### Option 3: Fork Draw.io
Modify Draw.io source code directly:
- Most control but highest maintenance
- Would require building custom Draw.io image

### Option 4: Browser Extension
Create a browser extension that modifies Draw.io:
- Can bypass cross-origin restrictions
- But requires user installation

## Recommended Next Steps

1. **Immediate Fix (Quick Win):**
   - Implement Option 1: Override save completely
   - When Ctrl+S pressed, immediately save to ArchiFlow
   - Show simple success notification
   - Bypass the complex dialog modification

2. **Better Solution (Medium Term):**
   - Implement Option 2: Custom toolbar button
   - Add prominent "Save to ArchiFlow" button
   - Keep it simple and visible

3. **Investigation Needed:**
   - Why doesn't Draw.io's plugin parameter load our code properly?
   - Is there a specific Draw.io event we should listen for?
   - Can we use Draw.io's App.onInit or similar hooks?

## Current Status
- **Blocked on**: Getting custom storage option to appear in Draw.io save dialog
- **Time Spent**: ~2 hours on storage integration
- **User Frustration Level**: High (mentioned "working one hour without any progress")

## Conclusion
The core issue is that Draw.io's save dialog is generated dynamically and our plugin code isn't executing at the right moment to modify it. While we've created the necessary code, the integration point is failing. A simpler approach that bypasses the dialog entirely would be more reliable and faster to implement.