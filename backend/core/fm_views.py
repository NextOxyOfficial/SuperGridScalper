import json
from decimal import Decimal
from datetime import timedelta

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.contrib.auth.models import User
from django.db.models import Avg, Count, Q, Sum, F

from core.models import (
    FundManager, FMSubscription, FMAccountAssignment, FMCommand,
    FMChatRoom, FMChatMessage, FMReview, FMPayout, FMSchedule,
    EconomicEvent, TradingWaveAlert, License, TradeData
)


# ============================================================
# HELPER: Resolve user from email/username
# ============================================================

def _resolve_user(identifier):
    """Resolve a user from email or username"""
    if not identifier:
        return None
    identifier = identifier.strip()
    email_qs = User.objects.filter(email__iexact=identifier)
    username_qs = User.objects.filter(username__iexact=identifier).exclude(id__in=email_qs.values('id'))
    ids = list(email_qs.values_list('id', flat=True)) + list(username_qs.values_list('id', flat=True))
    if not ids:
        return None

    # Prefer the account that actually has licenses/subscriptions (handles legacy duplicate users in production).
    return (
        User.objects.filter(id__in=ids)
        .annotate(
            license_count=Count('licenses', distinct=True),
            fm_sub_count=Count('fm_subscriptions', distinct=True),
        )
        .order_by('-license_count', '-fm_sub_count', '-id')
        .first()
    )


def _get_fm_from_user(user):
    """Get FundManager profile from user, or None"""
    try:
        return user.fund_manager_profile
    except FundManager.DoesNotExist:
        return None


def _send_fm_email(to_email, subject, heading, body_lines, cta_text=None, cta_url=None, extra_note=None):
    """Send a professional FM-related email notification."""
    try:
        from django.core.mail import EmailMultiAlternatives
        from django.conf import settings as django_settings
        from core.utils import get_email_from_address, render_email_template, add_email_headers, can_send_email_to_user, get_unsubscribe_url
        from django.contrib.auth.models import User as DjangoUser

        recipient = DjangoUser.objects.filter(email__iexact=to_email).first()
        if recipient and not can_send_email_to_user(recipient, 'transactional'):
            return

        base = (getattr(django_settings, 'FRONTEND_URL', '') or 'https://markstrades.com').rstrip('/')
        cta_html = ''
        if cta_text and cta_url:
            full_url = cta_url if cta_url.startswith('http') else f'{base}{cta_url}'
            cta_html = f'''
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
            <tr>
                <td align="center">
                    <a href="{full_url}" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: #000000; font-weight: bold; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; letter-spacing: 0.5px;">
                        {cta_text}
                    </a>
                </td>
            </tr>
        </table>
        '''

        body_html = ''.join(f'<p style="margin:0 0 14px;color:#cbd5e1;font-size:15px;line-height:1.6;">{line}</p>' for line in body_lines)
        full_message = body_html + cta_html
        if extra_note:
            full_message += f'<p style="margin:20px 0 0;font-size:12px;color:#64748b;">{extra_note}</p>'

        html_content = render_email_template(
            subject=subject,
            heading=heading,
            message=full_message,
            footer_note='This is an automated notification from MarksTrades FM Engine.',
            preheader=subject,
            unsubscribe_url=get_unsubscribe_url(recipient) if recipient else get_unsubscribe_url(None),
        )
        body_text = '\n'.join(
            line.replace('<strong>', '').replace('</strong>', '') for line in body_lines
        )
        msg = EmailMultiAlternatives(subject, body_text, get_email_from_address(), [to_email])
        msg.attach_alternative(html_content, 'text/html')
        msg = add_email_headers(msg, 'transactional', user=recipient)
        msg.send(fail_silently=True)
    except Exception:
        pass  # Email is non-critical


# ============================================================
# PUBLIC: Fund Manager Marketplace
# ============================================================

@csrf_exempt
@require_http_methods(["GET"])
def list_fund_managers(request):
    """List all approved fund managers for the marketplace"""
    fms = FundManager.objects.filter(status='approved').select_related('user')
    
    # Sorting
    sort = request.GET.get('sort', 'featured')
    if sort == 'rating':
        fms = fms.order_by('-average_rating', '-total_reviews')
    elif sort == 'subscribers':
        fms = fms.annotate(sub_count=Count('subscriptions', filter=Q(subscriptions__status__in=['active', 'trial']))).order_by('-sub_count')
    elif sort == 'price_low':
        fms = fms.order_by('monthly_price')
    elif sort == 'price_high':
        fms = fms.order_by('-monthly_price')
    elif sort == 'profit':
        fms = fms.order_by('-total_profit_percent')
    else:  # featured
        fms = fms.order_by('-is_featured', '-average_rating', '-created_at')
    
    results = []
    for fm in fms:
        days_joined = (timezone.now() - fm.user.date_joined).days
        if days_joined >= 365:
            join_label = f'{days_joined // 365}yr'
        elif days_joined >= 30:
            join_label = f'{days_joined // 30}mo'
        else:
            join_label = f'{days_joined}d'

        results.append({
            'id': fm.id,
            'display_name': fm.display_name,
            'bio': fm.bio,
            'avatar_url': fm.avatar.url if fm.avatar else None,
            'tier': fm.tier,
            'monthly_price': str(fm.monthly_price),
            'total_profit_percent': str(fm.total_profit_percent),
            'win_rate': str(fm.win_rate),
            'months_active': fm.months_active,
            'average_rating': str(fm.average_rating),
            'total_reviews': fm.total_reviews,
            'subscriber_count': fm.subscriber_count,
            'is_verified': fm.is_verified,
            'is_featured': fm.is_featured,
            'trading_pairs': fm.trading_pairs,
            'trading_style': fm.trading_style,
            'max_subscribers': fm.max_subscribers,
            'trial_days': fm.trial_days,
            'join_label': join_label,
        })
    
    return JsonResponse({'success': True, 'fund_managers': results})


@csrf_exempt
@require_http_methods(["GET"])
def fund_manager_detail(request, fm_id):
    """Get detailed info for a specific fund manager"""
    try:
        fm = FundManager.objects.select_related('user').get(id=fm_id, status='approved')
    except FundManager.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Fund manager not found'}, status=404)
    
    # Get reviews
    reviews = fm.reviews.select_related('user').order_by('-created_at')[:20]
    reviews_data = [{
        'user': r.user.first_name or r.user.username,
        'rating': r.rating,
        'comment': r.comment,
        'created_at': r.created_at.isoformat(),
    } for r in reviews]
    
    # Get aggregate stats from managed accounts
    managed_accounts = FMAccountAssignment.objects.filter(
        subscription__fund_manager=fm,
        subscription__status__in=['active', 'trial']
    ).select_related('license')
    
    total_balance = Decimal('0.00')
    total_accounts = 0
    for acc in managed_accounts:
        td = acc.license.trade_data.order_by('-last_update').first()
        if td:
            total_balance += td.account_balance
            total_accounts += 1
    
    # Get schedules
    schedules = fm.schedules.filter(is_active=True)
    schedules_data = [{
        'name': s.name,
        'day': s.get_day_of_week_display(),
        'off_time': s.off_time.strftime('%H:%M'),
        'on_time': s.on_time.strftime('%H:%M'),
        'reason': s.reason,
    } for s in schedules]
    
    data = {
        'id': fm.id,
        'user_email': fm.user.email,
        'display_name': fm.display_name,
        'bio': fm.bio,
        'avatar_url': fm.avatar.url if fm.avatar else None,
        'tier': fm.tier,
        'monthly_price': str(fm.monthly_price),
        'total_profit_percent': str(fm.total_profit_percent),
        'win_rate': str(fm.win_rate),
        'months_active': fm.months_active,
        'average_rating': str(fm.average_rating),
        'total_reviews': fm.total_reviews,
        'subscriber_count': fm.subscriber_count,
        'total_managed_accounts': total_accounts,
        'total_managed_balance': str(total_balance),
        'is_verified': fm.is_verified,
        'is_featured': fm.is_featured,
        'trading_pairs': fm.trading_pairs,
        'trading_style': fm.trading_style,
        'max_subscribers': fm.max_subscribers,
        'trial_days': fm.trial_days,
        'reviews': reviews_data,
        'schedules': schedules_data,
    }
    
    return JsonResponse({'success': True, 'fund_manager': data})


