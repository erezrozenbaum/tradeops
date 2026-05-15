"""Daily job: run proactive drift detection for all investors and send AI insights via email.

Runs at 07:30 UTC. Only sends if SMTP + Anthropic API key are configured.
"""
import logging

log = logging.getLogger(__name__)


def run_proactive_insights() -> None:
    from app.core.config import settings
    from app.db.session import SessionLocal
    from app.models.investor_profile import InvestorProfile

    with SessionLocal() as db:
        investors = db.query(InvestorProfile).all()

    if not investors:
        return

    log.info("proactive_insights: running for %d investor(s)", len(investors))

    for investor in investors:
        try:
            _process_investor(investor, settings.ANTHROPIC_API_KEY)
        except Exception as exc:
            log.error("proactive_insights: failed for investor %s: %s", investor.id, exc)


def _process_investor(investor, api_key: str) -> None:
    from app.db.session import SessionLocal
    from app.proactive_insights.engine import detect_drift, generate_insights

    with SessionLocal() as db:
        if api_key:
            report = generate_insights(db, investor.id, api_key)
        else:
            report = detect_drift(db, investor.id)

    if not report.drift_events:
        log.debug("proactive_insights: no drift events for investor %s", investor.id)
        return

    log.info(
        "proactive_insights: investor %s — %d drift event(s): %s",
        investor.id,
        len(report.drift_events),
        [e.event_id for e in report.drift_events],
    )

    # Send email if investor has opted in and SMTP is configured
    if investor.email_alerts_enabled and investor.alert_email and report.insights:
        _send_insights_email(investor, report)


def _send_insights_email(investor, report) -> None:
    import os
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from datetime import date

    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASS")
    from_addr = os.getenv("ALERT_FROM_EMAIL", "noreply@tradeops.ai")

    if not (host and user and password):
        return

    rows = ""
    for event, insight in zip(report.drift_events, report.insights):
        severity_color = "#ef4444" if event.severity == "danger" else "#f59e0b"
        rows += f"""
        <tr>
          <td style='padding:10px 12px;border-bottom:1px solid #e2e8f0'>
            <span style='display:inline-block;width:8px;height:8px;border-radius:50%;background:{severity_color};margin-right:8px'></span>
            <strong>{event.name}</strong><br>
            <span style='font-size:13px;color:#475569'>{insight.insight}</span>
          </td>
          <td style='padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;vertical-align:top'>
            {insight.action}
          </td>
        </tr>"""

    html = f"""<!DOCTYPE html><html><body style='font-family:-apple-system,sans-serif;background:#f8fafc;padding:24px'>
<div style='max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)'>
  <div style='background:#0f172a;padding:20px 28px'>
    <p style='color:#94a3b8;font-size:12px;margin:0 0 4px'>TradeOps AI · Proactive Insights</p>
    <h1 style='color:#f1f5f9;font-size:18px;font-weight:600;margin:0'>{len(report.drift_events)} portfolio alert(s) detected</h1>
  </div>
  <div style='padding:20px 28px'>
    <table style='width:100%;border-collapse:collapse;font-size:14px'>
      <thead><tr>
        <th style='text-align:left;padding:8px 12px;color:#64748b;font-size:11px;text-transform:uppercase'>Alert</th>
        <th style='text-align:left;padding:8px 12px;color:#64748b;font-size:11px;text-transform:uppercase'>Suggested Action</th>
      </tr></thead>
      <tbody>{rows}</tbody>
    </table>
  </div>
  <div style='padding:14px 28px;background:#f8fafc;border-top:1px solid #e2e8f0'>
    <p style='font-size:11px;color:#94a3b8;margin:0'>Log in to your TradeOps dashboard to act on these insights.</p>
  </div>
</div></body></html>"""

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"TradeOps — {len(report.drift_events)} portfolio insight(s) for {date.today().strftime('%b %d')}"
        msg["From"] = from_addr
        msg["To"] = investor.alert_email
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(host, port) as smtp:
            smtp.starttls()
            smtp.login(user, password)
            smtp.send_message(msg)
        log.info("proactive_insights: email sent to %s", investor.alert_email)
    except Exception as exc:
        log.error("proactive_insights: email failed for %s: %s", investor.alert_email, exc)
