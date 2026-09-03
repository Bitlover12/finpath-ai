from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Any

from app.core.settings import today_kst
from app.models.contracts import ScenarioChange
from app.models.digital_twin import (
    ActionPlanItem,
    AppliedScenarioChange,
    CliffPolicyTransition,
    OpportunityItem,
    OpportunityRadarResponse,
    PolicyCliffEvent,
    ScenarioCompareResponse,
    ScenarioPolicyChange,
    SensitivityAlert,
)
from app.models.enums import ApplicationStatus, EligibilityStatus, IncomeBasis, ScenarioField
from app.models.policy import Policy
from app.models.profile import UserProfile
from app.models.results import AnalyzeResponse
from app.services.analyze import analyze_profile
from app.services.eligibility import evaluate_policy


@dataclass(frozen=True)
class _BoundaryCandidate:
    field: ScenarioField
    threshold_value: int
    trigger_value: int
    distance_value: int
    distance_unit: str
    policy_id: str
    transition: str


def _apply_value(current: Any, value: Any) -> Any:
    if isinstance(value, dict) and value.get("operation") == "ADD":
        return int(current or 0) + int(value.get("amount", 0))
    return value


def apply_changes(profile: UserProfile, changes: list[ScenarioChange]) -> tuple[UserProfile, list[AppliedScenarioChange]]:
    data = profile.model_dump(mode="python")
    applied: list[AppliedScenarioChange] = []
    for change in changes:
        field = change.field.value
        before = data.get(field)
        after = _apply_value(before, change.value)
        data[field] = after
        applied.append(AppliedScenarioChange(field=change.field, before_value=before, after_value=after))
    return UserProfile.model_validate(data), applied


def _policy_map(analysis: AnalyzeResponse) -> dict[str, Any]:
    return {row.policy_id: row for row in analysis.policy_analysis}


def compare_scenario(profile: UserProfile, changes: list[ScenarioChange], policies: list[Policy]) -> ScenarioCompareResponse:
    before = analyze_profile(profile, policies)
    changed_profile, applied = apply_changes(profile, changes)
    after = analyze_profile(changed_profile, policies)

    before_map = _policy_map(before)
    after_map = _policy_map(after)
    policy_changes: list[ScenarioPolicyChange] = []

    for policy in policies:
        b = before_map[policy.id]
        a = after_map[policy.id]
        if (
            b.status == a.status
            and b.selected_in_optimal_path == a.selected_in_optimal_path
            and b.allocated_monthly_amount == a.allocated_monthly_amount
        ):
            continue

        if b.status == EligibilityStatus.INELIGIBLE and a.status != EligibilityStatus.INELIGIBLE:
            change_type = "GAINED_OPPORTUNITY"
        elif b.status != EligibilityStatus.INELIGIBLE and a.status == EligibilityStatus.INELIGIBLE:
            change_type = "LOST_OPPORTUNITY"
        elif b.selected_in_optimal_path != a.selected_in_optimal_path:
            change_type = "PATH_CHANGED"
        elif b.allocated_monthly_amount != a.allocated_monthly_amount:
            change_type = "ALLOCATION_CHANGED"
        else:
            change_type = "ELIGIBILITY_CHANGED"

        policy_changes.append(
            ScenarioPolicyChange(
                policy_id=policy.id,
                policy_name=policy.name,
                source_url=policy.source_url,
                before_status=b.status,
                after_status=a.status,
                before_selected=b.selected_in_optimal_path,
                after_selected=a.selected_in_optimal_path,
                before_monthly_amount=b.allocated_monthly_amount,
                after_monthly_amount=a.allocated_monthly_amount,
                change_type=change_type,
            )
        )

    final_delta = after.optimized.final_assets - before.optimized.final_assets
    support_delta = after.optimized.government_support - before.optimized.government_support
    tax_delta = after.optimized.tax_benefit - before.optimized.tax_benefit
    shortfall_delta = after.goal.shortfall - before.goal.shortfall

    gained = sum(1 for row in policy_changes if row.change_type == "GAINED_OPPORTUNITY")
    lost = sum(1 for row in policy_changes if row.change_type == "LOST_OPPORTUNITY")
    path_changed = sum(1 for row in policy_changes if row.change_type in {"PATH_CHANGED", "ALLOCATION_CHANGED"})

    if final_delta > 0:
        headline = f"변경 후 예상자산이 {final_delta:,}원 늘어납니다."
    elif final_delta < 0:
        headline = f"변경 후 예상자산이 {abs(final_delta):,}원 줄어듭니다."
    else:
        headline = "변경 후 예상자산은 현재 경로와 같습니다."

    parts: list[str] = []
    if gained:
        parts.append(f"새 금융기회 {gained}개")
    if lost:
        parts.append(f"사라지는 금융기회 {lost}개")
    if path_changed:
        parts.append(f"저축경로 변경 {path_changed}개")
    if support_delta:
        sign = "+" if support_delta > 0 else "-"
        parts.append(f"정부지원 {sign}{abs(support_delta):,}원")
    explanation = " · ".join(parts) if parts else "정책 자격과 월 배분에서 의미 있는 변화가 감지되지 않았습니다."

    return ScenarioCompareResponse(
        before=before,
        after=after,
        applied_changes=applied,
        policy_changes=policy_changes,
        final_assets_delta=final_delta,
        government_support_delta=support_delta,
        tax_benefit_delta=tax_delta,
        goal_before=before.goal.status,
        goal_after=after.goal.status,
        shortfall_delta=shortfall_delta,
        headline=headline,
        explanation=explanation,
    )


