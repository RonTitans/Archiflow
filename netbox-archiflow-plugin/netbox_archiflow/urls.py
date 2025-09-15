from django.urls import path
from . import views

urlpatterns = [
    path('', views.DiagramListView.as_view(), name='diagram_list'),
    path('editor/', views.DiagramEditorView.as_view(), name='diagram_editor'),
    path('editor/<int:pk>/', views.DiagramEditorView.as_view(), name='diagram_edit'),
    path('create/', views.DiagramCreateView.as_view(), name='diagram_create'),
    path('diagnostic/', views.DiagramDiagnosticView.as_view(), name='diagram_diagnostic'),
]