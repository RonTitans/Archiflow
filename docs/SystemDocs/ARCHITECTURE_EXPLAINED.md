# ArchiFlow NetBox Integration - Architecture Explained

## Table of Contents
1. [Overview](#overview)
2. [Understanding the Architecture](#understanding-the-architecture)
3. [Folder Structure Breakdown](#folder-structure-breakdown)
4. [Docker vs Local Source Code](#docker-vs-local-source-code)
5. [What Can Be Deleted](#what-can-be-deleted)
6. [Recommended Structure](#recommended-structure)
7. [Common Misconceptions](#common-misconceptions)

---

## Overview

This document explains the complete architecture of the ArchiFlow-NetBox integration, clarifying what each component does and why certain folders exist.

### What This Project Actually Is
- **NetBox**: A pre-built DCIM/IPAM system (running from Docker)
- **ArchiFlow**: Your custom Draw.io-based network diagram tool
- **Integration**: A NetBox plugin that embeds ArchiFlow into NetBox's UI

### Key Insight
**NetBox runs entirely from a Docker image** - we don't need NetBox source code locally!

---

## Understanding the Architecture

### The Three-Layer Architecture

```
┌─────────────────────────────────────────────┐
│           NetBox UI (Port 8000)             │
│  ┌─────────────────────────────────────┐    │
│  │  NetBox ArchiFlow Plugin (Python)   │    │
│  │  - Creates menu items               │    │
│  │  - Provides templates               │    │
│  │  - Embeds iframe                    │    │
│  └────────────┬────────────────────────┘    │
│               │ iframe                       │
└───────────────┼─────────────────────────────┘
                │
┌───────────────▼─────────────────────────────┐
│     Draw.io + ArchiFlow (Port 8081)         │
│  - Complete web application                 │
│  - Node.js backend                          │
│  - WebSocket server (Port 3333)             │
│  - Own database                             │
└─────────────────────────────────────────────┘
```

### Why They Must Be Separate

| Component | Technology | Server Type | Size | Purpose |
|-----------|------------|-------------|------|---------|
| NetBox | Python/Django | WSGI/ASGI | ~50MB | DCIM/IPAM Management |
| Draw.io | JavaScript/HTML | Node.js | ~100MB | Diagram Drawing |
| ArchiFlow | JavaScript | WebSocket | ~5MB | Network Features |

**They cannot be merged because:**
- Different programming languages (Python vs JavaScript)
- Different server requirements (Django vs Node.js)
- Different runtime environments

---

## Folder Structure Breakdown

### Current Structure
```
F:/Archiflow/
├── docker-compose.yml              # ✅ ESSENTIAL - Orchestrates all services
├── .env                           # ✅ ESSENTIAL - Environment variables
├── drawio-for-Archiflow/         # ✅ ESSENTIAL - Your main application
│   ├── src/main/webapp/          # Draw.io original files
│   └── archiflow-export/          # ✅ CRITICAL - Your custom code
│       ├── backend/               # Node.js server & WebSocket
│       ├── frontend/plugins/      # ArchiFlow plugin for Draw.io
│       └── webapp/                # Symlink to Draw.io files
├── netbox-archiflow-plugin/      # ✅ ESSENTIAL - NetBox integration
│   └── netbox_archiflow/         # Python plugin package
├── netbox-config/                # ✅ ESSENTIAL - NetBox configuration
│   ├── plugins.py                # Enables ArchiFlow plugin
│   └── install-plugin.sh         # Auto-installs plugin
├── netbox-main/                  # ❌ NOT USED - Can delete!
├── docs/                          # 📚 Optional - Documentation
└── [various test files]           # 🧹 Can be cleaned up
```

### What Each Folder Really Does

#### ✅ **ESSENTIAL FOLDERS**

**1. `drawio-for-Archiflow/archiflow-export/`**
- **This IS your application!**
- Contains YOUR custom backend server
- Has the ArchiFlow plugin code
- Manages IP allocation, device management
- Cannot be deleted or moved

**2. `netbox-archiflow-plugin/`**
- Small Python package (~10 files)
- Creates menu items in NetBox
- Provides templates to embed Draw.io
- Acts as a "bridge" between NetBox and Draw.io

**3. `netbox-config/`**
- Configuration files mounted into Docker
- Tells NetBox to load your plugin
- Contains installation scripts

#### ❌ **NOT USED**

**`netbox-main/`**
- Downloaded NetBox source code
- **NEVER USED** - Docker provides NetBox
- Safe to delete entirely
- Was probably downloaded for reference

---

## Docker vs Local Source Code

### The Confusion Explained

Many people think they need NetBox source code locally. **This is wrong!**

#### How Docker Actually Works:

```yaml
# From docker-compose.yml
netbox:
  image: netboxcommunity/netbox:v4.0-2.9.1  # <-- Complete NetBox is HERE!
```

This Docker image contains:
- Full NetBox application
- Python environment
- All dependencies
- Web server

**You DON'T need:**
- NetBox source code
- Python installed locally
- Django installed locally
- NetBox dependencies

#### What Actually Happens:

1. Docker downloads the NetBox image (contains everything)
2. Your plugin is mounted as a volume into the container
3. The install script adds your plugin to the running NetBox
4. NetBox runs from the Docker image, not from local files

---

## What Can Be Deleted

### Safe to Delete ✅

| Folder/File | Reason | Size Saved |
|-------------|--------|------------|
| `netbox-main/` | Unused NetBox source | ~50MB |
| `plugin_output.html` | Test file | 100KB |
| `test_plugin.py` | Test file | 2KB |
| `test_plugin2.py` | Test file | 2KB |
| `install-netbox-plugin.sh` | Old script | 1KB |
| `install-plugin.sh` | Old script | 1KB |
| `apache-cors.conf` | Unused config | 1KB |

### Must Keep ❌

| Folder/File | Why Essential |
|-------------|---------------|
| `drawio-for-Archiflow/` | Your actual application |
| `netbox-archiflow-plugin/` | Integration layer |
| `docker-compose.yml` | Runs everything |
| `netbox-config/` | Configuration |
| `.env` | Environment settings |

---

## Recommended Structure

### Minimal Clean Structure
```
Archiflow/
├── docker-compose.yml
├── .env
├── README.md
├── ARCHITECTURE_EXPLAINED.md (this file)
├── drawio-archiflow/              # Renamed for clarity
│   ├── webapp/                    # Draw.io files
│   ├── backend/                   # Your Node.js server
│   ├── plugins/                   # ArchiFlow plugin
│   └── package.json
├── netbox-plugin/                 # Renamed for clarity
│   ├── netbox_archiflow/
│   ├── setup.py
│   └── MANIFEST.in
└── config/                        # Renamed from netbox-config
    ├── plugins.py
    └── install-plugin.sh
```

### Benefits of This Structure
- Clear separation of concerns
- Obvious what each folder does
- No confusion about what's needed
- Easy to maintain

---

## Common Misconceptions

### Misconception 1: "netbox-main is the core"
**Reality:** NetBox runs from Docker image, not local source

### Misconception 2: "Draw.io can be a NetBox plugin"
**Reality:** Draw.io is too large and uses different technology

### Misconception 3: "Everything should be in one folder"
**Reality:** These are separate applications that communicate

### Misconception 4: "We're modifying NetBox"
**Reality:** We're adding a plugin, not changing NetBox itself

---

## How It All Works Together

### Startup Sequence
1. Docker Compose starts all containers
2. NetBox container downloads and runs NetBox image
3. Install script adds your plugin to NetBox
4. ArchiFlow backend starts Node.js server
5. Draw.io files are served from Node.js
6. NetBox plugin creates menu items and pages
7. User accesses NetBox → clicks ArchiFlow → sees Draw.io in iframe

### Data Flow
```
User → NetBox UI → Plugin Template → iframe → Draw.io → WebSocket → Backend → Database
```

---

## Cleanup Commands

To safely clean up unnecessary files:

```bash
# Remove unused NetBox source
rm -rf netbox-main/

# Remove test files
rm plugin_output.html test_plugin.py test_plugin2.py

# Remove old scripts
rm install-netbox-plugin.sh install-plugin.sh apache-cors.conf

# Optional: Rename folders for clarity
mv drawio-for-Archiflow drawio-archiflow
mv netbox-archiflow-plugin netbox-plugin
mv netbox-config config
```

---

## Summary

- **NetBox** runs from Docker, not from local source code
- **Draw.io/ArchiFlow** must be separate (different technology)
- **The plugin** is just a small bridge between them
- **netbox-main/** folder is completely unnecessary
- The complex structure exists because these are **two different applications** working together

This is the **minimum viable structure** for this architecture. It cannot be simplified further without changing the fundamental design of having Draw.io as a separate application integrated into NetBox.

---

## Questions?

If you're still confused about any aspect of this architecture, remember:
1. NetBox = Docker image (no local source needed)
2. Draw.io = Separate JavaScript app (cannot be merged with NetBox)
3. Plugin = Small Python bridge (just provides UI integration)

The folder structure reflects this three-part architecture and cannot be simplified without losing functionality.