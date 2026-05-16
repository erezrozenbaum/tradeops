"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Coins, Info, TrendingUp, RefreshCw, CheckCircle2, AlertTriangle,
  FileText,
} from "lucide-react";

interface StakingPosition {
  holding_id: string;
  account_id: string;
  name: string;
  ticker: string | null;
  quantity: number;
  staking_apy: number;
  current_price_usd: number | null;
  current_price_base: number | null;
  estimated_annual_rewards_native: number;
  estimated_annual_rewards_base: number | null;
  currency: string;
  tax_treatment: string;
  tax_note: string;
}

interface StakingReport {
  investor_id: string;
  base_currency: string;
  total_estimated_annual_income_base: number | null;
  positions: StakingPosition[];
  tax_summary: string;
}

function fmt(n: number | null, currency: string, digits = 2) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: digits }).format(n);
}

export default function CryptoStakingPage() {
  const investorId = useInvestorId();
  const [report, setReport] = useState<StakingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(spin = false) {
    if (!investorId) return;
    if (spin) setRefreshing(true);
    try {
      const r = await fetch(`/api/v1/investors/${investorId}/crypto-staking`);
      if (r.ok) setReport(await r.json());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, [investorId]); // eslint-disable-line

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-64 rounded animate-pulse bg-muted" />
        <div className="h-32 rounded animate-pulse bg-muted" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" />
            Crypto Staking & Yield
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track staking income and understand the tax treatment.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* How to enable */}
      <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 p-3.5">
        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
          To track staking yield, go to <strong>Investments → Holdings</strong>, open a crypto holding,
          and enable staking with the current APY. The dashboard will then show your estimated annual rewards here.
        </p>
      </div>

      {/* Summary card */}
      {report && report.positions.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-900">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-500" />
              Estimated Annual Staking Income
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-3xl font-bold tracking-tight">
              {report.total_estimated_annual_income_base != null
                ? fmt(report.total_estimated_annual_income_base, report.base_currency, 0)
                : "—"
              }
              <span className="text-sm font-normal text-muted-foreground ml-2">/ year</span>
            </div>
            <p className="text-xs text-muted-foreground">{report.tax_summary}</p>
          </CardContent>
        </Card>
      )}

      {/* No positions */}
      {report && report.positions.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <Coins className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium">No staked positions</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              {report.tax_summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Positions */}
      {report && report.positions.length > 0 && (
        <div className="space-y-3">
          {report.positions.map((pos) => (
            <Card key={pos.holding_id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{pos.name}</span>
                      {pos.ticker && (
                        <span className="font-mono text-xs text-muted-foreground">{pos.ticker}</span>
                      )}
                      <Badge variant="warning" className="text-[10px]">
                        {pos.staking_apy.toFixed(2)}% APY
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {pos.quantity.toLocaleString()} {pos.ticker ?? pos.currency} staked
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      +{pos.estimated_annual_rewards_native.toFixed(6)} {pos.ticker ?? pos.currency}/yr
                    </div>
                    {pos.estimated_annual_rewards_base != null && (
                      <div className="text-xs text-emerald-600 dark:text-emerald-400">
                        ≈ {fmt(pos.estimated_annual_rewards_base, report.base_currency, 0)}/yr
                      </div>
                    )}
                  </div>
                </div>

                {pos.current_price_base != null && (
                  <div className="text-xs text-muted-foreground border-t border-border pt-2">
                    Current price: {fmt(pos.current_price_base, report.base_currency, 2)} ·
                    Total staked value: {fmt(pos.quantity * pos.current_price_base, report.base_currency, 0)}
                  </div>
                )}

                {/* Tax note */}
                <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md p-2.5">
                  <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{pos.tax_note}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tax reminder */}
      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Tax treatment: staking rewards = ordinary income</p>
              <p>Unlike capital gains (profit from selling), staking rewards are typically taxed as income
              at the fair market value when you receive them. Keep records of each reward distribution and
              its value at time of receipt. This is different from DeFi liquidity provision, which may
              have different rules in your jurisdiction.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
