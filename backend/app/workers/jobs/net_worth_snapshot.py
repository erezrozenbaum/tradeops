"""Daily net worth snapshot writer.

Runs after portfolio snapshot_writer (21:15 UTC) to capture each investor's
full net worth (portfolio + financial assets - liabilities). Idempotent.
"""
import logging

log = logging.getLogger(__name__)


def write_net_worth_snapshots() -> None:
    from app.db.session import SessionLocal
    from app.models.investor_profile import InvestorProfile
    from app.net_worth import service as nw_service

    db = SessionLocal()
    try:
        investor_ids = [row[0] for row in db.query(InvestorProfile.id).all()]
        log.info("[net_worth_snapshot] Writing for %d investor(s)", len(investor_ids))

        written = 0
        skipped = 0
        for investor_id in investor_ids:
            try:
                from app.models.net_worth import NetWorthSnapshot
                from datetime import date
                existing = (
                    db.query(NetWorthSnapshot)
                    .filter(NetWorthSnapshot.investor_id == investor_id)
                    .order_by(NetWorthSnapshot.snapshot_at.desc())
                    .first()
                )
                if existing and existing.snapshot_at.date() == date.today():
                    skipped += 1
                    continue
                nw_service.save_snapshot(db, investor_id)
                written += 1
            except Exception as exc:
                log.warning("[net_worth_snapshot] Failed for %s: %s", investor_id, exc)

        log.info("[net_worth_snapshot] Done — written=%d, skipped=%d", written, skipped)
    except Exception as exc:
        log.error("[net_worth_snapshot] Fatal: %s", exc)
    finally:
        db.close()
