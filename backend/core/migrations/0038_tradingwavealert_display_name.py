# Generated migration for adding display_name field to TradingWaveAlert

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0037_seed_trading_wave_alerts'),
    ]

    operations = [
        migrations.AddField(
            model_name='tradingwavealert',
            name='display_name',
            field=models.CharField(blank=True, help_text="Custom display name for this alert (e.g., 'High Impact Expecting'). If empty, uses default based on mode.", max_length=100),
        ),
    ]
