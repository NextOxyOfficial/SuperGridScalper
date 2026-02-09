from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.conf import settings as django_settings
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.db.models import Count
from .models import SubscriptionPlan, License, LicenseMT5Account, LicenseVerificationLog, EASettings, TradeData, EAActionLog, EAProduct, Referral, ReferralAttribution, ReferralTransaction, ReferralPayout, TradeCommand, SiteSettings, PaymentNetwork, LicensePurchaseRequest
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


def resolve_user(identifier: str):
    ident = (identifier or '').strip()
    if not ident:
        return None

    email_qs = User.objects.filter(email__iexact=ident)
    username_qs = User.objects.filter(username__iexact=ident).exclude(id__in=email_qs.values('id'))
    ids = list(email_qs.values_list('id', flat=True)) + list(username_qs.values_list('id', flat=True))
    if not ids:
        return None

    # Prefer the user record that actually has licenses (handles duplicate emails / legacy data)
    return (
        User.objects.filter(id__in=ids)
        .annotate(license_count=Count('licenses'))
        .order_by('-license_count', '-id')
        .first()
    )


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
    mt5_account = str(data.get('mt5_account', '') or '').strip()
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
        # Backward compatibility: if old single-binding exists, migrate it into bindings table
        if license.mt5_account:
            LicenseMT5Account.objects.get_or_create(
                license=license,
                mt5_account=license.mt5_account,
                defaults={
                    'hardware_id': license.hardware_id or None,
                    'last_seen': timezone.now(),
                },
            )

        # Enforce max_accounts per plan
        current_accounts_count = LicenseMT5Account.objects.filter(license=license).count()
        binding = LicenseMT5Account.objects.filter(license=license, mt5_account=mt5_account).first()

        if not binding:
            if current_accounts_count >= (license.plan.max_accounts or 1):
                log_verification(
                    license,
                    license_key,
                    mt5_account,
                    hardware_id,
                    ip_address,
                    False,
                    f'Max accounts reached ({license.plan.max_accounts})'
                )
                return JsonResponse({
                    'valid': False,
                    'message': f'Max accounts reached for this plan ({license.plan.max_accounts})'
                })

            binding = LicenseMT5Account.objects.create(
                license=license,
                mt5_account=mt5_account,
                hardware_id=hardware_id or None,
                last_seen=timezone.now(),
            )
        else:
            update_fields = []
            binding.last_seen = timezone.now()
            update_fields.append('last_seen')
            if hardware_id and not binding.hardware_id:
                binding.hardware_id = hardware_id
                update_fields.append('hardware_id')
            if update_fields:
                binding.save(update_fields=update_fields)

        # Preserve old field for compatibility with existing admin/UI code
        if not license.mt5_account:
            license.mt5_account = mt5_account
            if hardware_id and not license.hardware_id:
                license.hardware_id = hardware_id
            license.save(update_fields=['mt5_account', 'hardware_id', 'updated_at'])

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
        'mt5_account': mt5_account or license.mt5_account
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
    plans_list = list(plans)
    # Convert Decimal to float for JSON serialization
    for plan in plans_list:
        plan['price'] = float(plan['price'])
    return JsonResponse({
        'success': True,
        'plans': plans_list
    })


@csrf_exempt
@require_http_methods(["GET"])
def get_payment_networks(request):
    networks = PaymentNetwork.objects.filter(is_active=True).order_by('sort_order', 'name')
    return JsonResponse({
        'success': True,
        'networks': [
            {
                'id': n.id,
                'name': n.name,
                'code': n.code,
                'token_symbol': n.token_symbol,
                'wallet_address': n.wallet_address,
            }
            for n in networks
        ]
    })


