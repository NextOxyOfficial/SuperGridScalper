from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from django.conf import settings as django_settings
from django.core.mail import send_mail
from django.utils.html import format_html
from django.utils import timezone
from decimal import Decimal
from .models import SubscriptionPlan, License, LicenseVerificationLog, EASettings, TradeData, EAProduct, Referral, ReferralAttribution, ReferralTransaction, ReferralPayout, TradeCommand, EAActionLog, SiteSettings, PaymentNetwork, LicensePurchaseRequest, SMTPSettings, EmailPreference


# Unregister default User admin and register with search
admin.site.unregister(User)

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    search_fields = ['username', 'email', 'first_name', 'last_name']
    list_display = ['username', 'email', 'is_active', 'date_joined']


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ['name', 'price', 'duration_days', 'max_accounts', 'is_active']
    list_filter = ['is_active']
    search_fields = ['name']
    list_editable = ['price', 'duration_days', 'max_accounts', 'is_active']


class EASettingsInline(admin.StackedInline):
    model = EASettings
    can_delete = False
    verbose_name = "EA Settings"
    verbose_name_plural = "⚙️ EA Settings"
    extra = 0
    fieldsets = (
        ('📈 BUY Grid', {'fields': (
            ('buy_range_start', 'buy_range_end'),
            ('buy_gap_pips', 'max_buy_orders'),
            ('buy_take_profit_pips', 'buy_stop_loss_pips'),
        ), 'classes': ('collapse',)}),
        ('📉 SELL Grid', {'fields': (
            ('sell_range_start', 'sell_range_end'),
            ('sell_gap_pips', 'max_sell_orders'),
            ('sell_take_profit_pips', 'sell_stop_loss_pips'),
        ), 'classes': ('collapse',)}),
        ('🔄 Recovery', {'fields': (
            ('enable_buy_be_recovery', 'enable_sell_be_recovery'),
            ('max_buy_be_recovery_orders', 'max_sell_be_recovery_orders'),
        ), 'classes': ('collapse',)}),
    )


class TradeDataInline(admin.StackedInline):
    model = TradeData
    can_delete = False
    verbose_name = "Trade Data"
    verbose_name_plural = "📊 Live Trade Data"
    extra = 0
    readonly_fields = ['account_balance', 'account_equity', 'account_profit', 
                       'account_margin', 'account_free_margin', 'total_buy_positions', 
                       'total_sell_positions', 'total_buy_lots', 'total_sell_lots',
                       'total_buy_profit', 'total_sell_profit', 'symbol', 'current_price',
                       'open_positions', 'last_update']
    fieldsets = (
        ('💵 Account', {'fields': (
            ('account_balance', 'account_equity', 'account_profit'),
            ('account_margin', 'account_free_margin'),
        )}),
        ('📈 BUY Positions', {'fields': (
            ('total_buy_positions', 'total_buy_lots', 'total_buy_profit'),
        )}),
        ('📉 SELL Positions', {'fields': (
            ('total_sell_positions', 'total_sell_lots', 'total_sell_profit'),
        )}),
        ('📍 Market', {'fields': (('symbol', 'current_price', 'last_update'),)}),
        ('📋 Open Positions (JSON)', {'fields': ('open_positions',), 'classes': ('collapse',)}),
    )
    
    def has_add_permission(self, request, obj=None):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PaymentNetwork)
class PaymentNetworkAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'token_symbol', 'wallet_address', 'is_active', 'sort_order', 'updated_at']
    list_filter = ['is_active', 'token_symbol']
    search_fields = ['name', 'code', 'wallet_address']
    list_editable = ['is_active', 'sort_order']


