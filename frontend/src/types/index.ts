export type RiskClassification = "unstable" | "fragile" | "stable" | "strong";
export type RiskModifier = "reduce" | "neutral" | "allow_growth";

export interface FinancialStabilityScore {
  score: number;
  classification: RiskClassification;
  risk_modifier: RiskModifier;
  recommendations: string[];
}

export interface InvestorProfile {
  id: string;
  full_name: string;
  age: number;
  country: string;
  base_currency: string;
  experience_level: "beginner" | "intermediate" | "advanced";
  created_at: string;
}

export interface FinancialGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string;
  priority: number;
  progress_pct: number;
  required_monthly_contribution: number;
}
