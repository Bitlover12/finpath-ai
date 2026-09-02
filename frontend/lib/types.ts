export type UserProfile = {
  age: number;
  region: string;
  employment_type: string;
  company_size: string;
  annual_income: number;
  employment_months: number;
  current_assets: number;
  monthly_saving_capacity: number;
  housing_status?: string | null;
  household_income?: number | null;
  marital_status?: string | null;
  target_assets: number;
  target_years: number;
  manual_confirmations?: Record<string, boolean>;
};

export type EligibilityCheck = {
  field: string;
  basis?: "PERSONAL" | "HOUSEHOLD" | null;
  required: Record<string, unknown>;
  actual: unknown;
  result: boolean | null;
  reason?: string | null;
};

export type PolicyAnalysis = {
  policy_id: string;
  policy_name: string;
  source_url: string;
  application_status: "OPEN" | "UPCOMING" | "CLOSED" | "CHECK_REQUIRED";
  application_period_text?: string | null;
  status: "ELIGIBLE" | "INELIGIBLE" | "NEEDS_MORE_INFORMATION";
  checks: EligibilityCheck[];
  missing_fields: string[];
  standalone_contribution: number | null;
  incremental_benefit: number | null;
  benefit_score: number | null;
  selected_in_optimal_path: boolean;
  allocated_monthly_amount: number;
  optimization_exclusion_reason?: string | null;
};

export type AssetPoint = { month: number; total_assets: number };
export type SimulationResult = {
  initial_assets: number;
  principal: number;
  gross_interest: number;
  tax_paid: number;
  net_interest: number;
  government_support: number;
  tax_benefit: number;
  final_assets: number;
  trajectory: AssetPoint[];
};

export type AnalyzeResponse = {
  profile: UserProfile;
  policy_analysis: PolicyAnalysis[];
  excluded_policies: { policy_id: string; reason: string }[];
  baseline: SimulationResult;
  optimized: SimulationResult;
  policy_effect: { additional_assets: number; goal_time_saved_months: number | null };
  goal: {
    target_assets: number;
    final_assets: number;
    status: "ACHIEVED" | "SHORTFALL";
    shortfall: number;
  };
  goal_seeking: null | {
    required_monthly_saving: number | null;
    required_duration_months: number | null;
    required_initial_assets: number | null;
  };
  roadmap: {
    type: "POLICY_SAVING" | "GENERAL_SAVING" | "MATURITY_REINVESTMENT";
    start_month: string;
    end_month: string;
    product_id?: string | null;
    source_policy_id?: string | null;
    product_name: string;
    monthly_amount?: number | null;
    initial_amount?: number | null;
  }[];
  assumptions: {
    calculation_date: string;
    baseline_annual_rate: number;
    baseline_rate_source: string;
    baseline_rate_source_url?: string | null;
    baseline_rate_checked_at: string;
    tax_basis: string;
    tax_timing: string;
    contribution_timing: string;
    interest_method: string;
    policy_start_timing: string;
    early_termination_assumed: boolean;
    policy_conditions_maintained: boolean;
    reinvestment_rate_basis: string;
    reinvestment_tax_treatment: string;
    reinvestment_tax_timing: string;
  };
};

export type ScenarioChange = { field: string; value: unknown };

export type SpendingCategory =
  | "FOOD" | "DELIVERY" | "CAFE" | "TRANSPORT" | "CONVENIENCE"
  | "SHOPPING" | "SUBSCRIPTION" | "TELECOM" | "BEAUTY" | "CULTURE"
  | "ENTERTAINMENT" | "ONLINE" | "GROCERIES" | "FUEL" | "HOUSING"
  | "MEDICAL" | "EDUCATION" | "OTHER";

export type CardType = "CHECK" | "CREDIT";
export type CardTypePreference = "BOTH" | "CHECK" | "CREDIT";

export type CardCatalogItem = {
  id: string;
  issuer: string;
  name: string;
  card_type: CardType;
  annual_fee: number;
  minimum_monthly_spend: number;
  source_url: string;
  checked_at: string;
  notes: string[];
};

export type SpendingOptimizationResponse = {
  total_monthly_spend: number;
  discretionary_monthly_spend: number;
  cut_scenario_monthly_saving: number;
  cut_items: {
    category: SpendingCategory;
    current_monthly_amount: number;
    assumed_cut_percent: number;
    monthly_saving: number;
  }[];
  current_card_estimated_net_benefit: number;
  best_card_incremental_monthly_benefit: number;
  total_extra_monthly_saving: number;
  enhanced_monthly_saving_capacity: number;
  recommendations: {
    card_id: string;
    issuer: string;
    name: string;
    card_type: CardType;
    annual_fee: number;
    minimum_monthly_spend: number;
    eligible_without_extra_spend: boolean;
    estimated_gross_monthly_benefit: number;
    estimated_monthly_fee: number;
    estimated_net_monthly_benefit: number;
    incremental_monthly_benefit_vs_current: number;
    benefit_breakdown: { label: string; amount: number }[];
    source_url: string;
    checked_at: string;
    notes: string[];
  }[];
  enhanced_analysis: AnalyzeResponse;
  notice: string;
};

export type SpendingUploadResponse = {
  transactions: {
    date?: string | null;
    description: string;
    amount: number;
    category: SpendingCategory;
  }[];
  monthly_categories: Partial<Record<SpendingCategory, number>>;
  months_count: number;
  total_rows: number;
  notice: string;
};


export type PolicyCatalogItem = {
  id: string;
  name: string;
  description: string;
  min_age: number | null;
  max_age: number | null;
  income_conditions: { basis: "PERSONAL" | "HOUSEHOLD"; min_income: number | null; max_income: number | null }[];
  manual_requirements: { id: string; label: string; description: string; source_url?: string | null; preview_assumable?: boolean }[];
  allowed_regions: string[] | null;
  allowed_company_sizes: string[] | null;
  allowed_employment_types: string[] | null;
  min_employment_months: number | null;
  max_employment_months: number | null;
  monthly_contribution_min: number | null;
  monthly_contribution_limit: number;
  government_contribution_tiers: { income_basis: "PERSONAL" | "HOUSEHOLD"; max_income: number | null; rate: number; monthly_contribution_cap: number; monthly_government_cap: number | null }[] | null;
  government_support_timing: string;
  government_support_interest_bearing: boolean;
  interest_rate: number;
  tax_treatment: "TAXABLE" | "TAX_FREE" | "REDUCED";
  tax_rate_override: number | null;
  duration_months: number;
  start_date: string | null;
  end_date: string | null;
  incompatible_policy_ids: string[];
  source_url: string;
  effective_date: string;
  checked_at: string;
  updated_at: string;
  application_status: "OPEN" | "UPCOMING" | "CLOSED" | "CHECK_REQUIRED";
  application_period_text?: string | null;
};

export type EligibilityResult = {
  policy_id: string;
  status: "ELIGIBLE" | "INELIGIBLE" | "NEEDS_MORE_INFORMATION";
  checks: EligibilityCheck[];
  missing_fields: string[];
};

export type EligibilityResponse = { results: EligibilityResult[] };
