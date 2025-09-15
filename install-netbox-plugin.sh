#!/bin/bash

echo "Installing ArchiFlow NetBox Plugin..."

# Copy plugin to NetBox container
docker cp netbox-archiflow-plugin netbox:/opt/netbox/

# Install the plugin in NetBox
docker exec netbox sh -c "cd /opt/netbox && pip install -e netbox-archiflow-plugin/"

# Create or update plugin configuration
docker exec netbox sh -c "cat > /etc/netbox/config/plugins.py << 'EOF'
PLUGINS = ['netbox_archiflow']
PLUGINS_CONFIG = {
    'netbox_archiflow': {
        'drawio_url': 'http://host.docker.internal:8081',
        'websocket_url': 'ws://host.docker.internal:3333'
    }
}
EOF"

# Run migrations for the plugin
docker exec netbox sh -c "cd /opt/netbox/netbox && python manage.py migrate"

# Collect static files
docker exec netbox sh -c "cd /opt/netbox/netbox && python manage.py collectstatic --no-input"

# Restart NetBox to load the plugin
docker restart netbox netbox-worker

echo "ArchiFlow plugin installed! Restarting NetBox..."
echo "Wait 30 seconds for NetBox to restart..."
sleep 30
echo "Access NetBox at: http://localhost:8000"
echo "Login with: admin / admin"
echo "ArchiFlow Diagrams will appear in the left sidebar menu!"