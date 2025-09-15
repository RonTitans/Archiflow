-- Set schema
SET search_path TO archiflow;

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
    
    -- Find the first available IP (skip network and broadcast addresses)
    FOR ip IN 
        SELECT generate_series(
            (pool_network::inet + 1)::inet,
            (broadcast(pool_network)::inet - 1)::inet,
            1
        )::inet
    LOOP
        -- Skip gateway IP
        IF EXISTS (SELECT 1 FROM ip_pools WHERE id = pool_id_param AND gateway = ip) THEN
            CONTINUE;
        END IF;
        
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