# ============================================================
# SUBSCRIPTION: Subscribe/Unsubscribe to FM
# ============================================================

@csrf_exempt
@require_http_methods(["POST"])
def subscribe_to_fm(request):
    """Subscribe current user to a fund manager"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
    
    email = data.get('email', '').strip()
    fm_id = data.get('fund_manager_id')
    raw_license_ids = data.get('license_ids', [])  # List of license IDs to assign
    # Normalize IDs to integers and deduplicate while preserving order
    license_ids = []
    seen_ids = set()
    for raw_id in raw_license_ids if isinstance(raw_license_ids, list) else []:
        try:
            lid = int(raw_id)
        except (TypeError, ValueError):
            continue
        if lid in seen_ids:
            continue
        seen_ids.add(lid)
        license_ids.append(lid)
    
    user = _resolve_user(email)
    if not user:
        return JsonResponse({'success': False, 'error': 'User not found'}, status=404)

    if not license_ids:
        return JsonResponse({'success': False, 'error': 'Please select at least one valid MT5 license.'}, status=400)
    
    try:
        fm = FundManager.objects.get(id=fm_id, status='approved')
    except FundManager.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Fund manager not found'}, status=404)
    
    # Check if already subscribed
    existing = FMSubscription.objects.filter(user=user, fund_manager=fm).first()
    if existing and existing.is_active:
        # Recover from legacy ghost subscriptions (active/trial but no assigned accounts)
        has_assignments = existing.assigned_accounts.exists()
        if has_assignments:
            return JsonResponse({'success': False, 'error': 'Already subscribed to this fund manager'}, status=400)
        existing.status = 'cancelled'
        existing.cancelled_at = timezone.now()
        existing.auto_renew = False
        existing.save(update_fields=['status', 'cancelled_at', 'auto_renew', 'updated_at'])
    
    # Check max subscribers
    if fm.subscriber_count >= fm.max_subscribers:
        return JsonResponse({'success': False, 'error': 'This fund manager has reached maximum subscribers'}, status=400)
    
    # Determine trial or paid
    is_trial = fm.trial_days > 0
    status = 'trial' if is_trial else 'active'
    period_days = fm.trial_days if is_trial else 30
    
    prev_existing_state = None
    if existing:
        prev_existing_state = {
            'status': existing.status,
            'price_at_subscription': existing.price_at_subscription,
            'current_period_start': existing.current_period_start,
            'current_period_end': existing.current_period_end,
            'cancelled_at': existing.cancelled_at,
            'auto_renew': existing.auto_renew,
        }
        # Reactivate
        existing.status = status
        existing.price_at_subscription = fm.monthly_price
        existing.current_period_start = timezone.now()
        existing.current_period_end = timezone.now() + timedelta(days=period_days)
        existing.cancelled_at = None
        existing.auto_renew = True
        existing.save()
        subscription = existing
    else:
        subscription = FMSubscription.objects.create(
            user=user,
            fund_manager=fm,
            status=status,
            price_at_subscription=fm.monthly_price,
            current_period_end=timezone.now() + timedelta(days=period_days),
        )
    
    # Assign licenses — strictly enforce 1 license = 1 FM
    assigned = []
    already_used = []
    for lic_id in license_ids:
        try:
            lic = License.objects.get(id=lic_id, user=user, status='active')
            # Check if this license is already assigned to a DIFFERENT active FM subscription
            conflicting = FMAccountAssignment.objects.filter(
                license=lic,
                subscription__status__in=['active', 'trial'],
            ).exclude(subscription=subscription).select_related('subscription__fund_manager').first()
            if conflicting:
                already_used.append({
                    'license_id': lic.id,
                    'mt5_account': lic.mt5_account,
                    'fm_name': conflicting.subscription.fund_manager.display_name,
                })
                continue
            assignment, created = FMAccountAssignment.objects.get_or_create(
                subscription=subscription,
                license=lic,
                defaults={'is_ea_active': True}
            )
            assigned.append({
                'license_id': lic.id,
                'mt5_account': lic.mt5_account,
                'is_ea_active': assignment.is_ea_active,
            })
        except License.DoesNotExist:
            continue
    
    # If no licenses were successfully assigned, roll back the subscription update
    if len(assigned) == 0:
        if prev_existing_state is not None:
            existing.status = prev_existing_state['status']
            existing.price_at_subscription = prev_existing_state['price_at_subscription']
            existing.current_period_start = prev_existing_state['current_period_start']
            existing.current_period_end = prev_existing_state['current_period_end']
            existing.cancelled_at = prev_existing_state['cancelled_at']
            existing.auto_renew = prev_existing_state['auto_renew']
            existing.save()
        else:
            # Don't leave a brand-new empty subscription row
            subscription.delete()

        if already_used:
            msg = 'All selected licenses are already assigned to other fund managers. One license can only be managed by one FM at a time.'
        else:
            msg = 'No valid active license could be assigned. Please select an active MT5 license.'
        return JsonResponse({
            'success': False,
            'error': msg,
            'already_used': already_used,
        }, status=400)
    
    # Create chat room if not exists
    FMChatRoom.objects.get_or_create(fund_manager=fm, defaults={'name': f"{fm.display_name}'s Community"})

    # Send confirmation emails
    trial_note = f'{fm.trial_days}-day free trial, then ${fm.monthly_price}/month' if fm.trial_days else f'${fm.monthly_price}/month'
    _send_fm_email(
        to_email=user.email,
        subject=f'You are now subscribed to {fm.display_name}',
        heading='Subscription Confirmed!',
        body_lines=[
            f'Welcome! You have successfully subscribed to <strong>{fm.display_name}</strong>.',
            f'Plan: {trial_note}',
            f'{len(assigned)} MT5 account(s) have been assigned to this fund manager.',
            f'The fund manager will now be able to start and stop your robot on your behalf. You can unsubscribe at any time.',
        ],
        cta_text='View My Subscription',
        cta_url='/dashboard/fund-managers',
    )
    _send_fm_email(
        to_email=fm.user.email,
        subject=f'New subscriber: {user.email}',
        heading='New Subscriber!',
        body_lines=[
            f'<strong>{user.email}</strong> has subscribed to your fund manager account.',
            f'{len(assigned)} MT5 account(s) have been assigned to your management.',
            'Log in to your FM dashboard to manage your subscribers.',
        ],
        cta_text='Go to FM Dashboard',
        cta_url='/dashboard/fund-managers/dashboard',
    )

    return JsonResponse({
        'success': True,
        'subscription': {
            'id': subscription.id,
            'status': subscription.status,
            'period_end': subscription.current_period_end.isoformat(),
            'days_remaining': subscription.days_remaining,
            'assigned_accounts': assigned,
            'already_used': already_used,
        }
    })


@csrf_exempt
@require_http_methods(["POST"])
def unsubscribe_from_fm(request):
    """Cancel subscription to a fund manager (requires password confirmation)"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
    
    email = data.get('email', '').strip()
    fm_id = data.get('fund_manager_id')
    password = data.get('password', '').strip()

    user = _resolve_user(email)
    if not user:
        return JsonResponse({'success': False, 'error': 'User not found'}, status=404)

    # Require password confirmation
    if not password:
        return JsonResponse({'success': False, 'error': 'Password is required to unsubscribe.'}, status=400)
    if not user.check_password(password):
        return JsonResponse({'success': False, 'error': 'Incorrect password. Unsubscribe denied.'}, status=403)

    try:
        sub = FMSubscription.objects.select_related('fund_manager').get(user=user, fund_manager_id=fm_id)
    except FMSubscription.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Subscription not found'}, status=404)

    fm = sub.fund_manager
    fm_name = fm.display_name

    sub.status = 'cancelled'
    sub.cancelled_at = timezone.now()
    sub.auto_renew = False
    sub.save()
    
    # Re-enable all assigned accounts (give back control to user)
    affected_license_ids = list(sub.assigned_accounts.values_list('license_id', flat=True))
    sub.assigned_accounts.update(is_ea_active=True)

    # If FM had stopped subscriber licenses, restore them to active (unless expired)
    now = timezone.now()
    if affected_license_ids:
        License.objects.filter(
            id__in=affected_license_ids,
            status='suspended',
        ).exclude(expires_at__lt=now).update(status='active', updated_at=now)

    # Send email notifications
    _send_fm_email(
        to_email=user.email,
        subject=f'You have unsubscribed from {fm_name}',
        heading='Subscription Cancelled',
        body_lines=[
            f'You have successfully cancelled your subscription to <strong>{fm_name}</strong>.',
            'Your robot control has been returned to you — all your assigned MT5 accounts are now back under your direct management.',
            'You can re-subscribe at any time from the FM Engine marketplace.',
        ],
        cta_text='Visit FM Engine',
        cta_url='/dashboard/fund-managers',
    )
    _send_fm_email(
        to_email=fm.user.email,
        subject=f'Subscriber {user.email} has cancelled their subscription',
        heading='Subscription Cancelled by Subscriber',
        body_lines=[
            f'<strong>{user.email}</strong> has cancelled their subscription to your fund manager account.',
            f'Their {len(affected_license_ids)} assigned MT5 account(s) have been released from your management.',
            'Log in to your FM dashboard to review your current subscriber list.',
        ],
        cta_text='Go to FM Dashboard',
        cta_url='/dashboard/fund-managers/dashboard',
    )
    
    return JsonResponse({'success': True, 'message': 'Subscription cancelled'})


