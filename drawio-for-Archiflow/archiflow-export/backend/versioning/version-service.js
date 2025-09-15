/**
 * ArchiFlow Version Tracking Service
 * Manages diagram version history and change tracking
 */

class VersionService {
    constructor() {
        // In-memory storage for versions (will be replaced with database later)
        this.versions = new Map(); // diagramId -> array of versions
        this.changeLog = new Map(); // diagramId -> array of changes
    }

    /**
     * Save a new version of a diagram
     * @param {string} diagramId - Unique diagram identifier
     * @param {object} diagramData - Complete diagram data
     * @param {string} userId - User making the change
     * @param {string} changeDescription - Description of changes
     */
    saveVersion(diagramId, diagramData, userId = 'system', changeDescription = '') {
        if (!this.versions.has(diagramId)) {
            this.versions.set(diagramId, []);
            this.changeLog.set(diagramId, []);
        }

        const versions = this.versions.get(diagramId);
        const versionNumber = versions.length + 1;

        const version = {
            versionNumber,
            diagramId,
            timestamp: new Date().toISOString(),
            userId,
            changeDescription,
            data: JSON.parse(JSON.stringify(diagramData)), // Deep clone
            checksum: this.calculateChecksum(diagramData),
            size: JSON.stringify(diagramData).length
        };

        versions.push(version);

        // Log the change
        this.logChange(diagramId, {
            versionNumber,
            timestamp: version.timestamp,
            userId,
            action: 'save_version',
            description: changeDescription || `Version ${versionNumber} saved`,
            changes: this.detectChanges(diagramId, versionNumber)
        });

        console.log(`[Version Service] Saved version ${versionNumber} for diagram ${diagramId}`);
        return version;
    }

    /**
     * Get version history for a diagram
     * @param {string} diagramId - Diagram identifier
     * @param {number} limit - Maximum number of versions to return
     */
    getVersionHistory(diagramId, limit = 50) {
        const versions = this.versions.get(diagramId) || [];
        const history = versions
            .slice(-limit)
            .reverse()
            .map(v => ({
                versionNumber: v.versionNumber,
                timestamp: v.timestamp,
                userId: v.userId,
                changeDescription: v.changeDescription,
                size: v.size,
                checksum: v.checksum
            }));

        return {
            diagramId,
            totalVersions: versions.length,
            versions: history
        };
    }

    /**
     * Get a specific version of a diagram
     * @param {string} diagramId - Diagram identifier
     * @param {number} versionNumber - Version to retrieve
     */
    getVersion(diagramId, versionNumber) {
        const versions = this.versions.get(diagramId);
        if (!versions) {
            throw new Error(`No versions found for diagram ${diagramId}`);
        }

        const version = versions.find(v => v.versionNumber === versionNumber);
        if (!version) {
            throw new Error(`Version ${versionNumber} not found for diagram ${diagramId}`);
        }

        return version;
    }

    /**
     * Rollback to a previous version
     * @param {string} diagramId - Diagram identifier
     * @param {number} targetVersion - Version to rollback to
     * @param {string} userId - User performing rollback
     * @param {string} reason - Reason for rollback
     */
    rollbackVersion(diagramId, targetVersion, userId = 'system', reason = '') {
        const version = this.getVersion(diagramId, targetVersion);
        
        // Create a new version with the old data
        const rollbackDescription = `Rolled back to version ${targetVersion}${reason ? ': ' + reason : ''}`;
        const newVersion = this.saveVersion(
            diagramId,
            version.data,
            userId,
            rollbackDescription
        );

        // Log the rollback action
        this.logChange(diagramId, {
            versionNumber: newVersion.versionNumber,
            timestamp: new Date().toISOString(),
            userId,
            action: 'rollback',
            description: rollbackDescription,
            rollbackFrom: this.versions.get(diagramId).length - 1,
            rollbackTo: targetVersion
        });

        console.log(`[Version Service] Rolled back diagram ${diagramId} to version ${targetVersion}`);
        return newVersion;
    }

