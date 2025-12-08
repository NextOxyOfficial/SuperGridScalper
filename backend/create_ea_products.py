import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()
from core.models import EAProduct

# Create dummy EA products
products = [
    {
        'name': 'Gold Scalper Lite',
        'subtitle': 'Entry Level',
        'description': 'Perfect for beginners starting with small capital. Conservative risk management with steady returns.',
        'min_investment': 350,
        'max_investment': 1000,
        'expected_profit': '70-120%',
        'risk_level': 'Low',
        'trading_style': 'Conservative Scalping',
        'features': 'Auto Risk Management, Small Lot Sizes, Tight Stop Loss, Daily Profit Target, Beginner Friendly',
        'color': 'cyan',
        'is_popular': False,
        'display_order': 1,
        'file_name': 'GoldScalperLite.ex5'
    },
    {
        'name': 'Gold Scalper Pro',
        'subtitle': 'Most Popular',
        'description': 'Balanced approach for intermediate traders. Optimized for consistent daily profits with moderate risk.',
        'min_investment': 1000,
        'max_investment': 5000,
        'expected_profit': '100-180%',
        'risk_level': 'Medium',
        'trading_style': 'Aggressive Scalping',
        'features': 'Advanced Grid System, Dynamic Lot Sizing, Trailing Stop Loss, Recovery Mode, Multi-Timeframe Analysis',
        'color': 'yellow',
        'is_popular': True,
        'display_order': 2,
        'file_name': 'HedgeGridTrailingEA.ex5'
    },
    {
        'name': 'Gold Scalper Elite',
        'subtitle': 'High Profit',
        'description': 'Maximum profit potential for experienced traders with larger capital. Advanced AI-powered strategies.',
        'min_investment': 5000,
        'max_investment': 50000,
        'expected_profit': '150-250%',
        'risk_level': 'Medium-High',
        'trading_style': 'AI Hedge Trading',
        'features': 'Neural Network AI, Hedge Grid System, Breakeven Recovery, News Filter, VIP Support',
        'color': 'purple',
        'is_popular': False,
        'display_order': 3,
        'file_name': 'GoldScalperElite.ex5'
    },
    {
        'name': 'BTC Scalper',
        'subtitle': 'Crypto Trading',
        'description': 'Specialized EA for Bitcoin trading. Captures volatility with precision entries and smart exits.',
        'min_investment': 500,
        'max_investment': 10000,
        'expected_profit': '80-200%',
        'risk_level': 'High',
        'trading_style': 'Crypto Scalping',
        'features': 'BTC/USD Optimized, Volatility Filter, 24/5 Crypto Markets, Quick Scalps, Momentum Trading',
        'color': 'orange',
        'is_popular': False,
        'display_order': 4,
        'file_name': 'HedgeGridTrailingEA_BTC.ex5'
    }
]

for p in products:
    obj, created = EAProduct.objects.get_or_create(name=p['name'], defaults=p)
    if created:
        print(f"Created: {p['name']}")
    else:
        print(f"Already exists: {p['name']}")

print(f"\nTotal EA Products: {EAProduct.objects.count()}")
