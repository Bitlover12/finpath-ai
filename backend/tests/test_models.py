import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.data import load_test_policies
from app.models import (
    AnalyzeResponse,
    IncomeBasis,
    IncomeCondition,
    Policy,
    TaxTreatment,
    UserProfile,
)


FRONTEND_MOCK_DIR = Path(__file__).resolve().parents[2] / "frontend" / "mock"


def demo_profile() -> UserProfile:
    return UserProfile(
        age=26,
        region="SEOUL",
        employment_type="EMPLOYEE",
        company_size="SME",
        annual_income=34_000_000,
        employment_months=12,
        current_assets=15_000_000,
        monthly_saving_capacity=1_000_000,
        housing_status="NO_HOME",
        household_income=None,
        marital_status=None,
        target_assets=200_000_000,
        target_years=9,
    )


def test_user_profile_accepts_frozen_demo_b() -> None:
    profile = demo_profile()
    assert profile.target_assets == 200_000_000
    assert profile.household_income is None


def test_income_condition_requires_a_bound() -> None:
    with pytest.raises(ValidationError):
        IncomeCondition(basis=IncomeBasis.PERSONAL)


def test_income_condition_rejects_reversed_bounds() -> None:
    with pytest.raises(ValidationError):
        IncomeCondition(
            basis=IncomeBasis.PERSONAL,
            min_income=50_000_000,
            max_income=40_000_000,
        )


def test_reduced_tax_requires_override() -> None:
    raw = load_test_policies()[0].model_dump(mode="json")
    raw["id"] = "TEST_INVALID_REDUCED"
    raw["tax_treatment"] = TaxTreatment.REDUCED.value
    raw["tax_rate_override"] = None

    with pytest.raises(ValidationError):
        Policy.model_validate(raw)


def test_minimum_contribution_cannot_exceed_limit() -> None:
    raw = load_test_policies()[0].model_dump(mode="json")
    raw["id"] = "TEST_INVALID_CONTRIBUTION"
    raw["monthly_contribution_min"] = 600_000
    raw["monthly_contribution_limit"] = 500_000

    with pytest.raises(ValidationError):
        Policy.model_validate(raw)


def test_all_synthetic_test_policies_validate() -> None:
    policies = load_test_policies()
    assert 3 <= len(policies) <= 5
    assert len({policy.id for policy in policies}) == len(policies)
    assert all(policy.id.startswith("TEST_") for policy in policies)


def test_frontend_analyze_mocks_match_contract() -> None:
    for filename in [
        "achieved.json",
        "shortfall.json",
        "no_policy.json",
        "needs_more_info.json",
    ]:
        payload = json.loads((FRONTEND_MOCK_DIR / filename).read_text(encoding="utf-8"))
        AnalyzeResponse.model_validate(payload)


def test_production_dataset_is_real_and_never_test_seed():
    from app.data.policies import load_policies

    policies = load_policies("production")
    assert 12 <= len(policies) <= 15
    assert all(not policy.id.startswith("TEST_") for policy in policies)
    assert all("example.com" not in str(policy.source_url) for policy in policies)