@csrf_exempt
@require_http_methods(["POST"])
def create_license_purchase_request(request):
    """Create a manual payment request with proof upload."""
    email = (request.POST.get('email') or '').strip()
    referral_code = (request.POST.get('referral_code') or '').strip()
    plan_id = (request.POST.get('plan_id') or '').strip()
    network_id = (request.POST.get('network_id') or '').strip()
    mt5_account = (request.POST.get('mt5_account') or '').strip()
    txid = (request.POST.get('txid') or '').strip()
    user_note = (request.POST.get('user_note') or '').strip()
    proof = request.FILES.get('proof')

    if not email or not plan_id or not network_id:
        return JsonResponse({'success': False, 'message': 'Email, plan, and network are required'}, status=400)

    if not proof:
        return JsonResponse({'success': False, 'message': 'Payment proof file is required'}, status=400)

    user = resolve_user(email)
    if not user:
        return JsonResponse({'success': False, 'message': 'User not found'}, status=404)

    if referral_code:
        try:
            referral = Referral.objects.get(referral_code=referral_code)
            ReferralAttribution.objects.get_or_create(referral=referral, referred_user=user)
        except Exception:
            pass

    try:
        plan = SubscriptionPlan.objects.get(id=plan_id, is_active=True)
    except SubscriptionPlan.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Invalid plan selected'}, status=400)

    try:
        network = PaymentNetwork.objects.get(id=network_id, is_active=True)
    except PaymentNetwork.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Invalid payment network selected'}, status=400)

    purchase = LicensePurchaseRequest.objects.create(
        user=user,
        plan=plan,
        mt5_account=mt5_account or None,
        network=network,
        amount_usd=plan.price,
        txid=txid,
        proof=proof,
        user_note=user_note,
        status='pending',
    )

    try:
        from core.utils import send_admin_notification
        send_admin_notification(
            subject=f'Admin Alert: New Payment Proof Submitted (#{purchase.id})',
            heading='New License Purchase Request',
            html_body=(
                f"<p><strong>User:</strong> {user.email}</p>"
                f"<p><strong>Name:</strong> {user.first_name or '-'} </p>"
                f"<p><strong>Plan:</strong> {plan.name}</p>"
                f"<p><strong>Amount:</strong> ${float(plan.price)} {network.token_symbol}</p>"
                f"<p><strong>Network:</strong> {network.name}</p>"
                f"<p><strong>MT5 Account:</strong> {purchase.mt5_account or '-'}</p>"
                f"<p><strong>TXID:</strong> {purchase.txid or '-'}</p>"
                f"<p><strong>Status:</strong> PENDING</p>"
            ),
            text_body=(
                f"New purchase request\n"
                f"User: {user.email}\n"
                f"Plan: {plan.name}\n"
                f"Amount: ${float(plan.price)} {network.token_symbol}\n"
                f"Network: {network.name}\n"
                f"MT5 Account: {purchase.mt5_account or '-'}\n"
                f"TXID: {purchase.txid or '-'}\n"
                f"Request ID: #{purchase.id}\n"
                f"Status: pending"
            ),
            preheader=f'New payment proof submitted by {user.email} for {plan.name}'
        )
    except Exception:
        pass

    try:
        from core.utils import get_email_from_address, render_email_template, can_send_email_to_user, get_unsubscribe_url
        from django.core.mail import EmailMultiAlternatives
        
        base = (getattr(django_settings, 'FRONTEND_URL', '') or '').rstrip('/')
        subject = '✓ Payment Proof Submitted - Verification & Activation in Progress'
        
        # Plain text version
        text_message = (
            f"Hi {user.first_name or 'Trader'},\n\n"
            "We received your payment proof and your request is now pending verification.\n\n"
            f"Request ID: #{purchase.id}\n"
            f"Plan: {plan.name}\n"
            f"Amount: ${plan.price} {network.token_symbol}\n"
            f"Network: {network.name}\n"
            f"MT5 Account: {purchase.mt5_account or '-'}\n"
            f"TXID: {purchase.txid or '-'}\n\n"
            "Next step: our team will verify your payment and activate your license.\n"
            f"You can track status in your dashboard: {base}/dashboard\n\n"
            "If you did not submit this request, please contact support immediately."
        )

        if not can_send_email_to_user(user, 'transactional'):
            raise Exception('User opted out of transactional emails')
        
        # HTML version
        html_message = render_email_template(
            subject=subject,
            heading='Payment Proof Received',
            message=f"""
                <p>Hi <strong>{user.first_name or 'Trader'}</strong>,</p>
                <p>We received your payment proof and your request is now <strong style="color: #fbbf24;">pending verification</strong>.</p>
                
                <div style="background-color: rgba(6, 182, 212, 0.1); border-left: 3px solid #06b6d4; padding: 16px; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 0 0 8px 0; color: #06b6d4; font-weight: 600;">Request Details:</p>
                    <p style="margin: 4px 0; color: #d1d5db;"><strong>Request ID:</strong> #{purchase.id}</p>
                    <p style="margin: 4px 0; color: #d1d5db;"><strong>Plan:</strong> {plan.name}</p>
                    <p style="margin: 4px 0; color: #d1d5db;"><strong>Amount:</strong> ${plan.price} {network.token_symbol}</p>
                    <p style="margin: 4px 0; color: #d1d5db;"><strong>Network:</strong> {network.name}</p>
                    <p style="margin: 4px 0; color: #d1d5db;"><strong>MT5 Account:</strong> {purchase.mt5_account or '-'}</p>
                    <p style="margin: 4px 0; color: #d1d5db;"><strong>TXID:</strong> {purchase.txid or '-'}</p>
                </div>
                
                <p><strong>Next step:</strong> Our team will verify your payment and activate your license. You'll receive an email notification once approved.</p>
            """,
            cta_text='TRACK STATUS',
            cta_url=f'{base}/dashboard',
            footer_note='If you did not submit this request, please contact support immediately.',
            preheader=f'Payment proof received for {plan.name}. Request #{purchase.id} is pending verification.',
            unsubscribe_url=get_unsubscribe_url(user)
        )
        
        from core.utils import add_email_headers
        
        msg = EmailMultiAlternatives(
            subject,
            text_message,
            get_email_from_address(),
            [user.email]
        )
        msg.attach_alternative(html_message, "text/html")
        msg = add_email_headers(msg, 'transactional', user=user)
        msg.send(fail_silently=False)
    except Exception as e:
        print(f"Payment proof email error: {e}")

    proof_url = None
    if purchase.proof:
        try:
            proof_url = request.build_absolute_uri(purchase.proof.url)
        except Exception:
            proof_url = None

    return JsonResponse({
        'success': True,
        'message': '✓ Payment proof submitted successfully! Your request is now pending verification.',
        'title': 'Submission Successful',
        'status': 'pending',
        'request': {
            'id': purchase.id,
            'request_number': purchase.request_number,
            'status': purchase.status,
            'status_label': 'Pending Verification',
            'status_color': 'yellow',
            'created_at': purchase.created_at.isoformat(),
            'plan': {
                'name': purchase.plan.name,
                'price': float(purchase.amount_usd),
            },
            'payment': {
                'network': purchase.network.name,
                'wallet_address': purchase.network.wallet_address,
                'token_symbol': purchase.network.token_symbol,
                'txid': purchase.txid,
                'proof_url': proof_url,
            },
            'mt5_account': purchase.mt5_account,
        },
        'next_steps': [
            'Our team will verify your payment within 24 hours',
            'You will receive an email notification once approved',
            'Your license will be activated automatically after approval',
            'Track your request status in the dashboard'
        ]
    })


