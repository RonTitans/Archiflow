/**
 * IP Management Database Operations
 * Handles all IP pool and allocation operations with PostgreSQL
 */

import { query, getClient } from './connection.js';
import { dbConfig } from './db-config.js';

/**
 * IP Pool Operations
 */
export const IPPoolManager = {
    /**
     * Get all IP pools
     */
    async getAllPools() {
        if (dbConfig.mode === 'mock') {
            return dbConfig.mock.ipPools;
        }

        const result = await query(`
            SELECT 
                p.*,
                COUNT(DISTINCT a.ip_address) FILTER (WHERE a.is_active = true) as allocated_count,
                array_agg(DISTINCT a.ip_address ORDER BY a.ip_address) FILTER (WHERE a.is_active = true) as allocated_ips
            FROM archiflow.ip_pools p
            LEFT JOIN archiflow.ip_allocations a ON p.id = a.pool_id
            WHERE p.is_active = true
            GROUP BY p.id
            ORDER BY p.name
        `);

        // Transform to match mock format
        return result.rows.map(pool => ({
            id: pool.id,
            name: pool.name,
            network: pool.network,
            gateway: pool.gateway,
            vlan_id: pool.vlan_id,
            description: pool.description,
            dns_servers: pool.dns_servers || [],
            allocated_count: parseInt(pool.allocated_count) || 0,
            allocated: pool.allocated_ips?.filter(ip => ip !== null) || []
        }));
    },

    /**
     * Get specific IP pool by ID
     */
    async getPoolById(poolId) {
        if (dbConfig.mode === 'mock') {
            return dbConfig.mock.ipPools.find(p => p.id === poolId);
        }

        const result = await query(`
            SELECT * FROM archiflow.ip_pools 
            WHERE id = $1 AND is_active = true
        `, [poolId]);

        return result.rows[0];
    },

    /**
     * Get available IPs for a pool
     */
    async getAvailableIPs(poolId, limit = 10) {
        if (dbConfig.mode === 'mock') {
            const pool = dbConfig.mock.ipPools.find(p => p.id === poolId);
            return pool ? pool.available.slice(0, limit) : [];
        }

        // Get pool network info
        const poolResult = await query(`
            SELECT network, gateway FROM archiflow.ip_pools 
            WHERE id = $1 AND is_active = true
        `, [poolId]);

        if (poolResult.rows.length === 0) {
            return [];
        }

        const pool = poolResult.rows[0];
        
        // Get allocated IPs for this pool
        const allocatedResult = await query(`
            SELECT ip_address FROM archiflow.ip_allocations 
            WHERE pool_id = $1 AND is_active = true
        `, [poolId]);

        const allocatedIPs = new Set(allocatedResult.rows.map(r => r.ip_address));
        
        // Calculate available IPs (simplified - just return first few available)
        const available = [];
        const network = pool.network;
        
        // Parse network to get base IP and calculate range
        // For simplicity, we'll just check the first 20 IPs after the gateway
        const baseIP = parseInt(pool.gateway.split('.').pop());
        const networkParts = pool.gateway.split('.').slice(0, 3).join('.');
        
        for (let i = baseIP + 1; i <= Math.min(baseIP + 20, 254) && available.length < limit; i++) {
            const testIP = `${networkParts}.${i}`;
            if (!allocatedIPs.has(testIP)) {
                available.push(testIP);
            }
        }
        
        return available;
    },

    /**
     * Create new IP pool
     */
    async createPool(poolData) {
        if (dbConfig.mode === 'mock') {
            dbConfig.mock.ipPools.push(poolData);
            return poolData;
        }

        const result = await query(`
            INSERT INTO archiflow.ip_pools (
                id, name, network, gateway, vlan_id, description, dns_servers, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            poolData.id,
            poolData.name,
            poolData.network,
            poolData.gateway,
            poolData.vlan_id,
            poolData.description,
            poolData.dns_servers || [],
            poolData.created_by || 'system'
        ]);

        return result.rows[0];
    }
};

/**
 * IP Allocation Operations
 */
export const IPAllocationManager = {
    /**
     * Allocate an IP address
     */
    async allocateIP(poolId, deviceId, deviceName, deviceType, allocatedBy = 'system') {
        if (dbConfig.mode === 'mock') {
            const pool = dbConfig.mock.ipPools.find(p => p.id === poolId);
            if (!pool || pool.available.length === 0) {
                return { success: false, message: 'No available IPs in pool' };
            }

            const ip = pool.available.shift();
            pool.allocated.push(ip);
            
            return {
                success: true,
                ip_address: ip,
                message: 'IP allocated successfully'
            };
        }

        const result = await query(`
            SELECT * FROM archiflow.allocate_ip($1, $2, $3, $4, $5)
        `, [poolId, deviceId, deviceName, deviceType, allocatedBy]);

        return result.rows[0];
    },

    /**
     * Release an IP address
     */
    async releaseIP(ipAddress, poolId, releasedBy = 'system') {
        if (dbConfig.mode === 'mock') {
            const pool = dbConfig.mock.ipPools.find(p => p.id === poolId);
            if (pool) {
                const index = pool.allocated.indexOf(ipAddress);
                if (index > -1) {
                    pool.allocated.splice(index, 1);
                    pool.available.push(ipAddress);
                }
            }
            return { success: true, message: 'IP released successfully' };
        }

        const result = await query(`
            SELECT * FROM archiflow.release_ip($1, $2, $3)
        `, [ipAddress, poolId, releasedBy]);

        return result.rows[0];
    },

    /**
     * Get all allocations for a device
     */
    async getDeviceAllocations(deviceId) {
        if (dbConfig.mode === 'mock') {
            // Mock implementation would search through pools
            return [];
        }

        const result = await query(`
            SELECT 
                a.*,
                p.name as pool_name,
                p.network,
                p.vlan_id
            FROM archiflow.ip_allocations a
            JOIN archiflow.ip_pools p ON a.pool_id = p.id
            WHERE a.asset_id = $1 AND a.is_active = true
            ORDER BY a.allocated_at DESC
        `, [deviceId]);

        return result.rows;
    },

    /**
     * Get allocation history
     */
    async getAllocationHistory(limit = 50) {
        if (dbConfig.mode === 'mock') {
            return [];
        }

        const result = await query(`
            SELECT 
                a.*,
                p.name as pool_name,
                d.device_name,
                d.device_type
            FROM archiflow.ip_allocations a
            JOIN archiflow.ip_pools p ON a.pool_id = p.id
            LEFT JOIN archiflow.network_devices d ON a.asset_id = d.asset_id
            ORDER BY a.allocated_at DESC
            LIMIT $1
        `, [limit]);

        return result.rows;
    }
};

/**
 * Device Operations
 */
export const DeviceManager = {
    /**
     * Get all devices
     */
    async getAllDevices() {
        if (dbConfig.mode === 'mock') {
            return dbConfig.mock.devices;
        }

        const result = await query(`
            SELECT 
                d.*,
                array_agg(
                    jsonb_build_object(
                        'ip_address', a.ip_address,
                        'pool_id', a.pool_id,
                        'allocated_at', a.allocated_at
                    ) ORDER BY a.allocated_at DESC
                ) FILTER (WHERE a.ip_address IS NOT NULL) as ip_allocations
            FROM archiflow.network_devices d
            LEFT JOIN archiflow.ip_allocations a ON d.asset_id = a.asset_id AND a.is_active = true
            WHERE d.status != 'decommissioned'
            GROUP BY d.asset_id
            ORDER BY d.device_name
        `);

        return result.rows;
    },

    /**
     * Create or update device
     */
    async upsertDevice(deviceData) {
        if (dbConfig.mode === 'mock') {
            const existingIndex = dbConfig.mock.devices.findIndex(d => d.asset_id === deviceData.asset_id);
            if (existingIndex >= 0) {
                dbConfig.mock.devices[existingIndex] = { ...dbConfig.mock.devices[existingIndex], ...deviceData };
            } else {
                dbConfig.mock.devices.push(deviceData);
            }
            return deviceData;
        }

        const result = await query(`
            INSERT INTO archiflow.network_devices (
                asset_id, device_name, device_type, vendor, model, 
                serial_number, location, status, metadata, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (asset_id) DO UPDATE SET
                device_name = EXCLUDED.device_name,
                device_type = EXCLUDED.device_type,
                vendor = EXCLUDED.vendor,
                model = EXCLUDED.model,
                location = EXCLUDED.location,
                status = EXCLUDED.status,
                metadata = EXCLUDED.metadata,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [
            deviceData.asset_id,
            deviceData.device_name,
            deviceData.device_type,
            deviceData.vendor,
            deviceData.model,
            deviceData.serial_number,
            deviceData.location,
            deviceData.status || 'active',
            JSON.stringify(deviceData.metadata || {}),
            deviceData.created_by || 'system'
        ]);

        return result.rows[0];
    }
};

/**
 * Diagram Operations
 */
export const DiagramManager = {
    /**
     * Save diagram
     */
    async saveDiagram(diagramData) {
        if (dbConfig.mode === 'mock') {
            dbConfig.mock.diagrams.set(diagramData.id, diagramData);
            return diagramData;
        }

        const client = await getClient();
        try {
            await client.query('BEGIN');

            // Check if diagram exists
            const existing = await client.query(
                'SELECT id, version FROM archiflow.diagrams WHERE id = $1',
                [diagramData.id]
            );

            let version = 1;
            if (existing.rows.length > 0) {
                version = existing.rows[0].version + 1;

                // Archive current version
                await client.query(`
                    INSERT INTO archiflow.diagram_versions (
                        diagram_id, version_number, name, diagram_xml, diagram_json, 
                        change_summary, created_by, is_current
                    )
                    SELECT 
                        id, version, name, diagram_xml, diagram_json,
                        $1, $2, false
                    FROM archiflow.diagrams
                    WHERE id = $3
                `, ['Auto-saved version', diagramData.updated_by || 'system', diagramData.id]);
            }

            // Upsert diagram
            const result = await client.query(`
                INSERT INTO archiflow.diagrams (
                    id, name, description, diagram_xml, diagram_json, 
                    version, created_by, updated_by, tags, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    diagram_xml = EXCLUDED.diagram_xml,
                    diagram_json = EXCLUDED.diagram_json,
                    version = EXCLUDED.version,
                    updated_at = CURRENT_TIMESTAMP,
                    updated_by = EXCLUDED.updated_by,
                    tags = EXCLUDED.tags,
                    metadata = EXCLUDED.metadata
                RETURNING *
            `, [
                diagramData.id,
                diagramData.name,
                diagramData.description,
                diagramData.diagram_xml,
                JSON.stringify(diagramData.diagram_json || {}),
                version,
                diagramData.created_by || 'system',
                diagramData.updated_by || 'system',
                diagramData.tags || [],
                JSON.stringify(diagramData.metadata || {})
            ]);

            await client.query('COMMIT');
            return result.rows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    },

    /**
     * Load diagram
     */
    async loadDiagram(diagramId, versionNumber = null) {
        if (dbConfig.mode === 'mock') {
            return dbConfig.mock.diagrams.get(diagramId);
        }

        // If version specified, load from diagram_versions
        if (versionNumber !== null) {
            const result = await query(`
                SELECT * FROM archiflow.diagram_versions
                WHERE diagram_id = $1 AND version_number = $2
            `, [diagramId, versionNumber]);

            if (result.rows.length > 0) {
                const version = result.rows[0];
                // Parse JSON fields and format as diagram
                return {
                    id: version.diagram_id,
                    name: version.name,
                    description: version.change_summary,
                    diagram_xml: version.diagram_xml,
                    diagram_json: typeof version.diagram_json === 'string' 
                        ? JSON.parse(version.diagram_json) 
                        : version.diagram_json,
                    version: version.version_number,
                    created_at: version.created_at,
                    updated_at: version.created_at,
                    created_by: version.created_by,
                    updated_by: version.created_by
                };
            }
        } else {
            // Load latest version from diagram_versions
            const result = await query(`
                SELECT * FROM archiflow.diagram_versions 
                WHERE diagram_id = $1 
                ORDER BY version_number DESC
                LIMIT 1
            `, [diagramId]);

            if (result.rows.length > 0) {
                const version = result.rows[0];
                // Parse JSON fields and format as diagram
                return {
                    id: version.diagram_id,
                    name: version.name,
                    description: version.change_summary,
                    diagram_xml: version.diagram_xml,
                    diagram_json: typeof version.diagram_json === 'string' 
                        ? JSON.parse(version.diagram_json) 
                        : version.diagram_json,
                    version: version.version_number,
                    created_at: version.created_at,
                    updated_at: version.created_at,
                    created_by: version.created_by,
                    updated_by: version.created_by
                };
            }
        }
        return null;
    },

    /**
     * List all diagrams with their versions
     */
    async listDiagrams() {
        if (dbConfig.mode === 'mock') {
            return Array.from(dbConfig.mock.diagrams.values());
        }

        // Get manual saves from diagram_versions table (not auto-saves)
        const result = await query(`
            SELECT DISTINCT ON (dv.diagram_id)
                dv.diagram_id as id,
                dv.name,
                dv.change_summary as description,
                dv.version_number as version,
                dv.created_at,
                dv.created_at as updated_at,
                dv.created_by,
                dv.created_by as updated_by,
                dv.is_current
            FROM archiflow.diagram_versions dv
            WHERE dv.change_summary NOT LIKE 'Auto-saved%'
              AND dv.name NOT LIKE 'Auto-saved%'
            ORDER BY dv.diagram_id, dv.version_number DESC
        `);

        return result.rows;
    },
    
    /**
     * Get diagram versions
     */
    async getDiagramVersions(diagramId) {
        const result = await query(`
            SELECT 
                dv.id,
                dv.diagram_id,
                dv.version_number,
                dv.name,
                dv.change_summary,
                dv.created_at,
                dv.created_by,
                dv.is_current
            FROM archiflow.diagram_versions dv
            WHERE dv.diagram_id = $1
            ORDER BY dv.version_number DESC
        `, [diagramId]);

        return result.rows;
    },
    
    /**
     * Load specific diagram version
     */
    async loadDiagramVersion(diagramId, versionNumber) {
        const result = await query(`
            SELECT * FROM archiflow.diagram_versions
            WHERE diagram_id = $1 AND version_number = $2
        `, [diagramId, versionNumber]);

        if (result.rows.length > 0) {
            const version = result.rows[0];
            // Parse JSON fields
            version.diagram_json = typeof version.diagram_json === 'string' 
                ? JSON.parse(version.diagram_json) 
                : version.diagram_json;
            return version;
        }
        return null;
    }
};