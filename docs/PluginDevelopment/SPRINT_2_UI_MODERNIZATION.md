# Sprint 2: UI Modernization
**Duration:** Week 3-4
**Status:** 🔴 Not Started
**Priority:** High

---

## Sprint Overview

### Objective
Replace the outdated popup-based interface with a modern, integrated sidebar UI that provides seamless access to ArchiFlow tools without disrupting the drawing workflow.

### Success Criteria
- ✅ All popups replaced with sidebar/inline UI
- ✅ Property panel shows context-aware device info
- ✅ Status bar displays current site/version
- ✅ Keyboard shortcuts for power users
- ✅ Dark mode support
- ✅ Responsive design

---

## Sidebar Implementation

### Task 2.1: Create Collapsible Sidebar
**Estimated Hours:** 6
**Dependencies:** Sprint 1 complete

#### JavaScript Implementation
```javascript
// archiflow-sidebar.js
Draw.loadPlugin(function(ui) {
    'use strict';

    // Enhanced ArchiFlow object with sidebar
    window.ArchiFlow = window.ArchiFlow || {};

    ArchiFlow.Sidebar = {
        container: null,
        isCollapsed: false,
        sections: {},

        // Initialize sidebar
        init: function() {
            this.createContainer();
            this.createSections();
            this.attachToEditor();
            this.loadState();
        },

        // Create main sidebar container
        createContainer: function() {
            this.container = document.createElement('div');
            this.container.id = 'archiflow-sidebar';
            this.container.className = 'archiflow-sidebar';

            // Add collapse button
            const collapseBtn = document.createElement('button');
            collapseBtn.className = 'sidebar-collapse-btn';
            collapseBtn.innerHTML = '◀';
            collapseBtn.onclick = () => this.toggleCollapse();

            this.container.appendChild(collapseBtn);

            // Add sections container
            const sectionsDiv = document.createElement('div');
            sectionsDiv.className = 'sidebar-sections';
            this.container.appendChild(sectionsDiv);

            document.body.appendChild(this.container);
        },

        // Create sidebar sections
        createSections: function() {
            const sectionsConfig = [
                {
                    id: 'diagram',
                    title: '📁 Diagram',
                    items: [
                        { label: 'Save Version', icon: '💾', action: 'saveVersion' },
                        { label: 'Deploy as Live', icon: '🚀', action: 'deployVersion' },
                        { label: 'Version History', icon: '📜', action: 'showHistory' },
                        { label: 'Compare Versions', icon: '🔍', action: 'compareVersions' }
                    ]
                },
                {
                    id: 'network',
                    title: '🌐 Network Tools',
                    items: [
                        { label: 'Allocate IP', icon: '🔢', action: 'allocateIP' },
                        { label: 'IP Pool Report', icon: '📊', action: 'showIPReport' },
                        { label: 'VLAN Manager', icon: '🏷️', action: 'manageVLANs' },
                        { label: 'Subnet Calculator', icon: '🧮', action: 'subnetCalc' }
                    ]
                },
                {
                    id: 'devices',
                    title: '📦 Devices',
                    items: [
                        { label: 'Import from NetBox', icon: '⬇️', action: 'importDevices' },
                        { label: 'Device Catalog', icon: '📚', action: 'showCatalog' },
                        { label: 'Upload Image', icon: '📷', action: 'uploadImage' },
                        { label: 'Templates', icon: '📋', action: 'deviceTemplates' }
                    ]
                },
                {
                    id: 'sync',
                    title: '🔄 Synchronization',
                    items: [
                        { label: 'Pull from NetBox', icon: '⬅️', action: 'pullNetBox' },
                        { label: 'Push to NetBox', icon: '➡️', action: 'pushNetBox' },
                        { label: 'Sync Status', icon: '📡', action: 'syncStatus' },
                        { label: 'Conflict Resolution', icon: '⚠️', action: 'resolveConflicts' }
                    ]
                }
            ];

            const sectionsContainer = this.container.querySelector('.sidebar-sections');

            sectionsConfig.forEach(section => {
                const sectionEl = this.createSection(section);
                sectionsContainer.appendChild(sectionEl);
                this.sections[section.id] = sectionEl;
            });
        },

        // Create individual section
        createSection: function(config) {
            const section = document.createElement('div');
            section.className = 'sidebar-section';
            section.dataset.sectionId = config.id;

            // Section header
            const header = document.createElement('div');
            header.className = 'section-header';
            header.innerHTML = `
                <span>${config.title}</span>
                <span class="section-toggle">▼</span>
            `;
            header.onclick = () => this.toggleSection(config.id);

            // Section items
            const items = document.createElement('div');
            items.className = 'section-items';

            config.items.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'sidebar-item';
                itemEl.innerHTML = `
                    <span class="item-icon">${item.icon}</span>
                    <span class="item-label">${item.label}</span>
                `;
                itemEl.onclick = () => ArchiFlow.Actions[item.action]();
                items.appendChild(itemEl);
            });

            section.appendChild(header);
            section.appendChild(items);

            return section;
        },

        // Toggle sidebar collapse
        toggleCollapse: function() {
            this.isCollapsed = !this.isCollapsed;
            this.container.classList.toggle('collapsed', this.isCollapsed);

            const btn = this.container.querySelector('.sidebar-collapse-btn');
            btn.innerHTML = this.isCollapsed ? '▶' : '◀';

            this.saveState();
        },

        // Toggle section expand/collapse
        toggleSection: function(sectionId) {
            const section = this.sections[sectionId];
            section.classList.toggle('collapsed');

            const toggle = section.querySelector('.section-toggle');
            toggle.innerHTML = section.classList.contains('collapsed') ? '▶' : '▼';

            this.saveState();
        },

        // Save sidebar state to localStorage
        saveState: function() {
            const state = {
                isCollapsed: this.isCollapsed,
                sections: {}
            };

            Object.keys(this.sections).forEach(id => {
                state.sections[id] = this.sections[id].classList.contains('collapsed');
            });

            localStorage.setItem('archiflow-sidebar-state', JSON.stringify(state));
        },

        // Load sidebar state from localStorage
        loadState: function() {
            const stateStr = localStorage.getItem('archiflow-sidebar-state');
            if (stateStr) {
                const state = JSON.parse(stateStr);

                if (state.isCollapsed) {
                    this.toggleCollapse();
                }

                Object.keys(state.sections).forEach(id => {
                    if (state.sections[id] && this.sections[id]) {
                        this.sections[id].classList.add('collapsed');
                    }
                });
            }
        }
    };

    // Initialize sidebar when plugin loads
    ArchiFlow.Sidebar.init();
});
```

