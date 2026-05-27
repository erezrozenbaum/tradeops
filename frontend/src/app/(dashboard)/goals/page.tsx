"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import {
  Plus, Trash2, Target, TrendingUp, AlertTriangle, ArrowRight,
  Calendar, DollarSign, Zap, Shield, TrendingDown, Flame,
} from "lucide-react";
import Link from "next/link";
import { MetricTooltip } from "@/components/ui/metric-tooltip";

// ── Types ─────────────────────────────────────────────────────────────────────

interface InvestmentAccount {
  id: string;
  provider_name: string;
  account_name: string | null;
  account_type: string;
  currency: string;
}

interface FinancialGoal {
  id: string;
  name: string;
  goal_type: string;
  tracking_mode: string;
  target_amount: number;
  current_amount: number;
  progress_pct: number;
  target_date: string | null;
  priority: number;
  currency: string;
  risk_suitability: string;
  mode_config: Record<string, unknown> | null;
  linked_account_id: string | null;
  linked_account_name: string | null;
}

interface GoalAnalysis {
  id: string;
  tracking_mode: string;
  amount_remaining: number;
  months_to_target: number | null;
  monthly_contribution_needed: number | null;
  monthly_surplus: number | null;
  gap: number | null;
  on_track: boolean;
  status: string;
  streak_months: number | null;
  income_gap: number | null;
  payoff_months: number | null;
  threshold_type: string | null;
}

