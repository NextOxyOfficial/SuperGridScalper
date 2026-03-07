import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.conf import settings as django_settings
from .models import VPSPlan, VPSOrder, VPSServer, PaymentNetwork
from .views import resolve_user


@require_http_methods(["GET"])
def get_vps_plans(request):
    """Get all active VPS plans"""
    plans = VPSPlan.objects.filter(is_active=True)
    return JsonResponse({
        'success': True,
        'plans': [
            {
                'id': p.id,
                'name': p.name,
                'description': p.description,
                'cpu': p.cpu,
                'ram': p.ram,
                'storage': p.storage,
                'os': p.os,
                'bandwidth': p.bandwidth,
                'location': p.location,
                'price_monthly': float(p.price_monthly),
                'price_quarterly': float(p.price_quarterly) if p.price_quarterly else None,
                'price_yearly': float(p.price_yearly) if p.price_yearly else None,
                'features': p.features or [],
                'is_popular': p.is_popular,
            }
            for p in plans
        ]
    })


@csrf_exempt
@require_http_methods(["POST"])
def create_vps_order(request):
    """Create a VPS order with payment proof"""
    email = (request.POST.get('email') or '').strip()
    plan_id = (request.POST.get('plan_id') or '').strip()
    billing_cycle = (request.POST.get('billing_cycle') or 'monthly').strip()
    network_id = (request.POST.get('network_id') or '').strip()
    txid = (request.POST.get('txid') or '').strip()
    user_note = (request.POST.get('user_note') or '').strip()
    proof = request.FILES.get('proof')

    if not email or not plan_id or not network_id:
        return JsonResponse({'success': False, 'error': 'Email, plan, and payment network are required'}, status=400)

    if not proof:
        return JsonResponse({'success': False, 'error': 'Payment proof file is required'}, status=400)

    user = resolve_user(email)
    if not user:
        return JsonResponse({'success': False, 'error': 'User not found'}, status=404)

    try:
        plan = VPSPlan.objects.get(id=plan_id, is_active=True)
    except VPSPlan.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Invalid plan selected'}, status=400)

    try:
        network = PaymentNetwork.objects.get(id=network_id, is_active=True)
    except PaymentNetwork.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Invalid payment network'}, status=400)

    # Calculate amount based on billing cycle
    if billing_cycle == 'quarterly' and plan.price_quarterly:
        amount = plan.price_quarterly
    elif billing_cycle == 'yearly' and plan.price_yearly:
        amount = plan.price_yearly
    else:
        amount = plan.price_monthly
        billing_cycle = 'monthly'

    order = VPSOrder.objects.create(
        user=user,
        plan=plan,
        billing_cycle=billing_cycle,
        amount_paid=amount,
        network=network,
        txid=txid,
        proof=proof,
        user_note=user_note,
        status='pending',
    )

    # Send admin notification
    try:
        from core.utils import send_admin_notification
        send_admin_notification(
            subject=f'Admin Alert: New VPS Order #{order.order_number}',
            heading='New VPS Order',
            html_body=(
                f"<p><strong>User:</strong> {user.email}</p>"
                f"<p><strong>Plan:</strong> {plan.name}</p>"
                f"<p><strong>Billing:</strong> {order.get_billing_cycle_display()}</p>"
                f"<p><strong>Amount:</strong> ${float(amount)} {network.token_symbol}</p>"
                f"<p><strong>Network:</strong> {network.name}</p>"
                f"<p><strong>TXID:</strong> {txid or '-'}</p>"
                f"<p><strong>Status:</strong> PENDING ACTIVATION</p>"
            ),
            text_body=(
                f"New VPS order\n"
                f"User: {user.email}\n"
                f"Plan: {plan.name}\n"
                f"Billing: {order.get_billing_cycle_display()}\n"
                f"Amount: ${float(amount)} {network.token_symbol}\n"
                f"Network: {network.name}\n"
                f"TXID: {txid or '-'}\n"
                f"Order: #{order.order_number}"
            ),
            preheader=f'New VPS order #{order.order_number} from {user.email}'
        )
    except Exception:
        pass

    # Send user confirmation email
    try:
        from core.utils import get_email_from_address, render_email_template, add_email_headers, can_send_email_to_user, get_unsubscribe_url
        from django.core.mail import EmailMultiAlternatives

        base = (getattr(django_settings, 'FRONTEND_URL', '') or 'https://markstrades.com').rstrip('/')
        subject = f'VPS Order Received - #{order.order_number}'

        if can_send_email_to_user(user, 'transactional'):
            html_message = render_email_template(
                subject=subject,
                heading='VPS Order Received',
                message=f"""
                    <p>Hi <strong>{user.first_name or 'Trader'}</strong>,</p>
                    <p>We received your VPS order and payment proof. Your server is now <strong style="color: #fbbf24;">pending activation</strong>.</p>
                    <div style="background-color: rgba(6, 182, 212, 0.1); border-left: 3px solid #06b6d4; padding: 16px; margin: 20px 0; border-radius: 4px;">
                        <p style="margin: 0 0 8px 0; color: #06b6d4; font-weight: 600;">Order Details:</p>
                        <p style="margin: 4px 0; color: #d1d5db;"><strong>Order:</strong> #{order.order_number}</p>
                        <p style="margin: 4px 0; color: #d1d5db;"><strong>Plan:</strong> {plan.name} ({plan.cpu}, {plan.ram}, {plan.storage})</p>
                        <p style="margin: 4px 0; color: #d1d5db;"><strong>Billing:</strong> {order.get_billing_cycle_display()}</p>
                        <p style="margin: 4px 0; color: #d1d5db;"><strong>Amount:</strong> ${float(amount)}</p>
                    </div>
                    <p><strong>Next:</strong> Our team will verify payment and set up your server. You'll receive an email with RDP credentials once ready.</p>
                """,
                cta_text='TRACK ORDER',
                cta_url=f'{base}/dashboard/vps',
                footer_note='Server setup usually takes 1-24 hours after payment verification.',
                preheader=f'VPS order #{order.order_number} received. Pending activation.',
                unsubscribe_url=get_unsubscribe_url(user)
            )
            text_msg = f"Hi {user.first_name or 'Trader'},\n\nVPS order received!\nOrder: #{order.order_number}\nPlan: {plan.name}\nAmount: ${float(amount)}\nStatus: Pending Activation\n\nDashboard: {base}/dashboard/vps"
            msg = EmailMultiAlternatives(subject, text_msg, get_email_from_address(), [user.email])
            msg.attach_alternative(html_message, "text/html")
            msg = add_email_headers(msg, 'transactional', user=user)
            msg.send(fail_silently=False)
    except Exception as e:
        print(f"VPS order email error: {e}")

    proof_url = None
    if order.proof:
        try:
            proof_url = request.build_absolute_uri(order.proof.url)
        except Exception:
            proof_url = None

    return JsonResponse({
        'success': True,
        'message': 'VPS order submitted successfully! Pending activation.',
        'order': {
            'id': order.id,
            'order_number': order.order_number,
            'status': order.status,
            'plan': plan.name,
            'billing_cycle': order.billing_cycle,
            'amount_paid': float(order.amount_paid),
            'created_at': order.created_at.isoformat(),
        }
    })


