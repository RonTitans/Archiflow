/**
 * Network Device Shapes for ArchiFlow
 * Defines custom network device shapes with metadata support
 */

export interface DeviceMetadata {
  assetId?: string;
  deviceName: string;
  deviceType: NetworkDeviceType;
  ipAddress?: string;
  macAddress?: string;
  vlan?: number | number[];
  ports?: PortInfo[];
  location?: string;
  status?: 'active' | 'inactive' | 'maintenance';
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
}

export interface PortInfo {
  id: string;
  type: 'ethernet' | 'fiber' | 'console' | 'management';
  speed?: '10M' | '100M' | '1G' | '10G' | '40G' | '100G';
  status: 'connected' | 'available' | 'disabled';
  connectedTo?: string; // Asset ID of connected device
  vlan?: number | number[];
}

export enum NetworkDeviceType {
  ROUTER = 'router',
  SWITCH = 'switch',
  FIREWALL = 'firewall',
  SERVER = 'server',
  LOAD_BALANCER = 'load_balancer',
  ACCESS_POINT = 'access_point',
  WORKSTATION = 'workstation',
  CLOUD = 'cloud',
  INTERNET = 'internet',
  DATABASE = 'database'
}

export interface NetworkShape {
  type: NetworkDeviceType;
  name: string;
  style: string;
  defaultWidth: number;
  defaultHeight: number;
  icon?: string;
  category: 'network' | 'compute' | 'security' | 'infrastructure';
}

// Define custom shapes for network devices
export const NETWORK_SHAPES: Record<NetworkDeviceType, NetworkShape> = {
  [NetworkDeviceType.ROUTER]: {
    type: NetworkDeviceType.ROUTER,
    name: 'Router',
    style: 'shape=mxgraph.cisco.routers.router;html=1;fillColor=#0066CC;strokeColor=#001847;',
    defaultWidth: 80,
    defaultHeight: 80,
    icon: '🔀',
    category: 'network'
  },
  [NetworkDeviceType.SWITCH]: {
    type: NetworkDeviceType.SWITCH,
    name: 'Switch',
    style: 'shape=mxgraph.cisco.switches.layer_2_switch;html=1;fillColor=#FFB366;strokeColor=#6D4C13;',
    defaultWidth: 80,
    defaultHeight: 60,
    icon: '🔌',
    category: 'network'
  },
  [NetworkDeviceType.FIREWALL]: {
    type: NetworkDeviceType.FIREWALL,
    name: 'Firewall',
    style: 'shape=mxgraph.cisco.security.firewall;html=1;fillColor=#FF6666;strokeColor=#660000;',
    defaultWidth: 80,
    defaultHeight: 80,
    icon: '🛡️',
    category: 'security'
  },
  [NetworkDeviceType.SERVER]: {
    type: NetworkDeviceType.SERVER,
    name: 'Server',
    style: 'shape=mxgraph.cisco.servers.standard_host;html=1;fillColor=#66FF66;strokeColor=#006600;',
    defaultWidth: 60,
    defaultHeight: 80,
    icon: '🖥️',
    category: 'compute'
  },
  [NetworkDeviceType.LOAD_BALANCER]: {
    type: NetworkDeviceType.LOAD_BALANCER,
    name: 'Load Balancer',
    style: 'shape=mxgraph.cisco.misc.load_balancer;html=1;fillColor=#99CCFF;strokeColor=#003366;',
    defaultWidth: 80,
    defaultHeight: 60,
    icon: '⚖️',
    category: 'network'
  },
  [NetworkDeviceType.ACCESS_POINT]: {
    type: NetworkDeviceType.ACCESS_POINT,
    name: 'Access Point',
    style: 'shape=mxgraph.cisco.wireless.access_point;html=1;fillColor=#CCFFCC;strokeColor=#339933;',
    defaultWidth: 60,
    defaultHeight: 60,
    icon: '📡',
    category: 'network'
  },
  [NetworkDeviceType.WORKSTATION]: {
    type: NetworkDeviceType.WORKSTATION,
    name: 'Workstation',
    style: 'shape=mxgraph.cisco.computers_and_peripherals.pc;html=1;fillColor=#E6E6E6;strokeColor=#666666;',
    defaultWidth: 60,
    defaultHeight: 60,
    icon: '💻',
    category: 'compute'
  },
  [NetworkDeviceType.CLOUD]: {
    type: NetworkDeviceType.CLOUD,
    name: 'Cloud',
    style: 'shape=cloud;html=1;fillColor=#F0F0F0;strokeColor=#666666;',
    defaultWidth: 100,
    defaultHeight: 60,
    icon: '☁️',
    category: 'infrastructure'
  },
  [NetworkDeviceType.INTERNET]: {
    type: NetworkDeviceType.INTERNET,
    name: 'Internet',
    style: 'shape=mxgraph.cisco.storage.cloud;html=1;fillColor=#CCCCFF;strokeColor=#6666FF;',
    defaultWidth: 100,
    defaultHeight: 60,
    icon: '🌐',
    category: 'infrastructure'
  },
  [NetworkDeviceType.DATABASE]: {
    type: NetworkDeviceType.DATABASE,
    name: 'Database',
    style: 'shape=cylinder3;html=1;fillColor=#FFE6CC;strokeColor=#D79B00;',
    defaultWidth: 60,
    defaultHeight: 80,
    icon: '🗄️',
    category: 'compute'
  }
};

