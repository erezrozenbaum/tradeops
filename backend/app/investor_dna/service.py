"""Investor DNA — synthesises all behavioral signals into a single coherent profile.

Computes:
  Capital Leakage Attribution  — dollar cost of undocumented vs documented trades per asset class
  Edge signals                 — where the investor consistently outperforms their own baseline
  Risk signals                 — behavioral failure patterns with frequency and dollar impact
  Recommendation               — continue / reduce / avoid, derived purely from the investor's history

No external API calls. Reuses market data price cache and staged_orders data.
"""
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from statistics import mean

from sqlalchemy.orm import Session

from app.pattern_detector import detect_patterns
from app.investor_dna.schemas import (
    DnaRecommendation,
    DnaSignal,
    InvestorDnaReport,
    LeakageByClass,
)
from app.models.staged_order import StagedOrder

_MIN_PRICED = 3


def _is_documented(o: StagedOrder) -> bool:
    return bool(o.rationale and o.rationale.strip()) or bool(o.thesis_params)


def _verdict(o: StagedOrder) -> str | None:
    return (o.pre_flight_review or {}).get("verdict")


def _get_all_executed(db: Session, investor_id: uuid.UUID) -> list[StagedOrder]:
    return (
        db.query(StagedOrder)
        .filter(
            StagedOrder.investor_id == investor_id,
            StagedOrder.status == "executed",
        )
        .order_by(StagedOrder.created_at.asc())
        .all()
    )


def _get_executed_buys(db: Session, investor_id: uuid.UUID) -> list[StagedOrder]:
    return (
        db.query(StagedOrder)
        .filter(
            StagedOrder.investor_id == investor_id,
            StagedOrder.status == "executed",
            StagedOrder.action == "buy",
            StagedOrder.ticker.isnot(None),
            StagedOrder.unit_price > 0,
            StagedOrder.executed_at.isnot(None),
        )
        .order_by(StagedOrder.executed_at.desc())
        .all()
    )


def _price_orders(db: Session, orders: list[StagedOrder]) -> list[tuple[StagedOrder, float]]:
    from app.market_data.service import get_cached_price
    result = []
    for o in orders:
        snap = get_cached_price(db, o.ticker)
        if snap is None or snap.price <= 0:
            continue
        ret = round((snap.price - o.unit_price) / o.unit_price * 100, 2)
        result.append((o, ret))
    return result


def _dqs_label(score: float) -> str:
    if score >= 80:
        return "Excellent"
    if score >= 65:
        return "Good"
    if score >= 45:
        return "Fair"
    return "Needs Work"


def _build_leakage(priced: list[tuple[StagedOrder, float]]) -> tuple[
    list[LeakageByClass], float | None, str | None
]:
    by_class: dict[str, list[tuple[StagedOrder, float]]] = defaultdict(list)
    for o, ret in priced:
        cls = o.asset_type or "uncategorized"
        by_class[cls].append((o, ret))

    result: list[LeakageByClass] = []
    running_leakage = 0.0
    running_currency: str | None = None

    for cls, items in sorted(by_class.items()):
        doc_items = [(o, r) for o, r in items if _is_documented(o)]
        undoc_items = [(o, r) for o, r in items if not _is_documented(o)]

        d_avg = round(mean([r for _, r in doc_items]), 2) if doc_items else None
        u_avg = round(mean([r for _, r in undoc_items]), 2) if undoc_items else None

        leakage_pct: float | None = None
        leakage_dollar: float | None = None
        currency = (
            undoc_items[0][0].currency if undoc_items
            else (doc_items[0][0].currency if doc_items else "USD")
        )

        if d_avg is not None and u_avg is not None and undoc_items:
            leakage_pct = round(d_avg - u_avg, 2)
            undoc_value = sum(o.estimated_value for o, _ in undoc_items)
            leakage_dollar = round(leakage_pct / 100 * undoc_value, 2)
            running_leakage += leakage_dollar
            running_currency = currency

        result.append(LeakageByClass(
            asset_class=cls,
            documented_count=len(doc_items),
            undocumented_count=len(undoc_items),
            documented_avg_return_pct=d_avg,
            undocumented_avg_return_pct=u_avg,
            leakage_pct=leakage_pct,
            leakage_dollar=leakage_dollar,
            currency=currency,
        ))

    total = round(running_leakage, 2) if running_currency else None
    return result, total, running_currency


