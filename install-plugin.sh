#!/bin/bash

echo "Installing ArchiFlow NetBox Plugin..."

# Copy plugin to NetBox container
docker cp netbox-archiflow-plugin netbox:/opt/netbox/

# Install the plugin in NetBox
docker exec netbox sh -c "cd /opt/netbox && pip install -e netbox-archiflow-plugin/"

# Add plugin to NetBox configuration
docker exec netbox sh -c "echo \"PLUGINS = ['netbox_archiflow']\" >> /etc/netbox/config/plugins.py"
docker exec netbox sh -c "echo \"PLUGINS_CONFIG = {'netbox_archiflow': {'drawio_url': 'http://localhost:8081', 'websocket_url': 'ws://localhost:3333'}}\" >> /etc/netbox/config/plugins.py"

# Run migrations for the plugin
docker exec netbox sh -c "cd /opt/netbox/netbox && python manage.py migrate"

# Collect static files
docker exec netbox sh -c "cd /opt/netbox/netbox && python manage.py collectstatic --no-input"

# Restart NetBox to load the plugin
docker restart netbox netbox-worker

echo "ArchiFlow plugin installed! Restarting NetBox..."
echo "Access the plugin at: http://localhost:8000/plugins/archiflow/"