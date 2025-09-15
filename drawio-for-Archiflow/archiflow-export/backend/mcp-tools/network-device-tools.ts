import { z } from "zod";
import { CallToolResult, ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { Context } from "../types.js";
import { default_tool } from "../tool.js";
import { 
  NetworkDeviceType, 
  NETWORK_SHAPES, 
  LinkType, 
  NETWORK_LINKS,
  createDeviceWithMetadata,
  createNetworkLink,
  DeviceMetadata
} from "../archiflow/devices/network-shapes.js";

// Schema for add-network-device tool
export const addNetworkDeviceSchema = z.object({
  deviceType: z.enum([
    'router', 'switch', 'firewall', 'server', 'load_balancer',
    'access_point', 'workstation', 'cloud', 'internet', 'database'
  ]).describe("Type of network device to add"),
  
  name: z.string().describe("Display name for the device"),
  
  x: z.number().optional().describe("X position on canvas").default(100),
  y: z.number().optional().describe("Y position on canvas").default(100),
  
  assetId: z.string().optional().describe("Asset ID from inventory system"),
  ipAddress: z.string().optional().describe("IP address assigned to device"),
  vlan: z.union([z.number(), z.array(z.number())]).optional().describe("VLAN assignment(s)"),
  
  manufacturer: z.string().optional().describe("Device manufacturer"),
  model: z.string().optional().describe("Device model number"),
  location: z.string().optional().describe("Physical location"),
  status: z.enum(['active', 'inactive', 'maintenance']).optional().describe("Device status").default('active')
});

// Schema for add-network-link tool
export const addNetworkLinkSchema = z.object({
  linkType: z.enum(['ethernet', 'fiber', 'wireless', 'vpn', 'internet', 'serial'])
    .describe("Type of network connection"),
  
  sourceId: z.string().describe("Source device cell ID"),
  targetId: z.string().describe("Target device cell ID"),
  
  label: z.string().optional().describe("Connection label"),
  bandwidth: z.string().optional().describe("Link bandwidth (e.g., 1G, 10G)"),
  vlan: z.union([z.number(), z.array(z.number())]).optional().describe("VLAN(s) on this link")
});

// Schema for get-ip-pools tool
export const getIpPoolsSchema = z.object({
  vlan: z.number().optional().describe("Filter by VLAN"),
  includeAllocations: z.boolean().optional().describe("Include current allocations").default(false)
});

// Schema for allocate-ip tool
export const allocateIpSchema = z.object({
  poolId: z.string().describe("IP pool ID to allocate from"),
  assetId: z.string().describe("Asset ID to assign the IP to"),
  description: z.string().optional().describe("Description for the allocation")
});

// Schema for release-ip tool
export const releaseIpSchema = z.object({
  ip: z.string().describe("IP address to release back to pool"),
  poolId: z.string().optional().describe("IP pool ID (if known, speeds up release)")
});

// Schema for get-ip-usage tool
export const getIpUsageSchema = z.object({
  poolId: z.string().optional().describe("Filter by specific pool ID"),
  assetId: z.string().optional().describe("Filter by specific asset ID"),
  includeAvailable: z.boolean().optional().describe("Include available IPs in report").default(false)
});

type ToolFn<T> = (
  args: T,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
) => Promise<CallToolResult>;

/**
 * Create network device with metadata
 */
export function createAddNetworkDeviceTool(context: Context): ToolFn<z.infer<typeof addNetworkDeviceSchema>> {
  return async (args, extra) => {
    try {
      // Map string device type to enum
      const deviceType = args.deviceType.toUpperCase().replace('_', '_') as keyof typeof NetworkDeviceType;
      const shape = NETWORK_SHAPES[NetworkDeviceType[deviceType]];
      
      if (!shape) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `Unknown device type: ${args.deviceType}`
            })
          }]
        };
      }

      // Create metadata object
      const metadata: Partial<DeviceMetadata> = {
        deviceName: args.name,
        assetId: args.assetId,
        ipAddress: args.ipAddress,
        vlan: args.vlan,
        manufacturer: args.manufacturer,
        model: args.model,
        location: args.location,
        status: args.status
      };

      // Build the display label
      let displayLabel = args.name;
      if (args.ipAddress) {
        displayLabel += `\n${args.ipAddress}`;
      }
      if (args.vlan) {
        const vlanText = Array.isArray(args.vlan) ? `VLANs: ${args.vlan.join(', ')}` : `VLAN: ${args.vlan}`;
        displayLabel += `\n${vlanText}`;
      }

      // Use the add-rectangle tool with custom style
      const addRectTool = default_tool("add-rectangle", context);
      const result = await addRectTool({
        x: args.x,
        y: args.y,
        width: shape.defaultWidth,
        height: shape.defaultHeight,
        text: displayLabel,
        style: shape.style,
        // Store metadata as custom attributes
        ...Object.fromEntries(
          Object.entries(metadata).filter(([_, v]) => v !== undefined).map(([k, v]) => [`data-${k}`, v])
        )
      }, extra);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            device: {
              type: args.deviceType,
              name: args.name,
              metadata: metadata
            },
            message: `${shape.name} '${args.name}' added successfully`
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: `Failed to add network device: ${error}`
          })
        }]
      };
    }
  };
}

