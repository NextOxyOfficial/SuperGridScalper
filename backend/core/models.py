from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal
import uuid
import secrets
from datetime import timedelta


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
    """EA Trading Settings - Managed from Django Admin (per license per symbol)"""
    
    SYMBOL_CHOICES = [
        ('XAUUSD', 'XAUUSD (Gold)'),
        ('BTCUSD', 'BTCUSD (Bitcoin)'),
    ]
    
    license = models.ForeignKey(License, on_delete=models.CASCADE, related_name='ea_settings')
    symbol = models.CharField(max_length=20, choices=SYMBOL_CHOICES, default='XAUUSD', help_text="Trading symbol")
    
    # Investment amount removed - now using dynamic balance from TradeData
    
    # BUY Grid Range Settings
    buy_range_start = models.DecimalField(max_digits=10, decimal_places=2, default=100000, help_text="BUY Range Start Price")
    buy_range_end = models.DecimalField(max_digits=10, decimal_places=2, default=80000, help_text="BUY Range End Price")
    buy_gap_pips = models.DecimalField(max_digits=10, decimal_places=2, default=3.0, help_text="BUY Gap between orders (Pips)")
    max_buy_orders = models.IntegerField(default=5, help_text="Maximum BUY orders at a time")
    
    # BUY TP/SL/Trailing Settings
    buy_take_profit_pips = models.DecimalField(max_digits=10, decimal_places=2, default=50.0, help_text="BUY Take Profit (Pips, 0=disabled)")
    buy_stop_loss_pips = models.DecimalField(max_digits=10, decimal_places=2, default=0.0, help_text="BUY Stop Loss (Pips, 0=disabled)")
    buy_trailing_start_pips = models.DecimalField(max_digits=10, decimal_places=2, default=3.0, help_text="BUY Start trailing after X pips profit")
    buy_initial_sl_pips = models.DecimalField(max_digits=10, decimal_places=2, default=2.0, help_text="BUY Initial SL distance when trailing starts")
    buy_trailing_ratio = models.DecimalField(max_digits=10, decimal_places=2, default=0.5, help_text="BUY SL movement ratio")
    buy_max_sl_distance = models.DecimalField(max_digits=10, decimal_places=2, default=15.0, help_text="BUY Maximum SL distance from price (pips)")
    buy_trailing_step_pips = models.DecimalField(max_digits=10, decimal_places=2, default=0.5, help_text="BUY Minimum step to update SL (pips)")
    
    # SELL Grid Range Settings
    sell_range_start = models.DecimalField(max_digits=10, decimal_places=2, default=80000, help_text="SELL Range Start Price")
    sell_range_end = models.DecimalField(max_digits=10, decimal_places=2, default=100000, help_text="SELL Range End Price")
    sell_gap_pips = models.DecimalField(max_digits=10, decimal_places=2, default=3.0, help_text="SELL Gap between orders (Pips)")
    max_sell_orders = models.IntegerField(default=5, help_text="Maximum SELL orders at a time")
    
    # SELL TP/SL/Trailing Settings
    sell_take_profit_pips = models.DecimalField(max_digits=10, decimal_places=2, default=50.0, help_text="SELL Take Profit (Pips, 0=disabled)")
    sell_stop_loss_pips = models.DecimalField(max_digits=10, decimal_places=2, default=0.0, help_text="SELL Stop Loss (Pips, 0=disabled)")
    sell_trailing_start_pips = models.DecimalField(max_digits=10, decimal_places=2, default=3.0, help_text="SELL Start trailing after X pips profit")
    sell_initial_sl_pips = models.DecimalField(max_digits=10, decimal_places=2, default=2.0, help_text="SELL Initial SL distance when trailing starts")
    sell_trailing_ratio = models.DecimalField(max_digits=10, decimal_places=2, default=0.5, help_text="SELL SL movement ratio")
    sell_max_sl_distance = models.DecimalField(max_digits=10, decimal_places=2, default=15.0, help_text="SELL Maximum SL distance from price (pips)")
    sell_trailing_step_pips = models.DecimalField(max_digits=10, decimal_places=2, default=0.5, help_text="SELL Minimum step to update SL (pips)")
    
    # Lot size removed - now calculated dynamically by EA based on account balance
    
    # Breakeven Trailing Settings (replaces Breakeven TP)
    enable_breakeven_trailing = models.BooleanField(default=True, help_text="Enable Breakeven Trailing for all trades")
    breakeven_buy_trailing_pips = models.DecimalField(max_digits=10, decimal_places=2, default=2.0, help_text="Breakeven trigger for BUY (pips above avg price)")
    breakeven_sell_trailing_pips = models.DecimalField(max_digits=10, decimal_places=2, default=2.0, help_text="Breakeven trigger for SELL (pips below avg price)")
    breakeven_trailing_start_pips = models.DecimalField(max_digits=10, decimal_places=2, default=10.0, help_text="Start trailing after X pips profit")
    breakeven_initial_sl_pips = models.DecimalField(max_digits=10, decimal_places=2, default=5.0, help_text="Initial SL distance when trailing starts")
    breakeven_trailing_ratio = models.DecimalField(max_digits=10, decimal_places=2, default=0.5, help_text="SL movement ratio (0.5 = move SL 50% of price movement)")
    breakeven_max_sl_distance = models.DecimalField(max_digits=10, decimal_places=2, default=15.0, help_text="Maximum SL distance from current price")
    breakeven_trailing_step_pips = models.DecimalField(max_digits=10, decimal_places=2, default=0.5, help_text="Minimum step to update SL")
    manage_all_trades = models.BooleanField(default=True, help_text="Manage ALL trades (ignore magic number)")
    
    # BUY Breakeven Recovery
    enable_buy_be_recovery = models.BooleanField(default=True, help_text="Enable BUY Recovery Orders")
    buy_be_recovery_lot_min = models.DecimalField(max_digits=10, decimal_places=2, default=0.05, help_text="BUY: Minimum lot for recovery (auto-calculated)")
    buy_be_recovery_lot_max = models.DecimalField(max_digits=10, decimal_places=2, default=5.0, help_text="BUY: Maximum lot for recovery")
    buy_be_recovery_lot_increase = models.DecimalField(max_digits=10, decimal_places=2, default=10.0, help_text="BUY: Lot increase % per order")
    max_buy_be_recovery_orders = models.IntegerField(default=30, help_text="BUY: Max recovery orders")
    
    # SELL Breakeven Recovery
    enable_sell_be_recovery = models.BooleanField(default=True, help_text="Enable SELL Recovery Orders")
    sell_be_recovery_lot_min = models.DecimalField(max_digits=10, decimal_places=2, default=0.05, help_text="SELL: Minimum lot for recovery (auto-calculated)")
    sell_be_recovery_lot_max = models.DecimalField(max_digits=10, decimal_places=2, default=5.0, help_text="SELL: Maximum lot for recovery")
    sell_be_recovery_lot_increase = models.DecimalField(max_digits=10, decimal_places=2, default=10.0, help_text="SELL: Lot increase % per order")
    max_sell_be_recovery_orders = models.IntegerField(default=30, help_text="SELL: Max recovery orders")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Default settings per symbol
    SYMBOL_DEFAULTS = {
        'XAUUSD': {
            'buy_range_start': 3400,
            'buy_range_end': 2600,
            'buy_gap_pips': 3,
            'max_buy_orders': 5,
            'buy_take_profit_pips': 50,
            'buy_trailing_start_pips': 3,
            'buy_initial_sl_pips': 2,
            'sell_range_start': 2600,
            'sell_range_end': 3400,
            'sell_gap_pips': 3,
            'max_sell_orders': 5,
            'sell_take_profit_pips': 50,
            'sell_trailing_start_pips': 3,
            'sell_initial_sl_pips': 2,
        },
        'BTCUSD': {
            'buy_range_start': 120000,
            'buy_range_end': 80000,
            'buy_gap_pips': 30,
            'max_buy_orders': 5,
            'buy_take_profit_pips': 50,
            'buy_trailing_start_pips': 10,
            'buy_initial_sl_pips': 5,
            'sell_range_start': 80000,
            'sell_range_end': 120000,
            'sell_gap_pips': 30,
            'max_sell_orders': 5,
            'sell_take_profit_pips': 50,
            'sell_trailing_start_pips': 10,
            'sell_initial_sl_pips': 5,
        }
    }
    
    def apply_symbol_defaults(self):
        """Apply default settings based on symbol with FIXED lot sizes"""
        defaults = self.SYMBOL_DEFAULTS.get(self.symbol, self.SYMBOL_DEFAULTS['XAUUSD'])
        
        # Apply symbol-specific grid settings
        self.buy_range_start = defaults['buy_range_start']
        self.buy_range_end = defaults['buy_range_end']
        self.buy_gap_pips = defaults['buy_gap_pips']
        self.max_buy_orders = defaults['max_buy_orders']
        self.buy_take_profit_pips = defaults['buy_take_profit_pips']
        self.buy_trailing_start_pips = defaults['buy_trailing_start_pips']
        self.buy_initial_sl_pips = defaults['buy_initial_sl_pips']
        
        self.sell_range_start = defaults['sell_range_start']
        self.sell_range_end = defaults['sell_range_end']
        self.sell_gap_pips = defaults['sell_gap_pips']
        self.max_sell_orders = defaults['max_sell_orders']
        self.sell_take_profit_pips = defaults['sell_take_profit_pips']
        self.sell_trailing_start_pips = defaults['sell_trailing_start_pips']
        self.sell_initial_sl_pips = defaults['sell_initial_sl_pips']
        
        # Apply default lot sizes (no longer fixed)
        # Investment amount and lot sizes are now dynamic based on account balance

    def __str__(self):
        return f"{self.symbol} - {self.license.license_key[:12]}..."

    class Meta:
        verbose_name = "EA Settings"
        verbose_name_plural = "EA Settings"
        unique_together = [['license', 'symbol']]  # One settings per license per symbol


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
    
    # Pending Orders JSON
    pending_orders = models.JSONField(default=list, blank=True)
    total_pending_orders = models.IntegerField(default=0)
    
    # Closed Positions JSON (last 1000 closed trades, older removed automatically)
    closed_positions = models.JSONField(default=list, blank=True)
    
    # Trading Mode
    trading_mode = models.CharField(max_length=50, default='Normal')
    
    # Timestamps
    last_update = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Trade Data - {self.license.mt5_account} - {self.last_update}"

    class Meta:
        verbose_name = "Trade Data"
        verbose_name_plural = "Trade Data"
        ordering = ['-last_update']