@csrf_exempt
@require_http_methods(["POST"])
def list_license_purchase_requests(request):
    """List purchase requests for a user."""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid request'}, status=400)

    email = (data.get('email') or '').strip()
    if not email:
        return JsonResponse({'success': False, 'message': 'Email is required'}, status=400)

    user = resolve_user(email)
    if not user:
        return JsonResponse({'success': False, 'message': 'User not found'}, status=404)

    qs = LicensePurchaseRequest.objects.filter(user=user).select_related('plan', 'network', 'issued_license')
    items = []
    for pr in qs:
        proof_url = None
        if pr.proof:
            try:
                proof_url = request.build_absolute_uri(pr.proof.url)
            except Exception:
                proof_url = None

        items.append({
            'id': pr.id,
            'request_number': pr.request_number,
            'status': pr.status,
            'created_at': pr.created_at.isoformat(),
            'reviewed_at': pr.reviewed_at.isoformat() if pr.reviewed_at else None,
            'plan': pr.plan.name,
            'plan_id': pr.plan.id,
            'amount_usd': float(pr.amount_usd),
            'network': {
                'id': pr.network.id,
                'name': pr.network.name,
                'code': pr.network.code,
                'token_symbol': pr.network.token_symbol,
                'wallet_address': pr.network.wallet_address,
            },
            'mt5_account': pr.mt5_account,
            'txid': pr.txid,
            'user_note': pr.user_note,
            'admin_note': pr.admin_note,
            'proof_url': proof_url,
            'issued_license_key': pr.issued_license.license_key if pr.issued_license else None,
        })

    return JsonResponse({'success': True, 'requests': items})


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
    referral_code = data.get('referral_code', '').strip()
    
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

    try:
        from core.utils import send_admin_notification
        send_admin_notification(
            subject='Admin Alert: New User Registration',
            heading='New User Registered',
            html_body=(
                f"<p><strong>Email:</strong> {user.email}</p>"
                f"<p><strong>Name:</strong> {user.first_name or '-'}</p>"
                f"<p><strong>Time:</strong> {timezone.now().isoformat()}</p>"
            ),
            text_body=(
                f"New user registered\n"
                f"Email: {user.email}\n"
                f"Name: {user.first_name or '-'}\n"
                f"Time: {timezone.now().isoformat()}"
            ),
            preheader=f'New registration: {user.email}'
        )
    except Exception:
        pass

    try:
        from core.models import EmailPreference
        EmailPreference.objects.get_or_create(user=user)
    except Exception:
        pass
    
    # Track referral signup
    if referral_code:
        try:
            referral = Referral.objects.get(referral_code=referral_code)
            referral.signups += 1
            referral.save()

            try:
                ReferralAttribution.objects.get_or_create(referral=referral, referred_user=user)
            except Exception:
                pass
        except Referral.DoesNotExist:
            pass  # Invalid referral code, just ignore

    try:
        from core.utils import get_email_from_address, render_email_template, add_email_headers, can_send_email_to_user, get_unsubscribe_url
        from django.core.mail import EmailMultiAlternatives
        
        base = (getattr(django_settings, 'FRONTEND_URL', '') or '').rstrip('/')
        subject = 'Welcome to MarksTrades'
        
        # Plain text version
        text_message = (
            f"Hi {user.first_name or 'Trader'},\n\n"
            "Welcome! Your account has been created successfully.\n\n"
            f"Login here: {base}/?auth=login\n\n"
            "If you need help, reply to this email or contact support."
        )
        
        if not can_send_email_to_user(user, 'transactional'):
            raise Exception('User opted out of transactional emails')

        # HTML version
        html_message = render_email_template(
            subject=subject,
            heading='Welcome to MarksTrades!',
            message=f"""
                <p>Hi <strong>{user.first_name or 'Trader'}</strong>,</p>
                <p>Welcome! Your account has been created successfully.</p>
                <p>You can now access your dashboard and start your trading journey with our AI-powered Expert Advisor.</p>
            """,
            cta_text='LOGIN TO DASHBOARD',
            cta_url=f'{base}/?auth=login',
            footer_note='If you did not create this account, please contact support immediately.',
            preheader='Your MarksTrades account is ready. Login to access your dashboard.',
            unsubscribe_url=get_unsubscribe_url(user)
        )

        msg = EmailMultiAlternatives(
            subject,
            text_message,
            get_email_from_address(),
            [user.email]
        )
        msg.attach_alternative(html_message, "text/html")
        msg = add_email_headers(msg, 'transactional', user=user)
        msg.send(fail_silently=False)
    except Exception as e:
        print(f"Welcome email error: {e}")
    
    return JsonResponse({
        'success': True,
        'message': 'Registration successful',
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
    
    # Get all user's licenses with EA settings
    licenses = (
        License.objects.filter(user=user)
        .select_related('plan')
        .prefetch_related('ea_settings', 'mt5_accounts')
    )
    
    # Allow login even without license - user needs to login to purchase license
    license_list = []
    for lic in licenses:
        # Get EA settings (BTCUSD preferred, or any)
        settings = lic.ea_settings.filter(symbol='BTCUSD').first() or lic.ea_settings.first()
        if settings:
            ea_settings = {
                'symbol': settings.symbol,
                'max_buy_orders': settings.max_buy_orders,
                'max_sell_orders': settings.max_sell_orders,
                'buy_range_start': float(settings.buy_range_start),
                'buy_range_end': float(settings.buy_range_end),
                'sell_range_start': float(settings.sell_range_start),
                'sell_range_end': float(settings.sell_range_end),
            }
        else:
            ea_settings = None
        
        license_list.append({
            'license_key': lic.license_key,
            'plan': lic.plan.name,
            'status': lic.status,
            'activated_at': lic.activated_at.isoformat(),
            'expires_at': lic.expires_at.isoformat(),
            'days_remaining': lic.days_remaining(),
            'mt5_account': lic.mt5_account,
            'mt5_accounts': [a.mt5_account for a in lic.mt5_accounts.all().order_by('created_at')],
            'max_accounts': lic.plan.max_accounts,
            'ea_settings': ea_settings
        })
    
    return JsonResponse({
        'success': True,
        'message': 'Login successful',
        'user': {
            'id': user.id,
            'email': user.email or user.username,
            'username': user.username,
            'name': user.first_name
        },
        'licenses': license_list
    })


@csrf_exempt
@require_http_methods(["POST"])
def password_reset_request(request):
    """Request a password reset email."""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid request'}, status=400)

    email = (data.get('email') or '').strip().lower()
    if not email:
        return JsonResponse({'success': False, 'message': 'Email is required'}, status=400)

    # Do not reveal whether user exists.
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        user = None

    if user and user.is_active:
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        base = (getattr(django_settings, 'FRONTEND_URL', '') or '').rstrip('/')
        reset_url = f"{base}/reset-password?uid={uid}&token={token}"

        subject = 'Password Reset Request'
        message = (
            'You requested a password reset.\n\n'
            f"Reset your password using this link:\n{reset_url}\n\n"
            'If you did not request this, you can safely ignore this email.'
        )
        try:
            send_mail(
                subject,
                message,
                getattr(django_settings, 'DEFAULT_FROM_EMAIL', None),
                [email],
                fail_silently=False,
            )
        except Exception:
            # Don't leak SMTP errors to client.
            pass

    return JsonResponse({
        'success': True,
        'message': 'If an account exists for this email, a reset link has been sent.'
    })


@csrf_exempt
@require_http_methods(["POST"])
def password_reset_confirm(request):
    """Confirm password reset using uid + token."""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid request'}, status=400)

    uid = (data.get('uid') or '').strip()
    token = (data.get('token') or '').strip()
    new_password = data.get('new_password') or ''

    if not uid or not token or not new_password:
        return JsonResponse({'success': False, 'message': 'Missing required fields'}, status=400)

    if len(new_password) < 6:
        return JsonResponse({'success': False, 'message': 'Password must be at least 6 characters'}, status=400)

    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id)
    except Exception:
        return JsonResponse({'success': False, 'message': 'Invalid reset link'}, status=400)

    if not default_token_generator.check_token(user, token):
        return JsonResponse({'success': False, 'message': 'Invalid or expired reset link'}, status=400)

    user.set_password(new_password)
    user.save(update_fields=['password'])

    return JsonResponse({
        'success': True,
        'message': 'Password has been reset successfully'
    })


@csrf_exempt
@require_http_methods(["POST"])
def get_licenses(request):
    """Get all licenses for a user with fresh EA settings"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid request'}, status=400)
    
    email = data.get('email', '').strip()
    
    if not email:
        return JsonResponse({'success': False, 'message': 'Email is required'})
    
    user = resolve_user(email)
    if not user:
        return JsonResponse({'success': False, 'message': 'User not found'})
    
    # Get all user's licenses with EA settings
    licenses = License.objects.filter(user=user).select_related('plan').prefetch_related('ea_settings')
    
    license_list = []
    for lic in licenses:
        # Get EA settings (BTCUSD preferred, or any)
        settings = lic.ea_settings.filter(symbol='BTCUSD').first() or lic.ea_settings.first()
        if settings:
            ea_settings = {
                'symbol': settings.symbol,
                'max_buy_orders': settings.max_buy_orders,
                'max_sell_orders': settings.max_sell_orders,
                'buy_range_start': float(settings.buy_range_start),
                'buy_range_end': float(settings.buy_range_end),
                'sell_range_start': float(settings.sell_range_start),
                'sell_range_end': float(settings.sell_range_end),
            }
        else:
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
    
    email = data.get('email', '').strip()
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
        user = resolve_user(email)
        if not user:
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

    # Create initial binding entry for multi-account support
    LicenseMT5Account.objects.get_or_create(
        license=new_license,
        mt5_account=mt5_account,
        defaults={'last_seen': timezone.now()},
    )
    
    # Track referral purchase and commission (if user is attributed to a referrer)
    try:
        attribution = ReferralAttribution.objects.select_related('referral').filter(referred_user=user).first()
        if attribution and attribution.referral and attribution.referral.is_active and attribution.referral.referrer_id != user.id:
            referral = attribution.referral
            commission_amount = (plan.price * referral.commission_percent) / Decimal('100')

            ReferralTransaction.objects.create(
                referral=referral,
                referred_user=user,
                purchase_amount=plan.price,
                commission_amount=commission_amount,
                status='pending'
            )

            referral.purchases += 1
            referral.total_earnings += commission_amount
            referral.pending_earnings += commission_amount
            referral.save()
    except Exception as e:
        # Don't fail the purchase if referral tracking fails
        print(f"Referral tracking error: {e}")
    
    # Get ALL user's licenses to return
    all_licenses = (
        License.objects.filter(user=user)
        .select_related('plan')
        .prefetch_related('ea_settings', 'mt5_accounts')
    )
    license_list = []
    for lic in all_licenses:
        # Get the first EA settings (BTCUSD preferred, or any)
        settings = lic.ea_settings.filter(symbol='BTCUSD').first() or lic.ea_settings.first()
        if settings:
            ea_settings = {
                'symbol': settings.symbol,
                'max_buy_orders': settings.max_buy_orders,
                'max_sell_orders': settings.max_sell_orders,
                'buy_range_start': float(settings.buy_range_start),
                'buy_range_end': float(settings.buy_range_end),
                'sell_range_start': float(settings.sell_range_start),
                'sell_range_end': float(settings.sell_range_end),
            }
        else:
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
            'mt5_account': new_license.mt5_account,
            'mt5_accounts': [mt5_account],
            'max_accounts': plan.max_accounts,
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
def extend_license(request):
    """Extend an existing license by adding days from a new plan"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid request'}, status=400)
    
    license_key = data.get('license_key', '').strip().upper()
    plan_id = data.get('plan_id')
    
    if not license_key or not plan_id:
        return JsonResponse({'success': False, 'message': 'License key and plan are required'}, status=400)
    
    # Get the license - try both exact match and case-insensitive
    try:
        license_obj = License.objects.get(license_key=license_key)
    except License.DoesNotExist:
        # Try case-insensitive search
        try:
            license_obj = License.objects.get(license_key__iexact=license_key)
        except License.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'Invalid license key'}, status=404)
    
    # Get the plan
    try:
        plan = SubscriptionPlan.objects.get(id=plan_id, is_active=True)
    except SubscriptionPlan.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Invalid plan selected'}, status=404)
    
    # Extend the license
    from datetime import timedelta
    from django.utils import timezone
    
    # If license is expired, start from today, otherwise extend from current expiry
    if license_obj.expires_at < timezone.now():
        license_obj.expires_at = timezone.now() + timedelta(days=plan.duration_days)
    else:
        license_obj.expires_at = license_obj.expires_at + timedelta(days=plan.duration_days)
    
    license_obj.status = 'active'
    license_obj.save()
    
    return JsonResponse({
        'success': True,
        'message': f'License extended successfully! Added {plan.duration_days} days.',
        'license': {
            'license_key': license_obj.license_key,
            'plan': license_obj.plan.name,
            'status': license_obj.status,
            'expires_at': license_obj.expires_at.isoformat(),
            'days_remaining': license_obj.days_remaining(),
            'mt5_account': license_obj.mt5_account
        }
    })


