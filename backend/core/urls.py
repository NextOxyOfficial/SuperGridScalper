from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.api_health, name='api_health'),
    path('verify/', views.verify_license, name='verify_license'),
    path('validation/', views.verify_license, name='validation'),  # Alias for verify
    path('plans/', views.get_plans, name='get_plans'),
    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),
    path('licenses/', views.get_licenses, name='get_licenses'),
    path('subscribe/', views.subscribe, name='subscribe'),
    path('settings/', views.get_ea_settings, name='get_ea_settings'),
    path('trade-data/update/', views.update_trade_data, name='update_trade_data'),
    path('trade-data/', views.get_trade_data, name='get_trade_data'),
    path('admin-stats/', views.admin_stats, name='admin_stats'),
    path('action-log/', views.add_action_log, name='add_action_log'),
    path('action-logs/', views.get_action_logs, name='get_action_logs'),
    path('ea-products/', views.get_ea_products, name='get_ea_products'),
]
