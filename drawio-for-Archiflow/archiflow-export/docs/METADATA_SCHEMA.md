# ArchiFlow Metadata Schema Specification
Version: 1.0.0
Last Updated: 2025-09-01

## Overview
This document defines the standardized metadata structure for ArchiFlow network devices in Draw.io diagrams. All device cells MUST conform to this schema to ensure compatibility with backend systems and proper data synchronization.

## Cell Structure

### Base Cell Format
```javascript
cell = {
  id: string,              // Draw.io generated cell ID
  value: object,           // Metadata container (see below)
  style: string,           // Draw.io style string
  vertex: boolean,         // true for devices, false for connections
  parent: string,          // Parent cell ID
  source: string,          // Source cell ID (for edges)
  target: string,          // Target cell ID (for edges)
  geometry: object         // Position and size
}
```

## Metadata Structure (cell.value)

### Device Metadata Schema
```javascript
cell.value = {
  type: "userObject",       // Required for Draw.io custom objects
  label: string,            // Display label on diagram
  
  // ArchiFlow namespace - ALL ArchiFlow data goes here
  archiflow: {
    // Version for migration support
    schemaVersion: "1.0.0",
    
    // Device Information (REQUIRED)
    device: {
      type: string,         // ENUM: "router" | "switch" | "firewall" | "server" | "loadbalancer" | "accesspoint" | "storage" | "client" | "cloud" | "generic"
      subtype: string,      // Optional: specific model/variant
      vendor: string,       // Vendor name (e.g., "Cisco", "Juniper")
      model: string,        // Model number (e.g., "2960-X", "ASR-1001")
      assetId: string,      // Unique asset identifier (REQUIRED)
      serialNumber: string, // Hardware serial number
      hostname: string,     // Device hostname
      location: string,     // Physical location
      role: string,         // Network role (e.g., "core", "edge", "access")
      status: string,       // ENUM: "active" | "inactive" | "maintenance" | "failed" | "planned"
      managementUrl: string // Management interface URL
    },
    
    // Network Configuration (REQUIRED)
    network: {
      // Primary IP Configuration
      primaryIp: {
        address: string,    // IPv4 or IPv6 address
        subnet: string,     // Subnet mask or CIDR
        gateway: string,    // Default gateway
        poolId: string,     // IP pool identifier
        allocatedAt: string,// ISO 8601 timestamp
        allocatedBy: string // User who allocated
      },
      
      // Additional IPs (array)
      additionalIps: [
        {
          address: string,
          subnet: string,
          type: string,     // ENUM: "management" | "loopback" | "vip" | "secondary"
          interface: string // Interface assignment
        }
      ],
      
      // VLAN Configuration
      vlans: [
        {
          id: number,       // VLAN ID (1-4094)
          name: string,     // VLAN name
          type: string,     // ENUM: "access" | "trunk" | "native"
          interfaces: []    // Associated interfaces
        }
      ],
      
      // DNS Configuration
      dns: {
        fqdn: string,       // Fully qualified domain name
        reverseDns: string, // PTR record
        nameservers: [],    // DNS server IPs
        searchDomains: []   // Search domains
      }
    },
    
    // Port/Interface Configuration
    ports: [
      {
        id: string,         // Port identifier (e.g., "GigabitEthernet0/1")
        name: string,       // Friendly name
        type: string,       // ENUM: "ethernet" | "fiber" | "serial" | "virtual"
        speed: string,      // Speed (e.g., "1G", "10G", "100M")
        status: string,     // ENUM: "up" | "down" | "administratively-down"
        mode: string,       // ENUM: "access" | "trunk" | "routed"
        vlan: number,       // Access VLAN or native VLAN
        allowedVlans: [],   // For trunk ports
        connectedTo: {      // Connection information
          deviceId: string, // Connected device asset ID
          portId: string    // Connected port ID
        },
        bandwidth: {        // Bandwidth utilization
          inbound: number,  // Mbps
          outbound: number  // Mbps
        }
      }
    ],
    
    // Services & Applications
    services: [
      {
        name: string,       // Service name
        type: string,       // Service type
        port: number,       // Service port
        protocol: string,   // TCP/UDP
        status: string      // Service status
      }
    ],
    
    // Monitoring & Alerts
    monitoring: {
      enabled: boolean,     // Monitoring enabled
      agent: string,        // Monitoring agent type
      metrics: {
        cpu: number,        // CPU usage %
        memory: number,     // Memory usage %
        disk: number,       // Disk usage %
        temperature: number // Temperature °C
      },
      alerts: [
        {
          id: string,
          severity: string, // ENUM: "critical" | "warning" | "info"
          message: string,
          timestamp: string
        }
      ]
    },
    
    // Compliance & Security
    compliance: {
      standards: [],        // Compliance standards (e.g., ["PCI-DSS", "HIPAA"])
      lastAudit: string,    // Last audit date
      patchLevel: string,   // Current patch level
      vulnerabilities: []   // Known vulnerabilities
    },
    
    // Metadata tracking
    metadata: {
      createdAt: string,    // ISO 8601 timestamp
      createdBy: string,    // User ID
      updatedAt: string,    // ISO 8601 timestamp
      updatedBy: string,    // User ID
      version: number,      // Version number
      tags: [],             // Custom tags
      notes: string,        // Free-form notes
      customFields: {}      // Extension point for custom data
    }
  }
}
```