@admin.register(LicensePurchaseRequest)
class LicensePurchaseRequestAdmin(admin.ModelAdmin):
    list_display = ['created_at', 'user', 'plan', 'network', 'amount_usd', 'status', 'mt5_account', 'txid', 'reviewed_at', 'license_link']
    list_filter = ['status', 'network', 'plan', 'created_at']
    search_fields = ['user__email', 'txid', 'mt5_account']
    readonly_fields = ['created_at', 'updated_at', 'issued_license', 'reviewed_at', 'reviewed_by']
    actions = ['approve_requests', 'reject_requests']
    
    def license_link(self, obj):
        if obj.issued_license:
            url = f'/admin/core/license/{obj.issued_license.id}/change/'
            return format_html('<a href="{}">View License</a>', url)
        return '-'
    license_link.short_description = 'License'
    
    def save_model(self, request, obj, form, change):
        """Auto-create license when status is changed to approved via admin form"""
        if change and obj.status == 'approved' and not obj.issued_license_id:
            # Create license automatically
            try:
                new_license = License.objects.create(
                    user=obj.user,
                    plan=obj.plan,
                    mt5_account=(obj.mt5_account or None)
                )
                obj.issued_license = new_license
                obj.reviewed_by = request.user
                obj.reviewed_at = timezone.now()
                self.message_user(request, f'License {new_license.license_key[:16]}... created for {obj.user.email}')
            except Exception as e:
                self.message_user(request, f'Failed to create license: {e}', level='error')
        super().save_model(request, obj, form, change)

    def approve_requests(self, request, queryset):
        for obj in queryset.select_related('user', 'plan', 'network', 'issued_license'):
            if obj.status != 'pending':
                continue
            
            # If already has a license linked, just update status
            if obj.issued_license_id:
                obj.status = 'approved'
                obj.reviewed_by = request.user
                obj.reviewed_at = timezone.now()
                obj.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'updated_at'])

                try:
                    from core.utils import send_admin_notification
                    send_admin_notification(
                        subject=f'Admin Alert: License Approved (#{obj.id})',
                        heading='License Activated',
                        html_body=(
                            f"<p><strong>User:</strong> {obj.user.email}</p>"
                            f"<p><strong>Plan:</strong> {obj.plan.name}</p>"
                            f"<p><strong>Request ID:</strong> #{obj.id}</p>"
                            f"<p><strong>License Key:</strong> {obj.issued_license.license_key if obj.issued_license else '-'} </p>"
                            f"<p><strong>Expires At:</strong> {obj.issued_license.expires_at.isoformat() if obj.issued_license else '-'} </p>"
                            f"<p><strong>Reviewed By:</strong> {request.user.username}</p>"
                        ),
                        text_body=(
                            f"License approved\n"
                            f"User: {obj.user.email}\n"
                            f"Plan: {obj.plan.name}\n"
                            f"Request ID: #{obj.id}\n"
                            f"License Key: {obj.issued_license.license_key if obj.issued_license else '-'}\n"
                            f"Expires At: {obj.issued_license.expires_at.isoformat() if obj.issued_license else '-'}\n"
                            f"Reviewed By: {request.user.username}"
                        ),
                        preheader=f'Approved: {obj.user.email} ({obj.plan.name})'
                    )
                except Exception:
                    pass

                try:
                    from core.utils import get_email_from_address, render_email_template, add_email_headers, can_send_email_to_user, get_unsubscribe_url
                    from django.core.mail import EmailMultiAlternatives
                    
                    base = (getattr(django_settings, 'FRONTEND_URL', '') or '').rstrip('/')
                    subject = 'Payment Approved - Your License is Ready'

                    if not can_send_email_to_user(obj.user, 'transactional'):
                        raise Exception('User opted out of transactional emails')
                    
                    html_message = render_email_template(
                        subject=subject,
                        heading='🎉 Payment Approved!',
                        message=f"""
                            <p>Hi <strong>{obj.user.first_name or 'Trader'}</strong>,</p>
                            <p>Great news! Your payment has been <strong style="color: #10b981;">approved</strong> and your license is ready to use.</p>
                            
                            <div style="background-color: rgba(16, 185, 129, 0.1); border-left: 3px solid #10b981; padding: 16px; margin: 20px 0; border-radius: 4px;">
                                <p style="margin: 0 0 8px 0; color: #10b981; font-weight: 600;">License Details:</p>
                                <p style="margin: 4px 0; color: #d1d5db;"><strong>Request ID:</strong> #{obj.id}</p>
                                <p style="margin: 4px 0; color: #d1d5db;"><strong>Plan:</strong> {obj.plan.name}</p>
                                <p style="margin: 4px 0; color: #d1d5db;"><strong>License Key:</strong> <code style="background-color: rgba(6, 182, 212, 0.1); padding: 2px 6px; border-radius: 4px; color: #06b6d4;">{obj.issued_license.license_key if obj.issued_license else '-'}</code></p>
                                <p style="margin: 4px 0; color: #d1d5db;"><strong>Expires At:</strong> {obj.issued_license.expires_at.strftime('%B %d, %Y') if obj.issued_license else '-'}</p>
                            </div>
                            
                            <p>You can now access your license and start trading with our AI Expert Advisor.</p>
                        """,
                        cta_text='OPEN DASHBOARD',
                        cta_url=f'{base}/dashboard',
                        footer_note='Thank you for choosing MarksTrades!',
                        preheader=f'Your {obj.plan.name} license has been approved and activated. Start trading now!',
                        unsubscribe_url=get_unsubscribe_url(obj.user)
                    )
                    
                    text_msg = f"Hi {obj.user.first_name or 'Trader'},\n\nYour payment has been approved and your license is ready.\n\nRequest ID: #{obj.id}\nPlan: {obj.plan.name}\nLicense Key: {obj.issued_license.license_key if obj.issued_license else '-'}\n\nOpen your dashboard: {base}/dashboard\n\nThank you for choosing MarksTrades!"
                    
                    msg = EmailMultiAlternatives(subject, text_msg, get_email_from_address(), [obj.user.email])
                    msg.attach_alternative(html_message, "text/html")
                    msg = add_email_headers(msg, 'transactional', user=obj.user)
                    msg.send(fail_silently=False)
                except Exception:
                    pass
                continue

            # Create new license
            try:
                new_license = License.objects.create(
                    user=obj.user,
                    plan=obj.plan,
                    mt5_account=(obj.mt5_account or None)
                )
            except Exception as e:
                print(f'[ADMIN] License creation failed for request {obj.id}: {e}')
                self.message_user(request, f'Failed to create license for request #{obj.id}: {e}', level='error')
                continue
            
            obj.issued_license = new_license
            obj.status = 'approved'
            obj.reviewed_by = request.user
            obj.reviewed_at = timezone.now()
            obj.save(update_fields=['issued_license', 'status', 'reviewed_by', 'reviewed_at', 'updated_at'])

            try:
                attribution = ReferralAttribution.objects.select_related('referral').filter(referred_user=obj.user).first()
                if attribution and attribution.referral and attribution.referral.is_active and attribution.referral.referrer_id != obj.user.id:
                    referral = attribution.referral
                    if not ReferralTransaction.objects.filter(purchase_request=obj).exists():
                        commission_amount = (obj.amount_usd * referral.commission_percent) / Decimal('100')
                        ReferralTransaction.objects.create(
                            referral=referral,
                            referred_user=obj.user,
                            purchase_request=obj,
                            purchase_amount=obj.amount_usd,
                            commission_amount=commission_amount,
                            status='pending'
                        )
                        referral.purchases += 1
                        referral.total_earnings += commission_amount
                        referral.pending_earnings += commission_amount
                        referral.save()
            except Exception:
                pass

            try:
                from core.utils import send_admin_notification
                send_admin_notification(
                    subject=f'Admin Alert: License Approved (#{obj.id})',
                    heading='License Activated',
                    html_body=(
                        f"<p><strong>User:</strong> {obj.user.email}</p>"
                        f"<p><strong>Plan:</strong> {obj.plan.name}</p>"
                        f"<p><strong>Request ID:</strong> #{obj.id}</p>"
                        f"<p><strong>License Key:</strong> {new_license.license_key}</p>"
                        f"<p><strong>Expires At:</strong> {new_license.expires_at.isoformat()}</p>"
                        f"<p><strong>Reviewed By:</strong> {request.user.username}</p>"
                    ),
                    text_body=(
                        f"License approved\n"
                        f"User: {obj.user.email}\n"
                        f"Plan: {obj.plan.name}\n"
                        f"Request ID: #{obj.id}\n"
                        f"License Key: {new_license.license_key}\n"
                        f"Expires At: {new_license.expires_at.isoformat()}\n"
                        f"Reviewed By: {request.user.username}"
                    ),
                    preheader=f'Approved: {obj.user.email} ({obj.plan.name})'
                )
            except Exception:
                pass

            try:
                from core.utils import get_email_from_address, render_email_template, add_email_headers, can_send_email_to_user, get_unsubscribe_url
                from django.core.mail import EmailMultiAlternatives
                
                base = (getattr(django_settings, 'FRONTEND_URL', '') or '').rstrip('/')
                subject = 'Payment Approved - Your License is Ready'
                
                text_message = (
                    f"Hi {obj.user.first_name or 'Trader'},\n\n"
                    "Your payment has been approved and your license has been issued.\n\n"
                    f"Request ID: #{obj.id}\n"
                    f"Plan: {obj.plan.name}\n"
                    f"License Key: {new_license.license_key}\n"
                    f"Expires At: {new_license.expires_at.isoformat()}\n\n"
                    f"Open your dashboard: {base}/dashboard\n\n"
                    "Thank you for your purchase."
                )
                
                html_message = render_email_template(
                    subject=subject,
                    heading='🎉 Payment Approved!',
                    message=f"""
                        <p>Hi <strong>{obj.user.first_name or 'Trader'}</strong>,</p>
                        <p>Great news! Your payment has been <strong style="color: #10b981;">approved</strong> and your license has been issued.</p>
                        
                        <div style="background-color: rgba(16, 185, 129, 0.1); border-left: 3px solid #10b981; padding: 16px; margin: 20px 0; border-radius: 4px;">
                            <p style="margin: 0 0 8px 0; color: #10b981; font-weight: 600;">License Details:</p>
                            <p style="margin: 4px 0; color: #d1d5db;"><strong>Request ID:</strong> #{obj.id}</p>
                            <p style="margin: 4px 0; color: #d1d5db;"><strong>Plan:</strong> {obj.plan.name}</p>
                            <p style="margin: 4px 0; color: #d1d5db;"><strong>License Key:</strong> <code style="background-color: rgba(6, 182, 212, 0.1); padding: 2px 6px; border-radius: 4px; color: #06b6d4;">{new_license.license_key}</code></p>
                            <p style="margin: 4px 0; color: #d1d5db;"><strong>Expires At:</strong> {new_license.expires_at.strftime('%B %d, %Y')}</p>
                        </div>
                        
                        <p>You can now access your license and start trading with our AI Expert Advisor.</p>
                    """,
                    cta_text='OPEN DASHBOARD',
                    cta_url=f'{base}/dashboard',
                    footer_note='Thank you for choosing MarksTrades!',
                    preheader=f'Your {obj.plan.name} license has been approved and activated. Start trading now!',
                    unsubscribe_url=get_unsubscribe_url(obj.user)
                )
                
                msg = EmailMultiAlternatives(subject, text_message, get_email_from_address(), [obj.user.email])
                msg.attach_alternative(html_message, "text/html")
                msg = add_email_headers(msg, 'transactional', user=obj.user)
                msg.send(fail_silently=False)
            except Exception:
                pass

    approve_requests.short_description = 'Approve selected requests and issue license'

    def reject_requests(self, request, queryset):
        for obj in queryset.select_related('user', 'plan', 'network'):
            if obj.status != 'pending':
                continue
            obj.status = 'rejected'
            obj.reviewed_by = request.user
            obj.reviewed_at = timezone.now()
            obj.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'updated_at'])

            try:
                from core.utils import get_email_from_address, render_email_template, add_email_headers, can_send_email_to_user, get_unsubscribe_url
                from django.core.mail import EmailMultiAlternatives
                
                base = (getattr(django_settings, 'FRONTEND_URL', '') or '').rstrip('/')
                subject = 'Payment Rejected - Action Needed'

                if not can_send_email_to_user(obj.user, 'transactional'):
                    raise Exception('User opted out of transactional emails')
                
                text_message = (
                    f"Hi {obj.user.first_name or 'Trader'},\n\n"
                    "Unfortunately, your payment could not be verified and has been rejected.\n\n"
                    f"Request ID: #{obj.id}\n"
                    f"Plan: {obj.plan.name}\n"
                    f"Network: {obj.network.name if obj.network else '-'}\n"
                    f"TXID: {obj.txid or '-'}\n\n"
                    "You can submit a new payment proof from your dashboard.\n"
                    f"Open your dashboard: {base}/dashboard\n\n"
                    "If you believe this is a mistake, please contact support."
                )
                
                html_message = render_email_template(
                    subject=subject,
                    heading='Payment Verification Failed',
                    message=f"""
                        <p>Hi <strong>{obj.user.first_name or 'Trader'}</strong>,</p>
                        <p>Unfortunately, your payment could not be verified and has been <strong style="color: #ef4444;">rejected</strong>.</p>
                        
                        <div style="background-color: rgba(239, 68, 68, 0.1); border-left: 3px solid #ef4444; padding: 16px; margin: 20px 0; border-radius: 4px;">
                            <p style="margin: 0 0 8px 0; color: #ef4444; font-weight: 600;">Request Details:</p>
                            <p style="margin: 4px 0; color: #d1d5db;"><strong>Request ID:</strong> #{obj.id}</p>
                            <p style="margin: 4px 0; color: #d1d5db;"><strong>Plan:</strong> {obj.plan.name}</p>
                            <p style="margin: 4px 0; color: #d1d5db;"><strong>Network:</strong> {obj.network.name if obj.network else '-'}</p>
                            <p style="margin: 4px 0; color: #d1d5db;"><strong>TXID:</strong> {obj.txid or '-'}</p>
                        </div>
                        
                        <p><strong>What to do next:</strong></p>
                        <ul style="color: #d1d5db; line-height: 1.7;">
                            <li>Double-check your payment transaction</li>
                            <li>Submit a new payment proof from your dashboard</li>
                            <li>Contact support if you believe this is a mistake</li>
                        </ul>
                    """,
                    cta_text='SUBMIT NEW PROOF',
                    cta_url=f'{base}/dashboard',
                    footer_note='If you believe this is a mistake, please contact our support team immediately.',
                    preheader=f'Payment verification failed for request #{obj.id}. Please review and resubmit.',
                    unsubscribe_url=get_unsubscribe_url(obj.user)
                )
                
                msg = EmailMultiAlternatives(subject, text_message, get_email_from_address(), [obj.user.email])
                msg.attach_alternative(html_message, "text/html")
                msg = add_email_headers(msg, 'transactional', user=obj.user)
                msg.send(fail_silently=False)
            except Exception:
                pass

    reject_requests.short_description = 'Reject selected requests'


