from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from .models import License, LicenseVerificationLog, SubscriptionPlan, EASettings, TradeData, EAActionLog
from decimal import Decimal
import json


def get_client_ip(request):
    """Get client IP address from request"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def admin_stats(request):
    """Dashboard statistics for admin"""
    return JsonResponse({
        'total_licenses': License.objects.count(),
        'active_licenses': License.objects.filter(status='active').count(),
        'total_plans': SubscriptionPlan.objects.filter(is_active=True).count(),
        'total_users': User.objects.count(),
        'expired_licenses': License.objects.filter(status='expired').count(),
    })


@csrf_exempt
@require_http_methods(["POST"])
def verify_license(request):
    """
    API endpoint for EA license verification.
    
    Expected POST data:
    {
        "license_key": "XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX",
        "mt5_account": "12345678",
        "hardware_id": "optional_hardware_identifier"
    }
    
    Response:
    {
        "valid": true/false,
        "message": "Status message",
        "expires_at": "2024-12-31T23:59:59Z",
        "days_remaining": 30,
        "plan": "Premium Monthly"
    }
    """
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({
            'valid': False,
            'message': 'Invalid request format'
        }, status=400)

    license_key = data.get('license_key', '').strip().upper()
    mt5_account = data.get('mt5_account', '').strip()
    hardware_id = data.get('hardware_id', '').strip()
    ip_address = get_client_ip(request)

    # Validate required fields
    if not license_key:
        log_verification(None, license_key, mt5_account, hardware_id, ip_address, False, 'License key is required')
        return JsonResponse({
            'valid': False,
            'message': 'License key is required'
        })

    # MT5 account is optional for web validation, required for EA

    # Find license
    try:
        license = License.objects.get(license_key=license_key)
    except License.DoesNotExist:
        log_verification(None, license_key, mt5_account, hardware_id, ip_address, False, 'Invalid license key')
        return JsonResponse({
            'valid': False,
            'message': 'Invalid license key'
        })

    # Check if license is valid
    if not license.is_valid():
        log_verification(license, license_key, mt5_account, hardware_id, ip_address, False, f'License {license.status}')
        return JsonResponse({
            'valid': False,
            'message': f'License is {license.status}',
            'status': license.status
        })

    # Check MT5 account binding (only if mt5_account provided)
    if mt5_account:
        if license.mt5_account:
            # Already bound to an account
            if license.mt5_account != mt5_account:
                log_verification(license, license_key, mt5_account, hardware_id, ip_address, False, 
                               f'License bound to different account: {license.mt5_account}')
                return JsonResponse({
                    'valid': False,
                    'message': f'License is bound to account {license.mt5_account}'
                })
        else:
            # First time - bind to this account
            license.mt5_account = mt5_account
            if hardware_id:
                license.hardware_id = hardware_id
            license.save()

    # Update verification stats
    license.last_verified = timezone.now()
    license.verification_count += 1
    license.save()

    # Log successful verification
    log_verification(license, license_key, mt5_account, hardware_id, ip_address, True, 'License verified successfully')

    return JsonResponse({
        'valid': True,
        'message': 'License verified successfully',
        'expires_at': license.expires_at.isoformat(),
        'days_remaining': license.days_remaining(),
        'plan': license.plan.name,
        'mt5_account': license.mt5_account
    })


def log_verification(license, license_key, mt5_account, hardware_id, ip_address, is_valid, message):
    """Log verification attempt"""
    LicenseVerificationLog.objects.create(
        license=license,
        license_key=license_key,
        mt5_account=mt5_account,
        hardware_id=hardware_id,
        ip_address=ip_address,
        is_valid=is_valid,
        message=message
    )


@require_http_methods(["GET"])
def api_health(request):
    """Health check endpoint"""
    return JsonResponse({
        'status': 'healthy',
        'service': 'Super Grid Scalper License Server',
        'timestamp': timezone.now().isoformat()
    })


@require_http_methods(["GET"])
def get_plans(request):
    """Get available subscription plans"""
    plans = SubscriptionPlan.objects.filter(is_active=True).values(
        'id', 'name', 'description', 'price', 'duration_days', 'max_accounts'
    )
    return JsonResponse({
        'plans': list(plans)
    })


@csrf_exempt
@require_http_methods(["POST"])
def register(request):
    """Register a new user"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid request'}, status=400)
    
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    name = data.get('name', '').strip()
    
    if not email or not password:
        return JsonResponse({'success': False, 'message': 'Email and password are required'})
    
    if len(password) < 6:
        return JsonResponse({'success': False, 'message': 'Password must be at least 6 characters'})
    
    if User.objects.filter(email=email).exists():
        return JsonResponse({'success': False, 'message': 'Email already registered'})
    
    if User.objects.filter(username=email).exists():
        return JsonResponse({'success': False, 'message': 'Email already registered'})
    
    # Create user
    user = User.objects.create_user(
        username=email,
        email=email,
        password=password,
        first_name=name
    )
    
    return JsonResponse({
        'success': True,
        'message': 'Registration successful',
        'user': {
            'id': user.id,
            'email': user.email,
            'name': user.first_name
        }
    })