interface GoalsAnalysisResult {
  goals: GoalAnalysis[];
  total_monthly_contribution_needed: number;
  monthly_surplus: number | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GOAL_TYPE_LABELS: Record<string, string> = {
  emergency_fund: "Emergency Fund",
  house_purchase: "House Purchase",
  retirement: "Retirement",
  child_education: "Child Education",
  debt_reduction: "Debt Reduction",
  wealth_growth: "Wealth Growth",
  passive_income: "Passive Income",
  custom: "Custom",
};

const TRACKING_MODES = [
  {
    value: "target_by_date",
    label: "Target by Date",
    description: "Reach a savings target by a specific date",
    icon: Calendar,
  },
  {
    value: "monthly_contribution",
    label: "Monthly Contribution",
    description: "Track whether you're hitting your monthly savings target",
    icon: DollarSign,
  },
  {
    value: "monthly_passive_income",
    label: "Monthly Passive Income",
    description: "Build toward a target monthly income from assets",
    icon: Zap,
  },
  {
    value: "balance_threshold",
    label: "Balance Threshold",
    description: "Keep a balance above (or below) a target level",
    icon: Shield,
  },
  {
    value: "debt_reduction",
    label: "Debt Reduction",
    description: "Track progress paying down a debt",
    icon: TrendingDown,
  },
];

const RISK_COLORS: Record<string, "success" | "warning" | "danger" | "default"> = {
  low: "success",
  medium: "warning",
  high: "danger",
};

const STATUS_CONFIG: Record<string, { variant: "success" | "warning" | "danger" | "muted"; label: string }> = {
  complete: { variant: "success", label: "Complete" },
  on_track: { variant: "success", label: "On track" },
  at_risk: { variant: "danger", label: "At risk" },
  no_date: { variant: "muted", label: "No target date" },
};

const EMPTY_FORM = {
  tracking_mode: "target_by_date",
  name: "",
  goal_type: "retirement",
  target_amount: "",
  current_amount: "0",
  target_date: "",
  priority: "1",
  currency: "ILS",
  risk_suitability: "low",
  linked_account_id: "",
  // monthly_contribution
  monthly_target: "",
  current_monthly: "0",
  // monthly_passive_income
  target_monthly_income: "",
  current_monthly_income: "0",
  // balance_threshold
  threshold_type: "min",
  threshold_amount: "",
  current_balance: "0",
  // debt_reduction
  total_debt: "",
  amount_paid: "0",
  monthly_payment: "",
};

type FormState = typeof EMPTY_FORM;

// ── Computed preview ───────────────────────────────────────────────────────────

function computePreview(f: FormState) {
  const mode = f.tracking_mode;
  let target = 0;
  let current = 0;
  let label = "";
  let sub = "";
  let extra: string[] = [];

  if (mode === "target_by_date") {
    target = parseFloat(f.target_amount) || 0;
    current = parseFloat(f.current_amount) || 0;
    label = "Target amount";
    if (f.target_date) {
      const months = Math.max(
        (new Date(f.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44),
        0
      );
      const needed = months > 0 ? (target - current) / months : 0;
      if (needed > 0) extra.push(`${formatCurrencySimple(needed, f.currency)}/mo needed`);
    }
  } else if (mode === "monthly_contribution") {
    target = parseFloat(f.monthly_target) || 0;
    current = parseFloat(f.current_monthly) || 0;
    label = "Monthly target";
    sub = `Currently contributing ${formatCurrencySimple(current, f.currency)}/mo`;
    if (target > 0 && current < target)
      extra.push(`${formatCurrencySimple(target - current, f.currency)}/mo gap`);
  } else if (mode === "monthly_passive_income") {
    target = parseFloat(f.target_monthly_income) || 0;
    current = parseFloat(f.current_monthly_income) || 0;
    label = "Target income/mo";
    sub = `Currently earning ${formatCurrencySimple(current, f.currency)}/mo`;
    if (target > 0 && current < target)
      extra.push(`${formatCurrencySimple(target - current, f.currency)}/mo gap`);
  } else if (mode === "balance_threshold") {
    target = parseFloat(f.threshold_amount) || 0;
    current = parseFloat(f.current_balance) || 0;
    label = f.threshold_type === "min" ? "Minimum balance" : "Maximum balance";
    sub = `Current: ${formatCurrencySimple(current, f.currency)}`;
  } else if (mode === "debt_reduction") {
    target = parseFloat(f.total_debt) || 0;
    current = parseFloat(f.amount_paid) || 0;
    label = "Total debt";
    const remaining = Math.max(target - current, 0);
    sub = `Remaining: ${formatCurrencySimple(remaining, f.currency)}`;
    const mp = parseFloat(f.monthly_payment) || 0;
    if (mp > 0 && remaining > 0)
      extra.push(`Paid off in ~${(remaining / mp).toFixed(0)} months`);
  }

  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  return { target, current, pct, label, sub, extra };
}

function formatCurrencySimple(n: number, currency: string) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildPayload(f: FormState) {
  const base = {
    name: f.name,
    goal_type: f.goal_type,
    priority: parseInt(f.priority),
    currency: f.currency,
    risk_suitability: f.risk_suitability,
    tracking_mode: f.tracking_mode,
    linked_account_id: f.linked_account_id || null,
  };

  if (f.tracking_mode === "target_by_date") {
    return {
      ...base,
      target_amount: parseFloat(f.target_amount),
      current_amount: parseFloat(f.current_amount || "0"),
      target_date: f.target_date || null,
      mode_config: null,
    };
  }
  if (f.tracking_mode === "monthly_contribution") {
    return {
      ...base,
      target_amount: parseFloat(f.monthly_target),
      current_amount: parseFloat(f.current_monthly || "0"),
      target_date: null,
      mode_config: {},
    };
  }
  if (f.tracking_mode === "monthly_passive_income") {
    return {
      ...base,
      target_amount: parseFloat(f.target_monthly_income),
      current_amount: parseFloat(f.current_monthly_income || "0"),
      target_date: null,
      mode_config: {},
    };
  }
  if (f.tracking_mode === "balance_threshold") {
    return {
      ...base,
      target_amount: parseFloat(f.threshold_amount),
      current_amount: parseFloat(f.current_balance || "0"),
      target_date: null,
      mode_config: { threshold_type: f.threshold_type },
    };
  }
  if (f.tracking_mode === "debt_reduction") {
    const total = parseFloat(f.total_debt);
    const paid = parseFloat(f.amount_paid || "0");
    return {
      ...base,
      target_amount: total,
      current_amount: paid,
      target_date: null,
      mode_config: { monthly_payment: parseFloat(f.monthly_payment || "0") },
    };
  }
  return base;
}

function isFormValid(f: FormState): boolean {
  if (!f.name) return false;
  if (f.tracking_mode === "target_by_date") return !!f.target_amount;
  if (f.tracking_mode === "monthly_contribution") return !!f.monthly_target;
  if (f.tracking_mode === "monthly_passive_income") return !!f.target_monthly_income;
  if (f.tracking_mode === "balance_threshold") return !!f.threshold_amount;
  if (f.tracking_mode === "debt_reduction") return !!f.total_debt;
  return false;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const investorId = useInvestorId();
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [analysis, setAnalysis] = useState<GoalsAnalysisResult | null>(null);
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    if (!investorId) return;
    loadData();
    fetch(`/api/v1/investors/${investorId}/accounts`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setAccounts(Array.isArray(d) ? d : []));
  }, [investorId]);

