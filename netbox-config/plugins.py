# ArchiFlow Plugin Configuration
PLUGINS = ["netbox_archiflow"]

PLUGINS_CONFIG = {
    "netbox_archiflow": {
        "drawio_url": "http://localhost:8081",
        "websocket_url": "ws://localhost:3333",
        "enable_realtime": True,
        "enable_collaboration": True,
        "default_theme": "atlas",
    }
}