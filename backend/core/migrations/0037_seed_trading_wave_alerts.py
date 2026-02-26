from django.db import migrations


def seed_alerts(apps, schema_editor):
    TradingWaveAlert = apps.get_model('core', 'TradingWaveAlert')
    # Clear any old singleton row
    TradingWaveAlert.objects.all().delete()
    # Create 3 alert rows
    TradingWaveAlert.objects.get_or_create(mode='normal', defaults={'minutes_before': 0, 'tips': '', 'is_active': False})
    TradingWaveAlert.objects.get_or_create(mode='medium', defaults={'minutes_before': 30, 'tips': '', 'is_active': False})
    TradingWaveAlert.objects.get_or_create(mode='high', defaults={'minutes_before': 15, 'tips': '', 'is_active': False})


def reverse_seed(apps, schema_editor):
    TradingWaveAlert = apps.get_model('core', 'TradingWaveAlert')
    TradingWaveAlert.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0036_alter_tradingwavealert_options_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_alerts, reverse_seed),
    ]