@csrf_exempt
@require_http_methods(["POST"])
def register(request):
    """Register a new user"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid request'}, status=400)
    
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    first_name = data.get('first_name', '').strip()
    
    if not email or not password:
        return JsonResponse({'success': False, 'message': 'Email and password are required'})
    
    if len(password) < 6:
        return JsonResponse({'success': False, 'message': 'Password must be at least 6 characters'})
    
    # Check if user already exists
    if User.objects.filter(email=email).exists():
        return JsonResponse({'success': False, 'message': 'An account with this email already exists. Please login.'})
    
    # Create new user
    user = User.objects.create_user(
        username=email,
        email=email,
        password=password,
        first_name=first_name
    )
    
    return JsonResponse({
        'success': True,
        'message': 'Account created successfully!',
        'user': {
            'id': user.id,
            'email': user.email,
            'name': user.first_name
        },
        'licenses': []  # New user has no licenses yet
    })


@csrf_exempt
@require_http_methods(["POST"])
def login(request):
    """Login user"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid request'}, status=400)
    
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    
    if not email or not password:
        return JsonResponse({'success': False, 'message': 'Email and password are required'})
    
    user = authenticate(username=email, password=password)
    
    if user is None:
        return JsonResponse({'success': False, 'message': 'Invalid email or password'})
    
    # Get all user's licenses
    licenses = License.objects.filter(user=user).select_related('plan')
    
    if not licenses.exists():
        return JsonResponse({'success': False, 'message': 'No license found for this account'})
    
    license_list = []
    for lic in licenses:
        # Get EA settings if exists
        try:
            settings = lic.ea_settings
            ea_settings = {
                'investment_amount': float(settings.investment_amount),
                'lot_size': float(settings.lot_size),
                'max_buy_orders': settings.max_buy_orders,
                'max_sell_orders': settings.max_sell_orders,
            }
        except:
            ea_settings = None
        
        license_list.append({
            'license_key': lic.license_key,
            'plan': lic.plan.name,
            'status': lic.status,
            'activated_at': lic.activated_at.isoformat(),
            'expires_at': lic.expires_at.isoformat(),
            'days_remaining': lic.days_remaining(),
            'mt5_account': lic.mt5_account,
            'ea_settings': ea_settings
        })
    
    return JsonResponse({
        'success': True,
        'message': 'Login successful',
        'user': {
            'id': user.id,
            'email': user.email,
            'name': user.first_name
        },
        'licenses': license_list
    })


