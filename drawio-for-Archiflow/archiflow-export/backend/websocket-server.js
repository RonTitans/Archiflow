#!/usr/bin/env node
/**
 * ArchiFlow WebSocket Server
 * Handles real-time communication and database operations
 */

import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { initializeDatabase, closeDatabase } from './database/connection.js';
import { IPPoolManager, IPAllocationManager, DeviceManager, DiagramManager } from './database/ip-manager.js';
import broadcastManager from './websocket/broadcast-manager.js';

// Load environment variables
dotenv.config();

// Force PostgreSQL mode
process.env.DB_MODE = 'postgresql';

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🔌 ArchiFlow WebSocket Server                          ║
║   Real-time communication and database operations        ║
║                                                           ║
║   WebSocket: ws://localhost:3333                         ║
║   Database: PostgreSQL                                   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// Initialize database connection
console.log('🔗 Connecting to PostgreSQL database...');
initializeDatabase();

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
        message: 'Connected to ArchiFlow WebSocket Server',
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
            console.log('📥 Request:', message.method || message.type || message.action, message.params?.name);

            // Handle different message types
            if (message.type === 'join_diagram') {
                broadcastManager.joinDiagram(clientId, message.diagramId);
            } else if (message.type === 'leave_diagram') {
                broadcastManager.leaveDiagram(clientId, message.diagramId);
            } else if (message.type === 'cursor_move') {
                broadcastManager.broadcastCursorPosition(clientId, message.x, message.y);
            } else if (message.type === 'selection_change') {
                broadcastManager.broadcastSelection(clientId, message.selectedCells);
            } else if (message.type === 'diagram_change') {
                const client = broadcastManager.clients.get(clientId);
                if (client && client.diagramId) {
                    broadcastManager.broadcastDiagramChange(client.diagramId, message.change, clientId);
                }
            } else if (message.method === 'tools/call') {
                // Handle MCP tool calls
                await handleToolCall(ws, message, clientId);
            } else if (message.action) {
                // Handle legacy action-based messages
                await handleAction(ws, message, clientId);
            }
        } catch (error) {
            console.error('❌ Error processing message:', error);
            ws.send(JSON.stringify({
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

// Handle legacy action-based messages
async function handleAction(ws, message, clientId) {
    const { action } = message;
    let response = { action, success: false };

    try {
        switch (action) {
            case 'get_ip_pools':
                const pools = await IPPoolManager.getAllPools();
                response = {
                    action,
                    success: true,
                    pools: pools
                };
                break;

            case 'allocate_ip':
                const allocation = await IPAllocationManager.allocateIP(
                    message.poolId,
                    message.assetId,
                    message.deviceName || 'Unknown Device',
                    message.deviceType || 'unknown',
                    message.userId || 'drawio-user'
                );
                response = {
                    action,
                    success: allocation.success,
                    ip: allocation.ip_address,
                    message: allocation.message
                };
                break;

            case 'release_ip':
                const release = await IPAllocationManager.releaseIP(
                    message.ip,
                    message.poolId,
                    message.userId || 'drawio-user'
                );
                response = {
                    action,
                    success: release.success,
                    message: release.message
                };
                break;

            case 'save_diagram':
                const diagramData = {
                    id: message.id || 'diagram-' + Date.now(),
                    name: message.name,
                    description: message.description || '',
                    diagram_xml: message.xml,
                    diagram_json: message.metadata,
                    created_by: message.userId || 'drawio-user',
                    updated_by: message.userId || 'drawio-user',
                    tags: message.tags || [],
                    metadata: message.additionalMetadata || {}
                };
                const savedDiagram = await DiagramManager.saveDiagram(diagramData);
                response = {
                    action,
                    success: true,
                    id: savedDiagram.id,
                    version: savedDiagram.version
                };
                break;

            case 'load_diagram':
                const diagram = await DiagramManager.loadDiagram(message.id);
                response = {
                    action,
                    success: !!diagram,
                    diagram: diagram
                };
                break;

            case 'list_diagrams':
                const diagrams = await DiagramManager.listDiagrams();
                response = {
                    action,
                    success: true,
                    diagrams: diagrams
                };
                break;

            default:
                response = {
                    action,
                    success: false,
                    error: `Unknown action: ${action}`
                };
        }
    } catch (error) {
        console.error(`❌ Error in action ${action}:`, error);
        response = {
            action,
            success: false,
            error: error.message
        };
    }

    ws.send(JSON.stringify(response));
}

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
                const transformedPools = pools.map(pool => ({
                    id: pool.id,
                    name: pool.name,
                    network: pool.network,
                    gateway: pool.gateway,
                    vlan_id: pool.vlan_id,
                    available: [],
                    allocated: pool.allocated || [],
                    allocated_count: pool.allocated_count || 0,
                    description: pool.description
                }));

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
                } else {
                    error = {
                        code: -32000,
                        message: allocation.message || 'Failed to allocate IP'
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
    console.log('\n🛑 Shutting down WebSocket server...');
    await closeDatabase();
    wss.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await closeDatabase();
    wss.close();
    process.exit(0);
});