// Link types for connections
export enum LinkType {
  ETHERNET = 'ethernet',
  FIBER = 'fiber',
  WIRELESS = 'wireless',
  VPN = 'vpn',
  INTERNET = 'internet',
  SERIAL = 'serial'
}

export interface NetworkLink {
  type: LinkType;
  name: string;
  style: string;
  bandwidth?: string;
}

export const NETWORK_LINKS: Record<LinkType, NetworkLink> = {
  [LinkType.ETHERNET]: {
    type: LinkType.ETHERNET,
    name: 'Ethernet',
    style: 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#000000;strokeWidth=2;',
    bandwidth: '1G'
  },
  [LinkType.FIBER]: {
    type: LinkType.FIBER,
    name: 'Fiber Optic',
    style: 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#FF9900;strokeWidth=3;dashed=1;dashPattern=8 8;',
    bandwidth: '10G'
  },
  [LinkType.WIRELESS]: {
    type: LinkType.WIRELESS,
    name: 'Wireless',
    style: 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#0099FF;strokeWidth=2;dashed=1;dashPattern=1 4;',
    bandwidth: '1G'
  },
  [LinkType.VPN]: {
    type: LinkType.VPN,
    name: 'VPN Tunnel',
    style: 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#FF0000;strokeWidth=2;dashed=1;dashPattern=12 4;',
    bandwidth: '100M'
  },
  [LinkType.INTERNET]: {
    type: LinkType.INTERNET,
    name: 'Internet Link',
    style: 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#6666FF;strokeWidth=2;',
    bandwidth: 'Variable'
  },
  [LinkType.SERIAL]: {
    type: LinkType.SERIAL,
    name: 'Serial',
    style: 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#666666;strokeWidth=1;',
    bandwidth: '56K'
  }
};

/**
 * Helper function to create device with metadata
 */
export function createDeviceWithMetadata(
  type: NetworkDeviceType,
  metadata: Partial<DeviceMetadata>,
  position: { x: number; y: number }
) {
  const shape = NETWORK_SHAPES[type];
  
  return {
    type: shape.type,
    style: shape.style,
    width: shape.defaultWidth,
    height: shape.defaultHeight,
    x: position.x,
    y: position.y,
    value: metadata.deviceName || shape.name,
    metadata: {
      ...metadata,
      deviceType: type
    }
  };
}

/**
 * Helper function to create network link
 */
export function createNetworkLink(
  type: LinkType,
  sourceId: string,
  targetId: string,
  label?: string
) {
  const link = NETWORK_LINKS[type];
  
  return {
    type: link.type,
    style: link.style,
    source: sourceId,
    target: targetId,
    value: label || `${link.name} (${link.bandwidth})`,
    metadata: {
      linkType: type,
      bandwidth: link.bandwidth
    }
  };
}