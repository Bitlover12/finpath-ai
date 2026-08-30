from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import CompanySize, EmploymentType


class UserProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    age: int = Field(ge=0, le=120)
    region: str = Field(min_length=1)
    employment_type: EmploymentType
    company_size: CompanySize
    annual_income: int = Field(ge=0)
    employment_months: int = Field(ge=0)
    current_assets: int = Field(ge=0)
    monthly_saving_capacity: int = Field(ge=0)
    housing_status: str | None = None
    household_income: int | None = Field(default=None, ge=0)
    marital_status: str | None = None
    target_assets: int = Field(gt=0)
    target_years: int = Field(gt=0, le=50)
    manual_confirmations: dict[str, bool] = Field(default_factory=dict)