class EAProduct(models.Model):
    """EA Products for the EA Store - Managed from Django Admin"""
    
    RISK_CHOICES = [
        ('Low', 'Low'),
        ('Medium', 'Medium'),
        ('Medium-High', 'Medium-High'),
        ('High', 'High'),
    ]
    
    COLOR_CHOICES = [
        ('cyan', 'Cyan'),
        ('yellow', 'Yellow'),
        ('purple', 'Purple'),
        ('orange', 'Orange'),
        ('green', 'Green'),
    ]
    
    name = models.CharField(max_length=100, help_text="EA Name (e.g., Gold Scalper Pro)")
    subtitle = models.CharField(max_length=100, help_text="Short subtitle (e.g., Most Popular)")
    description = models.TextField(help_text="Description of the EA")
    
    # Investment Range
    min_investment = models.DecimalField(max_digits=10, decimal_places=2, help_text="Minimum investment amount")
    max_investment = models.DecimalField(max_digits=10, decimal_places=2, help_text="Maximum investment amount")
    
    # Performance
    expected_profit = models.CharField(max_length=50, help_text="Expected profit range (e.g., 100-180%)")
    risk_level = models.CharField(max_length=20, choices=RISK_CHOICES, default='Medium')
    trading_style = models.CharField(max_length=100, help_text="Trading style (e.g., Aggressive Scalping)")
    
    # Features (comma separated)
    features = models.TextField(help_text="Features separated by comma (e.g., Auto Risk Management, Trailing Stop)")
    
    # Display
    color = models.CharField(max_length=20, choices=COLOR_CHOICES, default='cyan')
    is_popular = models.BooleanField(default=False, help_text="Mark as popular/featured")
    display_order = models.IntegerField(default=0, help_text="Order in which to display (lower = first)")
    
    # EA File
    ea_file = models.FileField(upload_to='ea_files/', blank=True, null=True, help_text="Upload .ex5 file")
    file_name = models.CharField(max_length=100, blank=True, help_text="Custom file name for download")

    external_download_url = models.URLField(blank=True, help_text="External download link (if set, store will redirect here)")
    
    # Status
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def get_features_list(self):
        """Return features as a list"""
        return [f.strip() for f in self.features.split(',') if f.strip()]
    
    def __str__(self):
        return f"{self.name} (${self.min_investment}-${self.max_investment})"
    
    class Meta:
        verbose_name = "EA Product"
        verbose_name_plural = "EA Products"
        ordering = ['display_order', 'min_investment']


