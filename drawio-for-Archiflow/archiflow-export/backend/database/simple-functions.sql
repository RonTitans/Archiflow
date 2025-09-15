-- Set schema
SET search_path TO archiflow;

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_next_available_ip(VARCHAR);
DROP FUNCTION IF EXISTS allocate_ip(VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS release_ip(INET, VARCHAR, VARCHAR);

-- Simplified function to allocate IP (without automatic IP generation for now)
CREATE OR REPLACE FUNCTION allocate_ip(
    p_pool_id VARCHAR,
    p_asset_id VARCHAR,
    p_device_name VARCHAR,
    p_device_type VARCHAR,
    p_allocated_by VARCHAR
)
RETURNS TABLE(success BOOLEAN, ip_address INET, message TEXT) AS $$
DECLARE
    v_network CIDR;
    v_gateway INET;
    v_ip INET;
    v_base_ip BIGINT;
    v_max_ip BIGINT;
    v_current_ip BIGINT;
BEGIN
    -- Get pool network and gateway
    SELECT network, gateway INTO v_network, v_gateway 
    FROM ip_pools WHERE id = p_pool_id;
    
    IF v_network IS NULL THEN
        RETURN QUERY SELECT false, NULL::INET, 'Pool not found';
        RETURN;
    END IF;
    
    -- Convert network addresses to bigint for easier manipulation
    v_base_ip := (v_network::inet + 1)::inet - '0.0.0.0'::inet;
    v_max_ip := broadcast(v_network)::inet - '0.0.0.0'::inet - 1;
    
    -- Try to find an available IP (simple approach - check first 100 IPs)
    FOR v_current_ip IN v_base_ip..(LEAST(v_base_ip + 100, v_max_ip)) LOOP
        v_ip := ('0.0.0.0'::inet + v_current_ip)::inet;
        
        -- Skip gateway IP
        IF v_ip = v_gateway THEN
            CONTINUE;
        END IF;
        
        -- Check if IP is available
        IF NOT EXISTS (
            SELECT 1 FROM ip_allocations a
            WHERE a.ip_address = v_ip 
            AND a.pool_id = p_pool_id 
            AND a.is_active = true
        ) THEN
            -- Allocate this IP
            INSERT INTO ip_allocations (
                ip_address, pool_id, asset_id, device_name, 
                device_type, allocated_by
            ) VALUES (
                v_ip, p_pool_id, p_asset_id, p_device_name, 
                p_device_type, p_allocated_by
            );
            
            RETURN QUERY SELECT true, v_ip, 'IP allocated successfully';
            RETURN;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT false, NULL::INET, 'No available IPs in pool';
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
    
    RETURN QUERY SELECT true, 'IP released successfully';
END;
$$ LANGUAGE plpgsql;