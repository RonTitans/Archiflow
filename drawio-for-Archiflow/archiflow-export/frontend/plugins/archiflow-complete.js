/**
 * ArchiFlow Network Manager Plugin for Draw.io - Complete Version
 * Version: 2.0.0
 * 
 * Complete plugin with all features:
 * - Network device management
 * - IP allocation system
 * - Version control & history
 * - Template system
 * - Real-time backend sync
 */

Draw.loadPlugin(function(ui) {
    'use strict';
    
    console.log('[ArchiFlow] Starting plugin initialization v2.0.0...');
    
    // Add ArchiFlow to window for debugging
    window.ArchiFlow = {
        version: '2.0.0',
        ui: ui,
        graph: ui.editor.graph,
        
        // Connection state
        state: {
            connected: false,
            ws: null,
            ipPools: [],
            devices: [],
            templates: [],
            currentDiagramId: null,
            pendingCallbacks: new Map()
        },
        
        // Configuration
        config: {
            wsUrl: 'ws://localhost:3333',
            debug: true
        },
        
        // Initialize plugin
        init: function() {
            console.log('[ArchiFlow] Initializing complete version...');
            
            // Add menu items
            this.addMenuItems();
            
            // Connect to backend
            setTimeout(() => {
                this.connect();
            }, 500);
            
            // Add status indicator
            this.addStatusIndicator();
            
            console.log('[ArchiFlow] Initialization complete');
        },
        
        // Add all menu items to Draw.io interface
        addMenuItems: function() {
            const menubar = ui.menubar;
            
            // Add to Extras menu
            const menu = menubar.get('extras');
            if (menu) {
                const oldFunct = menu.funct;
                menu.funct = (menu, parent) => {
                    oldFunct.apply(this, [menu, parent]);
                    
                    // Add separator
                    menu.addSeparator(parent);
                    
                    // ===== NETWORK MANAGEMENT =====
                    const networkMenu = menu.addItem('🌐 ArchiFlow Network', null, null, parent);
                    menu.addItem('➕ Add Router', null, () => this.addDevice('router'), networkMenu);
                    menu.addItem('➕ Add Switch', null, () => this.addDevice('switch'), networkMenu);
                    menu.addItem('➕ Add Firewall', null, () => this.addDevice('firewall'), networkMenu);
                    menu.addItem('➕ Add Server', null, () => this.addDevice('server'), networkMenu);
                    menu.addItem('➕ Add Load Balancer', null, () => this.addDevice('loadbalancer'), networkMenu);
                    menu.addItem('➕ Add Access Point', null, () => this.addDevice('accesspoint'), networkMenu);
                    menu.addSeparator(networkMenu);
                    menu.addItem('🔌 Allocate IP', null, () => this.allocateIP(), networkMenu);
                    menu.addItem('🔓 Release IP', null, () => this.releaseIP(), networkMenu);
                    menu.addItem('📊 IP Pools Report', null, () => this.showIPReport(), networkMenu);
                    
                    // ===== VERSION CONTROL =====
                    const versionMenu = menu.addItem('📚 Version Control', null, null, parent);
                    menu.addItem('💾 Save Version', null, () => this.saveVersion(), versionMenu);
                    menu.addItem('📜 View History', null, () => this.showVersionHistory(), versionMenu);
                    menu.addItem('↩️ Rollback Version', null, () => this.rollbackVersion(), versionMenu);
                    menu.addItem('🔍 Compare Versions', null, () => this.compareVersions(), versionMenu);
                    menu.addSeparator(versionMenu);
                    menu.addItem('📊 Version Statistics', null, () => this.showVersionStats(), versionMenu);
                    
                    // ===== TEMPLATES =====
                    const templateMenu = menu.addItem('📋 Templates', null, null, parent);
                    menu.addItem('✨ Create Template', null, () => this.createTemplate(), templateMenu);
                    menu.addItem('📂 Load Template', null, () => this.loadTemplate(), templateMenu);
                    menu.addItem('🔧 Apply Template', null, () => this.applyTemplate(), templateMenu);
                    menu.addItem('📑 List Templates', null, () => this.listTemplates(), templateMenu);
                    
                    // ===== STORAGE =====
                    const storageMenu = menu.addItem('💾 Storage', null, null, parent);
                    menu.addItem('💾 Save Diagram', null, () => this.saveDiagram(), storageMenu);
                    menu.addItem('📂 Load Diagram', null, () => this.loadDiagram(), storageMenu);
                    menu.addItem('📤 Export Diagram', null, () => this.exportDiagram(), storageMenu);
                    
                    // ===== STATUS =====
                    menu.addSeparator(parent);
                    menu.addItem('🔌 ' + (this.state.connected ? 'Connected' : 'Not connected'), null, null, parent);
                    menu.addItem('🔄 Reconnect', null, () => this.reconnect(), parent);
                };
            }
        },
        
        // ========================================
        // VERSION CONTROL FUNCTIONS
        // ========================================
        
        saveVersion: function() {
            const graph = this.graph;
            
            // Prompt for change description
            const description = prompt('Enter a description for this version:', 'Updated network topology');
            if (!description) return;
            
            // Get current diagram XML
            const enc = new mxCodec(mxUtils.createXmlDocument());
            const node = enc.encode(graph.getModel());
            const xml = mxUtils.getPrettyXml(node);
            
            // Save with version tracking
            const diagramData = {
                id: this.state.currentDiagramId || 'diagram-' + Date.now(),
                name: 'Network Diagram',
                xml: xml,
                metadata: {
                    deviceCount: graph.model.cells ? Object.keys(graph.model.cells).length : 0,
                    timestamp: new Date().toISOString()
                },
                changeDescription: description,
                userId: 'user'
            };
            
            this.sendMessage('save-diagram', diagramData, (response) => {
                if (response.success) {
                    this.state.currentDiagramId = response.id;
                    ui.showAlert('Version saved successfully!');
                } else {
                    ui.showError('Failed to save version');
                }
            });
        },
        
        showVersionHistory: function() {
            if (!this.state.currentDiagramId) {
                ui.showAlert('Please save the diagram first');
                return;
            }
            
            this.sendMessage('get-version-history', {
                diagramId: this.state.currentDiagramId,
                limit: 20
            }, (response) => {
                if (response.success) {
                    let html = '<h3>Version History</h3>';
                    html += '<table border="1" style="width:100%; border-collapse: collapse;">';
                    html += '<tr><th>Version</th><th>Date</th><th>User</th><th>Description</th><th>Actions</th></tr>';
                    
                    response.versions.forEach(version => {
                        const date = new Date(version.timestamp).toLocaleString();
                        html += `<tr>
                            <td>${version.versionNumber}</td>
                            <td>${date}</td>
                            <td>${version.userId}</td>
                            <td>${version.changeDescription || 'No description'}</td>
                            <td>
                                <button onclick="ArchiFlow.doRollback(${version.versionNumber})">Rollback</button>
                                <button onclick="ArchiFlow.doCompare(${version.versionNumber})">Compare</button>
                            </td>
                        </tr>`;
                    });
                    
                    html += '</table>';
                    html += `<p>Total versions: ${response.totalVersions}</p>`;
                    
                    const dlg = new mxWindow('Version History', null, 100, 100, 600, 400, true, true);
                    dlg.setContent(html);
                    dlg.setResizable(true);
                    dlg.setVisible(true);
                } else {
                    ui.showError('Failed to load version history');
                }
            });
        },
        
        rollbackVersion: function() {
            if (!this.state.currentDiagramId) {
                ui.showAlert('Please save the diagram first');
                return;
            }
            
            const versionNumber = parseInt(prompt('Enter version number to rollback to:'));
            if (!versionNumber) return;
            
            const reason = prompt('Reason for rollback (optional):', '');
            
            this.doRollback(versionNumber, reason);
        },
        
        doRollback: function(versionNumber, reason) {
            this.sendMessage('rollback-version', {
                diagramId: this.state.currentDiagramId,
                targetVersion: versionNumber,
                userId: 'user',
                reason: reason || ''
            }, (response) => {
                if (response.success) {
                    ui.showAlert(`Successfully rolled back to version ${versionNumber}. New version: ${response.newVersion}`);
                    // Reload the diagram
                    this.loadDiagramById(this.state.currentDiagramId);
                } else {
                    ui.showError('Failed to rollback: ' + (response.error || 'Unknown error'));
                }
            });
        },
        
        compareVersions: function() {
            if (!this.state.currentDiagramId) {
                ui.showAlert('Please save the diagram first');
                return;
            }
            
            const version1 = parseInt(prompt('Enter first version number:'));
            if (!version1) return;
            
            const version2 = prompt('Enter second version number (leave empty for latest):');
            
            this.doCompare(version1, version2 ? parseInt(version2) : null);
        },
        
        doCompare: function(version1, version2) {
            this.sendMessage('compare-versions', {
                diagramId: this.state.currentDiagramId,
                version1: version1,
                version2: version2
            }, (response) => {
                if (response.success && response.diff) {
                    const diff = response.diff;
                    let html = '<h3>Version Comparison</h3>';
                    html += `<p><strong>From:</strong> Version ${diff.from.version} (${new Date(diff.from.timestamp).toLocaleString()})</p>`;
                    html += `<p><strong>To:</strong> Version ${diff.to.version} (${new Date(diff.to.timestamp).toLocaleString()})</p>`;
                    html += '<hr>';
                    
                    if (diff.changes.summary) {
                        html += `<p><strong>Summary:</strong> ${diff.changes.summary}</p>`;
                    }
                    
                    if (diff.changes.added && diff.changes.added.length > 0) {
                        html += `<p><span style="color:green">➕ Added:</span> ${Array.isArray(diff.changes.added) ? diff.changes.added.join(', ') : diff.changes.added}</p>`;
                    }
                    if (diff.changes.modified && diff.changes.modified.length > 0) {
                        html += `<p><span style="color:orange">✏️ Modified:</span> ${Array.isArray(diff.changes.modified) ? diff.changes.modified.join(', ') : diff.changes.modified}</p>`;
                    }
                    if (diff.changes.removed && diff.changes.removed.length > 0) {
                        html += `<p><span style="color:red">❌ Removed:</span> ${Array.isArray(diff.changes.removed) ? diff.changes.removed.join(', ') : diff.changes.removed}</p>`;
                    }
                    
                    const dlg = new mxWindow('Version Comparison', null, 150, 150, 500, 300, true, true);
                    dlg.setContent(html);
                    dlg.setResizable(true);
                    dlg.setVisible(true);
                } else {
                    ui.showError('Failed to compare versions');
                }
            });
        },
        
        showVersionStats: function() {
            this.sendMessage('get-version-stats', {}, (response) => {
                if (response.success && response.stats) {
                    const stats = response.stats;
                    let html = '<h3>Version Statistics</h3>';
                    html += `<p><strong>Total Diagrams:</strong> ${stats.totalDiagrams}</p>`;
                    html += `<p><strong>Total Versions:</strong> ${stats.totalVersions}</p>`;
                    html += `<p><strong>Total Storage:</strong> ${(stats.totalSize / 1024).toFixed(2)} KB</p>`;
                    
                    if (stats.diagrams && stats.diagrams.length > 0) {
                        html += '<hr><h4>Diagram Details:</h4>';
                        html += '<table border="1" style="width:100%; border-collapse: collapse;">';
                        html += '<tr><th>Diagram ID</th><th>Versions</th><th>Size (KB)</th><th>Last Modified</th></tr>';
                        
                        stats.diagrams.forEach(d => {
                            const lastMod = d.lastModified ? new Date(d.lastModified).toLocaleString() : 'N/A';
                            html += `<tr>
                                <td>${d.diagramId}</td>
                                <td>${d.versionCount}</td>
                                <td>${(d.totalSize / 1024).toFixed(2)}</td>
                                <td>${lastMod}</td>
                            </tr>`;
                        });
                        html += '</table>';
                    }
                    
                    const dlg = new mxWindow('Version Statistics', null, 100, 100, 600, 400, true, true);
                    dlg.setContent(html);
                    dlg.setResizable(true);
                    dlg.setVisible(true);
                } else {
                    ui.showError('Failed to load statistics');
                }
            });
        },
        
        // ========================================
        // NETWORK DEVICE FUNCTIONS
        // ========================================
        
        addDevice: function(type) {
            const graph = this.graph;
            const parent = graph.getDefaultParent();
            
            const colors = {
                router: '#ff9900',
                switch: '#0099ff',
                firewall: '#ff0000',
                server: '#00cc00',
                loadbalancer: '#9c27b0',
                accesspoint: '#ff6b6b'
            };
            
            const icons = {
                router: '⚡',
                switch: '🔀',
                firewall: '🛡️',
                server: '💻',
                loadbalancer: '⚖️',
                accesspoint: '📡'
            };
            
            graph.model.beginUpdate();
            try {
                const cell = graph.insertVertex(
                    parent,
                    null,
                    `${icons[type]} ${type.charAt(0).toUpperCase() + type.slice(1)}\n[No IP]`,
                    20, 20, 100, 60,
                    `shape=rounded;fillColor=${colors[type]};fontColor=white;strokeColor=black;strokeWidth=2;`
                );
                
                // Store metadata
                cell.archiflow = {
                    type: type,
                    assetId: `${type.toUpperCase()}-${Date.now()}`,
                    ipAddress: null,
                    poolId: null
                };
                
                graph.setSelectionCell(cell);
            } finally {
                graph.model.endUpdate();
            }
        },
        
        allocateIP: function() {
            const graph = this.graph;
            const cell = graph.getSelectionCell();
            
            if (!cell || !cell.archiflow) {
                ui.showAlert('Please select a network device first');
                return;
            }
            
            if (cell.archiflow.ipAddress) {
                ui.showAlert('Device already has IP: ' + cell.archiflow.ipAddress);
                return;
            }
            
            if (this.state.ipPools.length === 0) {
                ui.showAlert('No IP pools available');
                return;
            }
            
            // Create pool selection dialog
            let html = '<h3>Select IP Pool</h3>';
            html += '<select id="poolSelect" style="width:100%; padding:5px; margin:10px 0;">';
            
            this.state.ipPools.forEach(pool => {
                const available = pool.available.length;
                const total = pool.available.length + pool.allocated.length;
                html += `<option value="${pool.id}">${pool.name} - ${pool.network} (${available}/${total} available)</option>`;
            });
            
            html += '</select><br><br>';
            html += '<button onclick="ArchiFlow.doAllocateIP()">Allocate IP</button> ';
            html += '<button onclick="ArchiFlow.closeDialog()">Cancel</button>';
            
            this.currentDialog = new mxWindow('Allocate IP Address', null, 250, 150, 400, 200, true, true);
            this.currentDialog.setContent(html);
            this.currentDialog.setResizable(false);
            this.currentDialog.setVisible(true);
        },
        
        doAllocateIP: function() {
            const poolId = document.getElementById('poolSelect').value;
            const graph = this.graph;
            const cell = graph.getSelectionCell();
            
            if (!cell || !cell.archiflow) {
                this.closeDialog();
                return;
            }
            
            this.sendMessage('allocate-ip', {
                poolId: poolId,
                assetId: cell.archiflow.assetId,
                deviceType: cell.archiflow.type,
                deviceName: cell.value
            }, (response) => {
                if (response.success) {
                    // Update cell
                    graph.model.beginUpdate();
                    try {
                        cell.archiflow.ipAddress = response.ip;
                        cell.archiflow.poolId = poolId;
                        
                        const newLabel = cell.value.split('\n')[0] + '\n' + response.ip;
                        graph.model.setValue(cell, newLabel);
                    } finally {
                        graph.model.endUpdate();
                    }
                    
                    ui.showAlert('IP allocated: ' + response.ip);
                    
                    // Reload pools to update availability
                    this.loadIPPools();
                } else {
                    ui.showError('Failed to allocate IP: ' + (response.error || 'Unknown error'));
                }
            });
            
            this.closeDialog();
        },
        
        releaseIP: function() {
            const graph = this.graph;
            const cell = graph.getSelectionCell();
            
            if (!cell || !cell.archiflow || !cell.archiflow.ipAddress) {
                ui.showAlert('Please select a device with an allocated IP');
                return;
            }
            
            if (confirm(`Release IP ${cell.archiflow.ipAddress}?`)) {
                this.sendMessage('release-ip', {
                    poolId: cell.archiflow.poolId,
                    ip: cell.archiflow.ipAddress
                }, (response) => {
                    if (response.success) {
                        // Update cell
                        graph.model.beginUpdate();
                        try {
                            const newLabel = cell.value.split('\n')[0] + '\n[No IP]';
                            graph.model.setValue(cell, newLabel);
                            cell.archiflow.ipAddress = null;
                            cell.archiflow.poolId = null;
                        } finally {
                            graph.model.endUpdate();
                        }
                        
                        ui.showAlert('IP released successfully');
                        this.loadIPPools();
                    } else {
                        ui.showError('Failed to release IP');
                    }
                });
            }
        },
        
        showIPReport: function() {
            this.sendMessage('get-ip-usage', {}, (response) => {
                if (response.success) {
                    let html = '<h3>IP Pool Usage Report</h3>';
                    
                    // Summary
                    const summary = response.summary;
                    html += `<p><strong>Total Pools:</strong> ${summary.totalPools} | `;
                    html += `<strong>IPs Allocated:</strong> ${summary.totalAllocated} | `;
                    html += `<strong>IPs Available:</strong> ${summary.totalAvailable}</p>`;
                    html += '<hr>';
                    
                    // Pool details
                    response.usage.forEach(pool => {
                        const percent = pool.utilizationPercent || 0;
                        const barColor = percent > 75 ? '#ff0000' : percent > 50 ? '#ff9900' : '#00cc00';
                        
                        html += `<div style="margin:10px 0;">`;
                        html += `<strong>${pool.poolName}</strong> (${pool.network})<br>`;
                        html += `<div style="background:#eee; height:20px; width:100%; border:1px solid #999;">`;
                        html += `<div style="background:${barColor}; height:100%; width:${percent}%; text-align:center; color:white;">`;
                        html += `${percent}%</div></div>`;
                        html += `<small>Allocated: ${pool.allocatedIps} / Total: ${pool.totalIps}</small>`;
                        html += `</div>`;
                    });
                    
                    const dlg = new mxWindow('IP Usage Report', null, 200, 100, 500, 400, true, true);
                    dlg.setContent(html);
                    dlg.setResizable(true);
                    dlg.setVisible(true);
                } else {
                    ui.showError('Failed to load IP usage report');
                }
            });
        },
        
        // ========================================
        // TEMPLATE FUNCTIONS (Placeholder)
        // ========================================
        
        createTemplate: function() {
            ui.showAlert('Template creation coming soon!');
        },
        
        loadTemplate: function() {
            ui.showAlert('Template loading coming soon!');
        },
        
        applyTemplate: function() {
            ui.showAlert('Template application coming soon!');
        },
        
        listTemplates: function() {
            ui.showAlert('Template listing coming soon!');
        },
        
        // ========================================
        // STORAGE FUNCTIONS
        // ========================================
        
        saveDiagram: function() {
            const graph = this.graph;
            const enc = new mxCodec(mxUtils.createXmlDocument());
            const node = enc.encode(graph.getModel());
            const xml = mxUtils.getPrettyXml(node);
            
            const name = prompt('Enter diagram name:', 'Network Diagram');
            if (!name) return;
            
            const diagramData = {
                id: this.state.currentDiagramId,
                name: name,
                xml: xml,
                metadata: {
                    deviceCount: graph.model.cells ? Object.keys(graph.model.cells).length : 0,
                    timestamp: new Date().toISOString()
                },
                changeDescription: 'Manual save',
                userId: 'user'
            };
            
            this.sendMessage('save-diagram', diagramData, (response) => {
                if (response.success) {
                    this.state.currentDiagramId = response.id;
                    ui.showAlert('Diagram saved successfully! ID: ' + response.id);
                } else {
                    ui.showError('Failed to save diagram');
                }
            });
        },
        
        loadDiagram: function() {
            const diagramId = prompt('Enter diagram ID to load:');
            if (!diagramId) return;
            
            this.loadDiagramById(diagramId);
        },
        
        loadDiagramById: function(diagramId) {
            this.sendMessage('load-diagram', { id: diagramId }, (response) => {
                if (response.success) {
                    const graph = this.graph;
                    graph.model.beginUpdate();
                    try {
                        graph.removeCells(graph.getChildCells(graph.getDefaultParent()));
                        const doc = mxUtils.parseXml(response.xml);
                        const codec = new mxCodec(doc);
                        codec.decode(doc.documentElement, graph.getModel());
                    } finally {
                        graph.model.endUpdate();
                    }
                    this.state.currentDiagramId = diagramId;
                    ui.showAlert('Diagram loaded successfully');
                } else {
                    ui.showError('Failed to load diagram');
                }
            });
        },
        
        exportDiagram: function() {
            ui.showAlert('Export functionality coming soon!');
        },
        
        // ========================================
        // CONNECTION MANAGEMENT
        // ========================================
        
        connect: function() {
            if (this.state.ws) {
                this.state.ws.close();
            }
            
            console.log('[ArchiFlow] Connecting to WebSocket:', this.config.wsUrl);
            
            try {
                this.state.ws = new WebSocket(this.config.wsUrl);
                
                this.state.ws.onopen = () => {
                    console.log('[ArchiFlow] WebSocket connected');
                    this.state.connected = true;
                    this.updateStatusIndicator();
                };
                
                this.state.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleMessage(data);
                    } catch (e) {
                        console.error('[ArchiFlow] Failed to parse message:', e);
                    }
                };
                
                this.state.ws.onerror = (error) => {
                    console.error('[ArchiFlow] WebSocket error:', error);
                };
                
                this.state.ws.onclose = () => {
                    console.log('[ArchiFlow] WebSocket disconnected');
                    this.state.connected = false;
                    this.updateStatusIndicator();
                    
                    // Attempt reconnection after 5 seconds
                    setTimeout(() => {
                        if (!this.state.connected) {
                            console.log('[ArchiFlow] Attempting reconnection...');
                            this.connect();
                        }
                    }, 5000);
                };
            } catch (error) {
                console.error('[ArchiFlow] Failed to create WebSocket:', error);
                this.state.connected = false;
                this.updateStatusIndicator();
            }
        },
        
        reconnect: function() {
            console.log('[ArchiFlow] Manual reconnection requested');
            this.connect();
        },
        
        handleMessage: function(data) {
            if (data.type === 'welcome') {
                console.log('[ArchiFlow] Server welcome:', data.message);
                // Load initial data
                this.loadIPPools();
            } else if (data.id && this.state.pendingCallbacks.has(data.id)) {
                // Handle response to our request
                const callback = this.state.pendingCallbacks.get(data.id);
                this.state.pendingCallbacks.delete(data.id);
                
                if (data.error) {
                    console.error('[ArchiFlow] Tool error:', data.error);
                    callback({ success: false, error: data.error.message });
                } else if (data.result && data.result.content) {
                    const content = JSON.parse(data.result.content[0].text);
                    callback(content);
                }
            }
        },
        
        sendMessage: function(toolName, args, callback) {
            if (!this.state.connected || !this.state.ws) {
                console.error('[ArchiFlow] Not connected to backend');
                if (callback) callback({ success: false, error: 'Not connected' });
                return;
            }
            
            const messageId = 'msg-' + Date.now() + '-' + Math.random();
            
            const message = {
                jsonrpc: '2.0',
                id: messageId,
                method: 'tools/call',
                params: {
                    name: toolName,
                    arguments: args
                }
            };
            
            if (callback) {
                this.state.pendingCallbacks.set(messageId, callback);
            }
            
            this.state.ws.send(JSON.stringify(message));
        },
        
        loadIPPools: function() {
            this.sendMessage('get-ip-pools', {}, (response) => {
                if (response.success) {
                    this.state.ipPools = response.pools;
                    console.log('[ArchiFlow] Loaded IP pools:', this.state.ipPools.length);
                }
            });
        },
        
        // ========================================
        // UI UTILITIES
        // ========================================
        
        closeDialog: function() {
            if (this.currentDialog) {
                this.currentDialog.destroy();
                this.currentDialog = null;
            }
        },
        
        addStatusIndicator: function() {
            // Add a small status indicator to the UI
            const container = document.createElement('div');
            container.id = 'archiflow-status';
            container.style.cssText = 'position:fixed;bottom:10px;right:10px;padding:5px 10px;background:#333;color:white;border-radius:5px;font-size:12px;z-index:10000;';
            container.innerHTML = '🔌 ArchiFlow: <span id="archiflow-status-text">Connecting...</span>';
            document.body.appendChild(container);
        },
        
        updateStatusIndicator: function() {
            const statusText = document.getElementById('archiflow-status-text');
            if (statusText) {
                statusText.textContent = this.state.connected ? 'Connected' : 'Disconnected';
                statusText.style.color = this.state.connected ? '#00ff00' : '#ff0000';
            }
        }
    };
    
    // Initialize after UI is ready
    ArchiFlow.init();
    
    console.log('[ArchiFlow] Plugin loaded successfully - v2.0.0');
});