@csrf_exempt
@require_http_methods(["POST"])
def subscribe(request):
    """Subscribe to a plan and generate license"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid request'}, status=400)
    
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    plan_id = data.get('plan_id')
    mt5_account = data.get('mt5_account', '').strip()
    
    if not email or not plan_id:
        return JsonResponse({'success': False, 'message': 'Email and plan are required'})
    
    if not mt5_account:
        return JsonResponse({'success': False, 'message': 'MT5 account number is required'})
    
    # Check if this is an existing logged-in user (password = 'existing_user')
    if password == 'existing_user':
        # Get user by email (already logged in from dashboard)
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'User not found. Please login again.'})
    else:
        # Authenticate or create user (from landing page)
        user = authenticate(username=email, password=password)
        
        if user is None:
            # Check if user exists
            if User.objects.filter(email=email).exists():
                return JsonResponse({'success': False, 'message': 'Invalid password for existing account'})
            
            # Create new user
            user = User.objects.create_user(
                username=email,
                email=email,
                password=password
            )
    
    # Get plan
    try:
        plan = SubscriptionPlan.objects.get(id=plan_id, is_active=True)
    except SubscriptionPlan.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Invalid plan selected'})
    
    # Create license with MT5 account bound
    new_license = License.objects.create(
        user=user,
        plan=plan,
        mt5_account=mt5_account
    )
    
    # Get ALL user's licenses to return
    all_licenses = License.objects.filter(user=user).select_related('plan')
    license_list = []
    for lic in all_licenses:
        try:
            settings = lic.ea_settings
            ea_settings = {
                'investment_amount': float(settings.investment_amount),
                'lot_size': float(settings.lot_size),
                'max_buy_orders': settings.max_buy_orders,
                'max_sell_orders': settings.max_sell_orders,
            }
        except:
            ea_settings = None
        
        license_list.append({
            'license_key': lic.license_key,
            'plan': lic.plan.name,
            'status': lic.status,
            'activated_at': lic.activated_at.isoformat(),
            'expires_at': lic.expires_at.isoformat(),
            'days_remaining': lic.days_remaining(),
            'mt5_account': lic.mt5_account,
            'ea_settings': ea_settings
        })
    
    return JsonResponse({
        'success': True,
        'message': 'Subscription successful! Your license key has been generated.',
        'license': {
            'license_key': new_license.license_key,
            'plan': plan.name,
            'expires_at': new_license.expires_at.isoformat(),
            'days_remaining': new_license.days_remaining(),
            'mt5_account': new_license.mt5_account
        },
        'licenses': license_list,
        'user': {
            'id': user.id,
            'email': user.email,
            'name': user.first_name
        }
    })


@csrf_exempt
@require_http_methods(["POST"])
def get_ea_settings(request):
    """Get EA settings for a license"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid request'}, status=400)
    
    license_key = data.get('license_key', '').strip().upper()
    mt5_account = data.get('mt5_account', '').strip()
    
    if not license_key:
        return JsonResponse({'success': False, 'message': 'License key is required'})
    
    # Find license
    try:
        license = License.objects.get(license_key=license_key)
    except License.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Invalid license key'})
    
    # Check if license is valid
    if not license.is_valid():
        return JsonResponse({'success': False, 'message': f'License is {license.status}'})
    
    # Check MT5 account binding
    if mt5_account and license.mt5_account and license.mt5_account != mt5_account:
        return JsonResponse({'success': False, 'message': f'License bound to different account'})
    
    # Get or create EA settings
    try:
        settings = license.ea_settings
    except EASettings.DoesNotExist:
        # Create default settings
        settings = EASettings.objects.create(license=license)
    
    return JsonResponse({
        'success': True,
        'settings': {
            # BUY Grid Range
            'buy_range_start': float(settings.buy_range_start),
            'buy_range_end': float(settings.buy_range_end),
            'buy_gap_pips': float(settings.buy_gap_pips),
            'max_buy_orders': settings.max_buy_orders,
            # BUY TP/SL/Trailing
            'buy_take_profit_pips': float(settings.buy_take_profit_pips),
            'buy_stop_loss_pips': float(settings.buy_stop_loss_pips),
            'buy_trailing_start_pips': float(settings.buy_trailing_start_pips),
            'buy_initial_sl_pips': float(settings.buy_initial_sl_pips),
            'buy_trailing_ratio': float(settings.buy_trailing_ratio),
            'buy_max_sl_distance': float(settings.buy_max_sl_distance),
            'buy_trailing_step_pips': float(settings.buy_trailing_step_pips),
            # SELL Grid Range
            'sell_range_start': float(settings.sell_range_start),
            'sell_range_end': float(settings.sell_range_end),
            'sell_gap_pips': float(settings.sell_gap_pips),
            'max_sell_orders': settings.max_sell_orders,
            # SELL TP/SL/Trailing
            'sell_take_profit_pips': float(settings.sell_take_profit_pips),
            'sell_stop_loss_pips': float(settings.sell_stop_loss_pips),
            'sell_trailing_start_pips': float(settings.sell_trailing_start_pips),
            'sell_initial_sl_pips': float(settings.sell_initial_sl_pips),
            'sell_trailing_ratio': float(settings.sell_trailing_ratio),
            'sell_max_sl_distance': float(settings.sell_max_sl_distance),
            'sell_trailing_step_pips': float(settings.sell_trailing_step_pips),
            # Lot & Risk
            'investment_amount': float(settings.investment_amount),
            'lot_size': float(settings.lot_size),
            # Breakeven TP
            'enable_breakeven_tp': settings.enable_breakeven_tp,
            'breakeven_buy_tp_pips': float(settings.breakeven_buy_tp_pips),
            'breakeven_sell_tp_pips': float(settings.breakeven_sell_tp_pips),
            'manage_all_trades': settings.manage_all_trades,
            # BUY Recovery
            'enable_buy_be_recovery': settings.enable_buy_be_recovery,
            'buy_be_recovery_lot_min': float(settings.buy_be_recovery_lot_min),
            'buy_be_recovery_lot_max': float(settings.buy_be_recovery_lot_max),
            'buy_be_recovery_lot_increase': float(settings.buy_be_recovery_lot_increase),
            'max_buy_be_recovery_orders': settings.max_buy_be_recovery_orders,
            # SELL Recovery
            'enable_sell_be_recovery': settings.enable_sell_be_recovery,
            'sell_be_recovery_lot_min': float(settings.sell_be_recovery_lot_min),
            'sell_be_recovery_lot_max': float(settings.sell_be_recovery_lot_max),
            'sell_be_recovery_lot_increase': float(settings.sell_be_recovery_lot_increase),
            'max_sell_be_recovery_orders': settings.max_sell_be_recovery_orders,
        }
    })


