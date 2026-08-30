from app.core.settings import get_baseline_config
from app.data import load_test_policies
from app.models.enums import CompanySize, EmploymentType
from app.models.profile import UserProfile
from app.services.finance import simulate_allocations, simulate_general_saving


def profile(monthly=1_000_000, years=9):
    return UserProfile(
        age=26,
        region="SEOUL",
        employment_type=EmploymentType.EMPLOYEE,
        company_size=CompanySize.SME,
        annual_income=28_000_000,
        employment_months=18,
        current_assets=15_000_000,
        monthly_saving_capacity=monthly,
        household_income=65_000_000,
        target_assets=200_000_000,
        target_years=years,
    )


def test_baseline_principal_is_conserved():
    p = profile()
    result = simulate_general_saving(
        initial_assets=p.current_assets,
        monthly_saving=p.monthly_saving_capacity,
        horizon_months=108,
        baseline=get_baseline_config(),
    )
    assert result.principal == 123_000_000
    assert result.final_assets > result.principal
    assert result.tax_paid > 0


def test_policy_maturity_recycles_monthly_budget_and_keeps_principal():
    p = profile()
    policies = {x.id: x for x in load_test_policies()}
    result = simulate_allocations(
        profile=p,
        policies_by_id=policies,
        allocations={"TEST_SME_MATCH": 500_000},
        horizon_months=108,
        baseline=get_baseline_config(),
    )
    assert result.principal == 123_000_000
    assert result.government_support > 0
    assert result.final_assets > 0
    assert result.trajectory[-1].total_assets == result.final_assets


def test_tax_benefit_not_double_counted_smoke():
    p = profile()
    policies = {x.id: x for x in load_test_policies()}
    result = simulate_allocations(
        profile=p,
        policies_by_id=policies,
        allocations={"TEST_SME_MATCH": 500_000},
        horizon_months=36,
        baseline=get_baseline_config(),
    )
    assert result.tax_benefit >= 0
    # final assets should be substantially below a nonsensical double-add of all support+tax benefit again.
    assert result.final_assets < result.principal + result.gross_interest + result.government_support + result.tax_benefit + 1
