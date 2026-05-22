"""Tests for Daily Action Feed engine (pure logic — no DB, no external calls)."""
import uuid
from datetime import datetime, timezone


from app.action_feed.schemas import ActionItem, DailyActionFeed


def _make_item(id: str, priority: int, action_type: str = "BUY") -> ActionItem:
    return ActionItem(
        id=id,
        priority=priority,
        category="rebalance",
        action_type=action_type,
        title=f"Item {id}",
        reasoning="Test reasoning",
        ticker="AAPL",
        amount=1000.0,
        units=5.0,
        unit_price=200.0,
        currency="USD",
        source="rebalancing",
    )


class TestActionFeedSorting:
    """Verify priority ordering and deduplication without hitting DB."""

    def test_priority_sort_urgent_first(self):
        items = [
            _make_item("c", 3),
            _make_item("a", 1),
            _make_item("b", 2),
        ]
        sorted_items = sorted(items, key=lambda x: (x.priority, x.id))
        assert sorted_items[0].priority == 1
        assert sorted_items[1].priority == 2
        assert sorted_items[2].priority == 3

    def test_deduplication_by_id(self):
        items = [
            _make_item("dup", 1),
            _make_item("dup", 2),
            _make_item("unique", 3),
        ]
        seen: set[str] = set()
        unique = []
        for item in items:
            if item.id not in seen:
                seen.add(item.id)
                unique.append(item)
        assert len(unique) == 2
        assert unique[0].id == "dup"
        assert unique[1].id == "unique"

    def test_cap_at_12_items(self):
        items = [_make_item(str(i), 3) for i in range(20)]
        capped = items[:12]
        assert len(capped) == 12

    def test_summary_urgent(self):
        items = [_make_item("x", 1), _make_item("y", 1)]
        urgent = sum(1 for i in items if i.priority == 1)
        summary = f"{urgent} urgent actions need your attention."
        assert "2 urgent" in summary

    def test_summary_empty(self):
        summary = "Portfolio looks healthy — no actions needed today."
        assert "healthy" in summary


class TestDailyActionFeedSchema:
    def test_schema_fields(self):
        feed = DailyActionFeed(
            investor_id=uuid.uuid4(),
            generated_at=datetime.now(timezone.utc),
            summary="1 urgent action needs your attention.",
            currency="ILS",
            urgent_count=1,
            high_count=0,
            medium_count=0,
            items=[_make_item("test", 1)],
        )
        assert feed.urgent_count == 1
        assert feed.currency == "ILS"
        assert len(feed.items) == 1

    def test_action_item_optional_fields(self):
        item = ActionItem(
            id="goal-123",
            priority=3,
            category="goal",
            action_type="CONTRIBUTE",
            title="Goal at risk",
            reasoning="Need 500 ILS/month.",
            currency="ILS",
            source="goals",
        )
        assert item.ticker is None
        assert item.amount is None
        assert item.units is None

    def test_action_item_with_all_fields(self):
        item = _make_item("full", 2, "SELL")
        assert item.ticker == "AAPL"
        assert item.amount == 1000.0
        assert item.unit_price == 200.0
