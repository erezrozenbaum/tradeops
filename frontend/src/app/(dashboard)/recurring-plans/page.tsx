"use client";

import { useEffect, useState, useCallback } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  Plus,
  Trash2,
  Play,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Edit2,
  X,
  Clock,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlanAllocation {
  ticker?: string | null;
  name: string;
  asset_type: string;
  amount: number;
  currency: string;
  goal_id?: string | null;
}

interface RecurringPlan {
  id: string;
  name: string;
  frequency: string;
  day_of_month: number | null;
  allocations: PlanAllocation[];
  is_active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
  total_monthly_amount: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const ASSET_TYPE_COLORS: Record<string, string> = {
  stock: "bg-blue-500/10 text-blue-500",
  etf: "bg-cyan-500/10 text-cyan-500",
  bond: "bg-green-500/10 text-green-500",
  fund: "bg-teal-500/10 text-teal-500",
  crypto: "bg-amber-500/10 text-amber-500",
  real_estate: "bg-purple-500/10 text-purple-500",
};

interface PlanSaveData {
  name: string;
  frequency: string;
  day_of_month: number;
  allocations: PlanAllocation[];
}

// ── Allocation row editor ─────────────────────────────────────────────────────

interface AllocRowProps {
  alloc: PlanAllocation;
  onChange: (a: PlanAllocation) => void;
  onRemove: () => void;
}

function AllocRow({ alloc, onChange, onRemove }: AllocRowProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        className="w-20 rounded border border-cyber-rule/60 bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-cyber-cyan/50"
        placeholder="Ticker"
        value={alloc.ticker ?? ""}
        onChange={e => onChange({ ...alloc, ticker: e.target.value.toUpperCase() || null })}
      />
      <input
        className="flex-1 min-w-[120px] rounded border border-cyber-rule/60 bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-cyber-cyan/50"
        placeholder="Name *"
        value={alloc.name}
        onChange={e => onChange({ ...alloc, name: e.target.value })}
        required
      />
      <select
        className="rounded border border-cyber-rule/60 bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-cyber-cyan/50"
        value={alloc.asset_type}
        onChange={e => onChange({ ...alloc, asset_type: e.target.value })}
      >
        {["stock", "etf", "bond", "fund", "crypto", "real_estate"].map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <input
        type="number"
        min="0"
        step="any"
        className="w-24 rounded border border-cyber-rule/60 bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-cyber-cyan/50"
        placeholder="Amount"
        value={alloc.amount || ""}
        onChange={e => onChange({ ...alloc, amount: parseFloat(e.target.value) || 0 })}
      />
      <input
        className="w-14 rounded border border-cyber-rule/60 bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-cyber-cyan/50"
        placeholder="USD"
        maxLength={5}
        value={alloc.currency}
        onChange={e => onChange({ ...alloc, currency: e.target.value.toUpperCase() })}
      />
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground/50 hover:text-red-500 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Create/Edit form ──────────────────────────────────────────────────────────

const EMPTY_ALLOC: PlanAllocation = { ticker: null, name: "", asset_type: "stock", amount: 0, currency: "USD" };

function PlanForm({ onSave, onCancel, initial }: {
  onSave: (data: PlanSaveData) => void;
  onCancel: () => void;
  initial?: Partial<RecurringPlan>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [frequency, setFrequency] = useState(initial?.frequency ?? "monthly");
  const [dayOfMonth, setDayOfMonth] = useState(initial?.day_of_month ?? 1);
  const [allocations, setAllocations] = useState<PlanAllocation[]>(
    initial?.allocations?.length ? initial.allocations : [{ ...EMPTY_ALLOC }]
  );
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Plan name is required"); return; }
    if (allocations.some(a => !a.name.trim() || a.amount <= 0)) {
      setError("Every allocation needs a name and amount > 0");
      return;
    }
    setError(null);
    onSave({ name: name.trim(), frequency, day_of_month: dayOfMonth, allocations });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground mb-1 block">Plan name *</label>
          <input
            className="w-full rounded-md border border-cyber-rule/60 bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-cyber-cyan/50"
            placeholder="Monthly DCA"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Frequency</label>
          <select
            className="w-full rounded-md border border-cyber-rule/60 bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-cyber-cyan/50"
            value={frequency}
            onChange={e => setFrequency(e.target.value)}
          >
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
      </div>

      {frequency === "monthly" && (
        <div className="w-40">
          <label className="text-xs text-muted-foreground mb-1 block">Day of month</label>
          <input
            type="number"
            min={1}
            max={28}
            className="w-full rounded-md border border-cyber-rule/60 bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-cyber-cyan/50"
            value={dayOfMonth}
            onChange={e => setDayOfMonth(parseInt(e.target.value) || 1)}
          />
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-muted-foreground">Allocations *</label>
          <button
            type="button"
            onClick={() => setAllocations(prev => [...prev, { ...EMPTY_ALLOC }])}
            className="flex items-center gap-1 text-xs text-cyber-cyan hover:text-cyber-cyan/80"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        <div className="space-y-2 text-xs text-muted-foreground mb-1 hidden sm:flex gap-2">
          <span className="w-20">Ticker</span>
          <span className="flex-1 min-w-[120px]">Name</span>
          <span className="w-24">Type</span>
          <span className="w-24">Amount</span>
          <span className="w-14">CCY</span>
          <span className="w-4" />
        </div>
        <div className="space-y-2">
          {allocations.map((a, i) => (
            <AllocRow
              key={i}
              alloc={a}
              onChange={updated => setAllocations(prev => prev.map((x, j) => j === i ? updated : x))}
              onRemove={() => setAllocations(prev => prev.filter((_, j) => j !== i))}
            />
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="px-4 py-1.5 rounded-md text-sm bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/30 hover:bg-cyber-cyan/20 transition-colors"
        >
          Save Plan
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 rounded-md text-sm border border-cyber-rule/60 text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RecurringPlansPage() {
  const investorId = useInvestorId();
  const [plans, setPlans] = useState<RecurringPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    if (!investorId) return;
    setLoading(true);
    fetch(`/api/v1/investors/${investorId}/recurring-plans`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setPlans(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [investorId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(data: PlanSaveData) {
    const res = await fetch(`/api/v1/investors/${investorId}/recurring-plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setShowCreate(false); load(); }
  }

  async function handleUpdate(planId: string, data: PlanSaveData) {
    const res = await fetch(`/api/v1/investors/${investorId}/recurring-plans/${planId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setEditingId(null); load(); }
  }

  async function handleToggleActive(plan: RecurringPlan) {
    await fetch(`/api/v1/investors/${investorId}/recurring-plans/${plan.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !plan.is_active }),
    });
    load();
  }

  async function handleDelete(planId: string) {
    setDeletingId(planId);
    await fetch(`/api/v1/investors/${investorId}/recurring-plans/${planId}`, { method: "DELETE" });
    setPlans(prev => prev.filter(p => p.id !== planId));
    setDeletingId(null);
  }

  async function handleRunNow(plan: RecurringPlan) {
    setRunningId(plan.id);
    const res = await fetch(`/api/v1/investors/${investorId}/recurring-plans/${plan.id}/run-now`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setRunResult(prev => ({ ...prev, [plan.id]: data.message }));
      load();
      setTimeout(() => setRunResult(prev => { const n = { ...prev }; delete n[plan.id]; return n; }), 5000);
    }
    setRunningId(null);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Recurring Investment Plans</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Auto-stage buy orders on a monthly or weekly schedule (SIP)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-cyber-rule/40 transition-colors border border-cyber-rule/60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          {!showCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/30 hover:bg-cyber-cyan/20 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New Plan
            </button>
          )}
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="border-cyber-cyan/20">
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-cyber-cyan" />
              New Recurring Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <PlanForm onSave={handleCreate} onCancel={() => setShowCreate(false)} />
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && !plans.length && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading plans…
        </div>
      )}

      {/* Empty state */}
      {!loading && plans.length === 0 && !showCreate && (
        <Card>
          <CardContent className="py-14 text-center">
            <CalendarClock className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
            <p className="font-semibold">No recurring plans yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Set up a monthly or weekly plan to automatically stage buy orders — great for dollar-cost averaging.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/30 hover:bg-cyber-cyan/20 transition-colors mx-auto"
            >
              <Plus className="h-3.5 w-3.5" />
              Create first plan
            </button>
          </CardContent>
        </Card>
      )}

      {/* Plans list */}
      {plans.length > 0 && (
        <div className="space-y-4">
          {plans.map(plan => (
            <Card key={plan.id} className={plan.is_active ? "border-cyber-cyan/10" : "opacity-60"}>
              {editingId === plan.id ? (
                <CardContent className="pt-4">
                  <PlanForm
                    initial={plan}
                    onSave={data => handleUpdate(plan.id, data)}
                    onCancel={() => setEditingId(null)}
                  />
                </CardContent>
              ) : (
                <CardContent className="pt-4 pb-4">
                  {/* Plan header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{plan.name}</p>
                        <Badge className={`text-[10px] px-1.5 py-0 border ${plan.is_active ? "bg-green-500/10 text-green-600 border-green-200" : "bg-zinc-500/10 text-zinc-400 border-zinc-600"}`}>
                          {plan.is_active ? "Active" : "Paused"}
                        </Badge>
                        <Badge className="text-[10px] px-1.5 py-0 border bg-blue-500/10 text-blue-500 border-blue-300/30">
                          {plan.frequency === "monthly"
                            ? `${ordinal(plan.day_of_month ?? 1)} of month`
                            : "Weekly"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {plan.allocations.length} allocation{plan.allocations.length !== 1 ? "s" : ""} ·{" "}
                        Total {plan.total_monthly_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} {plan.allocations[0]?.currency ?? ""}
                        {plan.frequency === "monthly" ? "/mo" : "/wk"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleRunNow(plan)}
                        disabled={runningId === plan.id}
                        title="Stage orders now"
                        className="p-1.5 rounded text-muted-foreground/60 hover:text-cyber-cyan hover:bg-cyber-cyan/10 transition-colors"
                      >
                        {runningId === plan.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Play className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => setEditingId(plan.id)}
                        title="Edit plan"
                        className="p-1.5 rounded text-muted-foreground/60 hover:text-foreground hover:bg-cyber-rule/40 transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(plan)}
                        title={plan.is_active ? "Pause" : "Resume"}
                        className="p-1.5 rounded text-muted-foreground/60 hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                      >
                        {plan.is_active
                          ? <Clock className="h-3.5 w-3.5" />
                          : <CheckCircle2 className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => handleDelete(plan.id)}
                        disabled={deletingId === plan.id}
                        title="Delete plan"
                        className="p-1.5 rounded text-muted-foreground/60 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        {deletingId === plan.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Run result toast */}
                  {runResult[plan.id] && (
                    <p className="text-xs text-green-500 mb-2">{runResult[plan.id]}</p>
                  )}

                  {/* Allocations */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {plan.allocations.map((a, i) => (
                      <div key={i} className="flex items-center gap-1.5 rounded bg-cyber-rule/40 px-2 py-1 text-xs">
                        <Badge className={`text-[9px] px-1 py-0 border-0 ${ASSET_TYPE_COLORS[a.asset_type] ?? "bg-zinc-500/10 text-zinc-400"}`}>
                          {a.asset_type}
                        </Badge>
                        {a.ticker && <span className="font-medium">{a.ticker}</span>}
                        <span className="text-muted-foreground">{a.name}</span>
                        <span className="font-medium">{a.currency} {a.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  {/* Schedule info */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {plan.next_run_at && (
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" />
                        Next: <span className="text-foreground">{fmtDate(plan.next_run_at)}</span>
                      </span>
                    )}
                    {plan.last_run_at && (
                      <span>Last: {fmtDate(plan.last_run_at)}</span>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground/50 pt-2">
        Orders are staged automatically — review them in the <a href="/order-builder" className="underline hover:text-muted-foreground">Order Builder</a> before executing. The system never executes trades automatically.
      </p>
    </div>
  );
}
