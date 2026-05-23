"use client";

import { useEffect, useState } from "react";
import { Layers, Bookmark, Play, AlertTriangle, GitBranch } from "lucide-react";
import { GlowCard } from "@/components/ui/glow-card";
import { StatCard } from "@/components/ui/stat-card";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TrajectoryPoint {
  month: number;
  p10: number;
  p50: number;
  p90: number;
}

interface ActualPoint {
  month: number;
  value: number;
}

interface SimulationResults {
  trajectory: TrajectoryPoint[];
  final_p10: number;
  final_p50: number;
  final_p90: number;
  probability_positive: number | null;
  is_monte_carlo: boolean;
  iterations: number;
  // counterfactual-specific
  is_counterfactual?: boolean;
  counterfactual_type?: string;
  actual_trajectory?: ActualPoint[];
  actual_final?: number;
  actual_start?: number;
  delta?: number;
  delta_pct?: number;
  reference_date?: string;
  elapsed_months?: number;
  explanation?: string;
  panic_tickers?: string[];
  total_sold?: number;
  estimated_held_value?: number;
}

interface SimulationRun {
  id: string;
  scenario_type: string;
  scenario_name: string;
  horizon_months: number;
  results: SimulationResults;
  data_snapshot: Record<string, number | string>;
  random_seed: number | null;
  is_saved: boolean;
  disclaimer: string;
  computed_at: string;
}

// ─── Scenario config ─────────────────────────────────────────────────────────

const SCENARIOS = [
  { key: "debt_payoff",               label: "Debt Payoff",          color: "#22d3ee", kind: "deterministic" },
  { key: "savings_increase",          label: "Save More",            color: "#22c55e", kind: "deterministic" },
  { key: "job_loss",                  label: "Job Loss",             color: "#ef4444", kind: "deterministic" },
  { key: "market_crash",              label: "Market Crash",         color: "#f97316", kind: "mc" },
  { key: "retirement",                label: "Retirement",           color: "#a855f7", kind: "mc" },
  { key: "custom",                    label: "Custom",               color: "#6b7280", kind: "mc" },
  { key: "counterfactual_rebalance",  label: "If Rebalanced?",       color: "#06b6d4", kind: "counterfactual" },
  { key: "counterfactual_constraint", label: "If Constrained?",      color: "#10b981", kind: "counterfactual" },
  { key: "counterfactual_hold",       label: "If No Panic Sell?",    color: "#f59e0b", kind: "counterfactual" },
] as const;

type ScenarioKey = typeof SCENARIOS[number]["key"];

