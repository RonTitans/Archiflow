#!/usr/bin/env node
/**
 * ArchiFlow Simple WebSocket Server
 * Simplified backend for testing the Draw.io plugin
 */

import { WebSocketServer } from 'ws';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🌐 ArchiFlow Simple Server                             ║
║   Network Management Backend for Draw.io                 ║
║                                                           ║
║   Version: 1.0.0                                          ║
║   WebSocket: ws://localhost:3333                         ║
║   HTTP: http://localhost:8080                            ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// Create Express app for serving static files
const app = express();
app.use(express.json());

// Enable CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});

// Mock data storage
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
app.get('/archiflow/models', (req, res) => {
    console.log('📦 Device catalog requested');
    res.json({
        success: true,
        devices: storage.deviceCatalog
    });
});

// Create WebSocket server
const wss = new WebSocketServer({ port: 3333 });

console.log('✅ WebSocket server listening on ws://localhost:3333');

// Handle WebSocket connections
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
            const diagramId = 'diagram-' + Date.now();
            storage.diagrams.set(diagramId, {
                id: diagramId,
                name: args.name,
                xml: args.xml,
                metadata: args.metadata,
                savedAt: new Date().toISOString()
            });
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

// Start HTTP server for device catalog and other REST endpoints
app.listen(8080, () => {
    console.log('✅ HTTP server listening on http://localhost:8080');
    console.log('\n📋 Available endpoints:');
    console.log('   - GET /archiflow/models - Device catalog');
    console.log('\n🚀 Server ready for connections!');
    console.log('\n📌 To test:');
    console.log('   1. Open test-archiflow.html in your browser');
    console.log('   2. Click "Launch Draw.io with ArchiFlow Plugin"');
    console.log('   3. Check the console for connection status\n');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down ArchiFlow server...');
    wss.close(() => {
        process.exit(0);
    });
});