def _candidate_boundaries(profile: UserProfile, policies: list[Policy]) -> list[_BoundaryCandidate]:
    rows: list[_BoundaryCandidate] = []
    active_statuses = {ApplicationStatus.OPEN, ApplicationStatus.UPCOMING, ApplicationStatus.CHECK_REQUIRED}

    for policy in policies:
        if policy.application_status not in active_statuses:
            continue
        current = evaluate_policy(profile, policy)

        def add(field: ScenarioField, threshold: int, trigger: int, distance: int, unit: str, expected: str) -> None:
            if distance <= 0:
                return
            data = profile.model_dump(mode="python")
            data[field.value] = trigger
            try:
                after_profile = UserProfile.model_validate(data)
            except Exception:
                return
            after = evaluate_policy(after_profile, policy)
            if expected == "GAIN" and current.status == EligibilityStatus.INELIGIBLE and after.status != EligibilityStatus.INELIGIBLE:
                rows.append(_BoundaryCandidate(field, threshold, trigger, distance, unit, policy.id, "GAIN"))
            elif expected == "LOSS" and current.status != EligibilityStatus.INELIGIBLE and after.status == EligibilityStatus.INELIGIBLE:
                rows.append(_BoundaryCandidate(field, threshold, trigger, distance, unit, policy.id, "LOSS"))

        if policy.min_age is not None and profile.age < policy.min_age:
            add(ScenarioField.AGE, policy.min_age, policy.min_age, policy.min_age - profile.age, "YEARS", "GAIN")
        if policy.max_age is not None and profile.age <= policy.max_age:
            trigger = policy.max_age + 1
            add(ScenarioField.AGE, policy.max_age, trigger, trigger - profile.age, "AGE_STEPS", "LOSS")

        for cond in policy.income_conditions:
            if cond.basis == IncomeBasis.PERSONAL:
                actual = profile.annual_income
                field = ScenarioField.ANNUAL_INCOME
            else:
                actual = profile.household_income
                field = ScenarioField.HOUSEHOLD_INCOME
                if actual is None:
                    continue
            if cond.min_income is not None and actual < cond.min_income:
                add(field, cond.min_income, cond.min_income, cond.min_income - actual, "KRW", "GAIN")
            if cond.max_income is not None and actual <= cond.max_income:
                trigger = cond.max_income + 1
                add(field, cond.max_income, trigger, trigger - actual, "KRW", "LOSS")

        if policy.min_employment_months is not None and profile.employment_months < policy.min_employment_months:
            add(
                ScenarioField.EMPLOYMENT_MONTHS,
                policy.min_employment_months,
                policy.min_employment_months,
                policy.min_employment_months - profile.employment_months,
                "MONTHS",
                "GAIN",
            )
        if policy.max_employment_months is not None and profile.employment_months <= policy.max_employment_months:
            trigger = policy.max_employment_months + 1
            add(
                ScenarioField.EMPLOYMENT_MONTHS,
                policy.max_employment_months,
                trigger,
                trigger - profile.employment_months,
                "MONTHS",
                "LOSS",
            )

    return rows


