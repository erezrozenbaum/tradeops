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
  BookMarked, Plus, BarChart3, History, Wand2, Sparkles,
  Square, CheckSquare, Download,
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

interface OrderTemplateItem { ticker: string | null; name: string; action: string; quantity: number; unit_price: number; currency: string; asset_type: string | null }
interface OrderTemplate {
  id: string;
  name: string;
  description: string | null;
  orders: OrderTemplateItem[];
  times_applied: number;
  last_applied_at: string | null;
  created_at: string;
}

interface OutcomeSnapshot { days: number; snapshot_at: string; portfolio_value: number | null; low_risk_pct: number | null; growth_pct: number | null; high_risk_pct: number | null }
interface OutcomeComparison {
  order_id: string;
  ticker: string | null;
  name: string;
  action: string;
  estimated_value: number;
  currency: string;
  executed_at: string | null;
  projected: ProjectedMetrics | null;
  snapshots: OutcomeSnapshot[];
}

interface SmartSuggestion {
  action: "buy" | "sell";
  asset_type: string;
  ticker: string | null;
  name: string;
  rationale: string;
  estimated_value: number;
  currency: string;
  priority: "high" | "medium" | "low";
  goal_name: string | null;
  tax_note: string | null;
}

interface SmartSuggestResult {
  suggestions: SmartSuggestion[];
  narrative: string;
  generated_at: string;
  has_data: boolean;
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

// ── Smart Allocation Assistant Panel ──────────────────────────────────────────

function priorityChip(priority: string) {
  if (priority === "high") return <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/25 font-semibold uppercase tracking-wide">High</span>;
  if (priority === "medium") return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25 font-semibold uppercase tracking-wide">Med</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-400 border border-slate-500/25 font-semibold uppercase tracking-wide">Low</span>;
}

function SmartAssistPanel({
  result,
  onStage,
  onClose,
  staging,
}: {
  result: SmartSuggestResult;
  onStage: (s: SmartSuggestion) => void;
  onClose: () => void;
  staging: string | null;
}) {
  return (
    <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-violet-300">Smart Allocation Suggestions</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      {result.narrative && (
        <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-violet-500/40 pl-3">
          {result.narrative}
        </p>
      )}

