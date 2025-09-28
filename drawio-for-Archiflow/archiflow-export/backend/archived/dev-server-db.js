#!/usr/bin/env node
/**
 * ArchiFlow Development Server with PostgreSQL
 * Serves both Draw.io and ArchiFlow plugin via HTTP
 * Uses PostgreSQL for all data operations
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase, closeDatabase } from './database/connection.js';
import { IPPoolManager, IPAllocationManager, DeviceManager, DiagramManager } from './database/ip-manager.js';
import broadcastManager from './websocket/broadcast-manager.js';

// Load environment variables
dotenv.config();

// Force PostgreSQL mode
process.env.DB_MODE = 'postgresql';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🌐 ArchiFlow Development Server (PostgreSQL)           ║
║   Serving Draw.io + ArchiFlow Plugin                     ║
║                                                           ║
║   Draw.io: http://localhost:8081                         ║
║   WebSocket: ws://localhost:3333                         ║
║   Database: PostgreSQL                                   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// Initialize database connection
console.log('🔗 Connecting to PostgreSQL database...');
initializeDatabase();

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
        res.redirect('/?p=plugins/archiflow-complete.js');
    } else {
        // Serve the index.html file
        res.sendFile(path.join(__dirname, '../../webapp/index.html'));
    }
});

// Serve index.html directly without redirect (for iframe loading)
app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../../webapp/index.html'));
});

// Serve Draw.io files for all other paths
const drawioPath = path.join(__dirname, '../../webapp');
console.log('📁 Serving Draw.io from:', drawioPath);
app.use('/', express.static(drawioPath, {
    extensions: ['html', 'js', 'css'],
    setHeaders: (res, path) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    }
}));

// Serve ArchiFlow plugin files with CORS headers
const archiflowPath = path.join(__dirname, '../../archiflow-export');
app.use('/archiflow', express.static(archiflowPath));

// Serve plugin files specifically with CORS headers
app.use('/plugins', express.static(path.join(__dirname, '../frontend/plugins'), {
    setHeaders: (res, path) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    }
}));

// API endpoint for device catalog (still using static data for now)
app.get('/api/archiflow/models', (req, res) => {
    console.log('📦 Device catalog requested');
    res.json({
        success: true,
        devices: [
            { type: 'router', label: 'Router', vendor: 'Cisco', models: ['ISR-4321', 'ASR-1001-X'] },
            { type: 'switch', label: 'Switch', vendor: 'Cisco', models: ['2960-X', '3850-48P'] },
            { type: 'firewall', label: 'Firewall', vendor: 'Palo Alto', models: ['PA-220', 'PA-3220'] },
            { type: 'server', label: 'Server', vendor: 'Dell', models: ['R740', 'R640'] }
        ]
    });
});

// Start HTTP server
const PORT = process.env.PORT || 8081;
const server = app.listen(PORT, () => {
    console.log(`✅ HTTP server listening on http://localhost:${PORT}`);
    console.log('\n📋 Quick Access URLs:');
    console.log(`   Draw.io (standard): http://localhost:${PORT}`);
    console.log(`   ArchiFlow Loader: http://localhost:${PORT}/archiflow/archiflow-loader.html`);
    console.log('\n✨ Recommended: Use the ArchiFlow Loader link above\n');
});

// Create WebSocket server
const wss = new WebSocketServer({ port: 3333 });

console.log('✅ WebSocket server listening on ws://localhost:3333');

// Handle WebSocket connections
wss.on('connection', (ws) => {
    // Generate unique client ID
    const clientId = 'client-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    console.log('🔌 Client connected:', clientId);
    
    // Register client with broadcast manager
    broadcastManager.addClient(clientId, ws);
    
    // Send welcome message with client ID
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to ArchiFlow Backend (PostgreSQL)',
        version: '1.0.0',
        database: 'PostgreSQL',
        clientId: clientId,
        features: {
            realtime: true,
            collaboration: true,
            autoSave: true
        }
    }));
    
    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log('📥 Request:', message.method || message.type, message.params?.name);
            
            // Handle collaboration messages
            if (message.type === 'join_diagram') {
                broadcastManager.joinDiagram(clientId, message.diagramId);
            } else if (message.type === 'leave_diagram') {
                broadcastManager.leaveDiagram(clientId, message.diagramId);
            } else if (message.type === 'cursor_move') {
                broadcastManager.broadcastCursorPosition(clientId, message.x, message.y);
            } else if (message.type === 'selection_change') {
                broadcastManager.broadcastSelection(clientId, message.selectedCells);
            } else if (message.type === 'diagram_change') {
                // Broadcast diagram changes to other users
                const client = broadcastManager.clients.get(clientId);
                if (client && client.diagramId) {
                    broadcastManager.broadcastDiagramChange(client.diagramId, message.change, clientId);
                }
            } else if (message.method === 'tools/call') {
                // Handle MCP tool calls
                await handleToolCall(ws, message, clientId);
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
        console.log('🔌 Client disconnected:', clientId);
        broadcastManager.removeClient(clientId);
    });
    
    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
    });
});

// Handle MCP tool calls with database
async function handleToolCall(ws, message, clientId) {
    const { name, arguments: args } = message.params || {};
    const id = message.id;
    
    let result = null;
    let error = null;
    
    try {
        switch (name) {
            case 'get-ip-pools':
                const pools = await IPPoolManager.getAllPools();
                
                // Transform database format to match expected format
                const transformedPools = pools.map(pool => ({
                    id: pool.id,
                    name: pool.name,
                    network: pool.network,
                    gateway: pool.gateway,
                    vlan_id: pool.vlan_id,
                    available: [], // Will be calculated dynamically
                    allocated: pool.allocated || [],
                    allocated_count: pool.allocated_count || 0,
                    description: pool.description
                }));
                
                // Get available IPs for each pool
                for (const pool of transformedPools) {
                    const availableIPs = await IPPoolManager.getAvailableIPs(pool.id, 10);
                    pool.available = availableIPs;
                }
                
                result = {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            pools: transformedPools
                        })
                    }]
                };
                console.log(`✅ Returned ${transformedPools.length} IP pools from database`);
                break;
                
            case 'allocate-ip':
                const allocation = await IPAllocationManager.allocateIP(
                    args.poolId,
                    args.assetId,
                    args.deviceName || 'Unknown Device',
                    args.deviceType || 'unknown',
                    args.userId || 'drawio-user'
                );
                
                if (allocation.success) {
                    result = {
                        content: [{
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                ip: allocation.ip_address,
                                subnet: '255.255.255.0',
                                message: allocation.message
                            })
                        }]
                    };
                    console.log(`✅ IP allocated from database: ${allocation.ip_address} to ${args.assetId}`);
                } else {
                    error = {
                        code: -32000,
                        message: allocation.message || 'Failed to allocate IP'
                    };
                }
                break;
                
            case 'release-ip':
                const release = await IPAllocationManager.releaseIP(
                    args.ip,
                    args.poolId,
                    args.userId || 'drawio-user'
                );
                
                if (release.success) {
                    result = {
                        content: [{
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                message: release.message
                            })
                        }]
                    };
                    console.log(`✅ IP released in database: ${args.ip}`);
                } else {
                    error = {
                        code: -32000,
                        message: release.message || 'Failed to release IP'
                    };
                }
                break;
                
            case 'save-diagram':
                const diagramId = args.id || 'diagram-' + Date.now();
                const diagramData = {
                    id: diagramId,
                    name: args.name,
                    description: args.description || '',
                    diagram_xml: args.xml,
                    diagram_json: args.metadata,
                    created_by: args.userId || 'drawio-user',
                    updated_by: args.userId || 'drawio-user',
                    tags: args.tags || [],
                    metadata: args.additionalMetadata || {}
                };
                
                const savedDiagram = await DiagramManager.saveDiagram(diagramData);
                
                // Broadcast save event to other users in the same diagram
                const client = broadcastManager.clients.get(clientId);
                if (client && savedDiagram.id) {
                    broadcastManager.broadcastToDiagram(savedDiagram.id, {
                        type: 'diagram_saved',
                        diagramId: savedDiagram.id,
                        savedBy: args.userId || 'drawio-user',
                        version: savedDiagram.version,
                        timestamp: new Date()
                    }, clientId);
                }
                
                result = {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            id: savedDiagram.id,
                            version: savedDiagram.version,
                            message: 'Diagram saved to database'
                        })
                    }]
                };
                console.log(`✅ Diagram saved to database: ${savedDiagram.id} (v${savedDiagram.version})`);
                break;
                
            case 'load-diagram':
                const diagram = await DiagramManager.loadDiagram(args.id);
                
                if (diagram) {
                    result = {
                        content: [{
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                diagram: {
                                    id: diagram.id,
                                    name: diagram.name,
                                    xml: diagram.diagram_xml,
                                    metadata: diagram.diagram_json,
                                    version: diagram.version
                                }
                            })
                        }]
                    };
                    console.log(`✅ Diagram loaded from database: ${diagram.id}`);
                } else {
                    error = {
                        code: -32000,
                        message: 'Diagram not found'
                    };
                }
                break;
                
            case 'list-diagrams':
                const diagrams = await DiagramManager.listDiagrams();
                
                result = {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            diagrams: diagrams
                        })
                    }]
                };
                console.log(`✅ Listed ${diagrams.length} diagrams from database`);
                break;
                
            case 'get-devices':
                const devices = await DeviceManager.getAllDevices();
                
                result = {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            devices: devices
                        })
                    }]
                };
                console.log(`✅ Returned ${devices.length} devices from database`);
                break;
                
            case 'save-device':
                const device = await DeviceManager.upsertDevice({
                    asset_id: args.assetId,
                    device_name: args.deviceName,
                    device_type: args.deviceType,
                    vendor: args.vendor,
                    model: args.model,
                    serial_number: args.serialNumber,
                    location: args.location,
                    status: args.status || 'active',
                    metadata: args.metadata || {},
                    created_by: args.userId || 'drawio-user'
                });
                
                result = {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            device: device
                        })
                    }]
                };
                console.log(`✅ Device saved to database: ${device.asset_id}`);
                break;
                
            default:
                error = {
                    code: -32601,
                    message: `Unknown tool: ${name}`
                };
        }
    } catch (err) {
        console.error(`❌ Error in tool ${name}:`, err);
        error = {
            code: -32000,
            message: err.message || 'Internal server error'
        };
    }
    
    // Send response
    const response = {
        jsonrpc: '2.0',
        id: id
    };
    
    if (error) {
        response.error = error;
    } else {
        response.result = result;
    }
    
    ws.send(JSON.stringify(response));
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down server...');
    await closeDatabase();
    server.close();
    wss.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await closeDatabase();
    server.close();
    wss.close();
    process.exit(0);
});