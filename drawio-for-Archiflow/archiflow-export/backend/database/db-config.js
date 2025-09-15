/**
 * ArchiFlow Database Configuration
 * Supports both mock data and PostgreSQL
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const dbConfig = {
    // Database mode: 'mock' or 'postgresql'
    mode: process.env.DB_MODE || 'mock', // Default to mock for now
    
    // PostgreSQL configuration
    postgresql: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'archiflow',
        schema: process.env.DB_SCHEMA || 'archiflow',
        user: process.env.DB_USER || 'archiflow_user',
        password: process.env.DB_PASSWORD || 'archiflow_pass',
        
        // Connection pool settings
        pool: {
            max: 20,
            min: 2,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        }
    },
    
    // Mock data configuration
    mock: {
        // Mock data is stored in memory
        ipPools: [
            {
                id: 'POOL-001',
                name: 'Management Network',
                network: '10.0.1.0/24',
                gateway: '10.0.1.1',
                vlan_id: 100,
                available: ['10.0.1.20', '10.0.1.21', '10.0.1.22', '10.0.1.23', '10.0.1.24'],
                allocated: []
            },
            {
                id: 'POOL-002',
                name: 'Server Network',
                network: '10.0.2.0/24',
                gateway: '10.0.2.1',
                vlan_id: 200,
                available: ['10.0.2.10', '10.0.2.11', '10.0.2.12', '10.0.2.13', '10.0.2.14'],
                allocated: []
            },
            {
                id: 'POOL-003',
                name: 'DMZ Network',
                network: '10.0.3.0/24',
                gateway: '10.0.3.1',
                vlan_id: 300,
                available: ['10.0.3.5', '10.0.3.6', '10.0.3.7', '10.0.3.8', '10.0.3.9'],
                allocated: []
            }
        ],
        
        devices: [
            {
                asset_id: 'RTR-CORE-001',
                device_name: 'Core-Router-01',
                device_type: 'router',
                vendor: 'Cisco',
                model: 'ASR-1001-X',
                status: 'active',
                primary_ip: null
            },
            {
                asset_id: 'SW-CORE-001',
                device_name: 'Core-Switch-01',
                device_type: 'switch',
                vendor: 'Cisco',
                model: '3850-48P',
                status: 'active',
                primary_ip: null
            }
        ],
        
        diagrams: new Map(),
        templates: [],
        alerts: []
    }
};

// Helper to check if using real database
export function isUsingDatabase() {
    return dbConfig.mode === 'postgresql';
}

// Helper to get connection string
export function getConnectionString() {
    const cfg = dbConfig.postgresql;
    return `postgresql://${cfg.user}:${cfg.password}@${cfg.host}:${cfg.port}/${cfg.database}`;
}

// Log current mode
console.log(`[Database] Running in ${dbConfig.mode.toUpperCase()} mode`);
if (dbConfig.mode === 'postgresql') {
    console.log(`[Database] PostgreSQL: ${dbConfig.postgresql.host}:${dbConfig.postgresql.port}/${dbConfig.postgresql.database}`);
} else {
    console.log(`[Database] Using mock data with ${dbConfig.mock.ipPools.length} IP pools`);
}