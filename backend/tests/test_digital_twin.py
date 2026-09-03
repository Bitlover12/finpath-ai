from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _demo_b(monkeypatch):
    monkeypatch.setenv("FINPATH_POLICY_DATASET", "production")
    response = client.get("/api/demo/B")
    assert response.status_code == 200, response.text
    return response.json()


def test_opportunity_radar_preserves_unknown_manual_eligibility(monkeypatch):
    base = _demo_b(monkeypatch)
    response = client.post("/api/opportunity-radar", json={"profile": base["profile"]})
    assert response.status_code == 200, response.text
    radar = response.json()

    # 희망저축계좌 I has non-assumable welfare/manual conditions. Radar must not
    # silently promote it to available just because recruitment is open.
    assert "HOPE_SAVINGS_I_2026" not in {x["policy_id"] for x in radar["now_available"]}
    assert "HOPE_SAVINGS_I_2026" in {x["policy_id"] for x in radar["verify_required"]}
    assert radar["notice"]


def test_opportunity_radar_detects_numeric_policy_cliffs(monkeypatch):
    base = _demo_b(monkeypatch)
    response = client.post("/api/opportunity-radar", json={"profile": base["profile"]})
    assert response.status_code == 200, response.text
    cliffs = response.json()["cliffs"]

    assert cliffs
    assert any(x["field"] == "annual_income" for x in cliffs)
    assert any(x["field"] == "age" for x in cliffs)
    for cliff in cliffs:
        assert cliff["distance_value"] > 0
        assert cliff["affected_policies"]
        assert isinstance(cliff["final_assets_delta"], int)
        assert isinstance(cliff["government_support_delta"], int)


def test_scenario_compare_recalculates_policy_and_assets(monkeypatch):
    base = _demo_b(monkeypatch)
    response = client.post(
        "/api/scenario/compare",
        json={
            "profile": base["profile"],
            "changes": [
                {"field": "company_size", "value": "LARGE"},
                {"field": "annual_income", "value": 45_000_000},
            ],
        },
    )
    assert response.status_code == 200, response.text
    result = response.json()

    assert result["before"]["profile"]["company_size"] == "SME"
    assert result["after"]["profile"]["company_size"] == "LARGE"
    assert result["after"]["profile"]["annual_income"] == 45_000_000
    assert result["final_assets_delta"] == (
        result["after"]["optimized"]["final_assets"] - result["before"]["optimized"]["final_assets"]
    )
    assert result["government_support_delta"] == (
        result["after"]["optimized"]["government_support"] - result["before"]["optimized"]["government_support"]
    )
    assert any(x["change_type"] == "LOST_OPPORTUNITY" for x in result["policy_changes"])


def test_action_plan_is_grounded_in_current_analysis(monkeypatch):
    base = _demo_b(monkeypatch)
    response = client.post("/api/opportunity-radar", json={"profile": base["profile"]})
    assert response.status_code == 200, response.text
    actions = response.json()["action_plan"]

    assert actions
    allowed = {"APPLY_OR_VERIFY", "WATCH_NOTICE", "CONFIRM_ELIGIBILITY", "RECHECK_AT_THRESHOLD", "SIMULATE_BEFORE_CHANGE", "GOAL_GAP"}
    assert all(x["action_type"] in allowed for x in actions)
    # Any action that links to a policy must use a real official/source URL from the dataset.
    assert all((x["policy_id"] is None) or x["source_url"] for x in actions)


def test_fallback_parser_handles_employment_and_saving_changes(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_MODEL", raising=False)
    employment = client.post("/api/scenario/parse", json={"text": "재직 2년이 되면?"})
    saving = client.post("/api/scenario/parse", json={"text": "월 저축액을 20만원 늘리면?"})
    assert employment.status_code == 200
    assert employment.json()["changes"] == [{"field": "employment_months", "value": 24}]
    assert saving.status_code == 200
    assert saving.json()["changes"] == [
        {"field": "monthly_saving_capacity", "value": {"operation": "ADD", "amount": 200_000}}
    ]


def test_fallback_parser_crosses_explicit_income_cliff(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_MODEL", raising=False)
    response = client.post("/api/scenario/parse", json={"text": "연봉이 6000만원을 넘으면?"})
    assert response.status_code == 200
    assert response.json()["changes"] == [{"field": "annual_income", "value": 60_000_001}]