@csrf_exempt
@require_http_methods(["POST"])
def fm_cancel_subscriber(request):
    """FM cancels a specific subscriber's subscription"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)

    email = data.get('email', '').strip()
    subscription_id = data.get('subscription_id')

    user = _resolve_user(email)
    if not user:
        return JsonResponse({'success': False, 'error': 'User not found'}, status=404)

    fm = _get_fm_from_user(user)
    if not fm or fm.status != 'approved':
        return JsonResponse({'success': False, 'error': 'Not an approved fund manager'}, status=403)

    try:
        sub = FMSubscription.objects.get(id=subscription_id, fund_manager=fm)
    except FMSubscription.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Subscription not found'}, status=404)

    sub.status = 'cancelled'
    sub.cancelled_at = timezone.now()
    sub.auto_renew = False
    sub.save()

    # Re-enable all assigned accounts (return control to user)
    affected_license_ids = list(sub.assigned_accounts.values_list('license_id', flat=True))
    sub.assigned_accounts.update(is_ea_active=True)

    # Restore subscriber licenses if they were FM-stopped (unless expired)
    now = timezone.now()
    if affected_license_ids:
        License.objects.filter(
            id__in=affected_license_ids,
            status='suspended',
        ).exclude(expires_at__lt=now).update(status='active', updated_at=now)

    return JsonResponse({'success': True, 'message': f'Subscription for {sub.user.email} has been cancelled.'})


@csrf_exempt
@require_http_methods(["POST"])
def get_my_fm_subscriptions(request):
    """Get all FM subscriptions for current user"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
    
    email = data.get('email', '').strip()
    user = _resolve_user(email)
    if not user:
        return JsonResponse({'success': False, 'error': 'User not found'}, status=404)
    
    subs = FMSubscription.objects.filter(user=user).select_related('fund_manager')

    # Collect all license IDs already assigned to an active FM subscription
    active_assignments = FMAccountAssignment.objects.filter(
        subscription__user=user,
        subscription__status__in=['active', 'trial'],
    ).select_related('license', 'subscription__fund_manager').order_by('-assigned_at')
    used_license_map = {}  # license_id -> fm_name
    for a in active_assignments:
        # Keep the latest assignment as source of truth if legacy conflicts exist
        if a.license.id not in used_license_map:
            used_license_map[a.license.id] = a.subscription.fund_manager.display_name

    results = []
    
    for sub in subs:
        fm = sub.fund_manager
        assignments = sub.assigned_accounts.select_related('license')
        has_assigned_accounts = assignments.exists()
        results.append({
            'id': sub.id,
            'fund_manager': {
                'id': fm.id,
                'display_name': fm.display_name,
                'avatar_url': fm.avatar.url if fm.avatar else None,
                'tier': fm.tier,
            },
            'status': sub.status,
            'is_active': sub.is_active and has_assigned_accounts,
            'has_assigned_accounts': has_assigned_accounts,
            'days_remaining': sub.days_remaining,
            'period_end': sub.current_period_end.isoformat(),
            'assigned_accounts': [{
                'id': a.id,
                'license_id': a.license.id,
                'mt5_account': a.license.mt5_account,
                'is_ea_active': a.is_ea_active,
                'last_toggled_reason': a.last_toggled_reason,
            } for a in assignments],
        })

    return JsonResponse({
        'success': True,
        'subscriptions': results,
        'used_license_map': used_license_map,  # {license_id: fm_name} for active subs
    })


@csrf_exempt
@require_http_methods(["POST"])
def assign_license_to_fm(request):
    """Assign additional license to existing FM subscription"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
    
    email = data.get('email', '').strip()
    subscription_id = data.get('subscription_id')
    license_id = data.get('license_id')
    
    user = _resolve_user(email)
    if not user:
        return JsonResponse({'success': False, 'error': 'User not found'}, status=404)
    
    try:
        sub = FMSubscription.objects.get(id=subscription_id, user=user)
    except FMSubscription.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Subscription not found'}, status=404)
    
    if not sub.is_active:
        return JsonResponse({'success': False, 'error': 'Subscription is not active'}, status=400)
    
    try:
        lic = License.objects.get(id=license_id, user=user, status='active')
    except License.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'License not found'}, status=404)
    
    # Check if this license is already assigned to a DIFFERENT active FM subscription
    conflicting = FMAccountAssignment.objects.filter(
        license=lic,
        subscription__status__in=['active', 'trial'],
    ).exclude(subscription=sub).select_related('subscription__fund_manager').first()
    if conflicting:
        fm_name = conflicting.subscription.fund_manager.display_name
        return JsonResponse({'success': False, 'error': f'This license is already assigned to Fund Manager "{fm_name}". One license can only be managed by one FM at a time.'}, status=400)
    
    assignment, created = FMAccountAssignment.objects.get_or_create(
        subscription=sub,
        license=lic,
        defaults={'is_ea_active': True}
    )
    
    return JsonResponse({
        'success': True,
        'assignment': {
            'id': assignment.id,
            'license_id': lic.id,
            'mt5_account': lic.mt5_account,
            'is_ea_active': assignment.is_ea_active,
            'created': created,
        }
    })


# ============================================================
# FUND MANAGER DASHBOARD
# ============================================================

@csrf_exempt
@require_http_methods(["GET", "POST"])
def fm_dashboard(request):
    """Get Fund Manager's dashboard data"""
    if request.method == 'GET':
        email = request.GET.get('email', '').strip()
    else:
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
        email = data.get('email', '').strip()
    user = _resolve_user(email)
    if not user:
        return JsonResponse({'success': False, 'error': 'User not found'}, status=404)
    
    fm = _get_fm_from_user(user)
    if not fm:
        return JsonResponse({'success': False, 'error': 'Not a fund manager'}, status=403)
    
    # Get all active subscriptions with assignments
    subs = fm.subscriptions.filter(status__in=['active', 'trial']).select_related('user')
    
    subscribers = []
    total_balance = Decimal('0.00')
    total_equity = Decimal('0.00')
    total_profit = Decimal('0.00')
    
    for sub in subs:
        assignments = sub.assigned_accounts.select_related('license')
        accounts = []
        for a in assignments:
            td = a.license.trade_data.order_by('-last_update').first()
            acc_data = {
                'assignment_id': a.id,
                'license_id': a.license.id,
                'mt5_account': a.license.mt5_account,
                'is_ea_active': a.is_ea_active,
                'last_toggled_reason': a.last_toggled_reason,
            }
            if td:
                acc_data.update({
                    'balance': str(td.account_balance),
                    'equity': str(td.account_equity),
                    'profit': str(td.account_profit),
                    'buy_positions': td.total_buy_positions,
                    'sell_positions': td.total_sell_positions,
                    'last_update': td.last_update.isoformat(),
                })
                total_balance += td.account_balance
                total_equity += td.account_equity
                total_profit += td.account_profit
            accounts.append(acc_data)
        
        # Check if this subscriber is also an approved FM
        sub_fm = FundManager.objects.filter(user=sub.user, status='approved').first()
        subscribers.append({
            'subscription_id': sub.id,
            'user_email': sub.user.email,
            'user_name': sub.user.first_name or sub.user.username,
            'status': sub.status,
            'days_remaining': sub.days_remaining,
            'accounts': accounts,
            'subscriber_fm_id': sub_fm.id if sub_fm else None,
            'subscriber_fm_name': sub_fm.display_name if sub_fm else None,
        })
    
    # Recent commands
    recent_commands = fm.commands.order_by('-created_at')[:10]
    commands_data = [{
        'id': c.id,
        'command_type': c.command_type,
        'target_type': c.target_type,
        'reason': c.reason,
        'status': c.status,
        'affected_accounts': c.affected_accounts,
        'created_at': c.created_at.isoformat(),
    } for c in recent_commands]
    
    # Earnings summary
    total_active_subs = subs.filter(status='active').count()
    monthly_revenue = total_active_subs * fm.monthly_price
    platform_fee = monthly_revenue * fm.platform_commission_percent / 100
    net_earnings = monthly_revenue - platform_fee
    
    return JsonResponse({
        'success': True,
        'dashboard': {
            'profile': {
                'id': fm.id,
                'display_name': fm.display_name,
                'tier': fm.tier,
                'status': fm.status,
                'is_verified': fm.is_verified,
                'average_rating': str(fm.average_rating),
                'total_reviews': fm.total_reviews,
                'avatar_url': fm.avatar.url if fm.avatar else None,
            },
            'stats': {
                'total_subscribers': subs.count(),
                'active_subscribers': total_active_subs,
                'trial_subscribers': subs.filter(status='trial').count(),
                'total_managed_balance': str(total_balance),
                'total_managed_equity': str(total_equity),
                'total_managed_profit': str(total_profit),
                'monthly_revenue': str(monthly_revenue),
                'platform_fee': str(platform_fee),
                'net_earnings': str(net_earnings),
            },
            'subscribers': subscribers,
            'recent_commands': commands_data,
        }
    })


