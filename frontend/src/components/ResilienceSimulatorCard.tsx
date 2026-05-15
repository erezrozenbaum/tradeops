"use client";

import { useState } from "react";
import {
  Shield, ShieldAlert, ShieldOff, ChevronDown, ChevronUp,
  Loader2, Sparkles, AlertTriangle, Briefcase, Sunset, Heart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from "recharts";

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

// ── Preset scenarios ───────────────────────────────────────────────────────

interface ScenarioPreset {
  label: string;
  icon: React.ReactNode;
  duration_months: number;
  monthly_income_loss: number;   // 0 = use full income loss (filled at runtime)
  monthly_expense_increase: number;
  scenarioLabel: string;
  incomeLossIsFullIncome: boolean; // if true, replace with user's actual monthly income
}

const PRESETS: ScenarioPreset[] = [
  {
    label: "Job Loss",
    icon: <Briefcase className="h-3.5 w-3.5" />,
    duration_months: 9,
    monthly_income_loss: 0,
    monthly_expense_increase: 0,
    scenarioLabel: "Job Loss (9 months)",
    incomeLossIsFullIncome: true,
  },
  {
    label: "Sabbatical",
    icon: <Sunset className="h-3.5 w-3.5" />,
    duration_months: 6,
    monthly_income_loss: 0,
    monthly_expense_increase: 0,
    scenarioLabel: "Sabbatical (6 months)",
    incomeLossIsFullIncome: true,
  },
  {
    label: "Health Crisis",
    icon: <Heart className="h-3.5 w-3.5" />,
    duration_months: 6,
    monthly_income_loss: 0,
    monthly_expense_increase: 5000,
    scenarioLabel: "Health Crisis (6 months)",
    incomeLossIsFullIncome: false,
  },
];

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

// ── Depletion chart ────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  "Cash / Instant": "#22c55e",
  "T+2 Liquid": "#3b82f6",
  "1-Week Liquid": "#8b5cf6",
  "Restricted": "#f59e0b",
};

function buildChartData(result: ResilienceResult) {
  // Group liquidation events by month, then by tier
  const byMonth: Record<number, Record<string, number>> = {};
  for (let m = 1; m <= result.duration_months; m++) {
    byMonth[m] = {};
  }
  for (const step of result.depletion_path) {
    byMonth[step.month][step.source_label] = (byMonth[step.month][step.source_label] ?? 0) + step.net_received;
  }
  const tiers = Array.from(new Set(result.depletion_path.map((s) => s.source_label)));
  return {
    data: Object.entries(byMonth).map(([month, tMap]) => ({
      month: `M${month}`,
      ...tMap,
    })),
    tiers,
  };
}

function DepletionChart({ result }: { result: ResilienceResult }) {
  if (result.depletion_path.length === 0) return null;
  const { data, tiers } = buildChartData(result);
  const currency = result.currency;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Monthly liquidations by tier
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barCategoryGap="30%" margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} />
          <YAxis
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
          />
          <Tooltip
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
            formatter={(v: number, name: string) => [fmt(v, currency), name]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {tiers.map((tier) => (
            <Bar key={tier} dataKey={tier} stackId="a" fill={TIER_COLORS[tier] ?? "#6b7280"} radius={[0, 0, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-muted-foreground text-center italic">
        This is a mathematical simulation, not a guarantee of future liquidity.
      </p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ResilienceSimulatorCard({ investorId }: { investorId: string }) {
  const [durationMonths, setDurationMonths] = useState("6");
  const [incomeLoss, setIncomeLoss] = useState("");
  const [expenseIncrease, setExpenseIncrease] = useState("");
  const [scenarioLabel, setScenarioLabel] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const [result, setResult] = useState<ResilienceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPath, setShowPath] = useState(false);

  function applyPreset(preset: ScenarioPreset) {
    setActivePreset(preset.label);
    setDurationMonths(String(preset.duration_months));
    // For income-loss presets, we use a large sentinel that the backend clips to actual income
    setIncomeLoss(preset.incomeLossIsFullIncome ? "999999" : String(preset.monthly_income_loss));
    setExpenseIncrease(String(preset.monthly_expense_increase));
    setScenarioLabel(preset.scenarioLabel);
  }

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
          Simulate a life event and see how long your liquid assets last before locked funds are needed.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── Preset buttons ── */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Quick scenarios</p>
          <div className="flex gap-2 flex-wrap">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                  activePreset === preset.label
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {preset.icon}
                {preset.label}
              </button>
            ))}
            {activePreset && (
              <button
                onClick={() => {
                  setActivePreset(null);
                  setDurationMonths("6");
                  setIncomeLoss("");
                  setExpenseIncrease("");
                  setScenarioLabel("");
                }}
                className="px-2 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:bg-muted"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Custom form ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Duration (months)</label>
            <Input
              type="number"
              min={1}
              max={36}
              value={durationMonths}
              onChange={(e) => { setActivePreset(null); setDurationMonths(e.target.value); }}
              placeholder="6"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Monthly income loss</label>
            <Input
              type="number"
              min={0}
              value={incomeLoss}
              onChange={(e) => { setActivePreset(null); setIncomeLoss(e.target.value); }}
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Monthly extra expenses</label>
            <Input
              type="number"
              min={0}
              value={expenseIncrease}
              onChange={(e) => { setActivePreset(null); setExpenseIncrease(e.target.value); }}
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Scenario name</label>
            <Input
              value={scenarioLabel}
              onChange={(e) => setScenarioLabel(e.target.value)}
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
              <Badge variant="muted" className="text-xs">{result.duration_months} months</Badge>
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
                      result.survival_score >= 80 ? "bg-emerald-500"
                      : result.survival_score >= 50 ? "bg-amber-400"
                      : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(100, (result.months_covered / result.duration_months) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Stacked depletion bar chart */}
            {result.depletion_path.length > 0 && (
              <DepletionChart result={result} />
            )}

            {/* Depletion path table (collapsible) */}
            {result.depletion_path.length > 0 && (
              <div>
                <button
                  onClick={() => setShowPath(p => !p)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPath ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {showPath ? "Hide" : "Show"} full depletion log ({result.depletion_path.length} events)
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
                            <td className="py-1.5 pr-3 text-right tabular-nums">{fmt(step.gross_sold, result.currency)}</td>
                            <td className="py-1.5 pr-3 text-right tabular-nums text-red-500">
                              {step.tax_paid > 0 ? `-${fmt(step.tax_paid, result.currency)}` : "—"}
                            </td>
                            <td className="py-1.5 text-right tabular-nums font-medium">{fmt(step.net_received, result.currency)}</td>
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
