"use client";

import { useEffect, useState } from "react";
import { Droplets, Lock, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LiquidityBucket {
  tier: number;
  label: string;
  total_gross: number;
  total_net_to_pocket: number;
  holding_count: number;
}

interface LiquidityHolding {
  holding_id: string;
  name: string;
  ticker: string | null;
  asset_type: string;
  account_name: string;
  gross_value: number;
  estimated_tax: number;
  market_impact: number;
  net_to_pocket: number;
  tier: number;
  tier_label: string;
  selected_for_target: boolean;
}

interface LiquidityRunway {
  investor_id: string;
  currency: string;
  buckets: LiquidityBucket[];
  total_gross: number;
  total_net_to_pocket: number;
  target_amount: number | null;
  target_met: boolean | null;
  lever_total_gross: number;
  lever_total_net: number;
  holdings: LiquidityHolding[];
  computed_at: string;
}

const TIER_COLORS: Record<number, string> = {
  1: "bg-emerald-500",
  2: "bg-amber-400",
  3: "bg-slate-400 dark:bg-slate-600",
};

const TIER_TEXT: Record<number, string> = {
  1: "text-emerald-700 dark:text-emerald-400",
  2: "text-amber-700 dark:text-amber-400",
  3: "text-slate-500 dark:text-slate-400",
};

function fmt(v: number, currency: string) {
  return `${currency} ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function LiquidityRunwayCard({ investorId }: { investorId: string }) {
  const [data, setData] = useState<LiquidityRunway | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [targetLoading, setTargetLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/investors/${investorId}/portfolio/liquidity-runway`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [investorId]);

  async function runLever() {
    const amount = parseFloat(targetInput);
    if (!amount || amount <= 0) return;
    setTargetLoading(true);
    try {
      const res = await fetch(
        `/api/v1/investors/${investorId}/portfolio/liquidity-runway?target_amount=${amount}`
      );
      if (res.ok) setData(await res.json());
    } finally {
      setTargetLoading(false);
    }
  }

  if (loading) return null;
  if (!data) return null;
  if (data.total_gross === 0) return null;

  const tier1 = data.buckets.find((b) => b.tier === 1);
  const tier2 = data.buckets.find((b) => b.tier === 2);
  const tier3 = data.buckets.find((b) => b.tier === 3);
  const totalForBar = data.total_gross;

  const pct = (v: number) => totalForBar > 0 ? (v / totalForBar) * 100 : 0;

  const selectedHoldings = data.holdings.filter((h) => h.selected_for_target);
  const leverHoldings = data.holdings.filter((h) => h.tier < 3).slice(0, expanded ? 999 : 5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Droplets className="h-4 w-4 text-cyan-500" />
          Liquidity Runway
          <span className="text-xs font-normal text-muted-foreground ml-1">
            {data.currency} {data.total_net_to_pocket.toLocaleString(undefined, { maximumFractionDigits: 0 })} accessible
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Liquidity Bar */}
        <div className="space-y-2">
          <div className="flex h-5 rounded-full overflow-hidden gap-0.5">
            {(tier1?.total_gross ?? 0) > 0 && (
              <div
                className={`${TIER_COLORS[1]} transition-all`}
                style={{ width: `${pct(tier1!.total_gross)}%` }}
                title={`1–3 Days: ${fmt(tier1!.total_gross, data.currency)}`}
              />
            )}
            {(tier2?.total_gross ?? 0) > 0 && (
              <div
                className={`${TIER_COLORS[2]} transition-all`}
                style={{ width: `${pct(tier2!.total_gross)}%` }}
                title={`1 Week: ${fmt(tier2!.total_gross, data.currency)}`}
              />
            )}
            {(tier3?.total_gross ?? 0) > 0 && (
              <div
                className={`${TIER_COLORS[3]} transition-all`}
                style={{ width: `${pct(tier3!.total_gross)}%` }}
                title={`Locked: ${fmt(tier3!.total_gross, data.currency)}`}
              />
            )}
          </div>
          <div className="flex items-center gap-4 text-xs">
            {[tier1, tier2, tier3].filter(Boolean).map((b) => b && b.holding_count > 0 && (
              <span key={b.tier} className="flex items-center gap-1.5">
                <span className={`inline-block w-2.5 h-2.5 rounded-sm ${TIER_COLORS[b.tier]}`} />
                <span className={`font-medium ${TIER_TEXT[b.tier]}`}>{b.label}</span>
                <span className="text-muted-foreground">{fmt(b.total_net_to_pocket, data.currency)}</span>
                {b.tier === 3 && <Lock className="h-3 w-3 text-muted-foreground" />}
              </span>
            ))}
          </div>
        </div>

        {/* Emergency Lever */}
        <div className="border border-border rounded-lg p-3 space-y-3">
          <p className="text-xs font-medium text-foreground">Emergency Lever</p>
          <p className="text-xs text-muted-foreground">
            If you need cash fast, which holdings to sell first (lowest tax + impact cost)?
          </p>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder={`Target amount (${data.currency})`}
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              className="h-8 text-sm"
            />
            <Button size="sm" onClick={runLever} disabled={targetLoading || !targetInput}>
              {targetLoading ? "…" : "Calculate"}
            </Button>
          </div>

          {data.target_amount !== null && (
            <div className={`text-xs rounded-md px-3 py-2 ${data.target_met ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400" : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"}`}>
              {data.target_met
                ? `Target of ${fmt(data.target_amount, data.currency)} is achievable — net proceeds: ${fmt(data.lever_total_net, data.currency)}`
                : `Insufficient liquid assets — only ${fmt(data.lever_total_net, data.currency)} net achievable`}
            </div>
          )}

          {selectedHoldings.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Sell in this order</p>
              {selectedHoldings.map((h) => (
                <div key={h.holding_id} className="flex items-center justify-between py-1.5 px-2.5 rounded-md bg-muted/50 text-xs">
                  <div>
                    <span className="font-medium">{h.ticker ?? h.name}</span>
                    {h.ticker && <span className="text-muted-foreground ml-1.5">{h.name}</span>}
                    <Badge variant="muted" className="ml-2 text-[10px] py-0">{h.tier_label}</Badge>
                  </div>
                  <div className="text-right">
                    <span className="font-medium text-foreground">{fmt(h.net_to_pocket, data.currency)}</span>
                    {h.estimated_tax > 0 && (
                      <span className="ml-2 text-red-500">−{fmt(h.estimated_tax, data.currency)} tax</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All liquidatable holdings */}
        <div>
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {expanded ? "Hide" : "Show"} all liquidatable holdings ({data.holdings.filter(h => h.tier < 3).length})
          </button>

          {expanded && (
            <div className="mt-2 space-y-1">
              {leverHoldings.map((h) => (
                <div key={h.holding_id} className="grid grid-cols-5 gap-2 py-1.5 px-2.5 rounded-md hover:bg-muted/40 text-xs">
                  <div className="col-span-2">
                    <span className="font-medium">{h.ticker ?? h.name}</span>
                    <span className="block text-muted-foreground text-[10px]">{h.account_name}</span>
                  </div>
                  <div className="text-right">
                    <span className={TIER_TEXT[h.tier]}>{h.tier_label}</span>
                  </div>
                  <div className="text-right text-muted-foreground">
                    {h.estimated_tax > 0 && <span className="text-red-500">−{fmt(h.estimated_tax, data.currency)}</span>}
                  </div>
                  <div className="text-right font-medium">{fmt(h.net_to_pocket, data.currency)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
