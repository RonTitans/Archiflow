#!/usr/bin/env node
/**
 * Simple HTTP server to serve the ArchiFlow plugin for Draw.io
 * This bypasses CORS and file:// protocol restrictions
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 8080;
const PLUGIN_FILE = path.join(__dirname, 'src', 'archiflow', 'ui', 'archiflow-plugin-example.js');

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);
    
    // Enable CORS for all origins (Draw.io needs this)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Parse URL
    const parsedUrl = url.parse(req.url);
    let pathname = `.${parsedUrl.pathname}`;
    
    // Serve the plugin file at root
    if (pathname === './' || pathname === './archiflow-plugin.js') {
        fs.readFile(PLUGIN_FILE, 'utf8', (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end(`Error loading plugin: ${err}`);
                return;
            }
            
            res.writeHead(200, { 'Content-Type': 'text/javascript' });
            res.end(data);
        });
        return;
    }
    
    // Serve the simple plugin version
    if (pathname === './archiflow-simple.js') {
        const simpleFile = path.join(__dirname, 'src', 'archiflow', 'ui', 'archiflow-plugin-simple.js');
        fs.readFile(simpleFile, 'utf8', (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end(`Error loading simple plugin: ${err}`);
                return;
            }
            
            res.writeHead(200, { 'Content-Type': 'text/javascript' });
            res.end(data);
        });
        return;
    }
    
    // Serve test pages
    if (pathname === './test') {
        pathname = './test-drawio-plugin.html';
    }
    if (pathname === './standalone') {
        pathname = './plugin-test-standalone.html';
    }
    
    // Security check - prevent directory traversal
    const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(__dirname, safePath);
    
    // Check if file exists
    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404);
            res.end('File not found');
            return;
        }
        
        // Read and serve the file
        const ext = path.extname(filePath).toLowerCase();
        const mimeType = mimeTypes[ext] || 'application/octet-stream';
        
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end(`Error: ${err}`);
                return;
            }
            
            res.writeHead(200, { 'Content-Type': mimeType });
            res.end(data);
        });
    });
});

server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚀 ArchiFlow Plugin Server Running!                        ║
║                                                               ║
║   Plugin URL:  http://localhost:${PORT}/archiflow-plugin.js     ║
║   Test Page:   http://localhost:${PORT}/test                    ║
║   Standalone:  http://localhost:${PORT}/standalone              ║
║                                                               ║
║   To load in Draw.io console (F12):                          ║
║                                                               ║
║   (function() {                                              ║
║     const script = document.createElement('script');         ║
║     script.src = 'http://localhost:${PORT}/archiflow-plugin.js';║
║     document.head.appendChild(script);                       ║
║   })();                                                       ║
║                                                               ║
║   Press Ctrl+C to stop the server                            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
});