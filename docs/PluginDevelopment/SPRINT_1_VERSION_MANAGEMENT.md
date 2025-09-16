# Sprint 1: Version Management Core
**Duration:** Week 1-2
**Status:** 🔴 Not Started
**Priority:** Critical

---

## Sprint Overview

### Objective
Implement a robust site-based version control system with Vercel-style deployment workflow, ensuring each NetBox site has clear version management with one LIVE production diagram.

### Success Criteria
- ✅ Each site can have multiple diagram versions
- ✅ Only one version marked as LIVE per site
- ✅ Clear visual indication of LIVE status
- ✅ One-click deployment with confirmation
- ✅ Complete deployment history
- ✅ Rollback capability

---

## Database Implementation

### Task 1.1: Create Database Schema
**Estimated Hours:** 4
**Dependencies:** PostgreSQL access

#### SQL Scripts to Execute

```sql
-- Drop existing tables if needed (for development)
DROP TABLE IF EXISTS version_comparisons CASCADE;
DROP TABLE IF EXISTS deployment_history CASCADE;
DROP TABLE IF EXISTS diagrams CASCADE;

-- Main diagrams table with version control
CREATE TABLE diagrams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id INTEGER NOT NULL,
    site_name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    diagram_data TEXT NOT NULL,
    is_live BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'deployed', 'archived')),
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100) NOT NULL,
    modified_at TIMESTAMP DEFAULT NOW(),
    deployed_at TIMESTAMP,
    deployed_by VARCHAR(100),
    parent_version_id UUID REFERENCES diagrams(id),
    change_summary TEXT,
    metadata JSONB DEFAULT '{}',

    CONSTRAINT unique_site_version UNIQUE(site_id, version)
);

-- Ensure only one LIVE diagram per site
CREATE UNIQUE INDEX idx_one_live_per_site ON diagrams(site_id) WHERE is_live = TRUE;

-- Performance indexes
CREATE INDEX idx_diagrams_site_id ON diagrams(site_id);
CREATE INDEX idx_diagrams_status ON diagrams(status);
CREATE INDEX idx_diagrams_created_at ON diagrams(created_at DESC);

-- Deployment history table
CREATE TABLE deployment_history (
    id SERIAL PRIMARY KEY,
    diagram_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
    site_id INTEGER NOT NULL,
    site_name VARCHAR(255),
    version VARCHAR(50),
    action VARCHAR(50) NOT NULL CHECK (action IN ('deployed', 'rolled_back', 'archived')),
    timestamp TIMESTAMP DEFAULT NOW(),
    performed_by VARCHAR(100) NOT NULL,
    notes TEXT,
    previous_live_id UUID,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_deployment_history_site ON deployment_history(site_id);
CREATE INDEX idx_deployment_history_timestamp ON deployment_history(timestamp DESC);

-- Version comparison tracking
CREATE TABLE version_comparisons (
    id SERIAL PRIMARY KEY,
    version_a_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
    version_b_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
    comparison_date TIMESTAMP DEFAULT NOW(),
    compared_by VARCHAR(100),
    differences JSONB,
    notes TEXT
);
```

#### Testing Checklist
- [ ] Tables created successfully
- [ ] Constraints work (try inserting two LIVE for same site)
- [ ] Indexes created
- [ ] Foreign keys functioning
- [ ] Default values working

---

## Version Management UI

### Task 1.2: Create Landing Page
**Estimated Hours:** 8
**Dependencies:** Database schema complete

#### HTML Structure
```html
<!DOCTYPE html>
<html>
<head>
    <title>ArchiFlow Diagram Manager</title>
    <link rel="stylesheet" href="archiflow-manager.css">
</head>
<body>
    <div id="archiflow-manager">
        <!-- Header -->
        <header class="manager-header">
            <h1>ArchiFlow Diagram Manager</h1>
            <div class="user-info">
                <span id="current-user"></span>
                <button id="btn-settings">Settings</button>
            </div>
        </header>

        <!-- Site Selector -->
        <div class="site-selector">
            <label>Select Site:</label>
            <select id="site-dropdown">
                <option value="">Loading sites...</option>
            </select>
            <button id="btn-new-diagram">+ New Diagram</button>
        </div>

        <!-- Version Table -->
        <div class="version-container">
            <table id="version-table">
                <thead>
                    <tr>
                        <th>Version</th>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Author</th>
                        <th>Live</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="version-list">
                    <!-- Populated by JavaScript -->
                </tbody>
            </table>
        </div>

        <!-- Deployment History -->
        <div class="deployment-history">
            <h3>Deployment History</h3>
            <div id="history-list">
                <!-- Populated by JavaScript -->
            </div>
        </div>
    </div>

    <script src="archiflow-manager.js"></script>
</body>
</html>
```

