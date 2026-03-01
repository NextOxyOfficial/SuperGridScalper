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
    
    # User-defined nickname
    nickname = models.CharField(max_length=20, blank=True, default='', help_text="User-defined nickname for this license")
    
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


class LicenseMT5Account(models.Model):
    license = models.ForeignKey(License, on_delete=models.CASCADE, related_name='mt5_accounts')
    mt5_account = models.CharField(max_length=50)
    hardware_id = models.CharField(max_length=255, blank=True, null=True)
    last_seen = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.mt5_account} ({self.license.license_key[:8]}...)"

    class Meta:
        ordering = ['-created_at']
        unique_together = [['license', 'mt5_account']]


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
    mt5_account = models.CharField(max_length=50, blank=True, default='')
    
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
        return f"Trade Data - {self.mt5_account or self.license.mt5_account} - {self.last_update}"

    class Meta:
        verbose_name = "Trade Data"
        verbose_name_plural = "Trade Data"
        ordering = ['-last_update']
        constraints = [
            models.UniqueConstraint(fields=['license', 'mt5_account'], name='unique_tradedata_license_mt5_account')
        ]


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
    
    # Versioning
    version = models.CharField(max_length=20, default='1.0', help_text="Current version (e.g., 2.0, 3.1)")
    changelog = models.TextField(blank=True, help_text="What changed in this version")
    last_update_notified_at = models.DateTimeField(blank=True, null=True, help_text="When users were last notified about an update")
    
    # Status
    is_active = models.BooleanField(default=True)
    is_coming_soon = models.BooleanField(default=False, help_text="Show as 'Coming Soon' in store (visible but not downloadable)")
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


class ReferralAttribution(models.Model):
    referral = models.ForeignKey(Referral, on_delete=models.CASCADE, related_name='attributions')
    referred_user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='referral_attribution')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.referred_user.username} -> {self.referral.referral_code}"

    class Meta:
        verbose_name = "Referral Attribution"
        verbose_name_plural = "Referral Attributions"


