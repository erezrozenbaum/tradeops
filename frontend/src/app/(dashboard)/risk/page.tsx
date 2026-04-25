"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { AlertCircle, RefreshCw, TrendingUp } from "lucide-react";

interface RiskModel {
  id: string;
  stability_score: number;
  stability_classification: string;
  total_net_worth: number;
  liquid_capital: number;
  investable_capital: number;
  low_risk_pct: number;
  growth_pct: number;
  high_risk_pct: number;
  max_drawdown_pct: number;
  low_risk_amount: number;
  growth_amount: number;
  high_risk_amount: number;
  currency: string;
  generated_at: string;
}

const STABILITY_COLORS: Record<string, "success" | "warning" | "danger" | "default"> = {
  unstable: "danger",
  fragile: "warning",
  stable: "success",
  strong: "success",
};

export default function RiskPage() {
  const investorId = useInvestorId();
  const [model, setModel] = useState<RiskModel | null>(null);
  const [history, setHistory] = useState<RiskModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!investorId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/v1/investors/${investorId}/risk-model`).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`/api/v1/investors/${investorId}/risk-model/history`).then((r) =>
        r.ok ? r.json() : []
      ),
    ])
      .then(([latest, hist]) => {
        setModel(latest);
        setHistory(hist ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (investorId) load();
  }, [investorId]);

  async function generate() {
    if (!investorId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/risk-model`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.detail ?? "Failed to generate");
      }
      const rm = await res.json();
      setModel(rm);
      setHistory((h) => [rm, ...h]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setGenerating(false);
    }
  }

  if (!investorId || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Risk Model</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Capital allocation and risk tolerance snapshot
          </p>
        </div>
        <Button onClick={generate} disabled={generating}>
          <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
          {generating ? "Generating…" : "Generate new model"}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-3 text-red-500 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!model ? (
        <Card>
          <CardContent className="py-16 text-center">
            <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">No risk model yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Make sure you have a financial profile, then click &quot;Generate new model&quot; to compute your risk allocation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Overview row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Net Worth", value: formatCurrency(model.total_net_worth, model.currency) },
              { label: "Liquid Capital", value: formatCurrency(model.liquid_capital, model.currency) },
              { label: "Investable Capital", value: formatCurrency(model.investable_capital, model.currency) },
              { label: "Max Drawdown", value: formatPercent(-model.max_drawdown_pct) },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground mb-2">{s.label}</p>
                  <p className="text-xl font-bold tracking-tight">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Stability + Tiers */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Stability</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end gap-3">
                  <span className="text-5xl font-bold">{model.stability_score}</span>
                  <span className="text-muted-foreground mb-2">/ 100</span>
                  <Badge
                    variant={STABILITY_COLORS[model.stability_classification]}
                    className="mb-1.5 ml-auto capitalize"
                  >
                    {model.stability_classification}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Generated {new Date(model.generated_at).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Allocation Tiers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  {
                    label: "Low Risk",
                    pct: model.low_risk_pct,
                    amount: model.low_risk_amount,
                    bar: "bg-green-500",
                  },
                  {
                    label: "Growth",
                    pct: model.growth_pct,
                    amount: model.growth_amount,
                    bar: "bg-primary",
                  },
                  {
                    label: "High Risk",
                    pct: model.high_risk_pct,
                    amount: model.high_risk_amount,
                    bar: "bg-red-500",
                  },
                ].map((tier) => (
                  <div key={tier.label}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${tier.bar}`} />
                        <span className="text-muted-foreground">{tier.label}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">{tier.pct.toFixed(1)}%</span>
                        <span className="text-muted-foreground text-xs ml-2">
                          {formatCurrency(tier.amount, model.currency)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${tier.bar}`}
                        style={{ width: `${tier.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* History */}
          {history.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="pb-2 text-left font-medium">Generated</th>
                        <th className="pb-2 text-right font-medium">Stability</th>
                        <th className="pb-2 text-right font-medium">Investable</th>
                        <th className="pb-2 text-right font-medium">Low</th>
                        <th className="pb-2 text-right font-medium">Growth</th>
                        <th className="pb-2 text-right font-medium">High</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {history.map((h, i) => (
                        <tr key={h.id} className={i === 0 ? "font-medium" : "text-muted-foreground"}>
                          <td className="py-2.5">{new Date(h.generated_at).toLocaleString()}</td>
                          <td className="py-2.5 text-right">
                            <span className="capitalize">{h.stability_classification}</span> ({h.stability_score})
                          </td>
                          <td className="py-2.5 text-right">{formatCurrency(h.investable_capital, h.currency)}</td>
                          <td className="py-2.5 text-right">{h.low_risk_pct.toFixed(0)}%</td>
                          <td className="py-2.5 text-right">{h.growth_pct.toFixed(0)}%</td>
                          <td className="py-2.5 text-right">{h.high_risk_pct.toFixed(0)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
