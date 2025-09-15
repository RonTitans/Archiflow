# Database Architecture - NetBox & ArchiFlow

## Table of Contents
1. [Overview](#overview)
2. [NetBox Database](#netbox-database)
3. [ArchiFlow Database](#archiflow-database)
4. [API Endpoints](#api-endpoints)
5. [Database Connections](#database-connections)
6. [Performance Optimization](#performance-optimization)
7. [Data Relationships](#data-relationships)

---

## Overview

The ArchiFlow-NetBox integration uses **two separate PostgreSQL databases**:

1. **NetBox Database** - Core DCIM/IPAM data
2. **ArchiFlow Database** - Diagram and network management data

### Database Requirements
- PostgreSQL 14.0 or later (PostgreSQL 13 no longer supported as of NetBox 4.3)
- UTF-8 encoding
- Proper timezone configuration
- Sufficient connection pool size

---

## NetBox Database

### Core Schema Structure

NetBox organizes its database into application-specific schemas:

```
netbox_db/
├── dcim/           # Data Center Infrastructure Management
├── ipam/           # IP Address Management  
├── circuits/       # Circuit provider management
├── tenancy/        # Multi-tenancy support
├── virtualization/ # Virtual machines and clusters
├── extras/         # Custom fields, tags, etc.
├── users/          # Authentication and authorization
└── wireless/       # Wireless infrastructure
```

### Primary Tables by Application

#### DCIM (Data Center Infrastructure Management)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `dcim_site` | Physical locations | name, slug, status, region_id |
| `dcim_rack` | Equipment racks | name, site_id, height, width |
| `dcim_device` | Network devices | name, device_type_id, site_id, rack_id |
| `dcim_interface` | Device interfaces | name, device_id, type, speed |
| `dcim_cable` | Physical connections | termination_a, termination_b, type |
| `dcim_powerport` | Power connections | device_id, name, type |
| `dcim_consoleport` | Console connections | device_id, name, type |
| `dcim_devicerole` | Device roles/functions | name, slug, color |
| `dcim_manufacturer` | Hardware vendors | name, slug |
| `dcim_platform` | Operating systems | name, manufacturer_id |

#### IPAM (IP Address Management)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `ipam_prefix` | IP network prefixes | prefix, vrf_id, site_id, role_id |
| `ipam_ipaddress` | Individual IP addresses | address, prefix_id, assigned_object |
| `ipam_vrf` | VRF instances | name, rd, tenant_id |
| `ipam_vlan` | VLAN definitions | vid, name, site_id, group_id |
| `ipam_aggregate` | IP aggregates | prefix, rir_id |
| `ipam_role` | Prefix/VLAN roles | name, slug, weight |
| `ipam_routetarget` | BGP route targets | name, tenant_id |
| `ipam_service` | Network services | name, port, protocol, device_id |

#### Extras (Extensions & Metadata)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `extras_customfield` | Custom field definitions | name, type, object_types |
| `extras_customfieldvalue` | Custom field values | field_id, obj_type_id, obj_id |
| `extras_tag` | Tag definitions | name, slug, color |
| `extras_taggeditem` | Tag assignments | tag_id, object_id, content_type_id |
| `extras_configcontext` | Configuration contexts | name, data, platforms, roles |
| `extras_webhook` | Webhook definitions | name, payload_url, events |
| `extras_objectchange` | Change logging | time, user_id, action, changed_object |
| `extras_jobresult` | Background job results | name, status, data, user_id |

### Django System Tables

| Table | Purpose |
|-------|---------|
| `django_content_type` | Model registry |
| `auth_user` | User accounts |
| `auth_group` | User groups |
| `auth_permission` | Permissions |
| `django_session` | Session data |
| `django_migrations` | Migration history |

### Key Relationships

```sql
-- Device to IP Address relationship (Generic Foreign Key)
ipam_ipaddress.assigned_object_type_id -> django_content_type.id
ipam_ipaddress.assigned_object_id -> dcim_device.id (or dcim_interface.id)

-- Device to Site relationship
dcim_device.site_id -> dcim_site.id

-- Interface to Device relationship  
dcim_interface.device_id -> dcim_device.id

-- Prefix to VRF relationship
ipam_prefix.vrf_id -> ipam_vrf.id

-- Cable connections (polymorphic)
dcim_cable.termination_a_type_id -> django_content_type.id
dcim_cable.termination_a_id -> (interface/port id)
```

---

## ArchiFlow Database

### Complete Schema Definition

#### Core Tables

##### ip_pools
```sql
CREATE TABLE ip_pools (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    network CIDR NOT NULL,              -- PostgreSQL CIDR type
    gateway INET,                        -- PostgreSQL INET type
    dns_servers TEXT[],                  -- Array of DNS servers
    vlan_id INTEGER,
    description TEXT,
    pool_type VARCHAR(50) DEFAULT 'static', -- static, dhcp, reserved
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    is_active BOOLEAN DEFAULT true
);
```

##### ip_allocations
```sql
CREATE TABLE ip_allocations (
    id SERIAL PRIMARY KEY,
    ip_address INET NOT NULL,
    pool_id VARCHAR(50) REFERENCES ip_pools(id) ON DELETE CASCADE,
    asset_id VARCHAR(100) NOT NULL,
    device_name VARCHAR(255),
    device_type VARCHAR(50),            -- router, switch, server, etc.
    mac_address MACADDR,                -- PostgreSQL MAC address type
    allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    allocated_by VARCHAR(100),
    released_at TIMESTAMP,
    released_by VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    UNIQUE(ip_address, pool_id, is_active)
);
```

##### network_devices
```sql
CREATE TABLE network_devices (
    asset_id VARCHAR(100) PRIMARY KEY,
    device_name VARCHAR(255) NOT NULL,
    device_type VARCHAR(50) NOT NULL,
    vendor VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(255),
    location VARCHAR(255),
    rack_position VARCHAR(50),
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, maintenance, decommissioned
    primary_ip INET,
    management_ip INET,
    metadata JSONB,                     -- Flexible metadata storage
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);
```

##### device_ports
```sql
CREATE TABLE device_ports (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(100) REFERENCES network_devices(asset_id) ON DELETE CASCADE,
    port_name VARCHAR(100) NOT NULL,
    port_type VARCHAR(50),              -- ethernet, fiber, serial, virtual
    speed VARCHAR(20),                  -- 1G, 10G, 100M, etc.
    status VARCHAR(20) DEFAULT 'down',  -- up, down, admin-down
    vlan_id INTEGER,
    connected_to_device VARCHAR(100),
    connected_to_port VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

##### diagrams
```sql
CREATE TABLE diagrams (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    diagram_xml TEXT,                   -- Draw.io XML content
    diagram_json JSONB,                 -- Parsed diagram data
    version INTEGER DEFAULT 1,
    is_current BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    tags TEXT[],                        -- Array of tags
    metadata JSONB
);
```

##### diagram_versions
```sql
CREATE TABLE diagram_versions (
    id SERIAL PRIMARY KEY,
    diagram_id VARCHAR(100) REFERENCES diagrams(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    name VARCHAR(255),
    diagram_xml TEXT,
    diagram_json JSONB,
    change_summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    is_current BOOLEAN DEFAULT false,
    UNIQUE(diagram_id, version_number)
);
```

##### templates
```sql
CREATE TABLE templates (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_xml TEXT,
    template_json JSONB,
    variables JSONB,                    -- Template variables definition
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);
```

##### alerts
```sql
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(50) NOT NULL,    -- ip_conflict, pool_exhausted, device_down
    severity VARCHAR(20) NOT NULL,      -- critical, warning, info
    source VARCHAR(100),                -- Source identifier
    message TEXT NOT NULL,
    details JSONB,
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP,
    resolved BOOLEAN DEFAULT false,
    resolved_by VARCHAR(100),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

##### audit_log
```sql
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,       -- create, update, delete, allocate_ip
    entity_type VARCHAR(50) NOT NULL,   -- device, ip_pool, diagram
    entity_id VARCHAR(100),
    old_value JSONB,
    new_value JSONB,
    user_id VARCHAR(100),
    user_name VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Database Views

##### ip_pool_usage
```sql
CREATE VIEW ip_pool_usage AS
SELECT 
    p.id as pool_id,
    p.name as pool_name,
    p.network,
    p.gateway,
    COUNT(DISTINCT a.ip_address) FILTER (WHERE a.is_active = true) as allocated_count,
    (SELECT COUNT(*) FROM generate_series(
        (p.network::inet + 1)::inet,
        broadcast(p.network::inet) - 1,
        '1'::inet
    )) - COUNT(DISTINCT a.ip_address) FILTER (WHERE a.is_active = true) as available_count,
    ROUND(
        (COUNT(DISTINCT a.ip_address) FILTER (WHERE a.is_active = true)::numeric / 
        (SELECT COUNT(*) FROM generate_series(
            (p.network::inet + 1)::inet,
            broadcast(p.network::inet) - 1,
            '1'::inet
        ))::numeric) * 100, 2
    ) as usage_percentage
FROM ip_pools p
LEFT JOIN ip_allocations a ON p.id = a.pool_id
WHERE p.is_active = true
GROUP BY p.id, p.name, p.network, p.gateway;
```

##### device_connections
```sql
CREATE VIEW device_connections AS
SELECT 
    dp1.device_id as source_device,
    nd1.device_name as source_name,
    dp1.port_name as source_port,
    dp1.connected_to_device as target_device,
    nd2.device_name as target_name,
    dp1.connected_to_port as target_port,
    dp1.status as connection_status
FROM device_ports dp1
LEFT JOIN network_devices nd1 ON dp1.device_id = nd1.asset_id
LEFT JOIN network_devices nd2 ON dp1.connected_to_device = nd2.asset_id
WHERE dp1.connected_to_device IS NOT NULL;
```

### Indexes for Performance

```sql
-- IP Allocations
CREATE INDEX idx_ip_allocations_pool_id ON ip_allocations(pool_id);
CREATE INDEX idx_ip_allocations_asset_id ON ip_allocations(asset_id);
CREATE INDEX idx_ip_allocations_active ON ip_allocations(is_active);
CREATE INDEX idx_ip_allocations_ip ON ip_allocations(ip_address);

-- Network Devices
CREATE INDEX idx_devices_status ON network_devices(status);
CREATE INDEX idx_devices_type ON network_devices(device_type);
CREATE INDEX idx_devices_primary_ip ON network_devices(primary_ip);

-- Device Ports
CREATE INDEX idx_device_ports_device ON device_ports(device_id);
CREATE INDEX idx_device_ports_status ON device_ports(status);

-- Diagrams
CREATE INDEX idx_diagrams_current ON diagrams(is_current);
CREATE INDEX idx_diagrams_created_by ON diagrams(created_by);

-- Alerts
CREATE INDEX idx_alerts_type ON alerts(alert_type);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_resolved ON alerts(resolved);

-- Audit Log
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
```

---

## API Endpoints

### NetBox REST API Structure

Base URL: `https://<netbox-host>/api/`

#### Authentication
```bash
# Token authentication
curl -H "Authorization: Token <token>" https://netbox/api/

# Create token
curl -X POST -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin"}' \
     https://netbox/api/users/tokens/provision/
```

#### Core Endpoints

##### DCIM Endpoints
```
GET    /api/dcim/sites/              # List sites
POST   /api/dcim/sites/              # Create site
GET    /api/dcim/sites/{id}/         # Get site details
PUT    /api/dcim/sites/{id}/         # Update site
DELETE /api/dcim/sites/{id}/         # Delete site

GET    /api/dcim/devices/            # List devices
POST   /api/dcim/devices/            # Create device
GET    /api/dcim/devices/{id}/       # Get device
PUT    /api/dcim/devices/{id}/       # Update device
DELETE /api/dcim/devices/{id}/       # Delete device

GET    /api/dcim/interfaces/         # List interfaces
POST   /api/dcim/interfaces/         # Create interface
GET    /api/dcim/interfaces/{id}/    # Get interface
PUT    /api/dcim/interfaces/{id}/    # Update interface

GET    /api/dcim/cables/             # List cables
POST   /api/dcim/cables/             # Create cable
```

##### IPAM Endpoints
```
GET    /api/ipam/prefixes/           # List prefixes
POST   /api/ipam/prefixes/           # Create prefix
GET    /api/ipam/prefixes/{id}/      # Get prefix
PUT    /api/ipam/prefixes/{id}/      # Update prefix

GET    /api/ipam/ip-addresses/       # List IP addresses
POST   /api/ipam/ip-addresses/       # Create IP
GET    /api/ipam/ip-addresses/{id}/  # Get IP
PUT    /api/ipam/ip-addresses/{id}/  # Update IP
DELETE /api/ipam/ip-addresses/{id}/  # Delete IP

GET    /api/ipam/vlans/              # List VLANs
POST   /api/ipam/vlans/              # Create VLAN
```

#### Query Parameters

```bash
# Filtering
GET /api/dcim/devices/?site=chicago&status=active

# Pagination
GET /api/dcim/devices/?limit=100&offset=200

# Ordering
GET /api/dcim/devices/?ordering=name,-created

# Field limiting
GET /api/dcim/devices/?brief=true

# Search
GET /api/dcim/devices/?q=router
```

### ArchiFlow API Endpoints

Base URL: `ws://localhost:3333` (WebSocket)

#### WebSocket Message Format

```json
{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
        "name": "tool-name",
        "arguments": {}
    }
}
```

#### Available Tools/Methods

##### IP Pool Management
```javascript
// Get all IP pools
{
    "method": "tools/call",
    "params": {
        "name": "get-ip-pools"
    }
}

// Response
{
    "pools": [
        {
            "id": "pool-1",
            "name": "Management Network",
            "network": "192.168.1.0/24",
            "gateway": "192.168.1.1",
            "available": ["192.168.1.10", "192.168.1.11"],
            "allocated": ["192.168.1.2", "192.168.1.3"],
            "allocated_count": 2
        }
    ]
}
```

##### IP Allocation
```javascript
// Allocate IP
{
    "method": "tools/call",
    "params": {
        "name": "allocate-ip",
        "arguments": {
            "poolId": "pool-1",
            "assetId": "device-123",
            "deviceName": "Router-01",
            "deviceType": "router"
        }
    }
}

// Release IP
{
    "method": "tools/call",
    "params": {
        "name": "release-ip",
        "arguments": {
            "ip": "192.168.1.10",
            "poolId": "pool-1"
        }
    }
}
```

##### Diagram Management
```javascript
// Save diagram
{
    "method": "tools/call",
    "params": {
        "name": "save-diagram",
        "arguments": {
            "id": "diagram-1",
            "name": "Network Topology",
            "xml": "<mxGraphModel>...</mxGraphModel>",
            "metadata": {}
        }
    }
}

// Load diagram
{
    "method": "tools/call",
    "params": {
        "name": "load-diagram",
        "arguments": {
            "id": "diagram-1"
        }
    }
}

// List diagrams
{
    "method": "tools/call",
    "params": {
        "name": "list-diagrams"
    }
}
```

##### Device Management
```javascript
// Get devices
{
    "method": "tools/call",
    "params": {
        "name": "get-devices"
    }
}

// Save device
{
    "method": "tools/call",
    "params": {
        "name": "save-device",
        "arguments": {
            "assetId": "device-123",
            "deviceName": "Core-Switch-01",
            "deviceType": "switch",
            "vendor": "Cisco",
            "model": "Catalyst 9300"
        }
    }
}
```

### GraphQL API

NetBox 4.0+ includes GraphQL support:

```graphql
# Query example
query {
    device_list(site: "chicago") {
        id
        name
        device_type {
            manufacturer {
                name
            }
            model
        }
        primary_ip4 {
            address
        }
    }
}

# Mutation example
mutation {
    create_device(input: {
        name: "new-router",
        device_type: 1,
        site: 1,
        status: "active"
    }) {
        device {
            id
            name
        }
    }
}
```

---

## Database Connections

### Connection Strings

```yaml
# NetBox database
DATABASE = {
    'NAME': 'netbox',
    'USER': 'netbox',
    'PASSWORD': 'netbox_db_password_2024',
    'HOST': 'netbox-postgres',
    'PORT': '5432',
    'ENGINE': 'django.db.backends.postgresql'
}

# ArchiFlow database
ARCHIFLOW_DB = {
    'host': 'archiflow-postgres',
    'port': 5432,
    'database': 'archiflow',
    'user': 'archiflow_user',
    'password': 'archiflow_pass'
}
```

### Connection Pooling

```javascript
// Node.js connection pool (ArchiFlow)
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 20,                    // Maximum connections
    idleTimeoutMillis: 30000,   // Close idle connections
    connectionTimeoutMillis: 2000
});
```

---

## Performance Optimization

### Query Optimization

#### NetBox (Django ORM)
```python
# Bad - N+1 queries
devices = Device.objects.all()
for device in devices:
    print(device.site.name)  # Extra query per device

# Good - Single query with join
devices = Device.objects.select_related('site').all()
for device in devices:
    print(device.site.name)  # No extra queries

# Prefetch for many-to-many
devices = Device.objects.prefetch_related('interfaces').all()
```

#### ArchiFlow (Raw SQL)
```sql
-- Use CTEs for complex queries
WITH pool_stats AS (
    SELECT 
        pool_id,
        COUNT(*) as allocated_count
    FROM ip_allocations
    WHERE is_active = true
    GROUP BY pool_id
)
SELECT 
    p.*,
    COALESCE(ps.allocated_count, 0) as allocated
FROM ip_pools p
LEFT JOIN pool_stats ps ON p.id = ps.pool_id;

-- Use partial indexes
CREATE INDEX idx_active_allocations 
ON ip_allocations(pool_id) 
WHERE is_active = true;
```

### Database Maintenance

```sql
-- Update statistics
ANALYZE;

-- Vacuum tables
VACUUM ANALYZE ip_allocations;

-- Reindex
REINDEX TABLE ip_allocations;

-- Monitor slow queries
SELECT 
    query,
    calls,
    mean_exec_time,
    total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## Data Relationships

### Cross-Database References

Since NetBox and ArchiFlow use separate databases, relationships are maintained through:

1. **Shared Identifiers**
   - Device IDs
   - IP addresses
   - Site/location names

2. **Synchronization Points**
   ```javascript
   // Sync device from NetBox to ArchiFlow
   async function syncDevice(netboxDeviceId) {
       // Fetch from NetBox API
       const netboxDevice = await fetchNetBoxDevice(netboxDeviceId);
       
       // Upsert to ArchiFlow
       await archiflowDB.query(
           'INSERT INTO network_devices (asset_id, device_name, ...) 
            VALUES ($1, $2, ...) 
            ON CONFLICT (asset_id) 
            DO UPDATE SET device_name = $2, ...',
           [netboxDevice.id, netboxDevice.name, ...]
       );
   }
   ```

3. **Event-Driven Updates**
   - NetBox webhooks trigger ArchiFlow updates
   - ArchiFlow changes can call NetBox API

### Data Flow Diagram

```
NetBox UI → Plugin → iframe → Draw.io → WebSocket → ArchiFlow Backend
    ↓                                                      ↓
NetBox DB ←─────────── API Sync ──────────────────→ ArchiFlow DB
```

---

## Security Considerations

### Database Security

1. **Connection Security**
   ```sql
   -- Force SSL connections
   ALTER SYSTEM SET ssl = on;
   
   -- Restrict connections
   -- pg_hba.conf
   hostssl all all 0.0.0.0/0 md5
   ```

2. **User Permissions**
   ```sql
   -- Create read-only user
   CREATE USER readonly WITH PASSWORD 'secure_password';
   GRANT CONNECT ON DATABASE archiflow TO readonly;
   GRANT USAGE ON SCHEMA archiflow TO readonly;
   GRANT SELECT ON ALL TABLES IN SCHEMA archiflow TO readonly;
   ```

3. **Row-Level Security**
   ```sql
   -- Enable RLS
   ALTER TABLE diagrams ENABLE ROW LEVEL SECURITY;
   
   -- Create policy
   CREATE POLICY user_diagrams ON diagrams
   FOR ALL
   USING (created_by = current_user);
   ```

### API Security

1. **Token Management**
   - Rotate tokens regularly
   - Use token expiration
   - Implement rate limiting

2. **Input Validation**
   - Sanitize all inputs
   - Use parameterized queries
   - Validate JSON schemas

3. **Audit Logging**
   - Log all write operations
   - Track authentication attempts
   - Monitor suspicious patterns

---

## Backup and Recovery

### Backup Strategies

```bash
# NetBox database backup
pg_dump -h netbox-postgres -U netbox -d netbox > netbox_backup.sql

# ArchiFlow database backup
pg_dump -h archiflow-postgres -U archiflow_user -d archiflow > archiflow_backup.sql

# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec netbox-postgres pg_dump -U netbox netbox | gzip > netbox_$DATE.sql.gz
docker exec archiflow-postgres pg_dump -U archiflow_user archiflow | gzip > archiflow_$DATE.sql.gz
```

### Recovery Procedures

```bash
# Restore NetBox
psql -h netbox-postgres -U netbox -d netbox < netbox_backup.sql

# Restore ArchiFlow
psql -h archiflow-postgres -U archiflow_user -d archiflow < archiflow_backup.sql
```

---

## Monitoring

### Key Metrics to Monitor

1. **Database Performance**
   - Connection count
   - Query execution time
   - Cache hit ratio
   - Lock waits

2. **Application Metrics**
   - API response times
   - WebSocket connections
   - Error rates
   - Queue depth

3. **Resource Usage**
   - CPU utilization
   - Memory usage
   - Disk I/O
   - Network throughput

### Monitoring Queries

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity;

-- Long-running queries
SELECT 
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';

-- Table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Cache hit ratio
SELECT 
    sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) AS cache_hit_ratio
FROM pg_statio_user_tables;
```

---

## Resources

- [NetBox Database Schema](https://netboxlabs.com/docs/netbox/development/models/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/14/)
- [NetBox API Documentation](https://netboxlabs.com/docs/netbox/integrations/rest-api/)
- [Django ORM Documentation](https://docs.djangoproject.com/en/4.2/topics/db/)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)