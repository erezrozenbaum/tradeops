"use client";

import { useEffect, useState, useCallback } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Landmark, CreditCard, Briefcase, Target, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { StatCard } from "@/components/ui/stat-card";
import { GlowChart, AXIS_PROPS, GRID_PROPS, TOOLTIP_STYLE, TOOLTIP_LABEL_STYLE, CHART_COLORS } from "@/components/ui/glow-chart";

// ── Types ──────────────────────────────────────────────────────────────────

interface AssetBreakdown {
  asset_type: string;
  name: string;
  value: number;
  currency: string;
}

interface LiabilityBreakdown {
  liability_type: string;
  name: string;
  balance: number;
  monthly_payment: number;
  interest_rate_pct: number | null;
  currency: string;
}

interface FiProjection {
  fi_target: number;
  current_investable: number;
  gap: number;
  years_to_fi: number | null;
  annual_expenses?: number;
  assumed_return_pct?: number;
  note?: string;
}

interface NetWorthSummary {
  portfolio_value: number;
  financial_assets_value: number;
  total_liabilities: number;
  net_worth: number;
  currency: string;
  assets_breakdown: AssetBreakdown[];
  liabilities_breakdown: LiabilityBreakdown[];
  fi_projection: FiProjection | null;
}

interface HistoryPoint {
  snapshot_at: string;
  net_worth: number;
  portfolio_value: number;
  financial_assets_value: number;
  total_liabilities: number;
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  cash: "Cash", stocks: "Stocks", bonds: "Bonds", etf: "ETFs",
  real_estate: "Real Estate", crypto: "Crypto", pension: "Pension",
  vehicle: "Vehicle", other: "Other",
};

const LIABILITY_TYPE_LABELS: Record<string, string> = {
  mortgage: "Mortgage", car_loan: "Car Loan", personal_loan: "Personal Loan",
  credit_card: "Credit Card", student_loan: "Student Loan", other: "Other",
};