#### JavaScript Implementation
```javascript
// archiflow-manager.js
class ArchiFlowManager {
    constructor() {
        this.currentSite = null;
        this.versions = [];
        this.ws = null;
        this.init();
    }

    async init() {
        // Connect to WebSocket
        this.connectWebSocket();

        // Load sites from NetBox
        await this.loadSites();

        // Setup event listeners
        this.setupEventListeners();
    }

    connectWebSocket() {
        this.ws = new WebSocket('ws://localhost:3333');

        this.ws.onopen = () => {
            console.log('Connected to ArchiFlow backend');
        };

        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleWebSocketMessage(message);
        };
    }

    async loadSites() {
        // Fetch sites from NetBox API
        const response = await fetch('/api/netbox/sites');
        const sites = await response.json();

        const dropdown = document.getElementById('site-dropdown');
        dropdown.innerHTML = '<option value="">Select a site...</option>';

        sites.forEach(site => {
            const option = document.createElement('option');
            option.value = site.id;
            option.textContent = site.name;
            dropdown.appendChild(option);
        });
    }

    async loadVersions(siteId) {
        this.currentSite = siteId;

        // Request versions from backend
        this.ws.send(JSON.stringify({
            method: 'diagram.getVersions',
            params: { site_id: siteId }
        }));
    }

    renderVersionTable(versions) {
        const tbody = document.getElementById('version-list');
        tbody.innerHTML = '';

        versions.forEach(version => {
            const row = document.createElement('tr');
            if (version.is_live) {
                row.classList.add('live-version');
            }

            row.innerHTML = `
                <td>${version.version}</td>
                <td>${version.title}</td>
                <td><span class="status-${version.status}">${version.status}</span></td>
                <td>${this.formatDate(version.created_at)}</td>
                <td>${version.created_by}</td>
                <td>${version.is_live ? '<span class="live-badge">🟢 LIVE</span>' : ''}</td>
                <td>
                    <button onclick="manager.openDiagram('${version.id}')">Open</button>
                    ${!version.is_live ?
                        `<button onclick="manager.deployVersion('${version.id}')">Deploy</button>` :
                        `<button onclick="manager.cloneVersion('${version.id}')">Clone</button>`
                    }
                </td>
            `;

            tbody.appendChild(row);
        });
    }

    async deployVersion(diagramId) {
        if (!confirm('Deploy this version as LIVE? The current LIVE version will be archived.')) {
            return;
        }

        this.ws.send(JSON.stringify({
            method: 'diagram.deploy',
            params: {
                diagram_id: diagramId,
                user_id: this.getCurrentUser()
            }
        }));
    }

    openDiagram(diagramId) {
        // Open Draw.io with the selected diagram
        window.location.href = `/drawio/editor?diagram=${diagramId}`;
    }
}

// Initialize manager
const manager = new ArchiFlowManager();
```

#### CSS Styling
```css
/* archiflow-manager.css */
#archiflow-manager {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

.manager-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #e1e4e8;
    padding-bottom: 20px;
    margin-bottom: 30px;
}

.site-selector {
    display: flex;
    gap: 20px;
    align-items: center;
    margin-bottom: 30px;
}

#site-dropdown {
    padding: 8px 12px;
    font-size: 16px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    min-width: 250px;
}

#btn-new-diagram {
    padding: 8px 16px;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
}

#version-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 30px;
}

#version-table th {
    background: #f6f8fa;
    padding: 12px;
    text-align: left;
    font-weight: 600;
    border-bottom: 2px solid #e1e4e8;
}

#version-table td {
    padding: 12px;
    border-bottom: 1px solid #e1e4e8;
}

.live-version {
    background: #f0fdf4;
}

.live-badge {
    display: inline-block;
    padding: 4px 8px;
    background: #10b981;
    color: white;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
}

.status-draft { color: #6b7280; }
.status-review { color: #f59e0b; }
.status-deployed { color: #10b981; }
.status-archived { color: #9ca3af; }

button {
    padding: 6px 12px;
    margin-right: 8px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    background: white;
    cursor: pointer;
}

button:hover {
    background: #f9fafb;
}

.deployment-history {
    background: #f9fafb;
    padding: 20px;
    border-radius: 8px;
}

.deployment-history h3 {
    margin-top: 0;
}

#history-list {
    max-height: 200px;
    overflow-y: auto;
}

.history-item {
    padding: 8px;
    margin-bottom: 8px;
    background: white;
    border-radius: 4px;
    font-size: 14px;
}
```

---

## Backend Implementation

### Task 1.3: WebSocket Handlers
**Estimated Hours:** 6
**Dependencies:** Database schema

