import { z } from 'zod';
import { Context } from '../types.js';
import { CallToolResult, ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

// Schema for port operations
export const connectPortsSchema = z.object({
  sourceDevice: z.string().describe('Source device ID or name'),
  sourcePort: z.string().describe('Source port ID (e.g., "Gi0/1", "Te1/0/1")'),
  targetDevice: z.string().describe('Target device ID or name'),
  targetPort: z.string().describe('Target port ID'),
  linkType: z.enum(['ethernet', 'fiber', 'console']).optional().default('ethernet'),
  speed: z.enum(['10M', '100M', '1G', '10G', '40G', '100G']).optional(),
  vlanConfig: z.union([
    z.object({
      mode: z.literal('access'),
      vlan: z.number().min(1).max(4094)
    }),
    z.object({
      mode: z.literal('trunk'),
      vlans: z.array(z.number().min(1).max(4094)),
      nativeVlan: z.number().min(1).max(4094).optional()
    })
  ]).optional()
});

export const configurePortSchema = z.object({
  deviceId: z.string().describe('Device ID'),
  portId: z.string().describe('Port ID (e.g., "Gi0/1")'),
  configuration: z.object({
    vlan: z.number().min(1).max(4094).optional(),
    speed: z.enum(['auto', '10M', '100M', '1G', '10G']).optional(),
    duplex: z.enum(['auto', 'full', 'half']).optional(),
    shutdown: z.boolean().optional(),
    description: z.string().optional()
  })
});

type ToolFn<T> = (
  args: T,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
) => Promise<CallToolResult>;

export function createConnectPortsTool(context: Context): ToolFn<z.infer<typeof connectPortsSchema>> {
  return async (args, extra) => {
    try {
      context.log.debug('[connect-ports] Connecting ports', args);

      // Create connection with port details
      const connectionLabel = `${args.sourcePort} <-> ${args.targetPort}`;
      const speedLabel = args.speed ? `\n${args.speed}` : '';
      const vlanLabel = args.vlanConfig 
        ? args.vlanConfig.mode === 'trunk' 
          ? `\nTrunk: VLANs ${args.vlanConfig.vlans.join(',')}`
          : `\nAccess: VLAN ${args.vlanConfig.vlan}`
        : '';

      const fullLabel = connectionLabel + speedLabel + vlanLabel;

      // This would create the connection in Draw.io
      const connectionData = {
        source: {
          device: args.sourceDevice,
          port: args.sourcePort
        },
        target: {
          device: args.targetDevice,
          port: args.targetPort
        },
        label: fullLabel,
        type: args.linkType,
        speed: args.speed,
        vlanConfig: args.vlanConfig
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            connection: connectionData,
            message: `Connected ${args.sourceDevice}:${args.sourcePort} to ${args.targetDevice}:${args.targetPort}`
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error.message || 'Failed to connect ports'
          }, null, 2)
        }],
        isError: true
      };
    }
  };
}

export function createConfigurePortTool(context: Context): ToolFn<z.infer<typeof configurePortSchema>> {
  return async (args, extra) => {
    try {
      context.log.debug('[configure-port] Configuring port', args);

      // This would update the port configuration
      const portConfig = {
        deviceId: args.deviceId,
        portId: args.portId,
        ...args.configuration,
        updatedAt: new Date().toISOString()
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            port: portConfig,
            message: `Port ${args.portId} on ${args.deviceId} configured successfully`
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error.message || 'Failed to configure port'
          }, null, 2)
        }],
        isError: true
      };
    }
  };
}