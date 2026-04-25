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
import { AlertCircle, TrendingUp, TrendingDown, Minus } from "lucide-react";

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

export default function DashboardPage() {
  const investorId = useInvestorId();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!investorId) return;
    fetch(`/api/v1/investors/${investorId}/dashboard`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load dashboard");
        return r.json();
      })
      .then(setData)
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

      {/* Goals */}
      {goals.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Goals
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.map((goal) => (
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
                </CardContent>
              </Card>
            ))}
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