# ============================================================
# FM: EA ON/OFF CONTROL
# ============================================================

@csrf_exempt
@require_http_methods(["POST"])
def fm_toggle_ea(request):
    """Fund Manager toggles EA on/off for subscribers"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
    
    email = data.get('email', '').strip()
    action = data.get('action', '')  # 'ea_on' or 'ea_off'
    target = data.get('target', 'all')  # 'all' or assignment_id
    reason = data.get('reason', '').strip()
    password = data.get('password', '').strip()
    
    if action not in ('ea_on', 'ea_off'):
        return JsonResponse({'success': False, 'error': 'Invalid action'}, status=400)
    
    user = _resolve_user(email)
    if not user:
        return JsonResponse({'success': False, 'error': 'User not found'}, status=404)
    
    # Password required for stopping robots (ea_off)
    if action == 'ea_off':
        if not password:
            return JsonResponse({'success': False, 'error': 'Password is required to stop robots'}, status=400)
        if not user.check_password(password):
            return JsonResponse({'success': False, 'error': 'Incorrect password. Action denied.'}, status=403)
    
    fm = _get_fm_from_user(user)
    if not fm:
        return JsonResponse({'success': False, 'error': 'Not a fund manager'}, status=403)
    
    new_state = action == 'ea_on'
    now = timezone.now()
    
    if target == 'all':
        # Toggle all assigned accounts
        assignments = FMAccountAssignment.objects.filter(
            subscription__fund_manager=fm,
            subscription__status__in=['active', 'trial']
        )
        affected = assignments.update(
            is_ea_active=new_state,
            last_toggled_at=now,
            last_toggled_reason=reason or ('EA enabled by FM' if new_state else 'EA disabled by FM')
        )
        # Also update the actual License status for all affected licenses
        affected_license_ids = list(assignments.values_list('license_id', flat=True))
        if new_state:
            # FM starting: re-activate suspended licenses (only if not expired)
            License.objects.filter(
                id__in=affected_license_ids, status='suspended'
            ).exclude(expires_at__lt=now).update(status='active', updated_at=now)
        else:
            # FM stopping: suspend active licenses
            License.objects.filter(
                id__in=affected_license_ids, status='active'
            ).update(status='suspended', updated_at=now)
        target_type = 'all'
        target_assignment = None
    else:
        # Toggle specific account
        try:
            assignment = FMAccountAssignment.objects.get(
                id=target,
                subscription__fund_manager=fm,
                subscription__status__in=['active', 'trial']
            )
            assignment.is_ea_active = new_state
            assignment.last_toggled_at = now
            assignment.last_toggled_reason = reason or ('EA enabled by FM' if new_state else 'EA disabled by FM')
            assignment.save()
            # Also update the actual License status
            lic = assignment.license
            if new_state and lic.status == 'suspended' and lic.expires_at >= now:
                lic.status = 'active'
                lic.save(update_fields=['status', 'updated_at'])
            elif not new_state and lic.status == 'active':
                lic.status = 'suspended'
                lic.save(update_fields=['status', 'updated_at'])
            affected = 1
            target_type = 'specific'
            target_assignment = assignment
        except FMAccountAssignment.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Account assignment not found'}, status=404)
    
    # Log command
    cmd = FMCommand.objects.create(
        fund_manager=fm,
        command_type=action,
        target_type=target_type,
        target_assignment=target_assignment,
        reason=reason,
        status='executed',
        affected_accounts=affected,
        executed_at=now,
    )
    
    # Create TradeCommand entries for each affected license so EA can poll
    from core.models import TradeCommand
    tc_type = 'EA_ON' if action == 'ea_on' else 'EA_OFF'
    tc_reason = reason or ('FM enabled EA' if action == 'ea_on' else 'FM disabled EA')
    
    if target == 'all':
        affected_assignments = FMAccountAssignment.objects.filter(
            subscription__fund_manager=fm,
            subscription__status__in=['active', 'trial']
        ).select_related('license')
        for a in affected_assignments:
            TradeCommand.objects.create(
                license=a.license,
                command_type=tc_type,
                parameters={'fm_id': fm.id, 'fm_name': fm.display_name, 'reason': tc_reason},
                expires_at=now + timedelta(minutes=30),
            )
    else:
        if target_assignment:
            TradeCommand.objects.create(
                license=target_assignment.license,
                command_type=tc_type,
                parameters={'fm_id': fm.id, 'fm_name': fm.display_name, 'reason': tc_reason},
                expires_at=now + timedelta(minutes=30),
            )
    
    # Broadcast via WebSocket to notify chat subscribers
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'fm_chat_{fm.id}',
            {
                'type': 'fm_command',
                'data': {
                    'command_type': action,
                    'reason': tc_reason,
                    'affected_accounts': affected,
                    'fm_name': fm.display_name,
                    'timestamp': now.isoformat(),
                }
            }
        )
    except Exception:
        pass  # Non-critical if WebSocket broadcast fails

    # Send email notifications to affected subscribers
    try:
        if target == 'all':
            notify_assignments = FMAccountAssignment.objects.filter(
                subscription__fund_manager=fm,
                subscription__status__in=['active', 'trial']
            ).select_related('subscription__user')
        else:
            notify_assignments = [target_assignment] if target_assignment else []

        notified_users = set()
        for a in notify_assignments:
            sub_user = a.subscription.user
            if sub_user.id in notified_users:
                continue
            notified_users.add(sub_user.id)
            if new_state:
                _send_fm_email(
                    to_email=sub_user.email,
                    subject=f'Your Robot Has Been Started by {fm.display_name}',
                    heading='Robot Started by Fund Manager',
                    body_lines=[
                        f'Your fund manager <strong>{fm.display_name}</strong> has <strong>started your robot</strong>.',
                        f'Reason: {tc_reason}',
                        'Your MT5 EA is now active and trading will resume automatically.',
                        'If you have any concerns, please contact your fund manager via the FM chat.',
                    ],
                    cta_text='View Dashboard',
                    cta_url='/dashboard',
                )
            else:
                _send_fm_email(
                    to_email=sub_user.email,
                    subject=f'Your Robot Has Been Stopped by {fm.display_name}',
                    heading='Robot Stopped by Fund Manager',
                    body_lines=[
                        f'Your fund manager <strong>{fm.display_name}</strong> has <strong>stopped your robot</strong>.',
                        f'Reason: {tc_reason}',
                        'Your MT5 EA has been paused. No new trades will be opened until the robot is restarted.',
                        'If you have concerns or wish to unsubscribe, you can do so from the FM Engine page.',
                    ],
                    cta_text='View FM Engine',
                    cta_url='/dashboard/fund-managers',
                    extra_note='This action was taken by your fund manager as part of their trade management strategy.',
                )
    except Exception:
        pass  # Email is non-critical

    return JsonResponse({
        'success': True,
        'command': {
            'id': cmd.id,
            'action': action,
            'affected_accounts': affected,
            'reason': reason,
        }
    })


@csrf_exempt
@require_http_methods(["POST"])
def check_fm_ea_status(request):
    """EA calls this to check if FM has disabled trading for this license"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
    
    license_key = data.get('license_key', '').strip().upper()
    
    if not license_key:
        return JsonResponse({'success': False, 'error': 'License key required'}, status=400)
    
    try:
        lic = License.objects.get(license_key=license_key)
    except License.DoesNotExist:
        return JsonResponse({'success': True, 'ea_allowed': True})  # No license = no FM control
    
    # Check active FM assignments for this license
    active_assignments = FMAccountAssignment.objects.filter(
        license=lic,
        subscription__status__in=['active', 'trial']
    ).select_related('subscription__fund_manager').order_by('-assigned_at')
    assignment = active_assignments.first()
    
    if not assignment:
        return JsonResponse({'success': True, 'ea_allowed': True, 'has_fm': False})

    # Fail-safe: conflicting active FM assignments detected for same license
    conflict_count = active_assignments.count()
    if conflict_count > 1:
        return JsonResponse({
            'success': True,
            'ea_allowed': False,
            'has_fm': True,
            'fm_name': assignment.subscription.fund_manager.display_name,
            'reason': 'Conflicting FM assignments detected for this license. Trading is blocked until support resolves it.',
            'conflict_detected': True,
        })
    
    return JsonResponse({
        'success': True,
        'ea_allowed': assignment.is_ea_active,
        'has_fm': True,
        'fm_name': assignment.subscription.fund_manager.display_name,
        'reason': assignment.last_toggled_reason if not assignment.is_ea_active else '',
    })


