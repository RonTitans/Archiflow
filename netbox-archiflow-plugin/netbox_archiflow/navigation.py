from netbox.plugins import PluginMenuButton, PluginMenuItem

# Menu items to add to NetBox navigation
menu_items = (
    PluginMenuItem(
        link='plugins:netbox_archiflow:diagram_list',
        link_text='Network Diagrams',
        buttons=(
            PluginMenuButton(
                link='plugins:netbox_archiflow:diagram_create',
                title='New Diagram',
                icon_class='mdi mdi-plus',
                color='green'
            ),
        )
    ),
    PluginMenuItem(
        link='plugins:netbox_archiflow:diagram_editor',
        link_text='Diagram Editor',
    ),
)