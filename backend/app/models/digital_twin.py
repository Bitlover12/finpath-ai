from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

from app.models.enums import ApplicationStatus, EligibilityStatus, GoalStatus, ScenarioField
from app.models.profile import UserProfile
from app.models.results import AnalyzeResponse


class OpportunityItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: str
    policy_id: str
    policy_name: str
    source_url: HttpUrl
    application_status: ApplicationStatus
    eligibility_status: EligibilityStatus
    headline: str
    detail: str
    estimated_financial_effect: int | None = None
    deadline_days: int | None = Field(default=None, ge=0)


class CliffPolicyTransition(BaseModel):
    model_config = ConfigDict(extra="forbid")

    policy_id: str
    policy_name: str
    source_url: HttpUrl
    before_status: EligibilityStatus
    after_status: EligibilityStatus
    transition: str


class PolicyCliffEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    field: ScenarioField
    direction: str
    current_value: Any
    threshold_value: Any
    trigger_value: Any
    distance_value: int
    distance_unit: str
    headline: str
    detail: str
    affected_policies: list[CliffPolicyTransition] = Field(default_factory=list)
    final_assets_delta: int
    government_support_delta: int
    confidence: str


class SensitivityAlert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field: ScenarioField
    headline: str
    detail: str
    affected_policy_ids: list[str] = Field(default_factory=list)


class ActionPlanItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    priority: str
    action_type: str
    title: str
    detail: str
    policy_id: str | None = None
    source_url: HttpUrl | None = None


class OpportunityRadarResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile: UserProfile
    generated_date: date
    now_available: list[OpportunityItem] = Field(default_factory=list)
    verify_required: list[OpportunityItem] = Field(default_factory=list)
    upcoming: list[OpportunityItem] = Field(default_factory=list)
    deadline_alerts: list[OpportunityItem] = Field(default_factory=list)
    cliffs: list[PolicyCliffEvent] = Field(default_factory=list)
    sensitivities: list[SensitivityAlert] = Field(default_factory=list)
    action_plan: list[ActionPlanItem] = Field(default_factory=list)
    notice: str


class AppliedScenarioChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field: ScenarioField
    before_value: Any
    after_value: Any


class ScenarioPolicyChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    policy_id: str
    policy_name: str
    source_url: HttpUrl
    before_status: EligibilityStatus
    after_status: EligibilityStatus
    before_selected: bool
    after_selected: bool
    before_monthly_amount: int = Field(ge=0)
    after_monthly_amount: int = Field(ge=0)
    change_type: str


class ScenarioCompareResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    before: AnalyzeResponse
    after: AnalyzeResponse
    applied_changes: list[AppliedScenarioChange] = Field(default_factory=list)
    policy_changes: list[ScenarioPolicyChange] = Field(default_factory=list)
    final_assets_delta: int
    government_support_delta: int
    tax_benefit_delta: int
    goal_before: GoalStatus
    goal_after: GoalStatus
    shortfall_delta: int
    headline: str
    explanation: str
