"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatPercent } from "@/lib/utils";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AlertCircle, TrendingUp, TrendingDown, Minus, ShieldCheck, ShieldAlert, ShieldX, GraduationCap, AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";

interface InvestmentDecision {
  can_invest: boolean;
  readiness_classification: "ready" | "ready_with_limits" | "not_ready" | "education_only";
  recommended_investment_pct: number;
  max_high_risk_pct: number;
  blocked_actions: string[];
  required_actions: string[];
  warnings: string[];
  explanation: string;
}

interface GoalAnalysis {
  id: string;
  months_to_target: number | null;
  monthly_contribution_needed: number | null;
  gap: number | null;
  on_track: boolean;
  status: string;
}

interface GoalsAnalysisResult {
  goals: GoalAnalysis[];
  total_monthly_contribution_needed: number;
  monthly_surplus: number | null;
}

interface PortfolioSummary {
  base_currency: string;
  total_current_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  asset_allocation: Record<string, number>;
}

interface DashboardData {
  investor: {
    id: string;
    full_name: string;
    base_currency: string;
    experience_level: string;
    is_minor: boolean;
  };
  net_worth: {
    total_assets: number;
    total_liabilities: number;
    net_worth: number;
    liquid_capital: number;
    currency: string;
  } | null;
  cash_flow: {
    monthly_income: number;
    monthly_expenses: number;
    monthly_surplus: number;
    savings_rate_pct: number;
    emergency_fund_months: number;
    currency: string;
  } | null;
  stability: {
    score: number;
    classification: string;
    risk_modifier: string;
    recommendations: string[];
  } | null;
  risk_model: {
    investable_capital: number;
    low_risk_pct: number;
    growth_pct: number;
    high_risk_pct: number;
    low_risk_amount: number;
    growth_amount: number;
    high_risk_amount: number;
    max_drawdown_pct: number;
    currency: string;
  } | null;
  goals: Array<{
    id: string;
    name: string;
    goal_type: string;
    target_amount: number;
    current_amount: number;
    progress_pct: number;
    target_date: string | null;
    priority: number;
    currency: string;
  }>;
}

const STABILITY_COLORS: Record<string, string> = {
  unstable: "danger",
  fragile: "warning",
  stable: "success",
  strong: "success",
};

const MODIFIER_LABEL: Record<string, string> = {
  reduce: "Reduce risk",
  neutral: "Neutral",
  allow_growth: "Growth allowed",
};

const RISK_PIE_COLORS = ["#22c55e", "#3b82f6", "#ef4444"];

const READINESS_CONFIG = {
  ready: {
    label: "Ready",
    variant: "success" as const,
    Icon: ShieldCheck,
    color: "text-green-500",
  },
  ready_with_limits: {
    label: "Ready with limits",
    variant: "warning" as const,
    Icon: ShieldAlert,
    color: "text-amber-500",
  },
  not_ready: {
    label: "Not ready",
    variant: "danger" as const,
    Icon: ShieldX,
    color: "text-red-500",
  },
  education_only: {
    label: "Education only",
    variant: "default" as const,
    Icon: GraduationCap,
    color: "text-blue-500",
  },
};