#### Update websocket-server.js
```javascript
// Add to existing websocket-server.js

// Version management handlers
const versionHandlers = {
    // Get all versions for a site
    'diagram.getVersions': async (params) => {
        const { site_id } = params;

        const result = await db.query(`
            SELECT id, site_id, site_name, version, title,
                   status, is_live, created_at, created_by,
                   deployed_at, deployed_by
            FROM diagrams
            WHERE site_id = $1
            ORDER BY created_at DESC
        `, [site_id]);

        return { versions: result.rows };
    },

    // Deploy a version as LIVE
    'diagram.deploy': async (params) => {
        const { diagram_id, user_id } = params;

        await db.query('BEGIN');

        try {
            // Get diagram details
            const diagram = await db.query(
                'SELECT site_id, version FROM diagrams WHERE id = $1',
                [diagram_id]
            );

            // Find current LIVE
            const currentLive = await db.query(
                'SELECT id, version FROM diagrams WHERE site_id = $1 AND is_live = TRUE',
                [diagram.rows[0].site_id]
            );

            // Archive current LIVE
            if (currentLive.rows.length > 0) {
                await db.query(
                    'UPDATE diagrams SET is_live = FALSE, status = $1 WHERE id = $2',
                    ['archived', currentLive.rows[0].id]
                );
            }

            // Deploy new version
            await db.query(`
                UPDATE diagrams
                SET is_live = TRUE,
                    status = 'deployed',
                    deployed_at = NOW(),
                    deployed_by = $1
                WHERE id = $2
            `, [user_id, diagram_id]);

            // Log deployment
            await db.query(`
                INSERT INTO deployment_history
                (diagram_id, site_id, version, action, performed_by, previous_live_id)
                VALUES ($1, $2, $3, 'deployed', $4, $5)
            `, [
                diagram_id,
                diagram.rows[0].site_id,
                diagram.rows[0].version,
                user_id,
                currentLive.rows[0]?.id
            ]);

            await db.query('COMMIT');

            return { success: true, message: 'Version deployed successfully' };
        } catch (error) {
            await db.query('ROLLBACK');
            throw error;
        }
    },

    // Save new version
    'diagram.save': async (params) => {
        const { site_id, site_name, version, title, diagram_data, user_id } = params;

        const result = await db.query(`
            INSERT INTO diagrams
            (site_id, site_name, version, title, diagram_data, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `, [site_id, site_name, version, title, diagram_data, user_id]);

        return { diagram_id: result.rows[0].id };
    },

    // Clone existing version
    'diagram.clone': async (params) => {
        const { source_id, new_version, user_id } = params;

        const source = await db.query(
            'SELECT * FROM diagrams WHERE id = $1',
            [source_id]
        );

        const result = await db.query(`
            INSERT INTO diagrams
            (site_id, site_name, version, title, diagram_data,
             created_by, parent_version_id, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
            RETURNING id
        `, [
            source.rows[0].site_id,
            source.rows[0].site_name,
            new_version,
            source.rows[0].title + ' (Clone)',
            source.rows[0].diagram_data,
            user_id,
            source_id
        ]);

        return { diagram_id: result.rows[0].id };
    },

    // Get deployment history
    'deployment.getHistory': async (params) => {
        const { site_id, limit = 10 } = params;

        const result = await db.query(`
            SELECT h.*, d.version, d.title
            FROM deployment_history h
            JOIN diagrams d ON h.diagram_id = d.id
            WHERE h.site_id = $1
            ORDER BY h.timestamp DESC
            LIMIT $2
        `, [site_id, limit]);

        return { history: result.rows };
    }
};

// Add handlers to main WebSocket message handler
ws.on('message', async (message) => {
    const data = JSON.parse(message);
    const handler = versionHandlers[data.method];

    if (handler) {
        try {
            const result = await handler(data.params);
            ws.send(JSON.stringify({
                id: data.id,
                result: result
            }));
        } catch (error) {
            ws.send(JSON.stringify({
                id: data.id,
                error: error.message
            }));
        }
    }
});
```

---

## NetBox Integration

### Task 1.4: Site Selector Implementation
**Estimated Hours:** 4
**Dependencies:** NetBox API access

#### API Endpoint for Sites
```javascript
// netbox-api.js
const axios = require('axios');

class NetBoxAPI {
    constructor(url, token) {
        this.client = axios.create({
            baseURL: url,
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            }
        });
    }

    async getSites() {
        const response = await this.client.get('/api/dcim/sites/', {
            params: {
                limit: 1000,
                brief: 1
            }
        });

        return response.data.results.map(site => ({
            id: site.id,
            name: site.name,
            slug: site.slug,
            status: site.status.value,
            region: site.region?.name
        }));
    }

    async getSite(siteId) {
        const response = await this.client.get(`/api/dcim/sites/${siteId}/`);
        return response.data;
    }
}

module.exports = NetBoxAPI;
```

#### Express Route
```javascript
// In your Express server
app.get('/api/netbox/sites', async (req, res) => {
    try {
        const netbox = new NetBoxAPI(
            process.env.NETBOX_URL,
            process.env.NETBOX_TOKEN
        );

        const sites = await netbox.getSites();
        res.json(sites);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

---

## Testing Plan

### Unit Tests
```javascript
// tests/version-management.test.js
describe('Version Management', () => {
    test('Only one LIVE version per site', async () => {
        // Try to set two versions as LIVE for same site
        // Should fail with constraint error
    });

    test('Deploy version updates correctly', async () => {
        // Deploy a version
        // Check previous LIVE is archived
        // Check new version is LIVE
    });

    test('Deployment history logs correctly', async () => {
        // Deploy a version
        // Check history entry created
        // Verify all fields populated
    });

    test('Version cloning works', async () => {
        // Clone an existing version
        // Check new version created
        // Verify parent reference
    });
});
```

### Integration Tests
- [ ] Site dropdown populates from NetBox
- [ ] Version table loads correctly
- [ ] Deploy button works with confirmation
- [ ] LIVE badge appears correctly
- [ ] History updates after deployment
- [ ] WebSocket reconnects on disconnect

### User Acceptance Tests
- [ ] User can see all sites from NetBox
- [ ] User can view all versions for a site
- [ ] LIVE version is clearly marked
- [ ] Deploy action requires confirmation
- [ ] Deployment history is visible
- [ ] Can open any version in Draw.io

---

## Deployment Steps

### Step 1: Database Setup
```bash
# Connect to ArchiFlow database
docker exec -it archiflow-postgres psql -U archiflow_user -d archiflow

# Run schema creation script
\i /sql/version_management_schema.sql

# Verify tables created
\dt
```

### Step 2: Backend Updates
```bash
# Update websocket-server.js with new handlers
# Restart backend container
docker-compose restart archiflow-backend
```

### Step 3: Frontend Deployment
```bash
# Copy new files to webapp directory
cp archiflow-manager.html drawio-for-Archiflow/src/main/webapp/
cp archiflow-manager.js drawio-for-Archiflow/src/main/webapp/js/
cp archiflow-manager.css drawio-for-Archiflow/src/main/webapp/styles/

# Restart Draw.io container
docker-compose restart archiflow-drawio
```

### Step 4: Configuration
```bash
# Update .env file with NetBox credentials
NETBOX_URL=http://netbox:8000
NETBOX_TOKEN=your-api-token-here
```

---

## Troubleshooting Guide

### Common Issues

#### Issue: "unique constraint violation"
**Cause:** Trying to set multiple LIVE versions for same site
**Solution:** Ensure deploy function uses transaction and archives previous LIVE

#### Issue: Site dropdown empty
**Cause:** NetBox API connection failed
**Solution:** Check NETBOX_URL and NETBOX_TOKEN in .env file

#### Issue: WebSocket disconnects
**Cause:** Network issues or server restart
**Solution:** Implement auto-reconnect logic in client

#### Issue: Diagram won't deploy
**Cause:** Database constraint or permission issue
**Solution:** Check user permissions and database logs

---

## Performance Considerations

### Database Optimization
```sql
-- Add partial index for LIVE versions (faster queries)
CREATE INDEX idx_live_versions ON diagrams(site_id, version)
WHERE is_live = TRUE;

-- Add index for history queries
CREATE INDEX idx_history_recent ON deployment_history(site_id, timestamp DESC);

-- Vacuum and analyze after bulk inserts
VACUUM ANALYZE diagrams;
```

### Caching Strategy
```javascript
// Cache sites list (changes rarely)
let sitesCache = null;
let sitesCacheTime = 0;

async function getSitesWithCache() {
    const now = Date.now();
    if (!sitesCache || (now - sitesCacheTime) > 300000) { // 5 minutes
        sitesCache = await netboxAPI.getSites();
        sitesCacheTime = now;
    }
    return sitesCache;
}
```

---

## Definition of Done

### Required for Completion
- [x] Database schema created and tested
- [ ] Version management UI functional
- [ ] WebSocket handlers implemented
- [ ] NetBox site integration working
- [ ] Deployment process tested
- [ ] Rollback functionality verified
- [ ] Documentation updated
- [ ] Code reviewed
- [ ] Tests passing

### Nice to Have
- [ ] Version comparison UI
- [ ] Bulk operations support
- [ ] Export/import functionality
- [ ] Performance metrics dashboard

---

## Next Steps
After completing Sprint 1:
1. Begin Sprint 2: UI Modernization
2. Gather user feedback on version management
3. Performance test with large sites
4. Plan advanced features based on usage