# ============================================================
# FM: CHAT
# ============================================================

@csrf_exempt
@require_http_methods(["POST"])
def fm_get_chat(request):
    """Get chat messages for a fund manager's room"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
    
    email = data.get('email', '').strip()
    fm_id = data.get('fund_manager_id')
    page = data.get('page', 1)
    per_page = 50
    
    user = _resolve_user(email)
    if not user:
        return JsonResponse({'success': False, 'error': 'User not found'}, status=404)
    
    try:
        fm = FundManager.objects.get(id=fm_id)
    except FundManager.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Fund manager not found'}, status=404)
    
    # Check access: must be FM or subscriber
    is_fm = fm.user == user
    is_subscriber = FMSubscription.objects.filter(
        user=user, fund_manager=fm, status__in=['active', 'trial']
    ).exists()
    
    if not is_fm and not is_subscriber:
        return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)
    
    try:
        room = fm.chat_room
    except FMChatRoom.DoesNotExist:
        room = FMChatRoom.objects.create(fund_manager=fm, name=f"{fm.display_name}'s Community")
    
    # Get messages (newest first, paginated)
    offset = (page - 1) * per_page
    messages = room.messages.select_related('sender').order_by('-created_at')[offset:offset + per_page]
    
    # Get pinned messages
    pinned = room.messages.filter(is_pinned=True).select_related('sender').order_by('-created_at')[:5]
    
    def _serialize_msg(m, include_pinned=False):
        d = {
            'id': m.id,
            'sender_name': m.sender.first_name or m.sender.username,
            'sender_email': m.sender.email,
            'is_fm': m.sender == fm.user,
            'message': m.message,
            'message_type': m.message_type,
            'image_url': m.image.url if m.image else None,
            'voice_url': m.voice.url if m.voice else None,
            'reply_to': {
                'id': m.reply_to.id,
                'sender_name': m.reply_to.sender.first_name or m.reply_to.sender.username,
                'message': m.reply_to.message[:80],
                'message_type': m.reply_to.message_type,
            } if m.reply_to else None,
            'created_at': m.created_at.isoformat(),
        }
        if include_pinned:
            d['is_pinned'] = m.is_pinned
        return d

    return JsonResponse({
        'success': True,
        'room_name': room.name,
        'is_fm': is_fm,
        'messages': [_serialize_msg(m, include_pinned=True) for m in messages],
        'pinned': [_serialize_msg(m) for m in pinned],
    })


@csrf_exempt
@require_http_methods(["POST"])
def fm_send_message(request):
    """Send a message in FM chat room"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
    
    email = data.get('email', '').strip()
    fm_id = data.get('fund_manager_id')
    message_text = data.get('message', '').strip()
    message_type = data.get('message_type', 'message')
    reply_to_id = data.get('reply_to_id')

    if not message_text:
        return JsonResponse({'success': False, 'error': 'Message cannot be empty'}, status=400)

    # Profanity check
    matched = _contains_profanity(message_text)
    if matched:
        return JsonResponse({
            'success': False,
            'error': 'Your message contains inappropriate language. Please keep the chat professional.',
            'blocked': True,
        }, status=400)

    user = _resolve_user(email)
    if not user:
        return JsonResponse({'success': False, 'error': 'User not found'}, status=404)
    
    try:
        fm = FundManager.objects.get(id=fm_id)
    except FundManager.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Fund manager not found'}, status=404)
    
    # Check access
    is_fm = fm.user == user
    is_subscriber = FMSubscription.objects.filter(
        user=user, fund_manager=fm, status__in=['active', 'trial']
    ).exists()
    
    if not is_fm and not is_subscriber:
        return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)
    
    # Only FM can post announcements/signals
    if message_type in ('announcement', 'signal') and not is_fm:
        message_type = 'message'

    # Reply-to
    reply_to_obj = None
    if reply_to_id:
        try:
            reply_to_obj = FMChatMessage.objects.get(id=reply_to_id, chat_room__fund_manager=fm)
        except FMChatMessage.DoesNotExist:
            pass
    
    try:
        room = fm.chat_room
    except FMChatRoom.DoesNotExist:
        room = FMChatRoom.objects.create(fund_manager=fm, name=f"{fm.display_name}'s Community")
    
    msg = FMChatMessage.objects.create(
        chat_room=room,
        sender=user,
        message=message_text,
        message_type=message_type,
        reply_to=reply_to_obj,
    )
    
    msg_data = {
        'id': msg.id,
        'sender_name': user.first_name or user.username,
        'sender_email': user.email,
        'is_fm': is_fm,
        'message': msg.message,
        'message_type': msg.message_type,
        'image_url': None,
        'voice_url': None,
        'reply_to': {
            'id': reply_to_obj.id,
            'sender_name': reply_to_obj.sender.first_name or reply_to_obj.sender.username,
            'message': reply_to_obj.message[:80],
            'message_type': reply_to_obj.message_type,
        } if reply_to_obj else None,
        'created_at': msg.created_at.isoformat(),
    }
    
    # Broadcast via WebSocket to all connected chat clients
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        event_type = 'announcement' if message_type == 'announcement' else 'chat_message'
        async_to_sync(channel_layer.group_send)(
            f'fm_chat_{fm_id}',
            {
                'type': event_type,
                'data': msg_data,
            }
        )
    except Exception:
        pass  # Non-critical
    
    return JsonResponse({
        'success': True,
        'message': msg_data,
    })


