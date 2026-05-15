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
import { AlertCircle, TrendingUp, TrendingDown, Minus, ShieldCheck, ShieldAlert, ShieldX, GraduationCap, AlertTriangle, CheckCircle2, Circle, Zap, Clock, CalendarClock, PiggyBank, Bot, Calendar, Newspaper, ExternalLink, Target } from "lucide-react";
import Link from "next/link";

interface EarningsEvent {
  ticker: string;
  company_name: string;
  earnings_date: string;
  eps_estimate: number | null;
  revenue_estimate: number | null;
  source: string;
}

interface NewsItem {
  ticker: string;
  title: string;
  publisher: string;
  url: string;
  published_at: string | null;
  source: string;
}

interface ActionItem {
  action: string;
  instrument_name: string;
  ticker: string | null;
  urgency: string;
  suggested_amount: number | null;
  currency: string | null;
  reasoning: string;
}

interface FundProjection {
  name: string;
  asset_type: string;
  current_balance: number;
  monthly_contribution: number;
  annual_return_pct: number;
  projected_value: number;
  makdam: number;
  currency: string;
}

interface PensionProjection {
  funds: FundProjection[];
  total_projected_value: number;
  total_monthly_contribution: number;
  currency: string;
  years_to_retirement: number;
  retirement_age: number;
  has_data: boolean;
}

