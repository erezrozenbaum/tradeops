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
import { Plus, Trash2, Target } from "lucide-react";

interface FinancialGoal {
  id: string;
  name: string;
  goal_type: string;
  target_amount: number;
  current_amount: number;
  progress_pct: number;
  target_date: string | null;
  priority: number;
  currency: string;
  risk_suitability: string;
}

const GOAL_TYPE_LABELS: Record<string, string> = {
  emergency_fund: "Emergency Fund",
  house_purchase: "House Purchase",
  retirement: "Retirement",
  child_education: "Child Education",
  debt_reduction: "Debt Reduction",
  wealth_growth: "Wealth Growth",
  passive_income: "Passive Income",
  other: "Other",
};

const RISK_COLORS: Record<string, "success" | "warning" | "danger" | "default"> = {
  low: "success",
  medium: "warning",
  high: "danger",
};

export default function GoalsPage() {
  const investorId = useInvestorId();
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    goal_type: "retirement",
    target_amount: "",
    current_amount: "0",
    target_date: "",
    priority: "1",
    currency: "ILS",
    risk_suitability: "low",
  });

  useEffect(() => {
    if (!investorId) return;
    loadGoals();
  }, [investorId]);

  function loadGoals() {
    fetch(`/api/v1/investors/${investorId}/goals/`)
      .then((r) => r.json())
      .then((data) => {
        setGoals(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  async function createGoal() {
    if (!investorId || !form.name || !form.target_amount) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/goals/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          goal_type: form.goal_type,
          target_amount: parseFloat(form.target_amount),
          current_amount: parseFloat(form.current_amount || "0"),
          target_date: form.target_date || null,
          priority: parseInt(form.priority),
          currency: form.currency,
          risk_suitability: form.risk_suitability,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({
          name: "",
          goal_type: "retirement",
          target_amount: "",
          current_amount: "0",
          target_date: "",
          priority: "1",
          currency: "ILS",
          risk_suitability: "low",
        });
        loadGoals();
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteGoal(goalId: string) {
    if (!confirm("Delete this goal?")) return;
    await fetch(`/api/v1/investors/${investorId}/goals/${goalId}`, { method: "DELETE" });
    loadGoals();
  }

  if (!investorId || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const sortedGoals = [...goals].sort((a, b) => a.priority - b.priority);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Goals & Targets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track progress toward your financial goals
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          New goal
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add Financial Goal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Target amount">
                <Input
                  type="number"
                  placeholder="500000"
                  value={form.target_amount}
                  onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
                />
              </Field>
              <Field label="Current amount">
                <Input
                  type="number"
                  placeholder="0"
                  value={form.current_amount}
                  onChange={(e) => setForm({ ...form, current_amount: e.target.value })}
                />
              </Field>
              <Field label="Target date (optional)">
                <Input
                  type="date"
                  value={form.target_date}
                  onChange={(e) => setForm({ ...form, target_date: e.target.value })}
                />
              </Field>
              <Field label="Currency">
                <Input
                  maxLength={3}
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                />
              </Field>
              <Field label="Priority (1=highest)">
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                />
              </Field>
              <Field label="Risk suitability">
                <Select
                  value={form.risk_suitability}
                  onChange={(e) => setForm({ ...form, risk_suitability: e.target.value })}
                >
                  <option value="low">Low risk</option>
                  <option value="medium">Medium risk</option>
                  <option value="high">High risk</option>
                </Select>
              </Field>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={createGoal} disabled={saving || !form.name || !form.target_amount}>
                {saving ? "Creating…" : "Create goal"}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedGoals.map((goal) => (
          <Card key={goal.id} className="relative">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                      Priority {goal.priority}
                    </span>
                  </div>
                  <p className="text-sm font-semibold leading-tight">{goal.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {GOAL_TYPE_LABELS[goal.goal_type] ?? goal.goal_type}
                  </p>
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
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-semibold text-primary">{goal.progress_pct.toFixed(1)}%</span>
                </div>
                <Progress
                  value={goal.progress_pct}
                  indicatorClassName={
                    goal.progress_pct >= 100
                      ? "bg-green-500"
                      : goal.progress_pct >= 50
                      ? "bg-primary"
                      : "bg-amber-500"
                  }
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatCurrency(goal.current_amount, goal.currency)}</span>
                  <span>{formatCurrency(goal.target_amount, goal.currency)}</span>
                </div>
                {goal.target_date && (
                  <p className="text-xs text-muted-foreground">
                    Target: {new Date(goal.target_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