@admin.register(License)
class LicenseAdmin(admin.ModelAdmin):
    list_display = ['license_key_display', 'user', 'plan', 'status_display', 'mt5_account', 'investment_display', 'trade_status', 'days_remaining_display', 'expires_at']
    list_filter = ['status', 'plan']
    search_fields = ['license_key', 'user__email', 'mt5_account', 'user__username']
    readonly_fields = ['license_key', 'activated_at', 'verification_count', 'last_verified', 'created_at', 'updated_at']
    autocomplete_fields = ['user']
    inlines = [EASettingsInline, TradeDataInline]
    
    fieldsets = (
        ('🔑 License Info', {'fields': ('user', 'plan', 'license_key', 'status')}),
        ('📅 Validity', {'fields': (('activated_at', 'expires_at'),)}),
        ('💻 MT5 Binding', {'fields': (('mt5_account', 'hardware_id'),)}),
        ('📊 Verification Stats', {'fields': (('last_verified', 'verification_count'),), 'classes': ('collapse',)}),
    )

    def license_key_display(self, obj):
        return f"{obj.license_key[:16]}..."
    license_key_display.short_description = 'License Key'

    def status_display(self, obj):
        colors = {
            'active': ('green', '✅'),
            'expired': ('red', '❌'),
            'suspended': ('orange', '⚠️'),
            'cancelled': ('gray', '🚫'),
        }
        color, icon = colors.get(obj.status, ('gray', ''))
        return format_html(
            '<span style="color: {}; font-weight: bold;">{} {}</span>',
            color, icon, obj.status.upper()
        )
    status_display.short_description = 'Status'

    def investment_display(self, obj):
        """Show account balance from trade data instead of investment amount"""
        try:
            td = obj.trade_data
            return f"${td.account_balance:,.0f}"
        except:
            return "-"
    investment_display.short_description = 'Balance'

    def trade_status(self, obj):
        try:
            td = obj.trade_data
            profit = td.account_profit
            color = 'green' if profit >= 0 else 'red'
            profit_str = f"{profit:,.2f}"
            return format_html(
                '<span style="color: {};">${}</span> <small>({}B/{}S)</small>',
                color, profit_str, td.total_buy_positions, td.total_sell_positions
            )
        except:
            return format_html('<span style="color: gray;">{}</span>', 'No data')
    trade_status.short_description = 'Trading'

    def days_remaining_display(self, obj):
        days = obj.days_remaining()
        if days <= 0:
            return format_html('<span style="color: red; font-weight: bold;">{}</span>', 'EXPIRED')
        elif days <= 7:
            return format_html('<span style="color: orange; font-weight: bold;">{} days</span>', days)
        return format_html('<span style="color: green;">{} days</span>', days)
    days_remaining_display.short_description = 'Days Left'


