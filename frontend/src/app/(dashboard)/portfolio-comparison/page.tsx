"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, BarChart2, RefreshCw } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AllocationDrift {
  label: string;
  value_now: number;
  value_then: number;
  delta: number;
}

interface ComparisonResult {
  period: string;
  has_comparison: boolean;
  value_now: number;
  value_then: number | null;
  value_delta: number | null;
  value_delta_pct: number | null;
  currency: string;
  snapshot_at_now: string;
  snapshot_at_then: string | null;
  allocation_drift: AllocationDrift[];
  pnl_now: number;
  pnl_then: number | null;
}

type Period = "1w" | "1m" | "3m";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, currency: string) {
  if (v == null) return "—";
  return formatCurrency(v, currency);
}

function DeltaChip({ delta, pct }: { delta: number | null; pct: number | null }) {
  if (delta == null) return <span className="text-muted-foreground text-sm">—</span>;
  const up = delta >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold ${up ? "text-green-500" : "text-red-500"}`}>
      {up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
      {up ? "+" : ""}{pct != null ? `${pct.toFixed(2)}%` : ""}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PortfolioComparisonPage() {
  const investorId = useInvestorId();
  const [period, setPeriod] = useState<Period>("1m");
  const [data, setData] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(p: Period) {
    if (!investorId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/v1/investors/${investorId}/portfolio/comparison?period=${p}`);
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.detail ?? "Failed to load");
      }
      setData(await r.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (investorId) load(period); }, [investorId]);

  function selectPeriod(p: Period) {
    setPeriod(p);
    load(p);
  }

  const currency = data?.currency ?? "USD";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl space-y-5 lg:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary" />
            Portfolio Comparison
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Compare your portfolio value and allocation over time
          </p>
        </div>
        <button
          onClick={() => load(period)}
          disabled={loading}
          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Period selector */}
      <div className="flex rounded-lg border border-border overflow-hidden w-fit">
        {(["1w", "1m", "3m"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => selectPeriod(p)}
            className={`px-5 py-2 text-sm font-medium transition-colors ${
              period === p
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {p === "1w" ? "1 Week" : p === "1m" ? "1 Month" : "3 Months"}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {data && (
        <>
          {/* Value cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground mb-1">Current Value</p>
                <p className="text-2xl font-bold tabular-nums">{fmt(data.value_now, currency)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.snapshot_at_now ? new Date(data.snapshot_at_now).toLocaleDateString() : "—"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground mb-1">
                  {data.has_comparison ? "Value Then" : "No prior snapshot"}
                </p>
                <p className="text-2xl font-bold tabular-nums text-muted-foreground">
                  {fmt(data.value_then, currency)}
                </p>
                {data.snapshot_at_then && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(data.snapshot_at_then).toLocaleDateString()}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground mb-1">Change</p>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className={`text-2xl font-bold tabular-nums ${
                    data.value_delta == null ? "text-muted-foreground" :
                    data.value_delta >= 0 ? "text-green-500" : "text-red-500"
                  }`}>
                    {data.value_delta != null
                      ? `${data.value_delta >= 0 ? "+" : ""}${fmt(data.value_delta, currency)}`
                      : "—"}
                  </p>
                  <DeltaChip delta={data.value_delta} pct={data.value_delta_pct} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* P&L row */}
          {data.has_comparison && (
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground mb-1">Unrealized P&L — Now</p>
                  <p className={`text-lg font-semibold ${data.pnl_now >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {data.pnl_now >= 0 ? "+" : ""}{fmt(data.pnl_now, currency)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground mb-1">Unrealized P&L — Then</p>
                  <p className={`text-lg font-semibold ${
                    data.pnl_then == null ? "text-muted-foreground" :
                    data.pnl_then >= 0 ? "text-green-500" : "text-red-500"
                  }`}>
                    {data.pnl_then != null
                      ? `${data.pnl_then >= 0 ? "+" : ""}${fmt(data.pnl_then, currency)}`
                      : "—"}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Allocation drift */}
          {data.allocation_drift.length > 0 && (
            <Card>
              <div className="px-5 py-4 border-b border-border">
                <p className="text-sm font-medium">Allocation Drift</p>
                <p className="text-xs text-muted-foreground">Change in allocation value per asset type</p>
              </div>
              <div className="divide-y divide-border">
                {data.allocation_drift.map((row) => (
                  <div key={row.label} className="px-5 py-3 grid grid-cols-4 gap-2 text-sm items-center">
                    <span className="font-medium capitalize">{row.label.replace(/_/g, " ")}</span>
                    <span className="tabular-nums text-muted-foreground text-right">{fmt(row.value_then, currency)}</span>
                    <span className="tabular-nums text-right">{fmt(row.value_now, currency)}</span>
                    <span className={`tabular-nums text-right font-medium ${
                      row.delta > 0 ? "text-green-500" : row.delta < 0 ? "text-red-500" : "text-muted-foreground"
                    }`}>
                      {row.delta > 0 ? "+" : ""}{fmt(row.delta, currency)}
                    </span>
                  </div>
                ))}
                <div className="px-5 py-2 grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                  <span />
                  <span className="text-right">Then</span>
                  <span className="text-right">Now</span>
                  <span className="text-right">Delta</span>
                </div>
              </div>
            </Card>
          )}

          {!data.has_comparison && (
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart2 className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="font-medium">Not enough history yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Snapshots accumulate daily. Check back once more data is recorded.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
