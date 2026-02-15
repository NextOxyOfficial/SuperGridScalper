"""
Send test emails of all types to a specified email address.
Usage: python manage.py send_test_emails alimulislam50@gmail.com
"""
from django.core.management.base import BaseCommand
from django.core.mail import EmailMultiAlternatives
from core.utils import get_email_from_address, render_email_template, add_email_headers


class Command(BaseCommand):
    help = 'Send test emails of all types to a specified email address'

    def add_arguments(self, parser):
        parser.add_argument('email', type=str, help='Recipient email address')

    def handle(self, *args, **options):
        to_email = options['email']
        from_email = get_email_from_address()
        base = 'https://markstrades.com'
        sent = 0

        # 1. Welcome / Registration
        self.stdout.write(f'[1/7] Sending Welcome email...')
        html = render_email_template(
            subject='Welcome to MarksTrades!',
            heading='Welcome to MarksTrades! 🎉',
            message="""
                <p>Hi <strong>Trader</strong>,</p>
                <p>Welcome to <strong>MarksTrades</strong> — your AI-powered trading automation platform.</p>
                <p>Your account has been created successfully. You can now purchase a license and start trading with our AI Expert Advisor.</p>
                
                <div style="background-color: rgba(6, 182, 212, 0.1); border-left: 3px solid #06b6d4; padding: 14px; margin: 16px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #d1d5db; font-size: 13px;"><strong>What's next?</strong></p>
                    <p style="margin: 6px 0 0 0; color: #9ca3af; font-size: 13px;">1. Choose a subscription plan<br>2. Submit payment proof<br>3. Get your license activated<br>4. Start trading!</p>
                </div>
            """,
            cta_text='OPEN DASHBOARD',
            cta_url=f'{base}/dashboard',
            footer_note='Thank you for joining MarksTrades!',
            preheader='Welcome! Your MarksTrades account is ready.',
        )
        self._send(from_email, to_email, 'Welcome to MarksTrades!', html, 'Welcome email')
        sent += 1

        # 2. Payment Approved - New License
        self.stdout.write(f'[2/7] Sending Payment Approved (New License) email...')
        html = render_email_template(
            subject='Payment Approved - Your License is Ready',
            heading='🎉 Payment Approved!',
            message=f"""
                <p>Hi <strong>Trader</strong>,</p>
                <p>Great news! Your payment has been <strong style="color: #10b981;">approved</strong> and your license has been issued.</p>
                
                <div style="background-color: rgba(16, 185, 129, 0.1); border-left: 3px solid #10b981; padding: 14px; margin: 16px 0; border-radius: 4px;">
                    <p style="margin: 0 0 6px 0; color: #10b981; font-weight: 600; font-size: 13px;">License Details:</p>
                    <p style="margin: 3px 0; color: #d1d5db; font-size: 13px;"><strong>Request ID:</strong> #12345</p>
                    <p style="margin: 3px 0; color: #d1d5db; font-size: 13px;"><strong>Plan:</strong> Monthly</p>
                    <p style="margin: 3px 0; color: #d1d5db; font-size: 13px;"><strong>License Key:</strong> <code style="background-color: rgba(6, 182, 212, 0.15); padding: 2px 6px; border-radius: 4px; color: #06b6d4;">ABCD-1234-EFGH-5678</code></p>
                    <p style="margin: 3px 0; color: #d1d5db; font-size: 13px;"><strong>Expires At:</strong> March 15, 2026</p>
                </div>
                
                <p>You can now access your license and start trading with our AI Expert Advisor.</p>
            """,
            cta_text='OPEN DASHBOARD',
            cta_url=f'{base}/dashboard',
            footer_note='Thank you for choosing MarksTrades!',
            preheader='Your Monthly license has been approved and activated. Start trading now!',
        )
        self._send(from_email, to_email, 'Payment Approved - Your License is Ready', html, 'Payment Approved')
        sent += 1

        # 3. Payment Rejected
        self.stdout.write(f'[3/7] Sending Payment Rejected email...')
        html = render_email_template(
            subject='Payment Rejected - Action Needed',
            heading='Payment Verification Failed',
            message=f"""
                <p>Hi <strong>Trader</strong>,</p>
                <p>Unfortunately, your payment could not be verified and has been <strong style="color: #ef4444;">rejected</strong>.</p>
                
                <div style="background-color: rgba(239, 68, 68, 0.1); border-left: 3px solid #ef4444; padding: 14px; margin: 16px 0; border-radius: 4px;">
                    <p style="margin: 0 0 6px 0; color: #ef4444; font-weight: 600; font-size: 13px;">Request Details:</p>
                    <p style="margin: 3px 0; color: #d1d5db; font-size: 13px;"><strong>Request ID:</strong> #12345</p>
                    <p style="margin: 3px 0; color: #d1d5db; font-size: 13px;"><strong>Plan:</strong> Monthly</p>
                    <p style="margin: 3px 0; color: #d1d5db; font-size: 13px;"><strong>Network:</strong> TRC20 (USDT)</p>
                    <p style="margin: 3px 0; color: #d1d5db; font-size: 13px;"><strong>TXID:</strong> abc123def456...</p>
                </div>
                
                <p><strong>What to do next:</strong></p>
                <ul style="color: #d1d5db; line-height: 1.8; font-size: 14px; padding-left: 20px;">
                    <li>Double-check your payment transaction</li>
                    <li>Submit a new payment proof from your dashboard</li>
                    <li>Contact support if you believe this is a mistake</li>
                </ul>
            """,
            cta_text='SUBMIT NEW PROOF',
            cta_url=f'{base}/dashboard',
            footer_note='If you believe this is a mistake, please contact our support team immediately.',
            preheader='Payment verification failed for request #12345. Please review and resubmit.',
        )
        self._send(from_email, to_email, 'Payment Rejected - Action Needed', html, 'Payment Rejected')
        sent += 1

        # 4. License Extended
        self.stdout.write(f'[4/7] Sending License Extended email...')
        html = render_email_template(
            subject='License Extended - Payment Approved',
            heading='🎉 License Extended!',
            message=f"""
                <p>Hi <strong>Trader</strong>,</p>
                <p>Your payment has been <strong style="color: #10b981;">approved</strong> and your license has been extended.</p>
                
                <div style="background-color: rgba(16, 185, 129, 0.1); border-left: 3px solid #10b981; padding: 14px; margin: 16px 0; border-radius: 4px;">
                    <p style="margin: 0 0 6px 0; color: #10b981; font-weight: 600; font-size: 13px;">Extension Details:</p>
                    <p style="margin: 3px 0; color: #d1d5db; font-size: 13px;"><strong>Plan:</strong> Monthly</p>
                    <p style="margin: 3px 0; color: #d1d5db; font-size: 13px;"><strong>Added:</strong> +30 days</p>
                    <p style="margin: 3px 0; color: #d1d5db; font-size: 13px;"><strong>New Expiry:</strong> April 15, 2026</p>
                    <p style="margin: 3px 0; color: #d1d5db; font-size: 13px;"><strong>Days Remaining:</strong> 60</p>
                </div>
            """,
            cta_text='OPEN DASHBOARD',
            cta_url=f'{base}/dashboard',
            footer_note='Thank you for continuing with MarksTrades!',
            preheader='Your license has been extended with Monthly. 60 days remaining!',
        )
        self._send(from_email, to_email, 'License Extended - Payment Approved', html, 'License Extended')
        sent += 1

        # 5. Access Key Reset
        self.stdout.write(f'[5/7] Sending Access Key Reset email...')
        html = render_email_template(
            subject='🔑 Access Key Reset Request',
            heading='🔑 Access Key Reset',
            message=f"""
                <p>Hi <strong>Trader</strong>,</p>
                <p>We received a request to reset the access key for your <strong>MarksTrades</strong> account.</p>
                <p>Click the button below to set a new access key:</p>

                <div style="background-color: rgba(6, 182, 212, 0.1); border-left: 3px solid #06b6d4; padding: 14px; margin: 16px 0; border-radius: 4px;">
                    <p style="margin: 0 0 6px 0; color: #06b6d4; font-weight: 600; font-size: 13px;">Request Details:</p>
                    <p style="margin: 3px 0; color: #d1d5db; font-size: 13px;"><strong>Account:</strong> test@markstrades.com</p>
                    <p style="margin: 3px 0; color: #d1d5db; font-size: 13px;"><strong>Request Type:</strong> Access Key Reset</p>
                    <p style="margin: 3px 0; color: #facc15; font-size: 13px;"><strong>⏱ Expires in:</strong> 24 hours</p>
                </div>

                <p style="color: #6b7280; font-size: 13px;">If you did not request this reset, you can safely ignore this email. Your access key will remain unchanged.</p>
            """,
            cta_text='RESET ACCESS KEY',
            cta_url=f'{base}/reset-password?uid=test-uid&token=test-token-123',
            footer_note='For security, this link can only be used once. If you need a new link, please request another reset.',
            preheader='Reset your MarksTrades access key',
        )
        self._send(from_email, to_email, '🔑 Access Key Reset Request', html, 'Access Key Reset')
        sent += 1

        # 6. Expiry Reminder (7 days)
        self.stdout.write(f'[6/7] Sending Expiry Reminder email...')
        html = render_email_template(
            subject='License Expiring Soon - 7 Days Left',
            heading='⏰ License Expiring Soon',
            message=f"""
                <p>Hi <strong>Trader</strong>,</p>
                <p>Your license is expiring in <strong style="color: #f59e0b;">7 days</strong>.</p>
                
                <div style="background-color: rgba(245, 158, 11, 0.1); border-left: 3px solid #f59e0b; padding: 14px; margin: 16px 0; border-radius: 4px;">
                    <p style="margin: 0 0 6px 0; color: #f59e0b; font-weight: 600; font-size: 13px;">License Details:</p>
                    <p style="margin: 3px 0; color: #d1d5db; font-size: 13px;"><strong>Plan:</strong> Monthly</p>
                    <p style="margin: 3px 0; color: #d1d5db; font-size: 13px;"><strong>Expires:</strong> February 18, 2026</p>
                    <p style="margin: 3px 0; color: #d1d5db; font-size: 13px;"><strong>Days Left:</strong> 7</p>
                </div>
                
                <p>Extend your license now to avoid any interruption in your trading.</p>
            """,
            cta_text='EXTEND LICENSE',
            cta_url=f'{base}/dashboard',
            footer_note='Renew before expiry to keep your EA running without interruption.',
            preheader='Your MarksTrades license expires in 7 days. Renew now!',
        )
        self._send(from_email, to_email, 'License Expiring Soon - 7 Days Left', html, 'Expiry Reminder')
        sent += 1

        # 7. Referral Commission
        self.stdout.write(f'[7/7] Sending Referral Commission email...')
        html = render_email_template(
            subject='You Earned a Referral Commission!',
            heading='💰 Referral Commission Earned!',
            message=f"""
                <p>Hi <strong>Trader</strong>,</p>
                <p>Great news! Someone you referred just made a purchase, and you've earned a commission!</p>
                
                <div style="background-color: rgba(16, 185, 129, 0.1); border-left: 3px solid #10b981; padding: 14px; margin: 16px 0; border-radius: 4px;">
                    <p style="margin: 0 0 6px 0; color: #10b981; font-weight: 600; font-size: 13px;">Commission Details:</p>
                    <p style="margin: 3px 0; color: #d1d5db; font-size: 13px;"><strong>Purchase Amount:</strong> $49.00</p>
                    <p style="margin: 3px 0; color: #d1d5db; font-size: 13px;"><strong>Commission Rate:</strong> 10%</p>
                    <p style="margin: 3px 0; color: #d1d5db; font-size: 13px;"><strong>Your Earnings:</strong> <span style="color: #10b981; font-weight: bold;">$4.90</span></p>
                </div>
                
                <p>Keep sharing your referral link to earn more!</p>
            """,
            cta_text='VIEW REFERRAL DASHBOARD',
            cta_url=f'{base}/dashboard/referral',
            footer_note='Thank you for spreading the word about MarksTrades!',
            preheader='You earned $4.90 from a referral purchase!',
        )
        self._send(from_email, to_email, 'You Earned a Referral Commission!', html, 'Referral Commission')
        sent += 1

        self.stdout.write(self.style.SUCCESS(f'\n✅ All {sent} test emails sent to {to_email}'))

    def _send(self, from_email, to_email, subject, html, label):
        try:
            text = f'{label} - Test email from MarksTrades'
            msg = EmailMultiAlternatives(f'[TEST] {subject}', text, from_email, [to_email])
            msg.attach_alternative(html, "text/html")
            msg = add_email_headers(msg, 'transactional')
            msg.send(fail_silently=False)
            self.stdout.write(self.style.SUCCESS(f'  ✓ {label} sent'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  ✗ {label} failed: {e}'))
