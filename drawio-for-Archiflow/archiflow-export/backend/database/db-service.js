/**
 * ArchiFlow Database Service Layer
 * Provides unified interface for both mock and PostgreSQL operations
 */

import { dbConfig, isUsingDatabase } from './db-config.js';
import pg from 'pg';

class DatabaseService {
    constructor() {
        this.pool = null;
        this.mockData = dbConfig.mock;
        
        if (isUsingDatabase()) {
            this.initPostgreSQL();
        } else {
            console.log('[DB Service] Using mock data store');
        }
    }
    
    // Initialize PostgreSQL connection pool
    async initPostgreSQL() {
        try {
            const { Pool } = pg;
            this.pool = new Pool({
                ...dbConfig.postgresql,
                connectionString: `postgresql://${dbConfig.postgresql.user}:${dbConfig.postgresql.password}@${dbConfig.postgresql.host}:${dbConfig.postgresql.port}/${dbConfig.postgresql.database}`
            });
            
            // Test connection
            const client = await this.pool.connect();
            console.log('[DB Service] PostgreSQL connected successfully');
            client.release();
        } catch (error) {
            console.error('[DB Service] PostgreSQL connection failed:', error.message);
            console.log('[DB Service] Falling back to mock data');
            dbConfig.mode = 'mock';
        }
    }
    
    // ========================================
    // IP POOL OPERATIONS
    // ========================================
    
    async getIPPools(includeAllocations = false) {
        if (isUsingDatabase()) {
            try {
                const query = `
                    SELECT 
                        p.*,
                        COUNT(a.id) FILTER (WHERE a.is_active = true) as allocated_count,
                        COALESCE(
                            json_agg(
                                json_build_object(
                                    'ip', a.ip_address,
                                    'asset_id', a.asset_id,
                                    'device_name', a.device_name
                                ) 
                            ) FILTER (WHERE a.is_active = true), 
                            '[]'
                        ) as allocations
                    FROM archiflow.ip_pools p
                    LEFT JOIN archiflow.ip_allocations a ON p.id = a.pool_id
                    WHERE p.is_active = true
                    GROUP BY p.id
                    ORDER BY p.name
                `;
                
                const result = await this.pool.query(query);
                return result.rows.map(pool => ({
                    id: pool.id,
                    name: pool.name,
                    network: pool.network,
                    gateway: pool.gateway,
                    vlan_id: pool.vlan_id,
                    allocated: includeAllocations ? pool.allocations : [],
                    allocated_count: pool.allocated_count
                }));
            } catch (error) {
                console.error('[DB Service] Error getting IP pools:', error);
                throw error;
            }
        } else {
            // Return mock data
            return this.mockData.ipPools.map(pool => ({
                id: pool.id,
                name: pool.name,
                network: pool.network,
                gateway: pool.gateway,
                vlan_id: pool.vlan_id,
                available: pool.available,
                allocated: pool.allocated
            }));
        }
    }
    
    async allocateIP(poolId, assetId, deviceName, deviceType, allocatedBy = 'system') {
        if (isUsingDatabase()) {
            try {
                const query = `
                    SELECT * FROM archiflow.allocate_ip($1, $2, $3, $4, $5)
                `;
                
                const result = await this.pool.query(query, [
                    poolId, assetId, deviceName, deviceType, allocatedBy
                ]);
                
                if (result.rows[0].success) {
                    return {
                        success: true,
                        ip: result.rows[0].ip_address,
                        message: result.rows[0].message
                    };
                } else {
                    return {
                        success: false,
                        error: result.rows[0].message
                    };
                }
            } catch (error) {
                console.error('[DB Service] Error allocating IP:', error);
                throw error;
            }
        } else {
            // Mock allocation
            const pool = this.mockData.ipPools.find(p => p.id === poolId);
            if (!pool || pool.available.length === 0) {
                return { success: false, error: 'No IPs available in pool' };
            }
            
            const ip = pool.available.shift();
            pool.allocated.push({
                ip: ip,
                assetId: assetId,
                deviceName: deviceName,
                allocatedAt: new Date().toISOString()
            });
            
            console.log(`[Mock DB] Allocated IP ${ip} to ${deviceName}`);
            return { success: true, ip: ip, subnet: '255.255.255.0' };
        }
    }
    
