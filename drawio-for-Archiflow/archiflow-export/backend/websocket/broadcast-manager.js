/**
 * WebSocket Broadcast Manager
 * Handles multi-user real-time updates and presence
 */

class BroadcastManager {
    constructor() {
        this.clients = new Map(); // clientId -> { ws, userId, diagramId, metadata }
        this.diagrams = new Map(); // diagramId -> Set of clientIds
        this.users = new Map(); // userId -> { clientId, name, color, cursor }
    }

    /**
     * Register a new client connection
     */
    addClient(clientId, ws, userId = 'anonymous', metadata = {}) {
        this.clients.set(clientId, {
            ws,
            userId,
            diagramId: null,
            metadata: {
                name: metadata.name || 'User',
                color: metadata.color || this.generateColor(),
                joinedAt: new Date(),
                ...metadata
            }
        });

        // Add to users map
        if (!this.users.has(userId)) {
            this.users.set(userId, {
                clientId,
                name: metadata.name || 'User',
                color: metadata.color || this.generateColor(),
                status: 'online'
            });
        }

        console.log(`[Broadcast] Client ${clientId} (${userId}) connected`);
        return clientId;
    }

    /**
     * Remove client and clean up
     */
    removeClient(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            // Remove from diagram room
            if (client.diagramId) {
                this.leaveDiagram(clientId, client.diagramId);
            }

            // Remove from users
            this.users.delete(client.userId);

            // Remove from clients
            this.clients.delete(clientId);

            console.log(`[Broadcast] Client ${clientId} disconnected`);
        }
    }

    /**
     * Join a diagram room
     */
    joinDiagram(clientId, diagramId) {
        const client = this.clients.get(clientId);
        if (!client) return false;

        // Leave current diagram if any
        if (client.diagramId) {
            this.leaveDiagram(clientId, client.diagramId);
        }

        // Join new diagram
        client.diagramId = diagramId;
        
        if (!this.diagrams.has(diagramId)) {
            this.diagrams.set(diagramId, new Set());
        }
        this.diagrams.get(diagramId).add(clientId);

        // Notify others in the diagram
        this.broadcastToDiagram(diagramId, {
            type: 'user_joined',
            userId: client.userId,
            userName: client.metadata.name,
            userColor: client.metadata.color,
            timestamp: new Date()
        }, clientId);

        // Send current users list to the new client
        const currentUsers = this.getDiagramUsers(diagramId);
        this.sendToClient(clientId, {
            type: 'diagram_users',
            users: currentUsers,
            diagramId: diagramId
        });

        console.log(`[Broadcast] Client ${clientId} joined diagram ${diagramId}`);
        return true;
    }

    /**
     * Leave a diagram room
     */
    leaveDiagram(clientId, diagramId) {
        const client = this.clients.get(clientId);
        if (!client) return;

        const diagramClients = this.diagrams.get(diagramId);
        if (diagramClients) {
            diagramClients.delete(clientId);
            
            // Clean up empty diagram rooms
            if (diagramClients.size === 0) {
                this.diagrams.delete(diagramId);
            }

            // Notify others
            this.broadcastToDiagram(diagramId, {
                type: 'user_left',
                userId: client.userId,
                userName: client.metadata.name,
                timestamp: new Date()
            }, clientId);
        }

        client.diagramId = null;
        console.log(`[Broadcast] Client ${clientId} left diagram ${diagramId}`);
    }

    /**
     * Broadcast message to all clients in a diagram
     */
    broadcastToDiagram(diagramId, message, excludeClientId = null) {
        const diagramClients = this.diagrams.get(diagramId);
        if (!diagramClients) return;

        const messageStr = JSON.stringify(message);
        let sent = 0;

        diagramClients.forEach(clientId => {
            if (clientId !== excludeClientId) {
                const client = this.clients.get(clientId);
                if (client && client.ws.readyState === 1) { // WebSocket.OPEN
                    client.ws.send(messageStr);
                    sent++;
                }
            }
        });

        console.log(`[Broadcast] Sent to ${sent} clients in diagram ${diagramId}`);
    }

    /**
     * Send message to specific client
     */
    sendToClient(clientId, message) {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === 1) {
            client.ws.send(JSON.stringify(message));
            return true;
        }
        return false;
    }

    /**
     * Broadcast diagram change to all users
     */
    broadcastDiagramChange(diagramId, change, sourceClientId) {
        this.broadcastToDiagram(diagramId, {
            type: 'diagram_change',
            change: change,
            sourceUserId: this.clients.get(sourceClientId)?.userId,
            timestamp: new Date()
        }, sourceClientId);
    }

    /**
     * Broadcast cursor position
     */
    broadcastCursorPosition(clientId, x, y) {
        const client = this.clients.get(clientId);
        if (!client || !client.diagramId) return;

        this.broadcastToDiagram(client.diagramId, {
            type: 'cursor_move',
            userId: client.userId,
            userName: client.metadata.name,
            userColor: client.metadata.color,
            x: x,
            y: y,
            timestamp: new Date()
        }, clientId);
    }

    /**
     * Broadcast selection change
     */
    broadcastSelection(clientId, selectedCells) {
        const client = this.clients.get(clientId);
        if (!client || !client.diagramId) return;

        this.broadcastToDiagram(client.diagramId, {
            type: 'selection_change',
            userId: client.userId,
            userName: client.metadata.name,
            userColor: client.metadata.color,
            selectedCells: selectedCells,
            timestamp: new Date()
        }, clientId);
    }

    /**
     * Get all users in a diagram
     */
    getDiagramUsers(diagramId) {
        const diagramClients = this.diagrams.get(diagramId);
        if (!diagramClients) return [];

        const users = [];
        diagramClients.forEach(clientId => {
            const client = this.clients.get(clientId);
            if (client) {
                users.push({
                    userId: client.userId,
                    name: client.metadata.name,
                    color: client.metadata.color,
                    status: 'online'
                });
            }
        });

        return users;
    }

    /**
     * Generate random color for user
     */
    generateColor() {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
            '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
            '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            totalClients: this.clients.size,
            totalDiagrams: this.diagrams.size,
            totalUsers: this.users.size,
            diagramStats: Array.from(this.diagrams.entries()).map(([diagramId, clients]) => ({
                diagramId,
                userCount: clients.size
            }))
        };
    }
}

// Export singleton instance
export const broadcastManager = new BroadcastManager();
export default broadcastManager;