interface RetirementReadiness {
  score: number;
  verdict: string;
  projected_monthly_income: number;
  monthly_expenses: number;
  gap_monthly: number;
  total_at_retirement: number;
  pension_projected: number;
  portfolio_mc_p50: number;
  years_to_retirement: number;
  years_to_close_gap: number | null;
  swr_pct: number;
  currency: string;
}

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
  total_cost_basis: number;
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
  const [pension, setPension] = useState<PensionProjection | null>(null);
  const [retirement, setRetirement] = useState<RetirementReadiness | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[] | null>(null);
  const [loadingActions, setLoadingActions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [earningsEvents, setEarningsEvents] = useState<EarningsEvent[]>([]);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);

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
      fetch(`/api/v1/investors/${investorId}/portfolio/pension-projection`).then((r) =>
        r.ok ? r.json() : null
      ),
    ])
      .then(([dashData, decisionData, portfolioData, goalsAnalysisData, pensionData]) => {
        setData(dashData);
        setDecision(decisionData);
        setPortfolio(portfolioData);
        setGoalsAnalysis(goalsAnalysisData);
        setPension(pensionData);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    // Retirement readiness loads independently (combines pension + MC)
    fetch(`/api/v1/investors/${investorId}/retirement-readiness`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setRetirement(d); });

    // Calendar and news load independently (non-blocking, slow yfinance calls)
    fetch(`/api/v1/investors/${investorId}/calendar`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.events) setEarningsEvents(d.events.slice(0, 6)); });

    fetch(`/api/v1/investors/${investorId}/news?limit=8`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.items) setNewsItems(d.items); });
  }, [investorId]);

  function loadActionPlan() {
    if (!investorId || loadingActions || actionItems) return;
    setLoadingActions(true);
    fetch(`/api/v1/investors/${investorId}/agent`)
      .then((r) => r.ok ? r.json() : null)
      .then((report) => {
        if (report?.action_plan) setActionItems(report.action_plan);
      })
      .finally(() => setLoadingActions(false));
  }

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
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
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

      {/* Action for today */}
      <ActionPlanCard
        items={actionItems}
        loading={loadingActions}
        onLoad={loadActionPlan}
        currency={data.investor.base_currency}
      />

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

      {/* Pension projection */}
      {pension && pension.has_data && <PensionCard projection={pension} />}

      {/* Retirement readiness */}
      {retirement && <RetirementReadinessCard data={retirement} />}

      {/* Earnings calendar + News feed */}
      {(earningsEvents.length > 0 || newsItems.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Earnings calendar */}
          {earningsEvents.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Calendar className="h-4 w-4 text-primary" />
                  Upcoming Earnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {earningsEvents.map((ev, i) => {
                    const daysUntil = Math.ceil((new Date(ev.earnings_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    const urgency = daysUntil <= 7 ? "text-amber-500" : daysUntil <= 14 ? "text-blue-500" : "text-muted-foreground";
                    return (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-xs font-semibold text-primary shrink-0">{ev.ticker}</span>
                          <span className="text-xs text-muted-foreground truncate">{ev.company_name}</span>
                          <Badge variant="muted" className="text-[10px] py-0 shrink-0">{ev.source}</Badge>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="text-xs font-medium">{new Date(ev.earnings_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
                          <p className={`text-[10px] ${urgency}`}>{daysUntil <= 0 ? "Today" : `in ${daysUntil}d`}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* News feed */}
          {newsItems.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Newspaper className="h-4 w-4 text-primary" />
                  Holdings News
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {newsItems.slice(0, 5).map((item, i) => (
                    <div key={i} className="space-y-0.5">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-1.5 group"
                      >
                        <span className="font-mono text-[10px] font-semibold text-primary shrink-0 mt-0.5">{item.ticker}</span>
                        <span className="text-xs text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2">{item.title}</span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                      <p className="text-[10px] text-muted-foreground pl-7">
                        {item.publisher}
                        {item.published_at && ` · ${new Date(item.published_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
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

const URGENCY_ICON: Record<string, React.ReactNode> = {
  immediate: <Zap className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />,
  soon: <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />,
  when_convenient: <CalendarClock className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />,
};

const URGENCY_LABEL: Record<string, string> = {
  immediate: "text-red-500",
  soon: "text-amber-500",
  when_convenient: "text-blue-500",
};

function ActionPlanCard({
  items,
  loading,
  onLoad,
  currency,
}: {
  items: ActionItem[] | null;
  loading: boolean;
  onLoad: () => void;
  currency: string;
}) {
  const sorted = items
    ? [...items].sort((a, b) => {
        const order = ["immediate", "soon", "when_convenient"];
        return order.indexOf(a.urgency) - order.indexOf(b.urgency);
      }).slice(0, 4)
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Today&apos;s priorities
          </span>
          {!items && !loading && (
            <button
              onClick={onLoad}
              className="text-xs text-primary hover:underline font-medium"
            >
              Load AI plan
            </button>
          )}
          {items && (
            <Link href="/agent" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Full analysis →
            </Link>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="h-4 w-4 rounded bg-muted mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-2.5 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && !items && (
          <p className="text-sm text-muted-foreground">
            Get a personalised action plan from the AI Investment Agent.{" "}
            <button onClick={onLoad} className="text-primary underline underline-offset-2">Load now</button>
          </p>
        )}
        {sorted && (
          <div className="divide-y divide-border">
            {sorted.map((item, i) => (
              <div key={i} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
                {URGENCY_ICON[item.urgency] ?? URGENCY_ICON.when_convenient}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium leading-snug">{item.action}</p>
                    {item.ticker && (
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-primary">{item.ticker}</span>
                    )}
                    {item.suggested_amount != null && item.currency && (
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(item.suggested_amount, item.currency)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.reasoning}</p>
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-wide shrink-0 mt-0.5 ${URGENCY_LABEL[item.urgency] ?? ""}`}>
                  {item.urgency === "when_convenient" ? "soon" : item.urgency}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PensionCard({ projection }: { projection: PensionProjection }) {
  const fmt = (n: number) => formatCurrency(n, projection.currency);
  const retireIn = projection.years_to_retirement;

  // Separate pension funds (ביטוח מנהלים / קרן פנסיה) from study funds (כה"ת)
  // Pension funds → monthly income via stored makdam (מקדם) per fund, default 200
  // Study funds → lump sum redeemable at age 67 (not a monthly pension)
  const pensionFunds = projection.funds.filter(f => f.asset_type === "pension_fund");
  const studyProjected = projection.funds
    .filter(f => f.asset_type === "study_fund")
    .reduce((s, f) => s + f.projected_value, 0);
  // Sum each pension fund's monthly estimate using its own makdam
  const monthlyPensionEstimate = Math.round(
    pensionFunds.reduce((s, f) => s + f.projected_value / (f.makdam || 200), 0)
  );
  const pensionProjected = pensionFunds.reduce((s, f) => s + f.projected_value, 0);

  // Warn when any fund's net return rate exceeds 7% — likely historical gross, not realistic net
  const highRateFunds = projection.funds.filter(f => f.annual_return_pct > 7);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <PiggyBank className="h-4 w-4 text-primary" />
          Pension &amp; Study Funds — Projection
          <Link href="/investments" className="ml-auto text-[11px] font-normal text-muted-foreground hover:text-foreground flex items-center gap-1">
            Edit rates <ExternalLink className="h-3 w-3" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {highRateFunds.length > 0 && (
          <div className="mb-4 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-300">
              {highRateFunds.map(f => f.name).join(", ")} {highRateFunds.length === 1 ? "is" : "are"} using a return rate above 7% — this may be a historical gross rate, not a realistic net-of-fees planning rate. Israeli pension funds realistically return 4–6% net. <Link href="/investments" className="underline underline-offset-2">Edit the rate on the Investments page</Link> (pencil icon on each fund).
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-8 mb-5">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Projected at age {projection.retirement_age}</p>
            <p className="text-3xl font-bold tracking-tight">{fmt(projection.total_projected_value)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Years to retirement</p>
            <p className="text-3xl font-bold tracking-tight">{retireIn.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Monthly contribution</p>
            <p className="text-2xl font-semibold">{fmt(projection.total_monthly_contribution)}</p>
          </div>
          {monthlyPensionEstimate > 0 && retireIn > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Est. monthly pension</p>
              <p className="text-2xl font-semibold">{fmt(monthlyPensionEstimate)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Using makdam (מקדם) {pensionFunds.length === 1 ? (pensionFunds[0].makdam || 200) : "per fund"} — edit in Investments
              </p>
            </div>
          )}
          {studyProjected > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Study funds (כה&quot;ת) at 67</p>
              <p className="text-2xl font-semibold">{fmt(Math.round(studyProjected))}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Lump sum — not monthly income</p>
            </div>
          )}
        </div>
        {projection.funds.length > 0 && (
          <div className="space-y-2 border-t border-border pt-4">
            {projection.funds.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground capitalize shrink-0">{f.asset_type.replace(/_/g, " ")}</span>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <span className="font-semibold">{fmt(f.projected_value)}</span>
                  <span className={`text-xs ml-2 ${f.annual_return_pct > 7 ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}`}>
                    at {f.annual_return_pct}%{f.annual_return_pct > 7 ? " ⚠️" : ""} p.a.
                  </span>
                  {f.asset_type === "pension_fund" && (
                    <span className="block text-[10px] text-muted-foreground">
                      {fmt(Math.round(f.projected_value / (f.makdam || 200)))}/mo · מקדם {f.makdam || 200}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-4">
          Projection uses stored net return rate (gross rate minus fee on balance). Realistic planning rate for Israeli pension: 4–6%. Actual results may vary.
        </p>
      </CardContent>
    </Card>
  );
}

const READINESS_SCORE_CONFIG = {
  on_track:        { color: "text-green-500",  bar: "bg-green-500",  badge: "success"  as const },
  mostly_on_track: { color: "text-blue-500",   bar: "bg-blue-500",   badge: "default"  as const },
  at_risk:         { color: "text-amber-500",  bar: "bg-amber-500",  badge: "warning"  as const },
  significant_gap: { color: "text-orange-500", bar: "bg-orange-500", badge: "warning"  as const },
  critical:        { color: "text-red-500",    bar: "bg-red-500",    badge: "danger"   as const },
};

function verdictKey(verdict: string): keyof typeof READINESS_SCORE_CONFIG {
  if (verdict === "On track") return "on_track";
  if (verdict === "Mostly on track") return "mostly_on_track";
  if (verdict === "At risk") return "at_risk";
  if (verdict === "Significant gap") return "significant_gap";
  return "critical";
}

function RetirementReadinessCard({ data }: { data: RetirementReadiness }) {
  const fmt = (n: number) => formatCurrency(n, data.currency);
  const key = verdictKey(data.verdict);
  const cfg = READINESS_SCORE_CONFIG[key];
  const isShortfall = data.gap_monthly < 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Retirement Readiness
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-start gap-8 mb-5">
          {/* Score gauge */}
          <div className="text-center min-w-[80px]">
            <p className={`text-5xl font-bold tracking-tight ${cfg.color}`}>{data.score}</p>
            <p className="text-xs text-muted-foreground mt-1">/ 100</p>
            <Badge variant={cfg.badge} className="mt-2 text-xs">{data.verdict}</Badge>
          </div>

          {/* Key metrics */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Projected monthly income</p>
              <p className="text-xl font-semibold">{fmt(data.projected_monthly_income)}</p>
              <p className="text-[10px] text-muted-foreground">at {data.swr_pct}% SWR</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Monthly expenses (target)</p>
              <p className="text-xl font-semibold">{data.monthly_expenses > 0 ? fmt(data.monthly_expenses) : "—"}</p>
              <p className="text-[10px] text-muted-foreground">current spending baseline</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                {isShortfall ? "Monthly shortfall" : "Monthly surplus"}
              </p>
              <p className={`text-xl font-semibold ${isShortfall ? "text-red-500" : "text-green-500"}`}>
                {isShortfall ? "" : "+"}{fmt(data.gap_monthly)}
              </p>
              <p className="text-[10px] text-muted-foreground">at retirement</p>
            </div>
          </div>
        </div>

        {/* Score bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>Readiness</span>
            <span>{data.score}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${cfg.bar}`}
              style={{ width: `${data.score}%` }}
            />
          </div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm border-t border-border pt-4">
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total at retirement</p>
            <p className="font-semibold">{fmt(data.total_at_retirement)}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Pension projected</p>
            <p className="font-semibold">{fmt(data.pension_projected)}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Portfolio MC P50</p>
            <p className="font-semibold">{fmt(data.portfolio_mc_p50)}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Years to retirement</p>
            <p className="font-semibold">{data.years_to_retirement.toFixed(1)}</p>
          </div>
        </div>

        {isShortfall && data.years_to_close_gap !== null && (
          <div className="mt-3 flex items-center gap-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              At current trajectory, you need approximately <span className="font-semibold">{data.years_to_close_gap} additional years</span> of 7% portfolio growth to close the retirement income gap.
            </p>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground mt-3">
          Based on 4% safe withdrawal rule · Pension projection + Monte Carlo P50 · Assumes {data.years_to_retirement.toFixed(0)} years to retirement
        </p>
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
