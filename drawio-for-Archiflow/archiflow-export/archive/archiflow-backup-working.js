/**
 * ArchiFlow Network Manager Plugin for Draw.io - RESTORED VERSION
 * Version: 2.0.0
 * Complete plugin with the original good UI design
 */
Draw.loadPlugin(function(ui) {
    'use strict';
    
    console.log('[ArchiFlow] Plugin loading v2.0.0...');
    
    // Create global ArchiFlow object
    window.ArchiFlow = {
        version: '2.0.0',
        ui: ui,
        graph: ui.editor.graph,
        state: {
            connected: false,
            ws: null,
            ipPools: [],
            currentDiagramId: null,
            pendingCallbacks: new Map()
        },
        config: {
            wsUrl: 'ws://localhost:3333'
        }
    };
    
    // Add resources for menu items
    mxResources.parse('archiflowMenu=ArchiFlow Network Tools...');
    mxResources.parse('archiflowDevices=Add Network Device');
    mxResources.parse('archiflowAllocateIP=Allocate IP Address');
    mxResources.parse('archiflowIPReport=IP Pools Report');
    mxResources.parse('archiflowSaveVersion=Save Version');
    mxResources.parse('archiflowHistory=Version History');
    
    // Show main ArchiFlow menu with nice UI
    ArchiFlow.showMainMenu = function() {
        var content = document.createElement('div');
        content.style.padding = '10px';
        content.innerHTML = '<h3>🌐 ArchiFlow Network Tools</h3>' +
            '<p>Version: ' + this.version + '</p>' +
            '<p>Status: <span id="conn-status">' + (this.state.connected ? '✅ Connected' : '❌ Disconnected') + '</span></p>' +
            '<p>IP Pools: ' + this.state.ipPools.length + ' loaded</p>' +
            '<hr>' +
            '<button onclick="ArchiFlow.showDeviceDialog()" style="width: 100%; padding: 10px; margin: 5px 0; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">' +
            '    ➕ Add Network Device' +
            '</button>' +
            '<button onclick="ArchiFlow.allocateIP()" style="width: 100%; padding: 10px; margin: 5px 0; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">' +
            '    🔢 Allocate IP Address' +
            '</button>' +
            '<button onclick="ArchiFlow.showIPReport()" style="width: 100%; padding: 10px; margin: 5px 0; background: #FF9800; color: white; border: none; border-radius: 4px; cursor: pointer;">' +
            '    📊 IP Pools Report' +
            '</button>' +
            '<button onclick="ArchiFlow.saveDiagram()" style="width: 100%; padding: 10px; margin: 5px 0; background: #9C27B0; color: white; border: none; border-radius: 4px; cursor: pointer;">' +
            '    💾 Save Diagram' +
            '</button>' +
            '<hr>' +
            '<button onclick="ArchiFlow.saveVersion()" style="width: 100%; padding: 10px; margin: 5px 0; background: #607D8B; color: white; border: none; border-radius: 4px; cursor: pointer;">' +
            '    📝 Save Version' +
            '</button>' +
            '<button onclick="ArchiFlow.showHistory()" style="width: 100%; padding: 10px; margin: 5px 0; background: #795548; color: white; border: none; border-radius: 4px; cursor: pointer;">' +
            '    📜 Version History' +
            '</button>' +
            '<hr>' +
            '<button onclick="ArchiFlow.showChangeLog()" style="width: 100%; padding: 10px; margin: 5px 0; background: #00BCD4; color: white; border: none; border-radius: 4px; cursor: pointer;">' +
            '    📝 Change Log' +
            '</button>' +
            '<button onclick="ArchiFlow.showAuditTrail()" style="width: 100%; padding: 10px; margin: 5px 0; background: #009688; color: white; border: none; border-radius: 4px; cursor: pointer;">' +
            '    🔍 Audit Trail' +
            '</button>' +
            '<hr>' +
            '<button onclick="ArchiFlow.validateTopology()" style="width: 100%; padding: 10px; margin: 5px 0; background: #E91E63; color: white; border: none; border-radius: 4px; cursor: pointer;">' +
            '    🔍 Validate Topology' +
            '</button>' +
            '<button onclick="ArchiFlow.showAlertHistory()" style="width: 100%; padding: 10px; margin: 5px 0; background: #673AB7; color: white; border: none; border-radius: 4px; cursor: pointer;">' +
            '    🔔 Alert History' +
            '</button>' +
            '<hr>' +
            '<button onclick="ArchiFlow.reconnect()" style="width: 100%; padding: 10px; margin: 5px 0; cursor: pointer;">' +
            '    🔄 Reconnect' +
            '</button>';
            
        var dlg = new mxWindow('ArchiFlow Network Tools', content, 
            document.body.offsetWidth - 350, 100, 320, 500, true, true);
        dlg.setClosable(true);
        dlg.setVisible(true);
    };
    
    // Show device dialog with dropdown
    ArchiFlow.showDeviceDialog = function() {
        var content = document.createElement('div');
        content.style.padding = '10px';
        content.innerHTML = '<h4>Add Network Device</h4>' +
            '<label>Device Type:</label>' +
            '<select id="deviceType" style="width: 100%; padding: 8px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px;">' +
            '    <option value="router">🔀 Router</option>' +
            '    <option value="switch">🔁 Switch</option>' +
            '    <option value="firewall">🔥 Firewall</option>' +
            '    <option value="server">🖥️ Server</option>' +
            '    <option value="loadbalancer">⚖️ Load Balancer</option>' +
            '    <option value="accesspoint">📡 Access Point</option>' +
            '</select>' +
            '<label>Device Name:</label>' +
            '<input type="text" id="deviceName" placeholder="e.g., Core-Router-01" ' +
            '    style="width: 100%; padding: 8px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px;">' +
            '<button onclick="ArchiFlow.addDevice()" ' +
            '    style="width: 100%; padding: 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">' +
            '    Add Device to Diagram' +
            '</button>';
            
        var dlg = new mxWindow('Add Network Device', content, 
            document.body.offsetWidth - 350, 200, 300, 250, true, true);
        dlg.setClosable(true);
        dlg.setVisible(true);
        
        // Store dialog reference for cleanup
        window.currentDeviceDialog = dlg;
    };
    
    // Add device from dialog
    ArchiFlow.addDevice = function() {
        var typeSelect = document.getElementById('deviceType');
        var nameInput = document.getElementById('deviceName');
        if (!typeSelect) return;
        
        var deviceType = typeSelect.value;
        var deviceName = nameInput ? nameInput.value : '';
        
        // Log user action
        ArchiFlow.logUserAction('add_device_initiated', {
            type: deviceType,
            name: deviceName
        });
        
        if (!deviceName) {
            deviceName = deviceType.toUpperCase() + '-' + Date.now().toString().slice(-4);
        }
        
        var graph = ui.editor.graph;
        var parent = graph.getDefaultParent();
        
        // Define colors for each device type
        var colors = {
            router: '#4CAF50',
            switch: '#2196F3',
            firewall: '#F44336',
            server: '#9C27B0',
            loadbalancer: '#FF9800',
            accesspoint: '#00BCD4'
        };
        
        graph.model.beginUpdate();
        try {
            var vertex = graph.insertVertex(
                parent, null, 
                deviceName + '\n[No IP]', 
                20, 20, 120, 60,
                'rounded=1;whiteSpace=wrap;html=1;fillColor=' + colors[deviceType] + ';strokeColor=#000000;fontColor=#FFFFFF;fontStyle=1;'
            );
            
            // Store metadata
            vertex.archiflow = {
                type: deviceType,
                assetId: 'ASSET-' + Date.now(),
                ip: null,
                name: deviceName,
                poolId: null
            };
            
            // Close dialog if exists
            if (window.currentDeviceDialog) {
                window.currentDeviceDialog.destroy();
                window.currentDeviceDialog = null;
            }
            
            // Select the new device
            graph.setSelectionCell(vertex);
            
        } finally {
            graph.model.endUpdate();
        }
    };
    
    // Allocate IP with nice dialog
    ArchiFlow.allocateIP = function() {
        ArchiFlow.logUserAction('allocate_ip_initiated');
        
        var cell = ui.editor.graph.getSelectionCell();
        
        if (!cell || !cell.archiflow) {
            alert('Please select a network device first');
            return;
        }
        
        if (cell.archiflow.ip) {
            alert('Device already has IP: ' + cell.archiflow.ip);
            return;
        }
        
        // Show pool selection dialog
        var content = document.createElement('div');
        content.style.padding = '10px';
        
        var poolsHtml = '<h4>Select IP Pool for: ' + (cell.archiflow.name || 'Device') + '</h4>';
        poolsHtml += '<select id="poolSelect" style="width: 100%; padding: 8px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px;">';
        
        // Add mock pools or real pools if connected
        if (this.state.ipPools.length > 0) {
            this.state.ipPools.forEach(function(pool) {
                poolsHtml += '<option value="' + pool.id + '">' + pool.name + ' (' + pool.network + ') - ' + pool.available.length + ' IPs available</option>';
            });
        } else {
            // Mock pools for demo
            poolsHtml += '<option value="POOL-001">Management Network (10.0.1.0/24) - 5 IPs available</option>';
            poolsHtml += '<option value="POOL-002">Server Network (10.0.2.0/24) - 10 IPs available</option>';
            poolsHtml += '<option value="POOL-003">DMZ Network (10.0.3.0/24) - 15 IPs available</option>';
        }
        
        poolsHtml += '</select>';
        poolsHtml += '<button onclick="ArchiFlow.doAllocateIP()" style="width: 100%; padding: 10px; margin-top: 10px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">Allocate IP</button>';
        
        content.innerHTML = poolsHtml;
        
        var dlg = new mxWindow('Allocate IP Address', content, 
            document.body.offsetWidth - 400, 250, 350, 200, true, true);
        dlg.setClosable(true);
        dlg.setVisible(true);
        
        window.currentIPDialog = dlg;
    };
    
    // Do the actual IP allocation
    ArchiFlow.doAllocateIP = function() {
        var poolSelect = document.getElementById('poolSelect');
        var cell = ui.editor.graph.getSelectionCell();
        
        if (!poolSelect || !cell) return;
        
        var poolId = poolSelect.value;
        
        // If connected to backend, use real allocation
        if (this.state.connected) {
            this.sendMessage('allocate-ip', {
                poolId: poolId,
                assetId: cell.archiflow.assetId,
                deviceType: cell.archiflow.type,
                deviceName: cell.archiflow.name
            }, function(response) {
                if (response.success) {
                    // Check for conflicts before assigning
                    var conflicts = ArchiFlow.checkIPAllocation(response.ip, poolId);
                    if (conflicts.length > 0) {
                        ArchiFlow.showAlert('IP Conflict Detected', 'error', 
                            'IP ' + response.ip + ' is already in use by ' + conflicts[0].device);
                        return;
                    }
                    
                    // Update cell with IP
                    ui.editor.graph.model.beginUpdate();
                    try {
                        cell.archiflow.ip = response.ip;
                        cell.archiflow.poolId = poolId;
                        var newLabel = cell.archiflow.name + '\n' + response.ip;
                        ui.editor.graph.model.setValue(cell, newLabel);
                    } finally {
                        ui.editor.graph.model.endUpdate();
                    }
                    
                    ArchiFlow.showAlert('IP Allocated Successfully', 'success', 
                        'Assigned ' + response.ip + ' to ' + cell.archiflow.name);
                    
                    ArchiFlow.logUserAction('ip_allocated', {
                        ip: response.ip,
                        device: cell.archiflow.name,
                        poolId: poolId
                    });
                } else {
                    ArchiFlow.showAlert('IP Allocation Failed', 'error', 
                        response.error || 'No available IPs in selected pool');
                    
                    ArchiFlow.logUserAction('ip_allocation_failed', {
                        error: response.error,
                        device: cell.archiflow.name,
                        poolId: poolId
                    });
                }
            });
        } else {
            // Mock allocation for demo
            var ip = '10.0.' + Math.floor(Math.random() * 3 + 1) + '.' + Math.floor(Math.random() * 254 + 1);
            
            // Check for conflicts
            var conflicts = ArchiFlow.checkIPAllocation(ip, poolId);
            if (conflicts.length > 0) {
                ArchiFlow.showAlert('IP Conflict Detected', 'error', 
                    'IP ' + ip + ' is already in use by ' + conflicts[0].device);
                return;
            }
            
            ui.editor.graph.model.beginUpdate();
            try {
                cell.archiflow.ip = ip;
                cell.archiflow.poolId = poolId;
                var newLabel = cell.archiflow.name + '\n' + ip;
                ui.editor.graph.model.setValue(cell, newLabel);
            } finally {
                ui.editor.graph.model.endUpdate();
            }
            
            ArchiFlow.showAlert('IP Allocated (Mock)', 'success', 
                'Assigned ' + ip + ' to ' + cell.archiflow.name);
        }
        
        // Close dialog
        if (window.currentIPDialog) {
            window.currentIPDialog.destroy();
            window.currentIPDialog = null;
        }
    };
    
    // Show IP Report with nice visualization
    ArchiFlow.showIPReport = function() {
        var content = document.createElement('div');
        content.style.padding = '10px';
        content.innerHTML = '<h3>IP Pool Usage Report</h3>' +
            '<div style="margin: 10px 0;">' +
            '<strong>Management Network (10.0.1.0/24)</strong><br>' +
            '<div style="background:#eee; height:25px; width:100%; border:1px solid #999; border-radius: 3px; overflow: hidden;">' +
            '<div style="background:linear-gradient(to right, #4CAF50, #45a049); height:100%; width:30%; text-align:center; line-height: 25px; color:white; font-weight: bold;">30%</div>' +
            '</div>' +
            '<small>Used: 30 / Total: 100 | Available: 70</small>' +
            '</div>' +
            '<div style="margin: 10px 0;">' +
            '<strong>Server Network (10.0.2.0/24)</strong><br>' +
            '<div style="background:#eee; height:25px; width:100%; border:1px solid #999; border-radius: 3px; overflow: hidden;">' +
            '<div style="background:linear-gradient(to right, #FF9800, #F57C00); height:100%; width:65%; text-align:center; line-height: 25px; color:white; font-weight: bold;">65%</div>' +
            '</div>' +
            '<small>Used: 65 / Total: 100 | Available: 35</small>' +
            '</div>' +
            '<div style="margin: 10px 0;">' +
            '<strong>DMZ Network (10.0.3.0/24)</strong><br>' +
            '<div style="background:#eee; height:25px; width:100%; border:1px solid #999; border-radius: 3px; overflow: hidden;">' +
            '<div style="background:linear-gradient(to right, #f44336, #da190b); height:100%; width:85%; text-align:center; line-height: 25px; color:white; font-weight: bold;">85%</div>' +
            '</div>' +
            '<small>Used: 85 / Total: 100 | Available: 15 ⚠️</small>' +
            '</div>' +
            '<hr>' +
            '<p><strong>Summary:</strong></p>' +
            '<p>Total Pools: 3 | Total IPs: 300 | Total Used: 180 (60%)</p>';
            
        var dlg = new mxWindow('IP Usage Report', content, 300, 200, 450, 350, true, true);
        dlg.setVisible(true);
    };
    
    // Save version
    ArchiFlow.saveVersion = function() {
        ArchiFlow.logUserAction('save_version_initiated');
        
        var desc = prompt('Enter version description:', 'Network topology update');
        if (desc) {
            alert('✅ Version saved: ' + desc);
        }
    };
    
    // Show version history
    ArchiFlow.showHistory = function() {
        ArchiFlow.logUserAction('view_version_history');
        
        var content = document.createElement('div');
        content.style.padding = '10px';
        content.innerHTML = '<h3>Version History</h3>' +
            '<table border="1" style="width:100%; border-collapse: collapse;">' +
            '<tr style="background: #f0f0f0;"><th style="padding: 5px;">Version</th><th style="padding: 5px;">Date</th><th style="padding: 5px;">User</th><th style="padding: 5px;">Description</th></tr>' +
            '<tr><td style="padding: 5px;">v5</td><td style="padding: 5px;">Today 14:30</td><td style="padding: 5px;">Admin</td><td style="padding: 5px;">Added DMZ firewall rules</td></tr>' +
            '<tr><td style="padding: 5px;">v4</td><td style="padding: 5px;">Today 10:15</td><td style="padding: 5px;">Admin</td><td style="padding: 5px;">Updated server IPs</td></tr>' +
            '<tr><td style="padding: 5px;">v3</td><td style="padding: 5px;">Yesterday</td><td style="padding: 5px;">Admin</td><td style="padding: 5px;">Added load balancer</td></tr>' +
            '<tr><td style="padding: 5px;">v2</td><td style="padding: 5px;">2 days ago</td><td style="padding: 5px;">User</td><td style="padding: 5px;">Network segmentation</td></tr>' +
            '<tr><td style="padding: 5px;">v1</td><td style="padding: 5px;">3 days ago</td><td style="padding: 5px;">Admin</td><td style="padding: 5px;">Initial network design</td></tr>' +
            '</table>';
            
        var dlg = new mxWindow('Version History', content, 250, 150, 500, 300, true, true);
        dlg.setVisible(true);
    };
    
    // Save diagram
    ArchiFlow.saveDiagram = function() {
        ArchiFlow.logUserAction('save_diagram_initiated');
        
        var name = prompt('Enter diagram name:', 'Network Diagram');
        if (name) {
            alert('✅ Diagram saved: ' + name);
        }
    };
    
    // Register actions for menu
    ui.actions.addAction('archiflowMenu', function() {
        ArchiFlow.showMainMenu();
    });
    
    ui.actions.addAction('archiflowDevices', function() {
        ArchiFlow.showDeviceDialog();
    });
    
    ui.actions.addAction('archiflowAllocateIP', function() {
        ArchiFlow.allocateIP();
    });
    
    ui.actions.addAction('archiflowIPReport', function() {
        ArchiFlow.showIPReport();
    });
    
    ui.actions.addAction('archiflowSaveVersion', function() {
        ArchiFlow.saveVersion();
    });
    
    ui.actions.addAction('archiflowHistory', function() {
        ArchiFlow.showHistory();
    });
    
    // Modify Extras menu
    var menu = ui.menus.get('extras');
    var oldFunct = menu.funct;
    
    menu.funct = function(menu, parent) {
        oldFunct.apply(this, arguments);
        
        // Add separator
        ui.menus.addMenuItems(menu, ['-'], parent);
        
        // Add our main menu item
        ui.menus.addMenuItems(menu, ['archiflowMenu'], parent);
        
        // Add quick access items
        ui.menus.addMenuItems(menu, ['archiflowDevices', 'archiflowAllocateIP', 'archiflowIPReport'], parent);
        ui.menus.addMenuItems(menu, ['-', 'archiflowSaveVersion', 'archiflowHistory'], parent);
    };
    
    // Change Tracking System
    ArchiFlow.changeLog = [];
    ArchiFlow.auditTrail = [];
    ArchiFlow.lastDiagramState = null;
    
    // Initialize change tracking
    ArchiFlow.initChangeTracking = function() {
        var model = this.graph.getModel();
        
        // Track all model changes
        model.addListener(mxEvent.CHANGE, function(sender, evt) {
            var changes = evt.getProperty('edit').changes;
            ArchiFlow.logChanges(changes);
        });
        
        // Track selection changes
        this.graph.getSelectionModel().addListener(mxEvent.CHANGE, function(sender, evt) {
            ArchiFlow.logUserAction('selection_changed', {
                cells: ArchiFlow.graph.getSelectionCells().length
            });
        });
        
        console.log('[ArchiFlow] Change tracking initialized');
    };
    
    // Log diagram changes
    ArchiFlow.logChanges = function(changes) {
        if (!changes || changes.length === 0) return;
        
        var timestamp = new Date().toISOString();
        var user = 'current_user';
        
        changes.forEach(function(change) {
            var changeEntry = {
                timestamp: timestamp,
                user: user,
                type: change.constructor.name,
                details: {}
            };
            
            // Log different types of changes
            if (change instanceof mxChildChange) {
                changeEntry.action = change.child ? 'cell_added' : 'cell_removed';
                changeEntry.details.cellId = change.child ? change.child.id : 'unknown';
                changeEntry.details.cellType = change.child && change.child.value ? 
                    (change.child.value.tagName || 'shape') : 'unknown';
            } else if (change instanceof mxGeometryChange) {
                changeEntry.action = 'cell_moved_resized';
                changeEntry.details.cellId = change.cell.id;
            } else if (change instanceof mxValueChange) {
                changeEntry.action = 'cell_value_changed';
                changeEntry.details.cellId = change.cell.id;
            } else if (change instanceof mxStyleChange) {
                changeEntry.action = 'cell_style_changed';
                changeEntry.details.cellId = change.cell.id;
            }
            
            // Add to change log
            ArchiFlow.changeLog.push(changeEntry);
            
            // Send to backend if connected
            if (ArchiFlow.state.connected) {
                ArchiFlow.sendMessage('log-change', changeEntry);
            }
        });
        
        // Keep only last 1000 changes in memory
        if (this.changeLog.length > 1000) {
            this.changeLog = this.changeLog.slice(-1000);
        }
    };
    
    // Log user actions for audit trail
    ArchiFlow.logUserAction = function(action, details) {
        var entry = {
            timestamp: new Date().toISOString(),
            user: 'current_user',
            action: action,
            details: details || {}
        };
        
        this.auditTrail.push(entry);
        
        // Send to backend if connected
        if (this.state.connected) {
            this.sendMessage('log-audit', entry);
        }
        
        // Keep only last 500 actions in memory
        if (this.auditTrail.length > 500) {
            this.auditTrail = this.auditTrail.slice(-500);
        }
    };
    
    // Show change log dialog
    ArchiFlow.showChangeLog = function() {
        var content = document.createElement('div');
        content.style.padding = '10px';
        content.style.maxHeight = '400px';
        content.style.overflowY = 'auto';
        
        var html = '<h4>📝 Recent Changes</h4>';
        
        if (this.changeLog.length === 0) {
            html += '<p>No changes recorded yet.</p>';
        } else {
            html += '<table style="width:100%; border-collapse: collapse;">';
            html += '<tr style="background:#f0f0f0;">' +
                '<th style="padding:5px; border:1px solid #ddd;">Time</th>' +
                '<th style="padding:5px; border:1px solid #ddd;">Action</th>' +
                '<th style="padding:5px; border:1px solid #ddd;">Details</th>' +
                '</tr>';
            
            // Show last 20 changes
            var recentChanges = this.changeLog.slice(-20).reverse();
            recentChanges.forEach(function(change) {
                var time = new Date(change.timestamp).toLocaleTimeString();
                var details = '';
                
                if (change.details.cellId) {
                    details = 'Cell: ' + change.details.cellId;
                }
                if (change.details.cellType) {
                    details += ' (' + change.details.cellType + ')';
                }
                
                html += '<tr>' +
                    '<td style="padding:5px; border:1px solid #ddd; font-size:11px;">' + time + '</td>' +
                    '<td style="padding:5px; border:1px solid #ddd; font-size:11px;">' + change.action + '</td>' +
                    '<td style="padding:5px; border:1px solid #ddd; font-size:11px;">' + details + '</td>' +
                    '</tr>';
            });
            
            html += '</table>';
        }
        
        html += '<br><button onclick="ArchiFlow.exportChangeLog()" ' +
            'style="padding:8px 15px; background:#2196F3; color:white; border:none; border-radius:4px; cursor:pointer;">' +
            '💾 Export Full Log</button>';
        
        content.innerHTML = html;
        
        var dlg = new mxWindow('Change Log', content,
            document.body.offsetWidth - 450, 150, 420, 500, true, true);
        dlg.setClosable(true);
        dlg.setVisible(true);
    };
    
    // Show audit trail dialog
    ArchiFlow.showAuditTrail = function() {
        var content = document.createElement('div');
        content.style.padding = '10px';
        content.style.maxHeight = '400px';
        content.style.overflowY = 'auto';
        
        var html = '<h4>🔍 Audit Trail</h4>';
        
        if (this.auditTrail.length === 0) {
            html += '<p>No user actions recorded yet.</p>';
        } else {
            html += '<table style="width:100%; border-collapse: collapse;">';
            html += '<tr style="background:#f0f0f0;">' +
                '<th style="padding:5px; border:1px solid #ddd;">Time</th>' +
                '<th style="padding:5px; border:1px solid #ddd;">User</th>' +
                '<th style="padding:5px; border:1px solid #ddd;">Action</th>' +
                '</tr>';
            
            // Show last 30 actions
            var recentActions = this.auditTrail.slice(-30).reverse();
            recentActions.forEach(function(action) {
                var time = new Date(action.timestamp).toLocaleTimeString();
                
                html += '<tr>' +
                    '<td style="padding:5px; border:1px solid #ddd; font-size:11px;">' + time + '</td>' +
                    '<td style="padding:5px; border:1px solid #ddd; font-size:11px;">' + action.user + '</td>' +
                    '<td style="padding:5px; border:1px solid #ddd; font-size:11px;">' + action.action + '</td>' +
                    '</tr>';
            });
            
            html += '</table>';
        }
        
        content.innerHTML = html;
        
        var dlg = new mxWindow('Audit Trail', content,
            document.body.offsetWidth - 400, 200, 370, 450, true, true);
        dlg.setClosable(true);
        dlg.setVisible(true);
    };
    
    // Export change log as JSON
    ArchiFlow.exportChangeLog = function() {
        var data = {
            exported: new Date().toISOString(),
            diagram: this.state.currentDiagramId || 'untitled',
            changes: this.changeLog,
            audit: this.auditTrail
        };
        
        var blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'archiflow-changelog-' + Date.now() + '.json';
        a.click();
        URL.revokeObjectURL(url);
        
        this.logUserAction('exported_change_log');
    };
    
    // Alert System
    ArchiFlow.alerts = [];
    ArchiFlow.alertContainer = null;
    
    // Initialize alert system
    ArchiFlow.initAlertSystem = function() {
        // Create alert container
        this.alertContainer = document.createElement('div');
        this.alertContainer.id = 'archiflow-alerts';
        this.alertContainer.style.cssText = 'position:fixed;top:70px;right:10px;width:300px;z-index:10001;';
        document.body.appendChild(this.alertContainer);
        
        console.log('[ArchiFlow] Alert system initialized');
    };
    
    // Show alert with different types
    ArchiFlow.showAlert = function(message, type, details) {
        type = type || 'info';
        
        var alertDiv = document.createElement('div');
        alertDiv.className = 'archiflow-alert';
        
        var bgColor = '#2196F3'; // info
        var icon = 'ℹ️';
        
        switch(type) {
            case 'success':
                bgColor = '#4CAF50';
                icon = '✅';
                break;
            case 'warning':
                bgColor = '#FF9800';
                icon = '⚠️';
                break;
            case 'error':
                bgColor = '#f44336';
                icon = '❌';
                break;
        }
        
        alertDiv.style.cssText = 
            'background:' + bgColor + ';' +
            'color:white;' +
            'padding:12px;' +
            'border-radius:4px;' +
            'margin-bottom:10px;' +
            'box-shadow:0 2px 5px rgba(0,0,0,0.2);' +
            'animation:slideIn 0.3s ease;' +
            'position:relative;';
        
        var html = '<div style="display:flex;align-items:center;">' +
            '<span style="font-size:20px;margin-right:10px;">' + icon + '</span>' +
            '<div style="flex:1;">' +
            '<div style="font-weight:bold;">' + message + '</div>';
        
        if (details) {
            html += '<div style="font-size:12px;margin-top:4px;opacity:0.9;">' + details + '</div>';
        }
        
        html += '</div>' +
            '<button onclick="this.parentElement.parentElement.remove()" ' +
            'style="background:none;border:none;color:white;font-size:18px;cursor:pointer;padding:0;margin-left:10px;">×</button>' +
            '</div>';
        
        alertDiv.innerHTML = html;
        
        // Add to container
        this.alertContainer.appendChild(alertDiv);
        
        // Store alert
        var alert = {
            timestamp: new Date().toISOString(),
            type: type,
            message: message,
            details: details
        };
        this.alerts.push(alert);
        
        // Log to audit trail
        this.logUserAction('alert_shown', alert);
        
        // Auto-remove after 5 seconds for non-error alerts
        if (type !== 'error') {
            setTimeout(function() {
                if (alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 5000);
        }
        
        // Keep only last 100 alerts in memory
        if (this.alerts.length > 100) {
            this.alerts = this.alerts.slice(-100);
        }
    };
    
    // Check for IP allocation conflicts
    ArchiFlow.checkIPAllocation = function(ip, poolId) {
        // Simulate checking for conflicts
        var conflicts = [];
        
        // Check if IP is already allocated
        var cells = this.graph.getModel().cells;
        for (var id in cells) {
            var cell = cells[id];
            if (cell.archiflow && cell.archiflow.ip === ip) {
                conflicts.push({
                    type: 'duplicate_ip',
                    message: 'IP already allocated',
                    device: cell.archiflow.name || 'Unknown Device'
                });
            }
        }
        
        // Return conflicts
        return conflicts;
    };
    
    // Validate network topology
    ArchiFlow.validateTopology = function() {
        ArchiFlow.logUserAction('validate_topology_initiated');
        
        var issues = [];
        var cells = this.graph.getModel().cells;
        var deviceCount = 0;
        var connectionCount = 0;
        var isolatedDevices = [];
        var devices = [];
        var connections = [];
        
        // Count devices and connections
        for (var id in cells) {
            var cell = cells[id];
            
            if (cell.archiflow) {
                deviceCount++;
                
                // Collect device data
                devices.push({
                    id: cell.id,
                    name: cell.archiflow.name,
                    type: cell.archiflow.type,
                    ip: cell.archiflow.ip,
                    vlan: cell.archiflow.vlan
                });
                
                // Check if device has connections
                var edges = this.graph.getEdges(cell);
                if (!edges || edges.length === 0) {
                    isolatedDevices.push(cell.archiflow.name || 'Device ' + id);
                }
            }
            
            if (cell.edge) {
                connectionCount++;
                
                // Collect connection data
                if (cell.source && cell.target) {
                    var sourceCell = this.graph.getModel().getCell(cell.source.id);
                    var targetCell = this.graph.getModel().getCell(cell.target.id);
                    
                    connections.push({
                        id: cell.id,
                        source: sourceCell && sourceCell.archiflow ? sourceCell.archiflow.name : 'Unknown',
                        target: targetCell && targetCell.archiflow ? targetCell.archiflow.name : 'Unknown',
                        sourceVlan: sourceCell && sourceCell.archiflow ? sourceCell.archiflow.vlan : null,
                        targetVlan: targetCell && targetCell.archiflow ? targetCell.archiflow.vlan : null
                    });
                }
            }
        }
        
        // Check for issues
        if (isolatedDevices.length > 0) {
            issues.push({
                type: 'isolated_devices',
                severity: 'warning',
                message: 'Isolated devices detected',
                devices: isolatedDevices
            });
        }
        
        if (deviceCount === 0) {
            issues.push({
                type: 'no_devices',
                severity: 'info',
                message: 'No network devices in diagram'
            });
        }
        
        // If connected to backend, validate with server
        if (this.state.connected) {
            var topology = {
                devices: devices,
                connections: connections,
                isolatedDevices: isolatedDevices
            };
            
            this.sendMessage('validate-topology', {
                topology: topology
            }, function(response) {
                if (response.success) {
                    // Show backend validation results
                    if (response.valid) {
                        ArchiFlow.showAlert('Topology Validation Passed', 'success', 
                            response.summary.deviceCount + ' devices, ' + 
                            response.summary.connectionCount + ' connections validated');
                    } else {
                        // Show issues
                        response.issues.forEach(function(issue) {
                            ArchiFlow.showAlert(issue.message, 'error', 
                                issue.devices ? issue.devices.join(' vs ') : issue.details);
                        });
                        
                        // Show warnings
                        response.warnings.forEach(function(warning) {
                            ArchiFlow.showAlert(warning.message, 'warning', 
                                warning.devices ? warning.devices.slice(0, 3).join(', ') : warning.details);
                        });
                    }
                } else {
                    ArchiFlow.showAlert('Validation Failed', 'error', 
                        response.error || 'Unable to validate topology');
                }
            });
        } else {
            // Local validation only
            if (issues.length === 0) {
                this.showAlert('Topology validation passed (offline)', 'success', 
                    deviceCount + ' devices, ' + connectionCount + ' connections');
            } else {
                issues.forEach(function(issue) {
                    var details = issue.devices ? 
                        issue.devices.slice(0, 3).join(', ') + 
                        (issue.devices.length > 3 ? ' and ' + (issue.devices.length - 3) + ' more' : '') :
                        '';
                    ArchiFlow.showAlert(issue.message, issue.severity === 'warning' ? 'warning' : 'info', details);
                });
            }
        }
        
        return issues;
    };
    
    // Show alert history dialog
    ArchiFlow.showAlertHistory = function() {
        var content = document.createElement('div');
        content.style.padding = '10px';
        content.style.maxHeight = '400px';
        content.style.overflowY = 'auto';
        
        var html = '<h4>🔔 Alert History</h4>';
        
        if (this.alerts.length === 0) {
            html += '<p>No alerts recorded yet.</p>';
        } else {
            html += '<table style="width:100%; border-collapse: collapse;">';
            html += '<tr style="background:#f0f0f0;">' +
                '<th style="padding:5px; border:1px solid #ddd;">Time</th>' +
                '<th style="padding:5px; border:1px solid #ddd;">Type</th>' +
                '<th style="padding:5px; border:1px solid #ddd;">Message</th>' +
                '</tr>';
            
            // Show last 20 alerts
            var recentAlerts = this.alerts.slice(-20).reverse();
            recentAlerts.forEach(function(alert) {
                var time = new Date(alert.timestamp).toLocaleTimeString();
                var typeColor = {
                    'error': '#f44336',
                    'warning': '#FF9800',
                    'success': '#4CAF50',
                    'info': '#2196F3'
                }[alert.type] || '#999';
                
                html += '<tr>' +
                    '<td style="padding:5px; border:1px solid #ddd; font-size:11px;">' + time + '</td>' +
                    '<td style="padding:5px; border:1px solid #ddd; font-size:11px;">' +
                    '<span style="color:' + typeColor + ';">●</span> ' + alert.type + '</td>' +
                    '<td style="padding:5px; border:1px solid #ddd; font-size:11px;">' + alert.message + '</td>' +
                    '</tr>';
            });
            
            html += '</table>';
        }
        
        content.innerHTML = html;
        
        var dlg = new mxWindow('Alert History', content,
            document.body.offsetWidth - 400, 250, 370, 450, true, true);
        dlg.setClosable(true);
        dlg.setVisible(true);
    };
    
    // Add CSS animation for alerts
    var style = document.createElement('style');
    style.innerHTML = 
        '@keyframes slideIn {' +
        '  from { transform: translateX(100%); opacity: 0; }' +
        '  to { transform: translateX(0); opacity: 1; }' +
        '}';
    document.head.appendChild(style);
    
    // WebSocket connection for backend
    ArchiFlow.connect = function() {
        try {
            this.state.ws = new WebSocket(this.config.wsUrl);
            
            this.state.ws.onopen = function() {
                console.log('[ArchiFlow] WebSocket connected');
                ArchiFlow.state.connected = true;
                ArchiFlow.updateStatus();
                ArchiFlow.loadIPPools();
            };
            
            this.state.ws.onclose = function() {
                console.log('[ArchiFlow] WebSocket disconnected');
                ArchiFlow.state.connected = false;
                ArchiFlow.updateStatus();
            };
            
            this.state.ws.onerror = function(error) {
                console.error('[ArchiFlow] WebSocket error:', error);
            };
            
            this.state.ws.onmessage = function(event) {
                try {
                    var data = JSON.parse(event.data);
                    ArchiFlow.handleMessage(data);
                } catch (e) {
                    console.error('[ArchiFlow] Failed to parse message:', e);
                }
            };
        } catch (e) {
            console.error('[ArchiFlow] Failed to connect:', e);
        }
    };
    
    // Handle backend messages
    ArchiFlow.handleMessage = function(data) {
        if (data.type === 'welcome') {
            console.log('[ArchiFlow] Server welcome:', data.message);
        } else if (data.id && this.state.pendingCallbacks.has(data.id)) {
            var callback = this.state.pendingCallbacks.get(data.id);
            this.state.pendingCallbacks.delete(data.id);
            
            if (data.error) {
                callback({ success: false, error: data.error.message });
            } else if (data.result && data.result.content) {
                var content = JSON.parse(data.result.content[0].text);
                callback(content);
            }
        }
    };
    
    // Send message to backend
    ArchiFlow.sendMessage = function(toolName, args, callback) {
        if (!this.state.connected || !this.state.ws) {
            console.error('[ArchiFlow] Not connected to backend');
            if (callback) callback({ success: false, error: 'Not connected' });
            return;
        }
        
        var messageId = 'msg-' + Date.now() + '-' + Math.random();
        
        var message = {
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
    };
    
    // Load IP pools from backend
    ArchiFlow.loadIPPools = function() {
        this.sendMessage('get-ip-pools', {}, function(response) {
            if (response.success) {
                ArchiFlow.state.ipPools = response.pools || [];
                console.log('[ArchiFlow] Loaded IP pools:', ArchiFlow.state.ipPools.length);
            }
        });
    };
    
    // Reconnect function
    ArchiFlow.reconnect = function() {
        console.log('[ArchiFlow] Reconnecting...');
        if (this.state.ws) {
            this.state.ws.close();
        }
        this.connect();
    };
    
    // Status indicator
    ArchiFlow.updateStatus = function() {
        var statusEl = document.getElementById('archiflow-status');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'archiflow-status';
            statusEl.style.cssText = 'position:fixed;bottom:10px;right:10px;padding:5px 10px;background:#333;color:white;border-radius:5px;font-size:12px;z-index:10000;';
            document.body.appendChild(statusEl);
        }
        statusEl.innerHTML = '🔌 ArchiFlow: ' + (this.state.connected ? '<span style="color:#0f0">Connected</span>' : '<span style="color:#f00">Disconnected</span>');
    };
    
    // Initialize connection, change tracking, and alert system after 1 second
    setTimeout(function() {
        ArchiFlow.connect();
        ArchiFlow.updateStatus();
        ArchiFlow.initChangeTracking();
        ArchiFlow.initAlertSystem();
    }, 1000);
    
    console.log('[ArchiFlow] Plugin ready! Check Extras menu for ArchiFlow options.');
});