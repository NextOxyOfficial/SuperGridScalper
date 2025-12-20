from django.core.mail.backends.smtp import EmailBackend as SMTPBackend
from django.conf import settings


class DatabaseSMTPBackend(SMTPBackend):
    """
    Custom email backend that uses SMTP settings from database (SMTPSettings model)
    Falls back to environment variables if no active SMTP config exists in database
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # Try to load SMTP settings from database
        try:
            from core.models import SMTPSettings
            smtp_config = SMTPSettings.objects.filter(is_active=True).first()
            
            if smtp_config:
                # Override settings with database values
                self.host = smtp_config.host
                self.port = smtp_config.port
                self.username = smtp_config.username
                self.password = smtp_config.password
                self.use_tls = smtp_config.use_tls
                self.use_ssl = smtp_config.use_ssl
                
                # Set default from_email if not already set
                if not hasattr(settings, '_database_from_email'):
                    settings._database_from_email = smtp_config.from_email
                    settings.DEFAULT_FROM_EMAIL = smtp_config.from_email
            else:
                # Fall back to environment variables (existing behavior)
                self.host = getattr(settings, 'EMAIL_HOST', '')
                self.port = getattr(settings, 'EMAIL_PORT', 587)
                self.username = getattr(settings, 'EMAIL_HOST_USER', '')
                self.password = getattr(settings, 'EMAIL_HOST_PASSWORD', '')
                self.use_tls = getattr(settings, 'EMAIL_USE_TLS', True)
                self.use_ssl = getattr(settings, 'EMAIL_USE_SSL', False)
                
        except Exception as e:
            # If database is not ready (e.g., during migrations), fall back to env vars
            self.host = getattr(settings, 'EMAIL_HOST', '')
            self.port = getattr(settings, 'EMAIL_PORT', 587)
            self.username = getattr(settings, 'EMAIL_HOST_USER', '')
            self.password = getattr(settings, 'EMAIL_HOST_PASSWORD', '')
            self.use_tls = getattr(settings, 'EMAIL_USE_TLS', True)
            self.use_ssl = getattr(settings, 'EMAIL_USE_SSL', False)
