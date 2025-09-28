# ArchiFlow Backend Services

## Architecture Overview

ArchiFlow backend consists of two main services that run in Docker containers:

1. **WebSocket Server** (`websocket-server.js`) - Port 3333
   - Handles real-time communication between Draw.io and database
   - Manages diagram save/load operations
   - Syncs with NetBox for site data
   - Handles version management

2. **Draw.io Server** (`drawio-server.js`) - Port 8081
   - Serves the Draw.io application
   - Hosts the ArchiFlow plugin
   - Manages static assets

## Docker Architecture

```
┌─────────────────────────────────────────────────────┐
│                 Docker Network                       │
├──────────────┬──────────────┬──────────────────────┤
│   NetBox     │  ArchiFlow   │    ArchiFlow         │
│   (8000)     │  WebSocket   │    Draw.io           │
│              │   (3333)     │     (8081)           │
│              │              │                      │
│   Django     │  Node.js     │    Node.js           │
│   Plugin     │  websocket-  │    drawio-           │
│              │  server.js   │    server.js         │
└──────────────┴──────────────┴──────────────────────┘
                      │                 │
                      └────────┬────────┘
                               │
                    ┌──────────┴──────────┐
                    │   PostgreSQL        │
                    │   ArchiFlow DB      │
                    │     (5433)          │
                    └────────────────────┘
```

## Starting the System

### Using Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Restart specific service
docker-compose restart archiflow-backend
docker-compose restart archiflow-drawio
```

### Manual Start (Development Only)

```bash
# Terminal 1 - WebSocket Server
cd drawio-for-Archiflow/archiflow-export
node backend/websocket-server.js

# Terminal 2 - Draw.io Server
cd drawio-for-Archiflow/archiflow-export
node backend/drawio-server.js
```

## Service URLs

- **NetBox**: http://localhost:8000
- **ArchiFlow Editor**: http://localhost:8081
- **WebSocket**: ws://localhost:3333
- **pgAdmin**: http://localhost:5050
- **ArchiFlow PostgreSQL**: localhost:5433

## Environment Variables

Both services use these environment variables (set in docker-compose.yml):

```
DB_HOST=archiflow-postgres
DB_PORT=5432
DB_NAME=archiflow
DB_USER=archiflow_user
DB_PASSWORD=archiflow_pass
NETBOX_URL=http://netbox:8080
```

## File Structure

```
backend/
├── websocket-server.js     # Main WebSocket server
├── drawio-server.js        # Draw.io HTTP server
├── database/
│   ├── connection.js       # Database connection pool
│   ├── version-manager.js  # Diagram version management
│   ├── ip-manager.js       # IP allocation management
│   └── schema.sql          # Database schema
├── websocket/
│   └── broadcast-manager.js # Real-time collaboration
└── archived/               # Old/unused server files
```

## Troubleshooting

### Check Service Health

```bash
# Check if containers are running
docker ps

# Check WebSocket server logs
docker logs archiflow-backend

# Check Draw.io server logs
docker logs archiflow-drawio

# Test WebSocket connection
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:3333
```

### Common Issues

1. **Port Already in Use**
   ```bash
   # Find process using port
   lsof -i :3333  # or netstat -tulpn | grep 3333

   # Kill process
   kill -9 <PID>
   ```

2. **Database Connection Failed**
   - Check PostgreSQL container: `docker logs archiflow-postgres`
   - Verify credentials in docker-compose.yml
   - Ensure database is initialized: `docker exec archiflow-postgres psql -U archiflow_user -d archiflow -c '\dt'`

3. **WebSocket Connection Refused**
   - Check firewall settings
   - Verify WebSocket server is running: `docker exec archiflow-backend ps aux`
   - Check CORS settings in websocket-server.js

## Development Notes

- The system uses ES6 modules (`type: "module"` in package.json)
- WebSocket server handles all database operations
- Draw.io communicates via PostMessage API with the iframe
- All services auto-restart on failure in Docker
- Database schema is auto-initialized on first start

## Removed Files

The following files were archived as they're no longer needed:
- `dev-server.js` - Old development server
- `dev-server-db.js` - Duplicate functionality
- `simple-server.js` - Basic server, replaced by drawio-server.js
- `mcp-server.js` - MCP integration not needed

These files are kept in `backend/archived/` for reference but are not used.