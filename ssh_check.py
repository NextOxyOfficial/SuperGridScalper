import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('148.113.201.98', username='ubuntu', password='aspirin1@A')

commands = [
    'cd /var/www/markstrades && sudo git pull origin main 2>&1',
    'cd /var/www/markstrades/backend && sudo /var/www/markstrades/backend/venv/bin/python manage.py migrate 2>&1 | tail -5',
    'cd /var/www/markstrades && pm2 restart backend 2>&1 | tail -5',
    'cd /var/www/markstrades/backend && sudo /var/www/markstrades/backend/venv/bin/python -c "import django; django.setup(); from core.admin import LicenseAdmin; print(\'admin OK\')" 2>&1',
    'cd /var/www/markstrades/backend && sudo DJANGO_SETTINGS_MODULE=config.settings /var/www/markstrades/backend/venv/bin/python manage.py shell -c "from core.models import License; print(License.objects.count()); l=License.objects.first(); print(l, l.plan, l.days_remaining())" 2>&1',
    'cd /var/www/markstrades/backend && sudo DJANGO_SETTINGS_MODULE=config.settings /var/www/markstrades/backend/venv/bin/python manage.py shell -c "from core.models import License; from core.admin import LicenseAdmin; la=LicenseAdmin(License, None); l=License.objects.first(); print(la.source_display(l)); print(la.status_display(l)); print(la.days_remaining_display(l))" 2>&1',
]

for cmd in commands:
    print(f"\n=== {cmd} ===")
    i, o, e = c.exec_command(cmd)
    out = o.read().decode()
    err = e.read().decode()
    if out.strip():
        print(out.strip())
    if err.strip():
        print(f"STDERR: {err.strip()}")

c.close()