    async releaseIP(poolId, ip, releasedBy = 'system') {
        if (isUsingDatabase()) {
            try {
                const query = `
                    SELECT * FROM archiflow.release_ip($1, $2, $3)
                `;
                
                const result = await this.pool.query(query, [ip, poolId, releasedBy]);
                
                return {
                    success: result.rows[0].success,
                    message: result.rows[0].message
                };
            } catch (error) {
                console.error('[DB Service] Error releasing IP:', error);
                throw error;
            }
        } else {
            // Mock release
            const pool = this.mockData.ipPools.find(p => p.id === poolId);
            if (!pool) {
                return { success: false, error: 'Pool not found' };
            }
            
            const allocationIndex = pool.allocated.findIndex(a => a.ip === ip);
            if (allocationIndex !== -1) {
                pool.allocated.splice(allocationIndex, 1);
                pool.available.push(ip);
                console.log(`[Mock DB] Released IP ${ip}`);
                return { success: true, message: `IP ${ip} released` };
            }
            
            return { success: false, error: 'IP not found in allocations' };
        }
    }
    
    async getIPUsage() {
        if (isUsingDatabase()) {
            try {
                const query = `
                    SELECT 
                        pool_id,
                        pool_name,
                        network,
                        allocated_count,
                        total_ips,
                        utilization_percent
                    FROM archiflow.ip_pool_usage
                    ORDER BY pool_name
                `;
                
                const result = await this.pool.query(query);
                return result.rows;
            } catch (error) {
                console.error('[DB Service] Error getting IP usage:', error);
                throw error;
            }
        } else {
            // Mock usage calculation
            return this.mockData.ipPools.map(pool => {
                const totalIps = pool.available.length + pool.allocated.length;
                const allocatedIps = pool.allocated.length;
                
                return {
                    poolId: pool.id,
                    poolName: pool.name,
                    network: pool.network,
                    totalIps: totalIps,
                    allocatedIps: allocatedIps,
                    availableIps: pool.available.length,
                    utilizationPercent: totalIps > 0 ? Math.round((allocatedIps / totalIps) * 100) : 0
                };
            });
        }
    }
    
    // ========================================
    // DEVICE OPERATIONS
    // ========================================
    
    async getDevices(filter = {}) {
        if (isUsingDatabase()) {
            try {
                let query = `
                    SELECT 
                        d.*,
                        a.ip_address as allocated_ip,
                        a.pool_id
                    FROM archiflow.network_devices d
                    LEFT JOIN archiflow.ip_allocations a 
                        ON d.asset_id = a.asset_id AND a.is_active = true
                    WHERE 1=1
                `;
                
                const params = [];
                if (filter.status) {
                    params.push(filter.status);
                    query += ` AND d.status = $${params.length}`;
                }
                if (filter.device_type) {
                    params.push(filter.device_type);
                    query += ` AND d.device_type = $${params.length}`;
                }
                
                query += ' ORDER BY d.device_name';
                
                const result = await this.pool.query(query, params);
                return result.rows;
            } catch (error) {
                console.error('[DB Service] Error getting devices:', error);
                throw error;
            }
        } else {
            // Return mock devices
            return this.mockData.devices;
        }
    }
    
    async createDevice(deviceData) {
        if (isUsingDatabase()) {
            try {
                const query = `
                    INSERT INTO archiflow.network_devices 
                    (asset_id, device_name, device_type, vendor, model, status, created_by)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING *
                `;
                
                const result = await this.pool.query(query, [
                    deviceData.asset_id,
                    deviceData.device_name,
                    deviceData.device_type,
                    deviceData.vendor || null,
                    deviceData.model || null,
                    deviceData.status || 'active',
                    deviceData.created_by || 'system'
                ]);
                
                return result.rows[0];
            } catch (error) {
                console.error('[DB Service] Error creating device:', error);
                throw error;
            }
        } else {
            // Mock device creation
            this.mockData.devices.push(deviceData);
            return deviceData;
        }
    }
    
    // ========================================
    // DIAGRAM OPERATIONS
    // ========================================
    
    async saveDiagram(diagramData) {
        if (isUsingDatabase()) {
            try {
                const query = `
                    INSERT INTO archiflow.diagrams 
                    (id, name, description, diagram_xml, created_by)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        diagram_xml = EXCLUDED.diagram_xml,
                        updated_at = CURRENT_TIMESTAMP,
                        updated_by = EXCLUDED.created_by,
                        version = diagrams.version + 1
                    RETURNING *
                `;
                
                const id = diagramData.id || 'diagram-' + Date.now();
                const result = await this.pool.query(query, [
                    id,
                    diagramData.name,
                    diagramData.description || null,
                    diagramData.xml,
                    diagramData.created_by || 'system'
                ]);
                
                // Also save to version history
                await this.saveDiagramVersion(result.rows[0]);
                
                return result.rows[0];
            } catch (error) {
                console.error('[DB Service] Error saving diagram:', error);
                throw error;
            }
        } else {
            // Mock diagram save
            const id = diagramData.id || 'diagram-' + Date.now();
            this.mockData.diagrams.set(id, {
                ...diagramData,
                id: id,
                savedAt: new Date().toISOString()
            });
            return { id: id, success: true };
        }
    }
    