def _build_edge(
    priced: list[tuple[StagedOrder, float]],
    doc_priced: list[tuple[StagedOrder, float]],
    undoc_priced: list[tuple[StagedOrder, float]],
) -> list[DnaSignal]:
    edge: list[DnaSignal] = []
    now = datetime.now(timezone.utc)

    # Documentation edge
    if doc_priced and undoc_priced:
        doc_avg = mean([r for _, r in doc_priced])
        undoc_avg = mean([r for _, r in undoc_priced])
        delta = doc_avg - undoc_avg
        if delta > 0:
            edge.append(DnaSignal(
                key="documentation_edge",
                title="Documented decisions outperform",
                value=f"+{delta:.1f}%",
                detail=(
                    f"Your documented trades return {doc_avg:+.1f}% vs "
                    f"{undoc_avg:+.1f}% undocumented — a {delta:.1f}% edge "
                    "driven purely by pre-trade discipline."
                ),
            ))

    # Goal linkage edge
    goal_priced = [(o, r) for o, r in priced if o.goal_id]
    ngoal_priced = [(o, r) for o, r in priced if not o.goal_id]
    if goal_priced and ngoal_priced:
        goal_avg = mean([r for _, r in goal_priced])
        ngoal_avg = mean([r for _, r in ngoal_priced])
        delta = goal_avg - ngoal_avg
        if delta > 0:
            edge.append(DnaSignal(
                key="goal_linkage",
                title="Goal-linked investments outperform",
                value=f"+{delta:.1f}%",
                detail=(
                    f"Trades tied to a financial goal return {goal_avg:+.1f}% "
                    f"vs {ngoal_avg:+.1f}% for reactive trades."
                ),
            ))

    # Optimal holding period
    BRACKETS = [
        (0, 30, "< 1 month"),
        (30, 90, "1–3 months"),
        (90, 180, "3–6 months"),
        (180, 365, "6–12 months"),
        (365, 99999, "> 1 year"),
    ]
    bracket_returns: dict[str, list[float]] = defaultdict(list)
    for o, ret in priced:
        if o.executed_at:
            days = (now - o.executed_at.replace(tzinfo=timezone.utc)).days
            for lo, hi, label in BRACKETS:
                if lo <= days < hi:
                    bracket_returns[label].append(ret)
                    break

    best_label: str | None = None
    best_ret: float | None = None
    for label, returns in bracket_returns.items():
        if len(returns) >= 2:
            avg = mean(returns)
            if best_ret is None or avg > best_ret:
                best_label = label
                best_ret = avg

    if best_label and best_ret is not None and best_ret > 0:
        edge.append(DnaSignal(
            key="optimal_holding",
            title=f"Optimal holding period: {best_label}",
            value=f"{best_ret:+.1f}% avg",
            detail=(
                f"Your {best_label} holds consistently outperform "
                "other time brackets based on current price data."
            ),
        ))

    # Strongest asset class
    class_returns: dict[str, list[float]] = defaultdict(list)
    for o, ret in priced:
        cls = (o.asset_type or "uncategorized").title()
        class_returns[cls].append(ret)

    best_cls: str | None = None
    best_cls_ret: float | None = None
    for cls, returns in class_returns.items():
        if len(returns) >= 2:
            avg = mean(returns)
            if best_cls_ret is None or avg > best_cls_ret:
                best_cls = cls
                best_cls_ret = avg

    if best_cls and best_cls_ret is not None and best_cls_ret > 0:
        edge.append(DnaSignal(
            key="strongest_class",
            title=f"{best_cls} is your strongest asset class",
            value=f"{best_cls_ret:+.1f}% avg",
            detail=(
                f"Your {best_cls} positions return {best_cls_ret:+.1f}% on average "
                "— your highest-performing asset class in this dataset."
            ),
        ))

    return edge


