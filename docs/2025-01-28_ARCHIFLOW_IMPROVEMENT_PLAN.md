# ArchiFlow Improvement Plan - January 28, 2025

## Executive Summary
After comprehensive review of the ArchiFlow plugin architecture, this document outlines critical improvements needed to achieve a smooth, production-ready NetBox integration for network diagram management.

---

## Current State Assessment

### ✅ What's Working
1. **Sites dropdown** - Successfully syncs from NetBox to ArchiFlow DB then to UI
2. **Database storage** - Diagrams are stored in PostgreSQL with version tracking
3. **Basic integration** - Draw.io loads in NetBox iframe with WebSocket connectivity
4. **Version management** - Multiple versions per site with deployment status

### ❌ Critical Issues
1. **Draw.io Integration Challenges**
   - Fighting Draw.io's local storage - it wasn't designed for external storage
   - PostMessage API is unreliable for save/load operations
   - The MCP server approach is unnecessary complexity

2. **Database Structure Issues**
   - Missing proper site_id foreign key constraints to NetBox
   - No actual deployment mechanism (is_live flag exists but isn't enforced)
   - Version comparison feature not implemented

3. **Architecture Problems**
   - Too many backend servers (websocket-server.js, dev-server.js, mcp-server.js, etc.)
   - The flow NetBox → Sync → ArchiFlow DB → Frontend is correct, but implementation is fragmented
   - Missing proper models in NetBox plugin (models.py is empty)

4. **UI/UX Issues**
   - Save mechanism requires manual "Save Current" button click
   - No auto-save functionality
   - Deploy button exists but doesn't properly update NetBox

---

## Implementation Phases

### Phase 1: Core Fixes (CRITICAL - Week 1)
**Goal:** Stabilize the core functionality and simplify architecture

#### 1.1 Consolidate Backend Architecture
- [ ] Remove MCP server implementation (not needed)
- [ ] Consolidate to single websocket-server.js
- [ ] Remove duplicate server files (dev-server.js, simple-server.js, etc.)
- [ ] Create clear server startup script
- [ ] Document the simplified architecture

#### 1.2 Fix Diagram Storage Mechanism
- [ ] Implement auto-save timer (every 30 seconds)
- [ ] Intercept Ctrl+S to trigger database save
- [ ] Add save status indicator in UI
- [ ] Implement proper error handling for save failures
- [ ] Add recovery mechanism for lost connections

#### 1.3 Add NetBox Django Models
- [ ] Create DiagramMetadata model in models.py
- [ ] Link to NetBox Site model with proper foreign key
- [ ] Add deployment tracking fields
- [ ] Create migration scripts
- [ ] Test model integration

#### 1.4 Implement Real Deployment Mechanism
- [ ] Create deployment API endpoint in NetBox plugin
- [ ] Update NetBox when diagram is deployed
- [ ] Track deployment history in NetBox
- [ ] Add rollback capability
- [ ] Implement deployment notifications

### Phase 2: Essential Features (Week 2)
**Goal:** Complete core functionality for production use

#### 2.1 Version Comparison
- [ ] Implement XML diff algorithm
- [ ] Create comparison UI view
- [ ] Highlight changes between versions
- [ ] Add change summary generation

#### 2.2 Device Synchronization
- [ ] Create device import from NetBox API
- [ ] Map NetBox devices to Draw.io shapes
- [ ] Implement device property sync
- [ ] Add device type templates

#### 2.3 IP Allocation Integration
- [ ] Sync IP allocations to NetBox IPAM
- [ ] Validate IP assignments
- [ ] Handle IP conflicts
- [ ] Create allocation reports

#### 2.4 Audit Trail
- [ ] Log all diagram changes
- [ ] Track user actions
- [ ] Create audit report view
- [ ] Implement change notifications

### Phase 3: UI/UX Improvements (Week 3)
**Goal:** Professional, intuitive user interface

#### 3.1 Remove Modal Popups
- [ ] Design integrated sidebar
- [ ] Migrate all popups to sidebar
- [ ] Implement smooth animations
- [ ] Add collapse/expand functionality

#### 3.2 Status Indicators
- [ ] Add save status indicator
- [ ] Show sync status with NetBox
- [ ] Display connection status
- [ ] Implement progress bars

#### 3.3 Keyboard Shortcuts
- [ ] Implement Ctrl+S for save
- [ ] Add Ctrl+D for deploy
- [ ] Create shortcut help menu
- [ ] Make shortcuts customizable

#### 3.4 Error Handling
- [ ] Create user-friendly error messages
- [ ] Add retry mechanisms
- [ ] Implement error recovery
- [ ] Create error log viewer

---

## Technical Implementation Details

### Correct Data Flow Architecture
```
1. NetBox Sites/Devices (Source of Truth)
      ↓ [Sync via API]
2. ArchiFlow DB (Cached copy + diagram data)
      ↓ [WebSocket]
3. Draw.io Editor (Visual editing only)
      ↓ [Auto-save]
4. ArchiFlow DB (Store diagram XML)
      ↓ [Deploy action]
5. NetBox (Update with changes)
```

### Database Schema Updates Needed
```sql
-- Add to ArchiFlow schema
ALTER TABLE diagrams
ADD COLUMN netbox_site_id INTEGER,
ADD COLUMN deployment_status VARCHAR(50) DEFAULT 'draft',
ADD COLUMN last_sync_with_netbox TIMESTAMP,
ADD CONSTRAINT fk_netbox_site FOREIGN KEY (netbox_site_id)
    REFERENCES netbox.dcim_site(id);

-- Create deployment tracking
CREATE TABLE deployment_tracking (
    id SERIAL PRIMARY KEY,
    diagram_id UUID REFERENCES diagrams(id),
    deployed_to_netbox BOOLEAN DEFAULT FALSE,
    netbox_sync_data JSONB,
    deployment_timestamp TIMESTAMP DEFAULT NOW()
);
```

### WebSocket Message Handlers to Add
```javascript
// Auto-save handler
case 'auto_save':
    await handleAutoSave(message.diagramId, message.xmlData);
    break;

// Deployment handler
case 'deploy_to_netbox':
    await deployToNetBox(message.diagramId, message.siteId);
    break;

// Device sync handler
case 'sync_devices':
    await syncDevicesFromNetBox(message.siteId);
    break;
```

---

## Risk Mitigation

### High Risk Items
1. **Draw.io Integration Limitations**
   - Mitigation: Consider migrating to mxGraph directly or custom editor
   - Short-term: Work within PostMessage API constraints

2. **Data Loss During Save**
   - Mitigation: Implement versioning for every save
   - Add recovery mechanism from browser cache

3. **NetBox API Changes**
   - Mitigation: Abstract API calls in service layer
   - Version lock NetBox container

### Medium Risk Items
1. **Performance with Large Diagrams**
   - Mitigation: Implement pagination and lazy loading
   - Add diagram size limits

2. **Concurrent Edit Conflicts**
   - Mitigation: Implement optimistic locking
   - Add merge capability

---

## Success Metrics

### Phase 1 Success Criteria
- [ ] Single backend server running reliably
- [ ] Auto-save working every 30 seconds
- [ ] Django models created and migrated
- [ ] Deployment updates NetBox successfully

### Phase 2 Success Criteria
- [ ] Version comparison showing differences
- [ ] Devices sync from NetBox accurately
- [ ] IP allocations reflect in NetBox IPAM
- [ ] Complete audit trail available

### Phase 3 Success Criteria
- [ ] Zero modal popups remaining
- [ ] All status indicators functional
- [ ] Keyboard shortcuts working
- [ ] Clear error messages for all failure modes

---

## Timeline

### Week 1 (Jan 28 - Feb 3)
- Phase 1: Core Fixes
- Daily testing and bug fixes
- Documentation updates

### Week 2 (Feb 4 - Feb 10)
- Phase 2: Essential Features
- Integration testing
- Performance optimization

### Week 3 (Feb 11 - Feb 17)
- Phase 3: UI/UX Improvements
- User acceptance testing
- Final documentation

---

## Notes for Implementation

### Priority Order
1. **MUST DO FIRST**: Consolidate backend servers
2. **CRITICAL**: Fix save mechanism
3. **IMPORTANT**: Add Django models
4. **NEEDED**: Implement deployment

### Known Gotchas
- Draw.io will always try to use localStorage
- Tom Select interferes with dropdowns in NetBox
- WebSocket needs reconnection logic
- PostgreSQL connection pooling is essential

### Testing Checklist
- [ ] Test with 100+ devices
- [ ] Test with 10MB+ diagrams
- [ ] Test concurrent users
- [ ] Test network disconnection
- [ ] Test browser refresh during edit

---

## Conclusion

The ArchiFlow plugin has solid foundations but needs critical improvements to be production-ready. Phase 1 is absolutely essential to stabilize the system. The architecture is correct (NetBox → ArchiFlow DB → Draw.io), but the implementation needs refinement to ensure smooth operation.

**Next Step:** Begin Phase 1.1 - Consolidate Backend Architecture

---

*Document created: January 28, 2025*
*Author: ArchiFlow Development Team*
*Status: Active Development*