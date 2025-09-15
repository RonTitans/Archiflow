# NetBox Plugin Development - Complete Technical Guide

## Table of Contents
1. [Overview](#overview)
2. [Plugin Architecture](#plugin-architecture)
3. [Development Setup](#development-setup)
4. [PluginConfig Class](#pluginconfig-class)
5. [Models](#models)
6. [Views and Templates](#views-and-templates)
7. [URL Registration](#url-registration)
8. [Navigation Integration](#navigation-integration)
9. [REST API Integration](#rest-api-integration)
10. [GraphQL Integration](#graphql-integration)
11. [Background Tasks](#background-tasks)
12. [Signals and Event Handlers](#signals-and-event-handlers)
13. [Middleware](#middleware)
14. [Best Practices](#best-practices)
15. [Common Pitfalls](#common-pitfalls)
16. [Version Compatibility](#version-compatibility)

---

## Overview

NetBox plugins are packaged Django apps that extend NetBox functionality without modifying core code. They run within the same Python environment and can access NetBox's models and APIs.

### What Plugins Can Do
- ✅ Add new data models (database tables)
- ✅ Create new URLs under `/plugins/<name>/`
- ✅ Inject content into existing templates
- ✅ Add navigation menu items
- ✅ Register custom middleware
- ✅ Extend REST API and GraphQL
- ✅ Create background tasks
- ✅ Handle signals and events

### What Plugins Cannot Do
- ❌ Modify core NetBox models
- ❌ Override core templates completely
- ❌ Register URLs outside `/plugins/`
- ❌ Modify core settings
- ❌ Disable core NetBox components

---

## Plugin Architecture

### Directory Structure
```
my-netbox-plugin/
├── pyproject.toml              # Modern Python packaging
├── setup.py                    # Legacy packaging (optional)
├── README.md                   # Documentation
├── MANIFEST.in                 # Include non-Python files
└── my_plugin/                  # Plugin package
    ├── __init__.py            # PluginConfig definition
    ├── models.py              # Database models
    ├── views.py               # View classes
    ├── urls.py                # URL patterns
    ├── tables.py              # Table definitions
    ├── forms.py               # Form classes
    ├── filtersets.py          # Filtering logic
    ├── navigation.py          # Menu items
    ├── template_content.py    # Template extensions
    ├── api/                   # REST API
    │   ├── __init__.py
    │   ├── serializers.py
    │   ├── views.py
    │   └── urls.py
    ├── graphql/               # GraphQL API
    │   ├── __init__.py
    │   ├── types.py
    │   └── schema.py
    ├── templates/             # HTML templates
    │   └── my_plugin/
    │       └── *.html
    ├── static/                # Static files
    │   └── my_plugin/
    │       ├── css/
    │       └── js/
    └── migrations/            # Database migrations
        └── *.py
```

---

## Development Setup

### Prerequisites
- NetBox 3.2+ (4.0+ recommended)
- Python 3.8+
- PostgreSQL 14+
- Virtual environment

### Initial Setup

1. **Create Plugin Structure**
```bash
# Using cookiecutter (recommended)
pip install cookiecutter
cookiecutter https://github.com/netbox-community/cookiecutter-netbox-plugin

# Or manually
mkdir my-plugin
cd my-plugin
mkdir my_plugin
touch my_plugin/__init__.py
```

2. **Create pyproject.toml**
```toml
[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"

[project]
name = "netbox-my-plugin"
version = "0.1.0"
authors = [
    {name = "Your Name", email = "email@example.com"},
]
description = "A NetBox plugin"
readme = "README.md"
requires-python = ">=3.8"
classifiers = [
    "Framework :: Django",
    "Programming Language :: Python :: 3",
]
dependencies = []

[project.urls]
Homepage = "https://github.com/username/netbox-my-plugin"
Issues = "https://github.com/username/netbox-my-plugin/issues"
```

3. **Install in Development Mode**
```bash
# Activate NetBox virtual environment
source /opt/netbox/venv/bin/activate

# Install plugin
pip install -e .

# Add to NetBox configuration
echo "PLUGINS = ['my_plugin']" >> /opt/netbox/netbox/configuration.py
```

---

## PluginConfig Class

The heart of every plugin. Must be defined in `__init__.py`:

```python
from netbox.plugins import PluginConfig

class MyPluginConfig(PluginConfig):
    # Required attributes
    name = 'my_plugin'                    # Python package name
    verbose_name = 'My Plugin'            # Human-readable name
    description = 'Description here'       # Plugin description
    version = '0.1.0'                      # Semantic version
    author = 'Your Name'                   # Author name
    author_email = 'email@example.com'    # Author email
    
    # URL configuration
    base_url = 'my-plugin'                 # URL path (/plugins/my-plugin/)
    
    # Version compatibility
    min_version = '3.2.0'                  # Minimum NetBox version
    max_version = '4.9.99'                 # Maximum NetBox version
    
    # Configuration
    required_settings = ['API_KEY']        # Required config parameters
    default_settings = {                   # Default config values
        'enable_feature': True,
        'timeout': 30,
        'api_endpoint': 'https://api.example.com'
    }
    
    # Django apps to load
    django_apps = ['django_tables2']       # Additional Django apps
    
    # Middleware
    middleware = [                         # Custom middleware classes
        'my_plugin.middleware.CustomMiddleware'
    ]
    
    # Queues for background tasks
    queues = ['default', 'priority']       # RQ queue names
    
    # Template extensions
    template_extensions = [                # Template extension classes
        'my_plugin.template_content.MyContent'
    ]
    
    # Menu items
    menu_items = (                         # Navigation menu items
        'my_plugin.navigation.menu_items'
    )

config = MyPluginConfig  # Required!
```

---

## Models

### Creating Custom Models

```python
# models.py
from django.db import models
from netbox.models import NetBoxModel
from utilities.choices import ChoiceSet

class StatusChoices(ChoiceSet):
    STATUS_ACTIVE = 'active'
    STATUS_INACTIVE = 'inactive'
    
    CHOICES = [
        (STATUS_ACTIVE, 'Active', 'green'),
        (STATUS_INACTIVE, 'Inactive', 'red'),
    ]

class MyModel(NetBoxModel):
    """Inherit from NetBoxModel to get all NetBox features"""
    
    name = models.CharField(max_length=100)
    status = models.CharField(
        max_length=50,
        choices=StatusChoices,
        default=StatusChoices.STATUS_ACTIVE
    )
    description = models.TextField(blank=True)
    
    # Relations to core models
    site = models.ForeignKey(
        to='dcim.Site',
        on_delete=models.PROTECT,
        related_name='%(class)s_set'
    )
    
    # JSON field for flexible data
    metadata = models.JSONField(blank=True, null=True)
    
    class Meta:
        ordering = ['name']
        verbose_name = 'My Model'
        verbose_name_plural = 'My Models'
    
    def __str__(self):
        return self.name
    
    def get_absolute_url(self):
        return reverse('plugins:my_plugin:mymodel', args=[self.pk])
```

### NetBoxModel Features

Inheriting from `NetBoxModel` provides:
- Custom fields support
- Tags support
- Change logging
- Journaling
- Export templates
- Webhooks
- Validation

### Database Migrations

```bash
# Create migrations
python manage.py makemigrations my_plugin

# Apply migrations
python manage.py migrate
```

---

## Views and Templates

### View Classes

```python
# views.py
from netbox.views import generic
from . import models, tables, forms, filtersets

# List view
class MyModelListView(generic.ObjectListView):
    queryset = models.MyModel.objects.all()
    table = tables.MyModelTable
    filterset = filtersets.MyModelFilterSet
    filterset_form = forms.MyModelFilterForm
    template_name = 'my_plugin/mymodel_list.html'

# Detail view
class MyModelView(generic.ObjectView):
    queryset = models.MyModel.objects.all()
    template_name = 'my_plugin/mymodel.html'

# Edit view
class MyModelEditView(generic.ObjectEditView):
    queryset = models.MyModel.objects.all()
    form = forms.MyModelForm
    template_name = 'my_plugin/mymodel_edit.html'

# Delete view
class MyModelDeleteView(generic.ObjectDeleteView):
    queryset = models.MyModel.objects.all()
    template_name = 'my_plugin/mymodel_delete.html'

# Bulk views
class MyModelBulkImportView(generic.BulkImportView):
    queryset = models.MyModel.objects.all()
    model_form = forms.MyModelImportForm

class MyModelBulkEditView(generic.BulkEditView):
    queryset = models.MyModel.objects.all()
    filterset = filtersets.MyModelFilterSet
    table = tables.MyModelTable
    form = forms.MyModelBulkEditForm

class MyModelBulkDeleteView(generic.BulkDeleteView):
    queryset = models.MyModel.objects.all()
    filterset = filtersets.MyModelFilterSet
    table = tables.MyModelTable
```

### Templates

Templates must extend NetBox base templates:

```django
{# templates/my_plugin/mymodel_list.html #}
{% extends 'generic/object_list.html' %}
{% load render_table from django_tables2 %}

{% block title %}My Models{% endblock %}

{% block content %}
    <div class="row">
        <div class="col-md-12">
            {% render_table table %}
        </div>
    </div>
{% endblock %}
```

### Template Inheritance Hierarchy

NetBox 3.x:
- `base.html` → `base/layout.html` → Your template

NetBox 4.x:
- `base.html` → `generic/*.html` → Your template

---

## URL Registration

```python
# urls.py
from django.urls import path
from . import views

urlpatterns = [
    # List view
    path('', views.MyModelListView.as_view(), name='mymodel_list'),
    
    # Add view
    path('add/', views.MyModelEditView.as_view(), name='mymodel_add'),
    
    # Import view
    path('import/', views.MyModelBulkImportView.as_view(), name='mymodel_import'),
    
    # Bulk edit
    path('edit/', views.MyModelBulkEditView.as_view(), name='mymodel_bulk_edit'),
    
    # Bulk delete
    path('delete/', views.MyModelBulkDeleteView.as_view(), name='mymodel_bulk_delete'),
    
    # Object views
    path('<int:pk>/', views.MyModelView.as_view(), name='mymodel'),
    path('<int:pk>/edit/', views.MyModelEditView.as_view(), name='mymodel_edit'),
    path('<int:pk>/delete/', views.MyModelDeleteView.as_view(), name='mymodel_delete'),
]
```

URLs are automatically prefixed with `/plugins/<plugin_name>/`

---

## Navigation Integration

```python
# navigation.py
from netbox.plugins import PluginMenuButton, PluginMenuItem
from utilities.choices import ButtonColorChoices

# Menu items
menu_items = (
    PluginMenuItem(
        link='plugins:my_plugin:mymodel_list',
        link_text='My Models',
        permissions=['my_plugin.view_mymodel'],
        buttons=(
            PluginMenuButton(
                link='plugins:my_plugin:mymodel_add',
                title='Add',
                icon_class='mdi mdi-plus-thick',
                color=ButtonColorChoices.GREEN,
                permissions=['my_plugin.add_mymodel']
            ),
        )
    ),
)
```

---

## REST API Integration

### Serializers

```python
# api/serializers.py
from rest_framework import serializers
from netbox.api.serializers import NetBoxModelSerializer
from ..models import MyModel

class MyModelSerializer(NetBoxModelSerializer):
    url = serializers.HyperlinkedIdentityField(
        view_name='plugins-api:my_plugin-api:mymodel-detail'
    )
    
    class Meta:
        model = MyModel
        fields = [
            'id', 'url', 'display', 'name', 'status', 
            'description', 'created', 'last_updated'
        ]
```

### API Views

```python
# api/views.py
from netbox.api.viewsets import NetBoxModelViewSet
from ..models import MyModel
from .serializers import MyModelSerializer

class MyModelViewSet(NetBoxModelViewSet):
    queryset = MyModel.objects.all()
    serializer_class = MyModelSerializer
```

### API URLs

```python
# api/urls.py
from netbox.api.routers import NetBoxRouter
from . import views

router = NetBoxRouter()
router.register('mymodels', views.MyModelViewSet)
urlpatterns = router.urls
```

API endpoints available at: `/api/plugins/my-plugin/`

---

## GraphQL Integration

```python
# graphql/types.py
import graphene
from netbox.graphql.types import NetBoxObjectType
from ..models import MyModel

class MyModelType(NetBoxObjectType):
    class Meta:
        model = MyModel
        fields = '__all__'
        filterset_class = MyModelFilterSet

# graphql/schema.py
import graphene

class Query(graphene.ObjectType):
    my_model = graphene.Field(MyModelType, id=graphene.Int())
    my_model_list = graphene.List(MyModelType)
    
    def resolve_my_model(self, info, id):
        return MyModel.objects.get(pk=id)
    
    def resolve_my_model_list(self, info):
        return MyModel.objects.all()

schema = graphene.Schema(query=Query)
```

---

## Background Tasks

```python
# jobs.py
from netbox.jobs import Job

class MyBackgroundJob(Job):
    class Meta:
        name = "My Background Job"
        description = "Performs background processing"
        read_only = False
    
    def run(self, data, commit):
        # Your job logic here
        self.log_success("Job completed successfully")
        return "Job result"

# Register job
jobs = [MyBackgroundJob]
```

---

## Signals and Event Handlers

```python
# signals.py
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver
from .models import MyModel

@receiver(post_save, sender=MyModel)
def handle_model_save(sender, instance, created, **kwargs):
    if created:
        # Handle new object
        pass
    else:
        # Handle update
        pass

@receiver(pre_delete, sender=MyModel)
def handle_model_delete(sender, instance, **kwargs):
    # Cleanup before deletion
    pass
```

---

## Middleware

```python
# middleware.py
class MyPluginMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Code before view
        response = self.get_response(request)
        # Code after view
        return response
```

---

## Best Practices

### 1. Follow Django Conventions
- Use Django's ORM properly
- Follow PEP 8 style guide
- Use Django's built-in features

### 2. Respect NetBox Architecture
- Don't fight the framework
- Use NetBox base classes
- Follow NetBox patterns

### 3. Performance
- Use select_related() and prefetch_related()
- Add database indexes
- Cache expensive operations

### 4. Security
- Validate all input
- Use Django's CSRF protection
- Check permissions properly

### 5. Testing
```python
# tests/test_models.py
from django.test import TestCase
from ..models import MyModel

class MyModelTestCase(TestCase):
    def setUp(self):
        self.obj = MyModel.objects.create(name="Test")
    
    def test_str(self):
        self.assertEqual(str(self.obj), "Test")
```

### 6. Documentation
- Document all public APIs
- Include README with examples
- Add inline code comments

---

## Common Pitfalls

### 1. Template Issues
**Problem**: TemplateDoesNotExist errors
**Solution**: Check template paths and inheritance

### 2. Import Errors
**Problem**: Circular imports
**Solution**: Use string references for models

### 3. Migration Issues
**Problem**: Migration conflicts
**Solution**: Squash migrations regularly

### 4. Permission Problems
**Problem**: Views not accessible
**Solution**: Check permission_required decorators

### 5. Static Files
**Problem**: CSS/JS not loading
**Solution**: Run `collectstatic` command

---

## Version Compatibility

### NetBox 3.x vs 4.x

| Feature | NetBox 3.x | NetBox 4.x |
|---------|------------|------------|
| Python | 3.8+ | 3.10+ |
| Django | 3.2 | 4.2+ |
| PostgreSQL | 11+ | 14+ |
| Base template | `base/layout.html` | `generic/object.html` |
| Navigation | `menu_items` | `navigation.menu_items` |
| Forms | Django forms | NetBox forms |
| Tables | django_tables2 | NetBox tables |
| API | DRF 3.14 | DRF 3.15+ |

### Migration Guide (3.x to 4.x)

1. Update template inheritance
2. Update import statements
3. Update navigation registration
4. Update form classes
5. Test thoroughly

---

## Debugging Tips

### 1. Enable Debug Mode
```python
# configuration.py
DEBUG = True
```

### 2. Check Logs
```bash
journalctl -u netbox
tail -f /var/log/netbox/*
```

### 3. Django Shell
```bash
python manage.py shell_plus
>>> from my_plugin.models import MyModel
>>> MyModel.objects.all()
```

### 4. Database Inspection
```sql
\dt my_plugin.*  -- List plugin tables
\d my_plugin_mymodel  -- Describe table
```

### 5. API Testing
```bash
curl -H "Authorization: Token $TOKEN" \
     http://localhost/api/plugins/my-plugin/
```

---

## Resources

- [Official Plugin Development Guide](https://netboxlabs.com/docs/netbox/plugins/development/)
- [Plugin Tutorial](https://github.com/netbox-community/netbox-plugin-tutorial)
- [Cookiecutter Template](https://github.com/netbox-community/cookiecutter-netbox-plugin)
- [Plugin Ideas Board](https://github.com/netbox-community/netbox/discussions/categories/plugins)
- [NetBox GitHub Wiki](https://github.com/netbox-community/netbox/wiki)

---

## Example: Complete Minimal Plugin

```python
# __init__.py
from netbox.plugins import PluginConfig

class MinimalPluginConfig(PluginConfig):
    name = 'minimal_plugin'
    verbose_name = 'Minimal Plugin'
    description = 'A minimal NetBox plugin'
    version = '0.1.0'
    min_version = '3.2.0'

config = MinimalPluginConfig

# models.py
from django.db import models
from netbox.models import NetBoxModel

class SimpleModel(NetBoxModel):
    name = models.CharField(max_length=100)
    
    def __str__(self):
        return self.name

# views.py
from netbox.views import generic
from .models import SimpleModel

class SimpleModelListView(generic.ObjectListView):
    queryset = SimpleModel.objects.all()

# urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('', views.SimpleModelListView.as_view(), name='simplemodel_list'),
]
```

This creates a functional plugin with a model and list view!