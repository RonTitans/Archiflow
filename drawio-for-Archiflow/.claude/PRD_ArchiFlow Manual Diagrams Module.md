📄 PRD – ArchiFlow Manual Diagrams Module
1. Overview

The Manual Diagrams Module extends ArchiFlow with an interactive drag & drop network diagram editor, integrated with the central database.
Unlike static drawings, these diagrams are live: each device is linked to assets, IP pools, DNS, and configurations.
The system ensures real-time synchronization, IP allocation, version control, and alerting during design.

2. Goals

Provide an intuitive, visual way for admins to design and update network topologies.

Ensure diagrams are not static images, but directly tied to the ArchiFlow database.

Enable automation (IP allocation, DNS settings) during diagram creation.

Support templates, versioning, and reusability.

Full auditability – every change is logged and reversible.

3. Key Features
3.1 Drag & Drop Diagram Creation

Blank canvas with network components (switch, router, firewall, server).

Library with predefined icons (Cisco-like).

Right-click context menu → “Add Device” → pick from list.

3.2 Device Metadata

Each node has:

Name (editable).

Linked Asset ID.

Assigned IP.

VLAN, Port info (optional).

3.3 Dynamic IP Allocation

When adding a device, user selects IP pool.

System allocates next free IP automatically.

Allocated IP displayed in the diagram.

Marked as “used” in DB immediately.

3.4 Templates with Variables

Users can create diagrams with placeholders ({{site_name}}, {{subnet}}).

At render, system replaces with actual values.

Reusable templates → consistency across diagrams.

3.5 Update Existing Diagram

Open diagram → add new devices.

Allocate new IPs from chosen pool.

Sync changes to DB and add to version history.

3.6 Versioning & History

Every save = new version in diagram_versions.

Option to view history, diff, and rollback.

3.7 Alerts

System validates allocations during editing.

Example: no free IP available → alert displayed.

Conflicts or invalid configs also trigger alerts.

3.8 Integration with Central DB

Assets, IPs, DNS records updated automatically.

Changes appear instantly in the central dashboard.

Consistency guaranteed via internal APIs.

4. User Stories
Creation

As a network admin, I want to create a new diagram from scratch, so I can design a topology visually.

As a user, I want to drag a switch/router/server onto the canvas, so I can represent physical assets.

As a user, I want to name a device directly in the diagram, so it’s clear what it represents.

IP Allocation

As an admin, I want to choose an IP pool when adding a device, so the system assigns a free IP.

As a user, I want the allocated IP to appear on the diagram, so I know which address is assigned.

As an admin, I want IP allocation to fail gracefully with an alert if no IPs are available, so I know there’s an issue.

Templates

As a user, I want to create a diagram template with variables, so I can reuse it across sites.

As an admin, I want variables to be replaced automatically when rendering, so I save time and avoid errors.

Updates

As a user, I want to open an existing diagram and add a new router, so I can reflect infrastructure changes.

As a system, I want to allocate IPs automatically for new devices, so consistency is maintained.

Versioning

As an admin, I want each save to create a version, so I can roll back if needed.

As a user, I want to view a version history, so I can track who changed what.

Integration

As a system, I want every new device added to a diagram to also exist in the Assets DB, so there’s no mismatch.

As a user, I want the diagram to update instantly when I add/remove assets, so it always matches reality.

5. Development Roadmap (Sprints)
Sprint 1: Basic Embed & Save

Integrate draw.io embed into ArchiFlow.

Enable saving diagrams to Postgres (diagram_versions).

Support export (PNG/SVG).

Sprint 2: Asset Nodes & Metadata

Add custom shapes for Switch/Router/Server.

Right-click menu: Add Device.

Store metadata (AssetId, Name, Type).

Sprint 3: IP Allocation

Connect to IPAM DB.

On device creation, allocate IP from chosen pool.

Display IP on node.

Sprint 4: Templates & Variables

Support placeholders in diagrams.

Replace with actual values on render.

Sprint 5: Versioning & Alerts

Track all changes with versions.

Add rollback option.

Show alerts when IP allocation fails.

Sprint 6: Full DB Integration

Sync assets and IPs automatically.

Ensure diagrams are reflected in central dashboard.

📌 End Result:
A live diagrams module where every drawing = a real-time reflection of the network, synced with DB, with templates, IP allocation, alerts, and versioning.