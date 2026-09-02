from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator

from app.models.enums import (
    ApplicationStatus,
    CompanySize,
    EmploymentType,
    GovernmentSupportTiming,
    IncomeBasis,
    TaxTreatment,
)


class ManualRequirement(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    label: str = Field(min_length=1)
    description: str = Field(min_length=1)
    source_url: HttpUrl | None = None
    # False for hard screening facts that must never be silently assumed in a
    # conditional preview (e.g. current benefit-recipient status).
    preview_assumable: bool = True


class IncomeCondition(BaseModel):
    model_config = ConfigDict(extra="forbid")

    basis: IncomeBasis
    min_income: int | None = Field(default=None, ge=0)
    max_income: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_bounds(self) -> "IncomeCondition":
        if self.min_income is None and self.max_income is None:
            raise ValueError("income condition requires min_income or max_income")
        if (
            self.min_income is not None
            and self.max_income is not None
            and self.min_income > self.max_income
        ):
            raise ValueError("min_income must be <= max_income")
        return self


class GovernmentContributionTier(BaseModel):
    model_config = ConfigDict(extra="forbid")

    income_basis: IncomeBasis
    max_income: int | None = Field(default=None, ge=0)
    rate: float = Field(ge=0, le=10)
    monthly_contribution_cap: int = Field(gt=0)
    monthly_government_cap: int | None = Field(default=None, ge=0)


class Policy(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    description: str = Field(min_length=1)

    min_age: int | None = Field(default=None, ge=0, le=120)
    max_age: int | None = Field(default=None, ge=0, le=120)

    income_conditions: list[IncomeCondition] = Field(default_factory=list)
    manual_requirements: list[ManualRequirement] = Field(default_factory=list)

    allowed_regions: list[str] | None = None
    allowed_company_sizes: list[CompanySize] | None = None
    allowed_employment_types: list[EmploymentType] | None = None

    min_employment_months: int | None = Field(default=None, ge=0)
    max_employment_months: int | None = Field(default=None, ge=0)

    monthly_contribution_min: int | None = Field(default=None, gt=0)
    monthly_contribution_limit: int = Field(gt=0)

    government_contribution_tiers: list[GovernmentContributionTier] | None = None
    government_support_timing: GovernmentSupportTiming
    government_support_interest_bearing: bool

    interest_rate: float = Field(ge=0, le=10)

    tax_treatment: TaxTreatment
    tax_rate_override: float | None = Field(default=None, ge=0, le=1)

    duration_months: int = Field(gt=0)

    start_date: date | None = None
    end_date: date | None = None

    incompatible_policy_ids: list[str] = Field(default_factory=list)

    source_url: HttpUrl
    effective_date: date
    checked_at: datetime
    updated_at: datetime

    application_status: ApplicationStatus = ApplicationStatus.CHECK_REQUIRED
    application_period_text: str | None = None

    @model_validator(mode="after")
    def validate_policy(self) -> "Policy":
        if self.min_age is not None and self.max_age is not None and self.min_age > self.max_age:
            raise ValueError("min_age must be <= max_age")

        if (
            self.min_employment_months is not None
            and self.max_employment_months is not None
            and self.min_employment_months > self.max_employment_months
        ):
            raise ValueError("min_employment_months must be <= max_employment_months")

        if (
            self.monthly_contribution_min is not None
            and self.monthly_contribution_min > self.monthly_contribution_limit
        ):
            raise ValueError("monthly_contribution_min must be <= monthly_contribution_limit")

        if self.tax_treatment == TaxTreatment.REDUCED and self.tax_rate_override is None:
            raise ValueError("REDUCED tax treatment requires tax_rate_override")

        if self.tax_treatment != TaxTreatment.REDUCED and self.tax_rate_override is not None:
            raise ValueError("tax_rate_override is only valid for REDUCED tax treatment")

        if self.start_date is not None and self.end_date is not None and self.start_date > self.end_date:
            raise ValueError("start_date must be <= end_date")

        requirement_ids = [r.id for r in self.manual_requirements]
        if len(requirement_ids) != len(set(requirement_ids)):
            raise ValueError("manual requirement ids must be unique within a policy")

        if self.id in self.incompatible_policy_ids:
            raise ValueError("policy cannot be incompatible with itself")

        if len(self.incompatible_policy_ids) != len(set(self.incompatible_policy_ids)):
            raise ValueError("incompatible_policy_ids must not contain duplicates")

        if self.allowed_regions is not None and len(self.allowed_regions) == 0:
            raise ValueError("allowed_regions must be null or a non-empty list")

        if self.allowed_company_sizes is not None and len(self.allowed_company_sizes) == 0:
            raise ValueError("allowed_company_sizes must be null or a non-empty list")

        if self.allowed_employment_types is not None and len(self.allowed_employment_types) == 0:
            raise ValueError("allowed_employment_types must be null or a non-empty list")

        return self
