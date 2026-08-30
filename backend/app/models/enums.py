from enum import Enum


class EmploymentType(str, Enum):
    EMPLOYEE = "EMPLOYEE"
    SELF_EMPLOYED = "SELF_EMPLOYED"
    FREELANCER = "FREELANCER"
    UNEMPLOYED = "UNEMPLOYED"
    OTHER = "OTHER"


class CompanySize(str, Enum):
    SME = "SME"
    MID = "MID"
    LARGE = "LARGE"
    PUBLIC = "PUBLIC"
    NONE = "NONE"
    OTHER = "OTHER"


class IncomeBasis(str, Enum):
    PERSONAL = "PERSONAL"
    HOUSEHOLD = "HOUSEHOLD"


class GovernmentSupportTiming(str, Enum):
    MONTHLY_ACCRUAL = "MONTHLY_ACCRUAL"
    AT_MATURITY = "AT_MATURITY"


class TaxTreatment(str, Enum):
    TAXABLE = "TAXABLE"
    TAX_FREE = "TAX_FREE"
    REDUCED = "REDUCED"


class ApplicationStatus(str, Enum):
    OPEN = "OPEN"
    UPCOMING = "UPCOMING"
    CLOSED = "CLOSED"
    CHECK_REQUIRED = "CHECK_REQUIRED"


class EligibilityStatus(str, Enum):
    ELIGIBLE = "ELIGIBLE"
    INELIGIBLE = "INELIGIBLE"
    NEEDS_MORE_INFORMATION = "NEEDS_MORE_INFORMATION"


class GoalStatus(str, Enum):
    ACHIEVED = "ACHIEVED"
    SHORTFALL = "SHORTFALL"


class RoadmapType(str, Enum):
    POLICY_SAVING = "POLICY_SAVING"
    GENERAL_SAVING = "GENERAL_SAVING"
    MATURITY_REINVESTMENT = "MATURITY_REINVESTMENT"


class ScenarioField(str, Enum):
    AGE = "age"
    REGION = "region"
    EMPLOYMENT_TYPE = "employment_type"
    COMPANY_SIZE = "company_size"
    ANNUAL_INCOME = "annual_income"
    EMPLOYMENT_MONTHS = "employment_months"
    CURRENT_ASSETS = "current_assets"
    MONTHLY_SAVING_CAPACITY = "monthly_saving_capacity"
    HOUSING_STATUS = "housing_status"
    HOUSEHOLD_INCOME = "household_income"
    MARITAL_STATUS = "marital_status"
    TARGET_ASSETS = "target_assets"
    TARGET_YEARS = "target_years"
