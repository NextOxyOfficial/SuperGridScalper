from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import License


class Command(BaseCommand):
    help = 'Send license expiry reminder emails (7/3/1/0 days remaining)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            nargs='*',
            type=int,
            default=[7, 3, 1, 0],
            help='Days remaining thresholds to send reminders for (default: 7 3 1 0)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Do not send emails; only print what would be sent',
        )

    def handle(self, *args, **options):
        thresholds = sorted(set(options['days']))
        dry_run = bool(options['dry_run'])

        base = (getattr(settings, 'FRONTEND_URL', '') or '').rstrip('/')
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None)

        now = timezone.now()
        sent = 0
        scanned = 0

        for days in thresholds:
            start = now + timedelta(days=days)
            end = start + timedelta(days=1)

            qs = (
                License.objects
                .filter(status='active', expires_at__gte=start, expires_at__lt=end)
                .select_related('user', 'plan')
            )

            for lic in qs:
                scanned += 1
                user = lic.user
                if not user or not user.email:
                    continue

                subject = 'License Expiry Reminder'
                if days == 0:
                    subject = 'Your License Expires Today'

                remaining_text = 'today' if days == 0 else f'in {days} day' + ('' if days == 1 else 's')

                message = (
                    f"Hi {user.first_name or 'Trader'},\n\n"
                    f"This is a reminder that your license will expire {remaining_text}.\n\n"
                    f"Plan: {lic.plan.name if lic.plan else '-'}\n"
                    f"License Key: {lic.license_key}\n"
                    f"Expires At: {lic.expires_at.isoformat()}\n\n"
                    f"Open your dashboard to extend your license: {base}/dashboard\n\n"
                    "If you have already extended, you can ignore this message."
                )

                if dry_run:
                    self.stdout.write(self.style.WARNING(f"[DRY RUN] Would email {user.email} for license {lic.license_key}"))
                    continue

                try:
                    send_mail(
                        subject,
                        message,
                        from_email,
                        [user.email],
                        fail_silently=False,
                    )
                    sent += 1
                except Exception as e:
                    self.stderr.write(self.style.ERROR(f"Failed sending to {user.email}: {e}"))

        self.stdout.write(self.style.SUCCESS(
            f"Expiry reminder scan complete. scanned={scanned}, sent={sent}, thresholds={thresholds}, dry_run={dry_run}"
        ))
