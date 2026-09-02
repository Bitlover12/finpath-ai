from app.models.enums import CompanySize, EmploymentType
from app.models.profile import UserProfile
from app.models.spending import CardTypePreference, SpendingCategory, SpendingProfile
from app.services.spending import optimize_spending, parse_spending_file, recommend_cards


def profile(monthly_saving: int = 500_000) -> UserProfile:
    return UserProfile(
        age=26,
        region="SEOUL",
        employment_type=EmploymentType.EMPLOYEE,
        company_size=CompanySize.SME,
        annual_income=34_000_000,
        employment_months=12,
        current_assets=15_000_000,
        monthly_saving_capacity=monthly_saving,
        household_income=70_000_000,
        target_assets=200_000_000,
        target_years=9,
    )


def test_does_not_recommend_card_that_requires_more_spending():
    spending = SpendingProfile(
        categories={SpendingCategory.CAFE: 100_000, SpendingCategory.FOOD: 150_000},
        card_type_preference=CardTypePreference.CREDIT,
        cut_percent=0,
    )
    recs, _, _ = recommend_cards(spending)
    assert recs == []  # current 250k spend is below all registered credit-card thresholds


def test_hyundai_d_uses_current_pattern_not_extra_spend():
    spending = SpendingProfile(
        categories={
            SpendingCategory.FOOD: 180_000,
            SpendingCategory.DELIVERY: 160_000,
            SpendingCategory.CAFE: 80_000,
            SpendingCategory.TRANSPORT: 80_000,
        },
        card_type_preference=CardTypePreference.BOTH,
        cut_percent=0,
    )
    recs, _, incremental = recommend_cards(spending)
    assert recs
    assert recs[0].card_id == "HYUNDAI_D_CREDIT"
    assert recs[0].estimated_net_monthly_benefit > 0
    assert incremental == recs[0].estimated_net_monthly_benefit


def test_spending_scenario_increases_saving_capacity_and_recalculates(monkeypatch):
    monkeypatch.setenv("FINPATH_POLICY_DATASET", "test")
    base = profile()
    spending = SpendingProfile(
        categories={
            SpendingCategory.FOOD: 180_000,
            SpendingCategory.DELIVERY: 120_000,
            SpendingCategory.CAFE: 80_000,
            SpendingCategory.TRANSPORT: 80_000,
            SpendingCategory.SHOPPING: 140_000,
        },
        cut_percent=10,
    )
    result = optimize_spending(base, spending)
    assert result.total_extra_monthly_saving > 0
    assert result.enhanced_monthly_saving_capacity == base.monthly_saving_capacity + result.total_extra_monthly_saving
    assert result.enhanced_analysis.profile.monthly_saving_capacity == result.enhanced_monthly_saving_capacity


def test_csv_upload_is_categorized_and_monthly_averaged():
    csv_bytes = "거래일자,가맹점명,이용금액\n2026-07-02,배달의민족,30000\n2026-07-05,스타벅스,10000\n2026-08-01,배달의민족,50000\n2026-08-02,GS25,20000\n".encode("utf-8")
    parsed = parse_spending_file("sample.csv", csv_bytes)
    assert parsed.months_count == 2
    assert parsed.total_rows == 4
    assert parsed.monthly_categories[SpendingCategory.DELIVERY] == 40_000
    assert parsed.monthly_categories[SpendingCategory.CAFE] == 5_000
    assert parsed.monthly_categories[SpendingCategory.CONVENIENCE] == 10_000
