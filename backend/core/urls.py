from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.api_health, name='api_health'),
    path('verify/', views.verify_license, name='verify_license'),
    path('validation/', views.verify_license, name='validation'),  # Alias for verify
    path('plans/', views.get_plans, name='get_plans'),
    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),
    path('subscribe/', views.subscribe, name='subscribe'),
]