    /**
     * Compare two versions and detect changes
     * @param {string} diagramId - Diagram identifier
     * @param {number} version1 - First version number
     * @param {number} version2 - Second version number (optional, defaults to latest)
     */
    compareVersions(diagramId, version1, version2 = null) {
        const v1 = this.getVersion(diagramId, version1);
        const versions = this.versions.get(diagramId);
        const v2 = version2 ? this.getVersion(diagramId, version2) : versions[versions.length - 1];

        const diff = {
            from: {
                version: v1.versionNumber,
                timestamp: v1.timestamp,
                userId: v1.userId
            },
            to: {
                version: v2.versionNumber,
                timestamp: v2.timestamp,
                userId: v2.userId
            },
            changes: this.calculateDiff(v1.data, v2.data)
        };

        return diff;
    }

    /**
     * Calculate diff between two diagram states
     * @private
     */
    calculateDiff(data1, data2) {
        const changes = {
            added: [],
            modified: [],
            removed: [],
            summary: ''
        };

        // Deep comparison logic
        const str1 = JSON.stringify(data1);
        const str2 = JSON.stringify(data2);

        if (str1 === str2) {
            changes.summary = 'No changes detected';
            return changes;
        }

        // Parse if they're strings (XML)
        if (typeof data1 === 'string' && typeof data2 === 'string') {
            // Simple text diff for now
            const lines1 = data1.split('\n');
            const lines2 = data2.split('\n');
            
            changes.added = lines2.length - lines1.length > 0 ? 
                `${lines2.length - lines1.length} lines added` : null;
            changes.removed = lines1.length - lines2.length > 0 ? 
                `${lines1.length - lines2.length} lines removed` : null;
            changes.modified = str1 !== str2 ? 'Content modified' : null;
        } else {
            // Object diff for structured data
            if (data1.cells && data2.cells) {
                const cells1 = new Set(data1.cells.map(c => c.id));
                const cells2 = new Set(data2.cells.map(c => c.id));
                
                for (const id of cells2) {
                    if (!cells1.has(id)) changes.added.push(id);
                }
                for (const id of cells1) {
                    if (!cells2.has(id)) changes.removed.push(id);
                }
            }
        }

        // Generate summary
        const parts = [];
        if (changes.added.length > 0) parts.push(`${changes.added.length} added`);
        if (changes.modified.length > 0) parts.push(`${changes.modified.length} modified`);
        if (changes.removed.length > 0) parts.push(`${changes.removed.length} removed`);
        changes.summary = parts.length > 0 ? parts.join(', ') : 'Minor changes';

        return changes;
    }

    /**
     * Detect changes between current and previous version
     * @private
     */
    detectChanges(diagramId, currentVersion) {
        if (currentVersion <= 1) {
            return { summary: 'Initial version' };
        }

        try {
            return this.compareVersions(diagramId, currentVersion - 1, currentVersion).changes;
        } catch (error) {
            return { summary: 'Changes detected' };
        }
    }

    /**
     * Calculate checksum for data integrity
     * @private
     */
    calculateChecksum(data) {
        const str = typeof data === 'string' ? data : JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }

    /**
     * Log a change event
     * @private
     */
    logChange(diagramId, change) {
        const changes = this.changeLog.get(diagramId) || [];
        changes.push(change);
        this.changeLog.set(diagramId, changes);
    }

    /**
     * Get change log for a diagram
     */
    getChangeLog(diagramId, limit = 100) {
        const changes = this.changeLog.get(diagramId) || [];
        return changes.slice(-limit).reverse();
    }

    /**
     * Clean up old versions (keep last N versions)
     */
    pruneVersions(diagramId, keepLast = 10) {
        const versions = this.versions.get(diagramId);
        if (!versions || versions.length <= keepLast) {
            return 0;
        }

        const toRemove = versions.length - keepLast;
        const removed = versions.splice(0, toRemove);
        
        console.log(`[Version Service] Pruned ${removed.length} old versions for diagram ${diagramId}`);
        return removed.length;
    }

    /**
     * Get storage statistics
     */
    getStats() {
        let totalVersions = 0;
        let totalSize = 0;
        const diagramStats = [];

        for (const [diagramId, versions] of this.versions.entries()) {
            const size = versions.reduce((sum, v) => sum + v.size, 0);
            totalVersions += versions.length;
            totalSize += size;
            
            diagramStats.push({
                diagramId,
                versionCount: versions.length,
                totalSize: size,
                lastModified: versions[versions.length - 1]?.timestamp
            });
        }

        return {
            totalDiagrams: this.versions.size,
            totalVersions,
            totalSize,
            diagrams: diagramStats
        };
    }
}

// Export singleton instance
const versionService = new VersionService();
export default versionService;