#### CSS Styling
```css
/* archiflow-sidebar.css */
.archiflow-sidebar {
    position: fixed;
    left: 0;
    top: 60px; /* Below Draw.io toolbar */
    width: 280px;
    height: calc(100vh - 110px); /* Account for toolbar and status bar */
    background: var(--sidebar-bg, #ffffff);
    border-right: 1px solid var(--border-color, #e1e4e8);
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    transition: transform 0.3s ease;
    overflow-y: auto;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
    .archiflow-sidebar {
        --sidebar-bg: #1f2937;
        --border-color: #374151;
        --text-color: #e5e7eb;
        --hover-bg: #374151;
    }
}

.archiflow-sidebar.collapsed {
    transform: translateX(-240px);
}

.sidebar-collapse-btn {
    position: absolute;
    right: 10px;
    top: 10px;
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 14px;
    color: var(--text-color, #333);
    z-index: 10;
}

.sidebar-sections {
    padding: 40px 0 20px;
}

.sidebar-section {
    margin-bottom: 10px;
    border-bottom: 1px solid var(--border-color, #e1e4e8);
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    cursor: pointer;
    font-weight: 600;
    color: var(--text-color, #333);
    background: var(--header-bg, #f6f8fa);
}

.section-header:hover {
    background: var(--hover-bg, #e1e4e8);
}

.section-toggle {
    font-size: 12px;
    transition: transform 0.2s;
}

.sidebar-section.collapsed .section-items {
    display: none;
}

.section-items {
    padding: 8px 0;
}

.sidebar-item {
    display: flex;
    align-items: center;
    padding: 10px 20px;
    cursor: pointer;
    color: var(--text-color, #666);
    transition: background 0.2s;
}

.sidebar-item:hover {
    background: var(--hover-bg, #f6f8fa);
    color: var(--text-color-hover, #000);
}

.item-icon {
    margin-right: 12px;
    font-size: 16px;
}

.item-label {
    flex: 1;
    font-size: 14px;
}
```

