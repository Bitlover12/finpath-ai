from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from math import isfinite

from app.models.config import BaselineConfig
from app.models.enums import GovernmentSupportTiming, IncomeBasis, TaxTreatment
from app.models.policy import GovernmentContributionTier, Policy
from app.models.profile import UserProfile
from app.models.results import AssetPoint, SimulationResult

NORMAL_TAX_RATE = 0.154


@dataclass
class PolicyState:
    policy: Policy
    monthly_amount: int
    balance: float = 0.0
    contributed: float = 0.0
    gross_interest: float = 0.0
    government_support: float = 0.0
    deferred_support: float = 0.0
    matured: bool = False


@dataclass
class ReinvestmentState:
    source_policy_id: str
    balance: float
    gross_interest: float = 0.0


def _tax_rate(policy: Policy) -> float:
    if policy.tax_treatment == TaxTreatment.TAX_FREE:
        return 0.0
    if policy.tax_treatment == TaxTreatment.REDUCED:
        return float(policy.tax_rate_override or 0.0)
    return NORMAL_TAX_RATE


def resolve_government_tier(profile: UserProfile, policy: Policy) -> GovernmentContributionTier | None:
    tiers = policy.government_contribution_tiers or []
    if not tiers:
        return None

    # Policy data should list tiers from the narrowest income cap to catch-all max_income=None.
    def sort_key(tier: GovernmentContributionTier) -> tuple[int, int]:
        return (1 if tier.max_income is None else 0, tier.max_income or 0)

    for tier in sorted(tiers, key=sort_key):
        value = profile.annual_income if tier.income_basis == IncomeBasis.PERSONAL else profile.household_income
        if value is None:
            continue
        if tier.max_income is None or value <= tier.max_income:
            return tier
    return None


def _monthly_support(profile: UserProfile, policy: Policy, contribution: int) -> float:
    tier = resolve_government_tier(profile, policy)
    if tier is None:
        return 0.0
    eligible = min(contribution, tier.monthly_contribution_cap)
    support = eligible * tier.rate
    if tier.monthly_government_cap is not None:
        support = min(support, tier.monthly_government_cap)
    return max(0.0, support)


def _round_money(value: float) -> int:
    if not isfinite(value):
        raise ValueError("non-finite financial value")
    return max(0, int(round(value)))


def simulate_general_saving(
    *,
    initial_assets: int,
    monthly_saving: int,
    horizon_months: int,
    baseline: BaselineConfig,
) -> SimulationResult:
    monthly_rate = baseline.annual_rate / 12.0
    balance = float(initial_assets)
    gross_interest = 0.0
    trajectory = [AssetPoint(month=0, total_assets=_round_money(balance))]

    for month in range(1, horizon_months + 1):
        interest = balance * monthly_rate
        gross_interest += interest
        balance += interest
        balance += monthly_saving  # END_OF_MONTH contribution
        trajectory.append(AssetPoint(month=month, total_assets=_round_money(balance)))

    tax_paid = gross_interest * NORMAL_TAX_RATE
    final_assets = balance - tax_paid
    principal = initial_assets + monthly_saving * horizon_months
    # The chart must end at the same after-tax value shown in the summary card.
    if trajectory:
        trajectory[-1] = AssetPoint(month=horizon_months, total_assets=_round_money(final_assets))
    return SimulationResult(
        initial_assets=initial_assets,
        principal=principal,
        gross_interest=_round_money(gross_interest),
        tax_paid=_round_money(tax_paid),
        net_interest=_round_money(gross_interest - tax_paid),
        government_support=0,
        tax_benefit=0,
        final_assets=_round_money(final_assets),
        trajectory=trajectory,
    )


def calculate_policy_maturity_amount(
    *,
    profile: UserProfile,
    policy: Policy,
    monthly_amount: int,
) -> int:
    """Return the after-tax maturity lump sum for one policy allocation.

    This mirrors the policy-balance portion of simulate_allocations and is used
    only to populate roadmap cash-flow amounts; it does not alter optimization.
    """
    balance = 0.0
    gross_interest = 0.0
    deferred_support = 0.0
    monthly_rate = policy.interest_rate / 12.0

    for _month in range(1, policy.duration_months + 1):
        interest = balance * monthly_rate
        balance += interest
        gross_interest += interest
        balance += monthly_amount

        support = _monthly_support(profile, policy, monthly_amount)
        if policy.government_support_timing == GovernmentSupportTiming.MONTHLY_ACCRUAL:
            if policy.government_support_interest_bearing:
                balance += support
            else:
                deferred_support += support
        else:
            deferred_support += support

    balance += deferred_support
    actual_tax = gross_interest * _tax_rate(policy)
    return _round_money(max(0.0, balance - actual_tax))


