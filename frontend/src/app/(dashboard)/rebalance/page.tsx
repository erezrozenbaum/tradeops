"use client";

import { useEffect, useState, useCallback } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Scale, TrendingUp, TrendingDown, Minus, AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface SuggestedTrade {
  ticker: string;
  name: string;
  action: "buy" | "sell";
  suggested_units: number;
  unit_price: number;
  estimated_value: number;
  currency: string;
}

interface RebalanceTier {
  tier: string;
  label: string;
  target_pct: number;
  actual_pct: number;
  delta_pct: number;
  action: "reduce" | "buy_more" | "hold";
  asset_types: string[];
  target_amount: number | null;
  actual_amount: number | null;
  gap_amount: number | null;
  suggested_trades: SuggestedTrade[];
}

interface RebalanceResult {
  investor_id: string;
  rebalance_needed: boolean;
  tiers: RebalanceTier[];
  notes: string[];
  computed_at: string;
  total_portfolio_value: number | null;
  currency: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function actionConfig(action: string) {
  if (action === "reduce") return { label: "Reduce", variant: "danger" as const, Icon: TrendingDown };
  if (action === "buy_more") return { label: "Buy more", variant: "warning" as const, Icon: TrendingUp };
  return { label: "On target", variant: "success" as const, Icon: Minus };
}

function TierBar({ actual, target }: { actual: number; target: number }) {
  const max = Math.max(actual, target, 1);
  const overweight = actual > target;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <span>0%</span>
        <div className="flex-1 relative h-3 bg-muted rounded-full overflow-visible">
          {/* target marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-primary/60 rounded"
            style={{ left: `${(target / max) * 100}%` }}
          />
          {/* actual bar */}
          <div
            className={`h-full rounded-full transition-all ${overweight ? "bg-red-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.min((actual / max) * 100, 100)}%` }}
          />
        </div>
        <span>{max.toFixed(0)}%</span>
      </div>
      <div className="flex items-center gap-3 text-[10px]">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
          Actual {actual.toFixed(1)}%
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-0.5 h-3 bg-primary/60 rounded" />
          Target {target.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function RebalancePage() {
  const investorId = useInvestorId();
  const [data, setData] = useState<RebalanceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!investorId) return;
    setLoading(true);
    const r = await fetch(`/api/v1/investors/${investorId}/portfolio/rebalance`);
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, [investorId]);

  useEffect(() => { load(); }, [load]);

