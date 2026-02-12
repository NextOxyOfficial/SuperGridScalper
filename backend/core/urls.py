from django.urls import path
from . import views
from . import unsubscribe_views

urlpatterns = [
    path('health/', views.api_health, name='api_health'),
    path('verify/', views.verify_license, name='verify_license'),
    path('validation/', views.verify_license, name='validation'),  # Alias for verify
    path('plans/', views.get_plans, name='get_plans'),
    path('payment-networks/', views.get_payment_networks, name='get_payment_networks'),
    path('license-purchase-requests/create/', views.create_license_purchase_request, name='create_license_purchase_request'),
    path('license-purchase-requests/', views.list_license_purchase_requests, name='list_license_purchase_requests'),
    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),
    path('unsubscribe/', unsubscribe_views.unsubscribe, name='unsubscribe'),
    path('unsubscribe/one-click/', unsubscribe_views.unsubscribe_one_click, name='unsubscribe_one_click'),
    path('resubscribe/', unsubscribe_views.resubscribe, name='resubscribe'),
    path('password-reset/request/', views.password_reset_request, name='password_reset_request'),
    path('password-reset/confirm/', views.password_reset_confirm, name='password_reset_confirm'),
    path('licenses/', views.get_licenses, name='get_licenses'),
    path('subscribe/', views.subscribe, name='subscribe'),
    path('extension-requests/create/', views.create_extension_request, name='create_extension_request'),
    path('settings/', views.get_ea_settings, name='get_ea_settings'),
    path('trade-data/update/', views.update_trade_data, name='update_trade_data'),
    path('trade-data/', views.get_trade_data, name='get_trade_data'),
    path('admin-stats/', views.admin_stats, name='admin_stats'),
    path('action-log/', views.add_action_log, name='add_action_log'),
    path('action-logs/', views.get_action_logs, name='get_action_logs'),
    path('ea-products/', views.get_ea_products, name='get_ea_products'),
    path('ea-download/<int:product_id>/', views.download_ea_file, name='download_ea_file'),
    path('ea-update-status/', views.get_ea_update_status, name='get_ea_update_status'),
    
    # Referral System
    path('referral/create/', views.create_referral, name='create_referral'),
    path('referral/stats/', views.get_referral_stats, name='get_referral_stats'),
    path('referral/track-click/', views.track_referral_click, name='track_referral_click'),
    path('referral/request-payout/', views.request_payout, name='request_payout'),
    
    # Trade Command System
    path('trade-commands/close-position/', views.close_position, name='close_position'),
    path('trade-commands/close-bulk/', views.close_bulk_positions, name='close_bulk_positions'),
    path('trade-commands/close-top-loss/', views.close_top_loss_positions, name='close_top_loss_positions'),
    path('trade-commands/close-all/', views.close_all_positions, name='close_all_positions'),
    path('trade-commands/pending/', views.get_pending_commands, name='get_pending_commands'),
    path('trade-commands/update-status/', views.update_command_status, name='update_command_status'),
    
    # Site Settings
    path('site-settings/', views.get_site_settings, name='get_site_settings'),
    
    # License Toggle
    path('toggle-license/', views.toggle_license_status, name='toggle_license_status'),
]