@csrf_exempt
@require_http_methods(["POST"])
def get_ea_settings(request):
    """Get EA settings for a license and symbol"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid request'}, status=400)
    
    license_key = data.get('license_key', '').strip().upper()
    mt5_account = data.get('mt5_account', '').strip()
    symbol = data.get('symbol', 'XAUUSD').strip().upper()  # Default to XAUUSD
    
    # Normalize symbol name (handle variations like GOLD, BITCOIN)
    if 'XAU' in symbol or 'GOLD' in symbol:
        symbol = 'XAUUSD'
    elif 'BTC' in symbol or 'BITCOIN' in symbol:
        symbol = 'BTCUSD'
    
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
    
    # Get or create EA settings for this symbol
    settings, created = EASettings.objects.get_or_create(
        license=license,
        symbol=symbol,
        defaults={}
    )
    
    # If newly created, apply symbol-specific defaults
    if created:
        settings.apply_symbol_defaults()
        settings.save()
        print(f"Created new EASettings for {symbol} with defaults: Gap={settings.buy_gap_pips}, Range={settings.buy_range_end}-{settings.buy_range_start}")
    
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
            # Lot size is now calculated dynamically by EA based on account balance
            # Breakeven Trailing
            'enable_breakeven_trailing': settings.enable_breakeven_trailing,
            'breakeven_buy_trailing_pips': float(settings.breakeven_buy_trailing_pips),
            'breakeven_sell_trailing_pips': float(settings.breakeven_sell_trailing_pips),
            'breakeven_trailing_start_pips': float(settings.breakeven_trailing_start_pips),
            'breakeven_initial_sl_pips': float(settings.breakeven_initial_sl_pips),
            'breakeven_trailing_ratio': float(settings.breakeven_trailing_ratio),
            'breakeven_max_sl_distance': float(settings.breakeven_max_sl_distance),
            'breakeven_trailing_step_pips': float(settings.breakeven_trailing_step_pips),
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
    
    # Update open positions and pending orders
    trade_data.open_positions = data.get('open_positions', [])
    trade_data.pending_orders = data.get('pending_orders', [])
    trade_data.total_pending_orders = data.get('total_pending_orders', 0)
    trade_data.trading_mode = data.get('trading_mode', 'Normal')
    
    # Update closed positions (keep last 1000, remove older)
    new_closed = data.get('closed_positions', [])
    if new_closed:
        existing_closed = trade_data.closed_positions or []
        # Merge and keep unique by ticket
        all_closed = {p.get('ticket'): p for p in existing_closed}
        for p in new_closed:
            all_closed[p.get('ticket')] = p
        # Sort by close_time descending and keep only last 1000
        sorted_closed = sorted(all_closed.values(), key=lambda x: x.get('close_time', ''), reverse=True)
        trade_data.closed_positions = sorted_closed[:1000]
    
    # Update last_update timestamp
    from django.utils import timezone
    trade_data.last_update = timezone.now()
    
    trade_data.save()
    
    return JsonResponse({'success': True, 'message': 'Trade data updated'})


@csrf_exempt
@require_http_methods(["POST", "GET"])
def get_trade_data(request):
    """Get trade data for a license (for web dashboard)"""
    if request.method == "GET":
        license_key = request.GET.get('license_key', '').strip().upper()
        mt5_account = (request.GET.get('mt5_account', '') or '').strip()
    else:
        try:
            data = json.loads(request.body)
            license_key = data.get('license_key', '').strip().upper()
            mt5_account = (data.get('mt5_account', '') or '').strip()
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
        if not mt5_account:
            mt5_account = license.mt5_account or ''
        trade_data = TradeData.objects.get(license=license, mt5_account=mt5_account)
        return JsonResponse({
            'success': True,
            'data': {
                'mt5_account': mt5_account,
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
                'total_pending_orders': getattr(trade_data, 'total_pending_orders', 0),
                'trading_mode': getattr(trade_data, 'trading_mode', 'Normal'),
                'symbol': trade_data.symbol,
                'current_price': float(trade_data.current_price),
                'open_positions': trade_data.open_positions,
                'pending_orders': getattr(trade_data, 'pending_orders', []),
                'closed_positions': getattr(trade_data, 'closed_positions', []),
                'last_update': trade_data.last_update.isoformat(),
            }
        })
    except TradeData.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'No trade data available'})


@csrf_exempt
@require_http_methods(["POST"])
def update_investment(request):
    """DEPRECATED: Investment amount is no longer used. EA calculates lot size from account balance."""
    return JsonResponse({
        'success': False,
        'message': 'This endpoint is deprecated. EA now calculates lot size from account balance automatically.'
    })


@csrf_exempt
@require_http_methods(["POST"])
def add_action_log(request):
    """Add action log from EA (supports both single and batch logs)"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid request'}, status=400)
    
    license_key = data.get('license_key', '').strip().upper()
    
    if not license_key:
        return JsonResponse({'success': False, 'message': 'License key required'})
    
    try:
        license = License.objects.get(license_key=license_key)
    except License.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Invalid license'})
    
    # Support batch logs (new format from EA)
    logs = data.get('logs', [])
    if logs:
        # Batch insert for better performance
        log_objects = []
        for log_data in logs:
            log_objects.append(EAActionLog(
                license=license,
                log_type=log_data.get('log_type', 'INFO'),
                message=log_data.get('message', ''),
                details=log_data.get('details', {})
            ))
        
        if log_objects:
            EAActionLog.objects.bulk_create(log_objects)
    else:
        # Backward compatibility: single log format
        log_type = data.get('log_type', 'INFO')
        message = data.get('message', '')
        details = data.get('details', {})
        
        if not message:
            return JsonResponse({'success': False, 'message': 'Message required'})
        
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


