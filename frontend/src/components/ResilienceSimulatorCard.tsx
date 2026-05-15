"use client";

import { useState } from "react";
import {
  Shield, ShieldAlert, ShieldOff, ChevronDown, ChevronUp,
  Loader2, Sparkles, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ── Types ──────────────────────────────────────────────────────────────────

interface DepletionStep {
  month: number;
  source_label: string;
  holding_name: string;
  holding_ticker: string | null;
  gross_sold: number;
  tax_paid: number;
  net_received: number;
  cumulative_net_raised: number;
}

interface ResilienceResult {
  investor_id: string;
  currency: string;
  scenario_label: string;
  duration_months: number;
  monthly_income: number;
  monthly_expenses: number;
  monthly_income_loss: number;
  monthly_expense_increase: number;
  monthly_burn: number;
  total_cash_needed: number;
  cash_reserve: number;
  tier3_total_gross: number;
  months_covered: number;
  tier3_breach: boolean;
  survival_score: number;
  survival_verdict: string;
  depletion_path: DepletionStep[];
  ai_recommendation: string | null;
  computed_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(v: number, currency: string) {
  return `${currency} ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function VerdictIcon({ verdict }: { verdict: string }) {
  if (verdict === "Safe") return <Shield className="h-5 w-5 text-emerald-500" />;
  if (verdict === "At Risk") return <ShieldAlert className="h-5 w-5 text-amber-500" />;
  return <ShieldOff className="h-5 w-5 text-red-500" />;
}

function verdictColor(verdict: string) {
  if (verdict === "Safe") return "text-emerald-600 dark:text-emerald-400";
  if (verdict === "At Risk") return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function verdictBg(verdict: string) {
  if (verdict === "Safe") return "bg-emerald-500/10 border-emerald-500/20";
  if (verdict === "At Risk") return "bg-amber-500/10 border-amber-500/20";
  return "bg-red-500/10 border-red-500/20";
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-sm font-bold tabular-nums w-8 text-right">{score}</span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ResilienceSimulatorCard({ investorId }: { investorId: string }) {
  const [durationMonths, setDurationMonths] = useState("6");
  const [incomeLoss, setIncomeLoss] = useState("");
  const [expenseIncrease, setExpenseIncrease] = useState("");
  const [scenarioLabel, setScenarioLabel] = useState("");

  const [result, setResult] = useState<ResilienceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPath, setShowPath] = useState(false);

  async function runSimulation() {
    setLoading(true);
    setError(null);
    setResult(null);

    const body = {
      duration_months: parseInt(durationMonths) || 6,
      monthly_income_loss: parseFloat(incomeLoss) || 0,
      monthly_expense_increase: parseFloat(expenseIncrease) || 0,
      scenario_label: scenarioLabel.trim() || null,
    };

    try {
      const res = await fetch(`/api/v1/investors/${investorId}/portfolio/resilience`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Simulation failed");
      }
      setResult(await res.json());
      setShowPath(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-5 w-5" />
          Resilience Stress-Test
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Simulate a life event (job loss, unexpected expenses) and see how long your liquid assets last before locked funds are needed.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── Form ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Duration (months)</label>
            <Input
              type="number"
              min={1}
              max={36}
              value={durationMonths}
              onChange={e => setDurationMonths(e.target.value)}
              placeholder="6"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Monthly income loss</label>
            <Input
              type="number"
              min={0}
              value={incomeLoss}
              onChange={e => setIncomeLoss(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Monthly extra expenses</label>
            <Input
              type="number"
              min={0}
              value={expenseIncrease}
              onChange={e => setExpenseIncrease(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Scenario name (optional)</label>
            <Input
              value={scenarioLabel}
              onChange={e => setScenarioLabel(e.target.value)}
              placeholder="Job loss"
              maxLength={100}
            />
          </div>
        </div>

        <Button onClick={runSimulation} disabled={loading} className="w-full sm:w-auto">
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" />Simulating…</>
          ) : (
            "Run Simulation"
          )}
        </Button>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* ── Results ── */}
        {result && (
          <div className="space-y-4 pt-1 border-t border-border">
            {/* Scenario title */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{result.scenario_label}</span>
              <Badge variant="muted" className="text-xs">
                {result.duration_months} months
              </Badge>
            </div>

            {/* Verdict banner */}
            <div className={`flex items-center gap-3 p-4 rounded-lg border ${verdictBg(result.survival_verdict)}`}>
              <VerdictIcon verdict={result.survival_verdict} />
              <div className="flex-1 min-w-0">
                <p className={`font-semibold ${verdictColor(result.survival_verdict)}`}>
                  {result.survival_verdict}
                  {result.tier3_breach
                    ? ` — Tier 3 breach at month ${result.months_covered + 1}`
                    : " — Fully covered without touching locked assets"}
                </p>
                <ScoreBar score={result.survival_score} />
              </div>
              <span className={`text-3xl font-bold tabular-nums ${verdictColor(result.survival_verdict)}`}>
                {result.survival_score}
              </span>
            </div>

            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Monthly burn", value: fmt(result.monthly_burn, result.currency) },
                { label: "Total needed", value: fmt(result.total_cash_needed, result.currency) },
                { label: "Cash reserve", value: fmt(result.cash_reserve, result.currency) },
                { label: "Locked (Tier 3)", value: fmt(result.tier3_total_gross, result.currency) },
              ].map(({ label, value }) => (
                <div key={label} className="p-3 bg-muted/40 rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-semibold mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {/* Months covered bar */}
            {result.monthly_burn > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Months covered by liquid assets</span>
                  <span className="font-medium">
                    {result.months_covered} / {result.duration_months} months
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      result.survival_score >= 80
                        ? "bg-emerald-500"
                        : result.survival_score >= 50
                        ? "bg-amber-400"
                        : "bg-red-500"
                    }`}
                    style={{
                      width: `${Math.min(100, (result.months_covered / result.duration_months) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Depletion path toggle */}
            {result.depletion_path.length > 0 && (
              <div>
                <button
                  onClick={() => setShowPath(p => !p)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPath ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {showPath ? "Hide" : "Show"} depletion path ({result.depletion_path.length} liquidation events)
                </button>

                {showPath && (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b border-border">
                          <th className="pb-1.5 pr-3 font-medium">Month</th>
                          <th className="pb-1.5 pr-3 font-medium">Asset</th>
                          <th className="pb-1.5 pr-3 font-medium">Tier</th>
                          <th className="pb-1.5 pr-3 font-medium text-right">Gross sold</th>
                          <th className="pb-1.5 pr-3 font-medium text-right">Tax</th>
                          <th className="pb-1.5 font-medium text-right">Net received</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.depletion_path.map((step, i) => (
                          <tr key={i} className="border-b border-border/50 last:border-0">
                            <td className="py-1.5 pr-3 tabular-nums">{step.month}</td>
                            <td className="py-1.5 pr-3">
                              {step.holding_name}
                              {step.holding_ticker && (
                                <span className="ml-1 text-muted-foreground">({step.holding_ticker})</span>
                              )}
                            </td>
                            <td className="py-1.5 pr-3 text-muted-foreground">{step.source_label}</td>
                            <td className="py-1.5 pr-3 text-right tabular-nums">
                              {fmt(step.gross_sold, result.currency)}
                            </td>
                            <td className="py-1.5 pr-3 text-right tabular-nums text-red-500">
                              {step.tax_paid > 0 ? `-${fmt(step.tax_paid, result.currency)}` : "—"}
                            </td>
                            <td className="py-1.5 text-right tabular-nums font-medium">
                              {fmt(step.net_received, result.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {result.monthly_burn === 0 && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Your income covers all expenses in this scenario — no assets need to be liquidated.
              </p>
            )}

            {/* AI recommendation */}
            {result.ai_recommendation && (
              <div className="p-3 bg-muted/40 rounded-lg border border-border space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Recommendation
                </div>
                <p className="text-sm leading-relaxed">{result.ai_recommendation}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
