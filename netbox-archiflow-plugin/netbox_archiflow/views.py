from django.shortcuts import render, redirect
from django.contrib.auth.mixins import LoginRequiredMixin
from django.views import View
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from dcim.models import Site

class DiagramListView(LoginRequiredMixin, View):
    """List all diagrams"""
    template_name = 'netbox_archiflow/diagram_list.html'
    
    def get(self, request):
        return render(request, self.template_name, {})

class DiagramEditorView(LoginRequiredMixin, View):
    """Main diagram editor view - embeds Draw.io"""
    template_name = 'netbox_archiflow/editor.html'
    
    def get(self, request, pk=None):
        # Get plugin configuration
        plugin_config = settings.PLUGINS_CONFIG.get('netbox_archiflow', {})
        drawio_url = plugin_config.get('drawio_url', 'http://localhost:8081')
        websocket_url = plugin_config.get('websocket_url', 'ws://localhost:3333')
        
        context = {
            'drawio_url': drawio_url,
            'websocket_url': websocket_url,
            'diagram_id': pk,
            'user': request.user,
            # Pass NetBox context data
            'netbox_context': {
                'user_id': request.user.id,
                'username': request.user.username,
                'email': request.user.email,
                'is_superuser': request.user.is_superuser,
            }
        }
        
        return render(request, self.template_name, context)

class DiagramDiagnosticView(LoginRequiredMixin, View):
    """Diagnostic view for testing Draw.io integration"""
    template_name = 'netbox_archiflow/editor_diagnostic.html'
    
    def get(self, request):
        # Get plugin configuration
        plugin_config = settings.PLUGINS_CONFIG.get('netbox_archiflow', {})
        drawio_url = plugin_config.get('drawio_url', 'http://localhost:8081')
        websocket_url = plugin_config.get('websocket_url', 'ws://localhost:3333')
        
        context = {
            'drawio_url': drawio_url,
            'websocket_url': websocket_url,
            'user': request.user,
        }
        
        return render(request, self.template_name, context)

class DiagramCreateView(LoginRequiredMixin, View):
    """Create new diagram"""

    def get(self, request):
        # Redirect to editor with new diagram mode
        return redirect('plugins:netbox_archiflow:diagram_editor')

class SitesAPIView(LoginRequiredMixin, View):
    """API endpoint to get all sites"""

    def get(self, request):
        try:
            sites = Site.objects.all().values('id', 'name', 'slug', 'status', 'description')
            sites_list = list(sites)
            print(f"[SitesAPIView] Returning {len(sites_list)} sites")
            return JsonResponse(sites_list, safe=False)
        except Exception as e:
            print(f"[SitesAPIView] Error: {e}")
            return JsonResponse({'error': str(e)}, status=500)