@csrf_exempt
@require_http_methods(["GET"])
def get_ea_products(request):
    """Get all active EA products for the store"""
    products = EAProduct.objects.filter(is_active=True).order_by('display_order', 'min_investment')
    
    product_list = []
    for p in products:
        # Determine a safe download filename
        file_name = p.file_name
        if not file_name:
            if p.ea_file:
                # Use only the filename portion from the stored path
                try:
                    file_name = p.ea_file.name.split('/')[-1]
                except Exception:
                    file_name = None
            if not file_name:
                file_name = f"{p.name.replace(' ', '')}.ex5"

        download_url = (p.external_download_url or '').strip() or None

        product_list.append({
            'id': p.id,
            'name': p.name,
            'subtitle': p.subtitle,
            'description': p.description,
            'min_investment': float(p.min_investment),
            'max_investment': float(p.max_investment),
            'expected_profit': p.expected_profit,
            'risk_level': p.risk_level,
            'trading_style': p.trading_style,
            'features': p.get_features_list(),
            'color': p.color,
            'is_popular': p.is_popular,
            'file_name': file_name,
            'has_file': bool(download_url),
            'download_url': download_url,
        })
    
    return JsonResponse({
        'success': True,
        'products': product_list
    })


# ==================== REFERRAL SYSTEM ====================

