"""Email alert sender — uses SMTP configured via environment variables.

Required env vars (all optional; alerts are silently skipped if missing):
  SMTP_HOST         — e.g. smtp.gmail.com
  SMTP_PORT         — default 587
  SMTP_USER         — sender login
  SMTP_PASS         — sender password
  ALERT_FROM_EMAIL  — From address, default noreply@tradeops.ai
"""
import logging
import os
import smtplib
from email.mime.text import MIMEText

log = logging.getLogger(__name__)


def send_alert_email(to: str, subject: str, body: str) -> bool:
    """Send a plain-text alert email. Returns True on success, False otherwise."""
    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASS")
    from_addr = os.getenv("ALERT_FROM_EMAIL", "noreply@tradeops.ai")

    if not (host and user and password and to):
        log.debug("SMTP not configured or no recipient — skipping alert to %r", to)
        return False

    try:
        msg = MIMEText(body, "plain")
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = to
        with smtplib.SMTP(host, port) as smtp:
            smtp.starttls()
            smtp.login(user, password)
            smtp.send_message(msg)
        log.info("Alert email sent to %s — %s", to, subject)
        return True
    except Exception as exc:  # noqa: BLE001
        log.error("Failed to send alert email to %s: %s", to, exc)
        return False
