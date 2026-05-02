"""Daily job: send email alert digest to all investors who have opted in.

Runs at 08:30 UTC. Uses the notification center as the single source of truth
for what constitutes an alert. Only sends if SMTP is configured in env.
"""
import logging
from datetime import date

from app.db.session import SessionLocal
from app.models.investor_profile import InvestorProfile
from app.notifications.center import get_notifications
from app.notifications.email import send_alert_email

log = logging.getLogger(__name__)


def _build_body(investor_name: str, notifications) -> str:
    today = date.today().strftime("%B %d, %Y")
    lines = [
        f"Hi {investor_name},",
        "",
        f"Your TradeOps alert digest for {today}:",
        "",
    ]
    for n in notifications:
        severity_label = "⚠️ WARNING" if n.severity == "warning" else "🔴 ACTION NEEDED"
        lines.append(f"{severity_label}  {n.title}")
        lines.append(f"         {n.message}")
        if n.link:
            lines.append(f"         → Open in app: {n.link}")
        lines.append("")

    lines += [
        "---",
        "Log in to your dashboard to review and act on these alerts.",
        "To stop receiving emails, disable alerts in Settings → Email Notifications.",
        "",
        "— TradeOps AI",
    ]
    return "\n".join(lines)


def send_notification_alerts() -> None:
    db = SessionLocal()
    try:
        investors = (
            db.query(InvestorProfile)
            .filter(
                InvestorProfile.email_alerts_enabled.is_(True),
                InvestorProfile.alert_email.isnot(None),
            )
            .all()
        )

        if not investors:
            log.info("[notification_alerts] No investors with email alerts enabled.")
            return

        log.info("[notification_alerts] Sending alerts for %d investor(s).", len(investors))
        sent = 0

        for investor in investors:
            try:
                notifications = get_notifications(db, investor.id)
                actionable = [n for n in notifications if n.severity in ("warning", "danger")]
                if not actionable:
                    log.debug(
                        "[notification_alerts] No actionable alerts for %s — skipping.", investor.id
                    )
                    continue

                body = _build_body(investor.full_name, actionable)
                subject = f"[TradeOps] {len(actionable)} alert{'s' if len(actionable) != 1 else ''} need your attention"
                if send_alert_email(to=investor.alert_email, subject=subject, body=body):
                    sent += 1
            except Exception as exc:
                log.error("[notification_alerts] Failed for investor %s: %s", investor.id, exc)

        log.info("[notification_alerts] Done — sent %d email(s).", sent)
    except Exception as exc:
        log.error("[notification_alerts] Job failed: %s", exc)
    finally:
        db.close()
