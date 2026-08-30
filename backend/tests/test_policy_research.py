import json
from pathlib import Path


def test_policy_research_seed_is_explicitly_non_production_and_has_12_entries():
    path = Path(__file__).resolve().parents[1] / "app" / "data" / "policy_research_2026.json"
    items = json.loads(path.read_text(encoding="utf-8"))
    assert len(items) == 12
    assert all(item.get("engine_ready") is False for item in items)
    assert all(item.get("source_url") for item in items)
    assert all(item.get("checked_at") for item in items)
