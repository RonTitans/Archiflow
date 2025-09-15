/**
 * PostgreSQL Database Connection Module
 * Manages connection pool and provides query interface
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { dbConfig } from './db-config.js';

// Load environment variables
dotenv.config();

const { Pool } = pg;

// Create connection pool
let pool = null;

/**
 * Initialize database connection pool
 */
export function initializeDatabase() {
    if (dbConfig.mode === 'mock') {
        console.log('[Database] Running in MOCK mode - no database connection');
        return null;
    }

    const config = {
        host: process.env.DB_HOST || dbConfig.postgresql.host,
        port: process.env.DB_PORT || dbConfig.postgresql.port,
        database: process.env.DB_NAME || dbConfig.postgresql.database,
        user: process.env.DB_USER || dbConfig.postgresql.user,
        password: process.env.DB_PASSWORD || dbConfig.postgresql.password,
        options: `-c search_path=${process.env.DB_SCHEMA || dbConfig.postgresql.schema || 'archiflow'}`,
        ...dbConfig.postgresql.pool
    };

    pool = new Pool(config);

    // Handle pool errors
    pool.on('error', (err) => {
        console.error('[Database] Unexpected error on idle client', err);
    });

    console.log(`[Database] Connected to PostgreSQL at ${config.host}:${config.port}/${config.database}`);
    
    return pool;
}

/**
 * Execute a database query
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise} Query result
 */
export async function query(text, params) {
    if (!pool) {
        throw new Error('Database connection not initialized');
    }
    
    try {
        const start = Date.now();
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        
        if (process.env.NODE_ENV === 'development') {
            console.log('[Database] Query executed', { text, duration, rows: res.rowCount });
        }
        
        return res;
    } catch (err) {
        console.error('[Database] Query error:', err);
        throw err;
    }
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise} Database client
 */
export async function getClient() {
    if (!pool) {
        throw new Error('Database connection not initialized');
    }
    return await pool.connect();
}

/**
 * Close database connection pool
 */
export async function closeDatabase() {
    if (pool) {
        await pool.end();
        console.log('[Database] Connection pool closed');
    }
}

/**
 * Test database connection
 */
export async function testConnection() {
    try {
        const result = await query('SELECT NOW() as current_time, current_schema()');
        console.log('[Database] Connection test successful:', result.rows[0]);
        return true;
    } catch (err) {
        console.error('[Database] Connection test failed:', err);
        return false;
    }
}

// Export pool for direct access if needed
export { pool };