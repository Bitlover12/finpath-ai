from fastapi.testclient import TestClient

from app.core.settings import get_baseline_config
from app.data import load_test_policies
from app.main import app
from app.models.enums import CompanySize, EmploymentType, GoalStatus
from app.models.profile import UserProfile
from app.services.analyze import analyze_profile
from app.services.eligibility import evaluate_policies
from app.services.optimizer import optimize

client = TestClient(app)


def profile(target=200_000_000):
    return UserProfile(
        age=26,
        region="SEOUL",
        employment_type=EmploymentType.EMPLOYEE,
        company_size=CompanySize.SME,
        annual_income=28_000_000,
        employment_months=18,
        current_assets=15_000_000,
        monthly_saving_capacity=1_000_000,
        housing_status="NO_HOME",
        household_income=65_000_000,
        target_assets=target,
        target_years=9,
    )


def test_optimizer_respects_budget_and_zero_dedup():
    p = profile()
    policies = load_test_policies()
    result = optimize(
        profile=p,
        policies=policies,
        eligibility=evaluate_policies(p, policies),
        baseline=get_baseline_config(),
        horizon_months=108,
    )
    assert sum(result.allocations.values()) <= p.monthly_saving_capacity
    assert all(v > 0 for v in result.allocations.values())
    assert result.simulation.final_assets > 0


def test_shortfall_goal_seeking_exists():
    result = analyze_profile(profile(), load_test_policies())
    assert result.goal.status == GoalStatus.SHORTFALL
    assert result.goal.shortfall > 0
    assert result.goal_seeking is not None
    assert result.goal_seeking.required_monthly_saving is not None


def test_demo_a_b_c_contracts():
    a = client.get("/api/demo/A")
    assert a.status_code == 200, a.text
    a_json = a.json()
    assert a_json["baseline"]["final_assets"] < a_json["goal"]["target_assets"] <= a_json["optimized"]["final_assets"]
    assert a_json["goal"]["status"] == "ACHIEVED"

    b = client.get("/api/demo/B")
    assert b.status_code == 200, b.text
    assert b.json()["goal"]["status"] == "SHORTFALL"

    c = client.get("/api/demo/C")
    assert c.status_code == 200, c.text
    assert not any(x["status"] == "ELIGIBLE" for x in c.json()["policy_analysis"])


def test_analyze_and_scenario_endpoints():
    payload = {"profile": profile().model_dump(mode="json")}
    response = client.post("/api/analyze", json=payload)
    assert response.status_code == 200, response.text
    assert "policy_analysis" in response.json()

    parsed = client.post(
        "/api/scenario/parse",
        json={"text": "대기업으로 이직하고 연봉이 4500만원이 되면?"},
    )
    assert parsed.status_code == 200, parsed.text
    changes = parsed.json()["changes"]
    assert any(x["field"] == "company_size" and x["value"] == "LARGE" for x in changes)
    assert any(x["field"] == "annual_income" and x["value"] == 45_000_000 for x in changes)
