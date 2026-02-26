from django.conf import settings as django_settings


def get_email_from_address():
    """
    Get the properly formatted From email address with name
    Returns: "Name <email@example.com>" format
    """
    try:
        from core.models import SMTPSettings
        smtp_config = SMTPSettings.objects.filter(is_active=True).first()
        
        if smtp_config and smtp_config.from_name:
            return f"{smtp_config.from_name} <{smtp_config.from_email}>"
        elif smtp_config:
            return smtp_config.from_email
    except Exception:
        pass
    
    # Fallback to settings
    return getattr(django_settings, 'DEFAULT_FROM_EMAIL', 'support@markstrades.com')


def get_admin_notification_email():
    try:
        from core.models import SiteSettings
        s = SiteSettings.get_settings()
        email = (getattr(s, 'admin_notification_email', '') or '').strip().lower()
        return email or None
    except Exception:
        return None


def send_admin_notification(subject, heading, html_body, text_body, preheader=None):
    admin_email = get_admin_notification_email()
    if not admin_email:
        return

    try:
        from django.core.mail import EmailMultiAlternatives

        html_message = render_email_template(
            subject=subject,
            heading=heading,
            message=html_body,
            footer_note='This is an internal notification sent to the site administrator.',
            preheader=preheader or subject,
            unsubscribe_url=get_unsubscribe_url(None)
        )

        msg = EmailMultiAlternatives(
            subject,
            text_body,
            get_email_from_address(),
            [admin_email]
        )
        msg.attach_alternative(html_message, 'text/html')
        msg = add_email_headers(msg, 'transactional', user=None)
        msg.send(fail_silently=False)
    except Exception:
        return


def make_unsubscribe_token(user):
    try:
        from django.core import signing
        payload = {
            'uid': user.id,
            'email': (user.email or '').strip().lower(),
        }
        return signing.dumps(payload, salt='email-unsubscribe')
    except Exception:
        return None


def get_unsubscribe_url(user=None):
    base_url = getattr(django_settings, 'FRONTEND_URL', 'https://markstrades.com').rstrip('/')
    if not user:
        return f'{base_url}/unsubscribe'

    token = make_unsubscribe_token(user)
    if not token:
        return f'{base_url}/unsubscribe'
    return f'{base_url}/unsubscribe?token={token}'


def get_unsubscribe_api_url(user=None):
    base_url = getattr(django_settings, 'FRONTEND_URL', 'https://markstrades.com').rstrip('/')
    if not user:
        return f'{base_url}/api/unsubscribe/one-click/'

    token = make_unsubscribe_token(user)
    if not token:
        return f'{base_url}/api/unsubscribe/one-click/'
    return f'{base_url}/api/unsubscribe/one-click/?token={token}'


def add_email_headers(msg, email_type='transactional', user=None):
    """
    Add proper email headers to improve deliverability and avoid spam
    """
    import uuid
    from datetime import datetime
    
    # Add Message-ID for better tracking and deliverability
    msg.extra_headers['Message-ID'] = f"<{uuid.uuid4()}@markstrades.com>"
    
    # Add Date header
    msg.extra_headers['Date'] = datetime.utcnow().strftime('%a, %d %b %Y %H:%M:%S +0000')
    
    # Add List-Unsubscribe header (per-recipient one-click link)
    unsubscribe_url = get_unsubscribe_api_url(user)
    msg.extra_headers['List-Unsubscribe'] = f'<{unsubscribe_url}>'
    msg.extra_headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
    
    # Add priority headers for transactional emails
    if email_type == 'transactional':
        msg.extra_headers['X-Priority'] = '1'
        msg.extra_headers['Importance'] = 'high'
        msg.extra_headers['X-MSMail-Priority'] = 'High'
    
    # Add anti-spam headers
    msg.extra_headers['X-Mailer'] = 'MarksTrades Email System'
    msg.extra_headers['X-Auto-Response-Suppress'] = 'OOF, AutoReply'
    
    return msg


