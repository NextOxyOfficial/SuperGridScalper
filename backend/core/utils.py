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
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
            <tr>
                <td align="center">
                    <a href="{cta_url}" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: #000000; font-weight: bold; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-family: 'Orbitron', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; letter-spacing: 0.5px;">
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
    
    html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="x-apple-disable-message-reformatting">
        <title>{subject}</title>
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700&display=swap" rel="stylesheet">
        <!--[if mso]>
        <style type="text/css">
            body, table, td {{font-family: Arial, Helvetica, sans-serif !important;}}
        </style>
        <![endif]-->
    </head>
    <body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <!-- Preheader text (hidden but shows in inbox preview) -->
        <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
            {preheader}
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0f; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #12121a; border: 1px solid rgba(6, 182, 212, 0.2); border-radius: 16px; overflow: hidden;">
                        
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(6, 182, 212, 0.05) 100%); padding: 32px 40px; border-bottom: 1px solid rgba(6, 182, 212, 0.2);">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td width="48" style="vertical-align: middle; padding-right: 16px;">
                                            <img src="https://markstrades.com/media/site/letter-m.png" alt="Mark's AI Logo" width="48" height="48" style="display: block; width: 48px; height: 48px;">
                                        </td>
                                        <td style="vertical-align: middle;">
                                            <h1 style="margin: 0; font-family: 'Orbitron', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 24px; font-weight: 700; color: #06b6d4; letter-spacing: 1px;">
                                                MARK'S AI 3.0
                                            </h1>
                                            <p style="margin: 8px 0 0 0; font-size: 13px; color: #6b7280; letter-spacing: 0.5px;">
                                                PROFESSIONAL TRADING AUTOMATION
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px;">
                                <h2 style="margin: 0 0 24px 0; font-family: 'Orbitron', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 20px; font-weight: 600; color: #ffffff; letter-spacing: 0.5px;">
                                    {heading}
                                </h2>
                                
                                <div style="color: #d1d5db; font-size: 15px; line-height: 1.7;">
                                    {message}
                                </div>
                                
                                {cta_html}
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: rgba(6, 182, 212, 0.05); padding: 32px 40px; border-top: 1px solid rgba(6, 182, 212, 0.1);">
                                <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">
                                    <strong style="color: #06b6d4;">Need Help?</strong><br>
                                    Reply to this email or contact our support team at 
                                    <a href="mailto:support@markstrades.com" style="color: #06b6d4; text-decoration: none;">support@markstrades.com</a>
                                </p>
                                
                                {footer_note_html}
                                
                                <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid rgba(107, 114, 128, 0.2);">
                                    <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 12px; line-height: 1.5;">
                                        © 2025-2026 MarksTrades. All rights reserved.<br>
                                        This is an automated message. Please do not reply directly to this email.
                                    </p>
                                    <p style="margin: 0; color: #6b7280; font-size: 11px; text-align: center;">
                                        Don't want to receive these emails? 
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
    </html>
    """
    
    return html
