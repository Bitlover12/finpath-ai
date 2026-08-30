from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import CompanySize, EmploymentType, ScenarioField
from app.models.profile import UserProfile
from app.models.results import AnalyzeResponse, EligibilityResult, SimulationResult


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile: UserProfile


class EligibilityRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile: UserProfile
    policy_ids: list[str] | None = None


class EligibilityResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    results: list[EligibilityResult]


class PolicyAllocation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    policy_id: str
    monthly_amount: int = Field(gt=0)


class SimulationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile: UserProfile
    allocations: list[PolicyAllocation] = Field(default_factory=list)
    horizon_months: int | None = Field(default=None, gt=0)


class SimulationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    result: SimulationResult


class OptimizeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile: UserProfile


class GoalSeekRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile: UserProfile


class ScenarioChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field: ScenarioField
    value: Any

    @model_validator(mode="after")
    def validate_typed_value(self) -> "ScenarioChange":
        numeric_nonnegative = {
            ScenarioField.AGE,
            ScenarioField.ANNUAL_INCOME,
            ScenarioField.EMPLOYMENT_MONTHS,
            ScenarioField.CURRENT_ASSETS,
            ScenarioField.MONTHLY_SAVING_CAPACITY,
            ScenarioField.HOUSEHOLD_INCOME,
            ScenarioField.TARGET_ASSETS,
            ScenarioField.TARGET_YEARS,
        }
        if self.field in numeric_nonnegative:
            if isinstance(self.value, dict):
                if set(self.value) != {"operation", "amount"} or self.value.get("operation") != "ADD":
                    raise ValueError("numeric scenario operations must be ADD with an integer amount")
                amount = self.value.get("amount")
                if isinstance(amount, bool) or not isinstance(amount, int):
                    raise ValueError("scenario ADD amount must be an integer")
                return self
            if self.value is None and self.field == ScenarioField.HOUSEHOLD_INCOME:
                return self
            if isinstance(self.value, bool) or not isinstance(self.value, int):
                raise ValueError("numeric scenario value must be an integer")
            if self.value < 0:
                raise ValueError("numeric scenario value must be non-negative")
            if self.field in {ScenarioField.TARGET_ASSETS, ScenarioField.TARGET_YEARS} and self.value <= 0:
                raise ValueError("target values must be positive")
            if self.field == ScenarioField.AGE and self.value > 120:
                raise ValueError("age must be <= 120")
            return self

        if self.field == ScenarioField.COMPANY_SIZE:
            CompanySize(self.value)
        elif self.field == ScenarioField.EMPLOYMENT_TYPE:
            EmploymentType(self.value)
        elif self.field == ScenarioField.REGION:
            if not isinstance(self.value, str) or not self.value.strip():
                raise ValueError("region must be a non-empty string")
        elif self.field in {ScenarioField.HOUSING_STATUS, ScenarioField.MARITAL_STATUS}:
            if self.value is not None and not isinstance(self.value, str):
                raise ValueError("scenario value must be a string or null")
        return self


class ScenarioParseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=1000)


class ScenarioParseResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    changes: list[ScenarioChange]
    notice: str | None = None


class ScenarioApplyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile: UserProfile
    changes: list[ScenarioChange]


class ErrorDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    error: ErrorDetail


# Public alias documenting the contract returned by POST /api/analyze.
AnalyzeApiResponse = AnalyzeResponse
