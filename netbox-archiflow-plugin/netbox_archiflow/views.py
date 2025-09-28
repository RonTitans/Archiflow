from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.mixins import LoginRequiredMixin
from django.views import View
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.utils import timezone
from dcim.models import Site
import json
import uuid

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


# Deployment API will be re-enabled once models are properly configured
# For now, deployment is handled entirely through the ArchiFlow database

"""
@method_decorator(csrf_exempt, name='dispatch')
class DiagramDeploymentAPIView(LoginRequiredMixin, View):
    # API endpoint to deploy a diagram version

    def post(self, request, diagram_id):
        try:
            # Parse request data
            data = json.loads(request.body) if request.body else {}

            # Get or create diagram metadata in NetBox
            archiflow_id = uuid.UUID(diagram_id) if isinstance(diagram_id, str) else diagram_id

            # Get site information
            site_id = data.get('site_id')
            if not site_id:
                return JsonResponse({'error': 'site_id is required'}, status=400)

            site = get_object_or_404(Site, id=site_id)

            # Check if diagram metadata exists, create if not
            diagram_meta, created = DiagramMetadata.objects.get_or_create(
                archiflow_id=archiflow_id,
                defaults={
                    'site': site,
                    'version': data.get('version', 'v1.0'),
                    'title': data.get('title', 'Network Diagram'),
                    'description': data.get('description', ''),
                    'created_by': request.user,
                    'device_count': data.get('device_count', 0),
                    'connection_count': data.get('connection_count', 0),
                }
            )

            # Find current live diagram for this site
            previous_live = DiagramMetadata.objects.filter(
                site=site,
                is_live=True
            ).exclude(pk=diagram_meta.pk).first()

            # Update diagram status
            diagram_meta.status = 'deployed'
            diagram_meta.is_live = True
            diagram_meta.deployed_at = timezone.now()
            diagram_meta.deployed_by = request.user
            diagram_meta.last_sync_with_archiflow = timezone.now()
            diagram_meta.save()

            # Create deployment history record
            DeploymentHistory.objects.create(
                diagram=diagram_meta,
                action='deployed',
                performed_by=request.user,
                notes=data.get('notes', f'Deployed via API by {request.user.username}'),
                previous_live=previous_live
            )

            # If there was a previous live diagram, archive it
            if previous_live:
                previous_live.is_live = False
                previous_live.status = 'archived'
                previous_live.save()

                DeploymentHistory.objects.create(
                    diagram=previous_live,
                    action='archived',
                    performed_by=request.user,
                    notes=f'Replaced by {diagram_meta.version}'
                )

            return JsonResponse({
                'success': True,
                'message': f'Diagram {diagram_meta.version} deployed successfully',
                'diagram': {
                    'id': str(diagram_meta.archiflow_id),
                    'version': diagram_meta.version,
                    'title': diagram_meta.title,
                    'is_live': diagram_meta.is_live,
                    'deployed_at': diagram_meta.deployed_at.isoformat() if diagram_meta.deployed_at else None,
                    'deployed_by': diagram_meta.deployed_by.username if diagram_meta.deployed_by else None,
                }
            })

        except Exception as e:
            print(f"[DiagramDeploymentAPIView] Error: {e}")
            return JsonResponse({'error': str(e)}, status=500)

    def get(self, request, diagram_id=None):
        # Get deployment status for a diagram or site
        try:
            site_id = request.GET.get('site_id')

            if diagram_id:
                # Get specific diagram deployment status
                archiflow_id = uuid.UUID(diagram_id) if isinstance(diagram_id, str) else diagram_id
                diagram_meta = get_object_or_404(DiagramMetadata, archiflow_id=archiflow_id)

                history = DeploymentHistory.objects.filter(diagram=diagram_meta).values(
                    'action', 'timestamp', 'performed_by__username', 'notes'
                )

                return JsonResponse({
                    'diagram': {
                        'id': str(diagram_meta.archiflow_id),
                        'version': diagram_meta.version,
                        'title': diagram_meta.title,
                        'is_live': diagram_meta.is_live,
                        'status': diagram_meta.status,
                        'deployed_at': diagram_meta.deployed_at.isoformat() if diagram_meta.deployed_at else None,
                    },
                    'history': list(history)
                })

            elif site_id:
                # Get all deployments for a site
                site = get_object_or_404(Site, id=site_id)
                diagrams = DiagramMetadata.objects.filter(site=site).values(
                    'archiflow_id', 'version', 'title', 'is_live', 'status', 'deployed_at'
                )

                return JsonResponse({
                    'site': site.name,
                    'diagrams': list(diagrams)
                })

            else:
                return JsonResponse({'error': 'diagram_id or site_id required'}, status=400)

        except Exception as e:
            print(f"[DiagramDeploymentAPIView] Error: {e}")
            return JsonResponse({'error': str(e)}, status=500)


class DiagramRollbackAPIView(LoginRequiredMixin, View):
    # API endpoint to rollback to a previous diagram version

    @method_decorator(csrf_exempt)
    def post(self, request, site_id):
        try:
            site = get_object_or_404(Site, id=site_id)

            # Find the last deployed diagram (not current live)
            previous = DeploymentHistory.objects.filter(
                diagram__site=site,
                action='deployed'
            ).exclude(
                diagram__is_live=True
            ).order_by('-timestamp').first()

            if not previous:
                return JsonResponse({'error': 'No previous version to rollback to'}, status=404)

            # Get current live diagram
            current_live = DiagramMetadata.objects.filter(site=site, is_live=True).first()

            # Rollback: make previous diagram live
            previous.diagram.is_live = True
            previous.diagram.status = 'deployed'
            previous.diagram.deployed_at = timezone.now()
            previous.diagram.deployed_by = request.user
            previous.diagram.save()

            # Archive current live
            if current_live and current_live.pk != previous.diagram.pk:
                current_live.is_live = False
                current_live.status = 'archived'
                current_live.save()

            # Log the rollback
            DeploymentHistory.objects.create(
                diagram=previous.diagram,
                action='rolled_back',
                performed_by=request.user,
                notes=f'Rolled back from {current_live.version if current_live else "unknown"}',
                previous_live=current_live
            )

            return JsonResponse({
                'success': True,
                'message': f'Rolled back to {previous.diagram.version}',
                'diagram': {
                    'id': str(previous.diagram.archiflow_id),
                    'version': previous.diagram.version,
                    'title': previous.diagram.title,
                }
            })

        except Exception as e:
            print(f"[DiagramRollbackAPIView] Error: {e}")
            return JsonResponse({'error': str(e)}, status=500)
"""