def can_send_email_to_user(user, email_type='transactional'):
    """
    Check if we can send email to this user based on their preferences
    email_type: 'transactional' (always allowed) or 'marketing' (can be disabled)
    """
    # Critical emails (password reset, security) should always be allowed
    if email_type == 'critical':
        return True
    
    try:
        from core.models import EmailPreference
        pref = EmailPreference.objects.filter(user=user).first()
        if not pref:
            return True
        if email_type == 'transactional':
            return bool(pref.transactional_emails)
        if email_type == 'marketing':
            return bool(pref.marketing_emails)
        return True
    except Exception:
        # If error, allow email (fail-safe)
        return True


def _to_https_absolute_url(url_or_path):
    """Normalize a URL/path into an absolute HTTPS URL for email clients."""
    if not url_or_path:
        return ''

    url_or_path = str(url_or_path).strip()
    if not url_or_path:
        return ''

    if url_or_path.startswith('https://'):
        return url_or_path
    if url_or_path.startswith('http://'):
        return 'https://' + url_or_path[len('http://'):]
    if url_or_path.startswith('//'):
        return f'https:{url_or_path}'

    base = (getattr(django_settings, 'FRONTEND_URL', '') or 'https://markstrades.com').rstrip('/')
    if base.startswith('http://'):
        base = 'https://' + base[len('http://'):]
    if not url_or_path.startswith('/'):
        url_or_path = f'/{url_or_path}'
    return f'{base}{url_or_path}'


def _is_email_safe_image(url):
    """Email clients (e.g., Gmail) often fail on ICO/SVG/data URI in <img> tags."""
    clean = (url or '').split('?', 1)[0].lower()
    return clean.endswith(('.png', '.jpg', '.jpeg', '.gif'))


def get_email_logo_url():
    """Get the site favicon/logo URL for emails from SiteSettings"""
    try:
        from core.models import SiteSettings
        s = SiteSettings.get_settings()

        # Prefer logo first for email compatibility (favicon is often .ico).
        if s.logo and getattr(s.logo, 'name', None):
            try:
                if not s.logo.storage.exists(s.logo.name):
                    raise FileNotFoundError('Logo file not found in storage')
            except Exception:
                pass
            else:
                logo_url = _to_https_absolute_url(s.logo.url)
                if _is_email_safe_image(logo_url):
                    return logo_url

        if s.favicon and getattr(s.favicon, 'name', None):
            try:
                if not s.favicon.storage.exists(s.favicon.name):
                    raise FileNotFoundError('Favicon file not found in storage')
            except Exception:
                pass
            else:
                favicon_url = _to_https_absolute_url(s.favicon.url)
                if _is_email_safe_image(favicon_url):
                    return favicon_url
    except Exception:
        pass

    # Final fallback: hosted PNG from frontend public assets.
    base = (getattr(django_settings, 'FRONTEND_URL', '') or 'https://markstrades.com').rstrip('/')
    if base.startswith('http://'):
        base = 'https://' + base[len('http://'):]
    return f'{base}/marks-ai-robot.png'