@admin.register(LicenseVerificationLog)
class LicenseVerificationLogAdmin(admin.ModelAdmin):
    list_display = ['created_at', 'license_key_display', 'mt5_account', 'ip_address', 'is_valid', 'message']
    list_filter = ['is_valid', 'created_at']
    search_fields = ['license_key', 'mt5_account']
    readonly_fields = ['license', 'license_key', 'mt5_account', 'hardware_id', 'ip_address', 'is_valid', 'message', 'created_at']
    date_hierarchy = 'created_at'

    def license_key_display(self, obj):
        return f"{obj.license_key[:16]}..."
    license_key_display.short_description = 'License Key'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(EASettings)
class EASettingsAdmin(admin.ModelAdmin):
    list_display = ['get_mt5_account', 'symbol', 'buy_gap_pips', 'buy_range_display', 'max_buy_orders', 'updated_at']
    list_filter = ['symbol']
    search_fields = ['license__license_key', 'license__mt5_account']
    list_editable = ['buy_gap_pips', 'max_buy_orders']  # Quick edit from list view
    
    # Recovery lot sizes are auto-calculated, so make them readonly
    readonly_fields = ['buy_be_recovery_lot_min', 'sell_be_recovery_lot_min', 'license', 'symbol']
    
    # Disable adding new settings - they are created automatically when EA connects
    def has_add_permission(self, request):
        return False
    
    fieldsets = (
        ('License & Symbol (Read-only)', {
            'fields': ('license', 'symbol'),
            'description': 'Settings are created automatically when EA connects. Edit existing settings below.'
        }),
        ('📈 BUY Grid Settings', {
            'fields': (
                ('buy_range_start', 'buy_range_end'),
                ('buy_gap_pips', 'max_buy_orders'),
                ('buy_take_profit_pips', 'buy_stop_loss_pips'),
                ('buy_trailing_start_pips', 'buy_initial_sl_pips'),
                ('buy_trailing_ratio', 'buy_max_sl_distance', 'buy_trailing_step_pips'),
            )
        }),
        ('📉 SELL Grid Settings', {
            'fields': (
                ('sell_range_start', 'sell_range_end'),
                ('sell_gap_pips', 'max_sell_orders'),
                ('sell_take_profit_pips', 'sell_stop_loss_pips'),
                ('sell_trailing_start_pips', 'sell_initial_sl_pips'),
                ('sell_trailing_ratio', 'sell_max_sl_distance', 'sell_trailing_step_pips'),
            )
        }),
        ('🎯 Breakeven Trailing', {
            'fields': (
                'enable_breakeven_trailing',
                ('breakeven_buy_trailing_pips', 'breakeven_sell_trailing_pips'),
                ('breakeven_trailing_start_pips', 'breakeven_initial_sl_pips'),
                ('breakeven_trailing_ratio', 'breakeven_max_sl_distance'),
                'breakeven_trailing_step_pips',
                'manage_all_trades',
            ),
        }),
        ('🔄 BUY Recovery', {
            'fields': (
                'enable_buy_be_recovery',
                ('buy_be_recovery_lot_min', 'buy_be_recovery_lot_max'),
                ('buy_be_recovery_lot_increase', 'max_buy_be_recovery_orders'),
            ),
        }),
        ('🔄 SELL Recovery', {
            'fields': (
                'enable_sell_be_recovery',
                ('sell_be_recovery_lot_min', 'sell_be_recovery_lot_max'),
                ('sell_be_recovery_lot_increase', 'max_sell_be_recovery_orders'),
            ),
        }),
    )
    
    def save_model(self, request, obj, form, change):
        # Only apply defaults for NEW records, not when editing existing ones
        if not change:  # This is a new record
            obj.apply_symbol_defaults()
        # No longer applying fixed lot sizes - they are now dynamic
        super().save_model(request, obj, form, change)

    def get_mt5_account(self, obj):
        return obj.license.mt5_account or '-'
    get_mt5_account.short_description = 'MT5 Account'
    
    def buy_range_display(self, obj):
        return f"{int(obj.buy_range_end)} - {int(obj.buy_range_start)}"
    buy_range_display.short_description = 'BUY Range'