class ReferralTransaction(models.Model):
    """Track individual referral transactions"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('cancelled', 'Cancelled'),
    ]
    
    referral = models.ForeignKey(Referral, on_delete=models.CASCADE, related_name='transactions')
    referred_user = models.ForeignKey(User, on_delete=models.CASCADE)

    purchase_request = models.OneToOneField(
        'LicensePurchaseRequest',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='referral_transaction'
    )
    
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


class PayoutMethod(models.Model):
    """Dynamic payout methods for referral payouts - managed from admin"""
    name = models.CharField(max_length=100, help_text="Display name, e.g. PayPal, Bank Transfer, USDT (TRC20)")
    code = models.CharField(max_length=50, unique=True, help_text="Internal code, e.g. paypal, bank, usdt_trc20")
    placeholder = models.CharField(max_length=200, blank=True, help_text="Placeholder text for the details input, e.g. 'Enter your PayPal email'")
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Payout Method"
        verbose_name_plural = "Payout Methods"
        ordering = ['sort_order', 'name']


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
        ('EA_ON', 'Turn EA ON (FM)'),
        ('EA_OFF', 'Turn EA OFF (FM)'),
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
    admin_notification_email = models.EmailField(default="alimulislam50@gmail.com", blank=True)
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


class PaymentNetwork(models.Model):
    name = models.CharField(max_length=50, unique=True)
    code = models.SlugField(max_length=50, unique=True)
    wallet_address = models.CharField(max_length=255)
    token_symbol = models.CharField(max_length=20, default='USDT')
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.token_symbol})"

    class Meta:
        ordering = ['sort_order', 'name']
        verbose_name = "Payment Network"
        verbose_name_plural = "Payment Networks"


class LicensePurchaseRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    REQUEST_TYPE_CHOICES = [
        ('new', 'New License'),
        ('extension', 'License Extension'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='purchase_requests')
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT)
    mt5_account = models.CharField(max_length=50, blank=True, null=True)
    network = models.ForeignKey(PaymentNetwork, on_delete=models.PROTECT, null=True, blank=True)
    amount_usd = models.DecimalField(max_digits=10, decimal_places=2)
    txid = models.CharField(max_length=255, blank=True)
    proof = models.FileField(upload_to='payment_proofs/', blank=True, null=True)
    user_note = models.TextField(blank=True)
    request_number = models.CharField(max_length=6, unique=True, editable=False, null=True, blank=True)
    request_type = models.CharField(max_length=20, choices=REQUEST_TYPE_CHOICES, default='new')
    extend_license = models.ForeignKey(License, on_delete=models.SET_NULL, null=True, blank=True, related_name='extension_requests', help_text='License to extend (for extension requests)')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    admin_note = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_purchase_requests')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    issued_license = models.ForeignKey(License, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchase_requests')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.request_number:
            self.request_number = self.generate_request_number()
        super().save(*args, **kwargs)

    @staticmethod
    def generate_request_number():
        """Generate a unique 6-digit request number"""
        import random
        while True:
            number = str(random.randint(100000, 999999))
            if not LicensePurchaseRequest.objects.filter(request_number=number).exists():
                return number

    def __str__(self):
        type_label = 'EXT' if self.request_type == 'extension' else 'NEW'
        return f"#{self.request_number} [{type_label}] - {self.user.email} - {self.plan.name} - {self.status}"

    class Meta:
        ordering = ['-created_at']
        verbose_name = "License Purchase Request"
        verbose_name_plural = "License Purchase Requests"


class SMTPSettings(models.Model):
    """SMTP Email Configuration - Managed from Admin Panel"""
    
    is_active = models.BooleanField(default=True, help_text="Enable/disable this SMTP configuration")
    
    # SMTP Server Details
    host = models.CharField(max_length=255, default='mail.privateemail.com', help_text="SMTP server hostname (e.g., mail.privateemail.com for Namecheap)")
    port = models.IntegerField(default=587, help_text="SMTP port (587 for TLS, 465 for SSL)")
    use_tls = models.BooleanField(default=True, help_text="Use TLS encryption")
    use_ssl = models.BooleanField(default=False, help_text="Use SSL encryption")
    
    # Authentication
    username = models.EmailField(max_length=255, help_text="SMTP username (usually your email address)")
    password = models.CharField(max_length=255, help_text="SMTP password")
    
    # Email Settings
    from_email = models.EmailField(max_length=255, help_text="Default 'From' email address")
    from_name = models.CharField(max_length=100, default="MarksTrades Support", help_text="Default 'From' name")
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        status = "✓ Active" if self.is_active else "✗ Inactive"
        return f"{self.from_email} ({self.host}) - {status}"
    
    class Meta:
        verbose_name = "SMTP Settings"
        verbose_name_plural = "SMTP Settings"
    
    def save(self, *args, **kwargs):
        # Ensure only one active SMTP config exists
        if self.is_active:
            SMTPSettings.objects.filter(is_active=True).exclude(pk=self.pk).update(is_active=False)
        super().save(*args, **kwargs)


class EmailPreference(models.Model):
    """Track user email preferences and unsubscribe status"""
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='email_preference')
    
    # Email preferences
    marketing_emails = models.BooleanField(default=True, help_text="Receive marketing and promotional emails")
    transactional_emails = models.BooleanField(default=True, help_text="Receive important account emails (cannot be disabled)")
    
    # Metadata
    unsubscribed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        status = "Unsubscribed" if not self.marketing_emails else "Subscribed"
        return f"{self.user.email} - {status}"
    
    class Meta:
        verbose_name = "Email Preference"
        verbose_name_plural = "Email Preferences"
    
    @classmethod
    def can_send_email(cls, user, email_type='marketing'):
        """
        Check if we can send email to this user
        email_type: 'marketing' or 'transactional'
        """
        try:
            pref = cls.objects.get(user=user)
            if email_type == 'transactional':
                return pref.transactional_emails
            return pref.marketing_emails
        except cls.DoesNotExist:
            # If no preference exists, allow emails (opt-in by default)
            return True


# ============================================================
# FUND MANAGER PORTAL MODELS
# ============================================================

class FundManager(models.Model):
    """Fund Manager profile - expert traders who manage groups of users' EA bots"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('suspended', 'Suspended'),
        ('rejected', 'Rejected'),
    ]
    
    TIER_CHOICES = [
        ('standard', 'Standard'),
        ('professional', 'Professional'),
        ('elite', 'Elite'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='fund_manager_profile')
    
    # Profile
    display_name = models.CharField(max_length=100, help_text="Public display name")
    bio = models.TextField(blank=True, help_text="About the fund manager")
    avatar = models.ImageField(upload_to='fm_avatars/', blank=True, null=True)
    tier = models.CharField(max_length=20, choices=TIER_CHOICES, default='standard')
    
    # Subscription pricing
    monthly_price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('29.00'), help_text="Monthly subscription price in USD")
    
    # Performance stats (updated periodically)
    total_profit_percent = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'), help_text="Total profit % across all managed accounts")
    win_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'), help_text="Win rate percentage")
    months_active = models.IntegerField(default=0)
    
    # Ratings
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal('0.00'))
    total_reviews = models.IntegerField(default=0)
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    is_verified = models.BooleanField(default=False, help_text="Verified badge")
    is_featured = models.BooleanField(default=False, help_text="Featured on marketplace")
    
    # Platform commission
    platform_commission_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('15.00'), help_text="Platform takes this % of subscription fee")
    
    # Trading preferences
    trading_pairs = models.CharField(max_length=200, default='XAUUSD', help_text="Comma-separated trading pairs")
    trading_style = models.CharField(max_length=100, blank=True, help_text="e.g., Conservative Scalping, Aggressive Grid")
    max_subscribers = models.IntegerField(default=50, help_text="Maximum number of subscribers allowed")
    
    # Trial
    trial_days = models.IntegerField(default=7, help_text="Free trial period in days (0 = no trial)")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    @property
    def subscriber_count(self):
        return self.subscriptions.filter(status__in=['active', 'trial']).count()
    
    @property
    def total_managed_accounts(self):
        return FMAccountAssignment.objects.filter(
            subscription__fund_manager=self,
            subscription__status='active'
        ).count()
    
    def __str__(self):
        return f"{self.display_name} ({self.get_status_display()}) - ${self.monthly_price}/mo"
    
    class Meta:
        verbose_name = "Fund Manager"
        verbose_name_plural = "Fund Managers"
        ordering = ['-is_featured', '-average_rating', '-created_at']


