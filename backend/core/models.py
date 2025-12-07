from django.db import models
from django.contrib.auth.models import User
import uuid
import secrets
from datetime import timedelta
from django.utils import timezone


class SubscriptionPlan(models.Model):
    """Subscription plans for the EA"""
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    duration_days = models.IntegerField(help_text="Duration in days (30=monthly, 365=yearly)")
    max_accounts = models.IntegerField(default=1, help_text="Max MT5 accounts allowed")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} - ${self.price} ({self.duration_days} days)"

    class Meta:
        ordering = ['price']


class License(models.Model):
    """License keys for EA activation"""
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('expired', 'Expired'),
        ('suspended', 'Suspended'),
        ('cancelled', 'Cancelled'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='licenses')
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT)
    license_key = models.CharField(max_length=64, unique=True, editable=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    
    # Activation details
    activated_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    
    # MT5 Account binding
    mt5_account = models.CharField(max_length=50, blank=True, null=True, help_text="Bound MT5 account number")
    hardware_id = models.CharField(max_length=255, blank=True, null=True, help_text="Hardware identifier")
    
    # Usage tracking
    last_verified = models.DateTimeField(null=True, blank=True)
    verification_count = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.license_key:
            self.license_key = self.generate_license_key()
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(days=self.plan.duration_days)
        super().save(*args, **kwargs)

    @staticmethod
    def generate_license_key():
        """Generate a unique license key"""
        key = secrets.token_hex(16).upper()
        # Format: XXXX-XXXX-XXXX-XXXX
        return '-'.join([key[i:i+4] for i in range(0, 32, 4)])

    def is_valid(self):
        """Check if license is currently valid"""
        if self.status != 'active':
            return False
        if timezone.now() > self.expires_at:
            self.status = 'expired'
            self.save()
            return False
        return True

    def days_remaining(self):
        """Get days remaining on license"""
        if not self.is_valid():
            return 0
        delta = self.expires_at - timezone.now()
        return max(0, delta.days)

    def __str__(self):
        return f"{self.user.username} - {self.license_key[:8]}... ({self.status})"

    class Meta:
        ordering = ['-created_at']


class LicenseVerificationLog(models.Model):
    """Log of license verification attempts"""
    license = models.ForeignKey(License, on_delete=models.CASCADE, null=True, blank=True)
    license_key = models.CharField(max_length=64)
    mt5_account = models.CharField(max_length=50, blank=True)
    hardware_id = models.CharField(max_length=255, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    is_valid = models.BooleanField(default=False)
    message = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.license_key[:8]}... - {'Valid' if self.is_valid else 'Invalid'} - {self.created_at}"

    class Meta:
        ordering = ['-created_at']
        verbose_name = "License Verification Log"
        verbose_name_plural = "License Verification Logs"


class EASettings(models.Model):
    """EA Trading Settings - Managed from Django Admin"""
    license = models.OneToOneField(License, on_delete=models.CASCADE, related_name='ea_settings')
    
    # Investment Amount (for calculation)
    investment_amount = models.DecimalField(max_digits=15, decimal_places=2, default=1000, help_text="Investment amount in USD")
    
    # BUY Grid Range Settings
    buy_range_start = models.DecimalField(max_digits=10, decimal_places=2, default=4400, help_text="BUY Range Start Price")
    buy_range_end = models.DecimalField(max_digits=10, decimal_places=2, default=4000, help_text="BUY Range End Price")
    buy_gap_pips = models.DecimalField(max_digits=10, decimal_places=2, default=3.0, help_text="BUY Gap between orders (Pips)")
    max_buy_orders = models.IntegerField(default=4, help_text="Maximum BUY orders at a time")
    
    # BUY TP/SL/Trailing Settings
    buy_take_profit_pips = models.DecimalField(max_digits=10, decimal_places=2, default=50.0, help_text="BUY Take Profit (Pips, 0=disabled)")
    buy_stop_loss_pips = models.DecimalField(max_digits=10, decimal_places=2, default=0.0, help_text="BUY Stop Loss (Pips, 0=disabled)")
    buy_trailing_start_pips = models.DecimalField(max_digits=10, decimal_places=2, default=3.0, help_text="BUY Start trailing after X pips profit")
    buy_initial_sl_pips = models.DecimalField(max_digits=10, decimal_places=2, default=2.0, help_text="BUY Initial SL distance when trailing starts")
    buy_trailing_ratio = models.DecimalField(max_digits=10, decimal_places=2, default=0.5, help_text="BUY SL movement ratio")
    buy_max_sl_distance = models.DecimalField(max_digits=10, decimal_places=2, default=15.0, help_text="BUY Maximum SL distance from price (pips)")
    buy_trailing_step_pips = models.DecimalField(max_digits=10, decimal_places=2, default=0.5, help_text="BUY Minimum step to update SL (pips)")
    
    # SELL Grid Range Settings
    sell_range_start = models.DecimalField(max_digits=10, decimal_places=2, default=4400, help_text="SELL Range Start Price")
    sell_range_end = models.DecimalField(max_digits=10, decimal_places=2, default=4000, help_text="SELL Range End Price")
    sell_gap_pips = models.DecimalField(max_digits=10, decimal_places=2, default=3.0, help_text="SELL Gap between orders (Pips)")
    max_sell_orders = models.IntegerField(default=4, help_text="Maximum SELL orders at a time")
    
    # SELL TP/SL/Trailing Settings
    sell_take_profit_pips = models.DecimalField(max_digits=10, decimal_places=2, default=50.0, help_text="SELL Take Profit (Pips, 0=disabled)")
    sell_stop_loss_pips = models.DecimalField(max_digits=10, decimal_places=2, default=0.0, help_text="SELL Stop Loss (Pips, 0=disabled)")
    sell_trailing_start_pips = models.DecimalField(max_digits=10, decimal_places=2, default=3.0, help_text="SELL Start trailing after X pips profit")
    sell_initial_sl_pips = models.DecimalField(max_digits=10, decimal_places=2, default=2.0, help_text="SELL Initial SL distance when trailing starts")
    sell_trailing_ratio = models.DecimalField(max_digits=10, decimal_places=2, default=0.5, help_text="SELL SL movement ratio")
    sell_max_sl_distance = models.DecimalField(max_digits=10, decimal_places=2, default=15.0, help_text="SELL Maximum SL distance from price (pips)")
    sell_trailing_step_pips = models.DecimalField(max_digits=10, decimal_places=2, default=0.5, help_text="SELL Minimum step to update SL (pips)")
    
    # Lot & Risk
    lot_size = models.DecimalField(max_digits=10, decimal_places=2, default=1.0, help_text="Lot Size per order")
    
    # Breakeven TP Settings
    enable_breakeven_tp = models.BooleanField(default=True, help_text="Enable Breakeven TP for all trades")
    breakeven_buy_tp_pips = models.DecimalField(max_digits=10, decimal_places=2, default=2.0, help_text="Breakeven TP for BUY (pips above avg price)")
    breakeven_sell_tp_pips = models.DecimalField(max_digits=10, decimal_places=2, default=2.0, help_text="Breakeven TP for SELL (pips below avg price)")
    manage_all_trades = models.BooleanField(default=True, help_text="Manage ALL trades (ignore magic number)")
    
    # BUY Breakeven Recovery
    enable_buy_be_recovery = models.BooleanField(default=True, help_text="Enable BUY Recovery Orders")
    buy_be_recovery_lot_min = models.DecimalField(max_digits=10, decimal_places=2, default=1.0, help_text="BUY: Minimum lot for recovery")
    buy_be_recovery_lot_max = models.DecimalField(max_digits=10, decimal_places=2, default=5.0, help_text="BUY: Maximum lot for recovery")
    buy_be_recovery_lot_increase = models.DecimalField(max_digits=10, decimal_places=2, default=10.0, help_text="BUY: Lot increase % per order")
    max_buy_be_recovery_orders = models.IntegerField(default=30, help_text="BUY: Max recovery orders")
    
    # SELL Breakeven Recovery
    enable_sell_be_recovery = models.BooleanField(default=True, help_text="Enable SELL Recovery Orders")
    sell_be_recovery_lot_min = models.DecimalField(max_digits=10, decimal_places=2, default=0.25, help_text="SELL: Minimum lot for recovery")
    sell_be_recovery_lot_max = models.DecimalField(max_digits=10, decimal_places=2, default=5.0, help_text="SELL: Maximum lot for recovery")
    sell_be_recovery_lot_increase = models.DecimalField(max_digits=10, decimal_places=2, default=10.0, help_text="SELL: Lot increase % per order")
    max_sell_be_recovery_orders = models.IntegerField(default=30, help_text="SELL: Max recovery orders")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Settings for {self.license.license_key[:12]}..."

    class Meta:
        verbose_name = "EA Settings"
        verbose_name_plural = "EA Settings"


class TradeData(models.Model):
    """Real-time trade data from MT5"""
    license = models.ForeignKey(License, on_delete=models.CASCADE, related_name='trade_data')
    
    # Account Info
    account_balance = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    account_equity = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    account_profit = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    account_margin = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    account_free_margin = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    
    # Position Summary
    total_buy_positions = models.IntegerField(default=0)
    total_sell_positions = models.IntegerField(default=0)
    total_buy_lots = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_sell_lots = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_buy_profit = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_sell_profit = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    
    # Symbol Info
    symbol = models.CharField(max_length=20, default='')
    current_price = models.DecimalField(max_digits=15, decimal_places=5, default=0)
    
    # Open Positions JSON (detailed)
    open_positions = models.JSONField(default=list, blank=True)
    
    # Timestamps
    last_update = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Trade Data - {self.license.mt5_account} - {self.last_update}"

    class Meta:
        verbose_name = "Trade Data"
        verbose_name_plural = "Trade Data"
        ordering = ['-last_update']
