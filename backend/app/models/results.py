from datetime import date
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

from app.models.enums import ApplicationStatus, EligibilityStatus, GoalStatus, IncomeBasis, RoadmapType
from app.models.profile import UserProfile


class EligibilityCheck(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field: str
    basis: IncomeBasis | None = None
    required: dict[str, Any] = Field(default_factory=dict)
    actual: Any | None = None
    result: bool | None = None
    reason: str | None = None


class EligibilityResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    policy_id: str
    status: EligibilityStatus
    checks: list[EligibilityCheck] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)


class PolicyAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid")

    policy_id: str
    policy_name: str
    source_url: HttpUrl
    application_status: ApplicationStatus
    application_period_text: str | None = None
    status: EligibilityStatus
    checks: list[EligibilityCheck] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)

    standalone_contribution: int | None = Field(default=None, ge=0)
    incremental_benefit: int | None = None
    benefit_score: float | None = None

    selected_in_optimal_path: bool = False
    allocated_monthly_amount: int = Field(default=0, ge=0)
    optimization_exclusion_reason: str | None = None


class AssetPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    month: int = Field(ge=0)
    total_assets: int = Field(ge=0)


class SimulationResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    initial_assets: int = Field(ge=0)
    principal: int = Field(ge=0)
    gross_interest: int = Field(ge=0)
    tax_paid: int = Field(ge=0)
    net_interest: int = Field(ge=0)
    government_support: int = Field(ge=0)
    tax_benefit: int = Field(ge=0)
    final_assets: int = Field(ge=0)
    trajectory: list[AssetPoint] = Field(default_factory=list)


class GoalResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_assets: int = Field(gt=0)
    final_assets: int = Field(ge=0)
    status: GoalStatus
    shortfall: int = Field(ge=0)


class GoalSeekingResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    required_monthly_saving: int | None = Field(default=None, ge=0)
    required_duration_months: int | None = Field(default=None, gt=0)
    required_initial_assets: int | None = Field(default=None, ge=0)


class PolicyEffect(BaseModel):
    model_config = ConfigDict(extra="forbid")

    additional_assets: int
    goal_time_saved_months: int | None = Field(default=None, ge=0)


class RoadmapItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: RoadmapType
    start_month: str
    end_month: str
    product_id: str | None = None
    source_policy_id: str | None = None
    product_name: str
    monthly_amount: int | None = Field(default=None, ge=0)
    initial_amount: int | None = Field(default=None, ge=0)


class Assumptions(BaseModel):
    model_config = ConfigDict(extra="forbid")

    calculation_date: date
    baseline_annual_rate: float = Field(ge=0, le=1)
    baseline_rate_source: str
    baseline_rate_source_url: HttpUrl | None = None
    baseline_rate_checked_at: date
    tax_basis: str = "GENERAL_RESIDENT_15_4"
    tax_timing: str = "AT_MATURITY"
    contribution_timing: str = "END_OF_MONTH"
    interest_method: str
    policy_start_timing: str = "ALL_AT_MONTH_0"
    early_termination_assumed: bool = False
    policy_conditions_maintained: bool = True
    reinvestment_rate_basis: str = "BASELINE_CONFIG"
    reinvestment_tax_treatment: str = "TAXABLE"
    reinvestment_tax_timing: str = "AT_HORIZON_END"


class OptimizationExclusion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    policy_id: str
    reason: str


class AnalyzeResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile: UserProfile
    policy_analysis: list[PolicyAnalysis]
    excluded_policies: list[OptimizationExclusion] = Field(default_factory=list)
    baseline: SimulationResult
    optimized: SimulationResult
    policy_effect: PolicyEffect
    goal: GoalResult
    goal_seeking: GoalSeekingResult | None = None
    roadmap: list[RoadmapItem]
    assumptions: Assumptions
