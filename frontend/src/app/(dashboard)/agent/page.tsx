"use client";

import { useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import {
  Bot, TrendingUp, AlertTriangle, Zap, Layers, Target,
  ArrowRight, RefreshCw, CheckCircle2, Clock, Lightbulb,
} from "lucide-react";

interface ActionItem {
  action: string;
  instrument_name: string;
  ticker: string | null;
  urgency: string;
  suggested_amount: number | null;
  currency: string | null;
  reasoning: string;
}

interface Opportunity {
  ticker: string;
  name: string;
  asset_type: string;
  current_price: number | null;
  price_currency: string | null;
  why_now: string;
  fit_score: number;
  risk_level: string;
  is_in_portfolio: boolean;
  suggested_allocation_pct: number;
}

interface CapitalThresholdPlan {
  threshold_amount: number;
  currency: string;
  label: string;
  primary_action: string;
  instruments: string[];
  rationale: string;
}

interface AgentReport {
  generated_at: string;
  portfolio_health_score: number;
  market_pulse: string;
  portfolio_assessment: string;
  action_plan: ActionItem[];
  top_opportunities: Opportunity[];
  capital_thresholds: CapitalThresholdPlan[];
  risk_warnings: string[];
  no_data: boolean;
}

const URGENCY_CONFIG: Record<string, { label: string; color: string }> = {
  immediate: { label: "Immediate", color: "bg-red-500/10 text-red-600 border-red-200" },
  soon: { label: "Soon", color: "bg-amber-500/10 text-amber-600 border-amber-200" },
  when_convenient: { label: "When ready", color: "bg-blue-500/10 text-blue-600 border-blue-200" },
};

const ACTION_ICONS: Record<string, string> = {
  buy: "↑", sell: "↓", hold: "→", save: "💰", reduce_debt: "⬇",
};

const RISK_COLORS: Record<string, string> = {
  low: "text-green-600",
  moderate: "text-blue-600",
  high: "text-amber-600",
  very_high: "text-red-600",
};

function HealthScore({ score }: { score: number }) {
  const color = score >= 70 ? "text-green-600" : score >= 45 ? "text-amber-600" : "text-red-500";
  const ringColor = score >= 70 ? "stroke-green-500" : score >= 45 ? "stroke-amber-400" : "stroke-red-500";
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="relative flex items-center justify-center h-20 w-20">
      <svg className="absolute -rotate-90" width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/20" />
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="6" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" className={ringColor} />
      </svg>
      <div className={`text-center ${color}`}>
        <p className="text-xl font-bold leading-none">{score}</p>
        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Health</p>
      </div>
    </div>
  );
}

