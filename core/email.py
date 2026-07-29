import asyncio
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from core.config import settings

logger = logging.getLogger(__name__)

SMTP_TIMEOUT = 10  # seconds


def _send_sync(to: str, subject: str, html: str) -> None:
    sender = settings.smtp_from or settings.smtp_user
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = sender
    msg["To"]      = to
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=SMTP_TIMEOUT) as smtp:
        smtp.ehlo()
        smtp.starttls()
        smtp.login(settings.smtp_user, settings.smtp_pass)
        smtp.sendmail(sender, to, msg.as_string())


async def _send_in_background(to: str, subject: str, html: str) -> None:
    try:
        await asyncio.to_thread(_send_sync, to, subject, html)
        logger.info("Email sent to %s: %s", to, subject)
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to, exc)


def send_email(to: str, subject: str, html: str) -> None:
    """Schedule an email to send in the background. Returns immediately."""
    if not settings.smtp_host or not settings.smtp_user:
        logger.info("SMTP not configured — skipping email to %s", to)
        return
    asyncio.create_task(_send_in_background(to, subject, html))


def welcome_email_html(email: str, role: str) -> str:
    login_url = settings.app_url or "your app URL"
    role_label = role.capitalize()
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
      <div style="background: linear-gradient(135deg, #794899, #9462b6); padding: 32px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 22px;">Taylor Wilkinson Surveyors</h1>
      </div>
      <div style="background: #fafafa; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #eee; border-top: none;">
        <p style="margin-top: 0;">Hi,</p>
        <p>You've been added to the <strong>Taylor Wilkinson Surveyors</strong> internal management system as a <strong>{role_label}</strong>.</p>
        <p>You can sign in using your Google account (<strong>{email}</strong>) at the link below:</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="{login_url}" style="background: #794899; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Sign in to TWS
          </a>
        </div>
        <p style="color: #888; font-size: 13px;">If you weren't expecting this, please contact your administrator.</p>
      </div>
    </div>
    """