@csrf_exempt
@require_http_methods(["POST"])
def create_referral(request):
    """Create or get referral code for a user"""
    try:
        data = json.loads(request.body)
        username = data.get('username')
        email = data.get('email')
        
        if not username and not email:
            return JsonResponse({'success': False, 'message': 'Username or email required'}, status=400)
        
        user = resolve_user(username or email)
        if not user:
            return JsonResponse({'success': False, 'message': 'User not found'}, status=404)
        
        # Get or create referral
        referral, created = Referral.objects.get_or_create(
            referrer=user,
            defaults={'commission_percent': Decimal('10.00')}
        )
        
        return JsonResponse({
            'success': True,
            'referral_code': referral.referral_code,
            'commission_percent': float(referral.commission_percent),
            'total_earnings': float(referral.total_earnings),
            'pending_earnings': float(referral.pending_earnings),
            'paid_earnings': float(referral.paid_earnings),
            'clicks': referral.clicks,
            'signups': referral.signups,
            'purchases': referral.purchases,
            'created': created
        })
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def get_referral_stats(request):
    """Get referral statistics for a user"""
    try:
        username = request.GET.get('username')
        email = request.GET.get('email')
        
        if not username and not email:
            return JsonResponse({'success': False, 'message': 'Username or email required'}, status=400)
        
        try:
            if username:
                user = User.objects.get(username=username)
            else:
                user = User.objects.get(email=email)
        except User.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'User not found'}, status=404)
        
        try:
            referral = Referral.objects.get(referrer=user)
        except Referral.DoesNotExist:
            return JsonResponse({
                'success': True,
                'has_referral': False,
                'message': 'No referral code created yet'
            })
        
        # Get transactions
        transactions = ReferralTransaction.objects.filter(referral=referral).order_by('-created_at')[:10]
        transaction_list = []
        for t in transactions:
            transaction_list.append({
                'id': t.id,
                'referred_user': t.referred_user.username,
                'purchase_amount': float(t.purchase_amount),
                'commission_amount': float(t.commission_amount),
                'status': t.status,
                'created_at': t.created_at.isoformat(),
            })
        
        # Get payouts
        payouts = ReferralPayout.objects.filter(referral=referral).order_by('-requested_at')[:10]
        payout_list = []
        for p in payouts:
            payout_list.append({
                'id': p.id,
                'amount': float(p.amount),
                'payment_method': p.payment_method,
                'status': p.status,
                'requested_at': p.requested_at.isoformat(),
                'processed_at': p.processed_at.isoformat() if p.processed_at else None,
            })
        
        return JsonResponse({
            'success': True,
            'has_referral': True,
            'referral_code': referral.referral_code,
            'commission_percent': float(referral.commission_percent),
            'stats': {
                'total_earnings': float(referral.total_earnings),
                'pending_earnings': float(referral.pending_earnings),
                'paid_earnings': float(referral.paid_earnings),
                'clicks': referral.clicks,
                'signups': referral.signups,
                'purchases': referral.purchases,
            },
            'transactions': transaction_list,
            'payouts': payout_list,
        })
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def track_referral_click(request):
    """Track a referral link click"""
    try:
        data = json.loads(request.body)
        referral_code = data.get('referral_code')
        
        if not referral_code:
            return JsonResponse({'success': False, 'message': 'Referral code required'}, status=400)
        
        try:
            referral = Referral.objects.get(referral_code=referral_code)
            referral.clicks += 1
            referral.save()
            
            return JsonResponse({
                'success': True,
                'message': 'Click tracked',
                'referrer': referral.referrer.username
            })
        except Referral.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'Invalid referral code'}, status=404)
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def request_payout(request):
    """Request a payout for referral earnings"""
    try:
        data = json.loads(request.body)
        username = data.get('username')
        email = data.get('email')
        amount = Decimal(str(data.get('amount', 0)))
        payment_method = data.get('payment_method', 'paypal')
        payment_details = data.get('payment_details', {})
        
        if not username and not email:
            return JsonResponse({'success': False, 'message': 'Username or email required'}, status=400)
        
        if amount <= 0:
            return JsonResponse({'success': False, 'message': 'Invalid amount'}, status=400)
        
        user = resolve_user(username or email)
        if not user:
            return JsonResponse({'success': False, 'message': 'User not found'}, status=404)
        try:
            referral = Referral.objects.get(referrer=user)
        except Referral.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'No referral account found'}, status=404)
        
        # Check if user has enough pending earnings
        if referral.pending_earnings < amount:
            return JsonResponse({
                'success': False,
                'message': f'Insufficient balance. Available: ${referral.pending_earnings}'
            }, status=400)
        
        # Create payout request
        payout = ReferralPayout.objects.create(
            referral=referral,
            amount=amount,
            payment_method=payment_method,
            payment_details=payment_details,
            status='pending'
        )
        
        # Update referral earnings
        referral.pending_earnings -= amount
        referral.save()
        
        return JsonResponse({
            'success': True,
            'message': 'Payout request submitted',
            'payout_id': payout.id,
            'amount': float(amount),
            'remaining_balance': float(referral.pending_earnings)
        })
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


