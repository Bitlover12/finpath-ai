from __future__ import annotations

from dataclasses import dataclass
from itertools import combinations

from app.models.config import BaselineConfig
from app.models.enums import ApplicationStatus, EligibilityStatus
from app.models.policy import Policy
from app.models.profile import UserProfile
from app.models.results import EligibilityResult, OptimizationExclusion, PolicyAnalysis, SimulationResult
from app.services.finance import simulate_allocations, simulate_general_saving


@dataclass
class OptimizationResult:
    simulation: SimulationResult
    allocations: dict[str, int]
    policy_analysis: list[PolicyAnalysis]
    exclusions: list[OptimizationExclusion]


def _incompatible(combo: tuple[Policy, ...]) -> bool:
    ids = {p.id for p in combo}
    return any(any(other in ids for other in p.incompatible_policy_ids) for p in combo)


def _allocation_key(allocations: dict[str, int]) -> tuple[tuple[str, int], ...]:
    return tuple(sorted((pid, amount) for pid, amount in allocations.items() if amount > 0))


def optimize(
    *,
    profile: UserProfile,
    policies: list[Policy],
    eligibility: list[EligibilityResult],
    baseline: BaselineConfig,
    horizon_months: int,
) -> OptimizationResult:
    policies_by_id = {p.id: p for p in policies}
    eligibility_by_id = {r.policy_id: r for r in eligibility}
    exclusions: list[OptimizationExclusion] = []
    metrics: dict[str, tuple[int, int, float]] = {}
    candidates: list[Policy] = []

    for policy in policies:
        result = eligibility_by_id[policy.id]
        if result.status != EligibilityStatus.ELIGIBLE:
            continue
        if policy.application_status == ApplicationStatus.CLOSED:
            exclusions.append(
                OptimizationExclusion(policy_id=policy.id, reason="APPLICATION_CLOSED")
            )
            continue
        if policy.application_status == ApplicationStatus.CHECK_REQUIRED:
            exclusions.append(
                OptimizationExclusion(policy_id=policy.id, reason="APPLICATION_STATUS_CHECK_REQUIRED")
            )
            continue
        if policy.duration_months > horizon_months:
            exclusions.append(
                OptimizationExclusion(policy_id=policy.id, reason="MATURITY_AFTER_TARGET_HORIZON")
            )
            continue
        standalone = min(profile.monthly_saving_capacity, policy.monthly_contribution_limit)
        if standalone <= 0 or (
            policy.monthly_contribution_min is not None
            and standalone < policy.monthly_contribution_min
        ):
            exclusions.append(
                OptimizationExclusion(
                    policy_id=policy.id,
                    reason="MONTHLY_BUDGET_BELOW_MINIMUM_CONTRIBUTION",
                )
            )
            continue

        policy_sim = simulate_allocations(
            profile=profile,
            policies_by_id=policies_by_id,
            allocations={policy.id: standalone},
            horizon_months=horizon_months,
            baseline=baseline,
        )
        # Same initial assets and same standalone monthly budget, with all remaining monthly capacity removed
        # so the comparison isolates the policy-vs-general decision for the same cash flow.
        general_sim = simulate_general_saving(
            initial_assets=profile.current_assets,
            monthly_saving=standalone,
            horizon_months=horizon_months,
            baseline=baseline,
        )
        policy_only_profile = profile.model_copy(update={"monthly_saving_capacity": standalone})
        policy_isolated = simulate_allocations(
            profile=policy_only_profile,
            policies_by_id=policies_by_id,
            allocations={policy.id: standalone},
            horizon_months=horizon_months,
            baseline=baseline,
        )
        incremental = policy_isolated.final_assets - general_sim.final_assets
        score = incremental / standalone if standalone else float("-inf")
        metrics[policy.id] = (standalone, incremental, score)
        candidates.append(policy)

    candidates.sort(key=lambda p: (metrics[p.id][2], metrics[p.id][1], p.id), reverse=True)
    candidates = candidates[:8]

    baseline_full = simulate_general_saving(
        initial_assets=profile.current_assets,
        monthly_saving=profile.monthly_saving_capacity,
        horizon_months=horizon_months,
        baseline=baseline,
    )
    best_sim = baseline_full
    best_allocations: dict[str, int] = {}
    seen: set[tuple[tuple[str, int], ...]] = {()}

    for size in range(1, min(4, len(candidates)) + 1):
        for combo in combinations(candidates, size):
            if _incompatible(combo):
                continue
            ordered = sorted(combo, key=lambda p: metrics[p.id][2], reverse=True)
            remaining = profile.monthly_saving_capacity
            allocations: dict[str, int] = {}
            for policy in ordered:
                if remaining <= 0:
                    break
                amount = min(remaining, policy.monthly_contribution_limit)
                if policy.monthly_contribution_min is not None and amount < policy.monthly_contribution_min:
                    continue
                if amount > 0:
                    allocations[policy.id] = amount
                    remaining -= amount

            key = _allocation_key(allocations)
            if key in seen:
                continue
            seen.add(key)
            if not allocations:
                continue
            sim = simulate_allocations(
                profile=profile,
                policies_by_id=policies_by_id,
                allocations=allocations,
                horizon_months=horizon_months,
                baseline=baseline,
            )
            if sim.final_assets > best_sim.final_assets:
                best_sim = sim
                best_allocations = allocations

    exclusion_map = {e.policy_id: e.reason for e in exclusions}
    analyses: list[PolicyAnalysis] = []
    for policy in policies:
        eligibility_result = eligibility_by_id[policy.id]
        metric = metrics.get(policy.id)
        analyses.append(
            PolicyAnalysis(
                policy_id=policy.id,
                policy_name=policy.name,
                source_url=policy.source_url,
                application_status=policy.application_status,
                application_period_text=policy.application_period_text,
                status=eligibility_result.status,
                checks=eligibility_result.checks,
                missing_fields=eligibility_result.missing_fields,
                standalone_contribution=metric[0] if metric else None,
                incremental_benefit=metric[1] if metric else None,
                benefit_score=metric[2] if metric else None,
                selected_in_optimal_path=policy.id in best_allocations,
                allocated_monthly_amount=best_allocations.get(policy.id, 0),
                optimization_exclusion_reason=exclusion_map.get(policy.id),
            )
        )

    return OptimizationResult(
        simulation=best_sim,
        allocations=best_allocations,
        policy_analysis=analyses,
        exclusions=exclusions,
    )
