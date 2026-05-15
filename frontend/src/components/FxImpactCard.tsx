"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Globe, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface HoldingFx {
  holding_id: string;
  name: string;
  ticker: string | null;
  currency: string;
  asset_pnl: number | null;
  fx_pnl: number | null;
  total_pnl: number | null;
  asset_pnl_pct: number | null;
  fx_pnl_pct: number | null;
  same_currency: boolean;
  fx_data_available: boolean;
  cost_basis_base: number | null;
}

interface FxImpactData {
  base_currency: string;
  total_cost_basis: number;
  total_asset_pnl: number;
  total_fx_pnl: number;
  total_pnl: number;
  holdings_missing_fx_data: number;
  holdings: HoldingFx[];
}

function Pnl({ value, pct, currency }: { value: number | null; pct: number | null; currency: string }) {
  if (value === null) return <span className="text-muted-foreground text-xs">—</span>;
  const pos = value >= 0;
  return (
    <span className={pos ? "text-green-600 dark:text-green-400" : "text-red-500"}>
      {pos ? "+" : ""}{currency} {Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
      {pct !== null && <span className="ml-1 text-xs opacity-70">({pos ? "+" : ""}{pct.toFixed(1)}%)</span>}
    </span>
  );
}

function Bar({ asset, fx, total }: { asset: number | null; fx: number | null; total: number | null }) {
  if (asset === null || fx === null || total === null || total === 0) return null;
  const abs = Math.abs(total);
  const assetPct = Math.min(100, Math.abs(asset) / abs * 100);
  const fxPct = Math.min(100, Math.abs(fx) / abs * 100);
  return (
    <div className="flex h-1.5 w-full rounded overflow-hidden gap-px mt-1">
      <div className="bg-blue-500 rounded-l" style={{ width: `${assetPct}%` }} title={`Asset P&L: ${assetPct.toFixed(0)}%`} />
      <div className="bg-amber-400 rounded-r" style={{ width: `${fxPct}%` }} title={`FX P&L: ${fxPct.toFixed(0)}%`} />
    </div>
  );
}

export function FxImpactCard({ investorId }: { investorId: string }) {
  const [data, setData] = useState<FxImpactData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!investorId) return;
    fetch(`/api/v1/investors/${investorId}/portfolio/fx-impact`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [investorId]);

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-4 w-4" /> FX Impact</CardTitle></CardHeader>
        <CardContent><div className="h-24 animate-pulse rounded bg-muted" /></CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const crossCurrency = data.holdings.filter((h) => !h.same_currency && h.fx_data_available);
  if (crossCurrency.length === 0 && data.holdings_missing_fx_data === 0) return null;

  const totalIsDriven = Math.abs(data.total_pnl) > 0;
  const fxShare = totalIsDriven ? Math.round(Math.abs(data.total_fx_pnl) / Math.abs(data.total_pnl) * 100) : 0;
  const assetShare = totalIsDriven ? 100 - fxShare : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4 text-amber-500" />
          FX Impact Analysis
        </CardTitle>
        <p className="text-xs text-muted-foreground -mt-1">
          Portfolio P&amp;L split into market performance and currency movements
        </p>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Summary row */}
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: "Total P&L", value: data.total_pnl, pct: data.total_cost_basis > 0 ? data.total_pnl / data.total_cost_basis * 100 : 0, color: "" },
            { label: "Asset P&L", value: data.total_asset_pnl, pct: data.total_cost_basis > 0 ? data.total_asset_pnl / data.total_cost_basis * 100 : 0, color: "bg-blue-500" },
            { label: "FX P&L", value: data.total_fx_pnl, pct: data.total_cost_basis > 0 ? data.total_fx_pnl / data.total_cost_basis * 100 : 0, color: "bg-amber-400" },
          ].map(({ label, value, pct, color }) => (
            <div key={label} className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                {color && <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />}
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
              </div>
              <p className={`text-sm font-semibold tabular-nums ${value >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                {value >= 0 ? "+" : ""}{data.base_currency} {Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className={`text-xs tabular-nums ${pct >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"} opacity-70`}>
                {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
              </p>
            </div>
          ))}
        </div>

        {/* Attribution split bar */}
        {totalIsDriven && (
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-blue-500" /> Market {assetShare}%</span>
              <span className="flex items-center gap-1">FX {fxShare}% <span className="inline-block w-2 h-2 rounded-full bg-amber-400" /></span>
            </div>
            <div className="flex h-2 rounded overflow-hidden gap-px">
              <div className="bg-blue-500" style={{ width: `${assetShare}%` }} />
              <div className="bg-amber-400" style={{ width: `${fxShare}%` }} />
            </div>
          </div>
        )}

        {/* Per-holding breakdown */}
        {crossCurrency.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">By Holding</p>
            <div className="space-y-2.5">
              {crossCurrency
                .filter((h) => h.total_pnl !== null)
                .sort((a, b) => Math.abs(b.total_pnl ?? 0) - Math.abs(a.total_pnl ?? 0))
                .slice(0, 8)
                .map((h) => (
                  <div key={h.holding_id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <p className="text-sm font-medium leading-tight">{h.name}</p>
                        <p className="text-xs text-muted-foreground">{h.ticker ?? ""} · {h.currency}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">Total</p>
                        <Pnl value={h.total_pnl} pct={null} currency={data.base_currency} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs mt-1">
                      <div>
                        <span className="text-muted-foreground">Market: </span>
                        <Pnl value={h.asset_pnl} pct={h.asset_pnl_pct} currency={data.base_currency} />
                      </div>
                      <div>
                        <span className="text-muted-foreground">FX: </span>
                        <Pnl value={h.fx_pnl} pct={h.fx_pnl_pct} currency={data.base_currency} />
                      </div>
                    </div>
                    <Bar asset={h.asset_pnl} fx={h.fx_pnl} total={h.total_pnl} />
                  </div>
                ))}
            </div>
          </div>
        )}

        {data.holdings_missing_fx_data > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground border-t border-border pt-3">
            <HelpCircle className="h-3.5 w-3.5 shrink-0" />
            {data.holdings_missing_fx_data} holding(s) created before v0.64 don&apos;t have a recorded purchase rate — FX breakdown not available for those.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
