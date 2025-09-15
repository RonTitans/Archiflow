from netbox.plugins import PluginConfig

class ArchiFlowConfig(PluginConfig):
    name = 'netbox_archiflow'
    verbose_name = 'ArchiFlow Network Diagrams'
    description = 'Integration with Draw.io-based network diagram tool'
    version = '0.1.0'
    author = 'ArchiFlow Team'
    base_url = 'archiflow'
    min_version = '4.0.0'
    
    # Configuration for the Draw.io instance
    default_settings = {
        'drawio_url': 'http://localhost:8081',
        'websocket_url': 'ws://localhost:3333',
        'enable_auto_save': True,
        'auto_save_interval': 30,  # seconds
    }

config = ArchiFlowConfig