# ==================== TRADE COMMAND SYSTEM ====================

@csrf_exempt
@require_http_methods(["POST"])
def close_position(request):
    """Close a single position by ticket number"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid request'}, status=400)
    
    license_key = data.get('license_key', '').strip().upper()
    ticket = data.get('ticket')
    
    if not license_key or not ticket:
        return JsonResponse({'success': False, 'message': 'License key and ticket required'})
    
    try:
        license = License.objects.get(license_key=license_key)
    except License.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Invalid license key'})
    
    command = TradeCommand.objects.create(
        license=license,
        command_type='CLOSE_POSITION',
        parameters={'ticket': ticket}
    )
    
    return JsonResponse({
        'success': True,
        'message': 'Close command created',
        'command_id': command.id
    })


@csrf_exempt
@require_http_methods(["POST"])
def close_bulk_positions(request):
    """Close multiple positions by ticket numbers"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid request'}, status=400)
    
    license_key = data.get('license_key', '').strip().upper()
    tickets = data.get('tickets', [])
    
    if not license_key or not tickets:
        return JsonResponse({'success': False, 'message': 'License key and tickets required'})
    
    try:
        license = License.objects.get(license_key=license_key)
    except License.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Invalid license key'})
    
    command = TradeCommand.objects.create(
        license=license,
        command_type='CLOSE_BULK',
        parameters={'tickets': tickets}
    )
    
    return JsonResponse({
        'success': True,
        'message': f'Bulk close command created for {len(tickets)} positions',
        'command_id': command.id
    })


@csrf_exempt
@require_http_methods(["POST"])
def close_top_loss_positions(request):
    """Close top N positions with highest loss (distance from entry)"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid request'}, status=400)
    
    license_key = data.get('license_key', '').strip().upper()
    count = data.get('count', 5)
    position_type = data.get('type', 'all')
    
    if not license_key:
        return JsonResponse({'success': False, 'message': 'License key required'})
    
    try:
        license = License.objects.get(license_key=license_key)
    except License.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Invalid license key'})
    
    try:
        trade_data = TradeData.objects.get(license=license)
    except TradeData.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'No trade data available'})
    
    open_positions = trade_data.open_positions or []
    
    if not open_positions:
        return JsonResponse({'success': False, 'message': 'No open positions'})
    
    if position_type == 'buy':
        positions = [p for p in open_positions if p.get('type', '').upper() == 'BUY']
    elif position_type == 'sell':
        positions = [p for p in open_positions if p.get('type', '').upper() == 'SELL']
    else:
        positions = open_positions
    
    if not positions:
        return JsonResponse({'success': False, 'message': f'No {position_type} positions found'})
    
    current_price = float(trade_data.current_price)
    
    for pos in positions:
        entry_price = float(pos.get('price', 0))
        pos_type = pos.get('type', '').upper()
        
        if pos_type == 'BUY':
            distance = entry_price - current_price
        else:
            distance = current_price - entry_price
        
        pos['distance'] = distance
        pos['profit'] = float(pos.get('profit', 0))
    
    sorted_positions = sorted(positions, key=lambda x: x['distance'], reverse=True)
    top_loss_positions = sorted_positions[:count]
    tickets = [p.get('ticket') for p in top_loss_positions if p.get('ticket')]
    
    if not tickets:
        return JsonResponse({'success': False, 'message': 'No valid tickets found'})
    
    command = TradeCommand.objects.create(
        license=license,
        command_type='CLOSE_BULK',
        parameters={
            'tickets': tickets,
            'reason': f'Top {count} loss positions',
            'type': position_type
        }
    )
    
    position_details = []
    for pos in top_loss_positions:
        position_details.append({
            'ticket': pos.get('ticket'),
            'type': pos.get('type'),
            'lots': pos.get('lots'),
            'price': pos.get('price'),
            'profit': pos.get('profit'),
            'distance': round(pos.get('distance', 0), 2)
        })
    
    return JsonResponse({
        'success': True,
        'message': f'Command created to close top {len(tickets)} loss positions',
        'command_id': command.id,
        'positions': position_details
    })


@csrf_exempt
@require_http_methods(["POST"])
def close_all_positions(request):
    """Close all positions (or all buy/sell)"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid request'}, status=400)
    
    license_key = data.get('license_key', '').strip().upper()
    position_type = data.get('type', 'all')
    
    if not license_key:
        return JsonResponse({'success': False, 'message': 'License key required'})
    
    try:
        license = License.objects.get(license_key=license_key)
    except License.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Invalid license key'})
    
    if position_type == 'buy':
        command_type = 'CLOSE_ALL_BUY'
    elif position_type == 'sell':
        command_type = 'CLOSE_ALL_SELL'
    else:
        command_type = 'CLOSE_ALL'
    
    command = TradeCommand.objects.create(
        license=license,
        command_type=command_type,
        parameters={}
    )
    
    return JsonResponse({
        'success': True,
        'message': f'Close all {position_type} command created',
        'command_id': command.id
    })


