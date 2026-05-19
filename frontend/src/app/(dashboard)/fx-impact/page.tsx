"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Globe, TrendingUp, TrendingDown, RefreshCw, Info, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HoldingFxImpact {
  holding_id: string;
  name: string;
  ticker: string | null;
  asset_type: string;
  currency: string;
  base_currency: string;
  quantity: number;
  avg_buy_price: number;
  purchase_fx_rate: number | null;
  current_fx_rate: number | null;
  cost_basis_local: number;
  cost_basis_base: number | null;
  current_value_base: number | null;
  asset_pnl: number | null;
  fx_pnl: number | null;
  total_pnl: number | null;
  asset_pnl_pct: number | null;
  fx_pnl_pct: number | null;
  same_currency: boolean;
  fx_data_available: boolean;
}

interface FxImpactResult {
  investor_id: string;
  base_currency: string;
  holdings: HoldingFxImpact[];
  total_asset_pnl: number;
  total_fx_pnl: number;
  total_pnl: number;
  total_cost_basis: number;
  holdings_missing_fx_data: number;
}

function pct(n: number | null): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function money(n: number | null, ccy: string): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: ccy, maximumFractionDigits: 0,
  }).format(n);
}

function PnlCell({ value, pctVal, ccy }: { value: number | null; pctVal: number | null; ccy: string }) {
  if (value == null) return <span className="text-muted-foreground text-xs">No data</span>;
  const pos = value >= 0;
  return (
    <div className={`tabular-nums ${pos ? "text-emerald-500" : "text-rose-500"}`}>
      <div className="font-medium">{money(value, ccy)}</div>
      <div className="text-xs opacity-80">{pct(pctVal)}</div>
    </div>
  );
}

function SummaryCard({ label, value, ccy, sub }: { label: string; value: number; ccy: string; sub?: string }) {
  const pos = value >= 0;
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${pos ? "text-emerald-500" : "text-rose-500"}`}>
        {value >= 0 ? "+" : ""}{money(value, ccy)}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function FxImpactPage() {
  const investorId = useInvestorId();
  const [data, setData] = useState<FxImpactResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!investorId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/fx-impact`);
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load FX impact data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [investorId]);

  if (loading) return (
    <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center h-64">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  if (error) return (
    <div className="p-4 sm:p-6 lg:p-8">
      <p className="text-destructive text-sm">{error}</p>
    </div>
  );

  if (!data) return null;

  const foreignHoldings = data.holdings.filter(h => !h.same_currency);
  const totalPnlPct = data.total_cost_basis > 0
    ? (data.total_pnl / data.total_cost_basis) * 100
    : null;
  const assetPct = data.total_cost_basis > 0
    ? (data.total_asset_pnl / data.total_cost_basis) * 100
    : null;
  const fxPct = data.total_cost_basis > 0
    ? (data.total_fx_pnl / data.total_cost_basis) * 100
    : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Globe className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">FX Impact</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Portfolio P&amp;L split into asset performance vs. currency movement — in {data.base_currency}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Warning if missing data */}
      {data.holdings_missing_fx_data > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            {data.holdings_missing_fx_data} holding{data.holdings_missing_fx_data > 1 ? "s are" : " is"} missing
            a purchase FX rate — P&amp;L cannot be decomposed for those positions. They will self-correct
            for any new holdings added going forward.
          </span>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="Total P&L"
          value={data.total_pnl}
          ccy={data.base_currency}
          sub={totalPnlPct != null ? pct(totalPnlPct) + " of cost basis" : undefined}
        />
        <SummaryCard
          label="Asset P&L"
          value={data.total_asset_pnl}
          ccy={data.base_currency}
          sub={assetPct != null ? pct(assetPct) + " — price movement" : "price movement"}
        />
        <SummaryCard
          label="Currency P&L"
          value={data.total_fx_pnl}
          ccy={data.base_currency}
          sub={fxPct != null ? pct(fxPct) + " — FX movement" : "FX movement"}
        />
      </div>

      {/* Info box */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          <strong>Asset P&L</strong> = change in local price × quantity × current FX rate.
          &nbsp;<strong>Currency P&L</strong> = cost basis × (FX rate today − FX rate at purchase).
          Same-currency holdings have FX P&L = 0.
        </span>
      </div>

      {/* Foreign-currency holdings table */}
      {foreignHoldings.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Foreign-currency holdings</h2>
            <span className="text-xs text-muted-foreground">({foreignHoldings.length} positions)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Holding</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">FX pair</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Cost basis</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Asset P&L</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">FX P&L</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Total P&L</th>
                </tr>
              </thead>
              <tbody>
                {foreignHoldings.map(h => (
                  <tr key={h.holding_id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-3">
                      <div className="font-medium">{h.name}</div>
                      {h.ticker && <div className="text-xs text-muted-foreground">{h.ticker}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-mono">
                        <span className="text-muted-foreground">{h.base_currency}/{h.currency}</span>
                      </div>
                      {h.purchase_fx_rate && h.current_fx_rate && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {h.purchase_fx_rate.toFixed(4)} → {h.current_fx_rate.toFixed(4)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      {h.cost_basis_base != null ? money(h.cost_basis_base, h.base_currency) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <PnlCell value={h.asset_pnl} pctVal={h.asset_pnl_pct} ccy={h.base_currency} />
                    </td>
                    <td className="px-4 py-3">
                      <PnlCell value={h.fx_pnl} pctVal={h.fx_pnl_pct} ccy={h.base_currency} />
                    </td>
                    <td className="px-4 py-3">
                      <PnlCell value={h.total_pnl} pctVal={null} ccy={h.base_currency} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Same-currency holdings (no FX exposure) */}
      {data.holdings.filter(h => h.same_currency).length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Same-currency holdings</h2>
            <span className="text-xs text-muted-foreground">(no FX exposure)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Holding</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Currency</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Cost basis</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">P&L</th>
                </tr>
              </thead>
              <tbody>
                {data.holdings.filter(h => h.same_currency).map(h => (
                  <tr key={h.holding_id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-3">
                      <div className="font-medium">{h.name}</div>
                      {h.ticker && <div className="text-xs text-muted-foreground">{h.ticker}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{h.currency}</td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      {money(h.cost_basis_local, h.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <PnlCell value={h.total_pnl} pctVal={h.asset_pnl_pct} ccy={h.base_currency} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.holdings.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <Globe className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium mb-1">No holdings found</p>
          <p className="text-xs text-muted-foreground">Add investment holdings to see FX impact analysis.</p>
        </div>
      )}
    </div>
  );
}
