#!/usr/bin/env python
"""
Script to add VPS packages to live server database.
Run this from the backend directory: python add_vps_packages_live.py

This will create/update a single VPS plan with 3 pricing tiers:
- Monthly: $16
- 3 Months: $43 (10% savings)
- 12 Months: $160 (17% savings)
"""

import os
import sys
import django

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from core.models import VPSPlan


def add_vps_packages():
    """Create or update VPS packages on live server"""
    
    print("=" * 60)
    print("Adding VPS Packages to Live Server")
    print("=" * 60)
    
    # Single VPS configuration with 3 pricing tiers
    plan_data = {
        'name': 'Forex VPS',
        'description': 'Perfect for running your EA 24/7',
        'cpu': '2 vCPU',
        'ram': '4 GB',
        'storage': '80 GB SSD',
        'os': 'Windows Server 2022',
        'bandwidth': 'Unlimited',
        'location': 'New York, USA',
        'price_monthly': 16.00,      # Starting from $16/month
        'price_quarterly': 43.00,    # 3 months - ~10% savings
        'price_yearly': 160.00,      # 12 months - ~17% savings
        'features': [
            'Windows Server 2022',
            'MetaTrader 5 Pre-Installed',
            "Mark's AI EA Pre-Loaded",
            'Full RDP Access',
            'Up to 3 MT5 Instances',
            '99.99% Uptime SLA',
            '24/7 Priority Support',
            'Faster Execution Speed',
        ],
        'is_popular': True,
        'is_active': True,
        'sort_order': 1,
    }
    
    print("\nVPS Package Details:")
    print(f"  Name: {plan_data['name']}")
    print(f"  CPU: {plan_data['cpu']}")
    print(f"  RAM: {plan_data['ram']}")
    print(f"  Storage: {plan_data['storage']}")
    print(f"  Location: {plan_data['location']}")
    print("\nPricing:")
    print(f"  Monthly:   ${plan_data['price_monthly']:.2f}/month")
    print(f"  3 Months:  ${plan_data['price_quarterly']:.2f} (save ~10%)")
    print(f"  12 Months: ${plan_data['price_yearly']:.2f} (save ~17%)")
    print("\nFeatures:")
    for feature in plan_data['features']:
        print(f"  ✓ {feature}")
    
    # Deactivate old plans (can't delete due to existing orders)
    print("\n" + "-" * 60)
    old_plans = VPSPlan.objects.exclude(name='Forex VPS')
    if old_plans.exists():
        count = old_plans.count()
        old_plans.update(is_active=False)
        print(f"✓ Deactivated {count} old VPS plan(s)")
    else:
        print("✓ No old plans to deactivate")
    
    # Create or update the single plan
    print("-" * 60)
    plan, was_created = VPSPlan.objects.update_or_create(
        name=plan_data['name'],
        defaults=plan_data,
    )
    
    if was_created:
        print(f"✓ Created new VPS plan: {plan_data['name']} (ID: {plan.id})")
    else:
        print(f"✓ Updated existing VPS plan: {plan_data['name']} (ID: {plan.id})")
    
    print("-" * 60)
    print("\n✅ SUCCESS! VPS packages are now live on the server.")
    print(f"\nPlan ID: {plan.id}")
    print("Frontend will automatically fetch this plan via API.")
    print("\nUsers can now order VPS with 3 billing options:")
    print(f"  • Monthly:   ${plan.price_monthly}/month")
    print(f"  • 3 Months:  ${plan.price_quarterly}")
    print(f"  • 12 Months: ${plan.price_yearly}")
    print("\n" + "=" * 60)


if __name__ == '__main__':
    try:
        add_vps_packages()
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