@csrf_exempt
@require_http_methods(["POST"])
def fm_pin_message(request):
    """Pin/unpin a message (FM only)"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
    
    email = data.get('email', '').strip()
    message_id = data.get('message_id')
    pin = data.get('pin', True)
    
    user = _resolve_user(email)
    if not user:
        return JsonResponse({'success': False, 'error': 'User not found'}, status=404)
    
    try:
        msg = FMChatMessage.objects.select_related('chat_room__fund_manager').get(id=message_id)
    except FMChatMessage.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Message not found'}, status=404)
    
    # Only FM can pin
    if msg.chat_room.fund_manager.user != user:
        return JsonResponse({'success': False, 'error': 'Only the fund manager can pin messages'}, status=403)
    
    msg.is_pinned = pin
    msg.save(update_fields=['is_pinned'])
    
    return JsonResponse({'success': True, 'pinned': pin})


# ============================================================
# FM: REVIEWS
# ============================================================

@csrf_exempt
@require_http_methods(["POST"])
def submit_review(request):
    """Submit a review for a fund manager"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
    
    email = data.get('email', '').strip()
    fm_id = data.get('fund_manager_id')
    rating = data.get('rating')
    comment = data.get('comment', '').strip()
    
    if not rating or not (1 <= int(rating) <= 5):
        return JsonResponse({'success': False, 'error': 'Rating must be 1-5'}, status=400)
    
    user = _resolve_user(email)
    if not user:
        return JsonResponse({'success': False, 'error': 'User not found'}, status=404)
    
    try:
        fm = FundManager.objects.get(id=fm_id, status='approved')
    except FundManager.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Fund manager not found'}, status=404)
    
    # Must be/have been a subscriber
    has_sub = FMSubscription.objects.filter(user=user, fund_manager=fm).exists()
    if not has_sub:
        return JsonResponse({'success': False, 'error': 'You must be a subscriber to review'}, status=403)
    
    review, created = FMReview.objects.update_or_create(
        user=user,
        fund_manager=fm,
        defaults={'rating': int(rating), 'comment': comment}
    )
    
    return JsonResponse({
        'success': True,
        'review': {
            'rating': review.rating,
            'comment': review.comment,
            'created': created,
        }
    })


# ============================================================
# FM: SCHEDULES
# ============================================================

@csrf_exempt
@require_http_methods(["POST"])
def fm_manage_schedule(request):
    """Create/update/delete EA schedules"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
    
    email = data.get('email', '').strip()
    action = data.get('action', 'list')  # list, create, delete, toggle
    
    user = _resolve_user(email)
    if not user:
        return JsonResponse({'success': False, 'error': 'User not found'}, status=404)
    
    fm = _get_fm_from_user(user)
    if not fm:
        return JsonResponse({'success': False, 'error': 'Not a fund manager'}, status=403)
    
    if action == 'list':
        schedules = fm.schedules.all()
        return JsonResponse({
            'success': True,
            'schedules': [{
                'id': s.id,
                'name': s.name,
                'is_active': s.is_active,
                'day_of_week': s.day_of_week,
                'day_name': s.get_day_of_week_display(),
                'off_time': s.off_time.strftime('%H:%M'),
                'on_time': s.on_time.strftime('%H:%M'),
                'reason': s.reason,
            } for s in schedules]
        })
    
    elif action == 'create':
        from datetime import time as dt_time
        name = data.get('name', '').strip()
        day = data.get('day_of_week', 0)
        off_h, off_m = data.get('off_time', '12:00').split(':')
        on_h, on_m = data.get('on_time', '14:00').split(':')
        reason = data.get('reason', '').strip()
        
        schedule = FMSchedule.objects.create(
            fund_manager=fm,
            name=name or 'New Schedule',
            day_of_week=int(day),
            off_time=dt_time(int(off_h), int(off_m)),
            on_time=dt_time(int(on_h), int(on_m)),
            reason=reason,
        )
        # Notify all active subscribers of the new schedule
        active_subs = FMSubscription.objects.filter(
            fund_manager=fm, status__in=['active', 'trial']
        ).select_related('user')
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        day_label = day_names[int(day)] if int(day) < 7 else 'Weekly'
        for sub in active_subs:
            _send_fm_email(
                to_email=sub.user.email,
                subject=f'New Trading Schedule Set by {fm.display_name}',
                heading='New Robot Schedule Configured',
                body_lines=[
                    f'Your fund manager <strong>{fm.display_name}</strong> has created a new trading schedule.',
                    f'Schedule: <strong>{name or "New Schedule"}</strong>',
                    f'Day: {day_label} | Robot OFF at {off_h}:{off_m.zfill(2)} → Robot ON at {on_h}:{on_m.zfill(2)} UTC',
                    f'Reason: {reason or "Scheduled maintenance / economic event"}',
                    'Your robot will be automatically paused and resumed according to this schedule.',
                ],
                cta_text='View Schedule',
                cta_url=f'/dashboard/fund-managers/{fm.id}',
            )
        return JsonResponse({'success': True, 'schedule_id': schedule.id})
    
    elif action == 'delete':
        schedule_id = data.get('schedule_id')
        fm.schedules.filter(id=schedule_id).delete()
        return JsonResponse({'success': True})
    
    elif action == 'toggle':
        schedule_id = data.get('schedule_id')
        try:
            schedule = fm.schedules.get(id=schedule_id)
            schedule.is_active = not schedule.is_active
            schedule.save(update_fields=['is_active'])
            return JsonResponse({'success': True, 'is_active': schedule.is_active})
        except FMSchedule.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Schedule not found'}, status=404)
    
    return JsonResponse({'success': False, 'error': 'Invalid action'}, status=400)


# ============================================================
# FM: APPLY TO BECOME FUND MANAGER
# ============================================================

@csrf_exempt
@require_http_methods(["GET", "POST"])
def apply_fund_manager(request):
    """User applies to become a fund manager, or checks their application status"""
    if request.method == 'GET':
        email = request.GET.get('email', '').strip()
        user = _resolve_user(email)
        if not user:
            return JsonResponse({'success': False, 'status': None})
        existing = FundManager.objects.filter(user=user).first()
        if existing:
            return JsonResponse({'success': True, 'status': existing.status, 'display_name': existing.display_name})
        return JsonResponse({'success': True, 'status': None})

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
    
    email = data.get('email', '').strip()
    display_name = data.get('display_name', '').strip()
    bio = data.get('bio', '').strip()
    monthly_price = data.get('monthly_price', '29.00')
    trial_days = data.get('trial_days', '0')
    trading_style = data.get('trading_style', '').strip()
    trading_pairs = data.get('trading_pairs', 'XAUUSD').strip()
    
    if not display_name:
        return JsonResponse({'success': False, 'error': 'Display name is required'}, status=400)
    
    user = _resolve_user(email)
    if not user:
        return JsonResponse({'success': False, 'error': 'User not found'}, status=404)
    
    # Check if already applied
    existing = FundManager.objects.filter(user=user).first()
    if existing:
        return JsonResponse({
            'success': False,
            'error': f'You already have a fund manager application ({existing.get_status_display()})'
        }, status=400)
    
    fm = FundManager.objects.create(
        user=user,
        display_name=display_name,
        bio=bio,
        monthly_price=Decimal(str(monthly_price)),
        trial_days=int(trial_days) if str(trial_days).isdigit() and int(trial_days) >= 0 else 0,
        trading_style=trading_style,
        trading_pairs=trading_pairs,
        status='pending',
    )

    # Email applicant and notify admin
    _send_fm_email(
        to_email=user.email,
        subject='FM Engine Application Received — Under Review',
        heading='Application Submitted Successfully',
        body_lines=[
            f'Thank you for applying to become a Fund Manager on MarksTrades as <strong>{display_name}</strong>.',
            'Your application is currently <strong>under review</strong> by our admin team. This typically takes 1–3 business days.',
            'You will receive an email once your application has been approved or if additional information is needed.',
        ],
        cta_text='Check Application Status',
        cta_url='/dashboard/fund-managers/apply',
    )
    from core.utils import send_admin_notification
    send_admin_notification(
        subject=f'New FM Application: {display_name} ({email})',
        heading='New Fund Manager Application',
        html_body=f'<p><strong>{display_name}</strong> ({email}) has applied to become a Fund Manager.</p><p>Trading Style: {trading_style or "N/A"} | Pairs: {trading_pairs} | Price: ${monthly_price}/mo</p>',
        text_body=f'{display_name} ({email}) applied as a Fund Manager. Style: {trading_style} | Pairs: {trading_pairs}',
        preheader=f'New FM application from {email}',
    )

    return JsonResponse({
        'success': True,
        'message': 'Application submitted! It will be reviewed by our admin team.',
        'fund_manager': {
            'id': fm.id,
            'status': fm.status,
            'display_name': fm.display_name,
        }
    })


# ============================================================
# ECONOMIC CALENDAR
# ============================================================

@csrf_exempt
@require_http_methods(["GET"])
def get_economic_events(request):
    """Get upcoming economic events"""
    days_ahead = int(request.GET.get('days', 7))
    impact = request.GET.get('impact', '')  # low, medium, high
    
    now = timezone.now()
    end = now + timedelta(days=days_ahead)
    
    events = EconomicEvent.objects.filter(event_time__gte=now, event_time__lte=end)
    
    if impact:
        events = events.filter(impact=impact)
    
    return JsonResponse({
        'success': True,
        'events': [{
            'id': e.id,
            'title': e.title,
            'currency': e.currency,
            'impact': e.impact,
            'event_time': e.event_time.isoformat(),
            'forecast': e.forecast,
            'actual': e.actual,
            'previous': e.previous,
        } for e in events]
    })


# ============================================================
# TRADING WAVE ALERT
# ============================================================

@csrf_exempt
@require_http_methods(["GET"])
def get_trading_wave_alert(request):
    """Get all trading wave alerts with countdown info"""
    now = timezone.now()
    alerts = TradingWaveAlert.objects.all()

    result = []
    for a in alerts:
        # Calculate remaining seconds for countdown
        remaining_seconds = 0
        if a.is_active and a.activated_at and a.minutes_before > 0:
            end_time = a.activated_at + timedelta(minutes=a.minutes_before)
            time_diff = (end_time - now).total_seconds()
            remaining_seconds = max(0, int(time_diff))
        
        # Only include active alerts in the response
        if a.is_active:
            result.append({
                'mode': a.mode,
                'display_name': a.get_display_name(),
                'minutes_before': a.minutes_before,
                'tips': a.tips,
                'is_active': a.is_active,
                'activated_at': a.activated_at.isoformat() if a.activated_at else None,
                'remaining_seconds': remaining_seconds,
            })

    return JsonResponse({'success': True, 'alerts': result})


# ============================================================
# FM: LEADERBOARD
# ============================================================

@csrf_exempt
@require_http_methods(["GET"])
def fm_leaderboard(request):
    """Get fund manager leaderboard"""
    metric = request.GET.get('metric', 'profit')  # profit, rating, subscribers
    
    fms = FundManager.objects.filter(status='approved')
    
    if metric == 'rating':
        fms = fms.order_by('-average_rating', '-total_reviews')
    elif metric == 'subscribers':
        fms = fms.annotate(
            sub_count=Count('subscriptions', filter=Q(subscriptions__status__in=['active', 'trial']))
        ).order_by('-sub_count')
    else:  # profit
        fms = fms.order_by('-total_profit_percent')
    
    results = []
    for i, fm in enumerate(fms[:20], 1):
        days_joined = (timezone.now() - fm.user.date_joined).days
        if days_joined >= 365:
            join_label = f'{days_joined // 365}yr on Markstrade'
        elif days_joined >= 30:
            join_label = f'{days_joined // 30}mo on Markstrade'
        else:
            join_label = f'{days_joined}d on Markstrade'

        results.append({
            'rank': i,
            'id': fm.id,
            'display_name': fm.display_name,
            'avatar_url': fm.avatar.url if fm.avatar else None,
            'tier': fm.tier,
            'is_verified': fm.is_verified,
            'total_profit_percent': str(fm.total_profit_percent),
            'win_rate': str(fm.win_rate),
            'average_rating': str(fm.average_rating),
            'subscriber_count': fm.subscriber_count,
            'monthly_price': str(fm.monthly_price),
            'trading_style': fm.trading_style,
            'months_active': fm.months_active,
            'join_label': join_label,
            'date_joined': fm.user.date_joined.strftime('%b %Y'),
        })
    
    return JsonResponse({'success': True, 'leaderboard': results, 'metric': metric})


# ============================================================
# CHAT: PROFANITY FILTER
# ============================================================

BLOCKED_WORDS = [
    'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'pussy',
    'motherfucker', 'nigger', 'nigga', 'faggot', 'whore', 'slut', 'retard',
    'rape', 'kill yourself', 'kys', 'chutiya', 'madarchod', 'behenchod',
    'harami', 'sala', 'bokachoda', 'shala', 'kuttar bacha', 'magi',
]


def _contains_profanity(text: str) -> str | None:
    """Returns the matched word if profanity found, else None"""
    lower = text.lower()
    for word in BLOCKED_WORDS:
        if word in lower:
            return word
    return None


@csrf_exempt
@require_http_methods(["POST"])
def check_chat_profanity(request):
    """Frontend can call this to pre-check a message before sending"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
    text = data.get('text', '')
    matched = _contains_profanity(text)
    if matched:
        return JsonResponse({'success': True, 'blocked': True, 'matched': matched})
    return JsonResponse({'success': True, 'blocked': False})


