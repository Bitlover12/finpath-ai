from __future__ import annotations

from datetime import date

from dateutil.relativedelta import relativedelta

from app.models.enums import RoadmapType
from app.models.policy import Policy
from app.models.profile import UserProfile
from app.models.results import RoadmapItem
from app.services.finance import calculate_policy_maturity_amount


def _month_label(start: date, offset: int) -> str:
    dt = start + relativedelta(months=offset)
    return f"{dt.year:04d}-{dt.month:02d}"


def build_roadmap(
    *,
    profile: UserProfile,
    policies_by_id: dict[str, Policy],
    allocations: dict[str, int],
    horizon_months: int,
    start_date: date,
) -> list[RoadmapItem]:
    items: list[RoadmapItem] = []
    active = {pid: amount for pid, amount in allocations.items() if amount > 0}

    for pid, amount in sorted(active.items()):
        policy = policies_by_id[pid]
        end_offset = min(policy.duration_months, horizon_months) - 1
        items.append(
            RoadmapItem(
                type=RoadmapType.POLICY_SAVING,
                start_month=_month_label(start_date, 0),
                end_month=_month_label(start_date, end_offset),
                product_id=policy.id,
                product_name=policy.name,
                monthly_amount=amount,
            )
        )
        if policy.duration_months < horizon_months:
            items.append(
                RoadmapItem(
                    type=RoadmapType.MATURITY_REINVESTMENT,
                    start_month=_month_label(start_date, policy.duration_months),
                    end_month=_month_label(start_date, horizon_months - 1),
                    product_id=None,
                    source_policy_id=policy.id,
                    product_name=f"{policy.name} 만기자금 재예치",
                    initial_amount=calculate_policy_maturity_amount(
                        profile=profile,
                        policy=policy,
                        monthly_amount=amount,
                    ),
                )
            )

    change_points = {0, horizon_months}
    for pid in active:
        duration = policies_by_id[pid].duration_months
        if 0 < duration < horizon_months:
            change_points.add(duration)
    points = sorted(change_points)
    for start, end in zip(points, points[1:]):
        active_amount = sum(
            amount
            for pid, amount in active.items()
            if start < policies_by_id[pid].duration_months
        )
        general = max(0, profile.monthly_saving_capacity - active_amount)
        if general <= 0 or end <= start:
            continue
        items.append(
            RoadmapItem(
                type=RoadmapType.GENERAL_SAVING,
                start_month=_month_label(start_date, start),
                end_month=_month_label(start_date, end - 1),
                product_name="일반 저축",
                monthly_amount=general,
            )
        )

    return sorted(items, key=lambda x: (x.start_month, x.type.value, x.product_name))