def _normalized_distance(candidate: _BoundaryCandidate, profile: UserProfile) -> float:
    if candidate.distance_unit == "KRW":
        base = max(1_000_000, profile.annual_income if candidate.field == ScenarioField.ANNUAL_INCOME else (profile.household_income or 1_000_000))
        return candidate.distance_value / base * 12
    if candidate.distance_unit in {"YEARS", "AGE_STEPS"}:
        return candidate.distance_value * 12
    return float(candidate.distance_value)


def _cliff_headline(field: ScenarioField, threshold: int, direction: str) -> tuple[str, str]:
    if field == ScenarioField.ANNUAL_INCOME:
        if direction == "LOSS":
            return f"연소득 {threshold:,}원 초과 시 정책경로가 달라질 수 있어요.", "연소득 기준을 넘기기 전후의 정책 자격과 장기 자산을 다시 계산했습니다."
        return f"연소득 {threshold:,}원 도달 시 새 정책기회가 생길 수 있어요.", "소득 하한을 충족했을 때의 정책 자격과 장기 자산을 다시 계산했습니다."
    if field == ScenarioField.HOUSEHOLD_INCOME:
        if direction == "LOSS":
            return f"가구소득 {threshold:,}원 초과 시 정책기회가 줄 수 있어요.", "가구소득 기준 변화가 정책 자격에 미치는 영향을 계산했습니다."
        return f"가구소득 기준 {threshold:,}원에서 정책기회가 바뀔 수 있어요.", "가구소득 기준 변화가 정책 자격에 미치는 영향을 계산했습니다."
    if field == ScenarioField.EMPLOYMENT_MONTHS:
        if direction == "GAIN":
            return f"재직 {threshold}개월 도달 시 새 자격 가능성이 있어요.", "재직기간 요건을 충족한 시점의 정책 자격을 미리 계산했습니다."
        return f"재직 {threshold}개월 기준을 넘으면 정책경로가 달라질 수 있어요.", "재직기간 상한을 넘긴 뒤의 정책 자격을 계산했습니다."
    if field == ScenarioField.AGE:
        if direction == "GAIN":
            return f"연령 {threshold}세 기준에 도달하면 새 자격 가능성이 있어요.", "정확한 생년월일이 없어 월 단위 시점은 계산하지 않고 연령 기준만 표시합니다."
        return f"연령 {threshold}세 기준을 넘으면 정책기회가 달라질 수 있어요.", "정확한 생년월일이 없어 월 단위 시점은 계산하지 않고 연령 기준만 표시합니다."
    return "조건 경계에서 정책경로가 달라질 수 있어요.", "조건 변경 전후를 다시 계산했습니다."


