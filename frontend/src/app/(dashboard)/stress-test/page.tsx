"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingDown, TrendingUp, BarChart2, Zap } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface ScenarioImpact {
  scenario_id: string;
  scenario_name: string;
  description: string;
  year: string;
  portfolio_loss: number;
  portfolio_loss_pct: number;
  simulated_value: number;
  low_risk_loss: number;
  growth_loss: number;
  high_risk_loss: number;
  fx_impact: number;
}

interface MonteCarloPercentile {
  year: number;
  p10: number;
  p50: number;
  p90: number;
}

interface StressTestResult {
  investor_id: string;
  currency: string;
  current_value: number;
  scenarios: ScenarioImpact[];
  monte_carlo: { years: number; percentiles: MonteCarloPercentile[] };
  computed_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function pct(v: number, decimals = 1) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(decimals)}%`;
}

const SCENARIO_COLORS: Record<string, string> = {
  "2008_gfc": "#ef4444",
  covid_crash: "#f97316",
  "2022_rate_hike": "#eab308",
  tech_crash_40: "#8b5cf6",
  ils_depreciation: "#06b6d4",
};

// ── Chart tooltip ──────────────────────────────────────────────────────────

function McTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-md">
      <p className="font-medium text-muted-foreground mb-1.5">Year {label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium" style={{ color: p.color }}>
            {formatCurrency(p.value, currency)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function StressTestPage() {
  const investorId = useInvestorId();
  const [data, setData] = useState<StressTestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!investorId) return;
    setLoading(true);
    fetch(`/api/v1/investors/${investorId}/portfolio/stress-test`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [investorId]);

  const currency = data?.currency ?? "USD";
  const current = data?.current_value ?? 0;

  // Sort scenarios worst-first
  const scenarios = [...(data?.scenarios ?? [])].sort((a, b) => a.portfolio_loss - b.portfolio_loss);
  const selectedScenario = selected ? scenarios.find(s => s.scenario_id === selected) : null;

  const mcData = data?.monte_carlo.percentiles ?? [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Zap className="h-6 w-6" />
          Stress Test
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Historical crash scenarios applied to your portfolio · Monte Carlo wealth projection
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          Running stress tests…
        </div>
      )}

      {!loading && !data && (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            <BarChart2 className="h-12 w-12 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">No portfolio data available</p>
            <p className="text-sm text-muted-foreground/70">Add investment holdings to run stress tests.</p>
          </CardContent>
        </Card>
      )}

      {data && current > 0 && (
        <>
          {/* Current value banner */}
          <div className="flex items-center gap-3 p-4 bg-muted/40 rounded-xl border border-border">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Current portfolio value</p>
              <p className="text-2xl font-bold">{formatCurrency(current, currency)}</p>
            </div>
            <div className="ml-auto text-xs text-muted-foreground text-right">
              <p>Scenarios apply historical</p>
              <p>drawdowns to your current allocation</p>
            </div>
          </div>

          {/* Scenario cards */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Historical Crash Scenarios</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {scenarios.map((s) => {
                const isGain = s.portfolio_loss > 0;
                const isSel = selected === s.scenario_id;
                const color = SCENARIO_COLORS[s.scenario_id] ?? "#6b7280";
                return (
                  <button
                    key={s.scenario_id}
                    onClick={() => setSelected(isSel ? null : s.scenario_id)}
                    className={`text-left rounded-xl border p-4 transition-all hover:shadow-md ${
                      isSel ? "border-primary ring-1 ring-primary" : "border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold">{s.scenario_name}</p>
                        <p className="text-[10px] text-muted-foreground">{s.year}</p>
                      </div>
                      <Badge
                        variant={isGain ? "success" : "danger"}
                        className="text-xs shrink-0 ml-2"
                      >
                        {pct(s.portfolio_loss_pct)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{s.description}</p>

                    {/* Loss bar */}
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full"
                        style={{
                          background: color,
                          width: `${Math.min(Math.abs(s.portfolio_loss_pct), 100)}%`,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">Simulated value</span>
                      <span className={`text-sm font-bold ${isGain ? "text-green-500" : "text-red-500"}`}>
                        {formatCurrency(s.simulated_value, currency)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected scenario drill-down */}
          {selectedScenario && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  {selectedScenario.scenario_name} — Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  {[
                    { label: "Portfolio Impact", value: formatCurrency(selectedScenario.portfolio_loss, currency), positive: selectedScenario.portfolio_loss >= 0 },
                    { label: "Low-Risk (Bonds)", value: formatCurrency(selectedScenario.low_risk_loss, currency), positive: selectedScenario.low_risk_loss >= 0 },
                    { label: "Growth (Equities)", value: formatCurrency(selectedScenario.growth_loss, currency), positive: selectedScenario.growth_loss >= 0 },
                    { label: "High-Risk (Crypto)", value: formatCurrency(selectedScenario.high_risk_loss, currency), positive: selectedScenario.high_risk_loss >= 0 },
                    ...(selectedScenario.fx_impact !== 0 ? [{ label: "FX Impact (USD/ILS)", value: formatCurrency(selectedScenario.fx_impact, currency), positive: selectedScenario.fx_impact >= 0 }] : []),
                  ].map(({ label, value, positive }) => (
                    <div key={label} className="bg-muted/40 rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                      <p className={`text-lg font-bold ${positive ? "text-green-500" : "text-red-500"}`}>{value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">{selectedScenario.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Monte Carlo chart */}
          {mcData.length > 1 && (
            <Card>
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Monte Carlo Wealth Projection — {data.monte_carlo.years} Years
                  </CardTitle>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-3 h-1 rounded bg-green-400 inline-block" />P90 (optimistic)</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-1 rounded bg-blue-500 inline-block" />P50 (median)</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-1 rounded bg-red-400 inline-block" />P10 (pessimistic)</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  1,000 simulations · 7% avg annual return · 15% volatility (historical equity parameters)
                </p>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={mcData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="grad-p90" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4ade80" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="grad-p50" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="grad-p10" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f87171" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v) => `Y${v}`} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<McTooltip currency={currency} />} />
                    <Area type="monotone" dataKey="p90" name="P90 (optimistic)"
                      stroke="#4ade80" strokeWidth={1.5} fill="url(#grad-p90)" dot={false} strokeDasharray="4 4" />
                    <Area type="monotone" dataKey="p50" name="P50 (median)"
                      stroke="#3b82f6" strokeWidth={2} fill="url(#grad-p50)" dot={false} />
                    <Area type="monotone" dataKey="p10" name="P10 (pessimistic)"
                      stroke="#f87171" strokeWidth={1.5} fill="url(#grad-p10)" dot={false} strokeDasharray="4 4" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {[
                    { label: "Pessimistic (P10)", value: mcData[mcData.length - 1]?.p10, color: "text-red-500" },
                    { label: "Median (P50)", value: mcData[mcData.length - 1]?.p50, color: "text-blue-500" },
                    { label: "Optimistic (P90)", value: mcData[mcData.length - 1]?.p90, color: "text-green-500" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="text-center bg-muted/40 rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
                      <p className={`text-base font-bold ${color}`}>
                        {value ? formatCurrency(value, currency) : "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">in {data.monte_carlo.years}y</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
