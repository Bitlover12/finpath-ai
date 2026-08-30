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