def render_email_template(subject, heading, message, cta_text=None, cta_url=None, footer_note=None, preheader=None, unsubscribe_url=None):
    """
    Render professional HTML email template matching website design
    
    Args:
        subject: Email subject line
        heading: Main heading text
        message: Main message content (can include HTML)
        cta_text: Optional call-to-action button text
        cta_url: Optional call-to-action button URL
        footer_note: Optional footer note text
        preheader: Optional preview text (shows in inbox preview)
    
    Returns:
        HTML email string
    """
    
    # Default preheader if not provided
    if not preheader:
        preheader = "MarksTrades - Professional AI Trading Automation"

    if not unsubscribe_url:
        unsubscribe_url = get_unsubscribe_url(None)
    
    # Build CTA button if provided
    cta_html = ""
    if cta_text and cta_url:
        cta_html = f"""
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
            <tr>
                <td align="center">
                    <a href="{cta_url}" class="cta-button" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: #000000; font-weight: bold; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; letter-spacing: 0.5px;">
                        {cta_text}
                    </a>
                </td>
            </tr>
        </table>
        """
    
    # Build footer note if provided
    footer_note_html = ""
    if footer_note:
        footer_note_html = f"""
        <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 20px 0 0 0;">
            {footer_note}
        </p>
        """
    
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="x-apple-disable-message-reformatting">
    <title>{subject}</title>
    <!--[if mso]>
    <style type="text/css">
        body, table, td {{font-family: Arial, Helvetica, sans-serif !important;}}
    </style>
    <![endif]-->
    <style type="text/css">
        body {{ margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }}
        table {{ border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }}
        img {{ border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }}
        @media only screen and (max-width: 620px) {{
            .email-wrapper {{ padding: 8px !important; }}
            .email-container {{ border-radius: 12px !important; }}
            .email-header {{ padding: 20px 16px !important; }}
            .email-content {{ padding: 24px 16px !important; }}
            .email-footer {{ padding: 20px 16px !important; }}
            .email-heading {{ font-size: 18px !important; }}
            .email-body {{ font-size: 14px !important; }}
            .cta-button {{ padding: 12px 24px !important; font-size: 13px !important; }}
            .info-box {{ padding: 12px !important; }}
            .info-box p {{ font-size: 13px !important; }}
        }}
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; width: 100%;">
    <!-- Preheader text (hidden but shows in inbox preview) -->
    <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">{preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0f;">
        <tr>
            <td align="center" class="email-wrapper" style="padding: 16px 8px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-container" style="max-width: 560px; background-color: #12121a; border: 1px solid rgba(6, 182, 212, 0.2); border-radius: 16px; overflow: hidden;">
                    
                    <!-- Header -->
                    <tr>
                        <td class="email-header" style="background: linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(6, 182, 212, 0.05) 100%); padding: 24px 28px; border-bottom: 1px solid rgba(6, 182, 212, 0.25);">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td width="40" style="vertical-align: middle; padding-right: 12px;">
                                        <img src="{get_email_logo_url()}" alt="M" width="40" height="40" style="display: block; width: 40px; height: 40px; border-radius: 8px;">
                                    </td>
                                    <td style="vertical-align: middle;">
                                        <h1 style="margin: 0; font-family: 'Orbitron', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 20px; font-weight: 700; color: #06b6d4; letter-spacing: 0.5px;">
                                            Mark's AI 3.0
                                        </h1>
                                        <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280; letter-spacing: 0.3px;">
                                            AI Powered Trading Automation
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td class="email-content" style="padding: 28px;">
                            <h2 class="email-heading" style="margin: 0 0 20px 0; font-family: 'Orbitron', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 18px; font-weight: 600; color: #ffffff; letter-spacing: 0.3px;">
                                {heading}
                            </h2>
                            
                            <div class="email-body" style="color: #d1d5db; font-size: 14px; line-height: 1.7;">
                                {message}
                            </div>
                            
                            {cta_html}
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td class="email-footer" style="background-color: rgba(6, 182, 212, 0.05); padding: 24px 28px; border-top: 1px solid rgba(6, 182, 212, 0.15);">
                            <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">
                                <strong style="color: #06b6d4;">Need Help?</strong><br>
                                Contact us at 
                                <a href="mailto:support@markstrades.com" style="color: #06b6d4; text-decoration: none;">support@markstrades.com</a>
                            </p>
                            
                            {footer_note_html}
                            
                            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(107, 114, 128, 0.15);">
                                <p style="margin: 0 0 8px 0; color: #4b5563; font-size: 11px; line-height: 1.5; text-align: center;">
                                    &copy; 2025-2026 MarksTrades. All rights reserved.
                                </p>
                                <p style="margin: 0; color: #4b5563; font-size: 11px; text-align: center;">
                                    <a href="{unsubscribe_url}" style="color: #06b6d4; text-decoration: underline;">Unsubscribe</a>
                                </p>
                            </div>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""
    
    return html