class Referral(models.Model):
    """Referral program - tracks referrer earnings and stats"""
    
    referrer = models.OneToOneField(User, on_delete=models.CASCADE, related_name='referral_account')
    referral_code = models.CharField(max_length=20, unique=True)
    
    # Commission settings
    commission_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('10.00'))
    
    # Tracking stats
    clicks = models.PositiveIntegerField(default=0)
    signups = models.PositiveIntegerField(default=0)
    purchases = models.PositiveIntegerField(default=0)
    
    # Earnings
    total_earnings = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    pending_earnings = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    paid_earnings = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def save(self, *args, **kwargs):
        if not self.referral_code:
            self.referral_code = self.generate_referral_code()
        super().save(*args, **kwargs)
    
    @staticmethod
    def generate_referral_code():
        """Generate a unique referral code"""
        import random
        import string
        while True:
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
            referral_code = f"REF-{code}"
            if not Referral.objects.filter(referral_code=referral_code).exists():
                return referral_code
    
    def __str__(self):
        return f"{self.referrer.username} - {self.referral_code}"
    
    class Meta:
        verbose_name = "Referral"
        verbose_name_plural = "Referrals"


class ReferralTransaction(models.Model):
    """Track individual referral transactions"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('cancelled', 'Cancelled'),
    ]
    
    referral = models.ForeignKey(Referral, on_delete=models.CASCADE, related_name='transactions')
    referred_user = models.ForeignKey(User, on_delete=models.CASCADE)
    
    purchase_amount = models.DecimalField(max_digits=10, decimal_places=2)
    commission_amount = models.DecimalField(max_digits=10, decimal_places=2)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.referral.referral_code} - ${self.commission_amount}"
    
    class Meta:
        verbose_name = "Referral Transaction"
        verbose_name_plural = "Referral Transactions"


class ReferralPayout(models.Model):
    """Track payout requests"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    referral = models.ForeignKey(Referral, on_delete=models.CASCADE, related_name='payouts')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    
    payment_method = models.CharField(max_length=50)  # paypal, bank, crypto
    payment_details = models.JSONField()  # email, account details, etc.
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    requested_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    admin_notes = models.TextField(blank=True)
    
    def __str__(self):
        return f"{self.referral.referral_code} - ${self.amount} ({self.status})"
    
    class Meta:
        verbose_name = "Referral Payout"
        verbose_name_plural = "Referral Payouts"
        ordering = ['-requested_at']


