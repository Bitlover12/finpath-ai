from __future__ import annotations

from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from app.models.profile import UserProfile
from app.models.results import AnalyzeResponse


class SpendingCategory(str, Enum):
    FOOD = "FOOD"
    DELIVERY = "DELIVERY"
    CAFE = "CAFE"
    TRANSPORT = "TRANSPORT"
    CONVENIENCE = "CONVENIENCE"
    SHOPPING = "SHOPPING"
    SUBSCRIPTION = "SUBSCRIPTION"
    TELECOM = "TELECOM"
    BEAUTY = "BEAUTY"
    CULTURE = "CULTURE"
    ENTERTAINMENT = "ENTERTAINMENT"
    ONLINE = "ONLINE"
    GROCERIES = "GROCERIES"
    FUEL = "FUEL"
    HOUSING = "HOUSING"
    MEDICAL = "MEDICAL"
    EDUCATION = "EDUCATION"
    OTHER = "OTHER"


class CardType(str, Enum):
    CHECK = "CHECK"
    CREDIT = "CREDIT"


class CardTypePreference(str, Enum):
    BOTH = "BOTH"
    CHECK = "CHECK"
    CREDIT = "CREDIT"


class SpendingProfile(BaseModel):
    categories: Dict[SpendingCategory, int] = Field(default_factory=dict)
    current_card_id: Optional[str] = None
    card_type_preference: CardTypePreference = CardTypePreference.BOTH
    cut_percent: int = Field(default=10, ge=0, le=50)


class SpendingRecommendationRequest(BaseModel):
    profile: UserProfile
    spending: SpendingProfile


class CardBenefitBreakdown(BaseModel):
    label: str
    amount: int


class CardRecommendation(BaseModel):
    card_id: str
    issuer: str
    name: str
    card_type: CardType
    annual_fee: int
    minimum_monthly_spend: int
    eligible_without_extra_spend: bool
    estimated_gross_monthly_benefit: int
    estimated_monthly_fee: int
    estimated_net_monthly_benefit: int
    incremental_monthly_benefit_vs_current: int
    benefit_breakdown: List[CardBenefitBreakdown] = Field(default_factory=list)
    source_url: str
    checked_at: str
    notes: List[str] = Field(default_factory=list)


class SpendingCutItem(BaseModel):
    category: SpendingCategory
    current_monthly_amount: int
    assumed_cut_percent: int
    monthly_saving: int


class SpendingOptimizationResponse(BaseModel):
    total_monthly_spend: int
    discretionary_monthly_spend: int
    cut_scenario_monthly_saving: int
    cut_items: List[SpendingCutItem]
    current_card_estimated_net_benefit: int
    best_card_incremental_monthly_benefit: int
    total_extra_monthly_saving: int
    enhanced_monthly_saving_capacity: int
    recommendations: List[CardRecommendation]
    enhanced_analysis: AnalyzeResponse
    notice: str


class ParsedTransaction(BaseModel):
    date: Optional[str] = None
    description: str
    amount: int
    category: SpendingCategory


class SpendingUploadResponse(BaseModel):
    transactions: List[ParsedTransaction]
    monthly_categories: Dict[SpendingCategory, int]
    months_count: int
    total_rows: int
    notice: str