def send_wave_alert_emails(alert_mode, minutes_before, tips):
    """
    Send Trading Wave Alert email to all unique users who have at least one active license.
    One email per user regardless of how many licenses they have.
    Runs in a background thread so admin save is not blocked.
    """
    import threading

    def _send():
        try:
            from django.core.mail import EmailMultiAlternatives
            from core.models import License, EmailPreference

            # Get distinct users with at least one active license
            active_licenses = License.objects.filter(status='active').select_related('user')
            seen_user_ids = set()
            users_to_email = []
            for lic in active_licenses:
                if lic.user_id not in seen_user_ids:
                    seen_user_ids.add(lic.user_id)
                    users_to_email.append(lic.user)

            mode_labels = {
                'normal': 'Normal Impact Running',
                'medium': 'Medium Impact Expecting',
                'high': 'High Impact Expecting',
            }
            mode_emojis = {
                'normal': '☀️',
                'medium': '⛈️',
                'high': '🌋',
            }
            mode_colors = {
                'normal': '#10b981',
                'medium': '#f59e0b',
                'high': '#ef4444',
            }
            mode_tags = {
                'normal': '🌸 Sunny Day',
                'medium': '🌧️ Hard Day',
                'high': '🔥 Fire Zone',
            }

            label = mode_labels.get(alert_mode, alert_mode)
            emoji = mode_emojis.get(alert_mode, '⚠️')
            color = mode_colors.get(alert_mode, '#06b6d4')
            tag = mode_tags.get(alert_mode, '')

            subject = f'{emoji} Trading Wave Alert: {label}'
            if minutes_before and minutes_before > 0:
                subject += f' in {minutes_before} min'

            countdown_html = ''
            if minutes_before and minutes_before > 0:
                countdown_html = f"""
                <div style="display:inline-block;background:{color}22;border:1px solid {color}44;border-radius:8px;padding:6px 14px;margin-top:8px;">
                    <span style="font-family:monospace;font-size:18px;font-weight:bold;color:{color};">
                        ⏱ {minutes_before} minutes
                    </span>
                </div>
                """

            tips_html = ''
            if tips and tips.strip():
                tips_html = f"""
                <div style="background:#1a1a2e;border-left:3px solid {color};border-radius:6px;padding:12px 16px;margin-top:14px;">
                    <p style="color:#9ca3af;font-size:12px;margin:0 0 4px 0;font-weight:bold;">💡 TIPS</p>
                    <p style="color:#d1d5db;font-size:14px;margin:0;line-height:1.6;">{tips}</p>
                </div>
                """

            body_html = f"""
            <div style="text-align:center;padding:10px 0 16px;">
                <span style="font-size:48px;">{emoji}</span>
            </div>
            <div style="text-align:center;">
                <span style="display:inline-block;background:{color}22;color:{color};font-size:11px;font-weight:bold;padding:4px 12px;border-radius:20px;letter-spacing:1px;">{tag}</span>
            </div>
            <p style="color:#e5e7eb;font-size:16px;line-height:1.6;margin-top:16px;text-align:center;">
                <strong style="color:{color};">{label}</strong>
            </p>
            {countdown_html}
            {tips_html}
            <p style="color:#6b7280;font-size:13px;margin-top:20px;text-align:center;">
                Please review your open positions and take necessary precautions.
            </p>
            """

            from_addr = get_email_from_address()
            base_url = getattr(django_settings, 'FRONTEND_URL', 'https://markstrades.com').rstrip('/')

            sent = 0
            for u in users_to_email:
                if not can_send_email_to_user(u, 'transactional'):
                    continue
                email = (u.email or '').strip()
                if not email:
                    continue
                try:
                    unsub_url = get_unsubscribe_url(u)
                    html_message = render_email_template(
                        subject=subject,
                        heading='Trading Wave Alert',
                        message=body_html,
                        cta_text='Open Dashboard',
                        cta_url=f'{base_url}/dashboard',
                        preheader=f'{emoji} {label} — prepare your positions now!',
                        unsubscribe_url=unsub_url,
                    )
                    text_body = f'{label}\n\nMinutes until impact: {minutes_before}\nTips: {tips}\n\nPlease check your dashboard.'

                    msg = EmailMultiAlternatives(subject, text_body, from_addr, [email])
                    msg.attach_alternative(html_message, 'text/html')
                    msg = add_email_headers(msg, 'transactional', user=u)
                    msg.send(fail_silently=True)
                    sent += 1
                except Exception:
                    pass

        except Exception:
            pass

    threading.Thread(target=_send, daemon=True).start()
