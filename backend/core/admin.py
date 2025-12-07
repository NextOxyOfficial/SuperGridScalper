from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from django.utils.html import format_html
from .models import SubscriptionPlan, License, LicenseVerificationLog, EASettings, TradeData


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
        ('💰 Investment & Risk', {'fields': (('investment_amount', 'lot_size'),)}),
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
        try:
            return f"${obj.ea_settings.investment_amount}"
        except:
            return "-"
    investment_display.short_description = 'Investment'

    def trade_status(self, obj):
        try:
            td = obj.trade_data
            profit = td.account_profit
            color = 'green' if profit >= 0 else 'red'
            return format_html(
                '<span style="color: {0};">${1}</span> <small>({2}B/{3}S)</small>',
                color, f"{profit:,.2f}", td.total_buy_positions, td.total_sell_positions
            )
        except:
            return format_html('<span style="color: gray;">No data</span>')
    trade_status.short_description = 'Trading'

    def days_remaining_display(self, obj):
        days = obj.days_remaining()
        if days <= 0:
            return format_html('<span style="color: red; font-weight: bold;">EXPIRED</span>')
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
    list_display = ['get_mt5_account', 'investment_amount', 'lot_size', 'max_buy_orders', 'max_sell_orders', 'updated_at']
    search_fields = ['license__license_key', 'license__mt5_account']
    autocomplete_fields = ['license']
    
    fieldsets = (
        ('License', {'fields': ('license',)}),
        ('Investment', {'fields': ('investment_amount',)}),
        ('BUY Settings', {
            'fields': (
                ('buy_range_start', 'buy_range_end'),
                ('buy_gap_pips', 'max_buy_orders'),
                ('buy_take_profit_pips', 'buy_stop_loss_pips'),
                ('buy_trailing_start_pips', 'buy_initial_sl_pips'),
                ('buy_trailing_ratio', 'buy_max_sl_distance', 'buy_trailing_step_pips'),
            )
        }),
        ('SELL Settings', {
            'fields': (
                ('sell_range_start', 'sell_range_end'),
                ('sell_gap_pips', 'max_sell_orders'),
                ('sell_take_profit_pips', 'sell_stop_loss_pips'),
                ('sell_trailing_start_pips', 'sell_initial_sl_pips'),
                ('sell_trailing_ratio', 'sell_max_sl_distance', 'sell_trailing_step_pips'),
            )
        }),
        ('Risk Management', {
            'fields': ('lot_size',)
        }),
        ('Breakeven', {
            'fields': (
                'enable_breakeven_tp',
                ('breakeven_buy_tp_pips', 'breakeven_sell_tp_pips'),
                'manage_all_trades',
            ),
            'classes': ('collapse',)
        }),
        ('BUY Recovery', {
            'fields': (
                'enable_buy_be_recovery',
                ('buy_be_recovery_lot_min', 'buy_be_recovery_lot_max'),
                ('buy_be_recovery_lot_increase', 'max_buy_be_recovery_orders'),
            ),
            'classes': ('collapse',)
        }),
        ('SELL Recovery', {
            'fields': (
                'enable_sell_be_recovery',
                ('sell_be_recovery_lot_min', 'sell_be_recovery_lot_max'),
                ('sell_be_recovery_lot_increase', 'max_sell_be_recovery_orders'),
            ),
            'classes': ('collapse',)
        }),
    )

    def get_mt5_account(self, obj):
        return obj.license.mt5_account or '-'
    get_mt5_account.short_description = 'MT5 Account'


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
        return format_html('<span style="color: {}; font-weight: bold;">${:,.2f}</span>', color, obj.account_profit)
    profit_display.short_description = 'Profit'

    def positions_summary(self, obj):
        return f"B:{obj.total_buy_positions} S:{obj.total_sell_positions}"
    positions_summary.short_description = 'Positions'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
