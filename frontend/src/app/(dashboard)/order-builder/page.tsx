"use client";

import { useEffect, useState, useCallback } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import {
  Layers, TrendingUp, TrendingDown, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, AlertTriangle, Zap, ShieldCheck,
  RefreshCw, Trash2, PlayCircle, Info, Target, Leaf,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PreFlightReason { label: string; detail: string }
interface PreFlightReview {
  reasons_to_proceed: PreFlightReason[];
  risks: PreFlightReason[];
  alternative: string | null;
  verdict: "proceed" | "caution" | "reconsider";
}
interface ProjectedMetrics {
  portfolio_value_base: number | null;
  low_risk_pct: number | null;
  growth_pct: number | null;
  high_risk_pct: number | null;
  goal_progress_pct: number | null;
  goal_name: string | null;
}

interface StagedOrder {
  id: string;
  ticker: string | null;
  name: string;
  action: "buy" | "sell";
  quantity: number;
  unit_price: number;
  currency: string;
  estimated_value: number;
  asset_type: string | null;
  status: "pending" | "executed" | "cancelled";
  goal_id: string | null;
  goal_name: string | null;
  tax_note: string | null;
  pre_flight_review: PreFlightReview | null;
  projected_metrics: ProjectedMetrics | null;
  executed_at: string | null;
  notes: string | null;
  created_at: string;
}

interface OrderList {
  investor_id: string;
  pending_count: number;
  executed_count: number;
  cancelled_count: number;
  orders: StagedOrder[];
}

interface RebalanceTier {
  tier: string;
  label: string;
  target_pct: number;
  actual_pct: number;
  delta_pct: number;
  action: string;
  gap_amount: number | null;
}

interface RebalanceResult {
  tiers: RebalanceTier[];
  total_portfolio_value: number | null;
  currency: string | null;
  notes: string[];
}

interface FinancialGoal {
  id: string;
  name: string;
  goal_type: string;
  target_amount: number;
  current_amount: number;
  progress_pct: number;
  currency: string;
}

interface GenerateResult {
  orders_generated: number;
  total_buy_value: number;
  total_sell_value: number;
  net_value: number;
  currency: string;
  notes: string[];
}

// ── API base ───────────────────────────────────────────────────────────────────

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const ASSET_TYPES = [
  { value: "stock", label: "Stock" },
  { value: "etf", label: "ETF" },
  { value: "bond", label: "Bond" },
  { value: "fund", label: "Fund" },
  { value: "crypto", label: "Crypto" },
  { value: "real_estate", label: "Real Estate" },
  { value: "other", label: "Other" },
];

function actionBadge(action: string) {
  return action === "buy" ? (
    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 uppercase text-[10px] tracking-wider px-2 py-0.5">
      <TrendingUp className="w-3 h-3 mr-1" />BUY
    </Badge>
  ) : (
    <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 uppercase text-[10px] tracking-wider px-2 py-0.5">
      <TrendingDown className="w-3 h-3 mr-1" />SELL
    </Badge>
  );
}

function verdictIcon(verdict: string) {
  if (verdict === "proceed") return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
  if (verdict === "caution") return <AlertTriangle className="w-4 h-4 text-amber-400" />;
  return <XCircle className="w-4 h-4 text-rose-400" />;
}

function verdictColor(verdict: string) {
  if (verdict === "proceed") return "border-emerald-500/30 bg-emerald-500/5";
  if (verdict === "caution") return "border-amber-500/30 bg-amber-500/5";
  return "border-rose-500/30 bg-rose-500/5";
}

function tierColor(tier: string) {
  if (tier === "low_risk") return { bar: "bg-blue-500", delta: "text-blue-400" };
  if (tier === "growth") return { bar: "bg-emerald-500", delta: "text-emerald-400" };
  return { bar: "bg-rose-500", delta: "text-rose-400" };
}

// ── Portfolio Surgery Panel ────────────────────────────────────────────────────

function TierAllocationBar({ tier, onGenerate }: { tier: RebalanceTier; onGenerate: () => void }) {
  const max = Math.max(tier.actual_pct, tier.target_pct, 1);
  const colors = tierColor(tier.tier);
  const overweight = tier.actual_pct > tier.target_pct;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{tier.label}</span>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Target {tier.target_pct.toFixed(0)}%</span>
          <span className={`font-semibold ${colors.delta}`}>
            {overweight ? "▲" : "▼"} {Math.abs(tier.delta_pct).toFixed(1)}%
          </span>
        </div>
      </div>
      {/* Actual bar */}
      <div className="relative h-5 rounded bg-muted/30 overflow-hidden">
        <div
          className={`h-full rounded transition-all ${colors.bar} opacity-80`}
          style={{ width: `${(tier.actual_pct / max) * 100}%` }}
        />
        {/* Target marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/50"
          style={{ left: `${(tier.target_pct / max) * 100}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Actual: <strong className="text-foreground">{tier.actual_pct.toFixed(1)}%</strong></span>
        {tier.gap_amount != null && Math.abs(tier.gap_amount) > 1 && (
          <span>Gap: {formatCurrency(Math.abs(tier.gap_amount))}</span>
        )}
      </div>
    </div>
  );
}

// ── Order Card ─────────────────────────────────────────────────────────────────

function OrderCard({
  order,
  onExecute,
  onCancel,
}: {
  order: StagedOrder;
  onExecute: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const review = order.pre_flight_review;
  const proj = order.projected_metrics;

  return (
    <div
      className={`rounded-lg border p-4 space-y-3 ${
        order.status === "executed"
          ? "border-emerald-500/20 bg-emerald-500/5"
          : order.status === "cancelled"
          ? "border-muted/30 bg-muted/5 opacity-60"
          : "border-white/8 bg-white/3"
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {actionBadge(order.action)}
            {order.ticker && (
              <span className="text-sm font-mono font-semibold text-foreground">{order.ticker}</span>
            )}
            <span className="text-sm text-muted-foreground truncate">{order.name}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span>{order.quantity.toLocaleString()} units @ {formatCurrency(order.unit_price, order.currency)}</span>
            <span className="font-semibold text-foreground">= {formatCurrency(order.estimated_value, order.currency)}</span>
            {order.asset_type && <span className="text-muted-foreground/60">{order.asset_type}</span>}
          </div>
        </div>
        {/* Pre-flight verdict chip */}
        {review && order.status === "pending" && (
          <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] border ${verdictColor(review.verdict)}`}>
            {verdictIcon(review.verdict)}
            <span className="capitalize">{review.verdict}</span>
          </div>
        )}
        {order.status === "executed" && (
          <div className="flex items-center gap-1 text-emerald-400 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Executed
          </div>
        )}
      </div>

      {/* Goal + tax chips */}
      {(order.goal_name || order.tax_note) && (
        <div className="flex flex-wrap gap-2">
          {order.goal_name && (
            <div className="flex items-center gap-1 text-[11px] text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded px-2 py-0.5">
              <Target className="w-3 h-3" />
              {order.goal_name}
            </div>
          )}
          {order.tax_note && (
            <div className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5 max-w-xs truncate">
              <Leaf className="w-3 h-3 shrink-0" />
              <span className="truncate">{order.tax_note.split("|")[0].trim()}</span>
            </div>
          )}
        </div>
      )}

      {/* Projected metrics strip */}
      {proj && order.status === "pending" && (
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          {proj.portfolio_value_base != null && (
            <div className="rounded bg-white/5 px-2 py-1 text-center">
              <div className="text-muted-foreground">Portfolio</div>
              <div className="font-semibold text-foreground">{formatCurrency(proj.portfolio_value_base)}</div>
            </div>
          )}
          {proj.goal_progress_pct != null && proj.goal_name && (
            <div className="rounded bg-purple-500/10 px-2 py-1 text-center col-span-2">
              <div className="text-muted-foreground truncate">{proj.goal_name}</div>
              <div className="font-semibold text-purple-300">{proj.goal_progress_pct.toFixed(1)}% funded</div>
            </div>
          )}
        </div>
      )}

      {/* Expand/collapse pre-flight review */}
      {review && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-between text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          <span className="flex items-center gap-1">
            <Info className="w-3 h-3" />
            Pre-flight review
          </span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      )}
      {expanded && review && (
        <div className={`rounded-lg border p-3 space-y-2 text-xs ${verdictColor(review.verdict)}`}>
          {review.reasons_to_proceed.length > 0 && (
            <div className="space-y-1">
              <div className="text-emerald-400 font-semibold text-[10px] uppercase tracking-wide">Why proceed</div>
              {review.reasons_to_proceed.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                  <span><strong className="text-foreground">{r.label}:</strong> {r.detail}</span>
                </div>
              ))}
            </div>
          )}
          {review.risks.length > 0 && (
            <div className="space-y-1">
              <div className="text-rose-400 font-semibold text-[10px] uppercase tracking-wide">Risks</div>
              {review.risks.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                  <span><strong className="text-foreground">{r.label}:</strong> {r.detail}</span>
                </div>
              ))}
            </div>
          )}
          {review.alternative && (
            <div className="text-muted-foreground italic">{review.alternative}</div>
          )}
        </div>
      )}

      {/* Actions */}
      {order.status === "pending" && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onExecute(order.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            Mark Executed
          </button>
          <button
            onClick={() => onCancel(order.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Cancel
          </button>
        </div>
      )}
      {order.status === "executed" && order.executed_at && (
        <div className="text-[11px] text-muted-foreground/60">
          Executed {new Date(order.executed_at).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function OrderBuilderPage() {
  const investorId = useInvestorId();

  // Data state
  const [orderList, setOrderList] = useState<OrderList | null>(null);
  const [rebalance, setRebalance] = useState<RebalanceResult | null>(null);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [activeTab, setActiveTab] = useState<"pending" | "executed" | "cancelled">("pending");
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<GenerateResult | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Create form state
  const [form, setForm] = useState({
    ticker: "",
    name: "",
    action: "buy",
    quantity: "",
    unit_price: "",
    currency: "ILS",
    asset_type: "etf",
    goal_id: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!investorId) return;
    setLoadingOrders(true);
    try {
      const data = await apiFetch<OrderList>(`/investors/${investorId}/staged-orders`);
      setOrderList(data);
    } catch {
      // silent
    } finally {
      setLoadingOrders(false);
    }
  }, [investorId]);

  const fetchRebalance = useCallback(async () => {
    if (!investorId) return;
    try {
      const data = await apiFetch<RebalanceResult>(`/investors/${investorId}/portfolio/rebalance`);
      setRebalance(data);
    } catch {
      // silent
    }
  }, [investorId]);

  const fetchGoals = useCallback(async () => {
    if (!investorId) return;
    try {
      const data = await apiFetch<FinancialGoal[]>(`/investors/${investorId}/goals`);
      setGoals(Array.isArray(data) ? data : []);
    } catch {
      // silent
    }
  }, [investorId]);

  useEffect(() => {
    if (!investorId) return;
    fetchOrders();
    fetchRebalance();
    fetchGoals();
  }, [investorId, fetchOrders, fetchRebalance, fetchGoals]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!investorId) return;
    setFormError(null);
    if (!form.name.trim() || !form.quantity || !form.unit_price) {
      setFormError("Name, quantity and unit price are required.");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch(`/investors/${investorId}/staged-orders`, {
        method: "POST",
        body: JSON.stringify({
          ticker: form.ticker.trim() || null,
          name: form.name.trim(),
          action: form.action,
          quantity: parseFloat(form.quantity),
          unit_price: parseFloat(form.unit_price),
          currency: form.currency,
          asset_type: form.asset_type || null,
          goal_id: form.goal_id || null,
          notes: form.notes.trim() || null,
        }),
      });
      setForm({ ticker: "", name: "", action: "buy", quantity: "", unit_price: "", currency: "ILS", asset_type: "etf", goal_id: "", notes: "" });
      fetchOrders();
      setActiveTab("pending");
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecute = async (id: string) => {
    if (!investorId) return;
    setActionError(null);
    try {
      await apiFetch(`/investors/${investorId}/staged-orders/${id}/execute`, { method: "POST" });
      fetchOrders();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to execute order");
    }
  };

  const handleCancel = async (id: string) => {
    if (!investorId) return;
    setActionError(null);
    try {
      await apiFetch(`/investors/${investorId}/staged-orders/${id}`, { method: "DELETE" });
      fetchOrders();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to cancel order");
    }
  };

  const handleGenerateRebalance = async () => {
    if (!investorId) return;
    setGenerating(true);
    setGenResult(null);
    setActionError(null);
    try {
      const res = await apiFetch<GenerateResult & { orders: StagedOrder[] }>(
        `/investors/${investorId}/staged-orders/generate-rebalance`,
        { method: "POST" },
      );
      setGenResult(res);
      fetchOrders();
      setActiveTab("pending");
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to generate rebalance orders");
    } finally {
      setGenerating(false);
    }
  };

  const filteredOrders = orderList?.orders.filter(o => o.status === activeTab) ?? [];

  const TAB_COUNTS: Record<string, number> = {
    pending: orderList?.pending_count ?? 0,
    executed: orderList?.executed_count ?? 0,
    cancelled: orderList?.cancelled_count ?? 0,
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Order Builder
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Stage, review, and track allocation orders with pre-flight analysis and tax optimization.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── Left: Portfolio Surgery + Create Form ────────────────────────── */}
        <div className="space-y-4">
          {/* Portfolio Surgery */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Portfolio Surgery
                </h2>
                <button
                  onClick={handleGenerateRebalance}
                  disabled={generating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors disabled:opacity-50"
                >
                  {generating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  Generate Minimum Orders
                </button>
              </div>

              {rebalance ? (
                <div className="space-y-4">
                  {rebalance.tiers.map(tier => (
                    <TierAllocationBar key={tier.tier} tier={tier} onGenerate={handleGenerateRebalance} />
                  ))}
                  {rebalance.total_portfolio_value != null && (
                    <div className="text-[11px] text-muted-foreground pt-1 border-t border-white/5">
                      Tradeable portfolio: <strong className="text-foreground">{formatCurrency(rebalance.total_portfolio_value, rebalance.currency ?? "ILS")}</strong>
                      <span className="ml-2 text-muted-foreground/50">White line = target allocation</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  No portfolio data — add holdings and generate a risk model to see allocation analysis.
                </div>
              )}

              {genResult && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs space-y-1">
                  <div className="font-semibold text-primary">
                    Generated {genResult.orders_generated} order{genResult.orders_generated !== 1 ? "s" : ""}
                  </div>
                  <div className="flex gap-4 text-muted-foreground">
                    <span>Buy: {formatCurrency(genResult.total_buy_value, genResult.currency)}</span>
                    <span>Sell: {formatCurrency(genResult.total_sell_value, genResult.currency)}</span>
                    <span>Net: {formatCurrency(Math.abs(genResult.net_value), genResult.currency)}</span>
                  </div>
                  {genResult.notes.slice(0, 1).map((n, i) => (
                    <div key={i} className="text-muted-foreground/70">{n}</div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Create Order Form */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Stage an Order
              </h2>
              <form onSubmit={handleCreate} className="space-y-3">
                {/* Action toggle */}
                <div className="flex rounded-lg overflow-hidden border border-white/10 text-sm">
                  {(["buy", "sell"] as const).map(a => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, action: a }))}
                      className={`flex-1 py-2 font-medium transition-colors ${
                        form.action === a
                          ? a === "buy"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-rose-500/20 text-rose-400"
                          : "text-muted-foreground hover:text-foreground bg-transparent"
                      }`}
                    >
                      {a === "buy" ? "BUY" : "SELL"}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Ticker</label>
                    <input
                      className="w-full px-3 py-2 rounded bg-background border border-white/10 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                      placeholder="e.g. AAPL"
                      value={form.ticker}
                      onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Asset type</label>
                    <select
                      className="w-full px-3 py-2 rounded bg-background border border-white/10 text-sm focus:outline-none focus:border-primary/50"
                      value={form.asset_type}
                      onChange={e => setForm(f => ({ ...f, asset_type: e.target.value }))}
                    >
                      {ASSET_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Name *</label>
                  <input
                    className="w-full px-3 py-2 rounded bg-background border border-white/10 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                    placeholder="e.g. Apple Inc."
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Quantity *</label>
                    <input
                      type="number"
                      min="0.0001"
                      step="any"
                      className="w-full px-3 py-2 rounded bg-background border border-white/10 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                      placeholder="0"
                      value={form.quantity}
                      onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Unit price *</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="w-full px-3 py-2 rounded bg-background border border-white/10 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                      placeholder="0.00"
                      value={form.unit_price}
                      onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Currency</label>
                    <input
                      className="w-full px-3 py-2 rounded bg-background border border-white/10 text-sm uppercase placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
                      placeholder="ILS"
                      maxLength={3}
                      value={form.currency}
                      onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Target className="w-3 h-3" /> Link to Goal
                    </label>
                    <select
                      className="w-full px-3 py-2 rounded bg-background border border-white/10 text-sm focus:outline-none focus:border-primary/50"
                      value={form.goal_id}
                      onChange={e => setForm(f => ({ ...f, goal_id: e.target.value }))}
                    >
                      <option value="">— None —</option>
                      {goals.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Estimated value preview */}
                {form.quantity && form.unit_price && (
                  <div className="rounded bg-white/5 px-3 py-2 text-sm flex items-center justify-between">
                    <span className="text-muted-foreground">Estimated value</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(parseFloat(form.quantity) * parseFloat(form.unit_price), form.currency)}
                    </span>
                  </div>
                )}

                {formError && (
                  <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-3 py-2">
                    {formError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded text-sm font-medium bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors disabled:opacity-50"
                >
                  {submitting ? "Staging..." : "Stage Order + Pre-flight Review"}
                </button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* ── Right: Order Queue ────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card className="h-full">
            <CardContent className="p-5 space-y-4 h-full flex flex-col">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  Order Queue
                </h2>
                {loadingOrders && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>

              {actionError && (
                <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-3 py-2">
                  {actionError}
                </div>
              )}

              {/* Tabs */}
              <div className="flex gap-1 border-b border-white/8 pb-0">
                {(["pending", "executed", "cancelled"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-2 text-xs font-medium capitalize transition-colors relative ${
                      activeTab === tab
                        ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:rounded-t"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab}
                    {TAB_COUNTS[tab] > 0 && (
                      <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                        tab === "pending" ? "bg-primary/20 text-primary" : "bg-muted/30 text-muted-foreground"
                      }`}>
                        {TAB_COUNTS[tab]}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Order list */}
              <div className="flex-1 overflow-y-auto space-y-3 min-h-0 max-h-[600px] pr-1">
                {filteredOrders.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    {activeTab === "pending"
                      ? "No pending orders. Stage an order or generate minimum rebalance."
                      : `No ${activeTab} orders.`}
                  </div>
                ) : (
                  filteredOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onExecute={handleExecute}
                      onCancel={handleCancel}
                    />
                  ))
                )}
              </div>

              {/* Summary strip */}
              {orderList && orderList.pending_count > 0 && activeTab === "pending" && (
                <div className="pt-3 border-t border-white/5 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded bg-emerald-500/10 px-3 py-2 text-center">
                    <div className="text-muted-foreground">Total Buy</div>
                    <div className="font-semibold text-emerald-400">
                      {formatCurrency(
                        filteredOrders.filter(o => o.action === "buy").reduce((s, o) => s + o.estimated_value, 0),
                        filteredOrders[0]?.currency ?? "ILS",
                      )}
                    </div>
                  </div>
                  <div className="rounded bg-rose-500/10 px-3 py-2 text-center">
                    <div className="text-muted-foreground">Total Sell</div>
                    <div className="font-semibold text-rose-400">
                      {formatCurrency(
                        filteredOrders.filter(o => o.action === "sell").reduce((s, o) => s + o.estimated_value, 0),
                        filteredOrders[0]?.currency ?? "ILS",
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
