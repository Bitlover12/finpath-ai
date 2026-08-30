from __future__ import annotations

from app.models.config import BaselineConfig
from app.models.enums import GoalStatus
from app.models.policy import Policy
from app.models.profile import UserProfile
from app.models.results import GoalResult, GoalSeekingResult
from app.services.finance import simulate_allocations, simulate_general_saving


def evaluate_goal(target_assets: int, final_assets: int) -> GoalResult:
    if final_assets >= target_assets:
        return GoalResult(
            target_assets=target_assets,
            final_assets=final_assets,
            status=GoalStatus.ACHIEVED,
            shortfall=0,
        )
    return GoalResult(
        target_assets=target_assets,
        final_assets=final_assets,
        status=GoalStatus.SHORTFALL,
        shortfall=target_assets - final_assets,
    )


def _simulate_fixed_allocations(
    profile: UserProfile,
    policies_by_id: dict[str, Policy],
    allocations: dict[str, int],
    months: int,
    baseline: BaselineConfig,
):
    return simulate_allocations(
        profile=profile,
        policies_by_id=policies_by_id,
        allocations=allocations,
        horizon_months=months,
        baseline=baseline,
    )


def _scale_allocations(
    *,
    profile: UserProfile,
    new_monthly_budget: int,
    allocations: dict[str, int],
    policies_by_id: dict[str, Policy],
) -> dict[str, int]:
    # Deterministic MVP re-allocation: keep selected policy order and refill to their previous/allowed commitments.
    selected = sorted(
        allocations,
        key=lambda pid: allocations[pid],
        reverse=True,
    )
    remaining = new_monthly_budget
    result: dict[str, int] = {}
    for pid in selected:
        policy = policies_by_id[pid]
        amount = min(remaining, policy.monthly_contribution_limit)
        if policy.monthly_contribution_min is not None and amount < policy.monthly_contribution_min:
            continue
        if amount > 0:
            result[pid] = amount
            remaining -= amount
        if remaining <= 0:
            break
    return result


def find_required_monthly_saving(
    *,
    profile: UserProfile,
    policies_by_id: dict[str, Policy],
    allocations: dict[str, int],
    baseline: BaselineConfig,
) -> int | None:
    target = profile.target_assets
    horizon = profile.target_years * 12
    low = profile.monthly_saving_capacity
    high = max(low, 100_000)

    def final_for(budget: int) -> int:
        new_profile = profile.model_copy(update={"monthly_saving_capacity": budget})
        scaled = _scale_allocations(
            profile=new_profile,
            new_monthly_budget=budget,
            allocations=allocations,
            policies_by_id=policies_by_id,
        )
        return _simulate_fixed_allocations(new_profile, policies_by_id, scaled, horizon, baseline).final_assets

    if final_for(low) >= target:
        return low
    ceiling = 50_000_000
    while high < ceiling and final_for(high) < target:
        high *= 2
    if final_for(min(high, ceiling)) < target:
        return None
    high = min(high, ceiling)
    while high - low > 1_000:
        mid = ((low + high) // 2 // 1_000) * 1_000
        if mid <= low:
            mid = low + 1_000
        if final_for(mid) >= target:
            high = mid
        else:
            low = mid
    return high


def find_required_duration_months(
    *,
    profile: UserProfile,
    policies_by_id: dict[str, Policy],
    allocations: dict[str, int],
    baseline: BaselineConfig,
) -> int | None:
    target_months = profile.target_years * 12
    max_months = min(target_months * 3, 480)
    for months in range(target_months, max_months + 1):
        sim = _simulate_fixed_allocations(profile, policies_by_id, allocations, months, baseline)
        if sim.final_assets >= profile.target_assets:
            return months
    return None


def find_required_initial_assets(
    *,
    profile: UserProfile,
    policies_by_id: dict[str, Policy],
    allocations: dict[str, int],
    baseline: BaselineConfig,
) -> int | None:
    target = profile.target_assets
    months = profile.target_years * 12
    low = profile.current_assets
    high = max(low, target)

    def final_for(initial: int) -> int:
        p = profile.model_copy(update={"current_assets": initial})
        return _simulate_fixed_allocations(p, policies_by_id, allocations, months, baseline).final_assets

    if final_for(low) >= target:
        return low
    if final_for(high) < target:
        return None
    while high - low > 10_000:
        mid = ((low + high) // 2 // 10_000) * 10_000
        if mid <= low:
            mid = low + 10_000
        if final_for(mid) >= target:
            high = mid
        else:
            low = mid
    return high


def goal_seeking(
    *,
    profile: UserProfile,
    policies_by_id: dict[str, Policy],
    allocations: dict[str, int],
    baseline: BaselineConfig,
) -> GoalSeekingResult:
    return GoalSeekingResult(
        required_monthly_saving=find_required_monthly_saving(
            profile=profile,
            policies_by_id=policies_by_id,
            allocations=allocations,
            baseline=baseline,
        ),
        required_duration_months=find_required_duration_months(
            profile=profile,
            policies_by_id=policies_by_id,
            allocations=allocations,
            baseline=baseline,
        ),
        required_initial_assets=find_required_initial_assets(
            profile=profile,
            policies_by_id=policies_by_id,
            allocations=allocations,
            baseline=baseline,
        ),
    )


def find_goal_months_general(profile: UserProfile, baseline: BaselineConfig) -> int | None:
    target_months = profile.target_years * 12
    max_months = min(target_months * 3, 480)
    for months in range(1, max_months + 1):
        result = simulate_general_saving(
            initial_assets=profile.current_assets,
            monthly_saving=profile.monthly_saving_capacity,
            horizon_months=months,
            baseline=baseline,
        )
        if result.final_assets >= profile.target_assets:
            return months
    return None


def find_goal_months_optimized(
    profile: UserProfile,
    policies_by_id: dict[str, Policy],
    allocations: dict[str, int],
    baseline: BaselineConfig,
) -> int | None:
    target_months = profile.target_years * 12
    max_months = min(target_months * 3, 480)
    for months in range(1, max_months + 1):
        result = _simulate_fixed_allocations(profile, policies_by_id, allocations, months, baseline)
        if result.final_assets >= profile.target_assets:
            return months
    return None


def goal_time_saved_months(
    profile: UserProfile,
    policies_by_id: dict[str, Policy],
    allocations: dict[str, int],
    baseline: BaselineConfig,
) -> int | None:
    base = find_goal_months_general(profile, baseline)
    opt = find_goal_months_optimized(profile, policies_by_id, allocations, baseline)
    target_months = profile.target_years * 12
    if base is None or opt is None:
        return None
    if opt > target_months * 2:
        return None
    return max(0, base - opt)
