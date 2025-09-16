# Sites Dropdown Implementation & Data Sync Architecture

## Overview
This document explains how the sites dropdown works and how data flows from NetBox to ArchiFlow. This pattern is used for sites and can be replicated for other NetBox entities (devices, racks, VLANs, etc.).

---

## Architecture Diagram

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   NetBox DB     │   ───>  │  ArchiFlow DB   │   ───>  │   Frontend      │
│  (PostgreSQL)   │  sync   │  (PostgreSQL)   │  load   │   Dropdown      │
│   Port: 5432    │         │   Port: 5433    │         │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
     dcim_site                 archiflow.sites              <select>
```

---

## Data Flow Steps

### 1. NetBox Database (Source of Truth)
- **Table**: `dcim_site` in NetBox PostgreSQL database
- **Contains**: All site definitions (name, slug, status, etc.)
- **Access**: Port 5432 (internal to Docker network)

### 2. ArchiFlow Database (Local Cache)
- **Table**: `archiflow.sites` in ArchiFlow PostgreSQL database
- **Purpose**: Local copy for fast access and ArchiFlow-specific fields
- **Access**: Port 5433
- **Schema**:
```sql
CREATE TABLE archiflow.sites (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100),
    slug VARCHAR(100),
    status VARCHAR(50),
    description TEXT,
    last_synced TIMESTAMP
);
```

### 3. Data Sync Process

#### Method 1: Via NetBox Plugin API
```javascript
// Frontend calls NetBox API
fetch('/plugins/archiflow/api/sites/')
    ↓
// Plugin's views.py serves sites from NetBox
class SitesAPIView(LoginRequiredMixin, View):
    def get(self, request):
        sites = Site.objects.all().values(...)
        return JsonResponse(sites)
    ↓
// Frontend sends to WebSocket for sync
sendToWebSocket('sync_sites', { sites: sitesList })
    ↓
// WebSocket server saves to ArchiFlow DB
VersionManager.syncSitesFromNetBox(sites)
```

#### Method 2: Via WebSocket Direct Query
```javascript
// Frontend requests sites
sendToWebSocket('get_sites')
    ↓
// WebSocket queries ArchiFlow DB
VersionManager.getSites()
    SELECT * FROM archiflow.sites
    ↓
// Returns to frontend
ws.send(JSON.stringify(response))
```

---

## Implementation Files

### 1. Database Layer
**File**: `F:\Archiflow\drawio-for-Archiflow\archiflow-export\backend\database\version-manager.js`

```javascript
export const VersionManager = {
    // Get sites from ArchiFlow DB
    async getSites() {
        const result = await pool.query('SELECT * FROM archiflow.sites ORDER BY name');
        return result.rows;
    },

    // Sync sites from NetBox to ArchiFlow DB
    async syncSitesFromNetBox(sites) {
        for (const site of sites) {
            await pool.query(`
                INSERT INTO archiflow.sites (id, name, slug, status, description)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (id) DO UPDATE
                SET name = EXCLUDED.name,
                    slug = EXCLUDED.slug,
                    status = EXCLUDED.status,
                    description = EXCLUDED.description,
                    last_synced = NOW()
            `, [site.id, site.name, site.slug, site.status, site.description]);
        }
        return { success: true, synced: sites.length };
    }
}
```

### 2. WebSocket Server
**File**: `F:\Archiflow\drawio-for-Archiflow\archiflow-export\backend\websocket-server.js`

```javascript
// Handles WebSocket messages
async function handleAction(ws, message, clientId) {
    switch (action) {
        case 'sync_sites':
            // Receive sites from frontend and save to DB
            const syncResult = await VersionManager.syncSitesFromNetBox(message.sites);
            response = { action, success: syncResult.success, synced: syncResult.synced };
            break;

        case 'get_sites':
            // Get sites from ArchiFlow DB
            const sites = await VersionManager.getSites();
            response = { action, success: true, sites: sites };
            break;
    }
    ws.send(JSON.stringify(response));
}
```

### 3. NetBox Plugin API
**File**: `F:\Archiflow\netbox-archiflow-plugin\netbox_archiflow\views.py`

```python
class SitesAPIView(LoginRequiredMixin, View):
    """API endpoint to get all sites from NetBox"""
    def get(self, request):
        sites = Site.objects.all().values('id', 'name', 'slug', 'status', 'description')
        return JsonResponse(list(sites), safe=False)
```

**File**: `F:\Archiflow\netbox-archiflow-plugin\netbox_archiflow\urls.py`

```python
urlpatterns = [
    path('api/sites/', views.SitesAPIView.as_view(), name='api_sites'),
]
```

### 4. Frontend Implementation
**File**: `F:\Archiflow\netbox-archiflow-plugin\netbox_archiflow\templates\netbox_archiflow\editor.html`

```javascript
// Load sites from NetBox API
function loadSitesDirectly() {
    fetch('/plugins/archiflow/api/sites/')
        .then(response => response.json())
        .then(data => {
            sites = data;
            populateDropdown(sites);
            // Sync to ArchiFlow DB
            sendToWebSocket('sync_sites', { sites: sites });
        });
}

