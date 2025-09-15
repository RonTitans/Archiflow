-- ArchiFlow Database Schema
-- PostgreSQL Database for Network Management System
-- Version: 1.0.0
-- Created: 2025-09-01

-- =====================================================
-- CLEANUP (for development - remove in production)
-- =====================================================
DROP SCHEMA IF EXISTS archiflow CASCADE;
CREATE SCHEMA archiflow;
SET search_path TO archiflow;

-- =====================================================
-- CORE TABLES
-- =====================================================

-- IP Pools Table
CREATE TABLE ip_pools (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    network CIDR NOT NULL,
    gateway INET,
    dns_servers TEXT[], -- Array of DNS servers
    vlan_id INTEGER,
    description TEXT,
    pool_type VARCHAR(50) DEFAULT 'static', -- static, dhcp, reserved
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    is_active BOOLEAN DEFAULT true
);

-- IP Allocations Table
CREATE TABLE ip_allocations (
    id SERIAL PRIMARY KEY,
    ip_address INET NOT NULL,
    pool_id VARCHAR(50) REFERENCES ip_pools(id) ON DELETE CASCADE,
    asset_id VARCHAR(100) NOT NULL,
    device_name VARCHAR(255),
    device_type VARCHAR(50), -- router, switch, server, etc.
    mac_address MACADDR,
    allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    allocated_by VARCHAR(100),
    released_at TIMESTAMP,
    released_by VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    UNIQUE(ip_address, pool_id, is_active)
);

-- Network Devices Table
CREATE TABLE network_devices (
    asset_id VARCHAR(100) PRIMARY KEY,
    device_name VARCHAR(255) NOT NULL,
    device_type VARCHAR(50) NOT NULL, -- router, switch, firewall, server, etc.
    vendor VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(255),
    location VARCHAR(255),
    rack_position VARCHAR(50),
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, maintenance, decommissioned
    primary_ip INET,
    management_ip INET,
    metadata JSONB, -- Flexible metadata storage
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);