class FMSubscription(models.Model):
    """User subscription to a Fund Manager"""
    
    STATUS_CHOICES = [
        ('trial', 'Free Trial'),
        ('active', 'Active'),
        ('expired', 'Expired'),
        ('cancelled', 'Cancelled'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='fm_subscriptions')
    fund_manager = models.ForeignKey(FundManager, on_delete=models.CASCADE, related_name='subscriptions')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='trial')
    
    # Pricing at time of subscription
    price_at_subscription = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Dates
    started_at = models.DateTimeField(auto_now_add=True)
    current_period_start = models.DateTimeField(auto_now_add=True)
    current_period_end = models.DateTimeField()
    cancelled_at = models.DateTimeField(null=True, blank=True)
    
    auto_renew = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    @property
    def is_active(self):
        if self.status not in ('active', 'trial'):
            return False
        return timezone.now() <= self.current_period_end
    
    @property
    def days_remaining(self):
        if not self.is_active:
            return 0
        delta = self.current_period_end - timezone.now()
        return max(0, delta.days)
    
    def __str__(self):
        return f"{self.user.email} → {self.fund_manager.display_name} ({self.status})"
    
    class Meta:
        verbose_name = "FM Subscription"
        verbose_name_plural = "FM Subscriptions"
        ordering = ['-created_at']
        unique_together = [['user', 'fund_manager']]


class FMAccountAssignment(models.Model):
    """Assigns a user's MT5 license to a Fund Manager's control"""
    
    subscription = models.ForeignKey(FMSubscription, on_delete=models.CASCADE, related_name='assigned_accounts')
    license = models.ForeignKey(License, on_delete=models.CASCADE, related_name='fm_assignments')
    
    # FM control state
    is_ea_active = models.BooleanField(default=True, help_text="Whether EA trading is currently enabled by FM")
    last_toggled_at = models.DateTimeField(null=True, blank=True)
    last_toggled_reason = models.CharField(max_length=255, blank=True)
    
    assigned_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        status = "ON" if self.is_ea_active else "OFF"
        return f"{self.license.mt5_account} [{status}] → {self.subscription.fund_manager.display_name}"
    
    class Meta:
        verbose_name = "FM Account Assignment"
        verbose_name_plural = "FM Account Assignments"
        unique_together = [['subscription', 'license']]


