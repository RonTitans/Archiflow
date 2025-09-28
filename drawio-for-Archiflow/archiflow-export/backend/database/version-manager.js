/**
 * Version Management for ArchiFlow Diagrams
 * Sprint 1: Site-based version control
 */

import pg from 'pg';
const { Pool } = pg;

// Create database connection pool
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5433,
    database: process.env.DB_NAME || 'archiflow',
    user: process.env.DB_USER || 'archiflow_user',
    password: process.env.DB_PASSWORD || 'archiflow_pass'
});

export const VersionManager = {
    // Get all sites from database (synced from NetBox)
    async getSites() {
        console.log('📊 VersionManager.getSites() called');
        try {
            const result = await pool.query('SELECT * FROM archiflow.sites ORDER BY name');
            console.log('✅ Sites retrieved from DB:', result.rows.length, 'sites');
            console.log('📊 Sites data:', result.rows);
            return result.rows;
        } catch (error) {
            console.error('❌ Error getting sites from DB:', error);
            return [];
        }
    },

    // Sync sites from NetBox
    async syncSitesFromNetBox(sites) {
        console.log('📊 VersionManager.syncSitesFromNetBox() called with', sites.length, 'sites');
        let synced = 0;
        try {
            for (const site of sites) {
                console.log(`  - Syncing site: ${site.name} (ID: ${site.id})`);
                await pool.query(`
                    INSERT INTO archiflow.sites (id, name, slug, status, description)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (id) DO UPDATE
                    SET name = EXCLUDED.name,
                        slug = EXCLUDED.slug,
                        status = EXCLUDED.status,
                        description = EXCLUDED.description,
                        last_synced = NOW()
                `, [site.id, site.name, site.slug, site.status, site.description]);
                synced++;
            }
            console.log('✅ Successfully synced', synced, 'sites to DB');
            return { success: true, synced: synced };
        } catch (error) {
            console.error('❌ Error syncing sites to DB:', error);
            return { success: false, synced: synced, error: error.message };
        }
    },

    // Get all versions for a site
    async getDiagramsBySite(siteId) {
        const result = await pool.query(`
            SELECT id, site_id, site_name, version, title,
                   status, is_live, created_at, created_by,
                   deployed_at, deployed_by, description, diagram_data
            FROM archiflow.diagrams
            WHERE site_id = $1
            ORDER BY created_at DESC
        `, [siteId]);
        return result.rows;
    },

    // Save new diagram version
    async saveDiagram(params) {
        const { site_id, site_name, version, title, description, diagram_data, user_id, parent_version_id } = params;

        const result = await pool.query(`
            INSERT INTO archiflow.diagrams
            (site_id, site_name, version, title, description, diagram_data, created_by, parent_version_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, version
        `, [site_id, site_name, version, title, description, diagram_data, user_id, parent_version_id]);

        return result.rows[0];
    },

    // Deploy version as LIVE
    async deployVersion(diagramId, userId) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Get diagram details
            const diagramResult = await client.query(
                'SELECT site_id, version, site_name FROM archiflow.diagrams WHERE id = $1',
                [diagramId]
            );

            if (diagramResult.rows.length === 0) {
                throw new Error('Diagram not found');
            }

            const diagram = diagramResult.rows[0];

            // Find current LIVE version
            const currentLiveResult = await client.query(
                'SELECT id, version FROM archiflow.diagrams WHERE site_id = $1 AND is_live = TRUE',
                [diagram.site_id]
            );

            let previousLiveId = null;
            if (currentLiveResult.rows.length > 0) {
                previousLiveId = currentLiveResult.rows[0].id;
                // Archive current LIVE
                await client.query(
                    'UPDATE archiflow.diagrams SET is_live = FALSE, status = $1 WHERE id = $2',
                    ['archived', previousLiveId]
                );
            }

            // Deploy new version
            await client.query(`
                UPDATE archiflow.diagrams
                SET is_live = TRUE,
                    status = 'deployed',
                    deployed_at = NOW(),
                    deployed_by = $1
                WHERE id = $2
            `, [userId, diagramId]);

            // Log deployment
            await client.query(`
                INSERT INTO archiflow.deployment_history
                (diagram_id, site_id, site_name, version, action, performed_by, previous_live_id)
                VALUES ($1, $2, $3, $4, 'deployed', $5, $6)
            `, [diagramId, diagram.site_id, diagram.site_name, diagram.version, userId, previousLiveId]);

            await client.query('COMMIT');
            return { success: true, message: 'Version deployed successfully' };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    // Get deployment history for a site
    async getDeploymentHistory(siteId, limit = 10) {
        const result = await pool.query(`
            SELECT h.*, d.title
            FROM archiflow.deployment_history h
            JOIN archiflow.diagrams d ON h.diagram_id = d.id
            WHERE h.site_id = $1
            ORDER BY h.timestamp DESC
            LIMIT $2
        `, [siteId, limit]);
        return result.rows;
    },

    // Load specific diagram
    async loadDiagram(diagramId) {
        const result = await pool.query(
            'SELECT * FROM archiflow.diagrams WHERE id = $1',
            [diagramId]
        );
        return result.rows[0];
    },

    // Clone existing version
    async cloneVersion(sourceId, newVersion, userId) {
        const source = await this.loadDiagram(sourceId);
        if (!source) {
            throw new Error('Source diagram not found');
        }

        return await this.saveDiagram({
            site_id: source.site_id,
            site_name: source.site_name,
            version: newVersion,
            title: source.title + ' (Clone)',
            description: source.description,
            diagram_data: source.diagram_data,
            user_id: userId,
            parent_version_id: sourceId
        });
    },

    // Update diagram data
    async updateDiagram(diagramId, diagramData) {
        try {
            console.log('📝 updateDiagram called with:');
            console.log('  - diagramId:', diagramId);
            console.log('  - diagramData type:', typeof diagramData);
            console.log('  - diagramData length:', diagramData ? diagramData.length : 'null/undefined');
            console.log('  - diagramData preview:', diagramData ? diagramData.substring(0, 100) : 'null/undefined');

            const result = await pool.query(
                'UPDATE archiflow.diagrams SET diagram_data = $1 WHERE id = $2 RETURNING id, diagram_data',
                [diagramData, diagramId]
            );

            if (result.rows.length > 0) {
                console.log('✅ Diagram updated successfully:', diagramId);
                console.log('  - Saved data length:', result.rows[0].diagram_data ? result.rows[0].diagram_data.length : 'null');
                return { success: true, message: 'Diagram updated' };
            } else {
                return { success: false, message: 'Diagram not found' };
            }
        } catch (error) {
            console.error('Error updating diagram:', error);
            return { success: false, message: error.message };
        }
    }
};

export default VersionManager;