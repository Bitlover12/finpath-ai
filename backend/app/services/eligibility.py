from __future__ import annotations

from datetime import date
from typing import Any

from app.core.settings import today_kst
from app.models.enums import EligibilityStatus, IncomeBasis
from app.models.policy import Policy
from app.models.profile import UserProfile
from app.models.results import EligibilityCheck, EligibilityResult


def _add_check(
    checks: list[EligibilityCheck],
    *,
    field: str,
    required: dict[str, Any],
    actual: Any,
    result: bool | None,
    reason: str | None = None,
    basis: IncomeBasis | None = None,
) -> None:
    checks.append(
        EligibilityCheck(
            field=field,
            basis=basis,
            required=required,
            actual=actual,
            result=result,
            reason=reason,
        )
    )


def evaluate_policy(profile: UserProfile, policy: Policy, *, as_of: date | None = None) -> EligibilityResult:
    """Pure rule-based policy eligibility evaluation.

    Precedence is intentionally deterministic:
    known failure -> INELIGIBLE; else missing info -> NEEDS_MORE_INFORMATION; else ELIGIBLE.
    """
    checks: list[EligibilityCheck] = []
    missing_fields: list[str] = []
    known_failure = False
    as_of = as_of or today_kst()

    # Eligibility answers "does the user satisfy the qualification rules?" only.
    # Current application availability is intentionally kept separate in Policy.application_status
    # so a closed policy can still be explained as condition-eligible without being optimized/recommended.

    if policy.min_age is not None or policy.max_age is not None:
        ok = (policy.min_age is None or profile.age >= policy.min_age) and (
            policy.max_age is None or profile.age <= policy.max_age
        )
        _add_check(
            checks,
            field="age",
            required={"min": policy.min_age, "max": policy.max_age},
            actual=profile.age,
            result=ok,
            reason=None if ok else "연령 조건을 충족하지 않습니다.",
        )
        known_failure |= not ok

    for cond in policy.income_conditions:
        if cond.basis == IncomeBasis.PERSONAL:
            actual = profile.annual_income
            field_name = "annual_income"
        else:
            actual = profile.household_income
            field_name = "household_income"

        if actual is None:
            missing_fields.append(field_name)
            _add_check(
                checks,
                field="income",
                basis=cond.basis,
                required={"min": cond.min_income, "max": cond.max_income},
                actual=None,
                result=None,
                reason=f"{field_name} 정보가 필요합니다.",
            )
            continue

        ok = (cond.min_income is None or actual >= cond.min_income) and (
            cond.max_income is None or actual <= cond.max_income
        )
        _add_check(
            checks,
            field="income",
            basis=cond.basis,
            required={"min": cond.min_income, "max": cond.max_income},
            actual=actual,
            result=ok,
            reason=None if ok else "소득 조건을 충족하지 않습니다.",
        )
        known_failure |= not ok

    if policy.allowed_regions is not None:
        ok = profile.region.upper() in {v.upper() for v in policy.allowed_regions}
        _add_check(
            checks,
            field="region",
            required={"allowed": policy.allowed_regions},
            actual=profile.region,
            result=ok,
            reason=None if ok else "거주지역 조건을 충족하지 않습니다.",
        )
        known_failure |= not ok

    if policy.allowed_company_sizes is not None:
        ok = profile.company_size in policy.allowed_company_sizes
        _add_check(
            checks,
            field="company_size",
            required={"allowed": [v.value for v in policy.allowed_company_sizes]},
            actual=profile.company_size.value,
            result=ok,
            reason=None if ok else "기업규모 조건을 충족하지 않습니다.",
        )
        known_failure |= not ok

    if policy.allowed_employment_types is not None:
        ok = profile.employment_type in policy.allowed_employment_types
        _add_check(
            checks,
            field="employment_type",
            required={"allowed": [v.value for v in policy.allowed_employment_types]},
            actual=profile.employment_type.value,
            result=ok,
            reason=None if ok else "고용형태 조건을 충족하지 않습니다.",
        )
        known_failure |= not ok

    if policy.min_employment_months is not None or policy.max_employment_months is not None:
        ok = (
            policy.min_employment_months is None
            or profile.employment_months >= policy.min_employment_months
        ) and (
            policy.max_employment_months is None
            or profile.employment_months <= policy.max_employment_months
        )
        _add_check(
            checks,
            field="employment_months",
            required={"min": policy.min_employment_months, "max": policy.max_employment_months},
            actual=profile.employment_months,
            result=ok,
            reason=None if ok else "재직기간 조건을 충족하지 않습니다.",
        )
        known_failure |= not ok

    for requirement in policy.manual_requirements:
        confirmation_key = f"{policy.id}:{requirement.id}"
        actual = profile.manual_confirmations.get(confirmation_key)
        required = {
            "id": requirement.id,
            "label": requirement.label,
            "description": requirement.description,
            "confirmation_key": confirmation_key,
        }
        if actual is None:
            missing_fields.append(f"manual_confirmations.{confirmation_key}")
            _add_check(
                checks,
                field="manual_requirement",
                required=required,
                actual=None,
                result=None,
                reason="공식 공고의 추가 자격요건 확인이 필요합니다.",
            )
            continue
        _add_check(
            checks,
            field="manual_requirement",
            required=required,
            actual=actual,
            result=actual,
            reason=None if actual else "추가 자격요건을 충족하지 않습니다.",
        )
        known_failure |= not actual

    if known_failure:
        status = EligibilityStatus.INELIGIBLE
    elif missing_fields:
        status = EligibilityStatus.NEEDS_MORE_INFORMATION
    else:
        status = EligibilityStatus.ELIGIBLE

    return EligibilityResult(
        policy_id=policy.id,
        status=status,
        checks=checks,
        missing_fields=sorted(set(missing_fields)),
    )


def evaluate_policies(
    profile: UserProfile,
    policies: list[Policy],
    policy_ids: list[str] | None = None,
    *,
    as_of: date | None = None,
) -> list[EligibilityResult]:
    selected = policies
    if policy_ids is not None:
        wanted = set(policy_ids)
        selected = [p for p in policies if p.id in wanted]
    return [evaluate_policy(profile, policy, as_of=as_of) for policy in selected]