export default function AgentPage() {
  const investorId = useInvestorId();
  const [report, setReport] = useState<AgentReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAgent() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/v1/investors/${investorId}/agent`);
      if (r.ok) {
        setReport(await r.json());
      } else {
        setError("Agent failed to run. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  }

  return (
    <div className="p-8 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bot className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">AI Investment Agent</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Your personal AI analyst — scans the market, reads your portfolio, tells you exactly what to do next.
          </p>
        </div>
        <button
          onClick={runAgent}
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {loading ? (
            <><RefreshCw className="h-4 w-4 animate-spin" /> Analysing…</>
          ) : (
            <><Zap className="h-4 w-4" /> {report ? "Re-run agent" : "Run agent"}</>
          )}
        </button>
      </div>

      {/* Empty state */}
      {!report && !loading && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-3">
            <Bot className="h-14 w-14 mx-auto text-muted-foreground/30" />
            <p className="font-semibold text-lg">Ready to analyse your situation</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              The agent reads your full financial profile, portfolio, goals, and scans 40+ market instruments to generate a personalised action plan with specific amounts.
            </p>
            <button
              onClick={runAgent}
              className="mt-2 inline-flex items-center gap-2 px-6 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Zap className="h-4 w-4" /> Run agent now
            </button>
            <p className="text-xs text-muted-foreground mt-2">Takes ~10 seconds · Uses Claude AI</p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="py-14 text-center space-y-3">
            <RefreshCw className="h-10 w-10 mx-auto text-primary animate-spin" />
            <p className="font-medium">Agent is thinking…</p>
            <p className="text-sm text-muted-foreground">
              Scanning market catalog · Analysing portfolio · Building your action plan
            </p>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {report && !loading && (
        <>
          {/* Top summary bar */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-8 flex-wrap">
                <HealthScore score={report.portfolio_health_score} />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    <p className="text-sm font-medium">Market pulse</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{report.market_pulse}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground shrink-0">
                  <p className="flex items-center gap-1 justify-end"><Clock className="h-3 w-3" /> Last run</p>
                  <p>{new Date(report.generated_at).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Portfolio assessment */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-5">
              <div className="flex gap-3">
                <Bot className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold mb-1">Portfolio assessment</p>
                  <p className="text-sm text-muted-foreground">{report.portfolio_assessment}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action plan */}
          {report.action_plan.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Zap className="h-4 w-4" /> Action plan
              </h2>
              {report.action_plan.map((action, i) => {
                const urg = URGENCY_CONFIG[action.urgency] ?? URGENCY_CONFIG.when_convenient;
                return (
                  <Card key={i}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl w-8 shrink-0 text-center leading-none mt-0.5">
                          {ACTION_ICONS[action.action] ?? "→"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-medium text-sm">{action.instrument_name}</p>
                            {action.ticker && (
                              <span className="font-mono text-xs text-muted-foreground">{action.ticker}</span>
                            )}
                            <Badge variant="muted" className={`text-xs ${urg.color}`}>
                              {urg.label}
                            </Badge>
                            <Badge variant="muted" className="text-xs capitalize">
                              {action.action.replace("_", " ")}
                            </Badge>
                            {action.suggested_amount != null && action.currency && (
                              <span className="ml-auto font-semibold text-sm text-primary">
                                {formatCurrency(action.suggested_amount, action.currency)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{action.reasoning}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Top opportunities */}
          {report.top_opportunities.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Lightbulb className="h-4 w-4" /> Top opportunities for you
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {report.top_opportunities.map((opp, i) => (
                  <Card key={i} className={opp.is_in_portfolio ? "border-green-200/60" : ""}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-sm">{opp.ticker}</span>
                            {opp.is_in_portfolio && (
                              <Badge variant="muted" className="text-[10px] bg-green-500/10 text-green-600 border-green-200">
                                Owned
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{opp.name}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-1 justify-end">
                            {"★".repeat(Math.min(5, Math.round(opp.fit_score / 2)))}
                            <span className="text-xs text-muted-foreground ml-1">{opp.fit_score}/10</span>
                          </div>
                          {opp.current_price != null && (
                            <p className="text-xs font-medium mt-0.5">
                              {formatCurrency(opp.current_price, opp.price_currency ?? "USD")}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{opp.why_now}</p>
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-medium capitalize ${RISK_COLORS[opp.risk_level] ?? ""}`}>
                          {opp.risk_level.replace("_", " ")} risk
                        </span>
                        <span className="text-muted-foreground">
                          Suggested: {opp.suggested_allocation_pct}% of portfolio
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Capital thresholds — the centrepiece */}
          {report.capital_thresholds.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Layers className="h-4 w-4" /> Your step-by-step capital plan
              </h2>
              <p className="text-xs text-muted-foreground -mt-1">
                Know exactly what to do at every savings milestone — from your first investment to a fully diversified portfolio.
              </p>
              <div className="relative">
                {/* Vertical connector */}
                <div className="absolute left-5 top-8 bottom-8 w-0.5 bg-border" />
                <div className="space-y-3">
                  {report.capital_thresholds.map((tier, i) => (
                    <div key={i} className="flex gap-4 items-start">
                      <div className="flex flex-col items-center shrink-0 z-10">
                        <div className="h-10 w-10 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
                          <Target className="h-4 w-4 text-primary" />
                        </div>
                      </div>
                      <Card className="flex-1">
                        <CardContent className="pt-3 pb-3">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-semibold text-sm text-primary">{tier.label}</p>
                            <span className="text-xs font-mono font-bold">
                              {formatCurrency(tier.threshold_amount, tier.currency)}
                            </span>
                          </div>
                          <p className="text-sm font-medium mb-1">{tier.primary_action}</p>
                          <p className="text-xs text-muted-foreground mb-2">{tier.rationale}</p>
                          {tier.instruments.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {tier.instruments.map((inst, j) => (
                                <span
                                  key={j}
                                  className="inline-block px-2 py-0.5 rounded bg-muted text-xs font-mono"
                                >
                                  {inst}
                                </span>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Risk warnings */}
          {report.risk_warnings.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Risk warnings
              </h2>
              {report.risk_warnings.map((w, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">{w}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