  function toggleTier(tier: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(tier) ? next.delete(tier) : next.add(tier);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-3xl space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-48 bg-muted rounded" />
          {[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-muted rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 lg:p-8 max-w-3xl">
        <Card>
          <CardContent className="py-12 text-center">
            <Scale className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-medium">Could not load rebalancing data</p>
            <p className="text-sm text-muted-foreground mt-1">Make sure your profile and portfolio are set up.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currency = data.currency ?? "ILS";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Portfolio Rebalance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Compare current allocation to your risk model targets
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-border text-muted-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Status banner */}
      <div className={`flex items-start gap-3 rounded-lg p-4 border ${
        data.rebalance_needed
          ? "bg-amber-500/10 border-amber-500/20"
          : "bg-emerald-500/10 border-emerald-500/20"
      }`}>
        {data.rebalance_needed
          ? <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          : <Scale className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />}
        <div className="space-y-1">
          <p className={`text-sm font-medium ${data.rebalance_needed ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
            {data.rebalance_needed ? "Rebalancing recommended" : "Portfolio is balanced"}
          </p>
          {data.notes.map((n, i) => (
            <p key={i} className="text-xs text-muted-foreground">{n}</p>
          ))}
          {data.total_portfolio_value && (
            <p className="text-xs text-muted-foreground">
              Tradeable value: <span className="font-medium text-foreground">{formatCurrency(data.total_portfolio_value, currency)}</span>
            </p>
          )}
        </div>
      </div>

      {/* Tier cards */}
      {data.tiers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No tier data available. Generate a risk model to see rebalancing guidance.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.tiers.map(tier => {
            const cfg = actionConfig(tier.action);
            const isOpen = expanded.has(tier.tier);
            const hasTrades = tier.suggested_trades.length > 0;
            return (
              <Card key={tier.tier}>
                <button
                  className="w-full text-left"
                  onClick={() => toggleTier(tier.tier)}
                >
                  <div className="px-5 pt-4 pb-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{tier.label}</p>
                        <Badge variant={cfg.variant} className="text-[10px]">
                          <cfg.Icon className="h-2.5 w-2.5 mr-1" />
                          {cfg.label}
                        </Badge>
                        {hasTrades && (
                          <Badge variant="muted" className="text-[10px]">
                            {tier.suggested_trades.length} trade{tier.suggested_trades.length !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold tabular-nums ${
                          tier.delta_pct > 0 ? "text-red-500" : tier.delta_pct < 0 ? "text-amber-500" : "text-emerald-500"
                        }`}>
                          {tier.delta_pct > 0 ? "+" : ""}{tier.delta_pct.toFixed(1)}%
                        </span>
                        {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>

                    <TierBar actual={tier.actual_pct} target={tier.target_pct} />

                    {tier.gap_amount !== null && tier.gap_amount !== 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {tier.gap_amount > 0 ? "Overweight by " : "Underweight by "}
                        <span className="font-medium text-foreground">
                          {formatCurrency(Math.abs(tier.gap_amount), currency)}
                        </span>
                      </p>
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-4 border-t border-border">
                    {/* Asset types */}
                    <div className="flex flex-wrap gap-1.5 mt-3 mb-3">
                      {tier.asset_types.map(t => (
                        <span key={t} className="px-2 py-0.5 rounded text-[10px] bg-muted text-muted-foreground capitalize">
                          {t.replace("_", " ")}
                        </span>
                      ))}
                    </div>

                    {/* Amount breakdown */}
                    {(tier.target_amount !== null || tier.actual_amount !== null) && (
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="rounded-lg bg-muted/40 p-3">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Target</p>
                          <p className="text-sm font-semibold tabular-nums mt-0.5">
                            {tier.target_amount !== null ? formatCurrency(tier.target_amount, currency) : "—"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{tier.target_pct}% of tradeable</p>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-3">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Actual</p>
                          <p className="text-sm font-semibold tabular-nums mt-0.5">
                            {tier.actual_amount !== null ? formatCurrency(tier.actual_amount, currency) : "—"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{tier.actual_pct}% of tradeable</p>
                        </div>
                      </div>
                    )}

                    {/* Suggested trades */}
                    {hasTrades && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Suggested trade</p>
                        {tier.suggested_trades.map((trade, i) => (
                          <div key={i} className={`flex items-center justify-between rounded-lg p-3 border ${
                            trade.action === "buy"
                              ? "bg-emerald-500/5 border-emerald-500/20"
                              : "bg-red-500/5 border-red-500/20"
                          }`}>
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge variant={trade.action === "buy" ? "success" : "danger"} className="text-[10px] uppercase">
                                  {trade.action}
                                </Badge>
                                <span className="font-mono font-bold text-sm">{trade.ticker}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">{trade.name}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {trade.suggested_units.toFixed(4)} units @ {formatCurrency(trade.unit_price, trade.currency)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-bold tabular-nums ${trade.action === "buy" ? "text-emerald-500" : "text-red-500"}`}>
                                {trade.action === "buy" ? "+" : "-"}{formatCurrency(trade.estimated_value, trade.currency)}
                              </p>
                              <p className="text-[10px] text-muted-foreground">estimated</p>
                            </div>
                          </div>
                        ))}
                        <p className="text-[10px] text-muted-foreground mt-2">
                          Suggested trade is for informational purposes only. Verify with your broker before executing.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center">
        Computed at {new Date(data.computed_at).toLocaleString()} · Threshold: ±5% deviation triggers suggestion
      </p>
    </div>
  );
}
