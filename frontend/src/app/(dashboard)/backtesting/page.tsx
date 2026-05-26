"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { AlertCircle, BarChart2, ChevronRight } from "lucide-react";
import { MetricTooltip } from "@/components/ui/metric-tooltip";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Template {
  id: string;
  name: string;
  strategy_type: string;
}

interface BacktestSummary {
  id: string;
  template: Template;
  initial_capital: number;
  final_capital: number;
  period_months: number;
  total_return_pct: number;
  annualized_return_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  win_rate_pct: number;
  currency: string;
  notes: string;
  created_at: string;
}

interface BacktestDetail extends BacktestSummary {
  periods: { id: string; month: number; portfolio_value: number; monthly_return_pct: number }[];
}

export default function BacktestingPage() {
  const investorId = useInvestorId();
  const [runs, setRuns] = useState<BacktestSummary[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<BacktestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    strategy_template_id: "",
    period_months: "36",
    seed: "",
  });

  useEffect(() => {
    if (!investorId) return;
    Promise.all([
      fetch(`/api/v1/investors/${investorId}/backtests`).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/v1/strategies/templates`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([r, t]) => {
        setRuns(r);
        setTemplates(t);
        if (t.length > 0) setForm((f) => ({ ...f, strategy_template_id: t[0].id }));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [investorId]);

  async function runBacktest() {
    if (!investorId) return;
    setRunning(true);
    setError(null);
    try {
      const body = {
        strategy_template_id: form.strategy_template_id,
        period_months: parseInt(form.period_months, 10),
        seed: form.seed ? parseInt(form.seed, 10) : null,
      };
      const res = await fetch(`/api/v1/investors/${investorId}/backtests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json();
        throw new Error(b.detail ?? "Failed to run backtest");
      }
      const run = await res.json();
      setRuns((prev) => [run, ...prev]);
      setSelected(run);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setRunning(false);
    }
  }

  async function loadDetail(id: string) {
    if (!investorId) return;
    const res = await fetch(`/api/v1/investors/${investorId}/backtests/${id}`);
    if (res.ok) setSelected(await res.json());
  }

  if (!investorId || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Backtesting</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Simulate strategy performance on historical-style data
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 text-red-500 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Run form */}
      <Card>
        <CardHeader>
          <CardTitle>Run New Backtest</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Strategy</label>
              <Select
                value={form.strategy_template_id}
                onChange={(e) => setForm({ ...form, strategy_template_id: e.target.value })}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Period (months)</label>
              <Input
                type="number"
                min={1}
                max={360}
                value={form.period_months}
                onChange={(e) => setForm({ ...form, period_months: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Seed <span className="text-muted-foreground/60">(optional)</span>
              </label>
              <Input
                type="number"
                placeholder="Random"
                value={form.seed}
                onChange={(e) => setForm({ ...form, seed: e.target.value })}
              />
            </div>
          </div>
          <Button onClick={runBacktest} disabled={running || !form.strategy_template_id}>
            {running ? "Running…" : "Run backtest"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* List */}
        <div className="lg:col-span-2 space-y-2">
          {runs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart2 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No backtests yet</p>
              </CardContent>
            </Card>
          ) : (
            runs.map((run) => (
              <button
                key={run.id}
                onClick={() => loadDetail(run.id)}
                className={`w-full text-left rounded-lg border p-4 transition-colors ${
                  selected?.id === run.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-muted/40"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium">{run.template.name}</p>
                    <p className="text-xs text-muted-foreground">{run.period_months} months</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-semibold ${
                      run.total_return_pct >= 0 ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {formatPercent(run.total_return_pct)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(run.created_at).toLocaleDateString()}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Detail */}
        <div className="lg:col-span-3">
          {selected ? (
            <Card>
              <CardHeader>
                <CardTitle>{selected.template.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    {
                      label: "Total Return",
                      value: formatPercent(selected.total_return_pct),
                      color: selected.total_return_pct >= 0 ? "text-green-500" : "text-red-500",
                      tooltip: undefined,
                    },
                    {
                      label: "Annualised",
                      value: formatPercent(selected.annualized_return_pct),
                      color: "text-foreground",
                      tooltip: "Total return scaled to a per-year rate. More useful than total return for comparing strategies run over different time periods.",
                    },
                    {
                      label: "Max Drawdown",
                      value: formatPercent(-selected.max_drawdown_pct),
                      color: "text-red-500",
                      tooltip: "The largest peak-to-trough loss during the simulation. A strategy with 25% max drawdown means at some point you would have been down 25% from a recent high — could you have held on without panic-selling?",
                    },
                    {
                      label: "Sharpe Ratio",
                      value: selected.sharpe_ratio.toFixed(2),
                      color: "text-foreground",
                      tooltip: "Return per unit of risk. Above 1.0 is good; above 2.0 is excellent. A high return with high volatility can have a lower Sharpe than a moderate return with low volatility — this metric captures that trade-off.",
                    },
                    {
                      label: "Win Rate",
                      value: `${selected.win_rate_pct.toFixed(1)}%`,
                      color: "text-foreground",
                      tooltip: "Percentage of simulated periods where the strategy was profitable. A 60% win rate doesn't mean 60% returns — a strategy can win often but lose big, or lose often but win big. Read alongside total return.",
                    },
                    {
                      label: "Final Capital",
                      value: formatCurrency(selected.final_capital, selected.currency),
                      color: "text-foreground",
                      tooltip: undefined,
                    },
                  ].map((m) => (
                    <div key={m.label}>
                      <p className="text-xs text-muted-foreground mb-0.5">
                        {m.tooltip ? <MetricTooltip content={m.tooltip}>{m.label}</MetricTooltip> : m.label}
                      </p>
                      <p className={`text-sm font-semibold ${m.color}`}>{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Chart */}
                {selected.periods.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-3">Portfolio Value</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={selected.periods}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis
                          dataKey="month"
                          tickFormatter={(v) => `M${v}`}
                          tick={{ fontSize: 10 }}
                          stroke="var(--muted-foreground)"
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v) =>
                            Intl.NumberFormat("he-IL", {
                              notation: "compact",
                              currency: selected.currency,
                            }).format(v)
                          }
                          stroke="var(--muted-foreground)"
                          width={55}
                        />
                        <Tooltip
                          formatter={(v: number) => formatCurrency(v, selected.currency)}
                          labelFormatter={(l) => `Month ${l}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="portfolio_value"
                          stroke="hsl(var(--primary))"
                          dot={false}
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {selected.notes && (
                  <p className="text-xs text-muted-foreground border-t border-border pt-3">
                    {selected.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full">
              <CardContent className="flex items-center justify-center h-48">
                <p className="text-sm text-muted-foreground">Select a run to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
