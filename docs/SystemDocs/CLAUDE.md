# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ArchiFlow is a network infrastructure management platform that combines NetBox (Django-based DCIM/IPAM) with Draw.io visual network design capabilities.

## Critical Development Rules

**🚨 IMPORTANT: All ArchiFlow development happens in the `archiflow-export/` directory**
- NEVER modify files in `drawio-for-Archiflow/src/` (Draw.io core)
- The main development focus is the ArchiFlow plugin and backend services

## Project Structure

```
Archiflow/
├── netbox-main/           # NetBox DCIM/IPAM platform (Django)
│   ├── netbox/            # Core application
│   ├── scripts/           # Utility scripts
│   └── requirements.txt   # Python dependencies
│
├── drawio-for-Archiflow/  # Draw.io fork (DO NOT MODIFY src/)
│   └── src/main/webapp/   # Draw.io core webapp
│
└── archiflow-export/      # 🎯 MAIN DEVELOPMENT DIRECTORY
    ├── archiflow-plugin.js     # Main plugin (loaded into Draw.io)
    ├── server.js                # Express + WebSocket server
    ├── test-plugin.js           # Integration tests
    ├── docker-compose.yml       # PostgreSQL + pgAdmin
    └── sql/                     # Database schemas
```

## Technology Stack

- **Backend**: Django 5.2.5, Python 3.10+, PostgreSQL 15+, Redis 7.4+
- **ArchiFlow Server**: Node.js, Express, WebSocket (ws library)
- **Frontend**: Draw.io (modified), JavaScript plugin architecture
- **Database**: PostgreSQL with pgAdmin GUI
- **APIs**: Django REST Framework, GraphQL (Strawberry)

## Essential Development Commands

### ArchiFlow Development (in archiflow-export/)
```bash
# Start complete development environment
npm run dev                    # Starts PostgreSQL, WebSocket server, HTTP server

# Database operations
docker-compose up -d           # Start PostgreSQL + pgAdmin
docker-compose down            # Stop services
docker-compose down -v         # Stop and remove volumes (reset DB)

# Testing
npm test                       # Run integration tests

# Individual services
node server.js                 # Start WebSocket server (port 3333)
npx http-server -p 8081       # Start HTTP server for Draw.io
```

### NetBox Development (in netbox-main/)
```bash
# Initial setup
./upgrade.sh                   # Install dependencies and migrate DB

# Development
python manage.py runserver     # Start NetBox (port 8000)
python manage.py migrate       # Apply database migrations
python manage.py createsuperuser # Create admin user
python manage.py test          # Run tests
python manage.py shell_plus    # Enhanced Django shell

# Production
gunicorn --bind 0.0.0.0:8001 --workers 4 netbox.wsgi
```

## Development URLs

- **ArchiFlow Editor**: http://localhost:8081
- **NetBox Admin**: http://localhost:8000 (admin/admin)
- **pgAdmin**: http://localhost:5050 (admin@example.com/admin)
- **WebSocket Server**: ws://localhost:3333

## High-Level Architecture

### ArchiFlow Plugin System
The ArchiFlow plugin (`archiflow-plugin.js`) is loaded into Draw.io and communicates with the backend through WebSocket:

1. **Plugin Loading**: Draw.io loads the plugin via URL parameter
2. **WebSocket Connection**: Plugin establishes persistent connection to server.js
3. **Command Pattern**: All operations use command/response pattern
4. **Database Persistence**: Server handles PostgreSQL operations

### Key Plugin Commands
```javascript
// IP Management
{action: 'allocate_ip', subnet: '10.0.0.0/24'}
{action: 'release_ip', ip: '10.0.0.5'}

// Diagram Operations  
{action: 'save_diagram', content: mxGraphXML}
{action: 'load_diagram', id: diagramId}

// Device Catalog
{action: 'get_devices', category: 'router'}
{action: 'apply_template', template: 'vpc_standard'}
```

### Database Schema
- **ip_pools**: IP subnet management with allocation tracking
- **ip_allocations**: Individual IP assignments with metadata
- **diagrams**: Stored diagram XML with versioning
- **audit_log**: All operations tracked for compliance

## Current Development Status

### Completed Features (Sprint 1-8)
- ✅ Draw.io integration with custom plugin
- ✅ Automatic IP allocation from database pools
- ✅ Network device catalog (routers, switches, firewalls, etc.)
- ✅ Template system with variable substitution
- ✅ Real-time WebSocket communication
- ✅ Auto-save with 30-second intervals
- ✅ Database persistence with PostgreSQL
- ✅ Audit logging for all operations

### In Progress (Sprint 9)
- 🔄 Real-time collaboration features
- 🔄 NetBox integration for device synchronization
- 🔄 Advanced IPAM with subnet calculations

## Testing Approach

### ArchiFlow Plugin Testing
```bash
cd archiflow-export/
npm test  # Runs test-plugin.js with Puppeteer
```

Tests cover:
- WebSocket connection establishment
- IP allocation/deallocation
- Diagram save/load operations
- Template application
- Error handling

### NetBox Testing
```bash
cd netbox-main/
python manage.py test netbox.tests
python manage.py test dcim  # Test specific app
```

## Important Patterns

1. **WebSocket Command Pattern**: All plugin-server communication uses JSON commands with action/data structure
2. **Event-Driven Updates**: Draw.io UI updates triggered by WebSocket responses
3. **Database Connection Pooling**: Server maintains persistent PostgreSQL connections
4. **Audit Trail**: Every operation logged with user, timestamp, and details
5. **Error Recovery**: Automatic reconnection for WebSocket, transaction rollback for DB errors

## Development Tips

- Always test WebSocket connectivity first when debugging
- Use pgAdmin (http://localhost:5050) to inspect database state
- Browser console shows detailed plugin logs
- Server console (`node server.js`) shows all WebSocket traffic
- For Draw.io UI changes, modify only the plugin, never core Draw.io files