@csrf_exempt
@require_http_methods(["POST"])
def update_trade_data(request):
    """Receive trade data from EA"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid request'}, status=400)
    
    license_key = data.get('license_key', '').strip().upper()
    
    if not license_key:
        return JsonResponse({'success': False, 'message': 'License key is required'})
    
    # Find license
    try:
        license = License.objects.get(license_key=license_key)
    except License.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Invalid license key'})
    
    # Get or create trade data record
    trade_data, created = TradeData.objects.get_or_create(license=license)
    
    # Update account info
    trade_data.account_balance = Decimal(str(data.get('account_balance', 0)))
    trade_data.account_equity = Decimal(str(data.get('account_equity', 0)))
    trade_data.account_profit = Decimal(str(data.get('account_profit', 0)))
    trade_data.account_margin = Decimal(str(data.get('account_margin', 0)))
    trade_data.account_free_margin = Decimal(str(data.get('account_free_margin', 0)))
    
    # Update position summary
    trade_data.total_buy_positions = data.get('total_buy_positions', 0)
    trade_data.total_sell_positions = data.get('total_sell_positions', 0)
    trade_data.total_buy_lots = Decimal(str(data.get('total_buy_lots', 0)))
    trade_data.total_sell_lots = Decimal(str(data.get('total_sell_lots', 0)))
    trade_data.total_buy_profit = Decimal(str(data.get('total_buy_profit', 0)))
    trade_data.total_sell_profit = Decimal(str(data.get('total_sell_profit', 0)))
    
    # Update symbol info
    trade_data.symbol = data.get('symbol', '')
    trade_data.current_price = Decimal(str(data.get('current_price', 0)))
    
    # Update open positions
    trade_data.open_positions = data.get('open_positions', [])
    
    trade_data.save()
    
    return JsonResponse({'success': True, 'message': 'Trade data updated'})


@csrf_exempt
@require_http_methods(["POST", "GET"])
def get_trade_data(request):
    """Get trade data for a license (for web dashboard)"""
    if request.method == "GET":
        license_key = request.GET.get('license_key', '').strip().upper()
    else:
        try:
            data = json.loads(request.body)
            license_key = data.get('license_key', '').strip().upper()
        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'message': 'Invalid request'}, status=400)
    
    if not license_key:
        return JsonResponse({'success': False, 'message': 'License key is required'})
    
    # Find license
    try:
        license = License.objects.get(license_key=license_key)
    except License.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Invalid license key'})
    
    # Get trade data
    try:
        trade_data = TradeData.objects.get(license=license)
        return JsonResponse({
            'success': True,
            'data': {
                'account_balance': float(trade_data.account_balance),
                'account_equity': float(trade_data.account_equity),
                'account_profit': float(trade_data.account_profit),
                'account_margin': float(trade_data.account_margin),
                'account_free_margin': float(trade_data.account_free_margin),
                'total_buy_positions': trade_data.total_buy_positions,
                'total_sell_positions': trade_data.total_sell_positions,
                'total_buy_lots': float(trade_data.total_buy_lots),
                'total_sell_lots': float(trade_data.total_sell_lots),
                'total_buy_profit': float(trade_data.total_buy_profit),
                'total_sell_profit': float(trade_data.total_sell_profit),
                'symbol': trade_data.symbol,
                'current_price': float(trade_data.current_price),
                'open_positions': trade_data.open_positions,
                'last_update': trade_data.last_update.isoformat(),
            }
        })
    except TradeData.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'No trade data available'})


@csrf_exempt
@require_http_methods(["POST"])
def update_investment(request):
    """Update investment amount and calculate EA settings based on default template"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid request'}, status=400)
    
    license_key = data.get('license_key', '').strip().upper()
    investment = Decimal(str(data.get('investment_amount', 100)))
    
    if not license_key:
        return JsonResponse({'success': False, 'message': 'License key is required'})
    
    if investment < 100:
        return JsonResponse({'success': False, 'message': 'Minimum investment is $100'})
    
    try:
        license = License.objects.get(license_key=license_key)
    except License.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Invalid license key'})
    
    # Get or create settings
    settings, created = EASettings.objects.get_or_create(license=license)
    
    # Save investment amount
    settings.investment_amount = investment
    
    # Apply defaults from template and recalculate lot sizes
    if created:
        settings.apply_defaults_from_template()
    else:
        settings.recalculate_lots()
    
    settings.save()
    
    return JsonResponse({
        'success': True,
        'message': 'Investment settings updated',
        'settings': {
            'investment_amount': float(settings.investment_amount),
            'lot_size': float(settings.lot_size),
            'buy_be_recovery_lot_min': float(settings.buy_be_recovery_lot_min),
            'sell_be_recovery_lot_min': float(settings.sell_be_recovery_lot_min),
            'max_buy_orders': settings.max_buy_orders,
            'max_sell_orders': settings.max_sell_orders,
            'max_buy_be_recovery_orders': settings.max_buy_be_recovery_orders,
            'max_sell_be_recovery_orders': settings.max_sell_be_recovery_orders,
        }
    })


