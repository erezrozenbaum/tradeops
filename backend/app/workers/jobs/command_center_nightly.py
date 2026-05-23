"""Nightly job: pre-compute Command Center AI summaries for all investors.

Runs daily at 05:00 UTC — after twin (03:00), behavioral risk (04:00),
and maturity (Saturday 06:00) jobs have refreshed the underlying data.

Stores results in Redis with a 26-hour TTL so the Command Center page
serves instantly from cache rather than blocking on a 2–4s Claude call.
Only pre-computes "standard" verbosity. Beginner/advanced are lazily
cached on first request.
"""
import logging

log = logging.getLogger(__name__)


def precompute_command_center_ai() -> None:
    from app.core.config import settings

    if not settings.ANTHROPIC_API_KEY:
        log.warning("cc_nightly: ANTHROPIC_API_KEY not set — skipping")
        return

    from app.db.session import SessionLocal
    from app.models.investor_profile import InvestorProfile
    from app.command_center.ai_cache import set_cached
    from app.investment_agent import engine as agent_engine

    with SessionLocal() as db:
        investor_ids = [row[0] for row in db.query(InvestorProfile.id).all()]

    if not investor_ids:
        log.info("cc_nightly: no investors — nothing to pre-compute")
        return

    log.info("cc_nightly: pre-computing AI summaries for %d investor(s)", len(investor_ids))
    ok = err = 0

    for investor_id in investor_ids:
        try:
            with SessionLocal() as db:
                report = agent_engine.run_agent(db, investor_id, verbosity="standard")
            summary = report.portfolio_assessment or ""
            if summary:
                set_cached(investor_id, "standard", summary)
                ok += 1
        except Exception as exc:
            log.error("cc_nightly: failed for investor %s: %s", investor_id, exc)
            err += 1

    log.info("cc_nightly: done — %d ok, %d errors", ok, err)
