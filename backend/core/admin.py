from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from django import forms
from django.conf import settings as django_settings
from django.core.mail import send_mail
from django.utils.html import format_html, mark_safe
from django.utils import timezone
from decimal import Decimal
from django.db.models import F
from .models import SubscriptionPlan, License, LicenseVerificationLog, EASettings, TradeData, EAProduct, Referral, ReferralAttribution, ReferralTransaction, ReferralPayout, TradeCommand, EAActionLog, SiteSettings, PaymentNetwork, LicensePurchaseRequest, SMTPSettings, EmailPreference, PayoutMethod


# Unregister default User admin and register with search
admin.site.unregister(User)

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    search_fields = ['username', 'email', 'first_name', 'last_name']
    list_display = ['username', 'email', 'is_active', 'date_joined']
    
    def delete_model(self, request, obj):
        """Safe delete: clear related references first"""
        try:
            # Clear issued_license references in purchase requests
            LicensePurchaseRequest.objects.filter(issued_license__user=obj).update(issued_license=None)
            # Clear reviewed_by references
            LicensePurchaseRequest.objects.filter(reviewed_by=obj).update(reviewed_by=None)
        except Exception:
            pass
        super().delete_model(request, obj)
    
    def delete_queryset(self, request, queryset):
        """Safe bulk delete: clear related references first"""
        try:
            LicensePurchaseRequest.objects.filter(issued_license__user__in=queryset).update(issued_license=None)
            LicensePurchaseRequest.objects.filter(reviewed_by__in=queryset).update(reviewed_by=None)
        except Exception:
            pass
        super().delete_queryset(request, queryset)


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
    list_display = ['created_at', 'request_type_display', 'user', 'plan', 'payment_method_display', 'amount_usd', 'status', 'mt5_account', 'txid', 'reviewed_at', 'license_link']
    list_filter = ['status', 'request_type', 'network', 'plan', 'created_at']
    search_fields = ['user__email', 'txid', 'mt5_account']
    readonly_fields = ['created_at', 'updated_at', 'issued_license', 'reviewed_at', 'reviewed_by', 'request_type', 'extend_license']
    autocomplete_fields = ['user', 'plan', 'network']
    radio_fields = {'status': admin.HORIZONTAL}
    actions = ['approve_requests', 'reject_requests']
    
    def _is_free_claim(self, obj):
        return '[EXNESS_FREE_CLAIM]' in (obj.user_note or '')
    
    def _is_free_extension(self, obj):
        return '[EXNESS_FREE_EXTENSION]' in (obj.user_note or '')
    
    def request_type_display(self, obj):
        if self._is_free_extension(obj):
            return format_html('<span style="color: #f59e0b; font-weight: bold;">{}</span>', '🔄🎁 FREE EXT')
        if self._is_free_claim(obj):
            return format_html('<span style="color: #10b981; font-weight: bold;">{}</span>', '🎁 FREE')
        if obj.request_type == 'extension':
            return format_html('<span style="color: #f59e0b; font-weight: bold;">{}</span>', '🔄 EXT')
        return format_html('<span style="color: #10b981; font-weight: bold;">{}</span>', '🆕 NEW')
    request_type_display.short_description = 'Type'
    
    def payment_method_display(self, obj):
        if self._is_free_extension(obj):
            return mark_safe('<span style="color: #f59e0b; font-weight: bold;">🔄🎁 Free Extension</span>')
        if self._is_free_claim(obj):
            return mark_safe('<span style="color: #10b981; font-weight: bold;">🎁 Free Exness Claim</span>')
        return obj.network or '-'
    payment_method_display.short_description = 'Payment Method'
    
    def get_readonly_fields(self, request, obj=None):
        fields = list(super().get_readonly_fields(request, obj))
        if obj and (self._is_free_claim(obj) or self._is_free_extension(obj)):
            fields.extend(['network', 'txid', 'proof', 'amount_usd'])
        return fields
    
    def license_link(self, obj):
        if obj.issued_license:
            url = f'/admin/core/license/{obj.issued_license.id}/change/'
            return format_html('<a href="{}">View License</a>', url)
        if obj.extend_license:
            url = f'/admin/core/license/{obj.extend_license.id}/change/'
            return format_html('<a href="{}">🔄 Extend</a>', url)
        return '-'
    license_link.short_description = 'License'
    
    def save_model(self, request, obj, form, change):
        """Auto-create/extend license when status is changed to approved via admin form"""
        if change and obj.status == 'approved' and obj.request_type == 'extension' and obj.extend_license and not obj.issued_license_id:
            # Extension: add days to existing license and update plan
            from datetime import timedelta
            lic = obj.extend_license
            if lic.expires_at < timezone.now():
                lic.expires_at = timezone.now() + timedelta(days=obj.plan.duration_days)
            else:
                lic.expires_at = lic.expires_at + timedelta(days=obj.plan.duration_days)
            lic.plan = obj.plan
            lic.status = 'active'
            lic.save()
            obj.issued_license = lic
            obj.reviewed_by = request.user
            obj.reviewed_at = timezone.now()
            self.message_user(request, f'License {lic.license_key[:16]}... extended by {obj.plan.duration_days} days (plan: {obj.plan.name})')
            
            try:
                from core.utils import get_email_from_address, render_email_template, add_email_headers, can_send_email_to_user, get_unsubscribe_url
                from django.core.mail import EmailMultiAlternatives
                
                base = (getattr(django_settings, 'FRONTEND_URL', '') or 'https://markstrades.com').rstrip('/')
                subject = 'License Extended - Payment Approved'
                
                if can_send_email_to_user(obj.user, 'transactional'):
                    html_message = render_email_template(
                        subject=subject,
                        heading='🎉 License Extended!',
                        message=f"""
                            <p>Hi <strong>{obj.user.first_name or 'Trader'}</strong>,</p>
                            <p>Your payment has been <strong style="color: #10b981;">approved</strong> and your license has been extended.</p>
                            
                            <div style="background-color: rgba(16, 185, 129, 0.1); border-left: 3px solid #10b981; padding: 16px; margin: 20px 0; border-radius: 4px;">
                                <p style="margin: 0 0 8px 0; color: #10b981; font-weight: 600;">Extension Details:</p>
                                <p style="margin: 4px 0; color: #374151;"><strong>Plan:</strong> {obj.plan.name}</p>
                                <p style="margin: 4px 0; color: #374151;"><strong>Added:</strong> +{obj.plan.duration_days} days</p>
                                <p style="margin: 4px 0; color: #374151;"><strong>New Expiry:</strong> {lic.expires_at.strftime('%B %d, %Y')}</p>
                                <p style="margin: 4px 0; color: #374151;"><strong>Days Remaining:</strong> {lic.days_remaining()}</p>
                            </div>
                        """,
                        cta_text='OPEN DASHBOARD',
                        cta_url=f'{base}/dashboard',
                        footer_note='Thank you for continuing with MarksTrades!',
                        preheader=f'Your license has been extended with {obj.plan.name}. {lic.days_remaining()} days remaining!',
                        unsubscribe_url=get_unsubscribe_url(obj.user)
                    )
                    text_msg = f"Hi {obj.user.first_name or 'Trader'},\n\nYour license has been extended.\nPlan: {obj.plan.name}\nAdded: +{obj.plan.duration_days} days\nNew Expiry: {lic.expires_at.strftime('%B %d, %Y')}\n\nOpen your dashboard: {base}/dashboard"
                    msg = EmailMultiAlternatives(subject, text_msg, get_email_from_address(), [obj.user.email])
                    msg.attach_alternative(html_message, "text/html")
                    msg = add_email_headers(msg, 'transactional', user=obj.user)
                    msg.send(fail_silently=False)
            except Exception as e:
                print(f'[ADMIN] Failed to send extension email: {e}')
            
            # Track referral commission for extension/renewal
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
                        Referral.objects.filter(pk=referral.pk).update(
                            purchases=F('purchases') + 1,
                            total_earnings=F('total_earnings') + commission_amount,
                            pending_earnings=F('pending_earnings') + commission_amount,
                        )
            except Exception:
                pass
            
            super().save_model(request, obj, form, change)
            return
        
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
                
                # Send approval email
                try:
                    from core.utils import get_email_from_address, render_email_template, add_email_headers, can_send_email_to_user, get_unsubscribe_url
                    from django.core.mail import EmailMultiAlternatives
                    
                    base = (getattr(django_settings, 'FRONTEND_URL', '') or 'https://markstrades.com').rstrip('/')
                    subject = 'Payment Approved - Your License is Ready'
                    
                    if can_send_email_to_user(obj.user, 'transactional'):
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
                                    <p style="margin: 4px 0; color: #374151;"><strong>Request ID:</strong> #{obj.id}</p>
                                    <p style="margin: 4px 0; color: #374151;"><strong>Plan:</strong> {obj.plan.name}</p>
                                    <p style="margin: 4px 0; color: #374151;"><strong>License Key:</strong> <code style="background-color: rgba(6, 182, 212, 0.2); padding: 2px 6px; border-radius: 4px; color: #0891b2;">{new_license.license_key}</code></p>
                                    <p style="margin: 4px 0; color: #374151;"><strong>Expires At:</strong> {new_license.expires_at.strftime('%B %d, %Y')}</p>
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
                        self.message_user(request, f'Approval email sent to {obj.user.email}')
                except Exception as e:
                    print(f'[ADMIN] Failed to send approval email: {e}')
                
                # Track referral commission
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
                            Referral.objects.filter(pk=referral.pk).update(
                                purchases=F('purchases') + 1,
                                total_earnings=F('total_earnings') + commission_amount,
                                pending_earnings=F('pending_earnings') + commission_amount,
                            )
                except Exception:
                    pass
                    
            except Exception as e:
                self.message_user(request, f'Failed to create license: {e}', level='error')
        super().save_model(request, obj, form, change)

    def approve_requests(self, request, queryset):
        for obj in queryset.select_related('user', 'plan', 'network', 'issued_license', 'extend_license'):
            if obj.status != 'pending':
                continue
            
            # Handle extension requests
            if obj.request_type == 'extension' and obj.extend_license:
                from datetime import timedelta
                lic = obj.extend_license
                if lic.expires_at < timezone.now():
                    lic.expires_at = timezone.now() + timedelta(days=obj.plan.duration_days)
                else:
                    lic.expires_at = lic.expires_at + timedelta(days=obj.plan.duration_days)
                lic.plan = obj.plan
                lic.status = 'active'
                lic.save()
                obj.issued_license = lic
                obj.status = 'approved'
                obj.reviewed_by = request.user
                obj.reviewed_at = timezone.now()
                obj.save(update_fields=['issued_license', 'status', 'reviewed_by', 'reviewed_at', 'updated_at'])
                self.message_user(request, f'License {lic.license_key[:16]}... extended by {obj.plan.duration_days} days (plan: {obj.plan.name})')
                
                try:
                    from core.utils import get_email_from_address, render_email_template, add_email_headers, can_send_email_to_user, get_unsubscribe_url
                    from django.core.mail import EmailMultiAlternatives
                    base = (getattr(django_settings, 'FRONTEND_URL', '') or 'https://markstrades.com').rstrip('/')
                    subject = 'License Extended - Payment Approved'
                    if can_send_email_to_user(obj.user, 'transactional'):
                        html_message = render_email_template(
                            subject=subject,
                            heading='🎉 License Extended!',
                            message=f"""
                                <p>Hi <strong>{obj.user.first_name or 'Trader'}</strong>,</p>
                                <p>Your license has been <strong style="color: #10b981;">extended</strong>!</p>
                                <div style="background-color: rgba(16, 185, 129, 0.1); border-left: 3px solid #10b981; padding: 16px; margin: 20px 0; border-radius: 4px;">
                                    <p style="margin: 0 0 8px 0; color: #10b981; font-weight: 600;">Extension Details:</p>
                                    <p style="margin: 4px 0; color: #374151;"><strong>Plan:</strong> {obj.plan.name}</p>
                                    <p style="margin: 4px 0; color: #374151;"><strong>Added:</strong> +{obj.plan.duration_days} days</p>
                                    <p style="margin: 4px 0; color: #374151;"><strong>New Expiry:</strong> {lic.expires_at.strftime('%B %d, %Y')}</p>
                                </div>
                            """,
                            cta_text='OPEN DASHBOARD',
                            cta_url=f'{base}/dashboard',
                            footer_note='Thank you for continuing with MarksTrades!',
                            preheader=f'License extended with {obj.plan.name}!',
                            unsubscribe_url=get_unsubscribe_url(obj.user)
                        )
                        text_msg = f"Your license has been extended.\nPlan: {obj.plan.name}\nAdded: +{obj.plan.duration_days} days\nNew Expiry: {lic.expires_at.strftime('%B %d, %Y')}"
                        msg = EmailMultiAlternatives(subject, text_msg, get_email_from_address(), [obj.user.email])
                        msg.attach_alternative(html_message, "text/html")
                        msg = add_email_headers(msg, 'transactional', user=obj.user)
                        msg.send(fail_silently=False)
                except Exception:
                    pass
                
                # Track referral commission for extension/renewal
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
                            Referral.objects.filter(pk=referral.pk).update(
                                purchases=F('purchases') + 1,
                                total_earnings=F('total_earnings') + commission_amount,
                                pending_earnings=F('pending_earnings') + commission_amount,
                            )
                except Exception:
                    pass
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
                        Referral.objects.filter(pk=referral.pk).update(
                            purchases=F('purchases') + 1,
                            total_earnings=F('total_earnings') + commission_amount,
                            pending_earnings=F('pending_earnings') + commission_amount,
                        )
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

            # Send approval email to user
            try:
                from core.utils import get_email_from_address, render_email_template, add_email_headers, can_send_email_to_user, get_unsubscribe_url
                from django.core.mail import EmailMultiAlternatives
                
                base = (getattr(django_settings, 'FRONTEND_URL', '') or 'https://markstrades.com').rstrip('/')
                subject = 'Payment Approved - Your License is Ready'
                
                if not can_send_email_to_user(obj.user, 'transactional'):
                    print(f'[ADMIN] User {obj.user.email} opted out of transactional emails')
                else:
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
                                <p style="margin: 4px 0; color: #374151;"><strong>Request ID:</strong> #{obj.id}</p>
                                <p style="margin: 4px 0; color: #374151;"><strong>Plan:</strong> {obj.plan.name}</p>
                                <p style="margin: 4px 0; color: #374151;"><strong>License Key:</strong> <code style="background-color: rgba(6, 182, 212, 0.2); padding: 2px 6px; border-radius: 4px; color: #0891b2;">{new_license.license_key}</code></p>
                                <p style="margin: 4px 0; color: #374151;"><strong>Expires At:</strong> {new_license.expires_at.strftime('%B %d, %Y')}</p>
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
                    print(f'[ADMIN] Approval email sent to {obj.user.email}')
            except Exception as e:
                print(f'[ADMIN] Failed to send approval email to {obj.user.email}: {e}')

    approve_requests.short_description = 'Approve selected requests and issue license'

    def reject_requests(self, request, queryset):
        for obj in queryset.select_related('user', 'plan', 'network'):
            if obj.status != 'pending':
                continue
            obj.status = 'rejected'
            obj.reviewed_by = request.user
            obj.reviewed_at = timezone.now()
            obj.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'updated_at'])

            is_free_claim = '[EXNESS_FREE_CLAIM]' in (obj.user_note or '')

            try:
                from core.utils import get_email_from_address, render_email_template, add_email_headers, can_send_email_to_user, get_unsubscribe_url
                from django.core.mail import EmailMultiAlternatives
                
                base = (getattr(django_settings, 'FRONTEND_URL', '') or '').rstrip('/')

                if not can_send_email_to_user(obj.user, 'transactional'):
                    raise Exception('User opted out of transactional emails')

                if is_free_claim:
                    # Special rejection email for free Exness claims
                    subject = 'Free License Claim Rejected — Account Not Under Our Referral'
                    text_message = (
                        f"Hi {obj.user.first_name or 'Trader'},\n\n"
                        "Unfortunately, we could not verify that your Exness account was created through our referral link. "
                        "Your free license claim has been rejected.\n\n"
                        f"Request ID: #{obj.request_number or obj.id}\n"
                        f"MT5 Account: {obj.mt5_account or '-'}\n\n"
                        "To qualify for a free license, your Exness account must be opened through our referral link.\n\n"
                        "You have two options:\n"
                        "1. Open a NEW Exness account through our referral link and submit a new claim\n"
                        "2. Purchase a subscription from your dashboard\n\n"
                        f"Open your dashboard: {base}/dashboard\n"
                        f"Open Exness with our link: https://one.exnessonelink.com/a/ustbuprn\n\n"
                        "If you believe this is a mistake, please contact support."
                    )
                    html_message = render_email_template(
                        subject=subject,
                        heading='Free License Claim Rejected',
                        message=f"""
                            <p>Hi <strong>{obj.user.first_name or 'Trader'}</strong>,</p>
                            <p>Unfortunately, we could not verify that your Exness account was created through our referral link. 
                            Your free license claim has been <strong style="color: #ef4444;">rejected</strong>.</p>
                            
                            <div style="background-color: rgba(239, 68, 68, 0.1); border-left: 3px solid #ef4444; padding: 16px; margin: 20px 0; border-radius: 4px;">
                                <p style="margin: 0 0 8px 0; color: #ef4444; font-weight: 600;">Claim Details:</p>
                                <p style="margin: 4px 0; color: #d1d5db;"><strong>Request ID:</strong> #{obj.request_number or obj.id}</p>
                                <p style="margin: 4px 0; color: #d1d5db;"><strong>MT5 Account:</strong> {obj.mt5_account or '-'}</p>
                                <p style="margin: 4px 0; color: #d1d5db;"><strong>Reason:</strong> <span style="color: #f87171;">Exness account not found under our referral</span></p>
                            </div>
                            
                            <p><strong style="color: #22c55e;">What you can do:</strong></p>
                            <ul style="color: #d1d5db; line-height: 1.8;">
                                <li><strong>Option 1:</strong> Open a <strong style="color: #eab308;">new Exness account</strong> through 
                                <a href="https://one.exnessonelink.com/a/ustbuprn" style="color: #06b6d4; text-decoration: underline;">our referral link</a> 
                                and submit a new free claim</li>
                                <li><strong>Option 2:</strong> <strong style="color: #06b6d4;">Purchase a subscription</strong> from your dashboard to get instant access</li>
                            </ul>
                            
                            <p style="color: #9ca3af; font-size: 13px;">To qualify for a free license, your Exness account must be created through our referral link. 
                            We verify this through the Exness partner dashboard.</p>
                        """,
                        cta_text='GO TO DASHBOARD',
                        cta_url=f'{base}/dashboard',
                        footer_note='If you believe this is a mistake, please contact our support team.',
                        preheader=f'Your free license claim was rejected. Your Exness account is not under our referral.',
                        unsubscribe_url=get_unsubscribe_url(obj.user)
                    )
                else:
                    # Standard payment rejection email
                    subject = 'Payment Rejected - Action Needed'
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
    list_display = ['license_key_display', 'user', 'plan', 'source_display', 'status_display', 'mt5_account', 'balance_display', 'equity_display', 'pl_display', 'positions_display', 'trade_status', 'days_remaining_display', 'expires_at']
    list_filter = ['status', 'plan']
    search_fields = ['license_key', 'user__email', 'mt5_account', 'user__username']
    readonly_fields = ['license_key', 'activated_at', 'verification_count', 'last_verified', 'created_at', 'updated_at']
    autocomplete_fields = ['user', 'plan']
    radio_fields = {'status': admin.HORIZONTAL}
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

    def source_display(self, obj):
        from core.models import LicensePurchaseRequest
        free_claim = LicensePurchaseRequest.objects.filter(
            issued_license=obj,
            user_note__icontains='[EXNESS_FREE_CLAIM]',
            status='approved',
        ).exists()
        if free_claim:
            return format_html('<span style="color: #10b981; font-weight: bold;">🎁 FREE</span>')
        paid = LicensePurchaseRequest.objects.filter(
            issued_license=obj,
            status='approved',
        ).exclude(user_note__icontains='[EXNESS_FREE_CLAIM]').exists()
        if paid:
            return format_html('<span style="color: #06b6d4; font-weight: bold;">💳 PAID</span>')
        return format_html('<span style="color: #6b7280;">—</span>')
    source_display.short_description = 'Source'

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

    def balance_display(self, obj):
        try:
            td = obj.trade_data
            return format_html('<strong>${:,.2f}</strong>', td.account_balance)
        except:
            return "-"
    balance_display.short_description = 'Balance'

    def equity_display(self, obj):
        try:
            td = obj.trade_data
            return format_html('${:,.2f}', td.account_equity)
        except:
            return "-"
    equity_display.short_description = 'Equity'

    def pl_display(self, obj):
        try:
            td = obj.trade_data
            profit = td.account_profit
            color = '#10b981' if profit >= 0 else '#ef4444'
            sign = '+' if profit >= 0 else ''
            return format_html('<span style="color: {}; font-weight: bold;">{}{}</span>', color, sign, f"${profit:,.2f}")
        except:
            return "-"
    pl_display.short_description = 'P/L'

    def positions_display(self, obj):
        try:
            td = obj.trade_data
            total = td.total_buy_positions + td.total_sell_positions
            if total == 0:
                return mark_safe('<span style="color: gray;">0</span>')
            return format_html(
                '<span style="color: #10b981;">{} B</span> / <span style="color: #ef4444;">{} S</span>',
                td.total_buy_positions, td.total_sell_positions
            )
        except:
            return "-"
    positions_display.short_description = 'Positions'

    def trade_status(self, obj):
        try:
            td = obj.trade_data
            if not td.last_update:
                return mark_safe('<span style="color: gray;">No data</span>')
            from django.utils.timesince import timesince
            return format_html('<span style="color: #6b7280; font-size: 11px;">{} ago</span>', timesince(td.last_update))
        except:
            return mark_safe('<span style="color: gray;">No data</span>')
    trade_status.short_description = 'Last Update'

    def days_remaining_display(self, obj):
        days = obj.days_remaining()
        if days <= 0:
            return format_html('<span style="color: red; font-weight: bold;">{}</span>', 'EXPIRED')
        elif days <= 7:
            return format_html('<span style="color: orange; font-weight: bold;">{} days</span>', days)
        return format_html('<span style="color: green;">{} days</span>', days)
    days_remaining_display.short_description = 'Days Left'
    
    def delete_model(self, request, obj):
        """Safe delete: clear related purchase request reference first"""
        try:
            # Clear the issued_license reference in purchase request
            LicensePurchaseRequest.objects.filter(issued_license=obj).update(issued_license=None)
        except Exception:
            pass
        super().delete_model(request, obj)
    
    def delete_queryset(self, request, queryset):
        """Safe bulk delete: clear related purchase request references first"""
        try:
            LicensePurchaseRequest.objects.filter(issued_license__in=queryset).update(issued_license=None)
        except Exception:
            pass
        super().delete_queryset(request, queryset)


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