class FMCommand(models.Model):
    """Commands issued by Fund Manager to control EA on/off for subscribers"""
    
    COMMAND_TYPES = [
        ('ea_on', 'Turn EA ON'),
        ('ea_off', 'Turn EA OFF'),
    ]
    
    TARGET_TYPES = [
        ('all', 'All Subscribers'),
        ('specific', 'Specific Account'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('executed', 'Executed'),
        ('partial', 'Partially Executed'),
        ('failed', 'Failed'),
    ]
    
    fund_manager = models.ForeignKey(FundManager, on_delete=models.CASCADE, related_name='commands')
    command_type = models.CharField(max_length=10, choices=COMMAND_TYPES)
    target_type = models.CharField(max_length=10, choices=TARGET_TYPES, default='all')
    
    # If targeting specific account
    target_assignment = models.ForeignKey(FMAccountAssignment, on_delete=models.SET_NULL, null=True, blank=True, related_name='commands')
    
    reason = models.CharField(max_length=255, blank=True, help_text="Why this command was issued (e.g., NFP News)")
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    affected_accounts = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    executed_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"{self.fund_manager.display_name} - {self.get_command_type_display()} ({self.get_target_type_display()})"
    
    class Meta:
        verbose_name = "FM Command"
        verbose_name_plural = "FM Commands"
        ordering = ['-created_at']


class FMChatRoom(models.Model):
    """Group chat room for a Fund Manager and their subscribers"""
    
    fund_manager = models.OneToOneField(FundManager, on_delete=models.CASCADE, related_name='chat_room')
    name = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Chat: {self.fund_manager.display_name}"
    
    class Meta:
        verbose_name = "FM Chat Room"
        verbose_name_plural = "FM Chat Rooms"


class FMChatMessage(models.Model):
    """Messages in a Fund Manager's group chat"""
    
    MESSAGE_TYPES = [
        ('message', 'Regular Message'),
        ('announcement', 'Announcement'),
        ('signal', 'Trade Signal'),
        ('system', 'System Message'),
        ('photo', 'Photo'),
        ('voice', 'Voice Message'),
    ]
    
    chat_room = models.ForeignKey(FMChatRoom, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='fm_chat_messages')
    reply_to = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='replies')
    
    message = models.TextField(blank=True)
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPES, default='message')
    is_pinned = models.BooleanField(default=False)
    
    # Media attachments
    image = models.ImageField(upload_to='fm_chat_images/', blank=True, null=True)
    voice = models.FileField(upload_to='fm_chat_voice/', blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.sender.email}: {self.message[:50]}"
    
    class Meta:
        verbose_name = "FM Chat Message"
        verbose_name_plural = "FM Chat Messages"
        ordering = ['-created_at']


class FMReview(models.Model):
    """User reviews for Fund Managers"""
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='fm_reviews')
    fund_manager = models.ForeignKey(FundManager, on_delete=models.CASCADE, related_name='reviews')
    
    rating = models.IntegerField(help_text="Rating 1-5")
    comment = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Update fund manager's average rating
        from django.db.models import Avg, Count
        stats = self.fund_manager.reviews.aggregate(
            avg_rating=Avg('rating'),
            total=Count('id')
        )
        self.fund_manager.average_rating = stats['avg_rating'] or Decimal('0.00')
        self.fund_manager.total_reviews = stats['total'] or 0
        self.fund_manager.save(update_fields=['average_rating', 'total_reviews'])
    
    def __str__(self):
        return f"{self.user.email} → {self.fund_manager.display_name}: {self.rating}★"
    
    class Meta:
        verbose_name = "FM Review"
        verbose_name_plural = "FM Reviews"
        unique_together = [['user', 'fund_manager']]
        ordering = ['-created_at']