class EAActionLog(models.Model):
    """Action logs from EA trading activity"""
    LOG_TYPES = [
        ('CONNECT', 'EA Connected'),
        ('DISCONNECT', 'EA Disconnected'),
        ('MODE', 'Trading Mode'),
        ('OPEN_BUY', 'Open Buy Position'),
        ('OPEN_SELL', 'Open Sell Position'),
        ('CLOSE_BUY', 'Close Buy Position'),
        ('CLOSE_SELL', 'Close Sell Position'),
        ('MODIFY', 'Modify Position'),
        ('TRAILING', 'Trailing Stop'),
        ('BREAKEVEN', 'Breakeven'),
        ('RECOVERY', 'Recovery Order'),
        ('GRID', 'Grid Order'),
        ('SIGNAL', 'Signal'),
        ('ERROR', 'Error'),
        ('WARNING', 'Warning'),
        ('INFO', 'Info'),
    ]
    
    license = models.ForeignKey(License, on_delete=models.CASCADE, related_name='action_logs')
    log_type = models.CharField(max_length=20, choices=LOG_TYPES, default='INFO')
    message = models.TextField()
    details = models.JSONField(default=dict, blank=True)  # Extra data like ticket, lots, price
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"[{self.log_type}] {self.message[:50]}"
    
    class Meta:
        verbose_name = "EA Action Log"
        verbose_name_plural = "EA Action Logs"
        ordering = ['-created_at']