@csrf_exempt
@require_http_methods(["POST", "GET"])
def get_pending_commands(request):
    """Get pending commands for EA to execute"""
    if request.method == "GET":
        license_key = request.GET.get('license_key', '').strip().upper()
    else:
        try:
            data = json.loads(request.body)
            license_key = data.get('license_key', '').strip().upper()
        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'message': 'Invalid request'}, status=400)
    
    if not license_key:
        return JsonResponse({'success': False, 'message': 'License key required'})
    
    try:
        license = License.objects.get(license_key=license_key)
    except License.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Invalid license key'})
    
    commands = TradeCommand.objects.filter(
        license=license,
        status='pending'
    ).order_by('created_at')
    
    for cmd in commands:
        cmd.is_expired()
    
    commands = TradeCommand.objects.filter(
        license=license,
        status='pending'
    ).order_by('created_at')
    
    command_list = []
    for cmd in commands:
        command_list.append({
            'id': cmd.id,
            'command_type': cmd.command_type,
            'parameters': cmd.parameters,
            'created_at': cmd.created_at.isoformat()
        })
    
    return JsonResponse({
        'success': True,
        'commands': command_list
    })


@csrf_exempt
@require_http_methods(["POST"])
def update_command_status(request):
    """Update command execution status from EA"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid request'}, status=400)
    
    license_key = data.get('license_key', '').strip().upper()
    command_id = data.get('command_id')
    status = data.get('status', 'executed')
    result_message = data.get('result_message', '')
    result_data = data.get('result_data', {})
    
    if not license_key or not command_id:
        return JsonResponse({'success': False, 'message': 'License key and command_id required'})
    
    try:
        license = License.objects.get(license_key=license_key)
    except License.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Invalid license key'})
    
    try:
        command = TradeCommand.objects.get(id=command_id, license=license)
    except TradeCommand.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Command not found'})
    
    command.status = status
    command.result_message = result_message
    command.result_data = result_data
    command.executed_at = timezone.now()
    command.save()
    
    return JsonResponse({
        'success': True,
        'message': 'Command status updated'
    })


@csrf_exempt
@require_http_methods(["GET"])
def get_site_settings(request):
    """Get public site settings for frontend (favicon, logo, contact info)"""
    settings = SiteSettings.get_settings()
    
    favicon_url = None
    logo_url = None
    
    if settings.favicon:
        try:
            # Build absolute URL for media files
            favicon_url = request.build_absolute_uri(settings.favicon.url)
        except Exception:
            favicon_url = None
    
    if settings.logo:
        try:
            # Build absolute URL for media files
            logo_url = request.build_absolute_uri(settings.logo.url)
        except Exception:
            logo_url = None
    
    return JsonResponse({
        'success': True,
        'settings': {
            'site_name': settings.site_name,
            'site_tagline': settings.site_tagline,
            'favicon_url': favicon_url,
            'logo_url': logo_url,
            'logo_text': settings.logo_text,
            'logo_version': settings.logo_version,
            'support_email': settings.support_email,
            'telegram_en': settings.telegram_en,
            'telegram_en_url': settings.telegram_en_url,
            'telegram_cn': settings.telegram_cn,
            'telegram_cn_url': settings.telegram_cn_url,
        }
    })


@csrf_exempt
@require_http_methods(["POST"])
def toggle_license_status(request):
    """Toggle license status between active and suspended (user self-service)"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid request'}, status=400)

    license_key = data.get('license_key', '').strip().upper()
    email = data.get('email', '').strip()
    action = data.get('action', '').strip()  # 'activate' or 'deactivate'

    if not license_key or not email or action not in ('activate', 'deactivate'):
        return JsonResponse({'success': False, 'message': 'license_key, email, and action (activate/deactivate) are required'}, status=400)

    user = resolve_user(email)
    if not user:
        return JsonResponse({'success': False, 'message': 'User not found'}, status=404)

    try:
        license_obj = License.objects.get(license_key=license_key, user=user)
    except License.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'License not found'}, status=404)

    # Only allow toggling between active and suspended
    if action == 'deactivate':
        if license_obj.status != 'active':
            return JsonResponse({'success': False, 'message': f'Cannot deactivate: license is {license_obj.status}'})
        license_obj.status = 'suspended'
        license_obj.save(update_fields=['status', 'updated_at'])
    elif action == 'activate':
        if license_obj.status not in ('suspended',):
            return JsonResponse({'success': False, 'message': f'Cannot activate: license is {license_obj.status}'})
        # Check if not expired
        if license_obj.expires_at < timezone.now():
            return JsonResponse({'success': False, 'message': 'Cannot activate: license has expired'})
        license_obj.status = 'active'
        license_obj.save(update_fields=['status', 'updated_at'])

    return JsonResponse({
        'success': True,
        'message': f'License {action}d successfully',
        'license': {
            'license_key': license_obj.license_key,
            'status': license_obj.status,
            'expires_at': license_obj.expires_at.isoformat(),
            'days_remaining': license_obj.days_remaining(),
        }
    })