@admin.register(TradeData)
class TradeDataAdmin(admin.ModelAdmin):
    list_display = ['get_mt5_account', 'symbol', 'account_balance', 'account_equity', 'profit_display', 
                   'positions_summary', 'last_update']
    list_filter = ['symbol']
    search_fields = ['license__license_key', 'license__mt5_account']
    readonly_fields = ['license', 'account_balance', 'account_equity', 'account_profit', 
                      'account_margin', 'account_free_margin', 'total_buy_positions', 
                      'total_sell_positions', 'total_buy_lots', 'total_sell_lots',
                      'total_buy_profit', 'total_sell_profit', 'symbol', 'current_price',
                      'open_positions', 'last_update', 'created_at']
    
    fieldsets = (
        ('Account', {'fields': ('license', ('account_balance', 'account_equity', 'account_profit'))}),
        ('Margin', {'fields': (('account_margin', 'account_free_margin'),)}),
        ('Positions', {'fields': (
            ('total_buy_positions', 'total_sell_positions'),
            ('total_buy_lots', 'total_sell_lots'),
            ('total_buy_profit', 'total_sell_profit'),
        )}),
        ('Market', {'fields': (('symbol', 'current_price'),)}),
        ('Open Positions', {'fields': ('open_positions',), 'classes': ('collapse',)}),
    )

    def get_mt5_account(self, obj):
        return obj.license.mt5_account or '-'
    get_mt5_account.short_description = 'MT5 Account'

    def profit_display(self, obj):
        color = 'green' if obj.account_profit >= 0 else 'red'
        profit_str = f"{obj.account_profit:,.2f}"
        return format_html('<span style="color: {}; font-weight: bold;">${}</span>', color, profit_str)
    profit_display.short_description = 'Profit'

    def positions_summary(self, obj):
        return f"B:{obj.total_buy_positions} S:{obj.total_sell_positions}"
    positions_summary.short_description = 'Positions'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(EAProduct)
class EAProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'subtitle', 'investment_range', 'expected_profit', 'risk_level', 'is_popular', 'is_active', 'display_order']
    list_filter = ['is_active', 'is_popular', 'risk_level', 'color']
    search_fields = ['name', 'subtitle', 'description']
    list_editable = ['is_popular', 'is_active', 'display_order']
    ordering = ['display_order', 'min_investment']
    
    fieldsets = (
        ('📦 Basic Info', {
            'fields': ('name', 'subtitle', 'description')
        }),
        ('💰 Investment Range', {
            'fields': (('min_investment', 'max_investment'),)
        }),
        ('📊 Performance', {
            'fields': (('expected_profit', 'risk_level'), 'trading_style')
        }),
        ('✨ Features', {
            'fields': ('features',),
            'description': 'Enter features separated by commas (e.g., Auto Risk Management, Trailing Stop, Recovery Mode)'
        }),
        ('🎨 Display Settings', {
            'fields': (('color', 'is_popular'), 'display_order')
        }),
        ('📁 EA File', {
            'fields': ('ea_file', 'file_name', 'external_download_url'),
            'description': 'Upload the .ex5 file for download'
        }),
        ('⚙️ Status', {
            'fields': ('is_active',)
        }),
    )
    
    def investment_range(self, obj):
        return f"${obj.min_investment:,.0f} - ${obj.max_investment:,.0f}"
    investment_range.short_description = 'Investment'


