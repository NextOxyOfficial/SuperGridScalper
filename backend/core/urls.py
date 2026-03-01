from django.urls import path
from . import views
from . import unsubscribe_views
from . import fm_views

urlpatterns = [
    path('health/', views.api_health, name='api_health'),
    path('verify/', views.verify_license, name='verify_license'),
    path('validation/', views.verify_license, name='validation'),  # Alias for verify
    path('plans/', views.get_plans, name='get_plans'),
    path('payment-networks/', views.get_payment_networks, name='get_payment_networks'),
    path('license-purchase-requests/create/', views.create_license_purchase_request, name='create_license_purchase_request'),
    path('license-purchase-requests/', views.list_license_purchase_requests, name='list_license_purchase_requests'),
    path('register/', views.register, name='register'),
    path('verify-email/', views.verify_email, name='verify_email'),
    path('resend-verification/', views.resend_verification, name='resend_verification'),
    path('login/', views.login, name='login'),
    path('verify-login-otp/', views.verify_login_otp, name='verify_login_otp'),
    path('resend-login-otp/', views.resend_login_otp, name='resend_login_otp'),
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
    path('claim-free-exness/', views.claim_free_exness_license, name='claim_free_exness_license'),
    path('request-free-extension/', views.request_free_extension, name='request_free_extension'),
    path('referral/transactions/', views.get_referral_transactions, name='get_referral_transactions'),
    path('referral/payouts/', views.get_referral_payouts, name='get_referral_payouts'),
    
    # Trade Command System
    path('trade-commands/close-position/', views.close_position, name='close_position'),
    path('trade-commands/close-bulk/', views.close_bulk_positions, name='close_bulk_positions'),
    path('trade-commands/close-top-loss/', views.close_top_loss_positions, name='close_top_loss_positions'),
    path('trade-commands/close-all/', views.close_all_positions, name='close_all_positions'),
    path('trade-commands/pending/', views.get_pending_commands, name='get_pending_commands'),
    path('trade-commands/update-status/', views.update_command_status, name='update_command_status'),
    
    # Site Settings
    path('site-settings/', views.get_site_settings, name='get_site_settings'),
    
    # License Toggle & Nickname
    path('toggle-license/', views.toggle_license_status, name='toggle_license_status'),
    path('license-nickname/', views.update_license_nickname, name='update_license_nickname'),
    
    # Fund Manager Portal
    path('fund-managers/', fm_views.list_fund_managers, name='list_fund_managers'),
    path('fund-managers/<int:fm_id>/', fm_views.fund_manager_detail, name='fund_manager_detail'),
    path('fund-managers/leaderboard/', fm_views.fm_leaderboard, name='fm_leaderboard'),
    path('fund-managers/apply/', fm_views.apply_fund_manager, name='apply_fund_manager'),
    path('fund-managers/subscribe/', fm_views.subscribe_to_fm, name='subscribe_to_fm'),
    path('fund-managers/unsubscribe/', fm_views.unsubscribe_from_fm, name='unsubscribe_from_fm'),
    path('fund-managers/my-subscriptions/', fm_views.get_my_fm_subscriptions, name='get_my_fm_subscriptions'),
    path('fund-managers/assign-license/', fm_views.assign_license_to_fm, name='assign_license_to_fm'),
    path('fund-managers/unassign-license/', fm_views.unassign_license_from_fm, name='unassign_license_from_fm'),
    path('fund-managers/dashboard/', fm_views.fm_dashboard, name='fm_dashboard'),
    path('fund-managers/toggle-ea/', fm_views.fm_toggle_ea, name='fm_toggle_ea'),
    path('fund-managers/ea-status/', fm_views.check_fm_ea_status, name='check_fm_ea_status'),
    path('fund-managers/chat/', fm_views.fm_get_chat, name='fm_get_chat'),
    path('fund-managers/chat/send/', fm_views.fm_send_message, name='fm_send_message'),
    path('fund-managers/chat/pin/', fm_views.fm_pin_message, name='fm_pin_message'),
    path('fund-managers/review/', fm_views.submit_review, name='submit_review'),
    path('fund-managers/schedules/', fm_views.fm_manage_schedule, name='fm_manage_schedule'),
    path('economic-events/', fm_views.get_economic_events, name='get_economic_events'),
    path('trading-wave-alert/', fm_views.get_trading_wave_alert, name='get_trading_wave_alert'),
    path('fund-managers/update-avatar/', fm_views.update_fm_avatar, name='update_fm_avatar'),
    path('fund-managers/seed-dummy/', fm_views.seed_dummy_fund_managers, name='seed_dummy_fund_managers'),
    path('fund-managers/cancel-subscriber/', fm_views.fm_cancel_subscriber, name='fm_cancel_subscriber'),
    path('fund-managers/chat/media/', fm_views.fm_chat_media_upload, name='fm_chat_media_upload'),
    path('fund-managers/chat/profanity-check/', fm_views.check_chat_profanity, name='check_chat_profanity'),
    path('user-badges/', fm_views.get_user_badges, name='get_user_badges'),
]