interface ParamField {
  key: string;
  label: string;
  type?: "number" | "text";
  defaultValue?: number;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

const SCENARIO_PARAMS: Record<ScenarioKey, ParamField[]> = {
  debt_payoff: [
    { key: "extra_monthly_payment", label: "Extra Monthly Payment", defaultValue: 500, min: 0, unit: "currency" },
    { key: "annual_return_rate_pct", label: "Expected Return Rate", defaultValue: 5, min: 0, max: 20, step: 0.5, unit: "%" },
    { key: "horizon_months", label: "Horizon (months)", defaultValue: 60, min: 12, max: 360, step: 12, unit: "months" },
  ],
  savings_increase: [
    { key: "monthly_savings_increase", label: "Extra Monthly Savings", defaultValue: 500, min: 0, unit: "currency" },
    { key: "annual_return_rate_pct", label: "Expected Return Rate", defaultValue: 7, min: 0, max: 20, step: 0.5, unit: "%" },
    { key: "horizon_months", label: "Horizon (months)", defaultValue: 60, min: 12, max: 360, step: 12, unit: "months" },
  ],
  job_loss: [
    { key: "income_replacement_pct", label: "Income Replacement (0–1)", defaultValue: 0, min: 0, max: 1, step: 0.1, unit: "ratio" },
    { key: "expense_reduction_pct", label: "Expense Reduction (0–1)", defaultValue: 0.1, min: 0, max: 0.8, step: 0.05, unit: "ratio" },
    { key: "horizon_months", label: "Horizon (months)", defaultValue: 24, min: 6, max: 60, step: 6, unit: "months" },
  ],
  market_crash: [
    { key: "crash_drawdown_pct", label: "Crash Severity (%)", defaultValue: 30, min: 5, max: 70, unit: "%" },
    { key: "crash_probability_pct", label: "Annual Crash Probability (%)", defaultValue: 15, min: 1, max: 50, unit: "%" },
    { key: "annual_return_rate_pct", label: "Base Return Rate (%)", defaultValue: 7, min: 0, max: 20, step: 0.5, unit: "%" },
    { key: "annual_volatility_pct", label: "Annual Volatility (%)", defaultValue: 15, min: 1, max: 50, unit: "%" },
    { key: "horizon_months", label: "Horizon (months)", defaultValue: 60, min: 12, max: 240, step: 12, unit: "months" },
  ],
  retirement: [
    { key: "annual_return_rate_pct", label: "Expected Return Rate (%)", defaultValue: 7, min: 0, max: 20, step: 0.5, unit: "%" },
    { key: "annual_volatility_pct", label: "Annual Volatility (%)", defaultValue: 12, min: 1, max: 40, unit: "%" },
    { key: "monthly_contribution", label: "Monthly Contribution", defaultValue: 1000, min: 0, unit: "currency" },
    { key: "horizon_months", label: "Horizon (months)", defaultValue: 120, min: 12, max: 480, step: 12, unit: "months" },
  ],
  custom: [
    { key: "annual_return_rate_pct", label: "Expected Return Rate (%)", defaultValue: 7, min: -20, max: 30, step: 0.5, unit: "%" },
    { key: "annual_volatility_pct", label: "Annual Volatility (%)", defaultValue: 15, min: 0, max: 60, unit: "%" },
    { key: "monthly_contribution", label: "Monthly Contribution", defaultValue: 0, unit: "currency" },
    { key: "horizon_months", label: "Horizon (months)", defaultValue: 60, min: 6, max: 480, step: 6, unit: "months" },
  ],
  counterfactual_rebalance: [
    { key: "decision_id", label: "Decision ID", type: "text", placeholder: "Paste a RecommendationDecision UUID" },
  ],
  counterfactual_constraint: [],
  counterfactual_hold: [
    { key: "event_id", label: "Behavioral Risk Event ID", type: "text", placeholder: "Paste a panic_selling event UUID" },
  ],
};

// ─── SVG Trajectory Chart ─────────────────────────────────────────────────────

function TrajectoryChart({
  trajectory,
  actualTrajectory,
  isMonteCarlo,
  isCounterfactual,
  color,
  currency,
}: {
  trajectory: TrajectoryPoint[];
  actualTrajectory?: ActualPoint[];
  isMonteCarlo: boolean;
  isCounterfactual: boolean;
  color: string;
  currency: string;
}) {
  if (!trajectory.length) return null;

  const W = 600, H = 240;
  const PAD = { top: 16, right: 20, bottom: 32, left: 60 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const allVals: number[] = trajectory.flatMap(p => [p.p10, p.p90]);
  if (actualTrajectory) actualTrajectory.forEach(p => allVals.push(p.value));

  const yMin = Math.min(0, ...allVals);
  const yMax = Math.max(...allVals) * 1.05;
  const yRange = yMax - yMin || 1;
  const xMax = trajectory[trajectory.length - 1].month;

  const xS = (m: number) => PAD.left + (m / xMax) * cW;
  const yS = (v: number) => PAD.top + cH - ((v - yMin) / yRange) * cH;

  const pts50 = trajectory.map(p => `${xS(p.month).toFixed(1)},${yS(p.p50).toFixed(1)}`).join(" ");
  const ptsP10 = trajectory.map(p => `${xS(p.month).toFixed(1)},${yS(p.p10).toFixed(1)}`).join(" ");
  const ptsP90 = trajectory.map(p => `${xS(p.month).toFixed(1)},${yS(p.p90).toFixed(1)}`).join(" ");
  const ptsActual = actualTrajectory?.map(p => `${xS(p.month).toFixed(1)},${yS(p.value).toFixed(1)}`).join(" ");

  const bandPath = [
    `M ${xS(trajectory[0].month).toFixed(1)} ${yS(trajectory[0].p90).toFixed(1)}`,
    ...trajectory.slice(1).map(p => `L ${xS(p.month).toFixed(1)} ${yS(p.p90).toFixed(1)}`),
    ...trajectory.slice().reverse().map(p => `L ${xS(p.month).toFixed(1)} ${yS(p.p10).toFixed(1)}`),
    "Z",
  ].join(" ");

  const fmt = (v: number) =>
    Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
    : Math.abs(v) >= 1_000 ? `${(v / 1_000).toFixed(0)}K`
    : v.toFixed(0);

  const yTicks = [yMin, yMin + yRange * 0.25, yMin + yRange * 0.5, yMin + yRange * 0.75, yMax];
  const xTicks = Array.from({ length: Math.floor(xMax / 12) + 1 }, (_, i) => i * 12).filter(m => m <= xMax);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }}>
      {isMonteCarlo && <path d={bandPath} fill={color} fillOpacity={0.08} />}
      {isMonteCarlo && (
        <>
          <polyline points={ptsP90} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.35} strokeDasharray="4 3" />
          <polyline points={ptsP10} fill="none" stroke="#ef4444" strokeWidth={1} strokeOpacity={0.35} strokeDasharray="4 3" />
        </>
      )}
      {/* Actual path for counterfactuals */}
      {isCounterfactual && ptsActual && (
        <polyline points={ptsActual} fill="none" stroke="#6b7280" strokeWidth={1.5} strokeDasharray="5 3" />
      )}
      {/* Main / counterfactual line */}
      <polyline points={pts50} fill="none" stroke={color} strokeWidth={2} />
      {yMin < 0 && (
        <line x1={PAD.left} y1={yS(0)} x2={W - PAD.right} y2={yS(0)}
          stroke="#6b7280" strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.4} />
      )}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={PAD.left - 4} y1={yS(v)} x2={PAD.left} y2={yS(v)} stroke="#6b7280" strokeWidth={1} strokeOpacity={0.4} />
          <text x={PAD.left - 6} y={yS(v)} textAnchor="end" dominantBaseline="middle" fill="#9ca3af" fontSize={9}>{fmt(v)}</text>
        </g>
      ))}
      {xTicks.map(m => (
        <g key={m}>
          <line x1={xS(m)} y1={H - PAD.bottom} x2={xS(m)} y2={H - PAD.bottom + 4} stroke="#6b7280" strokeWidth={1} strokeOpacity={0.4} />
          <text x={xS(m)} y={H - PAD.bottom + 12} textAnchor="middle" fill="#9ca3af" fontSize={9}>
            {m === 0 ? "Start" : `${m}m`}
          </text>
        </g>
      ))}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="#374151" strokeWidth={1} />
      <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="#374151" strokeWidth={1} />
      <text x={PAD.left + 4} y={PAD.top + 10} fill="#6b7280" fontSize={8}>{currency}</text>
    </svg>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FuturesPage() {
  const [scenarioType, setScenarioType] = useState<ScenarioKey>("savings_increase");
  const [numParams, setNumParams] = useState<Record<string, number>>({});
  const [textParams, setTextParams] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SimulationRun | null>(null);
  const [history, setHistory] = useState<SimulationRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [investorId, setInvestorId] = useState<string | null>(null);

  useEffect(() => {
    const defaults: Record<string, number> = {};
    const textDefaults: Record<string, string> = {};
    SCENARIO_PARAMS[scenarioType].forEach(f => {
      if (f.type === "text") {
        textDefaults[f.key] = "";
      } else {
        defaults[f.key] = f.defaultValue ?? 0;
      }
    });
    setNumParams(defaults);
    setTextParams(textDefaults);
  }, [scenarioType]);

  useEffect(() => {
    const id = localStorage.getItem("tradeops_investor_id");
    if (!id) return;
    setInvestorId(id);
    fetch(`/api/v1/investors/${id}/simulations?limit=10`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setHistory(d.simulations); })
      .catch(() => {});
  }, []);

  const scenarioConfig = SCENARIOS.find(s => s.key === scenarioType)!;
  const isCounterfactual = scenarioConfig.kind === "counterfactual";

  async function runSimulation() {
    if (!investorId) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const fields = SCENARIO_PARAMS[scenarioType];
    const horizonField = fields.find(f => f.key === "horizon_months");
    const horizon_months = horizonField ? (numParams[horizonField.key] ?? horizonField.defaultValue ?? 60) : 60;

    const paramPayload: Record<string, number | string> = {};
    fields.forEach(f => {
      if (f.key === "horizon_months") return;
      if (f.type === "text") {
        const v = textParams[f.key] ?? "";
        if (v) paramPayload[f.key] = v;
      } else {
        paramPayload[f.key] = numParams[f.key] ?? (f.defaultValue ?? 0);
      }
    });

    try {
      const r = await fetch(`/api/v1/investors/${investorId}/simulations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_type: scenarioType,
          horizon_months: isCounterfactual ? 1 : horizon_months,
          parameters: paramPayload,
        }),
      });
      if (!r.ok) {
        const e: { detail?: string } = await r.json();
        throw new Error(e.detail || "Simulation failed");
      }
      const data: SimulationRun = await r.json();
      setResult(data);
      setHistory(prev => [data, ...prev].slice(0, 10));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function saveRun(id: string) {
    if (!investorId) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/v1/investors/${investorId}/simulations/${id}/save`, { method: "POST" });
      if (r.ok) {
        const updated: SimulationRun = await r.json();
        setResult(prev => prev?.id === id ? updated : prev);
        setHistory(prev => prev.map(s => s.id === id ? updated : s));
      }
    } finally {
      setSaving(false);
    }
  }

  const res = result?.results;
  const currency = (result?.data_snapshot?.currency as string) || "";
  const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Layers className="h-5 w-5 text-cyber-cyan" />
          Financial Futures
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Run forward simulations and backward counterfactual replays against your portfolio.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Builder panel */}
        <GlowCard className="p-5 space-y-5 lg:col-span-1">
          <h2 className="text-sm font-semibold text-foreground">Scenario Builder</h2>

          {/* Section: Forward */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wide mb-1.5">Forward</p>
            <div className="grid grid-cols-2 gap-1.5">
              {SCENARIOS.filter(s => s.kind !== "counterfactual").map(s => (
                <button
                  key={s.key}
                  onClick={() => setScenarioType(s.key)}
                  className={`px-2 py-1.5 text-xs rounded-md border transition-colors text-left ${
                    scenarioType === s.key
                      ? "border-cyber-cyan/30 bg-cyber-cyan/10 text-cyber-cyan font-medium"
                      : "border-cyber-rule/40 text-muted-foreground hover:border-cyber-cyan/20"
                  }`}
                >
                  {s.label}
                  {s.kind === "mc" && <span className="ml-1 text-[9px] text-muted-foreground/50">MC</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Section: Counterfactual */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              Counterfactual
            </p>
            <div className="space-y-1">
              {SCENARIOS.filter(s => s.kind === "counterfactual").map(s => (
                <button
                  key={s.key}
                  onClick={() => setScenarioType(s.key)}
                  className={`w-full px-2 py-1.5 text-xs rounded-md border transition-colors text-left ${
                    scenarioType === s.key
                      ? "border-cyber-cyan/30 bg-cyber-cyan/10 text-cyber-cyan font-medium"
                      : "border-cyber-rule/40 text-muted-foreground hover:border-cyber-cyan/20"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {isCounterfactual && (
              <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                Replays a historical fork point. Uses actual portfolio data.
              </p>
            )}
          </div>

          {/* Params */}
          {SCENARIO_PARAMS[scenarioType].length > 0 && (
            <div className="space-y-3">
              {SCENARIO_PARAMS[scenarioType].map(field => (
                <div key={field.key}>
                  <label className="block text-xs text-muted-foreground mb-1">{field.label}</label>
                  {field.type === "text" ? (
                    <input
                      type="text"
                      value={textParams[field.key] ?? ""}
                      placeholder={field.placeholder || "UUID"}
                      onChange={e => setTextParams(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full bg-muted/20 border border-cyber-rule/40 rounded-md px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-cyber-cyan/40 font-mono"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={numParams[field.key] ?? field.defaultValue}
                        min={field.min}
                        max={field.max}
                        step={field.step ?? 1}
                        onChange={e => setNumParams(prev => ({ ...prev, [field.key]: parseFloat(e.target.value) || 0 }))}
                        className="w-full bg-muted/20 border border-cyber-rule/40 rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-cyber-cyan/40"
                      />
                      {field.unit === "%" && <span className="text-xs text-muted-foreground shrink-0">%</span>}
                      {field.unit === "ratio" && <span className="text-xs text-muted-foreground shrink-0">0–1</span>}
                      {field.unit === "months" && <span className="text-xs text-muted-foreground shrink-0">mo</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={runSimulation}
            disabled={loading || !investorId}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-medium bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/30 hover:bg-cyber-cyan/20 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <span className="animate-pulse">{isCounterfactual ? "Computing replay…" : "Running simulation…"}</span>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                {isCounterfactual ? "Replay" : "Run Simulation"}
              </>
            )}
          </button>

          {error && <p className="text-xs text-cyber-red">{error}</p>}

          {history.length > 0 && (
            <div className="border-t border-cyber-rule/30 pt-4 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Recent Runs</p>
              {history.slice(0, 6).map(run => (
                <button
                  key={run.id}
                  onClick={() => setResult(run)}
                  className={`w-full text-left px-2.5 py-2 rounded-md border text-xs transition-colors ${
                    result?.id === run.id
                      ? "border-cyber-cyan/30 bg-cyber-cyan/5 text-foreground"
                      : "border-cyber-rule/30 text-muted-foreground hover:border-cyber-cyan/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{run.scenario_name}</span>
                    {run.is_saved && <Bookmark className="h-3 w-3 text-cyber-cyan shrink-0" />}
                    {run.results?.is_counterfactual && <GitBranch className="h-3 w-3 text-amber-400 shrink-0" />}
                  </div>
                  <span className="text-[10px] text-muted-foreground/60">
                    {new Date(run.computed_at).toLocaleDateString()}
                    {run.results?.is_counterfactual && run.results.elapsed_months
                      ? ` · ${run.results.elapsed_months}m replay`
                      : ` · ${run.horizon_months}m`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </GlowCard>

        {/* Results panel */}
        <div className="lg:col-span-2 space-y-4">
          {!result ? (
            <GlowCard className="p-10 text-center text-muted-foreground text-sm h-full flex items-center justify-center">
              Select a scenario, configure parameters, and click Run or Replay.
            </GlowCard>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    {res?.is_counterfactual && <GitBranch className="h-4 w-4 text-amber-400" />}
                    {result.scenario_name}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {res?.is_counterfactual
                      ? `${res.elapsed_months || "?"}-month historical replay from ${res.reference_date ? new Date(res.reference_date).toLocaleDateString() : "fork point"}`
                      : `${result.horizon_months}-month horizon${res?.is_monte_carlo ? ` · ${res.iterations?.toLocaleString()} MC iterations` : ""}`
                    }
                  </p>
                </div>
                {!result.is_saved ? (
                  <button
                    onClick={() => saveRun(result.id)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-cyber-rule/40 text-muted-foreground hover:border-cyber-cyan/30 hover:text-cyber-cyan transition-colors"
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                    Save
                  </button>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-cyber-cyan">
                    <Bookmark className="h-3.5 w-3.5" />
                    Saved
                  </span>
                )}
              </div>

              {/* Stats */}
              {res && (
                <div className={`grid gap-3 ${res.is_counterfactual ? "grid-cols-2 md:grid-cols-4" : res.is_monte_carlo ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2"}`}>
                  {res.is_counterfactual ? (
                    <>
                      <StatCard
                        label="Counterfactual"
                        value={`${fmt(res.final_p50)} ${currency}`}
                        sub="hypothetical today"
                      />
                      <StatCard
                        label="Actual"
                        value={`${fmt(res.actual_final ?? 0)} ${currency}`}
                        sub="real portfolio today"
                      />
                      <StatCard
                        label="Delta"
                        value={`${(res.delta ?? 0) >= 0 ? "+" : ""}${fmt(res.delta ?? 0)} ${currency}`}
                        sub="counterfactual − actual"
                      />
                      <StatCard
                        label="Delta %"
                        value={`${(res.delta_pct ?? 0) >= 0 ? "+" : ""}${res.delta_pct ?? 0}%`}
                        sub="relative difference"
                      />
                    </>
                  ) : res.is_monte_carlo ? (
                    <>
                      <StatCard label="Optimistic (p90)" value={`${fmt(res.final_p90)} ${currency}`} sub="90th percentile" />
                      <StatCard label="Expected (p50)" value={`${fmt(res.final_p50)} ${currency}`} sub="median outcome" />
                      <StatCard label="Pessimistic (p10)" value={`${fmt(res.final_p10)} ${currency}`} sub="10th percentile" />
                      <StatCard label="Prob. Positive" value={`${((res.probability_positive ?? 0) * 100).toFixed(0)}%`} sub="above start" />
                    </>
                  ) : (
                    <>
                      <StatCard label="Projected Value" value={`${fmt(res.final_p50)} ${currency}`} sub={`after ${result.horizon_months}m`} />
                      <StatCard label="Outcome" value={res.probability_positive === 1.0 ? "Positive" : "Deficit"} sub="final trajectory" />
                    </>
                  )}
                </div>
              )}

              {/* Trajectory chart */}
              {res && (
                <GlowCard className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-foreground">
                      {res.is_counterfactual ? "Counterfactual vs Actual Path" : "Value Trajectory"}
                    </h3>
                    {res.is_counterfactual && (
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-6 border-t-2" style={{ borderColor: scenarioConfig.color }} />
                          Counterfactual
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-6 border-t border-dashed border-gray-500/60" />
                          Actual
                        </span>
                      </div>
                    )}
                    {res.is_monte_carlo && !res.is_counterfactual && (
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-6 border-t-2" style={{ borderColor: scenarioConfig.color }} />
                          p50
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-6 border-t border-dashed border-green-400/60" />
                          p90
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-6 border-t border-dashed border-red-400/60" />
                          p10
                        </span>
                      </div>
                    )}
                  </div>
                  <TrajectoryChart
                    trajectory={res.trajectory}
                    actualTrajectory={res.actual_trajectory}
                    isMonteCarlo={res.is_monte_carlo}
                    isCounterfactual={!!res.is_counterfactual}
                    color={scenarioConfig.color}
                    currency={currency}
                  />
                </GlowCard>
              )}

              {/* Counterfactual explanation + panic sell details */}
              {res?.is_counterfactual && (
                <GlowCard className="p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                    <GitBranch className="h-3.5 w-3.5 text-amber-400" />
                    Replay Analysis
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{res.explanation}</p>
                  {res.panic_tickers && res.panic_tickers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {res.panic_tickers.map(t => (
                        <span key={t} className="px-2 py-0.5 text-xs rounded bg-amber-400/10 text-amber-400 border border-amber-400/20">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {res.total_sold != null && res.estimated_held_value != null && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Sold Value</p>
                        <p className="text-xs font-medium text-foreground">{fmt(res.total_sold)} {currency}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Est. Current Value if Held</p>
                        <p className="text-xs font-medium text-foreground">{fmt(res.estimated_held_value)} {currency}</p>
                      </div>
                    </div>
                  )}
                </GlowCard>
              )}

              {/* Data snapshot */}
              {result.data_snapshot && !res?.is_counterfactual && (
                <GlowCard className="p-4">
                  <h3 className="text-xs font-semibold text-foreground mb-3">Data Snapshot at Run Time</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5">
                    {Object.entries(result.data_snapshot)
                      .filter(([k]) => k !== "currency")
                      .map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                          <span className="text-foreground font-medium tabular-nums">
                            {typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v}
                          </span>
                        </div>
                      ))}
                  </div>
                </GlowCard>
              )}

              {/* Disclaimer */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-400/5 border border-amber-400/15 text-[11px] text-amber-400/80">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400" />
                {result.disclaimer}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
