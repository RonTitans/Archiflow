# Sprint 4: Enhanced Integration
**Duration:** Week 6
**Status:** 🔴 Not Started

## Overview
Complete NetBox synchronization and advanced integration features.

## Tasks

### 1. NetBox Device Import (6 hours)
```javascript
// NetBox API integration
class NetBoxSync {
    async importDevices(siteId) {
        // Get devices from NetBox
        const devices = await this.api.get(`/api/dcim/devices/?site_id=${siteId}`);

        // Transform to Draw.io shapes
        const shapes = devices.results.map(device => ({
            id: `netbox-${device.id}`,
            name: device.name,
            type: device.device_type.model,
            position: this.calculatePosition(device),
            properties: {
                netboxId: device.id,
                ip: device.primary_ip?.address,
                status: device.status.value,
                rack: device.rack?.name,
                role: device.device_role?.name
            }
        }));

        // Add to diagram
        this.addShapesToDiagram(shapes);
    }

    calculatePosition(device) {
        // Position based on rack/row
        const x = (device.rack?.position || 0) * 100 + 100;
        const y = (device.position || 0) * 80 + 100;
        return { x, y };
    }
}
```

### 2. Bidirectional IP Sync (4 hours)
```javascript
// Sync IP allocations between systems
const ipSync = {
    // Pull IPs from NetBox
    pullIPAllocations: async (siteId) => {
        const ips = await netbox.get(`/api/ipam/ip-addresses/?site_id=${siteId}`);

        for (const ip of ips.results) {
            await db.query(`
                INSERT INTO ip_allocations (ip, device_id, netbox_id)
                VALUES ($1, $2, $3)
                ON CONFLICT (ip) DO UPDATE
                SET netbox_id = $3
            `, [ip.address, ip.assigned_object_id, ip.id]);
        }
    },

    // Push IPs to NetBox
    pushIPAllocations: async () => {
        const allocations = await db.query('SELECT * FROM ip_allocations WHERE netbox_id IS NULL');

        for (const alloc of allocations.rows) {
            const result = await netbox.post('/api/ipam/ip-addresses/', {
                address: alloc.ip,
                assigned_object_type: 'dcim.interface',
                assigned_object_id: alloc.device_id,
                status: 'active'
            });

            await db.query('UPDATE ip_allocations SET netbox_id = $1 WHERE id = $2',
                [result.id, alloc.id]);
        }
    }
};
```

### 3. Cable Management Sync (4 hours)
```javascript
// Sync physical connections
const cableSync = {
    importCables: async (siteId) => {
        const cables = await netbox.get(`/api/dcim/cables/?site=${siteId}`);

        const connections = cables.results.map(cable => ({
            id: `cable-${cable.id}`,
            source: this.getTermination(cable.a_terminations[0]),
            target: this.getTermination(cable.b_terminations[0]),
            type: cable.type,
            color: cable.color,
            label: cable.label
        }));

        this.drawConnections(connections);
    },

    drawConnections(connections) {
        const graph = ui.editor.graph;

        connections.forEach(conn => {
            const source = graph.model.getCell(conn.source);
            const target = graph.model.getCell(conn.target);

            if (source && target) {
                graph.insertEdge(parent, null, conn.label,
                    source, target,
                    `strokeColor=${conn.color};strokeWidth=2`);
            }
        });
    }
};
```

### 4. Validation Engine (3 hours)
```javascript
// Network topology validation
const validator = {
    rules: [
        {
            name: 'IP Conflicts',
            check: async () => {
                const result = await db.query(`
                    SELECT ip, COUNT(*) as count
                    FROM ip_allocations
                    GROUP BY ip
                    HAVING COUNT(*) > 1
                `);
                return result.rows.map(r => ({
                    severity: 'error',
                    message: `IP ${r.ip} allocated ${r.count} times`
                }));
            }
        },
        {
            name: 'Orphaned Devices',
            check: () => {
                const devices = graph.model.cells.filter(c =>
                    c.vertex && !c.edges?.length);
                return devices.map(d => ({
                    severity: 'warning',
                    message: `Device ${d.value} has no connections`
                }));
            }
        },
        {
            name: 'VLAN Consistency',
            check: async () => {
                // Check VLAN assignments match across connected devices
                const issues = [];
                // Implementation...
                return issues;
            }
        }
    ],

    runValidation: async function() {
        const results = [];
        for (const rule of this.rules) {
            const issues = await rule.check();
            results.push({ rule: rule.name, issues });
        }
        return results;
    }
};
```

### 5. Bulk Operations (3 hours)
```javascript
// Mass update capabilities
const bulkOps = {
    updateMultiple: async (cellIds, updates) => {
        const graph = ui.editor.graph;
        graph.model.beginUpdate();

        try {
            cellIds.forEach(id => {
                const cell = graph.model.getCell(id);
                if (cell) {
                    Object.assign(cell.archiflow, updates);
                }
            });

            // Sync to database
            await this.syncBulkChanges(cellIds, updates);
        } finally {
            graph.model.endUpdate();
        }
    },

    bulkIPAllocation: async (devices, poolId) => {
        const results = [];
        for (const device of devices) {
            const ip = await this.allocateIP(poolId, device.id);
            results.push({ device: device.name, ip });
        }
        return results;
    }
};
```

### 6. Export/Import (2 hours)
```javascript
// Data portability
const dataExchange = {
    exportDiagram: async (diagramId) => {
        const diagram = await db.query('SELECT * FROM diagrams WHERE id = $1', [diagramId]);
        const devices = await db.query('SELECT * FROM devices WHERE diagram_id = $1', [diagramId]);

        return {
            version: '1.0',
            diagram: diagram.rows[0],
            devices: devices.rows,
            timestamp: new Date().toISOString()
        };
    },

    importDiagram: async (data) => {
        // Validate format
        if (data.version !== '1.0') throw new Error('Unsupported version');

        // Import diagram
        const diagramResult = await db.query(
            'INSERT INTO diagrams (...) VALUES (...) RETURNING id'
        );

        // Import devices
        for (const device of data.devices) {
            await db.query('INSERT INTO devices (...) VALUES (...)');
        }

        return diagramResult.rows[0].id;
    }
};
```

## Integration Points

### NetBox API Endpoints
- `/api/dcim/sites/` - Site information
- `/api/dcim/devices/` - Device inventory
- `/api/ipam/ip-addresses/` - IP allocations
- `/api/dcim/cables/` - Physical connections
- `/api/dcim/interfaces/` - Device interfaces

### WebSocket Events
```javascript
// Real-time sync events
ws.on('netbox.device.created', (device) => {
    // Add to diagram if site matches
});

ws.on('netbox.ip.allocated', (allocation) => {
    // Update device in diagram
});

ws.on('netbox.cable.connected', (cable) => {
    // Draw connection
});
```

## Testing Checklist
- [ ] Device import maintains NetBox IDs
- [ ] IP sync handles conflicts
- [ ] Cable connections draw correctly
- [ ] Validation catches all issues
- [ ] Bulk operations complete atomically
- [ ] Export/import preserves all data

## Security Considerations
- Validate NetBox API tokens
- Check user permissions per site
- Sanitize imported data
- Rate limit API calls
- Log all sync operations

## Performance Optimization
- Batch API requests
- Cache NetBox data (5 min TTL)
- Paginate large imports
- Queue background sync jobs
- Use database transactions