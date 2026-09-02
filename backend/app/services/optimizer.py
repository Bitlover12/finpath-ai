from __future__ import annotations

from dataclasses import dataclass
from itertools import combinations
from math import ceil

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


def _candidate_amounts(policy: Policy, monthly_budget: int) -> list[int]:
    """Return financially meaningful contribution breakpoints for one policy.

    The old optimizer always filled a policy to its maximum. That is wrong for
    fixed/capped matching programs (for example, save 100k -> government 300k):
    paying 500k into such a policy can waste 400k that would earn more in the
    general-savings bucket without increasing the subsidy.

    We therefore score the minimum, support-cap/tier breakpoints, policy maximum,
    and the user's budget edge. This keeps search fast while covering the points
    where marginal policy benefit changes.
    """
    if monthly_budget <= 0:
        return []

    minimum = policy.monthly_contribution_min or 1
    upper = min(monthly_budget, policy.monthly_contribution_limit)
    if upper < minimum:
        return []

    values: set[int] = {upper}
    if policy.monthly_contribution_min is not None:
        values.add(policy.monthly_contribution_min)

    for tier in policy.government_contribution_tiers or []:
        values.add(min(tier.monthly_contribution_cap, upper))
        if tier.rate > 0 and tier.monthly_government_cap is not None:
            # First whole-won contribution at which the government cap is reached.
            saturation = ceil(tier.monthly_government_cap / tier.rate)
            values.add(min(saturation, tier.monthly_contribution_cap, upper))

    return sorted(v for v in values if minimum <= v <= upper)


def _score_amount(
    *,
    profile: UserProfile,
    policy: Policy,
    amount: int,
    policies_by_id: dict[str, Policy],
    horizon_months: int,
    baseline: BaselineConfig,
) -> tuple[int, float]:
    """Return incremental assets and incremental-benefit-per-won for an amount."""
    general_sim = simulate_general_saving(
        initial_assets=profile.current_assets,
        monthly_saving=amount,
        horizon_months=horizon_months,
        baseline=baseline,
    )
    policy_only_profile = profile.model_copy(update={"monthly_saving_capacity": amount})
    policy_isolated = simulate_allocations(
        profile=policy_only_profile,
        policies_by_id=policies_by_id,
        allocations={policy.id: amount},
        horizon_months=horizon_months,
        baseline=baseline,
    )
    incremental = policy_isolated.final_assets - general_sim.final_assets
    score = incremental / amount if amount else float("-inf")
    return incremental, score


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
    # policy_id -> (preferred monthly amount, incremental benefit, benefit score)
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

        amounts = _candidate_amounts(policy, profile.monthly_saving_capacity)
        if not amounts:
            exclusions.append(
                OptimizationExclusion(
                    policy_id=policy.id,
                    reason="MONTHLY_BUDGET_BELOW_MINIMUM_CONTRIBUTION",
                )
            )
            continue

        scored: list[tuple[float, int, int]] = []  # score, incremental, amount
        for amount in amounts:
            incremental, score = _score_amount(
                profile=profile,
                policy=policy,
                amount=amount,
                policies_by_id=policies_by_id,
                horizon_months=horizon_months,
                baseline=baseline,
            )
            scored.append((score, incremental, amount))

        # Rank by marginal efficiency first; if tied, prefer the larger absolute
        # benefit. This makes fixed-match policies stop at their subsidy cap while
        # proportional policies naturally use their useful maximum.
        best_score, best_incremental, preferred_amount = max(
            scored, key=lambda item: (item[0], item[1], item[2])
        )
        metrics[policy.id] = (preferred_amount, best_incremental, best_score)
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
                preferred = metrics[policy.id][0]
                amount = min(remaining, preferred)
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
