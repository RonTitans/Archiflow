# ArchiFlow Draw.io Plugin Development Plan
**Version:** 2.0
**Date:** January 2025
**Status:** In Development

---

## Executive Summary

This document outlines the comprehensive development plan for enhancing the ArchiFlow Draw.io plugin with site-based diagram management, version control similar to Vercel deployments, and seamless integration between NetBox and ArchiFlow databases.

**Core Principle:** Every network diagram belongs to a NetBox Site, with clear version management and a single "Live" production diagram per site.

---

## Table of Contents
1. [Overview](#overview)
2. [Architecture Design](#architecture-design)
3. [Database Integration Strategy](#database-integration-strategy)
4. [Version Management System](#version-management-system)
5. [User Interface Redesign](#user-interface-redesign)
6. [Device Image Support](#device-image-support)
7. [Implementation Phases](#implementation-phases)
8. [Technical Requirements](#technical-requirements)
9. [Success Metrics](#success-metrics)

---

## Overview

### Current State
- Draw.io plugin loads in NetBox iframe
- Basic IP allocation and WebSocket connectivity
- Diagrams stored in ArchiFlow database
- Popup-based UI for actions

### Target State
- **Site-centric diagram organization** - Each NetBox site has its own diagram collection
- **Vercel-style version management** - Clear "Live" indicator with deployment workflow
- **Integrated sidebar UI** - Replace popups with modern sidebar interface
- **Device image support** - Attach and display real device photos
- **Seamless DB integration** - Bidirectional sync between NetBox and ArchiFlow

### Key Requirements
1. One "Live" diagram per site at any time
2. Version history with easy navigation
3. Pre-editor interface for diagram selection
4. Clean, integrated UI without modal popups
5. Support for device images alongside icons

---

## Architecture Design

### System Components

```
┌─────────────────────────────────────────────────────┐
│                  NetBox (Port 8000)                  │
│  ┌─────────────────────────────────────────────┐    │
│  │         ArchiFlow Plugin (Django)            │    │
│  │  - Site management                           │    │
│  │  - Device inventory                          │    │
│  │  - IPAM data                                 │    │
│  └──────────────┬──────────────────────────────┘    │
└─────────────────┼────────────────────────────────────┘
                  │ API/REST
                  ▼
┌─────────────────────────────────────────────────────┐
│        ArchiFlow Manager (Pre-Editor UI)             │
│  ┌─────────────────────────────────────────────┐    │
│  │  - Site selector from NetBox                 │    │
│  │  - Version list with filters                 │    │
│  │  - Deploy/rollback controls                  │    │
│  │  - Diagram launcher                          │    │
│  └──────────────┬──────────────────────────────┘    │
└─────────────────┼────────────────────────────────────┘
                  │ Opens Selected Version
                  ▼
┌─────────────────────────────────────────────────────┐
│          Draw.io Editor (Port 8081)                  │
│  ┌─────────────────────────────────────────────┐    │
│  │  ArchiFlow Plugin (JavaScript)               │    │
│  │  - Integrated sidebar (replaces popups)      │    │
│  │  - Device property panel                     │    │
│  │  - Status bar with site/version info         │    │
│  └──────────────┬──────────────────────────────┘    │
└─────────────────┼────────────────────────────────────┘
                  │ WebSocket
                  ▼
┌─────────────────────────────────────────────────────┐
│        ArchiFlow Backend (Port 3333)                 │
│  - Version management operations                     │
│  - Database CRUD operations                          │
│  - NetBox synchronization                            │
│  - Image storage management                          │
└───────────────┬─────────────┬───────────────────────┘
                │             │
        PostgreSQL        PostgreSQL
        (ArchiFlow)        (NetBox)
         Port 5433         Port 5432
```

### Data Flow

1. **Diagram Selection Flow**
   ```
   User → NetBox → ArchiFlow Manager → Select Site → View Versions → Open Diagram → Draw.io Editor
   ```

2. **Version Deployment Flow**
   ```
   Save Version → Store in DB → Deploy Action → Update is_live flag → Log Deployment → Notify Users
   ```

3. **NetBox Sync Flow**
   ```
   Import Devices → Query NetBox API → Transform Data → Insert to Diagram → Save to ArchiFlow DB
   ```

---

## Database Integration Strategy

### ArchiFlow Database Schema

#### Core Tables

```sql
-- Main diagrams table with version control
CREATE TABLE diagrams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id INTEGER NOT NULL,              -- NetBox site ID (foreign reference)
    site_name VARCHAR(255) NOT NULL,       -- Cached site name for quick display
    version VARCHAR(50) NOT NULL,          -- Semantic versioning (v1.0.0)
    title VARCHAR(255) NOT NULL,
    description TEXT,
    diagram_data TEXT NOT NULL,            -- Draw.io XML content
    is_live BOOLEAN DEFAULT FALSE,         -- Production flag
    status VARCHAR(50) DEFAULT 'draft',    -- draft, review, deployed, archived
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100) NOT NULL,
    modified_at TIMESTAMP DEFAULT NOW(),
    deployed_at TIMESTAMP,                 -- When it became live
    deployed_by VARCHAR(100),
    parent_version_id UUID,                -- Links to previous version
    change_summary TEXT,                   -- What changed in this version
    metadata JSONB,                        -- Additional flexible data

    -- Constraints
    CONSTRAINT unique_site_version UNIQUE(site_id, version),
    CONSTRAINT one_live_per_site EXCLUDE USING btree (site_id WITH =)
        WHERE (is_live = TRUE)
);

-- Deployment history for audit trail
CREATE TABLE deployment_history (
    id SERIAL PRIMARY KEY,
    diagram_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
    site_id INTEGER NOT NULL,
    site_name VARCHAR(255),
    version VARCHAR(50),
    action VARCHAR(50) NOT NULL,           -- deployed, rolled_back, archived
    timestamp TIMESTAMP DEFAULT NOW(),
    performed_by VARCHAR(100) NOT NULL,
    notes TEXT,
    previous_live_id UUID,                 -- Which diagram was live before
    metadata JSONB
);

-- Device images storage
CREATE TABLE device_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(100),                -- Can be NetBox ID or ArchiFlow asset ID
    device_name VARCHAR(255),
    image_data TEXT NOT NULL,              -- Base64 encoded or S3 URL
    image_type VARCHAR(50),                -- photo, icon, schematic, rack_view
    thumbnail TEXT,                         -- Small preview version
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT NOW(),
    uploaded_by VARCHAR(100),
    site_id INTEGER,                       -- Associated site
    metadata JSONB
);

-- Version comparison tracking
CREATE TABLE version_comparisons (
    id SERIAL PRIMARY KEY,
    version_a_id UUID REFERENCES diagrams(id),
    version_b_id UUID REFERENCES diagrams(id),
    comparison_date TIMESTAMP DEFAULT NOW(),
    compared_by VARCHAR(100),
    differences JSONB,                     -- Structured diff data
    notes TEXT
);

-- Create indexes for performance
CREATE INDEX idx_diagrams_site_id ON diagrams(site_id);
CREATE INDEX idx_diagrams_is_live ON diagrams(is_live);
CREATE INDEX idx_diagrams_status ON diagrams(status);
CREATE INDEX idx_diagrams_version ON diagrams(version);
CREATE INDEX idx_deployment_history_site ON deployment_history(site_id);
CREATE INDEX idx_device_images_device ON device_images(device_id);
```

### NetBox Database Integration Points

#### Key Tables to Query

1. **Sites** (`dcim_site`)
   - Pull site list for dropdown
   - Validate site permissions
   - Cache site metadata

2. **Devices** (`dcim_device`)
   - Import devices by site
   - Sync device properties
   - Track device relationships

3. **IP Addresses** (`ipam_ipaddress`)
   - Import existing allocations
   - Push new allocations back
   - Validate IP availability

4. **Cables** (`dcim_cable`)
   - Import physical connections
   - Visualize cable paths
   - Update connection status

### Integration Methods

```javascript
// NetBox API Integration
class NetBoxIntegration {
    constructor(apiUrl, apiToken) {
        this.api = new NetBoxAPI(apiUrl, apiToken);
    }

    // Get all sites for dropdown
    async getSites() {
        return await this.api.get('/api/dcim/sites/', {
            limit: 1000,
            brief: true
        });
    }

    // Get devices for a specific site
    async getDevicesBySite(siteId) {
        return await this.api.get('/api/dcim/devices/', {
            site_id: siteId,
            include: ['interfaces', 'primary_ip']
        });
    }

    // Sync IP allocation back to NetBox
    async updateDeviceIP(deviceId, ipAddress) {
        return await this.api.patch(`/api/dcim/devices/${deviceId}/`, {
            primary_ip4: ipAddress
        });
    }
}

// ArchiFlow Database Integration
class ArchiFlowDB {
    constructor(wsConnection) {
        this.ws = wsConnection;
    }

    // Get all versions for a site
    async getDiagramsBySite(siteId) {
        return await this.ws.send({
            method: 'diagram.list',
            params: { site_id: siteId }
        });
    }

    // Deploy a version as live
    async deployVersion(diagramId, userId) {
        return await this.ws.send({
            method: 'diagram.deploy',
            params: {
                diagram_id: diagramId,
                user_id: userId
            }
        });
    }
}
```

---

## Version Management System

### Vercel-Style Deployment Model

#### Version States
1. **Draft** - Work in progress, not ready for review
2. **Review** - Ready for review, not yet approved
3. **Deployed** - Currently live in production
4. **Archived** - Historical version, kept for reference

#### Deployment Process
```
1. Create/Edit Diagram → Save as Draft
2. Mark for Review → Team Reviews
3. Deploy to Production → Becomes Live
4. Previous Live → Automatically Archived
```

### Version Management UI

#### Pre-Editor Interface (Landing Page)

```
┌────────────────────────────────────────────────────────────┐
│ ArchiFlow Diagram Manager                          [User]  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ Site: [NYC-DC01 ▼]                    [+ New Diagram]     │
│                                                            │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ Version  Title         Status    Created    Actions  │  │
│ ├──────────────────────────────────────────────────────┤  │
│ │ v3.0     Q1 Planning   Draft     Today      [Open]   │  │
│ │                                              [Deploy] │  │
│ ├──────────────────────────────────────────────────────┤  │
│ │ v2.5     Current Prod  🟢 LIVE   Jan 10     [Open]   │  │
│ │                                              [Clone]  │  │
│ ├──────────────────────────────────────────────────────┤  │
│ │ v2.0     Backup        Archived  Jan 5      [Open]   │  │
│ │                                              [Compare]│  │
│ └──────────────────────────────────────────────────────┘  │
│                                                            │
│ Deployment History                                         │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ v2.5 deployed by Sarah - Jan 10, 2025 14:30          │  │
│ │ v2.0 rolled back by Mike - Jan 8, 2025 09:15         │  │
│ └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

#### Key Features
- **Clear LIVE Indicator** - Green badge/highlight for production version
- **One-Click Deploy** - Simple deployment with confirmation
- **Version Comparison** - Side-by-side diff view
- **Audit Trail** - Complete deployment history
- **Quick Actions** - Open, Clone, Deploy, Archive

### Version Control Operations

```javascript
// Version Management Functions
const VersionManager = {
    // Create new version from existing
    async cloneVersion(sourceId, newVersion) {
        const source = await this.getDiagram(sourceId);
        return await this.createDiagram({
            ...source,
            id: null,
            version: newVersion,
            is_live: false,
            status: 'draft',
            parent_version_id: sourceId
        });
    },

    // Deploy version as live
    async deployVersion(diagramId) {
        // Begin transaction
        await this.db.beginTransaction();

        try {
            // Find current live version
            const currentLive = await this.db.query(
                'SELECT id FROM diagrams WHERE site_id = $1 AND is_live = TRUE',
                [siteId]
            );

            // Archive current live
            if (currentLive) {
                await this.db.query(
                    'UPDATE diagrams SET is_live = FALSE, status = $1 WHERE id = $2',
                    ['archived', currentLive.id]
                );
            }

            // Deploy new version
            await this.db.query(
                'UPDATE diagrams SET is_live = TRUE, status = $1, deployed_at = NOW() WHERE id = $2',
                ['deployed', diagramId]
            );

            // Log deployment
            await this.db.query(
                'INSERT INTO deployment_history (diagram_id, action, performed_by) VALUES ($1, $2, $3)',
                [diagramId, 'deployed', userId]
            );

            await this.db.commit();
        } catch (error) {
            await this.db.rollback();
            throw error;
        }
    },

    // Rollback to previous version
    async rollbackVersion(siteId) {
        const previousLive = await this.db.query(
            'SELECT id FROM deployment_history WHERE site_id = $1 ORDER BY timestamp DESC LIMIT 1 OFFSET 1',
            [siteId]
        );

        if (previousLive) {
            await this.deployVersion(previousLive.diagram_id);
        }
    }
};
```

---

## User Interface Redesign

### Integrated Sidebar (Replaces Popups)

```
Draw.io Editor with ArchiFlow Sidebar
┌─────────────────────────────────────────────────────────┐
│ File Edit View ... Help          NYC-DC01 | v2.5 (LIVE) │
├─────────────┬───────────────────────────────────────────┤
│             │                                            │
│ ArchiFlow   │         Drawing Canvas                     │
│ ─────────   │                                            │
│             │     ┌────┐                                 │
│ 📁 Diagram  │     │RTR1├────┬────┐                      │
│ ├ Save      │     └────┘    │    │                      │
│ ├ Deploy    │               │    │                      │
│ └ History   │     ┌────┐  ┌─┴──┐ └────┐                 │
│             │     │SW1 ├──┤FW1 │      │                 │
│ 🌐 Network  │     └────┘  └────┘   ┌──┴─┐               │
│ ├ Allocate  │                      │SW2 │               │
│ ├ IP Pools  │                      └────┘               │
│ └ VLANs     │                                            │
│             │                                            │
│ 📦 Devices  │                                            │
│ ├ Import    │                                            │
│ ├ Catalog   │                                            │
│ └ Images    │                                            │
│             │                                            │
│ 🔄 Sync     │                                            │
│ ├ Pull      │                                            │
│ └ Push      │                                            │
│             │                                            │
├─────────────┴───────────────────────────────────────────┤
│ Properties: RTR1 | IP: 10.0.0.1 | Type: Router          │
└─────────────────────────────────────────────────────────┘
```

### UI Components

#### 1. Sidebar Panel
```javascript
// Sidebar implementation
ArchiFlow.UI = {
    createSidebar: function() {
        const sidebar = document.createElement('div');
        sidebar.className = 'archiflow-sidebar';
        sidebar.style.cssText = `
            position: fixed;
            left: 0;
            top: 50px;
            width: 250px;
            height: calc(100% - 100px);
            background: var(--sidebar-bg);
            border-right: 1px solid var(--border-color);
            overflow-y: auto;
            z-index: 100;
        `;

        // Add sections
        sidebar.appendChild(this.createDiagramSection());
        sidebar.appendChild(this.createNetworkSection());
        sidebar.appendChild(this.createDeviceSection());
        sidebar.appendChild(this.createSyncSection());

        return sidebar;
    },

    createDiagramSection: function() {
        const section = this.createSection('📁 Diagram', [
            { label: 'Save Version', action: () => this.saveVersion() },
            { label: 'Deploy as Live', action: () => this.deployVersion() },
            { label: 'Version History', action: () => this.showHistory() }
        ]);
        return section;
    }
};
```

#### 2. Status Bar
```javascript
// Status bar showing site and version
ArchiFlow.StatusBar = {
    create: function() {
        const statusBar = document.createElement('div');
        statusBar.className = 'archiflow-status';
        statusBar.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 30px;
            background: var(--status-bg);
            border-top: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            padding: 0 10px;
        `;

        statusBar.innerHTML = `
            <span>Site: ${this.currentSite}</span>
            <span>Version: ${this.currentVersion}</span>
            <span class="${this.isLive ? 'live-indicator' : ''}">
                ${this.isLive ? '🟢 LIVE' : ''}
            </span>
        `;

        return statusBar;
    }
};
```

#### 3. Property Panel
```javascript
// Context-aware property inspector
ArchiFlow.PropertyPanel = {
    show: function(cell) {
        if (!cell) return;

        const panel = document.createElement('div');
        panel.className = 'property-panel';

        // Device properties
        if (cell.deviceType) {
            panel.innerHTML = `
                <h3>${cell.value}</h3>
                <label>Device Type:</label>
                <select>${this.getDeviceTypes()}</select>
                <label>IP Address:</label>
                <input type="text" value="${cell.ip || ''}" />
                <label>VLAN:</label>
                <input type="text" value="${cell.vlan || ''}" />
                <label>Image:</label>
                <button onclick="ArchiFlow.uploadImage()">Upload Photo</button>
            `;
        }

        return panel;
    }
};
```

### Keyboard Shortcuts

```javascript
// Register keyboard shortcuts
ArchiFlow.registerShortcuts = function() {
    const shortcuts = {
        'ctrl+s': () => this.saveVersion(),
        'ctrl+d': () => this.deployVersion(),
        'ctrl+i': () => this.allocateIP(),
        'ctrl+shift+i': () => this.importDevices(),
        'ctrl+h': () => this.showHistory(),
        'escape': () => this.closePanels()
    };

    document.addEventListener('keydown', (e) => {
        const key = this.getShortcutKey(e);
        if (shortcuts[key]) {
            e.preventDefault();
            shortcuts[key]();
        }
    });
};
```

---

## Device Image Support

### Image Management System

#### Upload and Storage
```javascript
// Image upload handler
ArchiFlow.ImageManager = {
    uploadImage: async function(deviceId, file) {
        // Validate file
        if (!this.validateImage(file)) {
            throw new Error('Invalid image format');
        }

        // Convert to base64
        const base64 = await this.fileToBase64(file);

        // Create thumbnail
        const thumbnail = await this.createThumbnail(base64, 150, 150);

        // Store in database
        const imageData = {
            device_id: deviceId,
            image_data: base64,
            thumbnail: thumbnail,
            image_type: 'photo',
            file_size: file.size,
            mime_type: file.type
        };

        return await this.ws.send({
            method: 'device.uploadImage',
            params: imageData
        });
    },

    // Apply image to shape
    applyImageToShape: function(cell, imageUrl) {
        const style = `shape=image;image=${imageUrl};` +
                     `verticalLabelPosition=bottom;` +
                     `verticalAlign=top;imageBackground=white;` +
                     `imageBorder=gray;`;

        cell.setStyle(style);
        this.graph.refresh(cell);
    }
};
```

#### Image Gallery
```javascript
// Device image gallery
ArchiFlow.ImageGallery = {
    show: function(deviceId) {
        const images = await this.getDeviceImages(deviceId);

        const gallery = document.createElement('div');
        gallery.className = 'image-gallery';

        images.forEach(img => {
            const thumb = document.createElement('img');
            thumb.src = img.thumbnail;
            thumb.onclick = () => this.selectImage(img);
            gallery.appendChild(thumb);
        });

        return gallery;
    }
};
```

---

## Implementation Phases

### Sprint 1: Version Management Core (Week 1-2)
**Goal:** Implement site-based version control with deployment workflow

Tasks:
- [ ] Update ArchiFlow database schema
- [ ] Create version management landing page
- [ ] Implement site selector with NetBox integration
- [ ] Build version list with filtering
- [ ] Add deploy/rollback functionality
- [ ] Create deployment history view
- [ ] Implement version comparison
- [ ] Add WebSocket handlers for version operations

### Sprint 2: UI Modernization (Week 3-4)
**Goal:** Replace popup-based UI with integrated sidebar

Tasks:
- [ ] Design and implement sidebar panel
- [ ] Create property inspector for devices
- [ ] Add status bar with site/version info
- [ ] Implement keyboard shortcuts
- [ ] Remove modal dialogs
- [ ] Create context menus
- [ ] Add dark mode support
- [ ] Implement responsive layout

### Sprint 3: Device Images (Week 5)
**Goal:** Support device photos and enhanced visualization

Tasks:
- [ ] Design image storage schema
- [ ] Implement image upload functionality
- [ ] Create thumbnail generation
- [ ] Enhance shapes to display images
- [ ] Build image gallery per device
- [ ] Add image management UI
- [ ] Implement image caching

### Sprint 4: Enhanced Integration (Week 6)
**Goal:** Complete NetBox synchronization

Tasks:
- [ ] Implement device import from NetBox
- [ ] Build bidirectional IP sync
- [ ] Add cable management sync
- [ ] Create audit trail integration
- [ ] Implement bulk operations
- [ ] Add validation engine
- [ ] Create export/import functionality

---

## Technical Requirements

### Performance Requirements
- Page load time < 3 seconds
- Version list load < 1 second
- Diagram open < 2 seconds
- WebSocket latency < 100ms
- Support 10+ concurrent users

### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Dependencies
- Draw.io 20.x
- mxGraph 4.x
- PostgreSQL 14+
- Node.js 18+
- WebSocket (ws) 8.x

### Security Requirements
- User authentication via NetBox
- Role-based access control
- Audit logging for all changes
- Encrypted WebSocket connections
- XSS protection

---

## Success Metrics

### Key Performance Indicators
1. **Version Management**
   - Clear distinction between LIVE and draft versions
   - Zero confusion about production diagram
   - < 5 seconds to deploy new version

2. **User Experience**
   - 90% reduction in popup dialogs
   - All common actions accessible via sidebar
   - Keyboard shortcuts for power users

3. **Data Integrity**
   - Zero data loss with version history
   - Complete audit trail
   - Successful rollback capability

4. **Integration**
   - 100% NetBox device import accuracy
   - Bidirectional sync without conflicts
   - Real-time collaboration support

### User Acceptance Criteria
- [ ] Users can easily identify the LIVE diagram
- [ ] Version deployment is intuitive and safe
- [ ] Site filtering works seamlessly
- [ ] Device images enhance understanding
- [ ] UI feels integrated, not bolted-on

---

## Risk Mitigation

### Technical Risks
1. **Database Performance**
   - Mitigation: Implement caching and pagination

2. **WebSocket Stability**
   - Mitigation: Auto-reconnect logic

3. **Large Diagram Handling**
   - Mitigation: Lazy loading and virtualization

### Operational Risks
1. **Accidental Deployment**
   - Mitigation: Confirmation dialogs and rollback

2. **Data Loss**
   - Mitigation: Automatic backups and version history

3. **Permission Issues**
   - Mitigation: NetBox permission integration

---

## Appendix

### Related Documents
- [TASK_TRACKER.md](./TASK_TRACKER.md) - Detailed task tracking
- [SPRINT_1_VERSION_MANAGEMENT.md](./SPRINT_1_VERSION_MANAGEMENT.md)
- [SPRINT_2_UI_MODERNIZATION.md](./SPRINT_2_UI_MODERNIZATION.md)
- [SPRINT_3_DEVICE_IMAGES.md](./SPRINT_3_DEVICE_IMAGES.md)
- [SPRINT_4_INTEGRATION.md](./SPRINT_4_INTEGRATION.md)

### References
- NetBox API Documentation
- Draw.io Plugin Development Guide
- mxGraph API Reference
- PostgreSQL JSON Functions