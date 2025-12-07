from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.api_health, name='api_health'),
    path('verify/', views.verify_license, name='verify_license'),
    path('plans/', views.get_plans, name='get_plans'),
]
