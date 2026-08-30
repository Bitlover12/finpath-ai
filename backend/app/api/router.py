from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from app.core.settings import get_baseline_config
from app.data.policies import load_policies
from app.models.contracts import (
    AnalyzeRequest,
    EligibilityRequest,
    EligibilityResponse,
    GoalSeekRequest,
    ScenarioApplyRequest,
    ScenarioParseRequest,
    ScenarioParseResponse,
    SimulationRequest,
    SimulationResponse,
)
from app.models.enums import CompanySize, EmploymentType
from app.models.profile import UserProfile
from app.models.results import AnalyzeResponse
from app.services.analyze import analyze_profile
from app.services.eligibility import evaluate_policies
from app.services.finance import simulate_allocations
from app.services.goal import goal_seeking
from app.services.optimizer import optimize
from app.services.scenario import parse_scenario

router = APIRouter(prefix="/api")



def _demo_manual_confirmations(policies) -> dict[str, bool]:
    confirmations: dict[str, bool] = {}
    for policy in policies:
        if not policy.id.startswith("YFS_"):
            continue
        for requirement in policy.manual_requirements:
            confirmations[f"{policy.id}:{requirement.id}"] = True
    return confirmations


def _policies():
    return load_policies()


@router.get("/policies")
def policies() -> list[dict[str, Any]]:
    return [p.model_dump(mode="json") for p in _policies()]


@router.post("/eligibility", response_model=EligibilityResponse)
def eligibility(request: EligibilityRequest) -> EligibilityResponse:
    policies = _policies()
    return EligibilityResponse(
        results=evaluate_policies(request.profile, policies, request.policy_ids)
    )


@router.post("/simulate", response_model=SimulationResponse)
def simulate(request: SimulationRequest) -> SimulationResponse:
    policies = _policies()
    by_id = {p.id: p for p in policies}
    allocations = {a.policy_id: a.monthly_amount for a in request.allocations}
    missing = sorted(set(allocations) - set(by_id))
    if missing:
        raise HTTPException(status_code=400, detail=f"Unknown policy ids: {missing}")
    result = simulate_allocations(
        profile=request.profile,
        policies_by_id=by_id,
        allocations=allocations,
        horizon_months=request.horizon_months or request.profile.target_years * 12,
        baseline=get_baseline_config(),
    )
    return SimulationResponse(result=result)


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    return analyze_profile(request.profile, _policies())


@router.post("/optimize")
def optimize_api(request: AnalyzeRequest) -> dict[str, Any]:
    policies = _policies()
    eligibility_results = evaluate_policies(request.profile, policies)
    result = optimize(
        profile=request.profile,
        policies=policies,
        eligibility=eligibility_results,
        baseline=get_baseline_config(),
        horizon_months=request.profile.target_years * 12,
    )
    return {
        "optimized": result.simulation.model_dump(mode="json"),
        "allocations": result.allocations,
        "policy_analysis": [x.model_dump(mode="json") for x in result.policy_analysis],
        "excluded_policies": [x.model_dump(mode="json") for x in result.exclusions],
    }


@router.post("/goal-seek")
def goal_seek(request: GoalSeekRequest) -> dict[str, Any]:
    policies = _policies()
    eligibility_results = evaluate_policies(request.profile, policies)
    opt = optimize(
        profile=request.profile,
        policies=policies,
        eligibility=eligibility_results,
        baseline=get_baseline_config(),
        horizon_months=request.profile.target_years * 12,
    )
    result = goal_seeking(
        profile=request.profile,
        policies_by_id={p.id: p for p in policies},
        allocations=opt.allocations,
        baseline=get_baseline_config(),
    )
    return result.model_dump(mode="json")


@router.post("/scenario/parse", response_model=ScenarioParseResponse)
def scenario_parse(request: ScenarioParseRequest) -> ScenarioParseResponse:
    return parse_scenario(request.text)


def _apply_change(data: dict[str, Any], field: str, value: Any) -> None:
    if isinstance(value, dict) and value.get("operation") == "ADD":
        data[field] = int(data.get(field, 0)) + int(value.get("amount", 0))
    else:
        data[field] = value


@router.post("/scenario/apply", response_model=AnalyzeResponse)
def scenario_apply(request: ScenarioApplyRequest) -> AnalyzeResponse:
    data = request.profile.model_dump(mode="python")
    for change in request.changes:
        _apply_change(data, change.field.value, change.value)
    profile = UserProfile.model_validate(data)
    return analyze_profile(profile, _policies())


@router.get("/demo/{demo_id}", response_model=AnalyzeResponse)
def demo(demo_id: str) -> AnalyzeResponse:
    demo_id = demo_id.upper()
    policies = _policies()
    if demo_id == "B":
        profile = UserProfile(
            age=26,
            region="SEOUL",
            employment_type=EmploymentType.EMPLOYEE,
            company_size=CompanySize.SME,
            annual_income=34_000_000,
            employment_months=12,
            current_assets=15_000_000,
            monthly_saving_capacity=1_000_000,
            housing_status="NO_HOME",
            household_income=70_000_000,
            marital_status="SINGLE",
            target_assets=200_000_000,
            target_years=9,
            manual_confirmations=_demo_manual_confirmations(policies),
        )
        return analyze_profile(profile, policies)
    if demo_id == "C":
        profile = UserProfile(
            age=55,
            region="JEJU",
            employment_type=EmploymentType.UNEMPLOYED,
            company_size=CompanySize.NONE,
            annual_income=80_000_000,
            employment_months=0,
            current_assets=10_000_000,
            monthly_saving_capacity=500_000,
            target_assets=100_000_000,
            target_years=5,
        )
        return analyze_profile(profile, policies)
    if demo_id == "A":
        seed = UserProfile(
            age=26,
            region="SEOUL",
            employment_type=EmploymentType.EMPLOYEE,
            company_size=CompanySize.SME,
            annual_income=28_000_000,
            employment_months=18,
            current_assets=15_000_000,
            monthly_saving_capacity=1_000_000,
            housing_status="NO_HOME",
            household_income=65_000_000,
            marital_status="SINGLE",
            target_assets=1,
            target_years=9,
            manual_confirmations=_demo_manual_confirmations(policies),
        )
        interim = analyze_profile(seed, policies)
        if interim.optimized.final_assets <= interim.baseline.final_assets:
            raise HTTPException(status_code=409, detail="DEMO_A requires Optimized > Baseline")
        raw_target = interim.baseline.final_assets + int(
            (interim.optimized.final_assets - interim.baseline.final_assets) * 0.7
        )
        target = max(100_000, (raw_target // 100_000) * 100_000)
        profile = seed.model_copy(update={"target_assets": target})
        result = analyze_profile(profile, policies)
        if not (result.baseline.final_assets < target <= result.optimized.final_assets):
            raise HTTPException(status_code=409, detail="DEMO_A regression condition failed")
        return result
    raise HTTPException(status_code=404, detail="demo_id must be A, B or C")