# ============================================================
# CHAT: MEDIA UPLOAD (photo / voice)
# ============================================================

@csrf_exempt
@require_http_methods(["POST"])
def fm_chat_media_upload(request):
    """Upload a photo or voice message to FM chat"""
    email = request.POST.get('email', '').strip()
    fm_id = request.POST.get('fund_manager_id')
    media_type = request.POST.get('media_type', 'photo')  # 'photo' or 'voice'
    caption = request.POST.get('caption', '').strip()

    user = _resolve_user(email)
    if not user:
        return JsonResponse({'success': False, 'error': 'User not found'}, status=404)

    try:
        fm = FundManager.objects.get(id=fm_id)
    except (FundManager.DoesNotExist, TypeError, ValueError):
        return JsonResponse({'success': False, 'error': 'Fund manager not found'}, status=404)

    is_fm = fm.user == user
    is_subscriber = FMSubscription.objects.filter(
        user=user, fund_manager=fm, status__in=['active', 'trial']
    ).exists()
    if not is_fm and not is_subscriber:
        return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)

    # Profanity check on caption
    if caption:
        matched = _contains_profanity(caption)
        if matched:
            return JsonResponse({'success': False, 'error': f'Your message contains a blocked word.', 'blocked': True}, status=400)

    try:
        room = fm.chat_room
    except FMChatRoom.DoesNotExist:
        room = FMChatRoom.objects.create(fund_manager=fm, name=f"{fm.display_name}'s Community")

    msg = None
    if media_type == 'photo' and 'file' in request.FILES:
        img = request.FILES['file']
        allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        if img.content_type not in allowed:
            return JsonResponse({'success': False, 'error': 'Invalid image type'}, status=400)
        if img.size > 10 * 1024 * 1024:
            return JsonResponse({'success': False, 'error': 'Image too large. Max 10MB.'}, status=400)
        msg = FMChatMessage.objects.create(
            chat_room=room, sender=user, message=caption,
            message_type='photo', image=img
        )
    elif media_type == 'voice' and 'file' in request.FILES:
        audio = request.FILES['file']
        ct = audio.content_type.lower()
        is_valid_audio = (
            ct.startswith('audio/') or
            ct == 'application/octet-stream' or
            audio.name.endswith(('.webm', '.ogg', '.mp3', '.m4a', '.wav', '.aac'))
        )
        if not is_valid_audio:
            return JsonResponse({'success': False, 'error': 'Invalid audio type'}, status=400)
        if audio.size > 20 * 1024 * 1024:
            return JsonResponse({'success': False, 'error': 'Voice file too large. Max 20MB.'}, status=400)
        msg = FMChatMessage.objects.create(
            chat_room=room, sender=user, message=caption,
            message_type='voice', voice=audio
        )
    else:
        return JsonResponse({'success': False, 'error': 'No file provided'}, status=400)

    msg_data = {
        'id': msg.id,
        'sender_name': user.first_name or user.username,
        'sender_email': user.email,
        'is_fm': is_fm,
        'message': msg.message,
        'message_type': msg.message_type,
        'image_url': msg.image.url if msg.image else None,
        'voice_url': msg.voice.url if msg.voice else None,
        'reply_to': None,
        'created_at': msg.created_at.isoformat(),
    }

    # Broadcast via WebSocket
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'fm_chat_{fm.id}',
            {'type': 'chat_message', 'data': msg_data}
        )
    except Exception:
        pass

    return JsonResponse({'success': True, 'message': msg_data})


# ============================================================
# FM: AVATAR UPLOAD
# ============================================================