## Connection/Edge Metadata Schema
```javascript
cell.value = {
  type: "userObject",
  label: string,            // Connection label
  
  archiflow: {
    schemaVersion: "1.0.0",
    
    // Connection Information
    connection: {
      type: string,         // ENUM: "ethernet" | "fiber" | "wireless" | "serial" | "virtual"
      speed: string,        // Link speed (e.g., "1G", "10G")
      duplex: string,       // ENUM: "full" | "half" | "auto"
      media: string,        // Physical media type
      distance: number,     // Cable length in meters
      
      // Endpoints
      sourcePort: string,   // Source port ID
      targetPort: string,   // Target port ID
      
      // Network Configuration
      vlan: number,         // VLAN tag
      nativeVlan: number,   // Native VLAN for trunk
      allowedVlans: [],     // Allowed VLANs for trunk
      
      // Status
      status: string,       // ENUM: "active" | "inactive" | "planned"
      utilized: number,     // Bandwidth utilization %
      
      // Quality metrics
      metrics: {
        latency: number,    // ms
        packetLoss: number, // %
        jitter: number      // ms
      }
    },
    
    metadata: {
      createdAt: string,
      createdBy: string,
      updatedAt: string,
      updatedBy: string
    }
  }
}
```

## Validation Rules

### Required Fields
1. **Devices MUST have:**
   - `archiflow.device.type`
   - `archiflow.device.assetId`
   - `archiflow.network.primaryIp.address` (if allocated)

2. **Connections MUST have:**
   - `archiflow.connection.type`
   - `source` and `target` cell IDs

### Field Constraints
- **IP Addresses**: Valid IPv4 or IPv6 format
- **VLAN IDs**: 1-4094 range
- **Port Speed**: Format: number + unit (e.g., "1G", "100M", "10G")
- **Timestamps**: ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
- **Asset IDs**: Alphanumeric with hyphens, unique across diagram

## Migration Strategy

### Version Detection
```javascript
function getSchemaVersion(cell) {
  return cell.value?.archiflow?.schemaVersion || "0.0.0";
}
```

### Migration Path
- **0.0.0 → 1.0.0**: Convert flat structure to nested archiflow namespace
- **Future versions**: Add migration functions as needed

## Storage Optimization

### Compression for Large Diagrams
For diagrams with >100 devices, implement:
1. Store full metadata only for selected/edited devices
2. Use reference IDs for unchanged devices
3. Compress JSON before storage

### Indexing for Search
Create indexes on:
- `archiflow.device.assetId`
- `archiflow.network.primaryIp.address`
- `archiflow.device.hostname`

## API Integration

### Export Format
```javascript
// Export for backend API
function exportDevice(cell) {
  return {
    assetId: cell.value.archiflow.device.assetId,
    type: cell.value.archiflow.device.type,
    network: cell.value.archiflow.network,
    ports: cell.value.archiflow.ports,
    metadata: cell.value.archiflow.metadata
  };
}
```

### Import Format
```javascript
// Import from backend API
function importDevice(apiData) {
  return {
    type: "userObject",
    label: apiData.hostname || apiData.assetId,
    archiflow: {
      schemaVersion: "1.0.0",
      device: mapApiDevice(apiData),
      network: mapApiNetwork(apiData),
      ports: mapApiPorts(apiData),
      metadata: generateMetadata()
    }
  };
}
```

## Examples

### Router Device
```javascript
{
  type: "userObject",
  label: "Core-Router-01",
  archiflow: {
    schemaVersion: "1.0.0",
    device: {
      type: "router",
      vendor: "Cisco",
      model: "ASR-1001-X",
      assetId: "RTR-CORE-001",
      hostname: "core-rtr-01.example.com",
      status: "active",
      role: "core"
    },
    network: {
      primaryIp: {
        address: "10.0.1.1",
        subnet: "255.255.255.0",
        gateway: "10.0.1.254",
        poolId: "POOL-MGMT-001"
      }
    },
    ports: [
      {
        id: "GigabitEthernet0/0",
        name: "Uplink to ISP",
        type: "ethernet",
        speed: "1G",
        status: "up"
      }
    ]
  }
}
```

### Network Connection
```javascript
{
  type: "userObject",
  label: "10G Fiber Link",
  archiflow: {
    schemaVersion: "1.0.0",
    connection: {
      type: "fiber",
      speed: "10G",
      duplex: "full",
      status: "active",
      sourcePort: "TenGigabitEthernet0/0",
      targetPort: "TenGigabitEthernet0/1"
    }
  }
}
```

## Best Practices

1. **Always validate** metadata before saving
2. **Use enums** for standardized values
3. **Maintain backwards compatibility** when updating schema
4. **Store minimal data** - fetch details from backend when needed
5. **Use consistent naming** across all devices
6. **Document custom fields** in metadata.customFields

## Schema Validation Function

```javascript
function validateDeviceMetadata(cell) {
  const errors = [];
  const metadata = cell.value?.archiflow;
  
  if (!metadata) {
    errors.push("Missing archiflow namespace");
    return errors;
  }
  
  // Check required fields
  if (!metadata.device?.type) {
    errors.push("Missing device.type");
  }
  if (!metadata.device?.assetId) {
    errors.push("Missing device.assetId");
  }
  
  // Validate enums
  const validDeviceTypes = ["router", "switch", "firewall", "server"];
  if (metadata.device?.type && !validDeviceTypes.includes(metadata.device.type)) {
    errors.push(`Invalid device.type: ${metadata.device.type}`);
  }
  
  // Validate IP format
  if (metadata.network?.primaryIp?.address) {
    if (!isValidIP(metadata.network.primaryIp.address)) {
      errors.push(`Invalid IP address: ${metadata.network.primaryIp.address}`);
    }
  }
  
  return errors;
}
```

---

*This schema is the authoritative source for ArchiFlow metadata structure. All implementations MUST conform to this specification.*