/**
 * Create network link between devices
 */
export function createAddNetworkLinkTool(context: Context): ToolFn<z.infer<typeof addNetworkLinkSchema>> {
  return async (args, extra) => {
    try {
      const linkType = args.linkType.toUpperCase() as keyof typeof LinkType;
      const link = NETWORK_LINKS[LinkType[linkType]];
      
      if (!link) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `Unknown link type: ${args.linkType}`
            })
          }]
        };
      }

      // Build label
      let label = args.label || link.name;
      if (args.bandwidth) {
        label += ` (${args.bandwidth})`;
      }
      if (args.vlan) {
        const vlanText = Array.isArray(args.vlan) ? `VLANs: ${args.vlan.join(', ')}` : `VLAN ${args.vlan}`;
        label += `\n${vlanText}`;
      }

      // Use the add-edge tool with custom style
      const addEdgeTool = default_tool("add-edge", context);
      const result = await addEdgeTool({
        source_id: args.sourceId,
        target_id: args.targetId,
        text: label,
        style: link.style
      }, extra);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            link: {
              type: args.linkType,
              source: args.sourceId,
              target: args.targetId,
              label: label
            },
            message: `${link.name} connection created successfully`
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: `Failed to add network link: ${error}`
          })
        }]
      };
    }
  };
}

/**
 * Get available IP pools
 */
export function createGetIpPoolsTool(context: Context): ToolFn<z.infer<typeof getIpPoolsSchema>> {
  return async (args, extra) => {
    try {
      // Read from mock data
      const fs = await import('fs/promises');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const { dirname } = await import('path');
      
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const ipPoolsFile = path.join(__dirname, '..', 'archiflow', 'mock-data', 'ip-pools.json');
      
      const data = await fs.readFile(ipPoolsFile, 'utf-8');
      const ipPools = JSON.parse(data);
      
      let pools = ipPools.pools;
      
      // Filter by VLAN if specified
      if (args.vlan !== undefined) {
        pools = pools.filter((p: any) => p.vlan === args.vlan);
      }
      
      // Remove allocations if not requested
      if (!args.includeAllocations) {
        pools = pools.map((p: any) => ({
          ...p,
          allocations: undefined
        }));
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            pools: pools,
            count: pools.length
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: `Failed to get IP pools: ${error}`
          })
        }]
      };
    }
  };
}

/**
 * Allocate IP from pool
 */
export function createAllocateIpTool(context: Context): ToolFn<z.infer<typeof allocateIpSchema>> {
  return async (args, extra) => {
    try {
      // Read IP pools
      const fs = await import('fs/promises');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const { dirname } = await import('path');
      
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const ipPoolsFile = path.join(__dirname, '..', 'archiflow', 'mock-data', 'ip-pools.json');
      
      const data = await fs.readFile(ipPoolsFile, 'utf-8');
      const ipPools = JSON.parse(data);
      
      // Find the pool
      const pool = ipPools.pools.find((p: any) => p.id === args.poolId);
      if (!pool) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `IP pool ${args.poolId} not found`
            })
          }]
        };
      }
      
      // Check for IP conflicts - ensure IP is not already allocated
      const existingAllocation = pool.allocations.find((a: any) => a.assetId === args.assetId);
      if (existingAllocation) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `Asset ${args.assetId} already has IP ${existingAllocation.ip} allocated in pool ${pool.name}`,
              conflict: {
                assetId: args.assetId,
                existingIp: existingAllocation.ip,
                description: existingAllocation.description
              }
            })
          }]
        };
      }
      
      // Get next available IP
      if (!pool.available || pool.available.length === 0) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `No available IPs in pool ${pool.name}`
            })
          }]
        };
      }
      
      const allocatedIp = pool.available.shift();
      
      // Add to allocations
      pool.allocations.push({
        ip: allocatedIp,
        status: 'allocated',
        assetId: args.assetId,
        description: args.description || `Allocated to ${args.assetId}`
      });
      
      // Save back to file
      await fs.writeFile(ipPoolsFile, JSON.stringify(ipPools, null, 2));
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            allocation: {
              ip: allocatedIp,
              pool: pool.name,
              assetId: args.assetId,
              network: pool.network,
              gateway: pool.gateway,
              dns: pool.dns,
              vlan: pool.vlan
            },
            message: `IP ${allocatedIp} allocated successfully from ${pool.name}`
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: `Failed to allocate IP: ${error}`
          })
        }]
      };
    }
  };
}

/**
 * Release IP back to pool
 */
