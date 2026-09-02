from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_production_demo_end_to_end_invariants(monkeypatch):
    monkeypatch.setenv("FINPATH_POLICY_DATASET", "production")
    policies = client.get("/api/policies")
    assert policies.status_code == 200
    policy_rows = policies.json()
    assert len(policy_rows) == 15
    assert all(not row["id"].startswith("TEST_") for row in policy_rows)

    for demo_id in ("A", "B", "C"):
        response = client.get(f"/api/demo/{demo_id}")
        assert response.status_code == 200, response.text
        result = response.json()
        assert result["baseline"]["trajectory"][-1]["total_assets"] == result["baseline"]["final_assets"]
        assert result["optimized"]["trajectory"][-1]["total_assets"] == result["optimized"]["final_assets"]
        assert result["policy_effect"]["additional_assets"] == (
            result["optimized"]["final_assets"] - result["baseline"]["final_assets"]
        )
        selected = [p for p in result["policy_analysis"] if p["selected_in_optimal_path"]]
        assert sum(p["allocated_monthly_amount"] for p in selected) <= result["profile"]["monthly_saving_capacity"]
        assert all(p["status"] == "ELIGIBLE" for p in selected)
        assert all(p["application_status"] in {"OPEN", "UPCOMING"} for p in selected)

    a = client.get("/api/demo/A").json()
    assert a["baseline"]["final_assets"] < a["goal"]["target_assets"] <= a["optimized"]["final_assets"]
    assert a["goal"]["status"] == "ACHIEVED"
    reinvestments = [x for x in a["roadmap"] if x["type"] == "MATURITY_REINVESTMENT"]
    assert reinvestments
    assert all((x["initial_amount"] or 0) > 0 for x in reinvestments)

    b = client.get("/api/demo/B").json()
    assert b["goal"]["status"] == "SHORTFALL"
    assert b["goal_seeking"] is not None
    assert b["goal_seeking"]["required_monthly_saving"] > b["profile"]["monthly_saving_capacity"]
    assert b["goal_seeking"]["required_duration_months"] > b["profile"]["target_years"] * 12

    c = client.get("/api/demo/C").json()
    assert c["optimized"]["final_assets"] == c["baseline"]["final_assets"]
    assert c["policy_effect"]["additional_assets"] == 0
    assert not any(p["selected_in_optimal_path"] for p in c["policy_analysis"])


def test_goal_seeking_boundary_is_real(monkeypatch):
    monkeypatch.setenv("FINPATH_POLICY_DATASET", "production")
    b = client.get("/api/demo/B").json()
    required = b["goal_seeking"]["required_monthly_saving"]
    target = b["goal"]["target_assets"]
    changes = [{"field": "monthly_saving_capacity", "value": required}]
    achieved = client.post("/api/scenario/apply", json={"profile": b["profile"], "changes": changes})
    assert achieved.status_code == 200, achieved.text
    assert achieved.json()["optimized"]["final_assets"] >= target


def test_validation_error_contract_and_scenario_type_validation(monkeypatch):
    monkeypatch.setenv("FINPATH_POLICY_DATASET", "production")
    invalid = client.post("/api/analyze", json={"profile": {"age": -1}})
    assert invalid.status_code == 422
    body = invalid.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["error"]["message"]
    assert "errors" in body["error"]["details"]

    b = client.get("/api/demo/B").json()
    invalid_scenario = client.post(
        "/api/scenario/apply",
        json={"profile": b["profile"], "changes": [{"field": "annual_income", "value": "abc"}]},
    )
    assert invalid_scenario.status_code == 422
    assert invalid_scenario.json()["error"]["code"] == "VALIDATION_ERROR"