def _build_risks(
    executed_buys: list[StagedOrder],
    priced: list[tuple[StagedOrder, float]],
    undoc_priced: list[tuple[StagedOrder, float]],
    total_leakage_dollar: float | None,
    total_leakage_currency: str | None,
    leakage_by_class: list[LeakageByClass],
) -> list[DnaSignal]:
    risks: list[DnaSignal] = []
    priced_map = {o.id: ret for o, ret in priced}

    # Capital leakage
    if total_leakage_dollar is not None and total_leakage_dollar > 0 and total_leakage_currency:
        worst_cls = max(
            (lc for lc in leakage_by_class if lc.leakage_dollar and lc.leakage_dollar > 0),
            key=lambda lc: lc.leakage_dollar or 0,
            default=None,
        )
        cls_note = f" ({worst_cls.asset_class})" if worst_cls else ""
        risks.append(DnaSignal(
            key="capital_leakage",
            title="Capital leakage from undocumented trades",
            value=f"-{total_leakage_dollar:,.0f} {total_leakage_currency}",
            detail=(
                f"If your undocumented trades{cls_note} had matched the return rate "
                f"of your documented ones, you would have generated "
                f"{total_leakage_dollar:,.0f} {total_leakage_currency} in additional value."
            ),
        ))

    # Override loss rate
    losses = [o for o in executed_buys if o.id in priced_map and priced_map[o.id] < 0]
    blind_overrides = [
        o for o in executed_buys
        if _verdict(o) == "reconsider" and not _is_documented(o) and o.id in priced_map
    ]
    override_losses = [o for o in blind_overrides if priced_map[o.id] < 0]
    if losses and blind_overrides and override_losses:
        rate = len(override_losses) / len(losses)
        if rate >= 0.4:
            risks.append(DnaSignal(
                key="override_loss_rate",
                title="Most losses followed blind overrides",
                value=f"{rate*100:.0f}%",
                detail=(
                    f"{rate*100:.0f}% of your losing trades executed against "
                    "'Reconsider' pre-flight warnings with no written rationale."
                ),
            ))

    # Undocumented recurring losses
    undoc_losses = [(o, priced_map[o.id]) for o, _ in undoc_priced if priced_map.get(o.id, 0) < -3]
    if len(undoc_losses) >= 2:
        avg_loss = mean([r for _, r in undoc_losses])
        risks.append(DnaSignal(
            key="undoc_losses",
            title="Recurring undocumented losses",
            value=f"{len(undoc_losses)} trades",
            detail=(
                f"{len(undoc_losses)} undocumented trades produced significant losses "
                f"(avg {avg_loss:.1f}%). Without a written thesis, there is no framework "
                "to distinguish bad luck from bad decisions."
            ),
        ))

    # Systematic goal drift
    if len(executed_buys) >= 5:
        goal_rate = sum(1 for o in executed_buys if o.goal_id) / len(executed_buys)
        if goal_rate < 0.25:
            risks.append(DnaSignal(
                key="goal_drift",
                title="Systematic goal drift detected",
                value=f"{goal_rate*100:.0f}% goal-linked",
                detail=(
                    f"Only {goal_rate*100:.0f}% of your executed trades are linked "
                    "to a financial goal. Most capital is deployed reactively rather "
                    "than in service of your defined plan."
                ),
            ))

    return risks


def _build_recommendation(
    edge: list[DnaSignal],
    risks: list[DnaSignal],
    doc_rate: float | None,
    goal_rate: float | None,
    executed_buys: list[StagedOrder],
) -> DnaRecommendation:
    continue_doing: list[str] = []
    reduce: list[str] = []
    avoid: list[str] = []

    edge_keys = {s.key for s in edge}
    risk_keys = {s.key for s in risks}

    if "documentation_edge" in edge_keys:
        continue_doing.append("Documented thesis investing")
    if "goal_linkage" in edge_keys:
        continue_doing.append("Goal-linked capital allocation")
    if "strongest_class" in edge_keys:
        cls_signal = next(s for s in edge if s.key == "strongest_class")
        continue_doing.append(cls_signal.title.split(" is ")[0] + " sector positions")
    if "optimal_holding" in edge_keys:
        hold_signal = next(s for s in edge if s.key == "optimal_holding")
        continue_doing.append(f"Holding through {hold_signal.title.split(': ')[1]} windows")

    blind_overrides = [
        o for o in executed_buys if _verdict(o) == "reconsider" and not _is_documented(o)
    ]
    if blind_overrides:
        reduce.append("Override frequency without written rationale")
    if doc_rate is not None and doc_rate < 0.5:
        reduce.append("Undocumented staging — every order deserves a thesis")
    if "goal_drift" in risk_keys:
        reduce.append("Reactive trades outside your goal framework")

    if "capital_leakage" in risk_keys:
        leakage_signal = next(s for s in risks if s.key == "capital_leakage")
        if "(" in leakage_signal.detail:
            cls_part = leakage_signal.detail.split("(")[1].split(")")[0]
            avoid.append(f"Undocumented positions in {cls_part}")
        else:
            avoid.append("Undocumented positions in high-leakage asset classes")
    if "override_loss_rate" in risk_keys:
        avoid.append("Blind risk overrides — document your disagreement or stand down")

    return DnaRecommendation(
        continue_doing=continue_doing[:3],
        reduce=reduce[:3],
        avoid=avoid[:2],
    )


