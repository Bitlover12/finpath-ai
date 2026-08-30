from __future__ import annotations

from datetime import date

from app.core.settings import get_baseline_config, today_kst
from app.models.enums import GoalStatus
from app.models.policy import Policy
from app.models.profile import UserProfile
from app.models.results import AnalyzeResponse, Assumptions, PolicyEffect
from app.services.eligibility import evaluate_policies
from app.services.finance import simulate_general_saving
from app.services.goal import evaluate_goal, goal_seeking, goal_time_saved_months
from app.services.optimizer import optimize
from app.services.roadmap import build_roadmap


def analyze_profile(profile: UserProfile, policies: list[Policy]) -> AnalyzeResponse:
    baseline_config = get_baseline_config()
    horizon = profile.target_years * 12
    eligibility = evaluate_policies(profile, policies)
    optimization = optimize(
        profile=profile,
        policies=policies,
        eligibility=eligibility,
        baseline=baseline_config,
        horizon_months=horizon,
    )
    baseline = simulate_general_saving(
        initial_assets=profile.current_assets,
        monthly_saving=profile.monthly_saving_capacity,
        horizon_months=horizon,
        baseline=baseline_config,
    )
    optimized = optimization.simulation
    goal = evaluate_goal(profile.target_assets, optimized.final_assets)
    policies_by_id = {p.id: p for p in policies}
    seeking = None
    if goal.status == GoalStatus.SHORTFALL:
        seeking = goal_seeking(
            profile=profile,
            policies_by_id=policies_by_id,
            allocations=optimization.allocations,
            baseline=baseline_config,
        )
    saved = goal_time_saved_months(
        profile=profile,
        policies_by_id=policies_by_id,
        allocations=optimization.allocations,
        baseline=baseline_config,
    )
    roadmap = build_roadmap(
        profile=profile,
        policies_by_id=policies_by_id,
        allocations=optimization.allocations,
        horizon_months=horizon,
        start_date=today_kst().replace(day=1),
    )

    return AnalyzeResponse(
        profile=profile,
        policy_analysis=optimization.policy_analysis,
        excluded_policies=optimization.exclusions,
        baseline=baseline,
        optimized=optimized,
        policy_effect=PolicyEffect(
            additional_assets=optimized.final_assets - baseline.final_assets,
            goal_time_saved_months=saved,
        ),
        goal=goal,
        goal_seeking=seeking,
        roadmap=roadmap,
        assumptions=Assumptions(
            calculation_date=today_kst(),
            baseline_annual_rate=baseline_config.annual_rate,
            baseline_rate_source=baseline_config.source_name,
            baseline_rate_source_url=baseline_config.source_url,
            baseline_rate_checked_at=baseline_config.checked_at,
            interest_method="MONTHLY_COMPOUND_END_OF_MONTH_CONTRIBUTION",
        ),
    )