def _build_cliffs(profile: UserProfile, policies: list[Policy], current_analysis: AnalyzeResponse) -> list[PolicyCliffEvent]:
    raw = _candidate_boundaries(profile, policies)
    if not raw:
        return []

    grouped: dict[tuple[ScenarioField, int], list[_BoundaryCandidate]] = defaultdict(list)
    for row in raw:
        grouped[(row.field, row.trigger_value)].append(row)

    current_selected = {p.policy_id for p in current_analysis.policy_analysis if p.selected_in_optimal_path}
    ranked: list[tuple[tuple[int, int, float], tuple[ScenarioField, int], list[_BoundaryCandidate]]] = []
    for key, rows in grouped.items():
        affects_selected = any(r.policy_id in current_selected for r in rows)
        has_loss = any(r.transition == "LOSS" for r in rows)
        distance = min(_normalized_distance(r, profile) for r in rows)
        ranked.append(((0 if affects_selected else 1, 0 if has_loss else 1, distance), key, rows))
    ranked.sort(key=lambda item: item[0])

    policies_by_id = {p.id: p for p in policies}
    events: list[PolicyCliffEvent] = []
    for _, (field, trigger_value), rows in ranked[:6]:
        data = profile.model_dump(mode="python")
        data[field.value] = trigger_value
        try:
            after_profile = UserProfile.model_validate(data)
        except Exception:
            continue
        after_analysis = analyze_profile(after_profile, policies)

        current_map = _policy_map(current_analysis)
        after_map = _policy_map(after_analysis)
        transitions: list[CliffPolicyTransition] = []
        transition_types: set[str] = set()
        confidence = "CONFIRMED"
        for row in rows:
            policy = policies_by_id[row.policy_id]
            b = current_map[row.policy_id]
            a = after_map[row.policy_id]
            transitions.append(
                CliffPolicyTransition(
                    policy_id=policy.id,
                    policy_name=policy.name,
                    source_url=policy.source_url,
                    before_status=b.status,
                    after_status=a.status,
                    transition=row.transition,
                )
            )
            transition_types.add(row.transition)
            if b.status == EligibilityStatus.NEEDS_MORE_INFORMATION or a.status == EligibilityStatus.NEEDS_MORE_INFORMATION:
                confidence = "CONDITIONAL"

        direction = "MIXED" if len(transition_types) > 1 else next(iter(transition_types))
        representative = min(rows, key=lambda r: r.distance_value)
        headline, detail = _cliff_headline(field, representative.threshold_value, direction if direction != "MIXED" else "LOSS")
        if direction == "MIXED":
            headline = "이 조건 경계를 넘으면 정책구성이 교체될 수 있어요."
            detail = "사라지는 정책과 새로 생기는 정책을 함께 반영해 장기 자산경로를 다시 계산했습니다."

        events.append(
            PolicyCliffEvent(
                id=f"{field.value}:{trigger_value}",
                field=field,
                direction=direction,
                current_value=getattr(profile, field.value),
                threshold_value=representative.threshold_value,
                trigger_value=trigger_value,
                distance_value=representative.distance_value,
                distance_unit=representative.distance_unit,
                headline=headline,
                detail=detail,
                affected_policies=transitions,
                final_assets_delta=after_analysis.optimized.final_assets - current_analysis.optimized.final_assets,
                government_support_delta=after_analysis.optimized.government_support - current_analysis.optimized.government_support,
                confidence=confidence,
            )
        )
    return events


def _sensitivity_alerts(profile: UserProfile, policies: list[Policy], analysis: AnalyzeResponse) -> list[SensitivityAlert]:
    selected_ids = {p.policy_id for p in analysis.policy_analysis if p.selected_in_optimal_path}
    if not selected_ids:
        selected_ids = {
            p.policy_id
            for p in analysis.policy_analysis
            if p.status != EligibilityStatus.INELIGIBLE and p.application_status in {ApplicationStatus.OPEN, ApplicationStatus.UPCOMING}
        }
    policies_by_id = {p.id: p for p in policies}
    by_field: dict[ScenarioField, list[str]] = defaultdict(list)
    for pid in selected_ids:
        policy = policies_by_id[pid]
        if policy.allowed_company_sizes is not None:
            by_field[ScenarioField.COMPANY_SIZE].append(pid)
        if policy.allowed_regions is not None:
            by_field[ScenarioField.REGION].append(pid)
        if policy.allowed_employment_types is not None:
            by_field[ScenarioField.EMPLOYMENT_TYPE].append(pid)

    labels = {
        ScenarioField.COMPANY_SIZE: ("이직할 때 기업규모를 다시 확인하세요.", "중소기업·대기업 등 기업규모가 바뀌면 일부 정책 자격이 즉시 달라질 수 있습니다."),
        ScenarioField.REGION: ("이사 전에는 지역정책을 다시 계산하세요.", "거주지역이 바뀌면 지역형 자산형성 정책의 자격이 달라질 수 있습니다."),
        ScenarioField.EMPLOYMENT_TYPE: ("고용형태가 바뀌면 정책경로도 다시 확인하세요.", "재직자·프리랜서·자영업 등 고용형태 제한이 있는 정책이 포함되어 있습니다."),
    }
    return [
        SensitivityAlert(field=field, headline=labels[field][0], detail=labels[field][1], affected_policy_ids=sorted(ids))
        for field, ids in by_field.items()
    ]


