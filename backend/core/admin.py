from django.contrib import admin
from .models import SubscriptionPlan, License, LicenseVerificationLog


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ['name', 'price', 'duration_days', 'max_accounts', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'description']
    ordering = ['price']


@admin.register(License)
class LicenseAdmin(admin.ModelAdmin):
    list_display = ['license_key_short', 'user', 'plan', 'status', 'mt5_account', 'expires_at', 'days_left', 'verification_count']
    list_filter = ['status', 'plan', 'created_at']
    search_fields = ['license_key', 'user__username', 'user__email', 'mt5_account']
    readonly_fields = ['license_key', 'activated_at', 'verification_count', 'last_verified', 'created_at', 'updated_at']
    raw_id_fields = ['user']
    ordering = ['-created_at']
    
    fieldsets = (
        ('License Info', {
            'fields': ('user', 'plan', 'license_key', 'status')
        }),
        ('Validity', {
            'fields': ('activated_at', 'expires_at')
        }),
        ('MT5 Binding', {
            'fields': ('mt5_account', 'hardware_id')
        }),
        ('Usage Stats', {
            'fields': ('last_verified', 'verification_count'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def license_key_short(self, obj):
        return f"{obj.license_key[:12]}..."
    license_key_short.short_description = 'License Key'

    def days_left(self, obj):
        days = obj.days_remaining()
        if days <= 0:
            return "Expired"
        elif days <= 7:
            return f"{days} days ⚠️"
        return f"{days} days"
    days_left.short_description = 'Days Left'


@admin.register(LicenseVerificationLog)
class LicenseVerificationLogAdmin(admin.ModelAdmin):
    list_display = ['created_at', 'license_key_short', 'mt5_account', 'ip_address', 'is_valid', 'message']
    list_filter = ['is_valid', 'created_at']
    search_fields = ['license_key', 'mt5_account', 'ip_address']
    readonly_fields = ['license', 'license_key', 'mt5_account', 'hardware_id', 'ip_address', 'is_valid', 'message', 'created_at']
    ordering = ['-created_at']

    def license_key_short(self, obj):
        return f"{obj.license_key[:12]}..."
    license_key_short.short_description = 'License Key'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
