from django.core.management.base import BaseCommand
from core.models import VPSPlan


class Command(BaseCommand):
    help = 'Create single VPS plan for testing (simplified system)'

    def handle(self, *args, **options):
        # Single VPS configuration - pricing varies by billing cycle only
        plan_data = {
            'name': 'Forex VPS',
            'description': 'Perfect for running your EA 24/7',
            'cpu': '2 vCPU',
            'ram': '4 GB',
            'storage': '80 GB SSD',
            'os': 'Windows Server 2022',
            'bandwidth': 'Unlimited',
            'location': 'New York, USA',
            'price_monthly': 20.00,
            'price_quarterly': 54.00,
            'price_yearly': 192.00,
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

        # Deactivate old plans (can't delete due to existing orders)
        old_plans = VPSPlan.objects.exclude(name='Forex VPS')
        if old_plans.exists():
            count = old_plans.update(is_active=False)
            self.stdout.write(self.style.WARNING(f'  Deactivated {count} old VPS plan(s)'))

        # Create or update the single plan
        plan, was_created = VPSPlan.objects.update_or_create(
            name=plan_data['name'],
            defaults=plan_data,
        )
        
        if was_created:
            self.stdout.write(self.style.SUCCESS(f'  Created: {plan_data["name"]}'))
        else:
            self.stdout.write(self.style.SUCCESS(f'  Updated: {plan_data["name"]}'))

        self.stdout.write(self.style.SUCCESS(f'\nDone! Single VPS plan ready (ID: {plan.id}).'))