---

## Property Panel Implementation

### Task 2.2: Context-Aware Property Inspector
**Estimated Hours:** 8
**Dependencies:** Sidebar implementation

#### JavaScript Implementation
```javascript
// archiflow-properties.js
ArchiFlow.PropertyPanel = {
    panel: null,
    currentCell: null,

    init: function() {
        this.createPanel();
        this.attachListeners();
    },

    createPanel: function() {
        this.panel = document.createElement('div');
        this.panel.id = 'archiflow-properties';
        this.panel.className = 'property-panel';
        this.panel.innerHTML = `
            <div class="property-header">
                <h3>Properties</h3>
                <button class="close-btn" onclick="ArchiFlow.PropertyPanel.hide()">×</button>
            </div>
            <div class="property-content">
                <p class="no-selection">Select a device to view properties</p>
            </div>
        `;

        document.body.appendChild(this.panel);
    },

    attachListeners: function() {
        const graph = ui.editor.graph;

        // Listen for selection changes
        graph.getSelectionModel().addListener(mxEvent.CHANGE, (sender, evt) => {
            const cells = graph.getSelectionCells();
            if (cells.length === 1) {
                this.showProperties(cells[0]);
            } else {
                this.showNoSelection();
            }
        });

        // Listen for cell changes
        graph.model.addListener(mxEvent.CHANGE, (sender, evt) => {
            if (this.currentCell) {
                this.updateProperties();
            }
        });
    },

    showProperties: function(cell) {
        this.currentCell = cell;
        const content = this.panel.querySelector('.property-content');

        // Determine cell type and show appropriate fields
        if (cell.vertex) {
            if (cell.archiflow && cell.archiflow.type === 'device') {
                content.innerHTML = this.getDeviceProperties(cell);
            } else if (cell.archiflow && cell.archiflow.type === 'network') {
                content.innerHTML = this.getNetworkProperties(cell);
            } else {
                content.innerHTML = this.getGenericProperties(cell);
            }
        } else if (cell.edge) {
            content.innerHTML = this.getConnectionProperties(cell);
        }

        this.attachPropertyHandlers();
    },

    getDeviceProperties: function(cell) {
        const data = cell.archiflow || {};
        return `
            <div class="property-group">
                <label>Device Name</label>
                <input type="text" id="prop-name" value="${cell.value || ''}" />
            </div>
            <div class="property-group">
                <label>Device Type</label>
                <select id="prop-type">
                    <option value="router" ${data.deviceType === 'router' ? 'selected' : ''}>Router</option>
                    <option value="switch" ${data.deviceType === 'switch' ? 'selected' : ''}>Switch</option>
                    <option value="firewall" ${data.deviceType === 'firewall' ? 'selected' : ''}>Firewall</option>
                    <option value="server" ${data.deviceType === 'server' ? 'selected' : ''}>Server</option>
                    <option value="loadbalancer" ${data.deviceType === 'loadbalancer' ? 'selected' : ''}>Load Balancer</option>
                </select>
            </div>
            <div class="property-group">
                <label>IP Address</label>
                <div class="input-with-button">
                    <input type="text" id="prop-ip" value="${data.ip || ''}" />
                    <button onclick="ArchiFlow.Actions.allocateIP()">Allocate</button>
                </div>
            </div>
            <div class="property-group">
                <label>VLAN</label>
                <input type="number" id="prop-vlan" value="${data.vlan || ''}" />
            </div>
            <div class="property-group">
                <label>NetBox ID</label>
                <input type="text" id="prop-netbox-id" value="${data.netboxId || ''}" readonly />
            </div>
            <div class="property-group">
                <label>Status</label>
                <select id="prop-status">
                    <option value="active" ${data.status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="planned" ${data.status === 'planned' ? 'selected' : ''}>Planned</option>
                    <option value="staging" ${data.status === 'staging' ? 'selected' : ''}>Staging</option>
                    <option value="failed" ${data.status === 'failed' ? 'selected' : ''}>Failed</option>
                    <option value="inventory" ${data.status === 'inventory' ? 'selected' : ''}>Inventory</option>
                    <option value="decommissioning" ${data.status === 'decommissioning' ? 'selected' : ''}>Decommissioning</option>
                </select>
            </div>
            <div class="property-group">
                <label>Device Image</label>
                <div class="image-preview">
                    ${data.image ? `<img src="${data.image}" />` : '<span>No image</span>'}
                </div>
                <button onclick="ArchiFlow.Actions.uploadImage()">Upload Image</button>
            </div>
            <div class="property-group">
                <label>Notes</label>
                <textarea id="prop-notes">${data.notes || ''}</textarea>
            </div>
        `;
    },

    getConnectionProperties: function(cell) {
        const data = cell.archiflow || {};
        return `
            <div class="property-group">
                <label>Connection Type</label>
                <select id="prop-conn-type">
                    <option value="ethernet" ${data.connType === 'ethernet' ? 'selected' : ''}>Ethernet</option>
                    <option value="fiber" ${data.connType === 'fiber' ? 'selected' : ''}>Fiber</option>
                    <option value="serial" ${data.connType === 'serial' ? 'selected' : ''}>Serial</option>
                    <option value="wireless" ${data.connType === 'wireless' ? 'selected' : ''}>Wireless</option>
                </select>
            </div>
            <div class="property-group">
                <label>Bandwidth</label>
                <div class="input-with-unit">
                    <input type="number" id="prop-bandwidth" value="${data.bandwidth || ''}" />
                    <select id="prop-bandwidth-unit">
                        <option value="Mbps">Mbps</option>
                        <option value="Gbps">Gbps</option>
                        <option value="Tbps">Tbps</option>
                    </select>
                </div>
            </div>
            <div class="property-group">
                <label>VLAN Trunk</label>
                <input type="checkbox" id="prop-trunk" ${data.isTrunk ? 'checked' : ''} />
            </div>
            <div class="property-group">
                <label>Allowed VLANs</label>
                <input type="text" id="prop-vlans" value="${data.allowedVlans || ''}"
                       placeholder="e.g., 10,20,30-40" />
            </div>
        `;
    },

    attachPropertyHandlers: function() {
        const inputs = this.panel.querySelectorAll('input, select, textarea');

        inputs.forEach(input => {
            input.addEventListener('change', (e) => {
                this.updateCellProperty(e.target.id.replace('prop-', ''), e.target.value);
            });
        });
    },

    updateCellProperty: function(property, value) {
        if (!this.currentCell) return;

        const graph = ui.editor.graph;
        graph.model.beginUpdate();

        try {
            if (!this.currentCell.archiflow) {
                this.currentCell.archiflow = {};
            }

            // Update specific property
            switch (property) {
                case 'name':
                    graph.model.setValue(this.currentCell, value);
                    break;
                case 'type':
                    this.currentCell.archiflow.deviceType = value;
                    this.updateCellStyle(this.currentCell, value);
                    break;
                case 'ip':
                    this.currentCell.archiflow.ip = value;
                    break;
                case 'vlan':
                    this.currentCell.archiflow.vlan = parseInt(value);
                    break;
                case 'status':
                    this.currentCell.archiflow.status = value;
                    break;
                case 'notes':
                    this.currentCell.archiflow.notes = value;
                    break;
            }

            // Send update to backend
            ArchiFlow.ws.send(JSON.stringify({
                method: 'device.updateProperties',
                params: {
                    cellId: this.currentCell.id,
                    properties: this.currentCell.archiflow
                }
            }));
        } finally {
            graph.model.endUpdate();
        }
    },

    updateCellStyle: function(cell, deviceType) {
        const styleMap = {
            'router': 'shape=mxgraph.cisco.routers.router;',
            'switch': 'shape=mxgraph.cisco.switches.switch;',
            'firewall': 'shape=mxgraph.cisco.security.firewall;',
            'server': 'shape=mxgraph.cisco.servers.standard_host;',
            'loadbalancer': 'shape=mxgraph.cisco.misc.load_balancer;'
        };

        const newStyle = styleMap[deviceType] || 'shape=rectangle;';
        ui.editor.graph.model.setStyle(cell, newStyle);
    }
};
```

#### Property Panel CSS
```css
/* archiflow-properties.css */
.property-panel {
    position: fixed;
    right: 20px;
    top: 80px;
    width: 320px;
    background: var(--panel-bg, white);
    border: 1px solid var(--border-color, #e1e4e8);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1001;
    max-height: calc(100vh - 200px);
    overflow-y: auto;
}

.property-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid var(--border-color, #e1e4e8);
    background: var(--header-bg, #f6f8fa);
    border-radius: 8px 8px 0 0;
}

.property-header h3 {
    margin: 0;
    font-size: 16px;
    color: var(--text-color, #333);
}

.close-btn {
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    font-size: 20px;
    cursor: pointer;
    color: var(--text-color, #666);
}

.property-content {
    padding: 16px;
}

.no-selection {
    text-align: center;
    color: var(--text-muted, #999);
    font-style: italic;
}

.property-group {
    margin-bottom: 16px;
}

.property-group label {
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 500;
    color: var(--label-color, #555);
}

.property-group input,
.property-group select,
.property-group textarea {
    width: 100%;
    padding: 8px;
    border: 1px solid var(--input-border, #d1d5db);
    border-radius: 4px;
    font-size: 14px;
    background: var(--input-bg, white);
    color: var(--text-color, #333);
}

.property-group textarea {
    min-height: 60px;
    resize: vertical;
}

.input-with-button {
    display: flex;
    gap: 8px;
}

.input-with-button input {
    flex: 1;
}

.input-with-button button {
    padding: 8px 12px;
    background: var(--button-bg, #3b82f6);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
}

.input-with-unit {
    display: flex;
    gap: 8px;
}

.input-with-unit input {
    flex: 1;
}

.input-with-unit select {
    width: 80px;
}

.image-preview {
    width: 100%;
    height: 120px;
    border: 1px dashed var(--border-color, #d1d5db);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
}

.image-preview img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
}

.image-preview span {
    color: var(--text-muted, #999);
    font-size: 13px;
}
```

---

## Status Bar Implementation

### Task 2.3: Create Status Bar
**Estimated Hours:** 4
**Dependencies:** None

#### JavaScript Implementation
```javascript
// archiflow-statusbar.js
ArchiFlow.StatusBar = {
    container: null,
    elements: {},

    init: function() {
        this.createStatusBar();
        this.updateStatus();
        this.startMonitoring();
    },

    createStatusBar: function() {
        this.container = document.createElement('div');
        this.container.id = 'archiflow-statusbar';
        this.container.className = 'archiflow-statusbar';
        this.container.innerHTML = `
            <div class="status-section">
                <span class="status-label">Site:</span>
                <span class="status-value" id="status-site">Not Selected</span>
            </div>
            <div class="status-section">
                <span class="status-label">Version:</span>
                <span class="status-value" id="status-version">-</span>
                <span class="status-live" id="status-live"></span>
            </div>
            <div class="status-section">
                <span class="status-label">Connection:</span>
                <span class="status-indicator" id="status-connection">
                    <span class="indicator-dot"></span>
                    <span class="indicator-text">Connecting...</span>
                </span>
            </div>
            <div class="status-section">
                <span class="status-label">Last Saved:</span>
                <span class="status-value" id="status-saved">Never</span>
            </div>
            <div class="status-section">
                <span class="status-label">Users:</span>
                <span class="status-value" id="status-users">1</span>
            </div>
        `;

        document.body.appendChild(this.container);

        // Cache element references
        this.elements = {
            site: document.getElementById('status-site'),
            version: document.getElementById('status-version'),
            live: document.getElementById('status-live'),
            connection: document.getElementById('status-connection'),
            saved: document.getElementById('status-saved'),
            users: document.getElementById('status-users')
        };
    },

    updateStatus: function(data = {}) {
        if (data.site) {
            this.elements.site.textContent = data.site;
        }

        if (data.version) {
            this.elements.version.textContent = data.version;
            this.elements.live.innerHTML = data.isLive ?
                '<span class="live-badge">🟢 LIVE</span>' : '';
        }

        if (data.connectionStatus !== undefined) {
            this.updateConnectionStatus(data.connectionStatus);
        }

        if (data.lastSaved) {
            this.elements.saved.textContent = this.formatTime(data.lastSaved);
        }

        if (data.userCount !== undefined) {
            this.elements.users.textContent = data.userCount;
        }
    },

    updateConnectionStatus: function(isConnected) {
        const indicator = this.elements.connection;
        const dot = indicator.querySelector('.indicator-dot');
        const text = indicator.querySelector('.indicator-text');

        if (isConnected) {
            dot.className = 'indicator-dot connected';
            text.textContent = 'Connected';
        } else {
            dot.className = 'indicator-dot disconnected';
            text.textContent = 'Disconnected';
        }
    },

    formatTime: function(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;

        if (diff < 60000) {
            return 'Just now';
        } else if (diff < 3600000) {
            return Math.floor(diff / 60000) + ' min ago';
        } else {
            return new Date(timestamp).toLocaleTimeString();
        }
    },

    startMonitoring: function() {
        // Update connection status based on WebSocket
        if (ArchiFlow.ws) {
            ArchiFlow.ws.addEventListener('open', () => {
                this.updateConnectionStatus(true);
            });

            ArchiFlow.ws.addEventListener('close', () => {
                this.updateConnectionStatus(false);
            });
        }

        // Auto-update last saved time
        setInterval(() => {
            if (ArchiFlow.lastSaved) {
                this.elements.saved.textContent = this.formatTime(ArchiFlow.lastSaved);
            }
        }, 30000); // Update every 30 seconds
    }
};
```

#### Status Bar CSS
```css
/* archiflow-statusbar.css */
.archiflow-statusbar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 32px;
    background: var(--statusbar-bg, #f6f8fa);
    border-top: 1px solid var(--border-color, #e1e4e8);
    display: flex;
    align-items: center;
    padding: 0 16px;
    z-index: 999;
    font-size: 13px;
}

.status-section {
    display: flex;
    align-items: center;
    margin-right: 24px;
}

.status-label {
    color: var(--label-color, #666);
    margin-right: 6px;
}

.status-value {
    color: var(--text-color, #333);
    font-weight: 500;
}

.status-live {
    margin-left: 8px;
}

.live-badge {
    display: inline-block;
    padding: 2px 6px;
    background: #10b981;
    color: white;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
}

.status-indicator {
    display: flex;
    align-items: center;
}

.indicator-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 6px;
    animation: pulse 2s infinite;
}

.indicator-dot.connected {
    background: #10b981;
}

.indicator-dot.disconnected {
    background: #ef4444;
    animation: none;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

.indicator-text {
    color: var(--text-color, #333);
}
```

---

## Keyboard Shortcuts

### Task 2.4: Implement Keyboard Shortcuts
**Estimated Hours:** 3
**Dependencies:** Actions defined

#### Implementation
```javascript
// archiflow-shortcuts.js
ArchiFlow.Shortcuts = {
    shortcuts: {
        'ctrl+s': { action: 'saveVersion', description: 'Save current version' },
        'ctrl+shift+s': { action: 'saveAsNew', description: 'Save as new version' },
        'ctrl+d': { action: 'deployVersion', description: 'Deploy as LIVE' },
        'ctrl+i': { action: 'allocateIP', description: 'Allocate IP address' },
        'ctrl+shift+i': { action: 'importDevices', description: 'Import from NetBox' },
        'ctrl+h': { action: 'showHistory', description: 'Show version history' },
        'ctrl+/': { action: 'showShortcuts', description: 'Show shortcuts help' },
        'ctrl+p': { action: 'toggleProperties', description: 'Toggle property panel' },
        'ctrl+b': { action: 'toggleSidebar', description: 'Toggle sidebar' },
        'escape': { action: 'closePanels', description: 'Close all panels' }
    },

    init: function() {
        document.addEventListener('keydown', this.handleKeydown.bind(this));
        this.addShortcutHints();
    },

    handleKeydown: function(e) {
        const key = this.getKey(e);
        const shortcut = this.shortcuts[key];

        if (shortcut && !this.isInputFocused()) {
            e.preventDefault();
            ArchiFlow.Actions[shortcut.action]();
        }
    },

    getKey: function(e) {
        const parts = [];
        if (e.ctrlKey || e.metaKey) parts.push('ctrl');
        if (e.altKey) parts.push('alt');
        if (e.shiftKey) parts.push('shift');

        let key = e.key.toLowerCase();
        if (key === ' ') key = 'space';
        if (key === 'arrowup') key = 'up';
        if (key === 'arrowdown') key = 'down';
        if (key === 'arrowleft') key = 'left';
        if (key === 'arrowright') key = 'right';

        parts.push(key);

        return parts.join('+');
    },

    isInputFocused: function() {
        const activeElement = document.activeElement;
        return activeElement.tagName === 'INPUT' ||
               activeElement.tagName === 'TEXTAREA' ||
               activeElement.tagName === 'SELECT' ||
               activeElement.contentEditable === 'true';
    },

    addShortcutHints: function() {
        // Add tooltips with shortcut info to sidebar items
        document.querySelectorAll('.sidebar-item').forEach(item => {
            const action = item.dataset.action;
            const shortcut = this.findShortcutForAction(action);

            if (shortcut) {
                item.title = `${item.textContent.trim()} (${shortcut})`;

                // Add visual hint
                const hint = document.createElement('span');
                hint.className = 'shortcut-hint';
                hint.textContent = shortcut.replace('ctrl', '⌘');
                item.appendChild(hint);
            }
        });
    },

    findShortcutForAction: function(action) {
        for (const [key, config] of Object.entries(this.shortcuts)) {
            if (config.action === action) {
                return key;
            }
        }
        return null;
    },

    showShortcutsHelp: function() {
        const content = document.createElement('div');
        content.className = 'shortcuts-help';

        let html = '<h3>Keyboard Shortcuts</h3><table>';
        for (const [key, config] of Object.entries(this.shortcuts)) {
            const displayKey = key.replace('ctrl', '⌘/Ctrl');
            html += `
                <tr>
                    <td class="shortcut-key">${displayKey}</td>
                    <td class="shortcut-desc">${config.description}</td>
                </tr>
            `;
        }
        html += '</table>';

        content.innerHTML = html;

        // Show in modal or panel
        ArchiFlow.UI.showModal('Keyboard Shortcuts', content);
    }
};
```

---

## Dark Mode Support

### Task 2.5: Implement Dark Mode
**Estimated Hours:** 2
**Dependencies:** None

#### Implementation
```javascript
// archiflow-theme.js
ArchiFlow.Theme = {
    currentTheme: 'auto',

    init: function() {
        this.loadTheme();
        this.watchSystemTheme();
        this.addThemeToggle();
    },

    loadTheme: function() {
        const saved = localStorage.getItem('archiflow-theme') || 'auto';
        this.setTheme(saved);
    },

    setTheme: function(theme) {
        this.currentTheme = theme;
        localStorage.setItem('archiflow-theme', theme);

        document.body.classList.remove('archiflow-light', 'archiflow-dark');

        if (theme === 'auto') {
            // Use system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.body.classList.add(prefersDark ? 'archiflow-dark' : 'archiflow-light');
        } else {
            document.body.classList.add(`archiflow-${theme}`);
        }

        // Update Draw.io theme if possible
        if (window.Editor && Editor.isDarkMode) {
            const isDark = theme === 'dark' ||
                          (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            Editor.isDarkMode = () => isDark;
        }
    },

    watchSystemTheme: function() {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (this.currentTheme === 'auto') {
                this.setTheme('auto'); // Reapply to update
            }
        });
    },

    addThemeToggle: function() {
        const toggle = document.createElement('button');
        toggle.className = 'theme-toggle';
        toggle.onclick = () => this.cycleTheme();
        toggle.title = 'Toggle theme';

        this.updateToggleIcon(toggle);
        document.querySelector('.archiflow-statusbar').appendChild(toggle);
    },

    cycleTheme: function() {
        const themes = ['auto', 'light', 'dark'];
        const current = themes.indexOf(this.currentTheme);
        const next = (current + 1) % themes.length;
        this.setTheme(themes[next]);
        this.updateToggleIcon();
    },

    updateToggleIcon: function(button = document.querySelector('.theme-toggle')) {
        const icons = {
            'auto': '🌗',
            'light': '☀️',
            'dark': '🌙'
        };

        if (button) {
            button.textContent = icons[this.currentTheme];
        }
    }
};
```

#### Dark Mode CSS
```css
/* Dark mode variables */
.archiflow-dark {
    --sidebar-bg: #1f2937;
    --panel-bg: #1f2937;
    --statusbar-bg: #111827;
    --header-bg: #374151;
    --border-color: #374151;
    --text-color: #e5e7eb;
    --text-muted: #9ca3af;
    --label-color: #9ca3af;
    --hover-bg: #374151;
    --input-bg: #374151;
    --input-border: #4b5563;
    --button-bg: #3b82f6;
}

.archiflow-light {
    --sidebar-bg: #ffffff;
    --panel-bg: #ffffff;
    --statusbar-bg: #f6f8fa;
    --header-bg: #f6f8fa;
    --border-color: #e1e4e8;
    --text-color: #333333;
    --text-muted: #999999;
    --label-color: #555555;
    --hover-bg: #f6f8fa;
    --input-bg: #ffffff;
    --input-border: #d1d5db;
    --button-bg: #3b82f6;
}

.theme-toggle {
    position: absolute;
    right: 16px;
    background: transparent;
    border: none;
    font-size: 18px;
    cursor: pointer;
    padding: 4px 8px;
}
```

---

## Testing Checklist

### Functional Testing
- [ ] Sidebar opens and collapses correctly
- [ ] All sidebar menu items trigger correct actions
- [ ] Property panel shows correct fields for device types
- [ ] Property changes are saved to backend
- [ ] Status bar shows accurate information
- [ ] WebSocket connection indicator works
- [ ] Keyboard shortcuts work as expected
- [ ] Dark mode toggles properly

### UI/UX Testing
- [ ] No modal popups remain (except confirmations)
- [ ] Sidebar is accessible on mobile devices
- [ ] Property panel doesn't overlap important content
- [ ] Status bar doesn't interfere with drawing
- [ ] Dark mode is readable and consistent
- [ ] Animations are smooth

### Browser Compatibility
- [ ] Chrome 90+
- [ ] Firefox 88+
- [ ] Safari 14+
- [ ] Edge 90+

### Performance Testing
- [ ] Sidebar loads instantly
- [ ] Property updates are immediate
- [ ] No lag when typing in property fields
- [ ] Theme switching is instant

---

## Integration Guide

### Adding to Draw.io Plugin
```javascript
// In archiflow-complete.js, add UI initialization
Draw.loadPlugin(function(ui) {
    // ... existing code ...

    // Initialize UI components
    ArchiFlow.Sidebar.init();
    ArchiFlow.PropertyPanel.init();
    ArchiFlow.StatusBar.init();
    ArchiFlow.Shortcuts.init();
    ArchiFlow.Theme.init();

    // Remove old popup code
    // Delete all mxWindow instances
    // Delete all modal dialog code
});
```

### CSS Loading
```html
<!-- Add to archiflow-loader.html -->
<link rel="stylesheet" href="plugins/archiflow-sidebar.css">
<link rel="stylesheet" href="plugins/archiflow-properties.css">
<link rel="stylesheet" href="plugins/archiflow-statusbar.css">
```

---

## Migration from Popups

### Popup to Sidebar Mapping
| Old Popup | New Location |
|-----------|--------------|
| Main Menu | Sidebar sections |
| IP Allocation Dialog | Property panel + Sidebar |
| Save Dialog | Sidebar > Diagram > Save |
| Device Selector | Sidebar > Devices > Catalog |
| Settings | Sidebar > Settings section |

### User Communication
- Add migration guide in documentation
- Show one-time tutorial on first load
- Include tooltips explaining new locations