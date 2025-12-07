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