@csrf_exempt
@require_http_methods(["POST"])
def add_action_log(request):
    """Add action log from EA"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid request'}, status=400)
    
    license_key = data.get('license_key', '').strip().upper()
    log_type = data.get('log_type', 'INFO')
    message = data.get('message', '')
    details = data.get('details', {})
    
    if not license_key or not message:
        return JsonResponse({'success': False, 'message': 'License key and message required'})
    
    try:
        license = License.objects.get(license_key=license_key)
    except License.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Invalid license'})
    
    # Create log entry
    EAActionLog.objects.create(
        license=license,
        log_type=log_type,
        message=message,
        details=details
    )
    
    # Keep only last 200 logs per license
    old_logs = EAActionLog.objects.filter(license=license).order_by('-created_at')[200:]
    if old_logs.exists():
        EAActionLog.objects.filter(id__in=[log.id for log in old_logs]).delete()
    
    return JsonResponse({'success': True})


@csrf_exempt
@require_http_methods(["GET"])
def get_action_logs(request):
    """Get action logs for a license"""
    license_key = request.GET.get('license_key', '').strip().upper()
    limit = int(request.GET.get('limit', 50))
    
    if not license_key:
        return JsonResponse({'success': False, 'message': 'License key required'})
    
    try:
        license = License.objects.get(license_key=license_key)
    except License.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Invalid license'})
    
    logs = EAActionLog.objects.filter(license=license).order_by('-created_at')[:limit]
    
    log_list = []
    for log in reversed(logs):  # Reverse to get oldest first
        log_list.append({
            'type': log.log_type,
            'message': log.message,
            'details': log.details,
            'time': log.created_at.strftime('%H:%M:%S')
        })
    
    return JsonResponse({
        'success': True,
        'logs': log_list
    })
