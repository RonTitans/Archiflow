# ArchiFlow - NetBox Integration Guide

## Architecture Overview

The integration consists of three main components working together:

1. **NetBox** (Port 8000) - Core network infrastructure management system
2. **ArchiFlow Draw.io** (Port 8081) - Visual network diagram editor
3. **ArchiFlow Backend** (Port 3333) - WebSocket server for real-time updates

## How It Works

### Integration Flow
```
[NetBox UI]
    ↓ (User clicks "Network Diagrams" in sidebar)
[NetBox ArchiFlow Plugin]
    ↓ (Renders page with embedded iframe)
[Draw.io Container @ :8081]
    ↓ (Loads with ArchiFlow plugin)
[WebSocket Server @ :3333]
    ↓ (Handles real-time communication)
[ArchiFlow PostgreSQL @ :5433]
    (Stores diagram data separately)
```

### Key Features

1. **Seamless UI Integration**
   - ArchiFlow appears as a native NetBox feature
   - Accessible via NetBox navigation menu
   - Uses NetBox authentication

2. **Data Synchronization**
   - Import devices directly from NetBox into diagrams
   - Automatic IP allocation from NetBox IPAM
   - Sync diagram changes back to NetBox

3. **Separate but Connected**
   - Draw.io runs in its own container
   - Has its own database for diagram storage
   - Communicates via REST API and WebSocket

## Quick Start

### 1. Start All Services
```bash
# Start the entire stack
docker-compose up -d

# Check status
docker ps
```

### 2. Install NetBox Plugin
```bash
# Run the installation script
./install-plugin.sh
```

### 3. Access the Services
- **NetBox**: http://localhost:8000 (admin/admin)
- **ArchiFlow Direct**: http://localhost:8081
- **ArchiFlow in NetBox**: http://localhost:8000/plugins/archiflow/

## Container Communication

All containers communicate through shared Docker networks:

- `netbox-frontend`: External access network
- `netbox-backend`: Internal database/cache network
- `archiflow-network`: Shared network for ArchiFlow components

## Plugin Features

### In NetBox Interface
- **Network Diagrams** menu item in sidebar
- **Diagram List** view showing all saved diagrams
- **Diagram Editor** with embedded Draw.io
- **Import Devices** button to pull NetBox inventory
- **Sync with NetBox** for bidirectional updates

### WebSocket Communication
- Real-time collaboration support
- Auto-save every 30 seconds
- Connection status indicator
- Automatic reconnection on disconnect

## Development

### Plugin Structure
```
netbox-archiflow-plugin/
├── netbox_archiflow/
│   ├── __init__.py         # Plugin configuration
│   ├── models.py           # Diagram metadata model
│   ├── views.py            # Django views
│   ├── urls.py             # URL routing
│   ├── navigation.py       # Menu items
│   └── templates/          # HTML templates
```

### Customization

Edit plugin settings in NetBox:
```python
PLUGINS_CONFIG = {
    'netbox_archiflow': {
        'drawio_url': 'http://localhost:8081',
        'websocket_url': 'ws://localhost:3333',
        'enable_auto_save': True,
        'auto_save_interval': 30,
    }
}
```

## Troubleshooting

### Check Container Logs
```bash
docker logs netbox
docker logs archiflow-backend
docker logs archiflow-drawio
```

### Verify Network Connectivity
```bash
# Test from NetBox to ArchiFlow
docker exec netbox ping archiflow-backend
```

### Restart Services
```bash
docker-compose restart
```

## Security Notes

- Change default passwords in production
- Use HTTPS/WSS for production deployments
- Configure proper CORS settings
- Implement token-based authentication for API calls