def _opportunity_item(kind: str, row: Any, detail: str, *, effect: int | None = None, deadline_days: int | None = None) -> OpportunityItem:
    if kind == "NOW_AVAILABLE":
        headline = "지금 확인할 수 있는 정책이에요."
    elif kind == "VERIFY_REQUIRED":
        headline = "몇 가지 조건만 확인하면 판단할 수 있어요."
    elif kind == "UPCOMING":
        headline = "모집 공고를 지켜볼 정책이에요."
    else:
        headline = "신청 마감을 확인하세요."
    return OpportunityItem(
        kind=kind,
        policy_id=row.policy_id,
        policy_name=row.policy_name,
        source_url=row.source_url,
        application_status=row.application_status,
        eligibility_status=row.status,
        headline=headline,
        detail=detail,
        estimated_financial_effect=effect,
        deadline_days=deadline_days,
    )


def _action_plan(analysis: AnalyzeResponse, cliffs: list[PolicyCliffEvent]) -> list[ActionPlanItem]:
    items: list[ActionPlanItem] = []
    selected = [p for p in analysis.policy_analysis if p.selected_in_optimal_path and p.allocated_monthly_amount > 0]

    for p in selected:
        if p.application_status == ApplicationStatus.OPEN:
            items.append(ActionPlanItem(priority="NOW", action_type="APPLY_OR_VERIFY", title=f"{p.policy_name} 신청조건 확인", detail=f"현재 경로는 월 {p.allocated_monthly_amount:,}원 배정을 기준으로 계산됐습니다. 공식 신청창구에서 최종 자격과 접수상태를 확인하세요.", policy_id=p.policy_id, source_url=p.source_url))
        elif p.application_status == ApplicationStatus.UPCOMING:
            items.append(ActionPlanItem(priority="WATCH", action_type="WATCH_NOTICE", title=f"{p.policy_name} 모집 공고 확인", detail="현재 계산은 모집 예정/검토 상태를 계획 시뮬레이션으로 반영했습니다. 실제 가입 전 공식 공고를 다시 확인하세요.", policy_id=p.policy_id, source_url=p.source_url))

    pending_open = [p for p in analysis.policy_analysis if p.status == EligibilityStatus.NEEDS_MORE_INFORMATION and p.application_status == ApplicationStatus.OPEN]
    for p in pending_open[:2]:
        items.append(ActionPlanItem(priority="NOW", action_type="CONFIRM_ELIGIBILITY", title=f"{p.policy_name} 추가요건 확인", detail="현재 정보만으로는 가입 가능 여부를 확정할 수 없습니다. 공식 기준과 필요한 증빙을 확인하면 경로를 다시 계산할 수 있습니다.", policy_id=p.policy_id, source_url=p.source_url))

    gain_cliff = next((c for c in cliffs if c.direction in {"GAIN", "MIXED"} and c.field == ScenarioField.EMPLOYMENT_MONTHS), None)
    if gain_cliff:
        items.append(ActionPlanItem(priority="SOON", action_type="RECHECK_AT_THRESHOLD", title=f"재직 {gain_cliff.threshold_value}개월에 정책 재확인", detail=f"현재 기준으로 {gain_cliff.distance_value}개월 차이입니다. 해당 시점에 자격을 다시 판정하세요."))

    loss_cliff = next((c for c in cliffs if c.direction in {"LOSS", "MIXED"}), None)
    if loss_cliff:
        items.append(ActionPlanItem(priority="WATCH", action_type="SIMULATE_BEFORE_CHANGE", title="조건 변경 전 정책절벽 다시 계산", detail=loss_cliff.headline))

    if analysis.goal.status.value == "SHORTFALL" and analysis.goal_seeking and analysis.goal_seeking.required_monthly_saving is not None:
        extra = max(0, analysis.goal_seeking.required_monthly_saving - analysis.profile.monthly_saving_capacity)
        items.append(ActionPlanItem(priority="GOAL", action_type="GOAL_GAP", title=f"목표 달성에 월 {extra:,}원 추가 저축여력 필요", detail=f"현재 조건을 유지한다면 월 총 {analysis.goal_seeking.required_monthly_saving:,}원이 목표 달성 경계입니다."))

    # Stable priority order, with duplicates naturally avoided by the limited generators above.
    rank = {"NOW": 0, "SOON": 1, "WATCH": 2, "GOAL": 3}
    items.sort(key=lambda item: rank.get(item.priority, 9))
    return items[:6]