  function loadData() {
    Promise.all([
      fetch(`/api/v1/investors/${investorId}/goals/`).then((r) => r.json()),
      fetch(`/api/v1/investors/${investorId}/goals-analysis`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([goalsData, analysisData]) => {
        setGoals(Array.isArray(goalsData) ? goalsData : []);
        setAnalysis(analysisData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  async function createGoal() {
    if (!investorId || !isFormValid(form)) return;
    setSaving(true);
    try {
      const payload = buildPayload(form);
      const res = await fetch(`/api/v1/investors/${investorId}/goals/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowForm(false);
        setForm(EMPTY_FORM);
        loadData();
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteGoal(goalId: string) {
    if (!confirm("Delete this goal?")) return;
    await fetch(`/api/v1/investors/${investorId}/goals/${goalId}`, { method: "DELETE" });
    loadData();
  }

  if (!investorId || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const sortedGoals = [...goals].sort((a, b) => a.priority - b.priority);
  const analysisMap = new Map<string, GoalAnalysis>(
    (analysis?.goals ?? []).map((g) => [g.id, g])
  );
  const preview = computePreview(form);
  const baseCurrency = goals[0]?.currency ?? "ILS";

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 lg:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Goals & Targets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track progress toward your financial goals
          </p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            New goal
          </Button>
        )}
      </div>

      {/* Monthly summary banner */}
      {analysis && analysis.goals.length > 0 && (
        <div className="flex flex-wrap items-center gap-6 p-4 rounded-lg border border-border bg-muted/40">
          <div>
            <p className="text-xs text-muted-foreground">
              <MetricTooltip content="The sum of monthly contributions required across all active goals. Compare this against your Monthly Surplus — if it exceeds your surplus, you have a funding gap and may need to extend timelines or increase income.">
                Total monthly needed
              </MetricTooltip>
            </p>
            <p className="text-lg font-bold tracking-tight">
              {formatCurrency(analysis.total_monthly_contribution_needed, baseCurrency)}
            </p>
          </div>
          {analysis.monthly_surplus !== null && (
            <>
              <div className="w-px h-8 bg-border" />
              <div>
                <p className="text-xs text-muted-foreground">Monthly surplus</p>
                <p className={`text-lg font-bold tracking-tight ${analysis.monthly_surplus >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {formatCurrency(analysis.monthly_surplus, baseCurrency)}
                </p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div>
                <p className="text-xs text-muted-foreground">Net gap</p>
                <p className={`text-lg font-bold tracking-tight ${analysis.total_monthly_contribution_needed <= analysis.monthly_surplus ? "text-green-600" : "text-red-500"}`}>
                  {analysis.total_monthly_contribution_needed <= analysis.monthly_surplus
                    ? "Covered"
                    : formatCurrency(analysis.total_monthly_contribution_needed - analysis.monthly_surplus, baseCurrency) + " short"}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Monthly Budget Plan */}
      {analysis && analysis.goals.length > 0 && analysis.total_monthly_contribution_needed > 0 && (
        <Card>
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <p className="text-sm font-medium">Monthly Budget Plan</p>
            <span className="text-xs text-muted-foreground">Required allocation per goal</span>
          </div>
          <div className="px-5 py-4 space-y-3">
            {sortedGoals.map(goal => {
              const ga = analysisMap.get(goal.id);
              if (!ga || ga.monthly_contribution_needed === null || ga.monthly_contribution_needed <= 0) return null;
              const share = (ga.monthly_contribution_needed / analysis.total_monthly_contribution_needed) * 100;
              return (
                <div key={goal.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate max-w-[55%]">{goal.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatCurrency(ga.monthly_contribution_needed, goal.currency)}/mo
                      <span className="ml-1.5 text-muted-foreground/60">({share.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${ga.on_track ? "bg-emerald-500" : "bg-amber-500"}`}
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t border-border flex items-center justify-between text-xs font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(analysis.total_monthly_contribution_needed, baseCurrency)}/mo</span>
            </div>
          </div>
        </Card>
      )}

      {/* Create goal form */}
      {showForm && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form panel */}
          <div className="lg:col-span-2">
            <Card className="border-border/60 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Create Financial Goal</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Define your financial target, timeline, and tracking strategy
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Tracking mode selector */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Tracking mode</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {TRACKING_MODES.map((m) => {
                      const Icon = m.icon;
                      const active = form.tracking_mode === m.value;
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setForm({ ...form, tracking_mode: m.value })}
                          className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                            active
                              ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                              : "border-border hover:border-border/80 hover:bg-muted/40"
                          }`}
                        >
                          <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                          <div>
                            <p className={`text-xs font-semibold ${active ? "text-primary" : "text-foreground"}`}>
                              {m.label}
                            </p>
                            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                              {m.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Common fields */}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Goal name">
                    <Input
                      placeholder="e.g. Retirement fund"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </Field>
                  <Field label="Goal type">
                    <Select
                      value={form.goal_type}
                      onChange={(e) => setForm({ ...form, goal_type: e.target.value })}
                    >
                      {Object.entries(GOAL_TYPE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </Select>
                  </Field>
                </div>

                {/* Mode-specific fields */}
                {form.tracking_mode === "target_by_date" && (
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Target amount" hint="Total amount you want to reach">
                      <Input type="number" placeholder="500000" value={form.target_amount}
                        onChange={(e) => setForm({ ...form, target_amount: e.target.value })} />
                    </Field>
                    <Field label="Current amount">
                      <Input type="number" placeholder="0" value={form.current_amount}
                        onChange={(e) => setForm({ ...form, current_amount: e.target.value })} />
                    </Field>
                    <Field label="Target date" hint="When you want to reach this goal">
                      <Input type="date" value={form.target_date}
                        onChange={(e) => setForm({ ...form, target_date: e.target.value })} />
                    </Field>
                  </div>
                )}

                {form.tracking_mode === "monthly_contribution" && (
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Monthly target" hint="Amount to save/invest each month">
                      <Input type="number" placeholder="5000" value={form.monthly_target}
                        onChange={(e) => setForm({ ...form, monthly_target: e.target.value })} />
                    </Field>
                    <Field label="Current monthly contribution">
                      <Input type="number" placeholder="0" value={form.current_monthly}
                        onChange={(e) => setForm({ ...form, current_monthly: e.target.value })} />
                    </Field>
                  </div>
                )}

                {form.tracking_mode === "monthly_passive_income" && (
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Target monthly income" hint="Expected monthly income from assets">
                      <Input type="number" placeholder="10000" value={form.target_monthly_income}
                        onChange={(e) => setForm({ ...form, target_monthly_income: e.target.value })} />
                    </Field>
                    <Field label="Current monthly passive income">
                      <Input type="number" placeholder="0" value={form.current_monthly_income}
                        onChange={(e) => setForm({ ...form, current_monthly_income: e.target.value })} />
                    </Field>
                  </div>
                )}

                {form.tracking_mode === "balance_threshold" && (
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Threshold type">
                      <Select value={form.threshold_type}
                        onChange={(e) => setForm({ ...form, threshold_type: e.target.value })}>
                        <option value="min">Minimum (stay above)</option>
                        <option value="max">Maximum (stay below)</option>
                      </Select>
                    </Field>
                    <Field label="Threshold amount">
                      <Input type="number" placeholder="50000" value={form.threshold_amount}
                        onChange={(e) => setForm({ ...form, threshold_amount: e.target.value })} />
                    </Field>
                    <Field label="Current balance">
                      <Input type="number" placeholder="0" value={form.current_balance}
                        onChange={(e) => setForm({ ...form, current_balance: e.target.value })} />
                    </Field>
                  </div>
                )}

                {form.tracking_mode === "debt_reduction" && (
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Total debt (at start)" hint="Original total debt amount">
                      <Input type="number" placeholder="200000" value={form.total_debt}
                        onChange={(e) => setForm({ ...form, total_debt: e.target.value })} />
                    </Field>
                    <Field label="Amount already paid">
                      <Input type="number" placeholder="0" value={form.amount_paid}
                        onChange={(e) => setForm({ ...form, amount_paid: e.target.value })} />
                    </Field>
                    <Field label="Monthly payment">
                      <Input type="number" placeholder="5000" value={form.monthly_payment}
                        onChange={(e) => setForm({ ...form, monthly_payment: e.target.value })} />
                    </Field>
                  </div>
                )}

                {/* Meta fields */}
                <div className="grid grid-cols-3 gap-4 pt-1 border-t border-border/60">
                  <Field label="Currency">
                    <Input maxLength={3} value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
                  </Field>
                  <Field label="Priority (1=highest)">
                    <Input type="number" min={1} max={10} value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value })} />
                  </Field>
                  <Field label="Risk suitability">
                    <Select value={form.risk_suitability}
                      onChange={(e) => setForm({ ...form, risk_suitability: e.target.value })}>
                      <option value="low">Low risk</option>
                      <option value="medium">Medium risk</option>
                      <option value="high">High risk</option>
                    </Select>
                  </Field>
                </div>

                {/* Linked account — optional, syncs current_amount from account value */}
                {accounts.length > 0 && (
                  <div className="pt-1 border-t border-border/60">
                    <Field
                      label="Link to investment account (optional)"
                      hint="When linked, the goal's current amount is automatically synced from the account's total value"
                    >
                      <Select
                        value={form.linked_account_id}
                        onChange={(e) => setForm({ ...form, linked_account_id: e.target.value })}
                      >
                        <option value="">— No linked account —</option>
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.account_name || acc.provider_name} ({acc.account_type.replace(/_/g, " ")}, {acc.currency})
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <Button onClick={createGoal} disabled={saving || !isFormValid(form)}>
                    {saving ? "Creating…" : "Create Financial Goal"}
                  </Button>
                  <Button variant="outline" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Live preview panel */}
          <div>
            <Card className="border-border/60 shadow-md sticky top-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground font-medium">Live Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-base font-semibold leading-tight">
                    {form.name || <span className="text-muted-foreground italic">Goal name</span>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {GOAL_TYPE_LABELS[form.goal_type]} ·{" "}
                    {TRACKING_MODES.find((m) => m.value === form.tracking_mode)?.label}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold">{preview.pct.toFixed(1)}%</span>
                  </div>
                  <Progress
                    value={preview.pct}
                    indicatorClassName={
                      preview.pct >= 100 ? "bg-green-500" : preview.pct >= 50 ? "bg-primary" : "bg-amber-500"
                    }
                  />
                  {preview.target > 0 && (
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{formatCurrencySimple(preview.current, form.currency)}</span>
                      <span>{preview.label}: {formatCurrencySimple(preview.target, form.currency)}</span>
                    </div>
                  )}
                </div>

                {preview.sub && (
                  <p className="text-xs text-muted-foreground">{preview.sub}</p>
                )}

                {preview.extra.length > 0 && (
                  <div className="space-y-1">
                    {preview.extra.map((line, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        <TrendingUp className="h-3 w-3 text-primary shrink-0" />
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                )}

                {preview.target === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    Fill in the goal details to see a live preview.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Empty state */}
      {sortedGoals.length === 0 && !showForm && (
        <Card>
          <CardContent className="py-16 text-center">
            <Target className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">No goals defined yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Define financial goals to track your progress and get strategy guidance.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Goal cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedGoals.map((goal) => {
          const ga = analysisMap.get(goal.id);
          const statusCfg = ga ? STATUS_CONFIG[ga.status] : null;
          const mode = goal.tracking_mode ?? "target_by_date";
          return (
            <Card key={goal.id} className="relative">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                        Priority {goal.priority}
                      </span>
                      {mode !== "target_by_date" && (
                        <span className="text-[10px] font-medium text-primary/80 bg-primary/8 border border-primary/20 rounded px-1.5 py-0.5">
                          {TRACKING_MODES.find((m) => m.value === mode)?.label ?? mode}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold leading-tight">{goal.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {GOAL_TYPE_LABELS[goal.goal_type] ?? goal.goal_type}
                    </p>
                    {goal.linked_account_name && (
                      <p className="text-[10px] text-primary mt-1 flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        {goal.linked_account_name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={RISK_COLORS[goal.risk_suitability] ?? "default"}>
                      {goal.risk_suitability}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => deleteGoal(goal.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Progress bar */}
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold text-primary">{goal.progress_pct.toFixed(1)}%</span>
                  </div>
                  <Progress
                    value={goal.progress_pct}
                    indicatorClassName={
                      goal.progress_pct >= 100 ? "bg-green-500"
                        : goal.progress_pct >= 50 ? "bg-primary"
                        : "bg-amber-500"
                    }
                  />

                  {/* Mode-specific labels */}
                  <GoalCardMetrics goal={goal} ga={ga} />

                  {/* Analysis section */}
                  {ga && ga.status !== "complete" && (
                    <div className="pt-3 border-t border-border space-y-2">
                      <div className="flex items-center justify-between">
                        {statusCfg && (
                          <Badge variant={statusCfg.variant} className="text-[10px]">
                            {statusCfg.label}
                          </Badge>
                        )}
                        {ga.months_to_target !== null && (
                          <span className="text-xs text-muted-foreground">
                            {ga.months_to_target.toFixed(0)} mo left
                          </span>
                        )}
                        {ga.streak_months !== null && ga.streak_months > 0 && (
                          <span className="flex items-center gap-1 text-xs text-amber-500 font-medium">
                            <Flame className="h-3 w-3" /> {ga.streak_months}mo streak
                          </span>
                        )}
                        {ga.payoff_months !== null && (
                          <span className="text-xs text-muted-foreground">
                            ~{ga.payoff_months.toFixed(0)} mo to payoff
                          </span>
                        )}
                      </div>

                      {/* Monthly requirement */}
                      {ga.monthly_contribution_needed !== null && (
                        <div className="flex items-center gap-1.5 text-xs">
                          {ga.on_track
                            ? <TrendingUp className="h-3 w-3 text-green-500 shrink-0" />
                            : <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />}
                          <span className="text-muted-foreground">
                            <MetricTooltip content={ga.on_track ? "You are contributing enough monthly to reach this goal on time." : "The amount you need to set aside each month to reach this goal by the target date. If this exceeds your surplus, consider extending the target date or increasing your income."}>
                              {mode === "debt_reduction" ? "Payment" : "Needs"}
                            </MetricTooltip>{" "}
                            <span className="font-medium text-foreground">
                              {formatCurrency(ga.monthly_contribution_needed, goal.currency)}/mo
                            </span>
                          </span>
                          {ga.gap !== null && ga.gap > 0 && (
                            <span className="text-red-500 font-medium ml-auto">
                              +{formatCurrency(ga.gap, goal.currency)} short
                            </span>
                          )}
                        </div>
                      )}

                      {/* Income gap for passive income mode */}
                      {ga.income_gap !== null && ga.income_gap > 0 && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Zap className="h-3 w-3 text-amber-500 shrink-0" />
                          <span className="text-muted-foreground">
                            Income gap:{" "}
                            <span className="font-medium text-foreground">
                              {formatCurrency(ga.income_gap, goal.currency)}/mo
                            </span>
                          </span>
                        </div>
                      )}

                      {/* Fund CTA */}
                      {!ga.on_track && ga.monthly_contribution_needed !== null && mode === "target_by_date" && (
                        <div className="pt-2 border-t border-border/60">
                          <Link
                            href="/recommendations"
                            className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                          >
                            View investment recommendations <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      )}
                    </div>
                  )}

                  {ga?.status === "complete" && (
                    <div className="pt-3 border-t border-border">
                      <Badge variant="success" className="text-[10px]">Complete</Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function GoalCardMetrics({ goal, ga }: { goal: FinancialGoal; ga: GoalAnalysis | undefined }) {
  const mode = goal.tracking_mode ?? "target_by_date";
  const cfg = (goal.mode_config ?? {}) as Record<string, unknown>;

  if (mode === "target_by_date") {
    return (
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatCurrency(goal.current_amount, goal.currency)}</span>
        <span>{formatCurrency(goal.target_amount, goal.currency)}</span>
      </div>
    );
  }
  if (mode === "monthly_contribution") {
    return (
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Current: {formatCurrency(goal.current_amount, goal.currency)}/mo</span>
        <span>Target: {formatCurrency(goal.target_amount, goal.currency)}/mo</span>
      </div>
    );
  }
  if (mode === "monthly_passive_income") {
    return (
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Earning: {formatCurrency(goal.current_amount, goal.currency)}/mo</span>
        <span>Goal: {formatCurrency(goal.target_amount, goal.currency)}/mo</span>
      </div>
    );
  }
  if (mode === "balance_threshold") {
    const thresholdType = (cfg.threshold_type as string) ?? "min";
    return (
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Current: {formatCurrency(goal.current_amount, goal.currency)}</span>
        <span>{thresholdType === "min" ? "Min" : "Max"}: {formatCurrency(goal.target_amount, goal.currency)}</span>
      </div>
    );
  }
  if (mode === "debt_reduction") {
    const remaining = Math.max(goal.target_amount - goal.current_amount, 0);
    return (
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Paid: {formatCurrency(goal.current_amount, goal.currency)}</span>
        <span>Remaining: {formatCurrency(remaining, goal.currency)}</span>
      </div>
    );
  }
  return null;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
