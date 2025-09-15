#!/bin/sh
# Install ArchiFlow plugin on container startup

echo "Installing ArchiFlow plugin..."
pip uninstall -y netbox-archiflow 2>/dev/null || true
cp -r /opt/netbox/netbox-archiflow-plugin /tmp/plugin 2>/dev/null || true
cd /tmp/plugin && pip install . --no-cache-dir

# Manually copy templates until we fix the packaging
echo "Copying templates..."
SITE_PACKAGES=$(python -c "import site; print(site.getsitepackages()[0])")
cp -r /opt/netbox/netbox-archiflow-plugin/netbox_archiflow/templates $SITE_PACKAGES/netbox_archiflow/ 2>/dev/null || true

echo "ArchiFlow plugin installed."