export default function DashboardPage() {
  const investorId = useInvestorId();
  const [data, setData] = useState<DashboardData | null>(null);
  const [decision, setDecision] = useState<InvestmentDecision | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [goalsAnalysis, setGoalsAnalysis] = useState<GoalsAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!investorId) return;
    Promise.all([
      fetch(`/api/v1/investors/${investorId}/dashboard`).then((r) => {
        if (!r.ok) throw new Error("Failed to load dashboard");
        return r.json();
      }),
      fetch(`/api/v1/investors/${investorId}/decision`).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`/api/v1/investors/${investorId}/portfolio`).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`/api/v1/investors/${investorId}/goals-analysis`).then((r) =>
        r.ok ? r.json() : null
      ),
    ])
      .then(([dashData, decisionData, portfolioData, goalsAnalysisData]) => {
        setData(dashData);
        setDecision(decisionData);
        setPortfolio(portfolioData);
        setGoalsAnalysis(goalsAnalysisData);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [investorId]);

  if (!investorId || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-3 text-red-500">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { investor, net_worth, cash_flow, stability, risk_model, goals } = data;

  const riskPieData = risk_model
    ? [
        { name: "Low Risk", value: risk_model.low_risk_pct },
        { name: "Growth", value: risk_model.growth_pct },
        { name: "High Risk", value: risk_model.high_risk_pct },
      ]
    : [];

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {investor.full_name} · {investor.base_currency} · {investor.experience_level}
            {investor.is_minor && " · Education only"}
          </p>
        </div>
      </div>

      {/* Setup checklist */}
      <SetupChecklist
        hasFinancialProfile={!!net_worth}
        hasRiskModel={!!risk_model}
        hasGoals={goals.length > 0}
        hasHoldings={(portfolio?.total_cost_basis ?? 0) > 0}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Net Worth"
          value={net_worth ? formatCurrency(net_worth.net_worth, net_worth.currency) : "—"}
          sub={net_worth ? `${formatCurrency(net_worth.total_assets, net_worth.currency)} assets` : "No financial data yet"}
        />
        <StatCard
          label="Liquid Capital"
          value={net_worth ? formatCurrency(net_worth.liquid_capital, net_worth.currency) : "—"}
          sub={net_worth ? "Available liquid assets" : "No financial data yet"}
        />
        <StatCard
          label="Monthly Surplus"
          value={cash_flow ? formatCurrency(cash_flow.monthly_surplus, cash_flow.currency) : "—"}
          sub={cash_flow ? `${cash_flow.savings_rate_pct.toFixed(1)}% savings rate` : "No cash flow data"}
          trend={cash_flow ? (cash_flow.monthly_surplus >= 0 ? "up" : "down") : undefined}
        />
        <StatCard
          label="Emergency Fund"
          value={cash_flow ? `${cash_flow.emergency_fund_months.toFixed(1)} mo` : "—"}
          sub={cash_flow ? (cash_flow.emergency_fund_months >= 3 ? "Adequate buffer" : "Build savings first") : "No data"}
        />
      </div>

      {/* Row 2: Stability + Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Stability score */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Financial Stability</CardTitle>
          </CardHeader>
          <CardContent>
            {!stability ? (
              <p className="text-sm text-muted-foreground">
                No stability score yet. Add financial profile data first.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-end gap-3">
                  <span className="text-5xl font-bold tracking-tight">{stability.score}</span>
                  <span className="text-muted-foreground text-sm mb-2">/ 100</span>
                  <Badge
                    variant={STABILITY_COLORS[stability.classification] as "success" | "warning" | "danger" | "default"}
                    className="mb-1.5 ml-auto capitalize"
                  >
                    {stability.classification}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Risk modifier</span>
                  <span className="font-medium">{MODIFIER_LABEL[stability.risk_modifier] ?? stability.risk_modifier}</span>
                </div>
                {stability.recommendations.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-border">
                    {stability.recommendations.slice(0, 3).map((rec, i) => (
                      <p key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="mt-0.5 shrink-0 text-amber-500">•</span>
                        {rec}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Risk allocation */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Risk Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            {!risk_model ? (
              <p className="text-sm text-muted-foreground">
                No risk model yet. Generate one from the Risk Model page.
              </p>
            ) : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie
                      data={riskPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={55}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {riskPieData.map((_, index) => (
                        <Cell key={index} fill={RISK_PIE_COLORS[index]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  {[
                    { label: "Low Risk", pct: risk_model.low_risk_pct, amount: risk_model.low_risk_amount, color: "bg-green-500" },
                    { label: "Growth", pct: risk_model.growth_pct, amount: risk_model.growth_amount, color: "bg-primary" },
                    { label: "High Risk", pct: risk_model.high_risk_pct, amount: risk_model.high_risk_amount, color: "bg-red-500" },
                  ].map((tier) => (
                    <div key={tier.label}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${tier.color}`} />
                          <span className="text-muted-foreground">{tier.label}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-medium">{tier.pct.toFixed(0)}%</span>
                          <span className="text-muted-foreground text-xs ml-2">
                            {formatCurrency(tier.amount, risk_model.currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-border">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Max drawdown</span>
                      <span className="font-medium text-foreground">{formatPercent(-risk_model.max_drawdown_pct)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Investment Readiness */}
      <ReadinessCard decision={decision} hasFinancialData={!!data.net_worth} />

      {/* Portfolio summary */}
      {portfolio && portfolio.total_current_value > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Investment Portfolio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total value</p>
                <p className="text-2xl font-bold tracking-tight">
                  {formatCurrency(portfolio.total_current_value, portfolio.base_currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Unrealized P&L</p>
                <p className={`text-xl font-semibold ${portfolio.unrealized_pnl >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {portfolio.unrealized_pnl >= 0 ? "+" : ""}
                  {formatCurrency(portfolio.unrealized_pnl, portfolio.base_currency)}
                  <span className="text-sm ml-2 font-normal text-muted-foreground">
                    ({portfolio.unrealized_pnl_pct >= 0 ? "+" : ""}{portfolio.unrealized_pnl_pct.toFixed(2)}%)
                  </span>
                </p>
              </div>
              {Object.keys(portfolio.asset_allocation).length > 0 && (
                <div className="ml-auto">
                  <p className="text-xs text-muted-foreground mb-2">Allocation</p>
                  <div className="flex gap-3">
                    {Object.entries(portfolio.asset_allocation).map(([type, pct]) => (
                      <div key={type} className="text-center">
                        <p className="text-sm font-semibold">{pct.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground capitalize">{type}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goals */}
      {goals.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Goals
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.map((goal) => {
              const ga = goalsAnalysis?.goals.find((g) => g.id === goal.id);
              return (
                <Card key={goal.id}>
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-sm font-medium">{goal.name}</p>
                        <p className="text-xs text-muted-foreground capitalize mt-0.5">
                          {goal.goal_type.replace(/_/g, " ")}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-primary">
                        {goal.progress_pct.toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={goal.progress_pct} className="mb-3" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatCurrency(goal.current_amount, goal.currency)}</span>
                      <span>{formatCurrency(goal.target_amount, goal.currency)}</span>
                    </div>
                    {goal.target_date && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Target: {new Date(goal.target_date).toLocaleDateString()}
                      </p>
                    )}
                    {ga && ga.status !== "complete" && ga.monthly_contribution_needed !== null && (
                      <div className="mt-2 pt-2 border-t border-border flex items-center gap-1.5 text-xs">
                        {ga.on_track
                          ? <TrendingUp className="h-3 w-3 text-green-500 shrink-0" />
                          : <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />}
                        <span className="text-muted-foreground">
                          {formatCurrency(ga.monthly_contribution_needed, goal.currency)}/mo needed
                        </span>
                        {!ga.on_track && ga.gap !== null && ga.gap > 0 && (
                          <span className="ml-auto text-red-500 font-medium">
                            {formatCurrency(ga.gap, goal.currency)} short
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {goals.length === 0 && !net_worth && !cash_flow && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium">Start by completing your profile</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add your financial data, set goals, and generate a risk model to see your dashboard.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReadinessCard({
  decision,
  hasFinancialData,
}: {
  decision: InvestmentDecision | null;
  hasFinancialData: boolean;
}) {
  if (!hasFinancialData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Investment Readiness</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Complete your financial profile to see your investment readiness assessment.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!decision) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Investment Readiness</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading readiness assessment…</p>
        </CardContent>
      </Card>
    );
  }

  const config = READINESS_CONFIG[decision.readiness_classification];
  const { Icon } = config;
  const formatAction = (s: string) => s.replace(/_/g, " ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Investment Readiness</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {/* Badge + recommended pct */}
          <div className="flex items-center gap-4">
            <Icon className={`h-8 w-8 ${config.color} shrink-0`} />
            <div>
              <Badge variant={config.variant} className="text-sm px-3 py-1 mb-1">
                {config.label}
              </Badge>
              {decision.can_invest && (
                <p className="text-xs text-muted-foreground mt-1">
                  Recommended investable capital:{" "}
                  <span className="font-medium text-foreground">
                    {decision.recommended_investment_pct.toFixed(1)}%
                  </span>
                  {decision.max_high_risk_pct > 0 && (
                    <> · Max high-risk: <span className="font-medium text-foreground">{decision.max_high_risk_pct.toFixed(0)}%</span></>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Explanation */}
          <p className="text-sm text-muted-foreground">{decision.explanation}</p>

          {/* Warnings */}
          {decision.warnings.length > 0 && (
            <div className="space-y-1.5 pt-3 border-t border-border">
              <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide">Warnings</p>
              {decision.warnings.map((w, i) => (
                <p key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="mt-0.5 text-amber-500">•</span>
                  {w}
                </p>
              ))}
            </div>
          )}

          {/* Required actions */}
          {decision.required_actions.length > 0 && (
            <div className="space-y-1.5 pt-3 border-t border-border">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Required actions</p>
              {decision.required_actions.map((a, i) => (
                <p key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="mt-0.5 text-primary">→</span>
                  <span className="capitalize">{formatAction(a)}</span>
                </p>
              ))}
            </div>
          )}

          {/* Blocked actions */}
          {decision.blocked_actions.length > 0 && (
            <div className="space-y-1.5 pt-3 border-t border-border">
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">Blocked</p>
              {decision.blocked_actions.map((a, i) => (
                <p key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="mt-0.5 text-red-500">✕</span>
                  <span className="capitalize">{formatAction(a)}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SetupChecklist({
  hasFinancialProfile,
  hasRiskModel,
  hasGoals,
  hasHoldings,
}: {
  hasFinancialProfile: boolean;
  hasRiskModel: boolean;
  hasGoals: boolean;
  hasHoldings: boolean;
}) {
  const steps = [
    { label: "Investor profile", href: "/profile", done: true },
    { label: "Financial profile", href: "/financial", done: hasFinancialProfile },
    { label: "Risk model", href: "/risk", done: hasRiskModel },
    { label: "Financial goals", href: "/goals", done: hasGoals },
    { label: "Investment holdings", href: "/investments", done: hasHoldings },
  ];
  if (steps.every(s => s.done)) return null;
  const completed = steps.filter(s => s.done).length;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          Setup checklist
          <span className="text-xs font-normal text-muted-foreground">{completed} / {steps.length} complete</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {steps.map(step => (
            <Link
              key={step.href}
              href={step.href}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs transition-colors ${
                step.done
                  ? "border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400 pointer-events-none"
                  : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {step.done
                ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                : <Circle className="h-3.5 w-3.5 shrink-0" />}
              {step.label}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({
  label,
  value,
  sub,
  trend,
}: {
  label: string;
  value: string;
  sub: string;
  trend?: "up" | "down" | "flat";
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs font-medium text-muted-foreground mb-3">{label}</p>
        <div className="flex items-end gap-2">
          <span className="text-2xl font-bold tracking-tight">{value}</span>
          {trend === "up" && <TrendingUp className="h-4 w-4 text-green-500 mb-1" />}
          {trend === "down" && <TrendingDown className="h-4 w-4 text-red-500 mb-1" />}
          {trend === "flat" && <Minus className="h-4 w-4 text-muted-foreground mb-1" />}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}