def get_investor_dna(db: Session, investor_id: uuid.UUID) -> InvestorDnaReport:
    now = datetime.now(timezone.utc)
    all_executed = _get_all_executed(db, investor_id)
    executed_buys = _get_executed_buys(db, investor_id)
    priced = _price_orders(db, executed_buys)

    has_sufficient = len(priced) >= _MIN_PRICED

    # DQS — read from DI cache if warm, else compute inline
    dqs: float | None = None
    dqs_label_val: str | None = None
    try:
        from app.core import cache as _cache
        di_cached = _cache.get(f"di:{investor_id}")
        if di_cached and "dqs" in di_cached:
            dqs = di_cached["dqs"]
            dqs_label_val = di_cached.get("dqs_label")
        else:
            from app.decision_intelligence.service import compute_decision_intelligence
            di = compute_decision_intelligence(db, investor_id)
            dqs = di.dqs
            dqs_label_val = di.dqs_label
    except Exception:  # nosec B110 — DQS is optional enrichment; DNA must not fail if DI unavailable
        pass

    if not priced:
        return InvestorDnaReport(
            investor_id=investor_id,
            has_sufficient_data=False,
            total_executed=len(executed_buys),
            priced_orders=0,
            dqs=dqs,
            dqs_label=dqs_label_val,
            doc_rate=None,
            goal_rate=None,
            edge=[],
            risks=[],
            recommendation=DnaRecommendation(continue_doing=[], reduce=[], avoid=[]),
            leakage_by_class=[],
            total_leakage_dollar=None,
            total_leakage_currency=None,
            patterns=detect_patterns(all_executed),
            generated_at=now,
        )

    doc_priced = [(o, r) for o, r in priced if _is_documented(o)]
    undoc_priced = [(o, r) for o, r in priced if not _is_documented(o)]
    goal_priced = [(o, r) for o, r in priced if o.goal_id]

    doc_rate = round(len(doc_priced) / len(priced), 3) if priced else None
    goal_rate = round(len(goal_priced) / len(priced), 3) if priced else None

    leakage_by_class, total_leakage_dollar, total_leakage_currency = _build_leakage(priced)

    edge = _build_edge(priced, doc_priced, undoc_priced)
    risks = _build_risks(
        executed_buys, priced, undoc_priced,
        total_leakage_dollar, total_leakage_currency, leakage_by_class,
    )
    recommendation = _build_recommendation(edge, risks, doc_rate, goal_rate, executed_buys)

    if dqs is not None and dqs_label_val is None:
        dqs_label_val = _dqs_label(dqs)

    return InvestorDnaReport(
        investor_id=investor_id,
        has_sufficient_data=has_sufficient,
        total_executed=len(executed_buys),
        priced_orders=len(priced),
        dqs=dqs,
        dqs_label=dqs_label_val,
        doc_rate=doc_rate,
        goal_rate=goal_rate,
        edge=edge,
        risks=risks,
        recommendation=recommendation,
        leakage_by_class=leakage_by_class,
        total_leakage_dollar=total_leakage_dollar,
        total_leakage_currency=total_leakage_currency,
        patterns=detect_patterns(all_executed),
        generated_at=now,
    )