class EAProductForm(forms.ModelForm):
    notify_all_users = forms.BooleanField(
        required=False,
        initial=False,
        label='📧 Notify all users about this update',
        help_text='Check this to send an update notification email to ALL registered users when saving.'
    )
    
    class Meta:
        model = EAProduct
        fields = '__all__'


@admin.register(EAProduct)
class EAProductAdmin(admin.ModelAdmin):
    form = EAProductForm
    list_display = ['name', 'subtitle', 'version_display', 'investment_range', 'expected_profit', 'risk_level', 'is_popular', 'is_coming_soon', 'is_active', 'display_order']
    list_filter = ['is_active', 'is_coming_soon', 'is_popular', 'risk_level', 'color']
    search_fields = ['name', 'subtitle', 'description']
    list_editable = ['is_popular', 'is_coming_soon', 'is_active', 'display_order']
    ordering = ['display_order', 'min_investment']
    readonly_fields = ['last_update_notified_at']
    
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
            'description': 'Upload the .ex5 file for download. If external URL is set, it takes priority.'
        }),
        ('🔄 Version & Updates', {
            'fields': (('version', 'last_update_notified_at'), 'changelog', 'notify_all_users'),
            'description': 'Update version info and optionally notify all users via email.'
        }),
        ('⚙️ Status', {
            'fields': (('is_active', 'is_coming_soon'),)
        }),
    )
    
    def version_display(self, obj):
        return f"v{obj.version}"
    version_display.short_description = 'Version'
    
    def investment_range(self, obj):
        return f"${obj.min_investment:,.0f} - ${obj.max_investment:,.0f}"
    investment_range.short_description = 'Investment'
    
    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        
        # If notify checkbox was checked, send update email to all users
        if form.cleaned_data.get('notify_all_users'):
            from django.utils import timezone
            from django.contrib.auth.models import User
            from core.utils import render_email_template, get_email_from_address, add_email_headers, should_send_email
            from django.core.mail import EmailMultiAlternatives
            
            obj.last_update_notified_at = timezone.now()
            obj.save(update_fields=['last_update_notified_at'])
            
            base_url = 'https://markstrades.com'
            changelog_html = ''
            if obj.changelog:
                items = [line.strip() for line in obj.changelog.strip().split('\n') if line.strip()]
                if items:
                    changelog_html = '<ul style="color: #d1d5db; line-height: 1.8; font-size: 13px; padding-left: 20px; margin: 10px 0;">'
                    for item in items:
                        changelog_html += f'<li>{item}</li>'
                    changelog_html += '</ul>'
            
            subject = f'🔄 EA Update Available - {obj.name} v{obj.version}'
            html = render_email_template(
                subject=subject,
                heading=f'🔄 New EA Update: v{obj.version}',
                message=f"""
                    <p>A new version of <strong>{obj.name}</strong> is now available!</p>
                    
                    <div style="background-color: rgba(6, 182, 212, 0.1); border-left: 3px solid #06b6d4; padding: 14px; margin: 16px 0; border-radius: 4px;">
                        <p style="margin: 0 0 6px 0; color: #06b6d4; font-weight: 600; font-size: 13px;">Update Details:</p>
                        <p style="margin: 3px 0; color: #d1d5db; font-size: 13px;"><strong>EA:</strong> {obj.name}</p>
                        <p style="margin: 3px 0; color: #d1d5db; font-size: 13px;"><strong>Version:</strong> v{obj.version}</p>
                    </div>
                    
                    {f'<p style="color: #d1d5db; font-size: 13px; margin-top: 12px;"><strong>What\'s new:</strong></p>{changelog_html}' if changelog_html else ''}
                    
                    <p style="margin-top: 16px;"><strong style="color: #f59e0b;">⚠️ Important:</strong> Please download the new version and restart your EA to get the latest features and fixes.</p>
                """,
                cta_text='DOWNLOAD UPDATE',
                cta_url=f'{base_url}/ea-store',
                footer_note='Keep your EA up to date for the best trading performance.',
                preheader=f'{obj.name} v{obj.version} is now available. Download and update your EA!',
            )
            
            from_email = get_email_from_address()
            users = User.objects.filter(is_active=True).values_list('email', flat=True)
            sent_count = 0
            for email in users:
                if not email:
                    continue
                try:
                    if not should_send_email(email, 'transactional'):
                        continue
                    msg = EmailMultiAlternatives(subject, f'{obj.name} v{obj.version} update available', from_email, [email])
                    msg.attach_alternative(html, "text/html")
                    msg = add_email_headers(msg, 'transactional')
                    msg.send(fail_silently=True)
                    sent_count += 1
                except Exception:
                    pass
            
            self.message_user(request, f'✅ Update notification sent to {sent_count} users!')


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


# ==================== PAYOUT METHOD ADMIN ====================

@admin.register(PayoutMethod)
class PayoutMethodAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'placeholder', 'is_active', 'sort_order']
    list_filter = ['is_active']
    search_fields = ['name', 'code']
    list_editable = ['is_active', 'sort_order']
    ordering = ['sort_order', 'name']


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