@csrf_exempt
@require_http_methods(["POST"])
def get_my_vps_orders(request):
    """Get all VPS orders for a user"""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)

    email = (data.get('email') or '').strip()
    if not email:
        return JsonResponse({'success': False, 'error': 'Email is required'}, status=400)

    user = resolve_user(email)
    if not user:
        return JsonResponse({'success': False, 'error': 'User not found'}, status=404)

    orders = VPSOrder.objects.filter(user=user).select_related('plan', 'network').prefetch_related('server')
    items = []
    for order in orders:
        server_data = None
        try:
            server = order.server
            if server:
                server_data = {
                    'ip_address': server.ip_address,
                    'rdp_port': server.rdp_port,
                    'username': server.username,
                    'password': server.password,
                    'hostname': server.hostname,
                    'additional_info': server.additional_info,
                }
        except VPSServer.DoesNotExist:
            pass

        items.append({
            'id': order.id,
            'order_number': order.order_number,
            'status': order.status,
            'plan': {
                'name': order.plan.name,
                'cpu': order.plan.cpu,
                'ram': order.plan.ram,
                'storage': order.plan.storage,
                'os': order.plan.os,
            },
            'billing_cycle': order.billing_cycle,
            'amount_paid': float(order.amount_paid),
            'activated_at': order.activated_at.isoformat() if order.activated_at else None,
            'expires_at': order.expires_at.isoformat() if order.expires_at else None,
            'days_remaining': order.days_remaining,
            'created_at': order.created_at.isoformat(),
            'server': server_data,
            'network': order.network.name if order.network else None,
            'txid': order.txid,
            'admin_note': order.admin_note,
        })

    return JsonResponse({'success': True, 'orders': items})