    async saveDiagramVersion(diagram) {
        if (isUsingDatabase()) {
            try {
                const query = `
                    INSERT INTO archiflow.diagram_versions 
                    (diagram_id, version_number, name, diagram_xml, created_by)
                    VALUES ($1, $2, $3, $4, $5)
                `;
                
                await this.pool.query(query, [
                    diagram.id,
                    diagram.version,
                    diagram.name,
                    diagram.diagram_xml,
                    diagram.updated_by || diagram.created_by
                ]);
            } catch (error) {
                console.error('[DB Service] Error saving diagram version:', error);
            }
        }
    }
    
    async loadDiagram(diagramId) {
        if (isUsingDatabase()) {
            try {
                const query = `
                    SELECT * FROM archiflow.diagrams WHERE id = $1
                `;
                
                const result = await this.pool.query(query, [diagramId]);
                return result.rows[0] || null;
            } catch (error) {
                console.error('[DB Service] Error loading diagram:', error);
                throw error;
            }
        } else {
            // Mock diagram load
            return this.mockData.diagrams.get(diagramId) || null;
        }
    }
    
    async getDiagramVersions(diagramId) {
        if (isUsingDatabase()) {
            try {
                const query = `
                    SELECT * FROM archiflow.diagram_versions 
                    WHERE diagram_id = $1
                    ORDER BY version_number DESC
                `;
                
                const result = await this.pool.query(query, [diagramId]);
                return result.rows;
            } catch (error) {
                console.error('[DB Service] Error getting diagram versions:', error);
                throw error;
            }
        } else {
            // Mock - return empty array for now
            return [];
        }
    }
    
    // ========================================
    // ALERT OPERATIONS
    // ========================================
    
    async createAlert(alertData) {
        if (isUsingDatabase()) {
            try {
                const query = `
                    INSERT INTO archiflow.alerts 
                    (alert_type, severity, source, message, details)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING *
                `;
                
                const result = await this.pool.query(query, [
                    alertData.alert_type,
                    alertData.severity,
                    alertData.source,
                    alertData.message,
                    JSON.stringify(alertData.details || {})
                ]);
                
                return result.rows[0];
            } catch (error) {
                console.error('[DB Service] Error creating alert:', error);
                throw error;
            }
        } else {
            // Mock alert creation
            const alert = {
                ...alertData,
                id: Date.now(),
                created_at: new Date().toISOString()
            };
            this.mockData.alerts.push(alert);
            return alert;
        }
    }
    
    async getAlerts(filter = {}) {
        if (isUsingDatabase()) {
            try {
                let query = `
                    SELECT * FROM archiflow.alerts WHERE 1=1
                `;
                
                const params = [];
                if (filter.resolved !== undefined) {
                    params.push(filter.resolved);
                    query += ` AND resolved = $${params.length}`;
                }
                if (filter.severity) {
                    params.push(filter.severity);
                    query += ` AND severity = $${params.length}`;
                }
                
                query += ' ORDER BY created_at DESC LIMIT 100';
                
                const result = await this.pool.query(query, params);
                return result.rows;
            } catch (error) {
                console.error('[DB Service] Error getting alerts:', error);
                throw error;
            }
        } else {
            // Return mock alerts
            return this.mockData.alerts;
        }
    }
    
    // ========================================
    // AUDIT OPERATIONS
    // ========================================
    
    async logAudit(action, entityType, entityId, oldValue, newValue, userId) {
        if (isUsingDatabase()) {
            try {
                const query = `
                    INSERT INTO archiflow.audit_log 
                    (action, entity_type, entity_id, old_value, new_value, user_id)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `;
                
                await this.pool.query(query, [
                    action,
                    entityType,
                    entityId,
                    oldValue ? JSON.stringify(oldValue) : null,
                    newValue ? JSON.stringify(newValue) : null,
                    userId
                ]);
            } catch (error) {
                console.error('[DB Service] Error logging audit:', error);
            }
        } else {
            // Mock audit log
            console.log(`[Audit] ${action} on ${entityType}:${entityId} by ${userId}`);
        }
    }
    
    // Cleanup
    async close() {
        if (this.pool) {
            await this.pool.end();
            console.log('[DB Service] PostgreSQL connection pool closed');
        }
    }
}

// Export singleton instance
export const dbService = new DatabaseService();
export default dbService;