"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { AlertCircle, TrendingUp, PlayCircle, XCircle } from "lucide-react";
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
}

interface PortfolioSummary {
  id: string;
  template: Template;
  initial_capital: number;
  current_value: number;
  total_return_pct: number;
  currency: string;
  status: string;
  started_at: string;
  last_tick_at: string | null;
}

interface Tick {
  id: string;
  tick_number: number;
  portfolio_value_before: number;
  portfolio_value_after: number;
  monthly_return_pct: number;
  simulated_at: string;
}

interface PortfolioDetail extends PortfolioSummary {
  ticks: Tick[];
}

const STATUS_BADGE: Record<string, "success" | "warning" | "muted" | "default"> = {
  active: "success",
  closed: "muted",
};

export default function PaperTradingPage() {
  const investorId = useInvestorId();
  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<PortfolioDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [ticking, setTicking] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState("");

  useEffect(() => {
    if (!investorId) return;
    Promise.all([
      fetch(`/api/v1/investors/${investorId}/paper-portfolios`).then((r) =>
        r.ok ? r.json() : []
      ),
      fetch(`/api/v1/strategies/templates`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([p, t]) => {
        setPortfolios(p);
        setTemplates(t);
        if (t.length > 0) setTemplateId(t[0].id);
        // Auto-select the most recent portfolio so users don't land on an empty right panel
        if (p.length > 0) loadDetail(p[0].id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [investorId]);

  async function loadDetail(id: string) {
    if (!investorId) return;
    const res = await fetch(`/api/v1/investors/${investorId}/paper-portfolios/${id}`);
    if (res.ok) setSelected(await res.json());
  }

  async function createPortfolio() {
    if (!investorId) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/paper-portfolios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy_template_id: templateId }),
      });
      if (!res.ok) {
        const b = await res.json();
        throw new Error(b.detail ?? "Failed to create");
      }
      const p = await res.json();
      setPortfolios((prev) => [p, ...prev]);
      setSelected(p);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  }

  async function advanceTick() {
    if (!investorId || !selected) return;
    setTicking(true);
    try {
      const res = await fetch(
        `/api/v1/investors/${investorId}/paper-portfolios/${selected.id}/tick`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }
      );
      if (!res.ok) throw new Error("Failed");
      const updated = await res.json();
      setSelected(updated);
      setPortfolios((prev) =>
        prev.map((p) =>
          p.id === updated.id
            ? { ...p, current_value: updated.current_value, total_return_pct: updated.total_return_pct, last_tick_at: updated.last_tick_at }
            : p
        )
      );
    } finally {
      setTicking(false);
    }
  }

  async function closePortfolio() {
    if (!investorId || !selected) return;
    setClosing(true);
    try {
      const res = await fetch(
        `/api/v1/investors/${investorId}/paper-portfolios/${selected.id}/close`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Failed");
      const updated = await res.json();
      setSelected(updated);
      setPortfolios((prev) => prev.map((p) => (p.id === updated.id ? { ...p, status: "closed" } : p)));
    } finally {
      setClosing(false);
    }
  }

  if (!investorId || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const chartData = selected?.ticks.map((t) => ({
    tick: t.tick_number,
    value: t.portfolio_value_after,
  })) ?? [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paper Trading</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Simulate a strategy using your investable capital — no real money at risk.
          Pick a strategy, start a portfolio, then advance ticks (each = one simulated month) to see performance over time.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 text-red-500 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Create */}
      <Card>
        <CardHeader>
          <CardTitle>New Portfolio</CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-4">
          <div className="flex-1 max-w-xs space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Strategy</label>
            <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={createPortfolio} disabled={creating || !templateId}>
            {creating ? "Creating…" : "Start portfolio"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* List */}
        <div className="lg:col-span-2 space-y-2">
          {portfolios.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No portfolios yet</p>
              </CardContent>
            </Card>
          ) : (
            portfolios.map((p) => (
              <button
                key={p.id}
                onClick={() => loadDetail(p.id)}
                className={`w-full text-left rounded-lg border p-4 transition-colors ${
                  selected?.id === p.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-muted/40"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-medium">{p.template.name}</p>
                  <Badge variant={STATUS_BADGE[p.status] ?? "default"} className="capitalize">
                    {p.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatCurrency(p.current_value, p.currency)}</span>
                  <span
                    className={p.total_return_pct >= 0 ? "text-green-500 font-medium" : "text-red-500 font-medium"}
                  >
                    {formatPercent(p.total_return_pct)}
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
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>{selected.template.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selected.ticks.length} ticks ·{" "}
                    {selected.last_tick_at
                      ? `Last tick ${new Date(selected.last_tick_at).toLocaleString()}`
                      : "No ticks yet"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selected.status === "active" && (
                    <>
                      <Button size="sm" onClick={advanceTick} disabled={ticking}>
                        <PlayCircle className="h-3.5 w-3.5" />
                        {ticking ? "…" : "Advance tick"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={closePortfolio} disabled={closing}>
                        <XCircle className="h-3.5 w-3.5" />
                        {closing ? "…" : "Close"}
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Zero-capital warning */}
                {selected.initial_capital === 0 && (
                  <div className="flex items-start gap-3 text-sm p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">No investable capital set</p>
                      <p className="text-xs mt-0.5 opacity-80">
                        Your risk model has ₪0 investable capital. Go to <strong>Financial</strong> → set your savings and investable %, then regenerate your <strong>Risk Model</strong>. The simulation will then use real capital.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  {[
                    {
                      label: "Current Value",
                      value: formatCurrency(selected.current_value, selected.currency),
                    },
                    {
                      label: "Initial Capital",
                      value: formatCurrency(selected.initial_capital, selected.currency),
                    },
                    {
                      label: "Total Return",
                      value: formatPercent(selected.total_return_pct),
                      color: selected.total_return_pct >= 0 ? "text-green-500" : "text-red-500",
                    },
                  ].map((m) => (
                    <div key={m.label}>
                      <p className="text-xs text-muted-foreground mb-0.5">{m.label}</p>
                      <p className={`text-sm font-semibold ${m.color ?? ""}`}>{m.value}</p>
                    </div>
                  ))}
                </div>

                {chartData.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-3">
                      Portfolio Value Over Time
                    </p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis
                          dataKey="tick"
                          tickFormatter={(v) => `T${v}`}
                          tick={{ fontSize: 10 }}
                          stroke="var(--muted-foreground)"
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v) =>
                            Intl.NumberFormat("he-IL", { notation: "compact" }).format(v)
                          }
                          stroke="var(--muted-foreground)"
                          width={55}
                        />
                        <Tooltip
                          formatter={(v: number) => formatCurrency(v, selected.currency)}
                          labelFormatter={(l) => `Tick ${l}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="hsl(var(--primary))"
                          dot={false}
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {selected.ticks.length === 0 && selected.status === "active" && (
                  <div className="text-center py-8 space-y-1">
                    <p className="text-sm font-medium">Ready to simulate</p>
                    <p className="text-xs text-muted-foreground">
                      Click <strong>Advance tick</strong> to simulate one month of returns based on the <strong>{selected.template.name}</strong> strategy.
                      Each tick applies a randomised monthly return from the strategy&apos;s return distribution.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full">
              <CardContent className="flex items-center justify-center h-48">
                <p className="text-sm text-muted-foreground">Select a portfolio to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