// Populate dropdown
function populateDropdown(sitesArray) {
    const dropdown = document.getElementById('site-select');

    // Destroy Tom Select if exists (NetBox's fancy dropdown)
    if (dropdown.tomselect) {
        dropdown.tomselect.destroy();
    }

    // Clear and populate
    dropdown.innerHTML = '';
    dropdown.add(new Option('Select a site...', ''));

    sitesArray.forEach(site => {
        dropdown.add(new Option(site.name, site.id));
    });
}

// Handle WebSocket responses
function handleWebSocketResponse(data) {
    if (data.action === 'get_sites') {
        sites = data.sites;
        populateDropdown(sites);
    }
}
```

---

## Common Issues & Solutions

### Issue 1: Tom Select Interference
**Problem**: NetBox uses Tom Select library which creates a fancy dropdown that blocks our updates.

**Solution**: Always destroy Tom Select before populating:
```javascript
if (dropdown.tomselect) {
    dropdown.tomselect.destroy();
}
```

### Issue 2: Timing Issues
**Problem**: WebSocket not ready when trying to load sites.

**Solution**: Multiple loading attempts with delays:
```javascript
setTimeout(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        sendToWebSocket('get_sites');
    }
    loadSitesDirectly();  // Backup method
}, 1000);
```

### Issue 3: Empty Dropdown
**Problem**: Dropdown shows "Loading sites..." forever.

**Checklist**:
1. Check ArchiFlow DB has data: `docker exec archiflow-postgres psql -U archiflow_user -d archiflow -c "SELECT * FROM archiflow.sites;"`
2. Check WebSocket is running: `docker logs archiflow-backend`
3. Check browser console for errors
4. Run `checkDropdown()` in console to debug

---

## Adding New Dropdowns (Devices, Racks, etc.)

To add a new dropdown for another NetBox entity, follow this pattern:

### 1. Create Database Table
```sql
CREATE TABLE archiflow.devices (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255),
    device_type_id INTEGER,
    site_id INTEGER,
    status VARCHAR(50),
    last_synced TIMESTAMP
);
```

### 2. Add to VersionManager
```javascript
async getDevices() {
    const result = await pool.query('SELECT * FROM archiflow.devices ORDER BY name');
    return result.rows;
},

async syncDevicesFromNetBox(devices) {
    // Similar to syncSitesFromNetBox
}
```

### 3. Add WebSocket Handler
```javascript
case 'get_devices':
    const devices = await VersionManager.getDevices();
    response = { action, success: true, devices: devices };
    break;

case 'sync_devices':
    const syncResult = await VersionManager.syncDevicesFromNetBox(message.devices);
    response = { action, success: syncResult.success };
    break;
```

### 4. Add NetBox API Endpoint
```python
class DevicesAPIView(LoginRequiredMixin, View):
    def get(self, request):
        devices = Device.objects.all().values('id', 'name', 'device_type_id', 'site_id', 'status')
        return JsonResponse(list(devices), safe=False)
```

### 5. Add Frontend Code
```javascript
function loadDevices() {
    fetch('/plugins/archiflow/api/devices/')
        .then(response => response.json())
        .then(data => {
            devices = data;
            populateDeviceDropdown(devices);
            sendToWebSocket('sync_devices', { devices: devices });
        });
}
```

---

## Best Practices

1. **Always sync to ArchiFlow DB first** - Don't query NetBox directly from Draw.io
2. **Use WebSocket for real-time updates** - Keeps all clients synchronized
3. **Destroy Tom Select before updating** - Prevents UI blocking
4. **Add error handling** - Always have fallback methods
5. **Cache in ArchiFlow DB** - Reduces load on NetBox
6. **Use consistent naming** - `get_[entity]`, `sync_[entity]`, etc.

---

## Testing

### Manual Testing
1. Add a new site in NetBox
2. Refresh the editor page
3. New site should appear in dropdown

### Debug Commands
```javascript
// Browser console
checkDropdown()        // Check dropdown status
testGetSites()        // Test WebSocket connection
populateDropdown([    // Force populate
    {id: 1, name: 'Test Site'}
])
```

### Database Verification
```bash
# Check ArchiFlow sites
docker exec archiflow-postgres psql -U archiflow_user -d archiflow -c "SELECT * FROM archiflow.sites;"

# Check NetBox sites
docker exec netbox-postgres psql -U netbox -d netbox -c "SELECT id, name FROM dcim_site;"
```

---

## Summary

The sites dropdown implementation demonstrates a robust pattern for syncing NetBox data to ArchiFlow:

1. **Two-database architecture**: NetBox DB (source) → ArchiFlow DB (cache)
2. **Multiple sync methods**: API pull + WebSocket push
3. **UI challenges handled**: Tom Select destruction, timing issues
4. **Extensible pattern**: Easy to replicate for other entities

This pattern ensures ArchiFlow has fast, local access to NetBox data while maintaining synchronization and allowing for ArchiFlow-specific extensions.