-- Device Ports Table
CREATE TABLE device_ports (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(100) REFERENCES network_devices(asset_id) ON DELETE CASCADE,
    port_name VARCHAR(100) NOT NULL,
    port_type VARCHAR(50), -- ethernet, fiber, serial, virtual
    speed VARCHAR(20), -- 1G, 10G, 100M, etc.
    status VARCHAR(20) DEFAULT 'down', -- up, down, admin-down
    vlan_id INTEGER,
    connected_to_device VARCHAR(100),
    connected_to_port VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Diagrams Table
CREATE TABLE diagrams (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    diagram_xml TEXT, -- Draw.io XML content
    diagram_json JSONB, -- Parsed diagram data
    version INTEGER DEFAULT 1,
    is_current BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    tags TEXT[],
    metadata JSONB
);

-- Diagram Versions Table (for version control)
CREATE TABLE diagram_versions (
    id SERIAL PRIMARY KEY,
    diagram_id VARCHAR(100) REFERENCES diagrams(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    name VARCHAR(255),
    diagram_xml TEXT,
    diagram_json JSONB,
    change_summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    is_current BOOLEAN DEFAULT false,
    UNIQUE(diagram_id, version_number)
);

-- Templates Table
CREATE TABLE templates (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_xml TEXT,
    template_json JSONB,
    variables JSONB, -- Template variables definition
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);

-- Alerts Table
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(50) NOT NULL, -- ip_conflict, pool_exhausted, device_down, etc.
    severity VARCHAR(20) NOT NULL, -- critical, warning, info
    source VARCHAR(100), -- Source of alert (device_id, pool_id, etc.)
    message TEXT NOT NULL,
    details JSONB,
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP,
    resolved BOOLEAN DEFAULT false,
    resolved_by VARCHAR(100),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log Table
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL, -- create, update, delete, allocate_ip, release_ip, etc.
    entity_type VARCHAR(50) NOT NULL, -- device, ip_pool, diagram, etc.
    entity_id VARCHAR(100),
    old_value JSONB,
    new_value JSONB,
    user_id VARCHAR(100),
    user_name VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_ip_allocations_pool_id ON ip_allocations(pool_id);
CREATE INDEX idx_ip_allocations_asset_id ON ip_allocations(asset_id);
CREATE INDEX idx_ip_allocations_active ON ip_allocations(is_active);
CREATE INDEX idx_ip_allocations_ip ON ip_allocations(ip_address);

CREATE INDEX idx_devices_status ON network_devices(status);
CREATE INDEX idx_devices_type ON network_devices(device_type);
CREATE INDEX idx_devices_primary_ip ON network_devices(primary_ip);

CREATE INDEX idx_device_ports_device ON device_ports(device_id);
CREATE INDEX idx_device_ports_status ON device_ports(status);

CREATE INDEX idx_diagrams_current ON diagrams(is_current);
CREATE INDEX idx_diagrams_created_by ON diagrams(created_by);

CREATE INDEX idx_alerts_type ON alerts(alert_type);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_resolved ON alerts(resolved);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- IP Pool Usage View
CREATE VIEW ip_pool_usage AS
SELECT 
    p.id as pool_id,
    p.name as pool_name,
    p.network,
    COUNT(DISTINCT a.ip_address) FILTER (WHERE a.is_active = true) as allocated_count,
    (SELECT COUNT(*) FROM generate_series(
        (p.network::inet + 1)::inet,
        broadcast(p.network)::inet - 1,
        '1'::inet
    )) as total_ips,
    ROUND(
        (COUNT(DISTINCT a.ip_address) FILTER (WHERE a.is_active = true))::numeric / 
        NULLIF((SELECT COUNT(*) FROM generate_series(
            (p.network::inet + 1)::inet,
            broadcast(p.network)::inet - 1,
            '1'::inet
        )), 0) * 100, 2
    ) as utilization_percent
FROM ip_pools p
LEFT JOIN ip_allocations a ON p.id = a.pool_id
WHERE p.is_active = true
GROUP BY p.id, p.name, p.network;

-- Active Devices View
CREATE VIEW active_devices AS
SELECT 
    d.*,
    a.ip_address as allocated_ip,
    a.pool_id,
    p.name as pool_name,
    COUNT(dp.id) as port_count,
    COUNT(dp.id) FILTER (WHERE dp.status = 'up') as ports_up
FROM network_devices d
LEFT JOIN ip_allocations a ON d.asset_id = a.asset_id AND a.is_active = true
LEFT JOIN ip_pools p ON a.pool_id = p.id
LEFT JOIN device_ports dp ON d.asset_id = dp.device_id
WHERE d.status = 'active'
GROUP BY d.asset_id, a.ip_address, a.pool_id, p.name;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to get next available IP from pool
CREATE OR REPLACE FUNCTION get_next_available_ip(pool_id_param VARCHAR)
RETURNS INET AS $$
DECLARE
    pool_network CIDR;
    next_ip INET;
    ip INET;
BEGIN
    -- Get the pool network
    SELECT network INTO pool_network FROM ip_pools WHERE id = pool_id_param;
    
    IF pool_network IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Find the first available IP
    FOR ip IN 
        SELECT generate_series(
            (pool_network::inet + 1)::inet,
            broadcast(pool_network)::inet - 1,
            '1'::inet
        )
    LOOP
        -- Check if IP is not allocated
        IF NOT EXISTS (
            SELECT 1 FROM ip_allocations 
            WHERE ip_address = ip 
            AND pool_id = pool_id_param 
            AND is_active = true
        ) THEN
            RETURN ip;
        END IF;
    END LOOP;
    
    RETURN NULL; -- No available IPs
END;
$$ LANGUAGE plpgsql;

-- Function to allocate IP
CREATE OR REPLACE FUNCTION allocate_ip(
    p_pool_id VARCHAR,
    p_asset_id VARCHAR,
    p_device_name VARCHAR,
    p_device_type VARCHAR,
    p_allocated_by VARCHAR
)
RETURNS TABLE(success BOOLEAN, ip_address INET, message TEXT) AS $$
DECLARE
    v_ip INET;
BEGIN
    -- Get next available IP
    v_ip := get_next_available_ip(p_pool_id);
    
    IF v_ip IS NULL THEN
        RETURN QUERY SELECT false, NULL::INET, 'No available IPs in pool';
        RETURN;
    END IF;
    
    -- Insert allocation
    INSERT INTO ip_allocations (
        ip_address, pool_id, asset_id, device_name, 
        device_type, allocated_by
    ) VALUES (
        v_ip, p_pool_id, p_asset_id, p_device_name, 
        p_device_type, p_allocated_by
    );
    
    -- Log the action
    INSERT INTO audit_log (
        action, entity_type, entity_id, new_value, user_id
    ) VALUES (
        'allocate_ip', 'ip_allocation', p_asset_id, 
        jsonb_build_object('ip', v_ip::text, 'pool_id', p_pool_id),
        p_allocated_by
    );
    
    RETURN QUERY SELECT true, v_ip, 'IP allocated successfully';
END;
$$ LANGUAGE plpgsql;

-- Function to release IP
CREATE OR REPLACE FUNCTION release_ip(
    p_ip_address INET,
    p_pool_id VARCHAR,
    p_released_by VARCHAR
)
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
BEGIN
    -- Update allocation
    UPDATE ip_allocations 
    SET 
        is_active = false,
        released_at = CURRENT_TIMESTAMP,
        released_by = p_released_by
    WHERE 
        ip_address = p_ip_address 
        AND pool_id = p_pool_id 
        AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'IP allocation not found';
        RETURN;
    END IF;
    
    -- Log the action
    INSERT INTO audit_log (
        action, entity_type, entity_id, old_value, user_id
    ) VALUES (
        'release_ip', 'ip_allocation', p_ip_address::text,
        jsonb_build_object('ip', p_ip_address::text, 'pool_id', p_pool_id),
        p_released_by
    );
    
    RETURN QUERY SELECT true, 'IP released successfully';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SAMPLE DATA FOR DEVELOPMENT
-- =====================================================

-- Insert sample IP pools
INSERT INTO ip_pools (id, name, network, gateway, vlan_id, description) VALUES
('POOL-001', 'Management Network', '10.0.1.0/24', '10.0.1.1', 100, 'Management VLAN for network devices'),
('POOL-002', 'Server Network', '10.0.2.0/24', '10.0.2.1', 200, 'Production server network'),
('POOL-003', 'DMZ Network', '10.0.3.0/24', '10.0.3.1', 300, 'DMZ for public-facing services'),
('POOL-004', 'Guest Network', '192.168.100.0/24', '192.168.100.1', 400, 'Guest WiFi network');

-- Insert sample devices
INSERT INTO network_devices (asset_id, device_name, device_type, vendor, model, status) VALUES
('RTR-CORE-001', 'Core-Router-01', 'router', 'Cisco', 'ASR-1001-X', 'active'),
('SW-CORE-001', 'Core-Switch-01', 'switch', 'Cisco', '3850-48P', 'active'),
('FW-EDGE-001', 'Edge-Firewall-01', 'firewall', 'Palo Alto', 'PA-3220', 'active'),
('SRV-WEB-001', 'Web-Server-01', 'server', 'Dell', 'R740', 'active');

-- Sample IP allocations
SELECT allocate_ip('POOL-001', 'RTR-CORE-001', 'Core-Router-01', 'router', 'admin');
SELECT allocate_ip('POOL-001', 'SW-CORE-001', 'Core-Switch-01', 'switch', 'admin');
SELECT allocate_ip('POOL-002', 'SRV-WEB-001', 'Web-Server-01', 'server', 'admin');

-- =====================================================
-- PERMISSIONS (adjust for your environment)
-- =====================================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA archiflow TO archiflow_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA archiflow TO archiflow_app;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA archiflow TO archiflow_app;