class TradeCommand(models.Model):
    """Commands from backend to EA for trade actions"""
    COMMAND_TYPES = [
        ('CLOSE_POSITION', 'Close Position'),
        ('CLOSE_ALL_BUY', 'Close All Buy'),
        ('CLOSE_ALL_SELL', 'Close All Sell'),
        ('CLOSE_ALL', 'Close All Positions'),
        ('CLOSE_BULK', 'Close Bulk Positions'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('executed', 'Executed'),
        ('failed', 'Failed'),
        ('expired', 'Expired'),
    ]
    
    license = models.ForeignKey(License, on_delete=models.CASCADE, related_name='trade_commands')
    command_type = models.CharField(max_length=20, choices=COMMAND_TYPES)
    
    # Command parameters (JSON)
    # For CLOSE_POSITION: {"ticket": 12345}
    # For CLOSE_BULK: {"tickets": [12345, 67890, ...]}
    # For CLOSE_ALL_BUY/SELL/ALL: {}
    parameters = models.JSONField(default=dict, blank=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Execution tracking
    created_at = models.DateTimeField(auto_now_add=True)
    executed_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()  # Commands expire after 5 minutes
    
    # Result
    result_message = models.TextField(blank=True)
    result_data = models.JSONField(default=dict, blank=True)  # Closed tickets, errors, etc.
    
    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=5)
        super().save(*args, **kwargs)
    
    def is_expired(self):
        """Check if command has expired"""
        if self.status != 'pending':
            return False
        if timezone.now() > self.expires_at:
            self.status = 'expired'
            self.save()
            return True
        return False
    
    def __str__(self):
        return f"{self.command_type} - {self.license.license_key[:12]}... ({self.status})"
    
    class Meta:
        verbose_name = "Trade Command"
        verbose_name_plural = "Trade Commands"
        ordering = ['-created_at']


class SiteSettings(models.Model):
    """Global site settings - only one instance should exist"""
    
    site_name = models.CharField(max_length=100, default="MARK'S AI 3.0")
    site_tagline = models.CharField(max_length=200, default="Advanced Gold Scalping EA", blank=True)
    
    favicon = models.ImageField(upload_to='site/', blank=True, null=True, help_text="Favicon (recommended: 32x32 or 64x64 PNG/ICO)")
    logo = models.ImageField(upload_to='site/', blank=True, null=True, help_text="Site logo image")
    logo_text = models.CharField(max_length=50, default="MARK'S AI", blank=True, help_text="Text logo if no image")
    logo_version = models.CharField(max_length=20, default="3.0", blank=True, help_text="Version text next to logo")
    
    support_email = models.EmailField(default="support@markstrades.com")
    telegram_en = models.CharField(max_length=100, default="@MarksAISupportEnglish", help_text="English Telegram handle")
    telegram_en_url = models.URLField(default="https://t.me/MarksAISupportEnglish", blank=True)
    telegram_cn = models.CharField(max_length=100, default="@MarksAISupportChinese", help_text="Chinese Telegram handle")
    telegram_cn_url = models.URLField(default="https://t.me/MarksAISupportChinese", blank=True)
    
    updated_at = models.DateTimeField(auto_now=True)
    
    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)
    
    @classmethod
    def get_settings(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj
    
    def __str__(self):
        return "Site Settings"
    
    class Meta:
        verbose_name = "Site Settings"
        verbose_name_plural = "Site Settings"
