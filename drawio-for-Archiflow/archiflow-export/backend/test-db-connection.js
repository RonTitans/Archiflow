/**
 * Test Database Connection
 * Verifies PostgreSQL connection and basic operations
 */

import { initializeDatabase, testConnection, closeDatabase } from './database/connection.js';
import { IPPoolManager, IPAllocationManager, DeviceManager } from './database/ip-manager.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Force PostgreSQL mode for testing
process.env.DB_MODE = 'postgresql';

async function runTests() {
    console.log('='.repeat(60));
    console.log('ArchiFlow Database Connection Test');
    console.log('='.repeat(60));

    try {
        // Initialize database connection
        console.log('\n1. Initializing database connection...');
        const pool = initializeDatabase();
        
        if (!pool) {
            throw new Error('Failed to initialize database connection');
        }

        // Test connection
        console.log('\n2. Testing database connection...');
        const isConnected = await testConnection();
        if (!isConnected) {
            throw new Error('Database connection test failed');
        }

        // Test IP Pool operations
        console.log('\n3. Testing IP Pool operations...');
        const pools = await IPPoolManager.getAllPools();
        console.log(`   Found ${pools.length} IP pools:`);
        pools.forEach(pool => {
            console.log(`   - ${pool.name}: ${pool.network} (${pool.allocated_count || 0} allocated)`);
        });

        // Test Device operations
        console.log('\n4. Testing Device operations...');
        const devices = await DeviceManager.getAllDevices();
        console.log(`   Found ${devices.length} devices:`);
        devices.forEach(device => {
            console.log(`   - ${device.device_name} (${device.device_type}): ${device.status}`);
        });

        // Test IP allocation
        console.log('\n5. Testing IP allocation...');
        if (pools.length > 0) {
            const testPool = pools[0];
            console.log(`   Attempting to allocate IP from pool: ${testPool.name}`);
            
            const allocation = await IPAllocationManager.allocateIP(
                testPool.id,
                'TEST-DEVICE-001',
                'Test Device',
                'server',
                'test-script'
            );
            
            if (allocation.success) {
                console.log(`   ✓ Successfully allocated IP: ${allocation.ip_address}`);
                
                // Release the IP
                console.log(`   Releasing IP: ${allocation.ip_address}`);
                const release = await IPAllocationManager.releaseIP(
                    allocation.ip_address,
                    testPool.id,
                    'test-script'
                );
                
                if (release.success) {
                    console.log(`   ✓ Successfully released IP`);
                }
            } else {
                console.log(`   ⚠ Could not allocate IP: ${allocation.message}`);
            }
        }

        // Get allocation history
        console.log('\n6. Testing allocation history...');
        const history = await IPAllocationManager.getAllocationHistory(5);
        console.log(`   Recent allocations: ${history.length} entries`);

        console.log('\n' + '='.repeat(60));
        console.log('✓ All database tests completed successfully!');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error);
    } finally {
        // Close database connection
        await closeDatabase();
        console.log('\nDatabase connection closed.');
    }
}

// Run tests
runTests().catch(console.error);