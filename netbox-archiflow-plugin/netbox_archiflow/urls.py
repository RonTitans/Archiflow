from django.urls import path
from . import views

urlpatterns = [
    path('', views.DiagramListView.as_view(), name='diagram_list'),
    path('editor/', views.DiagramEditorView.as_view(), name='diagram_editor'),
    path('editor/<int:pk>/', views.DiagramEditorView.as_view(), name='diagram_edit'),
    path('create/', views.DiagramCreateView.as_view(), name='diagram_create'),
    path('diagnostic/', views.DiagramDiagnosticView.as_view(), name='diagram_diagnostic'),

    # API endpoints
    path('api/sites/', views.SitesAPIView.as_view(), name='api_sites'),
    # Deployment endpoints will be re-enabled once models are configured
    # path('api/deploy/<str:diagram_id>/', views.DiagramDeploymentAPIView.as_view(), name='api_deploy'),
    # path('api/deployment-status/', views.DiagramDeploymentAPIView.as_view(), name='api_deployment_status'),
    # path('api/deployment-status/<str:diagram_id>/', views.DiagramDeploymentAPIView.as_view(), name='api_deployment_status_detail'),
    # path('api/rollback/<int:site_id>/', views.DiagramRollbackAPIView.as_view(), name='api_rollback'),
]