      {result.suggestions.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-3">{result.narrative || "No suggestions available."}</div>
      ) : (
        <div className="space-y-2.5">
          {result.suggestions.map((s, i) => (
            <div key={i} className="rounded-md border border-white/8 bg-white/3 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {actionBadge(s.action)}
                  {s.ticker && <span className="text-sm font-mono font-semibold">{s.ticker}</span>}
                  <span className="text-sm text-muted-foreground">{s.name}</span>
                  {priorityChip(s.priority)}
                </div>
                <button
                  onClick={() => onStage(s)}
                  disabled={staging === `${i}`}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded text-[11px] bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 transition-colors disabled:opacity-50"
                >
                  {staging === `${i}` ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Stage
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{s.rationale}</p>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70">
                <span>Est. {formatCurrency(s.estimated_value, s.currency)}</span>
                {s.goal_name && (
                  <span className="flex items-center gap-1 text-purple-400">
                    <Target className="w-3 h-3" />{s.goal_name}
                  </span>
                )}
                {s.tax_note && (
                  <span className="flex items-center gap-1 text-amber-400">
                    <Leaf className="w-3 h-3" />{s.tax_note}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/50">
        Suggestions are analytical only and do not constitute financial advice. Always review pre-flight analysis before executing.
      </p>
    </div>
  );
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
  selected,
  onToggleSelect,
}: {
  order: StagedOrder;
  onExecute: (id: string) => void;
  onCancel: (id: string) => void;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
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
          : selected
          ? "border-primary/40 bg-primary/5"
          : "border-white/8 bg-white/3"
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        {order.status === "pending" && onToggleSelect && (
          <button
            onClick={() => onToggleSelect(order.id)}
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
          >
            {selected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
          </button>
        )}
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
  const [templates, setTemplates] = useState<OrderTemplate[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeComparison[]>([]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [selectedForTemplate, setSelectedForTemplate] = useState<string[]>([]);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<GenerateResult | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [smartLoading, setSmartLoading] = useState(false);
  const [smartResult, setSmartResult] = useState<SmartSuggestResult | null>(null);
  const [stagingIndex, setStagingIndex] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActing, setBulkActing] = useState(false);

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

  const fetchTemplates = useCallback(async () => {
    if (!investorId) return;
    try {
      const data = await apiFetch<OrderTemplate[]>(`/investors/${investorId}/staged-orders/templates`);
      setTemplates(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
  }, [investorId]);

  const fetchOutcomes = useCallback(async () => {
    if (!investorId) return;
    try {
      const data = await apiFetch<OutcomeComparison[]>(`/investors/${investorId}/staged-orders/outcomes`);
      setOutcomes(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
  }, [investorId]);

  useEffect(() => {
    if (!investorId) return;
    fetchOrders();
    fetchRebalance();
    fetchGoals();
    fetchTemplates();
    fetchOutcomes();
  }, [investorId, fetchOrders, fetchRebalance, fetchGoals, fetchTemplates, fetchOutcomes]);

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

  const handleSmartSuggest = async () => {
    if (!investorId) return;
    setSmartLoading(true);
    setSmartResult(null);
    try {
      const res = await apiFetch<SmartSuggestResult>(
        `/investors/${investorId}/staged-orders/smart-suggest`,
        { method: "POST" },
      );
      setSmartResult(res);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Smart Assist failed");
    } finally {
      setSmartLoading(false);
    }
  };

  const handleStageFromSuggestion = async (s: SmartSuggestion, index: number) => {
    if (!investorId) return;
    setStagingIndex(`${index}`);
    try {
      await apiFetch(`/investors/${investorId}/staged-orders`, {
        method: "POST",
        body: JSON.stringify({
          ticker: s.ticker || null,
          name: s.name,
          action: s.action,
          quantity: 1,
          unit_price: s.estimated_value,
          currency: s.currency,
          asset_type: s.asset_type || null,
          goal_id: null,
          notes: s.rationale,
        }),
      });
      fetchOrders();
      setActiveTab("pending");
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to stage order");
    } finally {
      setStagingIndex(null);
    }
  };

  const handleSaveTemplate = async () => {
    if (!investorId || !templateName.trim()) return;
    const pendingIds = orderList?.orders.filter(o => o.status === "pending").map(o => o.id) ?? [];
    if (pendingIds.length === 0) { setTemplateError("No pending orders to save as template."); return; }
    setSavingTemplate(true);
    setTemplateError(null);
    try {
      await apiFetch(`/investors/${investorId}/staged-orders/templates`, {
        method: "POST",
        body: JSON.stringify({ name: templateName, order_ids: selectedForTemplate.length > 0 ? selectedForTemplate : pendingIds }),
      });
      setTemplateName("");
      setSelectedForTemplate([]);
      fetchTemplates();
    } catch (err: unknown) {
      setTemplateError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleApplyTemplate = async (templateId: string) => {
    if (!investorId) return;
    try {
      await apiFetch(`/investors/${investorId}/staged-orders/templates/${templateId}/apply`, { method: "POST" });
      fetchOrders();
      fetchTemplates();
      setActiveTab("pending");
    } catch (err: unknown) {
      setTemplateError(err instanceof Error ? err.message : "Failed to apply template");
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!investorId) return;
    try {
      await apiFetch(`/investors/${investorId}/staged-orders/templates/${templateId}`, { method: "DELETE" });
      fetchTemplates();
    } catch { /* silent */ }
  };

  const filteredOrders = orderList?.orders.filter(o => o.status === activeTab) ?? [];

  const pendingOrders = filteredOrders.filter(o => o.status === "pending");
  const selectedPending = pendingOrders.filter(o => selectedIds.has(o.id));

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(pendingOrders.map(o => o.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function bulkExecute() {
    if (!investorId || selectedIds.size === 0) return;
    setBulkActing(true);
    try {
      await apiFetch(`/investors/${investorId}/staged-orders/bulk-execute`, {
        method: "POST",
        body: JSON.stringify({ order_ids: Array.from(selectedIds) }),
      });
      clearSelection();
      fetchOrders();
    } catch { /* silent */ } finally {
      setBulkActing(false);
    }
  }

  async function bulkCancel() {
    if (!investorId || selectedIds.size === 0) return;
    setBulkActing(true);
    try {
      await apiFetch(`/investors/${investorId}/staged-orders/bulk-cancel`, {
        method: "POST",
        body: JSON.stringify({ order_ids: Array.from(selectedIds) }),
      });
      clearSelection();
      fetchOrders();
    } catch { /* silent */ } finally {
      setBulkActing(false);
    }
  }

  function exportSelectedCsv() {
    const orders = filteredOrders.filter(o => selectedIds.has(o.id));
    if (orders.length === 0) return;
    const header = "ID,Ticker,Name,Action,Quantity,Unit Price,Estimated Value,Currency,Asset Type,Status,Goal,Notes";
    const rows = orders.map(o =>
      [o.id, o.ticker ?? "", o.name, o.action, o.quantity, o.unit_price, o.estimated_value, o.currency, o.asset_type ?? "", o.status, o.goal_name ?? "", o.notes ?? ""]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Portfolio Surgery
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSmartSuggest}
                    disabled={smartLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/25 transition-colors disabled:opacity-50"
                  >
                    {smartLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    Smart Assist
                  </button>
                  <button
                    onClick={handleGenerateRebalance}
                    disabled={generating}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors disabled:opacity-50"
                  >
                    {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Generate Minimum Orders
                  </button>
                </div>
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

          {/* Smart Allocation Assistant Panel */}
          {smartResult && (
            <SmartAssistPanel
              result={smartResult}
              onStage={(s) => handleStageFromSuggestion(s, smartResult.suggestions.indexOf(s))}
              onClose={() => setSmartResult(null)}
              staging={stagingIndex}
            />
          )}

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

              {/* Bulk action bar — pending tab only */}
              {activeTab === "pending" && pendingOrders.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={selectedIds.size === pendingOrders.length ? clearSelection : selectAll}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {selectedIds.size === pendingOrders.length
                      ? <CheckSquare className="w-3.5 h-3.5" />
                      : <Square className="w-3.5 h-3.5" />}
                    {selectedIds.size === pendingOrders.length ? "Deselect all" : "Select all"}
                  </button>
                  {selectedIds.size > 0 && (
                    <>
                      <span className="text-xs text-primary font-medium">{selectedIds.size} selected</span>
                      <button
                        onClick={bulkExecute}
                        disabled={bulkActing}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-50 transition-colors"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        Execute ({selectedIds.size})
                      </button>
                      <button
                        onClick={bulkCancel}
                        disabled={bulkActing}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 disabled:opacity-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Cancel ({selectedIds.size})
                      </button>
                      <button
                        onClick={exportSelectedCsv}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-muted/40 text-muted-foreground border border-border hover:bg-muted transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export CSV
                      </button>
                    </>
                  )}
                </div>
              )}

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
                      selected={selectedIds.has(order.id)}
                      onToggleSelect={toggleSelect}
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

      {/* ── Template Library ────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <BookMarked className="w-4 h-4 text-purple-400" />
              Template Library
            </h2>
            <div className="flex items-center gap-2">
              <input
                className="px-3 py-1.5 rounded bg-background border border-white/10 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-purple-500/50 w-48"
                placeholder="Template name..."
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
              />
              <button
                onClick={handleSaveTemplate}
                disabled={savingTemplate || !templateName.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition-colors disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                Save pending as template
              </button>
            </div>
          </div>
          {templateError && (
            <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-3 py-2">{templateError}</div>
          )}
          {templates.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              No templates yet. Stage orders, then save them as a reusable template (e.g. "Monthly DCA", "60/40 Rebalance").
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map(tmpl => (
                <div key={tmpl.id} className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm text-foreground">{tmpl.name}</div>
                      {tmpl.description && <div className="text-[11px] text-muted-foreground">{tmpl.description}</div>}
                    </div>
                    <button onClick={() => handleDeleteTemplate(tmpl.id)} className="text-muted-foreground/40 hover:text-rose-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {tmpl.orders.length} order{tmpl.orders.length !== 1 ? "s" : ""} · Applied {tmpl.times_applied}×
                    {tmpl.last_applied_at && ` · Last: ${new Date(tmpl.last_applied_at).toLocaleDateString()}`}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {tmpl.orders.slice(0, 4).map((o, i) => (
                      <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded border ${o.action === "buy" ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-rose-500/30 text-rose-400 bg-rose-500/10"}`}>
                        {o.action.toUpperCase()} {o.ticker || o.name.slice(0, 8)}
                      </span>
                    ))}
                    {tmpl.orders.length > 4 && <span className="text-[10px] text-muted-foreground">+{tmpl.orders.length - 4}</span>}
                  </div>
                  <button
                    onClick={() => handleApplyTemplate(tmpl.id)}
                    className="w-full py-1.5 rounded text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-colors"
                  >
                    Apply Template
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Outcome History ──────────────────────────────────────────────────── */}
      {outcomes.length > 0 && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-amber-400" />
              Outcome Tracking — Projected vs Actual
            </h2>
            <div className="space-y-3">
              {outcomes.map(oc => (
                <div key={oc.order_id} className="rounded-lg border border-white/8 bg-white/3 p-4 space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${oc.action === "buy" ? "border-emerald-500/30 text-emerald-400" : "border-rose-500/30 text-rose-400"}`}>
                      {oc.action.toUpperCase()}
                    </span>
                    {oc.ticker && <span className="font-mono text-sm font-semibold">{oc.ticker}</span>}
                    <span className="text-sm text-muted-foreground">{oc.name}</span>
                    <span className="text-sm font-semibold">{formatCurrency(oc.estimated_value, oc.currency)}</span>
                    {oc.executed_at && (
                      <span className="text-[11px] text-muted-foreground/60 ml-auto">Executed {new Date(oc.executed_at).toLocaleDateString()}</span>
                    )}
                  </div>
                  {oc.projected && (
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      {oc.projected.portfolio_value_base != null && (
                        <div className="rounded bg-white/5 px-2 py-1.5 text-center">
                          <div className="text-muted-foreground">Projected Portfolio</div>
                          <div className="font-semibold">{formatCurrency(oc.projected.portfolio_value_base)}</div>
                        </div>
                      )}
                      {oc.projected.goal_name && oc.projected.goal_progress_pct != null && (
                        <div className="rounded bg-purple-500/10 px-2 py-1.5 text-center col-span-2">
                          <div className="text-muted-foreground">{oc.projected.goal_name}</div>
                          <div className="font-semibold text-purple-300">{oc.projected.goal_progress_pct.toFixed(1)}% projected</div>
                        </div>
                      )}
                    </div>
                  )}
                  {oc.snapshots.length > 0 ? (
                    <div className="flex gap-2 flex-wrap">
                      {oc.snapshots.map((snap, i) => (
                        <div key={i} className="rounded bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-[11px] text-center min-w-[80px]">
                          <div className="text-amber-400 font-semibold">{snap.days}d</div>
                          {snap.portfolio_value != null && (
                            <div className="font-semibold text-foreground">{formatCurrency(snap.portfolio_value)}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground/50 italic">
                      Outcome snapshots will populate at 30d / 90d / 180d after execution.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
