from datetime import date

from app.data import load_test_policies
from app.models.enums import CompanySize, EligibilityStatus, EmploymentType
from app.models.profile import UserProfile
from app.services.eligibility import evaluate_policy, evaluate_policies


def profile(**updates):
    data = dict(
        age=26,
        region="SEOUL",
        employment_type=EmploymentType.EMPLOYEE,
        company_size=CompanySize.SME,
        annual_income=34_000_000,
        employment_months=12,
        current_assets=15_000_000,
        monthly_saving_capacity=1_000_000,
        housing_status="NO_HOME",
        household_income=70_000_000,
        marital_status="SINGLE",
        target_assets=200_000_000,
        target_years=9,
    )
    data.update(updates)
    return UserProfile(**data)


def test_sme_policy_eligible():
    policy = {p.id: p for p in load_test_policies()}["TEST_SME_MATCH"]
    result = evaluate_policy(profile(), policy, as_of=date(2026, 8, 30))
    assert result.status == EligibilityStatus.ELIGIBLE


def test_personal_income_failure_beats_missing_household():
    policy = {p.id: p for p in load_test_policies()}["TEST_HOUSEHOLD_MATCH"]
    result = evaluate_policy(
        profile(annual_income=70_000_000, household_income=None),
        policy,
        as_of=date(2026, 8, 30),
    )
    assert result.status == EligibilityStatus.INELIGIBLE
    assert "household_income" in result.missing_fields


def test_household_missing_needs_more_info():
    policy = {p.id: p for p in load_test_policies()}["TEST_HOUSEHOLD_MATCH"]
    result = evaluate_policy(profile(household_income=None), policy, as_of=date(2026, 8, 30))
    assert result.status == EligibilityStatus.NEEDS_MORE_INFORMATION
    assert result.missing_fields == ["household_income"]


def test_policy_zero_case():
    results = evaluate_policies(profile(age=60), load_test_policies(), as_of=date(2026, 8, 30))
    assert all(r.status != EligibilityStatus.ELIGIBLE for r in results)
