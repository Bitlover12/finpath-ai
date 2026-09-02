from app.core.settings import get_baseline_config
from app.data.policies import load_policies
from app.models import CompanySize, EmploymentType, UserProfile
from app.services.analyze import analyze_profile


def test_fixed_match_policy_stops_at_support_breakpoint_and_creates_material_value():
    policies = load_policies("production")
    hope = next(p for p in policies if p.id == "HOPE_SAVINGS_I_2026")
    confirmations = {f"{hope.id}:{r.id}": True for r in hope.manual_requirements}
    profile = UserProfile(
        age=26,
        region="SEOUL",
        employment_type=EmploymentType.EMPLOYEE,
        company_size=CompanySize.SME,
        annual_income=14_000_000,
        employment_months=12,
        current_assets=5_000_000,
        monthly_saving_capacity=500_000,
        housing_status="NO_HOME",
        household_income=15_000_000,
        marital_status="SINGLE",
        target_assets=100_000_000,
        target_years=9,
        manual_confirmations=confirmations,
    )
    result = analyze_profile(profile, policies)
    row = next(x for x in result.policy_analysis if x.policy_id == hope.id)

    # Government support saturates at 100k own contribution (100k -> 300k support).
    # The optimizer must leave the other 400k in general savings instead of blindly
    # filling the policy to its 500k account limit.
    assert row.selected_in_optimal_path
    assert row.allocated_monthly_amount == 100_000
    assert result.optimized.government_support == 10_800_000
    assert result.policy_effect.additional_assets > 10_000_000
    assert result.optimized.final_assets > result.baseline.final_assets


def test_three_x_government_match_is_valid_policy_data():
    policies = load_policies("production")
    hope = next(p for p in policies if p.id == "HOPE_SAVINGS_I_2026")
    assert hope.government_contribution_tiers
    assert hope.government_contribution_tiers[0].rate == 3.0
