"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from core import dashboard_views
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),
    
    # User Dashboard
    path('dashboard/', dashboard_views.dashboard, name='dashboard'),
    path('login/', dashboard_views.user_login, name='login'),
    path('logout/', dashboard_views.user_logout, name='logout'),
    path('download-ea/', dashboard_views.download_ea, name='download_ea'),
    # New unified EA download routes
    path('ea/<str:filename>', dashboard_views.download_ea_file, name='download_ea_file'),
    path('ea_files/<str:filename>', dashboard_views.download_ea_file, name='download_ea_file_legacy'),
]

# Serve media files in both development and production
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