// ── Chart tooltip ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...TOOLTIP_STYLE }}>
      <p style={{ ...TOOLTIP_LABEL_STYLE }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
      ))}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function NetWorthPage() {
  const investorId = useInvestorId();
  const [summary, setSummary] = useState<NetWorthSummary | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssets, setShowAssets] = useState(true);
  const [showLiabilities, setShowLiabilities] = useState(true);

  const load = useCallback(async () => {
    if (!investorId) return;
    setLoading(true);
    const [sRes, hRes] = await Promise.all([
      fetch(`/api/v1/investors/${investorId}/net-worth`),
      fetch(`/api/v1/investors/${investorId}/net-worth/history?months=12`),
    ]);
    if (sRes.ok) setSummary(await sRes.json());
    if (hRes.ok) setHistory(await hRes.json());
    setLoading(false);
  }, [investorId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-48 bg-muted rounded" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl">
        <p className="text-muted-foreground text-sm">No data available yet. Add assets and liabilities in your Financial profile to see your net worth.</p>
      </div>
    );
  }

  const currency = summary.currency;
  const totalAssets = summary.portfolio_value + summary.financial_assets_value;

  // Chart data
  const chartData = history.map(h => ({
    date: new Date(h.snapshot_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    "Net Worth": Math.round(h.net_worth),
    "Portfolio": Math.round(h.portfolio_value),
    "Assets": Math.round(h.financial_assets_value),
  }));

  const fi = summary.fi_projection;
  const netWorthPositive = summary.net_worth >= 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Net Worth</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Full financial balance sheet</p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Net Worth"
          value={formatCurrency(summary.net_worth, currency)}
          rawValue={summary.net_worth}
          accent={netWorthPositive ? "emerald" : "red"}
          trend={netWorthPositive ? "up" : "down"}
          icon={<Target className="h-4 w-4" />}
        />
        <StatCard
          label="Total Assets"
          value={formatCurrency(totalAssets, currency)}
          rawValue={totalAssets}
          accent="cyan"
          sub="Portfolio + manual"
          icon={<Landmark className="h-4 w-4" />}
        />
        <StatCard
          label="Portfolio Value"
          value={formatCurrency(summary.portfolio_value, currency)}
          rawValue={summary.portfolio_value}
          accent="purple"
          sub="Investment accounts"
          icon={<Briefcase className="h-4 w-4" />}
        />
        <StatCard
          label="Total Liabilities"
          value={formatCurrency(summary.total_liabilities, currency)}
          rawValue={summary.total_liabilities}
          accent="amber"
          sub="Loans & debt"
          icon={<CreditCard className="h-4 w-4" />}
        />
      </div>

      {/* Trend chart */}
      {chartData.length > 1 && (
        <GlowChart label="12-Month Trend" height={220} accentColor={CHART_COLORS.emerald}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="date" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#64748b" }} />
              <Line type="monotone" dataKey="Net Worth" stroke={CHART_COLORS.emerald} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Portfolio" stroke={CHART_COLORS.purple} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </GlowChart>
      )}

      {chartData.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Historical trend will appear here after the first daily snapshot runs (21:15 UTC).
            </p>
          </CardContent>
        </Card>
      )}

      {/* FI projection */}
      {fi && (
        <Card className="border-primary/20">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                <Target className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm">Financial Independence Projection</p>
                {fi.note ? (
                  <p className="text-xs text-muted-foreground mt-1">{fi.note}</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                    {[
                      { label: "FI Target", value: formatCurrency(fi.fi_target, currency) },
                      { label: "Current Investable", value: formatCurrency(fi.current_investable, currency) },
                      { label: "Remaining Gap", value: formatCurrency(fi.gap, currency) },
                      { label: "Years to FI", value: fi.years_to_fi != null ? `${fi.years_to_fi} yrs` : "—" },
                    ].map(item => (
                      <div key={item.label}>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
                        <p className="text-sm font-semibold mt-0.5">{item.value}</p>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-2">
                  Based on 4% safe withdrawal rate (25× annual expenses) at {fi.assumed_return_pct ?? 7}% assumed annual return.
                  For reference only — not financial advice.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assets breakdown */}
      {summary.assets_breakdown.length > 0 && (
        <Card>
          <button
            onClick={() => setShowAssets(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <span className="text-sm font-medium">Manual Assets ({summary.assets_breakdown.length})</span>
            {showAssets ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {showAssets && (
            <div className="px-5 pb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium">Name</th>
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium">Type</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.assets_breakdown.map((a, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 font-medium">{a.name}</td>
                      <td className="py-2.5 text-muted-foreground">{ASSET_TYPE_LABELS[a.asset_type] ?? a.asset_type}</td>
                      <td className="py-2.5 text-right tabular-nums">{formatCurrency(a.value, a.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Liabilities breakdown */}
      {summary.liabilities_breakdown.length > 0 && (
        <Card>
          <button
            onClick={() => setShowLiabilities(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <span className="text-sm font-medium">Liabilities ({summary.liabilities_breakdown.length})</span>
            {showLiabilities ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {showLiabilities && (
            <div className="px-5 pb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium">Name</th>
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium">Type</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Balance</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.liabilities_breakdown.map((li, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 font-medium">{li.name}</td>
                      <td className="py-2.5 text-muted-foreground">{LIABILITY_TYPE_LABELS[li.liability_type] ?? li.liability_type}</td>
                      <td className="py-2.5 text-right tabular-nums text-red-500">{formatCurrency(li.balance, li.currency)}</td>
                      <td className="py-2.5 text-right text-muted-foreground">
                        {li.interest_rate_pct != null ? `${li.interest_rate_pct}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {summary.assets_breakdown.length === 0 && summary.liabilities_breakdown.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Landmark className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-medium text-sm">No manual assets or liabilities yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add them in <a href="/financial" className="underline underline-offset-2">Financial Profile</a> to see the full breakdown.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
