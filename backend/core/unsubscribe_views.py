from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.models import User
from django.utils import timezone
import json

from .models import EmailPreference


def _resolve_user_from_token(token):
    try:
        from django.core import signing
        payload = signing.loads(token, salt='email-unsubscribe')
        uid = payload.get('uid')
        email = (payload.get('email') or '').strip().lower()
        if not uid or not email:
            return None
        user = User.objects.filter(id=uid, email=email).first()
        return user
    except Exception:
        return None


def _unsubscribe_user(user):
    pref, _ = EmailPreference.objects.get_or_create(user=user)
    if pref.marketing_emails is False and pref.transactional_emails is False:
        return False
    pref.marketing_emails = False
    pref.transactional_emails = False
    pref.unsubscribed_at = timezone.now()
    pref.save()
    return True


@csrf_exempt
@require_http_methods(["GET"])
def unsubscribe_one_click(request):
    token = (request.GET.get('token') or '').strip()
    if not token:
        return JsonResponse({'success': False, 'message': 'Missing token'}, status=400)

    user = _resolve_user_from_token(token)
    if not user:
        return JsonResponse({'success': False, 'message': 'Invalid token'}, status=400)

    changed = _unsubscribe_user(user)
    return JsonResponse({
        'success': True,
        'message': 'You have been unsubscribed from emails.' if changed else 'You are already unsubscribed.'
    })


@csrf_exempt
@require_http_methods(["POST"])
def unsubscribe(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid request'}, status=400)

    token = (data.get('token') or '').strip()
    email = (data.get('email') or '').strip().lower()

    user = None
    if token:
        user = _resolve_user_from_token(token)
    elif email:
        user = User.objects.filter(email=email).first()

    if not user:
        return JsonResponse({'success': False, 'message': 'User not found'}, status=404)

    changed = _unsubscribe_user(user)
    return JsonResponse({
        'success': True,
        'message': 'You have been unsubscribed from emails.' if changed else 'You are already unsubscribed.'
    })


@csrf_exempt
@require_http_methods(["POST"])
def resubscribe(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid request'}, status=400)
    
    email = (data.get('email') or '').strip().lower()
    
    if not email:
        return JsonResponse({'success': False, 'message': 'Email is required'}, status=400)
    
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Email not found'}, status=404)
    
    # Get or create email preference
    pref, created = EmailPreference.objects.get_or_create(user=user)
    
    if pref.marketing_emails and pref.transactional_emails:
        return JsonResponse({
            'success': True,
            'message': 'You are already subscribed.'
        })

    pref.marketing_emails = True
    pref.transactional_emails = True
    pref.unsubscribed_at = None
    pref.save()

    return JsonResponse({
        'success': True,
        'message': 'You have been re-subscribed.'
    })