def build_opportunity_radar(profile: UserProfile, policies: list[Policy]) -> OpportunityRadarResponse:
    analysis = analyze_profile(profile, policies)
    by_policy = {p.id: p for p in policies}
    now_available: list[OpportunityItem] = []
    verify_required: list[OpportunityItem] = []
    upcoming: list[OpportunityItem] = []
    deadline_alerts: list[OpportunityItem] = []
    today = today_kst()

    for row in analysis.policy_analysis:
        policy = by_policy[row.policy_id]
        if row.status == EligibilityStatus.ELIGIBLE and row.application_status == ApplicationStatus.OPEN:
            now_available.append(_opportunity_item("NOW_AVAILABLE", row, row.application_period_text or "현재 모집상태를 공식 창구에서 확인하세요.", effect=row.incremental_benefit))
        if row.status == EligibilityStatus.NEEDS_MORE_INFORMATION and row.application_status in {ApplicationStatus.OPEN, ApplicationStatus.UPCOMING, ApplicationStatus.CHECK_REQUIRED}:
            verify_required.append(_opportunity_item("VERIFY_REQUIRED", row, "가구소득·수급자격·증빙 등 현재 프로필만으로 확정할 수 없는 조건이 있습니다."))
        if row.status != EligibilityStatus.INELIGIBLE and row.application_status == ApplicationStatus.UPCOMING:
            upcoming.append(_opportunity_item("UPCOMING", row, row.application_period_text or "구체적인 모집일은 공식 공고 확인이 필요합니다.", effect=row.incremental_benefit if row.status == EligibilityStatus.ELIGIBLE else None))
        if row.status != EligibilityStatus.INELIGIBLE and row.application_status == ApplicationStatus.OPEN and policy.end_date is not None and policy.end_date >= today:
            days = (policy.end_date - today).days
            if days <= 30:
                deadline_alerts.append(_opportunity_item("DEADLINE", row, f"공식 데이터 기준 종료일까지 {days}일 남았습니다. 지역별 접수 운영 등 세부사항은 공식 창구에서 최종 확인하세요.", effect=row.incremental_benefit if row.status == EligibilityStatus.ELIGIBLE else None, deadline_days=days))

    now_available.sort(key=lambda x: (-(x.estimated_financial_effect or 0), x.policy_name))
    verify_required.sort(key=lambda x: (0 if x.application_status == ApplicationStatus.OPEN else 1, x.policy_name))
    upcoming.sort(key=lambda x: (-(x.estimated_financial_effect or 0), x.policy_name))
    deadline_alerts.sort(key=lambda x: (x.deadline_days if x.deadline_days is not None else 9999, x.policy_name))

    cliffs = _build_cliffs(profile, policies, analysis)
    sensitivities = _sensitivity_alerts(profile, policies, analysis)
    actions = _action_plan(analysis, cliffs)

    return OpportunityRadarResponse(
        profile=profile,
        generated_date=today,
        now_available=now_available,
        verify_required=verify_required,
        upcoming=upcoming,
        deadline_alerts=deadline_alerts,
        cliffs=cliffs,
        sensitivities=sensitivities,
        action_plan=actions,
        notice="FinPath Radar는 현재 production 정책 데이터와 사용자가 입력·확인한 조건만 사용합니다. 미확정 모집일, 수급자격, 중위소득·재산 등 확인되지 않은 조건은 임의로 충족 처리하지 않습니다.",
    )
