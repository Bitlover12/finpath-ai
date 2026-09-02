from app.core.settings import get_baseline_config
from app.data.policies import load_policies
from app.models import CompanySize, EmploymentType, EligibilityStatus, UserProfile
from app.services.analyze import analyze_profile
from app.services.eligibility import evaluate_policy, evaluate_policies
from app.services.optimizer import optimize


def base_profile(**updates):
    data = dict(
        age=26,
        region="SEOUL",
        employment_type=EmploymentType.EMPLOYEE,
        company_size=CompanySize.SME,
        annual_income=34_000_000,
        employment_months=24,
        current_assets=15_000_000,
        monthly_saving_capacity=1_000_000,
        housing_status="NO_HOME",
        household_income=65_000_000,
        marital_status="SINGLE",
        target_assets=200_000_000,
        target_years=9,
        manual_confirmations={},
    )
    data.update(updates)
    return UserProfile(**data)


def confirmations_for(policy):
    return {f"{policy.id}:{r.id}": True for r in policy.manual_requirements}


def test_production_dataset_has_15_officially_sourced_variants():
    policies = load_policies("production")
    assert len(policies) == 15
    assert len({p.id for p in policies}) == 15
    assert all(not p.id.startswith("TEST_") for p in policies)
    assert all("example.com" not in str(p.source_url) for p in policies)


def test_manual_requirement_missing_then_confirmed():
    policy = next(p for p in load_policies("production") if p.id == "YFS_GENERAL_2026")
    missing = evaluate_policy(base_profile(), policy)
    assert missing.status == EligibilityStatus.NEEDS_MORE_INFORMATION
    assert any(x.startswith("manual_confirmations.") for x in missing.missing_fields)

    profile = base_profile(manual_confirmations=confirmations_for(policy))
    confirmed = evaluate_policy(profile, policy)
    assert confirmed.status == EligibilityStatus.ELIGIBLE


def test_known_failure_beats_missing_manual_requirement():
    policy = next(p for p in load_policies("production") if p.id == "YFS_GENERAL_2026")
    profile = base_profile(age=50)
    result = evaluate_policy(profile, policy)
    assert result.status == EligibilityStatus.INELIGIBLE
    assert result.missing_fields


def test_closed_policy_can_be_condition_eligible_but_is_not_optimized():
    policies = load_policies("production")
    seoul = next(p for p in policies if p.id == "SEOUL_HOPE_DOUBLE_24M_2026")
    profile = base_profile(
        annual_income=30_000_000,
        manual_confirmations=confirmations_for(seoul),
    )
    result = evaluate_policy(profile, seoul)
    assert result.status == EligibilityStatus.ELIGIBLE

    eligibility = evaluate_policies(profile, policies)
    opt = optimize(
        profile=profile,
        policies=policies,
        eligibility=eligibility,
        baseline=get_baseline_config(),
        horizon_months=profile.target_years * 12,
    )
    exclusion = {x.policy_id: x.reason for x in opt.exclusions}
    assert exclusion[seoul.id] == "APPLICATION_CLOSED"
    assert seoul.id not in opt.allocations


def test_production_yfs_can_drive_shortfall_analysis_when_confirmed():
    policies = load_policies("production")
    yfs = [p for p in policies if p.id.startswith("YFS_")]
    confirmations = {}
    for policy in yfs:
        confirmations.update(confirmations_for(policy))
    profile = base_profile(manual_confirmations=confirmations)
    result = analyze_profile(profile, policies)
    assert result.optimized.final_assets >= result.baseline.final_assets
    assert result.goal.status.value == "SHORTFALL"
    assert any(a.selected_in_optimal_path for a in result.policy_analysis if a.policy_id.startswith("YFS_"))