@csrf_exempt
@require_http_methods(["POST"])
def update_fm_avatar(request):
    """Fund manager uploads/updates their profile picture"""
    email = request.POST.get('email', '').strip()
    user = _resolve_user(email)
    if not user:
        return JsonResponse({'success': False, 'error': 'User not found'}, status=404)
    fm = _get_fm_from_user(user)
    if not fm:
        return JsonResponse({'success': False, 'error': 'Not a fund manager'}, status=403)
    if 'avatar' not in request.FILES:
        return JsonResponse({'success': False, 'error': 'No image file provided'}, status=400)
    img = request.FILES['avatar']
    allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if img.content_type not in allowed:
        return JsonResponse({'success': False, 'error': 'Invalid file type. Use JPEG, PNG, or WEBP.'}, status=400)
    if img.size > 5 * 1024 * 1024:
        return JsonResponse({'success': False, 'error': 'File too large. Max 5MB.'}, status=400)
    if fm.avatar:
        try:
            fm.avatar.delete(save=False)
        except Exception:
            pass
    fm.avatar = img
    fm.save(update_fields=['avatar'])
    return JsonResponse({'success': True, 'avatar_url': fm.avatar.url})


# ============================================================
# FM: SEED DUMMY FUND MANAGERS (dev/demo only)
# ============================================================

@csrf_exempt
@require_http_methods(["POST"])
def seed_dummy_fund_managers(request):
    """Create 5 dummy approved fund managers for demo purposes"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)

    secret = data.get('secret', '')
    if secret != 'dev_seed_fms':
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=403)

    dummies = [
        {
            'username': 'fm_alex_gold', 'email': 'alex.gold@fmdemo.com',
            'first_name': 'Alex', 'last_name': 'Gold',
            'display_name': 'Alex Gold', 'bio': 'Professional XAUUSD scalper with 5+ years of experience. Consistent monthly returns using precision grid strategies.',
            'trading_style': 'Conservative Scalping', 'trading_pairs': 'XAUUSD',
            'monthly_price': '29.00', 'total_profit_percent': '187.40', 'win_rate': '73.50',
            'months_active': 18, 'average_rating': '4.80', 'total_reviews': 42,
            'tier': 'elite', 'is_verified': True, 'is_featured': True, 'trial_days': 7, 'max_subscribers': 50,
        },
        {
            'username': 'fm_sarah_fx', 'email': 'sarah.fx@fmdemo.com',
            'first_name': 'Sarah', 'last_name': 'FX',
            'display_name': 'Sarah FX Pro', 'bio': 'Multi-pair forex specialist. Risk-managed approach to grow accounts steadily with minimal drawdown.',
            'trading_style': 'Swing Trading', 'trading_pairs': 'XAUUSD,EURUSD,GBPUSD',
            'monthly_price': '49.00', 'total_profit_percent': '124.80', 'win_rate': '68.20',
            'months_active': 12, 'average_rating': '4.60', 'total_reviews': 29,
            'tier': 'professional', 'is_verified': True, 'is_featured': False, 'trial_days': 5, 'max_subscribers': 30,
        },
        {
            'username': 'fm_mark_quant', 'email': 'mark.quant@fmdemo.com',
            'first_name': 'Mark', 'last_name': 'Quant',
            'display_name': 'Mark Quant', 'bio': 'Algorithmic grid trader. Uses data-driven schedules to avoid high-impact news events and maximize clean sessions.',
            'trading_style': 'Aggressive Grid', 'trading_pairs': 'XAUUSD,BTCUSD',
            'monthly_price': '39.00', 'total_profit_percent': '231.60', 'win_rate': '65.90',
            'months_active': 24, 'average_rating': '4.40', 'total_reviews': 55,
            'tier': 'elite', 'is_verified': True, 'is_featured': True, 'trial_days': 0, 'max_subscribers': 100,
        },
        {
            'username': 'fm_leo_trader', 'email': 'leo.trader@fmdemo.com',
            'first_name': 'Leo', 'last_name': 'Trader',
            'display_name': 'Leo Trader', 'bio': 'Beginner-friendly fund manager. Focuses on low-risk setups and transparent communication with all subscribers.',
            'trading_style': 'Low Risk Scalping', 'trading_pairs': 'XAUUSD',
            'monthly_price': '19.00', 'total_profit_percent': '67.30', 'win_rate': '71.00',
            'months_active': 6, 'average_rating': '4.20', 'total_reviews': 18,
            'tier': 'standard', 'is_verified': False, 'is_featured': False, 'trial_days': 7, 'max_subscribers': 20,
        },
        {
            'username': 'fm_nina_capital', 'email': 'nina.capital@fmdemo.com',
            'first_name': 'Nina', 'last_name': 'Capital',
            'display_name': 'Nina Capital', 'bio': 'Institutional-style fund manager. Strict risk parameters, weekly performance reports, and daily market analysis for subscribers.',
            'trading_style': 'Institutional Scalping', 'trading_pairs': 'XAUUSD,EURUSD',
            'monthly_price': '59.00', 'total_profit_percent': '156.70', 'win_rate': '76.40',
            'months_active': 15, 'average_rating': '4.90', 'total_reviews': 37,
            'tier': 'professional', 'is_verified': True, 'is_featured': False, 'trial_days': 3, 'max_subscribers': 40,
        },
    ]

    created_count = 0
    skipped_count = 0
    for d in dummies:
        user_obj, user_created = User.objects.get_or_create(
            username=d['username'],
            defaults={
                'email': d['email'],
                'first_name': d['first_name'],
                'last_name': d['last_name'],
            }
        )
        if user_created:
            user_obj.set_password('DemoPass@123')
            user_obj.save()

        fm_obj, fm_created = FundManager.objects.get_or_create(
            user=user_obj,
            defaults={
                'display_name': d['display_name'],
                'bio': d['bio'],
                'trading_style': d['trading_style'],
                'trading_pairs': d['trading_pairs'],
                'monthly_price': Decimal(d['monthly_price']),
                'total_profit_percent': Decimal(d['total_profit_percent']),
                'win_rate': Decimal(d['win_rate']),
                'months_active': d['months_active'],
                'average_rating': Decimal(d['average_rating']),
                'total_reviews': d['total_reviews'],
                'tier': d['tier'],
                'is_verified': d['is_verified'],
                'is_featured': d['is_featured'],
                'trial_days': d['trial_days'],
                'max_subscribers': d['max_subscribers'],
                'status': 'approved',
            }
        )
        if fm_created:
            created_count += 1
        else:
            skipped_count += 1

    return JsonResponse({
        'success': True,
        'created': created_count,
        'skipped': skipped_count,
        'message': f'{created_count} dummy fund managers created, {skipped_count} already existed.',
    })


# ============================================================
# BADGES API
# ============================================================

@csrf_exempt
@require_http_methods(["GET"])
def get_user_badges(request):
    """Get badges for a user — manual + dynamic join-date badge"""
    from core.models import Badge, UserBadge
    email = request.GET.get('email', '').strip()
    user = _resolve_user(email)
    if not user:
        return JsonResponse({'success': False, 'error': 'User not found'}, status=404)

    # Manual badges awarded by admin
    awarded = UserBadge.objects.filter(user=user).select_related('badge')
    badges = [{
        'id': ub.badge.id,
        'name': ub.badge.name,
        'description': ub.badge.description,
        'icon': ub.badge.icon,
        'color': ub.badge.color,
        'badge_type': 'manual',
        'awarded_at': ub.awarded_at.isoformat(),
    } for ub in awarded if ub.badge.is_active]

    # Dynamic join-duration badge
    days_since_join = (timezone.now() - user.date_joined).days
    if days_since_join >= 365:
        label = f'{days_since_join // 365}yr Member'
    elif days_since_join >= 30:
        label = f'{days_since_join // 30}mo Member'
    else:
        label = f'{days_since_join}d Member'

    badges.append({
        'id': 'join',
        'name': label,
        'description': f'Member since {user.date_joined.strftime("%b %Y")}',
        'icon': 'clock',
        'color': 'text-cyan-400',
        'badge_type': 'auto_join',
        'awarded_at': user.date_joined.isoformat(),
    })

    return JsonResponse({'success': True, 'badges': badges, 'username': user.first_name or user.username})
