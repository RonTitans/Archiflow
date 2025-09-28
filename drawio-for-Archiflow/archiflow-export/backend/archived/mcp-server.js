#!/usr/bin/env node
/**
 * ArchiFlow MCP Server
 * Main entry point for the MCP backend
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import uWS from "uWebSockets.js";

// Import all MCP tools
import { createSaveDiagramTool } from "./mcp-tools/diagram-tools.js";
import { createLoadDiagramTool } from "./mcp-tools/diagram-tools.js";
import { createExportDiagramTool } from "./mcp-tools/diagram-tools.js";

import { createAddNetworkDeviceTool } from "./mcp-tools/network-device-tools.js";
import { createAllocateIpTool } from "./mcp-tools/network-device-tools.js";
import { createReleaseIpTool } from "./mcp-tools/network-device-tools.js";
import { createGetIpPoolsTool } from "./mcp-tools/network-device-tools.js";
import { createGetIpUsageTool } from "./mcp-tools/network-device-tools.js";

import { createCreateTemplateTool } from "./mcp-tools/template-tools.js";
import { createApplyTemplateTool } from "./mcp-tools/template-tools.js";
import { createListTemplatesTool } from "./mcp-tools/template-tools.js";

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🌐 ArchiFlow MCP Server                                ║
║   Network Management Backend for Draw.io                 ║
║                                                           ║
║   Version: 1.0.0                                          ║
║   Port: 3333                                              ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// Initialize MCP Server
const server = new McpServer({
    name: "ArchiFlow MCP Server",
    version: "1.0.0"
});

// Context object for tools
const context = {
    bus: null,
    id_generator: () => Date.now().toString(),
    logger: console
};

// Register all MCP tools
console.log("📦 Registering MCP tools...");

// Diagram tools
server.tool("save-diagram", "Save diagram to database", {}, createSaveDiagramTool(context));
server.tool("load-diagram", "Load diagram from database", {}, createLoadDiagramTool(context));
server.tool("export-diagram", "Export diagram as PNG/SVG/XML", {}, createExportDiagramTool(context));

// Network device tools
server.tool("add-network-device", "Add network device to diagram", {}, createAddNetworkDeviceTool(context));
server.tool("allocate-ip", "Allocate IP from pool", {}, createAllocateIpTool(context));
server.tool("release-ip", "Release IP back to pool", {}, createReleaseIpTool(context));
server.tool("get-ip-pools", "Get available IP pools", {}, createGetIpPoolsTool(context));
server.tool("get-ip-usage", "Get IP usage report", {}, createGetIpUsageTool(context));

// Template tools
server.tool("create-template", "Create reusable template", {}, createCreateTemplateTool(context));
server.tool("apply-template", "Apply template with variables", {}, createApplyTemplateTool(context));
server.tool("list-templates", "List available templates", {}, createListTemplatesTool(context));

console.log("✅ Tools registered successfully");

// Start WebSocket server for browser connections
const wsApp = uWS.App({});

wsApp.ws('/*', {
    compression: 0,
    maxPayloadLength: 16 * 1024 * 1024,
    
    open: (ws) => {
        console.log('🔌 Client connected');
        ws.subscribe('broadcast');
    },
    
    message: async (ws, message, isBinary) => {
        try {
            const request = JSON.parse(Buffer.from(message).toString());
            console.log('📥 Request:', request.method, request.params?.name);
            
            // Handle MCP tool calls
            if (request.method === 'tools/call') {
                const { name, arguments: args } = request.params;
                const tool = server.handlers.get(`tool_${name}`);
                
                if (tool) {
                    const result = await tool(args, {});
                    const response = {
                        jsonrpc: '2.0',
                        id: request.id,
                        result: result
                    };
                    ws.send(JSON.stringify(response));
                    console.log('📤 Response sent for:', name);
                } else {
                    ws.send(JSON.stringify({
                        jsonrpc: '2.0',
                        id: request.id,
                        error: { code: -32601, message: 'Tool not found' }
                    }));
                }
            }
        } catch (error) {
            console.error('❌ Error handling message:', error);
            ws.send(JSON.stringify({
                jsonrpc: '2.0',
                error: { code: -32603, message: error.message }
            }));
        }
    },
    
    close: (ws) => {
        console.log('🔌 Client disconnected');
    }
});

wsApp.listen(3333, (token) => {
    if (token) {
        console.log('🚀 WebSocket server listening on port 3333');
        console.log('');
        console.log('📡 Ready to accept connections from:');
        console.log('   - Draw.io plugins');
        console.log('   - ArchiFlow UI');
        console.log('   - Test clients');
        console.log('');
        console.log('💡 To test: Open http://localhost:8080/test');
    } else {
        console.error('❌ Failed to start WebSocket server');
        process.exit(1);
    }
});

// Also support stdio transport for CLI tools
const transport = new StdioServerTransport();
server.connect(transport);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down ArchiFlow MCP Server...');
    process.exit(0);
});