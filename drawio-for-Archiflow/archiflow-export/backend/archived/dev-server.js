#!/usr/bin/env node
/**
 * ArchiFlow Development Server
 * Serves both Draw.io and ArchiFlow plugin via HTTP
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cors from 'cors';
import versionService from './versioning/version-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🌐 ArchiFlow Development Server                        ║
║   Serving Draw.io + ArchiFlow Plugin                     ║
║                                                           ║
║   Draw.io: http://localhost:8081                         ║
║   WebSocket: ws://localhost:3333                         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// Create Express app
const app = express();

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Handle root and index.html requests
app.get('/', (req, res) => {
    // If no plugins parameter, redirect with plugin enabled
    if (!req.query.plugins && !req.query.p) {
        // Use the relative path to the plugin file in Draw.io's plugins folder
        res.redirect('/?p=plugins/archiflow.js');
    } else {
        // Serve the index.html file
        res.sendFile(path.join(__dirname, '../../src/main/webapp/index.html'));
    }
});

// Serve index.html directly without redirect (for iframe loading)
app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../../src/main/webapp/index.html'));
});

// Serve Draw.io files for all other paths
const drawioPath = path.join(__dirname, '../../src/main/webapp');
console.log('📁 Serving Draw.io from:', drawioPath);
app.use('/', express.static(drawioPath, {
    extensions: ['html', 'js', 'css']
}));

// Serve ArchiFlow plugin files
const archiflowPath = path.join(__dirname, '../../archiflow-export');
app.use('/archiflow', express.static(archiflowPath));

// Mock data storage (same as simple-server.js)
const storage = {
    diagrams: new Map(),
    ipPools: [
        {
            id: 'POOL-001',
            name: 'Management Network',
            network: '10.0.1.0/24',
            available: ['10.0.1.20', '10.0.1.21', '10.0.1.22', '10.0.1.23', '10.0.1.24'],
            allocated: []
        },
        {
            id: 'POOL-002',
            name: 'Server Network',
            network: '10.0.2.0/24',
            available: ['10.0.2.10', '10.0.2.11', '10.0.2.12', '10.0.2.13', '10.0.2.14'],
            allocated: []
        }
    ],
    templates: [],
    deviceCatalog: [
        { type: 'router', label: 'Router', vendor: 'Cisco', models: ['ISR-4321', 'ASR-1001'] },
        { type: 'switch', label: 'Switch', vendor: 'Cisco', models: ['2960-X', '3850'] },
        { type: 'firewall', label: 'Firewall', vendor: 'Palo Alto', models: ['PA-220', 'PA-850'] },
        { type: 'server', label: 'Server', vendor: 'Dell', models: ['R740', 'R640'] }
    ]
};

// API endpoint for device catalog
app.get('/api/archiflow/models', (req, res) => {
    console.log('📦 Device catalog requested');
    res.json({
        success: true,
        devices: storage.deviceCatalog
    });
});

// Start HTTP server
const server = app.listen(8081, () => {
    console.log('✅ HTTP server listening on http://localhost:8081');
    console.log('\n📋 Quick Access URLs:');
    console.log('   Draw.io (standard): http://localhost:8081');
    console.log('   Draw.io with ArchiFlow: http://localhost:8081?plugins=1&p=/archiflow/frontend/plugins/archiflow-main.js');
    console.log('   ArchiFlow Loader: http://localhost:8081/archiflow/archiflow-loader.html');
    console.log('\n✨ Recommended: Use the ArchiFlow Loader link above to inject the plugin\n');
});

// Create WebSocket server
const wss = new WebSocketServer({ port: 3333 });

console.log('✅ WebSocket server listening on ws://localhost:3333');

// Handle WebSocket connections (same as simple-server.js)
wss.on('connection', (ws) => {
    console.log('🔌 Client connected');
    
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to ArchiFlow Backend',
        version: '1.0.0'
    }));
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log('📥 Request:', message.method, message.params?.name);
            
            // Handle MCP tool calls
            if (message.method === 'tools/call') {
                handleToolCall(ws, message);
            }
        } catch (error) {
            console.error('❌ Error processing message:', error);
            ws.send(JSON.stringify({
                jsonrpc: '2.0',
                error: {
                    code: -32700,
                    message: 'Parse error',
                    data: error.message
                }
            }));
        }
    });
    
    ws.on('close', () => {
        console.log('🔌 Client disconnected');
    });
    
    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
    });
});

// Handle MCP tool calls
function handleToolCall(ws, message) {
    const { name, arguments: args } = message.params || {};
    const id = message.id;
    
    let result = null;
    let error = null;
    
    switch (name) {
        case 'get-ip-pools':
            result = {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        pools: storage.ipPools
                    })
                }]
            };
            break;
            
        case 'allocate-ip':
            const pool = storage.ipPools.find(p => p.id === args.poolId);
            if (pool && pool.available.length > 0) {
                const ip = pool.available.shift();
                pool.allocated.push({ ip, assetId: args.assetId });
                result = {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            ip: ip,
                            subnet: '255.255.255.0'
                        })
                    }]
                };
                console.log(`✅ IP allocated: ${ip} to ${args.assetId}`);
            } else {
                error = {
                    code: -32000,
                    message: 'No IPs available in pool'
                };
            }
            break;
            
        case 'release-ip':
            const releasePool = storage.ipPools.find(p => p.id === args.poolId);
            if (releasePool) {
                const allocation = releasePool.allocated.find(a => a.ip === args.ip);
                if (allocation) {
                    releasePool.allocated = releasePool.allocated.filter(a => a.ip !== args.ip);
                    releasePool.available.push(args.ip);
                    result = {
                        content: [{
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                message: `IP ${args.ip} released`
                            })
                        }]
                    };
                    console.log(`✅ IP released: ${args.ip}`);
                }
            }
            break;
            
        case 'save-diagram':
            const diagramId = args.id || 'diagram-' + Date.now();
            const diagramData = {
                id: diagramId,
                name: args.name,
                xml: args.xml,
                metadata: args.metadata,
                savedAt: new Date().toISOString()
            };
            storage.diagrams.set(diagramId, diagramData);
            
            // Save version
            versionService.saveVersion(
                diagramId,
                diagramData,
                args.userId || 'user',
                args.changeDescription || 'Diagram saved'
            );
            
            result = {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        id: diagramId
                    })
                }]
            };
            console.log(`✅ Diagram saved: ${diagramId}`);
            break;
            
        case 'load-diagram':
            const diagram = storage.diagrams.get(args.id);
            if (diagram) {
                result = {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            ...diagram
                        })
                    }]
                };
                console.log(`✅ Diagram loaded: ${args.id}`);
            } else {
                error = {
                    code: -32000,
                    message: 'Diagram not found'
                };
            }
            break;
            
        case 'list-templates':
            result = {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        templates: storage.templates
                    })
                }]
            };
            break;
            
        case 'get-device-catalog':
            result = {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        devices: storage.deviceCatalog
                    })
                }]
            };
            break;
            
        case 'get-version-history':
            const history = versionService.getVersionHistory(args.diagramId, args.limit);
            result = {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        ...history
                    })
                }]
            };
            console.log(`✅ Version history retrieved for: ${args.diagramId}`);
            break;
            
        case 'rollback-version':
            try {
                const rolledBack = versionService.rollbackVersion(
                    args.diagramId,
                    args.targetVersion,
                    args.userId || 'user',
                    args.reason
                );
                
                // Update the stored diagram with rolled back data
                storage.diagrams.set(args.diagramId, rolledBack.data);
                
                result = {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            newVersion: rolledBack.versionNumber,
                            message: `Rolled back to version ${args.targetVersion}`
                        })
                    }]
                };
                console.log(`✅ Rollback successful: ${args.diagramId} to version ${args.targetVersion}`);
            } catch (err) {
                error = {
                    code: -32000,
                    message: err.message
                };
            }
            break;
            
        case 'compare-versions':
            try {
                const diff = versionService.compareVersions(
                    args.diagramId,
                    args.version1,
                    args.version2
                );
                result = {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            diff: diff
                        })
                    }]
                };
                console.log(`✅ Version comparison: ${args.version1} vs ${args.version2 || 'latest'}`);
            } catch (err) {
                error = {
                    code: -32000,
                    message: err.message
                };
            }
            break;
            
        case 'get-version-stats':
            const stats = versionService.getStats();
            result = {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        stats: stats
                    })
                }]
            };
            break;
            
        case 'get-ip-usage':
            const usage = storage.ipPools.map(pool => ({
                poolId: pool.id,
                poolName: pool.name,
                network: pool.network,
                totalIps: pool.available.length + pool.allocated.length,
                allocatedIps: pool.allocated.length,
                availableIps: pool.available.length,
                utilizationPercent: Math.round((pool.allocated.length / (pool.available.length + pool.allocated.length)) * 100)
            }));
            result = {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        usage: usage,
                        summary: {
                            totalPools: storage.ipPools.length,
                            totalAllocated: storage.ipPools.reduce((sum, p) => sum + p.allocated.length, 0),
                            totalAvailable: storage.ipPools.reduce((sum, p) => sum + p.available.length, 0)
                        }
                    })
                }]
            };
            break;
            
        case 'validate-topology':
            // Validate network topology
            const topology = args.topology || {};
            const issues = [];
            const warnings = [];
            
            // Check for isolated devices
            if (topology.isolatedDevices && topology.isolatedDevices.length > 0) {
                warnings.push({
                    type: 'isolated_devices',
                    severity: 'warning',
                    message: `${topology.isolatedDevices.length} isolated device(s) detected`,
                    devices: topology.isolatedDevices
                });
            }
            
            // Check for IP conflicts
            const ipMap = {};
            if (topology.devices) {
                topology.devices.forEach(device => {
                    if (device.ip) {
                        if (ipMap[device.ip]) {
                            issues.push({
                                type: 'duplicate_ip',
                                severity: 'error',
                                message: `IP conflict: ${device.ip}`,
                                devices: [ipMap[device.ip], device.name]
                            });
                        } else {
                            ipMap[device.ip] = device.name;
                        }
                    }
                });
            }
            
            // Check for VLAN mismatches
            if (topology.connections) {
                topology.connections.forEach(conn => {
                    if (conn.sourceVlan && conn.targetVlan && conn.sourceVlan !== conn.targetVlan) {
                        warnings.push({
                            type: 'vlan_mismatch',
                            severity: 'warning',
                            message: `VLAN mismatch on connection`,
                            details: `${conn.source} (VLAN ${conn.sourceVlan}) -> ${conn.target} (VLAN ${conn.targetVlan})`
                        });
                    }
                });
            }
            
            result = {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        valid: issues.length === 0,
                        issues: issues,
                        warnings: warnings,
                        summary: {
                            deviceCount: topology.devices ? topology.devices.length : 0,
                            connectionCount: topology.connections ? topology.connections.length : 0,
                            issueCount: issues.length,
                            warningCount: warnings.length
                        }
                    })
                }]
            };
            console.log(`🔍 Topology validated: ${issues.length} issues, ${warnings.length} warnings`);
            break;
            
        default:
            error = {
                code: -32601,
                message: `Method not found: ${name}`
            };
    }
    
    // Send response
    const response = {
        jsonrpc: '2.0',
        id: id
    };
    
    if (error) {
        response.error = error;
        console.log(`❌ Error: ${error.message}`);
    } else {
        response.result = result;
    }
    
    ws.send(JSON.stringify(response));
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down ArchiFlow development server...');
    wss.close(() => {
        server.close(() => {
            process.exit(0);
        });
    });
});