export function createReleaseIpTool(context: Context): ToolFn<z.infer<typeof releaseIpSchema>> {
  return async (args, extra) => {
    try {
      // Read IP pools
      const fs = await import('fs/promises');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const { dirname } = await import('path');
      
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const ipPoolsFile = path.join(__dirname, '..', 'archiflow', 'mock-data', 'ip-pools.json');
      
      const data = await fs.readFile(ipPoolsFile, 'utf-8');
      const ipPools = JSON.parse(data);
      
      let pool = null;
      let allocationIndex = -1;
      
      // If poolId is provided, search in that pool only
      if (args.poolId) {
        pool = ipPools.pools.find((p: any) => p.id === args.poolId);
        if (!pool) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `IP pool ${args.poolId} not found`
              })
            }]
          };
        }
        allocationIndex = pool.allocations.findIndex((a: any) => a.ip === args.ip);
      } else {
        // Search all pools for the IP
        for (const p of ipPools.pools) {
          const index = p.allocations.findIndex((a: any) => a.ip === args.ip);
          if (index !== -1) {
            pool = p;
            allocationIndex = index;
            break;
          }
        }
      }
      
      if (!pool || allocationIndex === -1) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `IP ${args.ip} not found in any allocations`
            })
          }]
        };
      }
      
      // Check if IP is reserved (cannot be released)
      const allocation = pool.allocations[allocationIndex];
      if (allocation.status === 'reserved') {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `IP ${args.ip} is reserved and cannot be released`
            })
          }]
        };
      }
      
      // Remove from allocations
      const released = pool.allocations.splice(allocationIndex, 1)[0];
      
      // Add back to available pool (maintain sorted order)
      if (!pool.available) {
        pool.available = [];
      }
      pool.available.push(args.ip);
      pool.available.sort((a: string, b: string) => {
        const aParts = a.split('.').map(Number);
        const bParts = b.split('.').map(Number);
        for (let i = 0; i < 4; i++) {
          if (aParts[i] !== bParts[i]) {
            return aParts[i] - bParts[i];
          }
        }
        return 0;
      });
      
      // Save back to file
      await fs.writeFile(ipPoolsFile, JSON.stringify(ipPools, null, 2));
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            release: {
              ip: args.ip,
              pool: pool.name,
              previousAssetId: released.assetId,
              previousDescription: released.description
            },
            message: `IP ${args.ip} released successfully back to ${pool.name}`
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: `Failed to release IP: ${error}`
          })
        }]
      };
    }
  };
}

/**
 * Get IP usage report
 */
export function createGetIpUsageTool(context: Context): ToolFn<z.infer<typeof getIpUsageSchema>> {
  return async (args, extra) => {
    try {
      // Read IP pools
      const fs = await import('fs/promises');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const { dirname } = await import('path');
      
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const ipPoolsFile = path.join(__dirname, '..', 'archiflow', 'mock-data', 'ip-pools.json');
      
      const data = await fs.readFile(ipPoolsFile, 'utf-8');
      const ipPools = JSON.parse(data);
      
      let pools = ipPools.pools;
      
      // Filter by pool ID if specified
      if (args.poolId) {
        pools = pools.filter((p: any) => p.id === args.poolId);
      }
      
      // Generate usage report
      const report: any = {
        summary: {
          totalPools: pools.length,
          totalAllocated: 0,
          totalAvailable: 0,
          totalReserved: 0
        },
        pools: [] as any[]
      };
      
      for (const pool of pools) {
        let allocations = pool.allocations || [];
        
        // Filter by asset ID if specified
        if (args.assetId) {
          allocations = allocations.filter((a: any) => a.assetId === args.assetId);
        }
        
        const allocated = allocations.filter((a: any) => a.status === 'allocated');
        const reserved = allocations.filter((a: any) => a.status === 'reserved');
        const available = pool.available || [];
        
        const poolReport: any = {
          id: pool.id,
          name: pool.name,
          network: pool.network,
          vlan: pool.vlan,
          statistics: {
            totalCapacity: allocated.length + reserved.length + available.length,
            allocated: allocated.length,
            reserved: reserved.length,
            available: available.length,
            utilizationPercent: Math.round((allocated.length / (allocated.length + available.length)) * 100) || 0
          },
          allocations: allocations.map((a: any) => ({
            ip: a.ip,
            status: a.status,
            assetId: a.assetId,
            description: a.description
          }))
        };
        
        // Include available IPs if requested
        if (args.includeAvailable) {
          poolReport.availableIps = available;
        }
        
        report.pools.push(poolReport);
        report.summary.totalAllocated += allocated.length;
        report.summary.totalAvailable += available.length;
        report.summary.totalReserved += reserved.length;
      }
      
      // Add overall utilization
      report.summary.overallUtilization = Math.round(
        (report.summary.totalAllocated / (report.summary.totalAllocated + report.summary.totalAvailable)) * 100
      ) || 0;
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            report: report,
            timestamp: new Date().toISOString()
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: `Failed to generate IP usage report: ${error}`
          })
        }]
      };
    }
  };
}