# pgAdmin Connection to ArchiFlow Database - FIXED INSTRUCTIONS

## Access pgAdmin
1. Open: http://localhost:5050
2. Login:
   - Email: `admin@archiflow.com`
   - Password: `admin123`

## Add ArchiFlow Database Server

### ⚠️ IMPORTANT: Use the correct host address!

Since pgAdmin is running in Docker and needs to connect to another Docker container, you have two options:

### Option 1: Use Docker Internal Host (Recommended)
1. Right-click on "Servers" → "Register" → "Server..."
2. **General Tab:**
   - Name: `ArchiFlow Database`
3. **Connection Tab:**
   - Host: `host.docker.internal`  ← This is the key!
   - Port: `5433`  ← External port mapping
   - Database: `archiflow`
   - Username: `archiflow_user`
   - Password: `archiflow_pass`
   - Save password: ✓

### Option 2: Use Container Name (If in same network)
1. Right-click on "Servers" → "Register" → "Server..."
2. **General Tab:**
   - Name: `ArchiFlow Database`
3. **Connection Tab:**
   - Host: `archiflow-postgres`  ← Container name
   - Port: `5432`  ← Internal port
   - Database: `archiflow`
   - Username: `archiflow_user`
   - Password: `archiflow_pass`
   - Save password: ✓

## Test Connection
Click "Save" and the connection should work. If you see an error:
- If "could not translate host name": Use `host.docker.internal` instead
- If "connection refused": Check that ArchiFlow postgres is running with `docker ps`

## Quick Verification Query
Once connected, run this in Query Tool:
```sql
SELECT * FROM archiflow.ip_pools;
```

You should see:
- pool-1: Management Network (10.0.0.0/24)
- pool-2: Production Network (192.168.1.0/24)

## Check Recent Allocations
```sql
SELECT * FROM archiflow.ip_allocations
ORDER BY allocated_at DESC
LIMIT 10;
```