# ==================== REFERRAL SYSTEM ADMIN ====================

@admin.register(Referral)
class ReferralAdmin(admin.ModelAdmin):
    list_display = ['referrer', 'referral_code', 'signups', 'purchases', 'earnings_display', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['referrer__username', 'referral_code']
    readonly_fields = ['referral_code', 'clicks', 'signups', 'purchases', 'total_earnings', 'pending_earnings', 'paid_earnings', 'created_at', 'updated_at']
    
    fieldsets = (
        ('👤 Referrer Info', {
            'fields': ('referrer', 'referral_code', 'commission_percent')
        }),
        ('📊 Statistics', {
            'fields': (('clicks', 'signups', 'purchases'),)
        }),
        ('💰 Earnings', {
            'fields': (('total_earnings', 'pending_earnings', 'paid_earnings'),)
        }),
        ('⚙️ Status', {
            'fields': ('is_active', ('created_at', 'updated_at'))
        }),
    )
    
    def earnings_display(self, obj):
        total_str = f"{obj.total_earnings:,.2f}"
        pending_str = f"{obj.pending_earnings:,.2f}"
        return format_html(
            '<span style="color: green;">${}</span> <small>(Pending: ${})</small>',
            total_str, pending_str
        )
    earnings_display.short_description = 'Earnings'


@admin.register(ReferralTransaction)
class ReferralTransactionAdmin(admin.ModelAdmin):
    list_display = ['referrer_display', 'referred_user', 'purchase_amount', 'commission_display', 'status', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['referral__referrer__username', 'referred_user__username']
    readonly_fields = ['referral', 'referred_user', 'purchase_amount', 'commission_amount', 'created_at', 'updated_at']
    
    fieldsets = (
        ('🔗 Referral Info', {
            'fields': ('referral', 'referred_user')
        }),
        ('💵 Transaction', {
            'fields': (('purchase_amount', 'commission_amount'),)
        }),
        ('⚙️ Status', {
            'fields': ('status', ('created_at', 'updated_at'))
        }),
    )
    
    def referrer_display(self, obj):
        return obj.referral.referrer.username
    referrer_display.short_description = 'Referrer'
    
    def commission_display(self, obj):
        commission_str = f"{obj.commission_amount:,.2f}"
        return format_html(
            '<span style="color: green; font-weight: bold;">${}</span> <small>({}%)</small>',
            commission_str, obj.referral.commission_percent
        )
    commission_display.short_description = 'Commission'


@admin.register(ReferralPayout)
class ReferralPayoutAdmin(admin.ModelAdmin):
    list_display = ['referrer_display', 'amount', 'payment_method', 'status_display', 'requested_at', 'processed_at']
    list_filter = ['status', 'payment_method', 'requested_at']
    search_fields = ['referral__referrer__username', 'transaction_id']
    readonly_fields = ['referral', 'requested_at']
    
    fieldsets = (
        ('👤 Referrer', {
            'fields': ('referral',)
        }),
        ('💰 Payout Details', {
            'fields': (('amount', 'payment_method'), 'payment_details')
        }),
        ('⚙️ Status & Processing', {
            'fields': ('status', 'transaction_id', 'notes', ('requested_at', 'processed_at'))
        }),
    )
    
    def referrer_display(self, obj):
        return obj.referral.referrer.username
    referrer_display.short_description = 'Referrer'
    
    def status_display(self, obj):
        colors = {
            'pending': ('orange', '⏳'),
            'processing': ('blue', '⚙️'),
            'completed': ('green', '✅'),
            'failed': ('red', '❌'),
        }
        color, icon = colors.get(obj.status, ('gray', ''))
        return format_html(
            '<span style="color: {}; font-weight: bold;">{} {}</span>',
            color, icon, obj.status.upper()
        )
    status_display.short_description = 'Status'


# ==================== TRADE COMMAND SYSTEM ADMIN ====================

@admin.register(TradeCommand)
class TradeCommandAdmin(admin.ModelAdmin):
    list_display = ['get_mt5_account', 'command_type', 'status_display', 'created_at', 'executed_at', 'expires_at']
    list_filter = ['command_type', 'status', 'created_at']
    search_fields = ['license__license_key', 'license__mt5_account']
    readonly_fields = ['license', 'command_type', 'parameters', 'status', 'created_at', 'executed_at', 'expires_at', 'result_message', 'result_data']
    
    fieldsets = (
        ('🔑 License', {
            'fields': ('license',)
        }),
        ('📋 Command', {
            'fields': (('command_type', 'status'), 'parameters')
        }),
        ('⏰ Timing', {
            'fields': (('created_at', 'executed_at', 'expires_at'),)
        }),
        ('📊 Result', {
            'fields': ('result_message', 'result_data'),
            'classes': ('collapse',)
        }),
    )
    
    def get_mt5_account(self, obj):
        return obj.license.mt5_account or '-'
    get_mt5_account.short_description = 'MT5 Account'
    
    def status_display(self, obj):
        colors = {
            'pending': ('orange', '⏳'),
            'executed': ('green', '✅'),
            'failed': ('red', '❌'),
            'expired': ('gray', '⌛'),
        }
        color, icon = colors.get(obj.status, ('gray', ''))
        return format_html(
            '<span style="color: {}; font-weight: bold;">{} {}</span>',
            color, icon, obj.status.upper()
        )
    status_display.short_description = 'Status'
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False


@admin.register(EAActionLog)
class EAActionLogAdmin(admin.ModelAdmin):
    list_display = ['get_mt5_account', 'log_type', 'message_preview', 'created_at']
    list_filter = ['log_type', 'created_at']
    search_fields = ['license__license_key', 'license__mt5_account', 'message']
    readonly_fields = ['license', 'log_type', 'message', 'details', 'created_at']
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('🔑 License', {
            'fields': ('license',)
        }),
        ('📝 Log Entry', {
            'fields': (('log_type', 'created_at'), 'message', 'details')
        }),
    )
    
    def get_mt5_account(self, obj):
        return obj.license.mt5_account or '-'
    get_mt5_account.short_description = 'MT5 Account'
    
    def message_preview(self, obj):
        return obj.message[:80] + '...' if len(obj.message) > 80 else obj.message
    message_preview.short_description = 'Message'
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    list_display = ['site_name', 'logo_text', 'logo_version', 'support_email', 'updated_at']
    
    fieldsets = (
        ('🏷️ Site Identity', {
            'fields': ('site_name', 'site_tagline')
        }),
        ('🖼️ Branding', {
            'fields': ('favicon', 'logo', ('logo_text', 'logo_version')),
            'description': 'Upload favicon (32x32 or 64x64 PNG/ICO) and logo image. If no logo image, text logo will be used.'
        }),
        ('📞 Support Contacts', {
            'fields': ('support_email', 'admin_notification_email', ('telegram_en', 'telegram_en_url'), ('telegram_cn', 'telegram_cn_url'))
        }),
    )
    
    def has_add_permission(self, request):
        return not SiteSettings.objects.exists()
    
    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(SMTPSettings)
class SMTPSettingsAdmin(admin.ModelAdmin):
    list_display = ['from_email', 'host', 'port', 'is_active', 'updated_at']
    list_filter = ['is_active', 'use_tls', 'use_ssl']
    search_fields = ['from_email', 'host', 'username']
    
    fieldsets = (
        ('📧 Email Identity', {
            'fields': ('from_email', 'from_name')
        }),
        ('🔌 SMTP Server', {
            'fields': ('host', 'port', ('use_tls', 'use_ssl'))
        }),
        ('🔐 Authentication', {
            'fields': ('username', 'password'),
            'description': 'For Namecheap Private Email: Host=mail.privateemail.com, Port=587, TLS=Yes'
        }),
        ('⚙️ Status', {
            'fields': ('is_active',),
            'description': 'Only one SMTP configuration can be active at a time.'
        }),
    )
    
    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        # Make password field use password input widget
        if 'password' in form.base_fields:
            form.base_fields['password'].widget = admin.widgets.AdminTextInputWidget(attrs={'type': 'password'})
        return form


@admin.register(EmailPreference)
class EmailPreferenceAdmin(admin.ModelAdmin):
    class UnsubscribedFilter(admin.SimpleListFilter):
        title = 'unsubscribed'
        parameter_name = 'unsubscribed'

        def lookups(self, request, model_admin):
            return (
                ('yes', 'Unsubscribed'),
                ('no', 'Subscribed'),
            )

        def queryset(self, request, queryset):
            value = self.value()
            if value == 'yes':
                return queryset.filter(marketing_emails=False, transactional_emails=False)
            if value == 'no':
                return queryset.exclude(marketing_emails=False, transactional_emails=False)
            return queryset

    list_display = ['user', 'marketing_emails', 'transactional_emails', 'unsubscribed_at', 'updated_at']
    list_filter = [UnsubscribedFilter, 'marketing_emails', 'transactional_emails', 'unsubscribed_at']
    search_fields = ['user__email', 'user__username']
    readonly_fields = ['created_at', 'updated_at', 'unsubscribed_at']
    
    fieldsets = (
        ('👤 User', {
            'fields': ('user',)
        }),
        ('📧 Email Preferences', {
            'fields': ('marketing_emails', 'transactional_emails'),
            'description': 'Marketing emails can be disabled. Transactional emails (license, payment) cannot be disabled.'
        }),
        ('📅 Timestamps', {
            'fields': ('unsubscribed_at', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
