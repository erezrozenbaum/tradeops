"""Weekly job: send AI-powered digest email to opted-in investors.

Runs Fridays at 18:00 UTC.
"""
import logging

from app.db.session import SessionLocal
from app.models.investor_profile import InvestorProfile

log = logging.getLogger(__name__)


def send_weekly_digest() -> None:
    from app.core.config import settings

    if not settings.ANTHROPIC_API_KEY:
        log.warning("weekly_digest: ANTHROPIC_API_KEY not configured — skipping")
        return

    with SessionLocal() as db:
        investors = (
            db.query(InvestorProfile)
            .filter(
                InvestorProfile.weekly_digest_enabled.is_(True),
                InvestorProfile.alert_email.isnot(None),
            )
            .all()
        )

    if not investors:
        log.info("weekly_digest: no opted-in investors — nothing to send")
        return

    log.info("weekly_digest: sending digest to %d investor(s)", len(investors))

    for investor in investors:
        _send_one(investor, settings.ANTHROPIC_API_KEY)


def _send_one(investor: InvestorProfile, api_key: str) -> None:
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    import os

    from app.db.session import SessionLocal
    from app.portfolio_analysis import service as portfolio_service
    from app.goals_analysis.service import compute_goals_analysis
    from app.weekly_digest.renderer import render_html

    try:
        with SessionLocal() as db:
            portfolio = portfolio_service.get_portfolio(db, investor.id)
            try:
                goals_analysis = compute_goals_analysis(db, investor.id)
            except Exception:
                goals_analysis = None

        subject, html_body = render_html(investor, portfolio, goals_analysis, api_key)

        host = os.getenv("SMTP_HOST")
        port = int(os.getenv("SMTP_PORT", "587"))
        user = os.getenv("SMTP_USER")
        password = os.getenv("SMTP_PASS")
        from_addr = os.getenv("ALERT_FROM_EMAIL", "noreply@tradeops.ai")

        if not (host and user and password):
            log.debug("weekly_digest: SMTP not configured — skipping send for %s", investor.id)
            return

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = investor.alert_email
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(host, port) as smtp:
            smtp.starttls()
            smtp.login(user, password)
            smtp.send_message(msg)

        log.info("weekly_digest: sent to %s (%s)", investor.alert_email, investor.id)

    except Exception as exc:  # noqa: BLE001
        log.error("weekly_digest: failed for investor %s: %s", investor.id, exc)
