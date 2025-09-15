#!/usr/bin/env node
/**
 * ArchiFlow Draw.io Static File Server
 * Serves Draw.io webapp with ArchiFlow plugin
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8081;

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎨 ArchiFlow Draw.io Server                            ║
║   Serving Draw.io with ArchiFlow Plugin                  ║
║                                                           ║
║   URL: http://localhost:${PORT}                              ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// Enable CORS for all origins
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept']
}));

// Serve webapp directory (Draw.io files)
const webappPath = path.join(__dirname, '../webapp');
console.log('📁 Serving Draw.io from:', webappPath);

// Handle root request - redirect to plugin-enabled URL
app.get('/', (req, res) => {
    if (!req.query.p && !req.query.plugins) {
        res.redirect('/?p=plugins/archiflow-complete.js');
    } else {
        res.sendFile(path.join(webappPath, 'index.html'));
    }
});

// Serve all static files from webapp
app.use(express.static(webappPath, {
    setHeaders: (res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
}));

// Start server
app.listen(PORT, () => {
    console.log(`✅ Draw.io server running on http://localhost:${PORT}`);
    console.log(`📌 Plugin-enabled URL: http://localhost:${PORT}/?p=plugins/archiflow-complete.js`);
    console.log(`📌 Embed URL: http://localhost:${PORT}/?embed=1&p=plugins/archiflow-complete.js`);
});