def simulate_allocations(
    *,
    profile: UserProfile,
    policies_by_id: dict[str, Policy],
    allocations: dict[str, int],
    horizon_months: int,
    baseline: BaselineConfig,
) -> SimulationResult:
    """Monthly simulation with policy maturity, taxes, reinvestment and budget recycling.

    Assumptions follow the frozen MVP spec:
    - selected policies all start at month 0;
    - contributions happen at month end;
    - matured policy monthly contribution automatically returns to GENERAL_SAVING;
    - matured lump sum goes to a separate reinvestment balance using the baseline rate;
    - policy interest tax is charged at policy maturity;
    - reinvestment/general-savings interest tax is settled at simulation horizon end.
    """
    monthly_baseline_rate = baseline.annual_rate / 12.0
    general_balance = float(profile.current_assets)
    general_interest = 0.0
    states: dict[str, PolicyState] = {}
    for policy_id, amount in allocations.items():
        if amount <= 0:
            continue
        policy = policies_by_id[policy_id]
        states[policy_id] = PolicyState(policy=policy, monthly_amount=amount)

    reinvestments: list[ReinvestmentState] = []
    policy_tax_paid = 0.0
    tax_benefit = 0.0
    policy_net_interest = 0.0
    total_government = 0.0
    user_policy_contributions = 0.0
    trajectory: list[AssetPoint] = [AssetPoint(month=0, total_assets=profile.current_assets)]

    for month in range(1, horizon_months + 1):
        # First accrue one month of interest on balances that existed throughout the month.
        interest = general_balance * monthly_baseline_rate
        general_balance += interest
        general_interest += interest

        for reinvest in reinvestments:
            ri = reinvest.balance * monthly_baseline_rate
            reinvest.balance += ri
            reinvest.gross_interest += ri

        for state in states.values():
            if state.matured:
                continue
            monthly_rate = state.policy.interest_rate / 12.0
            pi = state.balance * monthly_rate
            state.balance += pi
            state.gross_interest += pi

        # END_OF_MONTH contributions. Active policy commitments are preserved until maturity.
        active_total = 0
        for state in states.values():
            if state.matured:
                continue
            if month <= state.policy.duration_months:
                contribution = state.monthly_amount
                active_total += contribution
                state.balance += contribution
                state.contributed += contribution
                user_policy_contributions += contribution
                support = _monthly_support(profile, state.policy, contribution)
                state.government_support += support
                total_government += support
                if state.policy.government_support_timing == GovernmentSupportTiming.MONTHLY_ACCRUAL:
                    if state.policy.government_support_interest_bearing:
                        state.balance += support
                    else:
                        # Amount is recognized monthly but does not earn interest.
                        state.deferred_support += support
                else:
                    state.deferred_support += support

        general_contribution = max(0, profile.monthly_saving_capacity - active_total)
        general_balance += general_contribution

        # Mature after the final scheduled end-of-month contribution.
        for state in states.values():
            if state.matured or month != state.policy.duration_months:
                continue
            state.balance += state.deferred_support
            actual_tax = state.gross_interest * _tax_rate(state.policy)
            normal_tax = state.gross_interest * NORMAL_TAX_RATE
            benefit = max(0.0, normal_tax - actual_tax)
            tax_benefit += benefit
            policy_tax_paid += actual_tax
            policy_net_interest += state.gross_interest - actual_tax
            net_maturity_balance = max(0.0, state.balance - actual_tax)
            reinvestments.append(
                ReinvestmentState(source_policy_id=state.policy.id, balance=net_maturity_balance)
            )
            state.balance = 0.0
            state.matured = True

        total_assets = general_balance + sum(s.balance for s in states.values()) + sum(
            r.balance for r in reinvestments
        )
        trajectory.append(AssetPoint(month=month, total_assets=_round_money(total_assets)))

    # If horizon exactly ends before a selected policy's maturity, the optimizer should have excluded it.
    # For direct /simulate calls we still settle accumulated policy interest at the horizon to avoid hidden tax.
    for state in states.values():
        if state.matured:
            continue
        state.balance += state.deferred_support
        actual_tax = state.gross_interest * _tax_rate(state.policy)
        normal_tax = state.gross_interest * NORMAL_TAX_RATE
        tax_benefit += max(0.0, normal_tax - actual_tax)
        policy_tax_paid += actual_tax
        policy_net_interest += state.gross_interest - actual_tax
        state.balance -= actual_tax

    reinvestment_interest = sum(r.gross_interest for r in reinvestments)
    general_tax = general_interest * NORMAL_TAX_RATE
    reinvestment_tax = reinvestment_interest * NORMAL_TAX_RATE
    general_balance -= general_tax
    for reinvest in reinvestments:
        reinvest.balance -= reinvest.gross_interest * NORMAL_TAX_RATE

    final_assets = general_balance + sum(s.balance for s in states.values()) + sum(
        r.balance for r in reinvestments
    )
    gross_interest = general_interest + reinvestment_interest + sum(s.gross_interest for s in states.values())
    total_tax = general_tax + reinvestment_tax + policy_tax_paid
    net_interest = gross_interest - total_tax
    principal = profile.current_assets + profile.monthly_saving_capacity * horizon_months

    # Force the last trajectory point to match the after-tax final result.
    if trajectory:
        trajectory[-1] = AssetPoint(month=horizon_months, total_assets=_round_money(final_assets))

    return SimulationResult(
        initial_assets=profile.current_assets,
        principal=_round_money(principal),
        gross_interest=_round_money(gross_interest),
        tax_paid=_round_money(total_tax),
        net_interest=_round_money(net_interest),
        government_support=_round_money(total_government),
        tax_benefit=_round_money(tax_benefit),
        final_assets=_round_money(final_assets),
        trajectory=trajectory,
    )