class FMPayout(models.Model):
    """Track Fund Manager earnings and payouts"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    fund_manager = models.ForeignKey(FundManager, on_delete=models.CASCADE, related_name='payouts')
    
    # Period
    period_start = models.DateField()
    period_end = models.DateField()
    
    # Amounts
    gross_amount = models.DecimalField(max_digits=10, decimal_places=2, help_text="Total subscription revenue for period")
    platform_fee = models.DecimalField(max_digits=10, decimal_places=2, help_text="Platform commission deducted")
    net_amount = models.DecimalField(max_digits=10, decimal_places=2, help_text="Amount payable to FM")
    
    # Payment
    payment_method = models.CharField(max_length=50, blank=True)
    payment_details = models.JSONField(default=dict, blank=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    admin_notes = models.TextField(blank=True)
    
    def __str__(self):
        return f"{self.fund_manager.display_name} - ${self.net_amount} ({self.status})"
    
    class Meta:
        verbose_name = "FM Payout"
        verbose_name_plural = "FM Payouts"
        ordering = ['-created_at']


class FMSchedule(models.Model):
    """EA on/off schedule templates created by Fund Managers"""
    
    DAYS_OF_WEEK = [
        (0, 'Monday'),
        (1, 'Tuesday'),
        (2, 'Wednesday'),
        (3, 'Thursday'),
        (4, 'Friday'),
        (5, 'Saturday'),
        (6, 'Sunday'),
    ]
    
    fund_manager = models.ForeignKey(FundManager, on_delete=models.CASCADE, related_name='schedules')
    
    name = models.CharField(max_length=100, help_text="Schedule name (e.g., 'No Friday Trading')")
    is_active = models.BooleanField(default=True)
    
    # Schedule details
    day_of_week = models.IntegerField(choices=DAYS_OF_WEEK)
    off_time = models.TimeField(help_text="Time to turn EA OFF (UTC)")
    on_time = models.TimeField(help_text="Time to turn EA back ON (UTC)")
    reason = models.CharField(max_length=255, blank=True, help_text="e.g., 'High impact news window'")
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.fund_manager.display_name} - {self.name} ({self.get_day_of_week_display()})"
    
    class Meta:
        verbose_name = "FM Schedule"
        verbose_name_plural = "FM Schedules"
        ordering = ['day_of_week', 'off_time']


class EconomicEvent(models.Model):
    """Economic calendar events for Fund Managers"""
    
    IMPACT_CHOICES = [
        ('low', 'Low Impact'),
        ('medium', 'Medium Impact'),
        ('high', 'High Impact'),
    ]
    
    title = models.CharField(max_length=200)
    currency = models.CharField(max_length=10, help_text="e.g., USD, EUR, GBP")
    impact = models.CharField(max_length=10, choices=IMPACT_CHOICES, default='medium')
    
    event_time = models.DateTimeField()
    
    # Forecast/Actual/Previous
    forecast = models.CharField(max_length=50, blank=True)
    actual = models.CharField(max_length=50, blank=True)
    previous = models.CharField(max_length=50, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"[{self.impact.upper()}] {self.title} ({self.currency}) - {self.event_time}"
    
    class Meta:
        verbose_name = "Economic Event"
        verbose_name_plural = "Economic Events"
        ordering = ['event_time']


class TradingWaveAlert(models.Model):
    """Admin-configurable Trading Wave Alerts — 3 separate alerts (Normal / Medium / High)"""

    MODE_CHOICES = [
        ('normal', 'Normal Impact Running'),
        ('medium', 'Medium Impact Expecting'),
        ('high', 'High Impact Expecting'),
    ]

    mode = models.CharField(max_length=10, choices=MODE_CHOICES, unique=True)
    display_name = models.CharField(
        max_length=100,
        blank=True,
        help_text="Custom display name for this alert (e.g., 'High Impact Expecting'). If empty, uses default based on mode."
    )
    minutes_before = models.PositiveIntegerField(
        default=0,
        help_text="Minutes until the impact wave arrives. Frontend shows a live countdown from this value."
    )
    tips = models.TextField(
        blank=True,
        default='',
        help_text="Tips / summary text shown to users (e.g., 'Close risky positions before NFP release')"
    )
    is_active = models.BooleanField(default=False, help_text="Turn ON to broadcast this alert to all users")
    activated_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Auto-set when you activate the alert. The countdown runs from this moment."
    )
    updated_at = models.DateTimeField(auto_now=True)

    def get_display_name(self):
        """Get custom display name or fallback to default"""
        if self.display_name.strip():
            return self.display_name.strip()
        return self.get_mode_display()

    def save(self, *args, **kwargs):
        # Detect if alert is being newly activated
        newly_activated = False
        if self.is_active and not self.activated_at:
            self.activated_at = timezone.now()
            newly_activated = True
        elif not self.is_active:
            self.activated_at = None
        super().save(*args, **kwargs)

        # Send email to active license users when medium/high alert is newly activated
        if newly_activated and self.mode in ('medium', 'high'):
            try:
                from core.utils import send_wave_alert_emails
                send_wave_alert_emails(self.mode, self.minutes_before, self.tips)
            except Exception:
                pass

    def __str__(self):
        status = '🟢 ACTIVE' if self.is_active else '⚫ OFF'
        display = self.get_display_name()
        return f"{display} [{status}]"

    class Meta:
        verbose_name = "Trading Wave Alert"
        verbose_name_plural = "Trading Wave Alerts"
        ordering = ['mode']


# ============================================================
# USER BADGE SYSTEM
# ============================================================

class Badge(models.Model):
    """Achievement badges that can be granted to users"""

    BADGE_TYPES = [
        ('manual', 'Manual (Admin Assigned)'),
        ('auto_join', 'Auto: Join Duration'),
    ]

    ICON_CHOICES = [
        ('star', '⭐ Star'),
        ('fire', '🔥 Fire'),
        ('crown', '👑 Crown'),
        ('shield', '🛡 Shield'),
        ('diamond', '💎 Diamond'),
        ('rocket', '🚀 Rocket'),
        ('trophy', '🏆 Trophy'),
        ('zap', '⚡ Zap'),
    ]

    name = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255)
    icon = models.CharField(max_length=20, choices=ICON_CHOICES, default='star')
    color = models.CharField(max_length=30, default='text-yellow-400', help_text="Tailwind text color class")
    badge_type = models.CharField(max_length=20, choices=BADGE_TYPES, default='manual')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Badge"
        verbose_name_plural = "Badges"
        ordering = ['name']


class UserBadge(models.Model):
    """Many-to-many: badges awarded to users"""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='badges')
    badge = models.ForeignKey(Badge, on_delete=models.CASCADE, related_name='user_badges')
    awarded_at = models.DateTimeField(auto_now_add=True)
    awarded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='badges_awarded', help_text="Admin who granted this badge"
    )
    note = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return f"{self.user.email} — {self.badge.name}"

    class Meta:
        verbose_name = "User Badge"
        verbose_name_plural = "User Badges"
        unique_together = [['user', 'badge']]
        ordering = ['-awarded_at']


class EmailOTP(models.Model):
    """OTP codes for email verification (registration & login)"""
    PURPOSE_REGISTER = 'register'
    PURPOSE_LOGIN = 'login'
    PURPOSE_CHOICES = [
        (PURPOSE_REGISTER, 'Registration'),
        (PURPOSE_LOGIN, 'Login'),
    ]

    email = models.EmailField()
    code = models.CharField(max_length=6)
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES)

    # For registration: store pending user data so we don't create until verified
    pending_data = models.JSONField(default=dict, blank=True)

    is_used = models.BooleanField(default=False)
    attempts = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def is_expired(self):
        return timezone.now() > self.expires_at

    def is_valid(self, code):
        return (
            not self.is_used
            and not self.is_expired()
            and self.attempts < 5
            and self.code == code
        )

    @classmethod
    def generate(cls, email, purpose, pending_data=None, expiry_minutes=10):
        import random
        cls.objects.filter(email=email, purpose=purpose, is_used=False).delete()
        code = f"{random.randint(0, 999999):06d}"
        return cls.objects.create(
            email=email,
            purpose=purpose,
            code=code,
            pending_data=pending_data or {},
            expires_at=timezone.now() + timedelta(minutes=expiry_minutes),
        )

    def __str__(self):
        return f"{self.email} [{self.purpose}] — {self.code}"

    class Meta:
        verbose_name = "Email OTP"
        verbose_name_plural = "Email OTPs"
        indexes = [
            models.Index(fields=['email', 'purpose', 'is_used']),
        ]
