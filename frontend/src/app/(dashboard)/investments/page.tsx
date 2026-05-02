"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { Plus, Trash2, Edit2, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight, Briefcase, RefreshCw, Scale, CheckCircle2, XCircle } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────────────────

interface FamilyMember {
  id: string;
  name: string;
  relationship_type: string;
}

interface Holding {
  id: string;
  account_id: string;
  ticker: string | null;
  isin: string | null;
  name: string;
  asset_type: string;
  quantity: number;
  avg_buy_price: number;
  currency: string;
  fees: number;
  purchase_date: string | null;
  current_value: number | null;
  notes: string | null;
  current_balance: number | null;
  total_deposits: number | null;
  monthly_contribution: number | null;
  annual_return_rate: number | null;
  monthly_contribution_employee: number | null;
  monthly_contribution_employer: number | null;
  fund_status: string | null;
}

interface Account {
  id: string;
  provider_name: string;
  account_type: string;
  account_name: string | null;
  currency: string;
  notes: string | null;
  family_member_id: string | null;
  holdings: Holding[];
}

interface HoldingAnalysis {
  id: string;
  name: string;
  ticker: string | null;
  asset_type: string;
  cost_basis: number;
  current_value_local: number;
  current_value_base: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  pnl_after_tax: number;
  currency: string;
  price_source: string;
  live_price: number | null;
  live_price_currency: string | null;
}

interface AccountAnalysis {
  id: string;
  provider_name: string;
  account_type: string;
  account_name: string | null;
  total_cost_basis: number;
  total_current_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  pnl_after_tax: number;
  holdings: HoldingAnalysis[];
}

interface PortfolioSummary {
  base_currency: string;
  total_cost_basis: number;
  total_current_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  pnl_after_tax: number;
  pnl_after_tax_pct: number;
  fx_rates: Record<string, number>;
  asset_allocation: Record<string, number>;
  currency_exposure: Record<string, number>;
  accounts: AccountAnalysis[];
}

interface PortfolioSnapshotPoint {
  snapshot_at: string;
  total_value: number;
  cost_basis: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  currency: string;
}

interface PriceRefreshResult {
  portfolio: PortfolioSummary;
  tickers_refreshed: string[];
  tickers_failed: string[];
  cache_valid_until: string;
}

interface PensionSimResult {
  holding_id: string;
  fund_name: string;
  asset_type: string;
  currency: string;
  current_balance: number;
  current_age: number;
  retirement_age: number;
  years_to_retirement: number;
  monthly_contribution: number;
  annual_return_rate: number;
  withdrawal_years: number;
  projected_balance: number;
  projected_from_current_balance: number;
  projected_from_contributions: number;
  total_contributions_added: number;
  total_gains: number;
  monthly_pension_estimate: number;
  fund_status: string | null;
  tax_status: string | null;
  tax_exemption_date: string | null;
  years_until_tax_free: number | null;
  monthly_contribution_employee: number | null;
  monthly_contribution_employer: number | null;
}

interface RebalanceTier {
  tier: string;
  label: string;
  target_pct: number;
  actual_pct: number;
  delta_pct: number;
  action: string;
  asset_types: string[];
  target_amount: number | null;
  actual_amount: number | null;
  gap_amount: number | null;
}

interface RebalanceResult {
  rebalance_needed: boolean;
  tiers: RebalanceTier[];
  notes: string[];
  total_portfolio_value: number | null;
  currency: string | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = [
  { value: "pension", label: "Pension" },
  { value: "keren_hishtalmut", label: "Keren Hishtalmut" },
  { value: "brokerage", label: "Brokerage" },
  { value: "crypto", label: "Crypto" },
  { value: "etf_fund", label: "ETF / Fund" },
  { value: "bank", label: "Bank" },
  { value: "other", label: "Other" },
];

const ASSET_TYPES = [
  { value: "stock", label: "Stock" },
  { value: "bond", label: "Bond" },
  { value: "etf", label: "ETF" },
  { value: "crypto", label: "Crypto" },
  { value: "fund", label: "Fund" },
  { value: "pension_fund", label: "Pension Fund" },
  { value: "study_fund", label: "Study Fund (כה\"ת)" },
  { value: "real_estate", label: "Real Estate" },
  { value: "other", label: "Other" },
];

const EMPTY_ACCOUNT = { provider_name: "", account_type: "brokerage", account_name: "", currency: "ILS", notes: "", family_member_id: "" };
const EMPTY_HOLDING = { ticker: "", isin: "", name: "", asset_type: "stock", quantity: "", avg_buy_price: "", currency: "ILS", fees: "", purchase_date: "", current_value: "", notes: "", current_balance: "", total_deposits: "", monthly_contribution: "", annual_return_rate: "", monthly_contribution_employee: "", monthly_contribution_employer: "", fund_status: "active" };

// ── Helpers ──────────────────────────────────────────────────────────────────

const ALLOC_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899"];

function isPensionAccount(accountType: string) {
  return accountType === "pension";
}

function isStudyFundAccount(accountType: string) {
  return accountType === "keren_hishtalmut";
}

function studyFundTaxStatus(purchaseDate: string | null): { status: "Tax-Free" | "Locked" | null; yearsLeft: number | null } {
  if (!purchaseDate) return { status: null, yearsLeft: null };
  const start = new Date(purchaseDate);
  const exempt = new Date(start.getFullYear() + 6, start.getMonth(), start.getDate());
  const now = new Date();
  if (now >= exempt) return { status: "Tax-Free", yearsLeft: 0 };
  const yearsLeft = Math.round(((exempt.getTime() - now.getTime()) / (365.25 * 24 * 3600 * 1000)) * 10) / 10;
  return { status: "Locked", yearsLeft };
}

function ilsEquiv(amount: number, fxRates: Record<string, number>, baseCurrency: string): string | null {
  if (baseCurrency === "ILS") return null;
  const rate = fxRates["ILS"];
  if (!rate || rate <= 0) return null;
  return formatCurrency(amount / rate, "ILS");
}

function AllocationDonut({ allocation }: { allocation: Record<string, number> }) {
  const data = Object.entries(allocation).map(([name, value]) => ({ name, value }));
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Asset allocation</p>
        <div className="flex items-center gap-3">
          <PieChart width={80} height={80}>
            <Pie data={data} cx={35} cy={35} innerRadius={22} outerRadius={36} dataKey="value" stroke="none">
              {data.map((_, i) => <Cell key={i} fill={ALLOC_COLORS[i % ALLOC_COLORS.length]} />)}
            </Pie>
          </PieChart>
          <div className="space-y-1 min-w-0">
            {data.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: ALLOC_COLORS[i % ALLOC_COLORS.length] }} />
                <span className="text-muted-foreground capitalize truncate">{d.name}</span>
                <span className="font-medium ml-auto">{d.value.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PnlBadge({ pnl, pct }: { pnl: number; pct: number }) {
  if (pnl > 0) return <span className="flex items-center gap-1 text-green-600 text-sm font-medium"><TrendingUp className="h-3.5 w-3.5" />+{formatPercent(pct / 100)}</span>;
  if (pnl < 0) return <span className="flex items-center gap-1 text-red-500 text-sm font-medium"><TrendingDown className="h-3.5 w-3.5" />{formatPercent(pct / 100)}</span>;
  return <span className="flex items-center gap-1 text-muted-foreground text-sm"><Minus className="h-3.5 w-3.5" />0%</span>;
}

function accountTypeLabel(v: string) { return ACCOUNT_TYPES.find(t => t.value === v)?.label ?? v; }
function assetTypeLabel(v: string) { return ASSET_TYPES.find(t => t.value === v)?.label ?? v; }

// ── Page ─────────────────────────────────────────────────────────────────────

export default function InvestmentsPage() {
  const investorId = useInvestorId();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [rebalance, setRebalance] = useState<RebalanceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

  // Account form
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT);
  const [savingAccount, setSavingAccount] = useState(false);

  // Holding form — add
  const [addingHoldingForAccount, setAddingHoldingForAccount] = useState<string | null>(null);
  const [holdingForm, setHoldingForm] = useState(EMPTY_HOLDING);
  const [savingHolding, setSavingHolding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<PriceRefreshResult | null>(null);
  const [history, setHistory] = useState<PortfolioSnapshotPoint[]>([]);

  // Holding form — edit
  const [editingHolding, setEditingHolding] = useState<{ accountId: string; holdingId: string } | null>(null);
  const [editHoldingForm, setEditHoldingForm] = useState(EMPTY_HOLDING);
  const [savingEditHolding, setSavingEditHolding] = useState(false);

  // Pension simulation
  const [simulatingHoldingId, setSimulatingHoldingId] = useState<string | null>(null);
  const [simParams, setSimParams] = useState({ retirement_age: 67, monthly_contribution: 0, annual_return_rate: 5.0, withdrawal_years: 25 });
  const [simResult, setSimResult] = useState<PensionSimResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  // CSV import
  const [csvImportResult, setCsvImportResult] = useState<{ accountId: string; imported: number; errors: string[] } | null>(null);

  useEffect(() => {
    if (!investorId) return;
    loadAll();
  }, [investorId]);

  async function loadAll() {
    setLoading(true);
    const [accts, port, reb, hist, families] = await Promise.all([
      fetch(`/api/v1/investors/${investorId}/accounts`).then(r => r.ok ? r.json() : []),
      fetch(`/api/v1/investors/${investorId}/portfolio`).then(r => r.ok ? r.json() : null),
      fetch(`/api/v1/investors/${investorId}/portfolio/rebalance`).then(r => r.ok ? r.json() : null),
      fetch(`/api/v1/investors/${investorId}/portfolio/history`).then(r => r.ok ? r.json() : null),
      fetch(`/api/v1/family-profiles?investor_id=${investorId}`).then(r => r.ok ? r.json() : []),
    ]);
    setAccounts(accts);
    setPortfolio(port);
    setRebalance(reb);
    setHistory(hist?.snapshots ?? []);
    const members: FamilyMember[] = (families as { members: FamilyMember[] }[]).flatMap(f => f.members ?? []);
    setFamilyMembers(members);
    setLoading(false);
  }

  function toggleAccount(id: string) {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function createAccount() {
    setSavingAccount(true);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_name: accountForm.provider_name,
          account_type: accountForm.account_type,
          account_name: accountForm.account_name || null,
          currency: accountForm.currency,
          notes: accountForm.notes || null,
          family_member_id: accountForm.family_member_id || null,
        }),
      });
      if (res.ok) {
        setShowAccountForm(false);
        setAccountForm(EMPTY_ACCOUNT);
        loadAll();
      }
    } finally {
      setSavingAccount(false);
    }
  }

  async function deleteAccount(accountId: string) {
    if (!confirm("Delete this account and all its holdings?")) return;
    await fetch(`/api/v1/investors/${investorId}/accounts/${accountId}`, { method: "DELETE" });
    loadAll();
  }

  async function addHolding(accountId: string) {
    setSavingHolding(true);
    try {
      const acct = accounts.find(a => a.id === accountId);
      const pension = isPensionAccount(acct?.account_type ?? "");
      const studyFund = isStudyFundAccount(acct?.account_type ?? "");
      const body = studyFund
        ? {
            name: holdingForm.name,
            asset_type: "study_fund",
            quantity: 0,
            avg_buy_price: 0,
            currency: holdingForm.currency,
            fees: 0,
            purchase_date: holdingForm.purchase_date || null,
            current_balance: holdingForm.current_balance ? parseFloat(holdingForm.current_balance) : null,
            total_deposits: holdingForm.total_deposits ? parseFloat(holdingForm.total_deposits) : null,
            monthly_contribution_employee: holdingForm.monthly_contribution_employee ? parseFloat(holdingForm.monthly_contribution_employee) : null,
            monthly_contribution_employer: holdingForm.monthly_contribution_employer ? parseFloat(holdingForm.monthly_contribution_employer) : null,
            annual_return_rate: holdingForm.annual_return_rate ? parseFloat(holdingForm.annual_return_rate) : null,
            fund_status: holdingForm.fund_status || "active",
            notes: holdingForm.notes || null,
          }
        : pension
        ? {
            name: holdingForm.name,
            asset_type: "pension_fund",
            quantity: 0,
            avg_buy_price: 0,
            currency: holdingForm.currency,
            fees: 0,
            purchase_date: holdingForm.purchase_date || null,
            current_balance: holdingForm.current_balance ? parseFloat(holdingForm.current_balance) : null,
            total_deposits: holdingForm.total_deposits ? parseFloat(holdingForm.total_deposits) : null,
            monthly_contribution: holdingForm.monthly_contribution ? parseFloat(holdingForm.monthly_contribution) : null,
            annual_return_rate: holdingForm.annual_return_rate ? parseFloat(holdingForm.annual_return_rate) : null,
            notes: holdingForm.notes || null,
          }
        : {
            ticker: holdingForm.ticker || null,
            isin: holdingForm.isin || null,
            name: holdingForm.name,
            asset_type: holdingForm.asset_type,
            quantity: parseFloat(holdingForm.quantity),
            avg_buy_price: parseFloat(holdingForm.avg_buy_price),
            currency: holdingForm.currency,
            fees: holdingForm.fees ? parseFloat(holdingForm.fees) : 0,
            purchase_date: holdingForm.purchase_date || null,
            current_value: holdingForm.current_value
              ? parseFloat(holdingForm.current_value) * (parseFloat(holdingForm.quantity) || 1)
              : null,
            notes: holdingForm.notes || null,
          };
      const res = await fetch(`/api/v1/investors/${investorId}/accounts/${accountId}/holdings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setAddingHoldingForAccount(null);
        setHoldingForm(EMPTY_HOLDING);
        loadAll();
      }
    } finally {
      setSavingHolding(false);
    }
  }

  async function refreshPrices() {
    setRefreshing(true);
    setRefreshResult(null);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/portfolio/refresh-prices`, { method: "POST" });
      if (res.ok) {
        const result: PriceRefreshResult = await res.json();
        setPortfolio(result.portfolio);
        setRefreshResult(result);
        setHistory(prev => {
          const snap: PortfolioSnapshotPoint = {
            snapshot_at: new Date().toISOString(),
            total_value: result.portfolio.total_current_value,
            cost_basis: result.portfolio.total_cost_basis,
            unrealized_pnl: result.portfolio.unrealized_pnl,
            unrealized_pnl_pct: result.portfolio.unrealized_pnl_pct,
            currency: result.portfolio.base_currency,
          };
          return [...prev, snap];
        });
        const reb = await fetch(`/api/v1/investors/${investorId}/portfolio/rebalance`).then(r => r.ok ? r.json() : null);
        setRebalance(reb);
      }
    } finally {
      setRefreshing(false);
    }
  }

  function startEditHolding(accountId: string, h: Holding) {
    setEditingHolding({ accountId, holdingId: h.id });
    setEditHoldingForm({
      ticker: h.ticker ?? "",
      isin: h.isin ?? "",
      name: h.name,
      asset_type: h.asset_type,
      quantity: String(h.quantity),
      avg_buy_price: String(h.avg_buy_price),
      currency: h.currency,
      fees: String(h.fees),
      purchase_date: h.purchase_date ?? "",
      current_value: h.current_value != null && h.quantity > 0 ? String((h.current_value / h.quantity).toFixed(4)) : "",
      notes: h.notes ?? "",
      current_balance: h.current_balance != null ? String(h.current_balance) : "",
      total_deposits: h.total_deposits != null ? String(h.total_deposits) : "",
      monthly_contribution: h.monthly_contribution != null ? String(h.monthly_contribution) : "",
      annual_return_rate: h.annual_return_rate != null ? String(h.annual_return_rate) : "",
      monthly_contribution_employee: h.monthly_contribution_employee != null ? String(h.monthly_contribution_employee) : "",
      monthly_contribution_employer: h.monthly_contribution_employer != null ? String(h.monthly_contribution_employer) : "",
      fund_status: h.fund_status ?? "active",
    });
    setExpandedAccounts(prev => { const s = new Set(prev); s.add(accountId); return s; });
  }

  async function updateHolding(accountId: string, holdingId: string) {
    setSavingEditHolding(true);
    try {
      const acct = accounts.find(a => a.id === accountId);
      const pension = isPensionAccount(acct?.account_type ?? "");
      const studyFund = isStudyFundAccount(acct?.account_type ?? "");
      // Also detect by holding's own asset_type for cross-account editing
      const holdingIsStudyFund = editHoldingForm.asset_type === "study_fund";
      const holdingIsPension = editHoldingForm.asset_type === "pension_fund";
      const body = (studyFund || holdingIsStudyFund)
        ? {
            name: editHoldingForm.name || undefined,
            asset_type: "study_fund",
            quantity: 0,
            avg_buy_price: 0,
            currency: editHoldingForm.currency || undefined,
            fees: 0,
            purchase_date: editHoldingForm.purchase_date || null,
            current_balance: editHoldingForm.current_balance ? parseFloat(editHoldingForm.current_balance) : null,
            total_deposits: editHoldingForm.total_deposits ? parseFloat(editHoldingForm.total_deposits) : null,
            monthly_contribution_employee: editHoldingForm.monthly_contribution_employee ? parseFloat(editHoldingForm.monthly_contribution_employee) : null,
            monthly_contribution_employer: editHoldingForm.monthly_contribution_employer ? parseFloat(editHoldingForm.monthly_contribution_employer) : null,
            annual_return_rate: editHoldingForm.annual_return_rate ? parseFloat(editHoldingForm.annual_return_rate) : null,
            fund_status: editHoldingForm.fund_status || "active",
            notes: editHoldingForm.notes || null,
          }
        : (pension || holdingIsPension)
        ? {
            name: editHoldingForm.name || undefined,
            asset_type: "pension_fund",
            quantity: 0,
            avg_buy_price: 0,
            currency: editHoldingForm.currency || undefined,
            fees: 0,
            purchase_date: editHoldingForm.purchase_date || null,
            current_balance: editHoldingForm.current_balance ? parseFloat(editHoldingForm.current_balance) : null,
            total_deposits: editHoldingForm.total_deposits ? parseFloat(editHoldingForm.total_deposits) : null,
            monthly_contribution: editHoldingForm.monthly_contribution ? parseFloat(editHoldingForm.monthly_contribution) : null,
            annual_return_rate: editHoldingForm.annual_return_rate ? parseFloat(editHoldingForm.annual_return_rate) : null,
            notes: editHoldingForm.notes || null,
          }
        : {
            ticker: editHoldingForm.ticker || null,
            isin: editHoldingForm.isin || null,
            name: editHoldingForm.name || undefined,
            asset_type: editHoldingForm.asset_type || undefined,
            quantity: parseFloat(editHoldingForm.quantity) || undefined,
            avg_buy_price: parseFloat(editHoldingForm.avg_buy_price) || undefined,
            currency: editHoldingForm.currency || undefined,
            fees: editHoldingForm.fees ? parseFloat(editHoldingForm.fees) : 0,
            purchase_date: editHoldingForm.purchase_date || null,
            current_value: editHoldingForm.current_value
              ? parseFloat(editHoldingForm.current_value) * (parseFloat(editHoldingForm.quantity) || 1)
              : null,
            notes: editHoldingForm.notes || null,
          };
      const res = await fetch(
        `/api/v1/investors/${investorId}/accounts/${accountId}/holdings/${holdingId}`,
        { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );
      if (res.ok) {
        setEditingHolding(null);
        setEditHoldingForm(EMPTY_HOLDING);
        loadAll();
      }
    } finally {
      setSavingEditHolding(false);
    }
  }

  async function deleteHolding(accountId: string, holdingId: string) {
    if (!confirm("Remove this holding?")) return;
    await fetch(`/api/v1/investors/${investorId}/accounts/${accountId}/holdings/${holdingId}`, { method: "DELETE" });
    loadAll();
  }

  async function importCsvForAccount(accountId: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(
      `/api/v1/investors/${investorId}/accounts/${accountId}/holdings/import-csv`,
      { method: "POST", body: form }
    );
    const data = await res.json();
    setCsvImportResult({ accountId, imported: data.imported, errors: data.errors ?? [] });
    if (data.imported > 0) loadAll();
  }

  async function openSimulation(h: Holding) {
    const defaultContrib = h.asset_type === "study_fund"
      ? (h.monthly_contribution_employee ?? 0) + (h.monthly_contribution_employer ?? 0)
      : (h.monthly_contribution ?? 0);
    const params = {
      retirement_age: simParams.retirement_age,
      monthly_contribution: defaultContrib,
      annual_return_rate: h.annual_return_rate ?? 5.0,
      withdrawal_years: simParams.withdrawal_years,
    };
    setSimParams(params);
    setSimulatingHoldingId(h.id);
    setSimResult(null);
    await runSimulation(h.id, params);
  }

  async function runSimulation(holdingId: string, params: typeof simParams) {
    setSimLoading(true);
    try {
      const qs = new URLSearchParams({
        holding_id: holdingId,
        retirement_age: String(params.retirement_age),
        monthly_contribution: String(params.monthly_contribution),
        annual_return_rate: String(params.annual_return_rate),
        withdrawal_years: String(params.withdrawal_years),
      });
      const res = await fetch(`/api/v1/investors/${investorId}/pension-simulation?${qs}`);
      if (res.ok) setSimResult(await res.json());
    } finally {
      setSimLoading(false);
    }
  }

  if (!investorId || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const currency = portfolio?.base_currency ?? "ILS";

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Investments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track your existing holdings across all accounts</p>
        </div>
        <div className="flex gap-2">
          {accounts.length > 0 && (
            <Button variant="outline" onClick={refreshPrices} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing…" : "Refresh prices"}
            </Button>
          )}
          <Button onClick={() => setShowAccountForm(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add account
          </Button>
        </div>
      </div>

      {/* Portfolio summary */}
      {portfolio && (portfolio.total_current_value > 0 || accounts.length > 0) && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total value</p>
                <p className="text-xl font-semibold">{formatCurrency(portfolio.total_current_value, currency)}</p>
                {ilsEquiv(portfolio.total_current_value, portfolio.fx_rates, currency) && (
                  <p className="text-sm text-muted-foreground tabular-nums">≈ {ilsEquiv(portfolio.total_current_value, portfolio.fx_rates, currency)}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">All values in {currency}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Cost basis</p>
                <p className="text-xl font-semibold">{formatCurrency(portfolio.total_cost_basis, currency)}</p>
                {ilsEquiv(portfolio.total_cost_basis, portfolio.fx_rates, currency) && (
                  <p className="text-sm text-muted-foreground tabular-nums">≈ {ilsEquiv(portfolio.total_cost_basis, portfolio.fx_rates, currency)}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Unrealized P&L</p>
                <p className={`text-xl font-semibold ${portfolio.unrealized_pnl >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {portfolio.unrealized_pnl >= 0 ? "+" : ""}{formatCurrency(portfolio.unrealized_pnl, currency)}
                </p>
                {ilsEquiv(portfolio.unrealized_pnl, portfolio.fx_rates, currency) && (
                  <p className={`text-sm tabular-nums ${portfolio.unrealized_pnl >= 0 ? "text-green-600/70" : "text-red-500/70"}`}>
                    ≈ {ilsEquiv(portfolio.unrealized_pnl, portfolio.fx_rates, currency)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {portfolio.unrealized_pnl_pct >= 0 ? "+" : ""}{portfolio.unrealized_pnl_pct.toFixed(2)}%
                </p>
                <div className="mt-2 pt-2 border-t border-border/60">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">After 25% tax</p>
                  <p className={`text-sm font-semibold ${portfolio.pnl_after_tax >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {portfolio.pnl_after_tax >= 0 ? "+" : ""}{formatCurrency(portfolio.pnl_after_tax, currency)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {portfolio.pnl_after_tax_pct >= 0 ? "+" : ""}{portfolio.pnl_after_tax_pct.toFixed(2)}%
                  </p>
                </div>
              </CardContent>
            </Card>
            <AllocationDonut allocation={portfolio.asset_allocation} />
          </div>

          {/* FX rate banner */}
          {Object.keys(portfolio.fx_rates).length > 0 && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2.5 rounded-lg border border-border bg-muted/30 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Exchange rates → {currency}</span>
              {Object.entries(portfolio.fx_rates).map(([c, rate]) => (
                <span key={c}>
                  1 <span className="font-medium text-foreground">{c}</span> = <span className="font-medium text-foreground tabular-nums">{rate.toFixed(4)}</span> {currency}
                  {rate === 1 && <span className="ml-1 text-amber-500">(fallback — check network)</span>}
                </span>
              ))}
            </div>
          )}

          {/* Refresh feedback */}
          {refreshResult && (
            <div className="flex flex-wrap items-center gap-4 px-4 py-3 rounded-lg border border-border bg-muted/40 text-sm">
              {refreshResult.tickers_refreshed.length > 0 && (
                <span className="flex items-center gap-1.5 text-green-600">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Refreshed: <span className="font-medium">{refreshResult.tickers_refreshed.join(", ")}</span>
                </span>
              )}
              {refreshResult.tickers_failed.length > 0 && (
                <span className="flex items-center gap-1.5 text-amber-600">
                  <XCircle className="h-4 w-4 shrink-0" />
                  Unavailable: <span className="font-medium">{refreshResult.tickers_failed.join(", ")}</span>
                </span>
              )}
              <span className="text-muted-foreground ml-auto text-xs">
                Cache valid until {new Date(refreshResult.cache_valid_until).toLocaleString()}
              </span>
            </div>
          )}

          {/* Portfolio history chart */}
          {history.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Portfolio value history</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={history} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="snapshot_at"
                      tickFormatter={v => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tickFormatter={v => formatCurrency(v, currency, true)}
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={72}
                    />
                    <ReTooltip
                      formatter={(v: number) => [formatCurrency(v, currency), "Value"]}
                      labelFormatter={v => new Date(v).toLocaleString()}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total_value"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fill="url(#portfolioGrad)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Rebalancing guide */}
      {rebalance && rebalance.tiers.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-4 w-4" />
                Rebalancing Guide
              </CardTitle>
              {rebalance.rebalance_needed ? (
                <Badge variant="warning">Rebalance needed</Badge>
              ) : (
                <Badge variant="success">Balanced</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {rebalance.tiers.map((tier) => {
                const delta = tier.delta_pct;
                const actionColor =
                  tier.action === "reduce"
                    ? "text-amber-500"
                    : tier.action === "buy_more"
                    ? "text-blue-500"
                    : "text-muted-foreground";
                const actionLabel =
                  tier.action === "reduce"
                    ? "Reduce"
                    : tier.action === "buy_more"
                    ? "Buy more"
                    : "Hold";
                return (
                  <div key={tier.tier} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{tier.label}</span>
                      <span className={`text-xs font-semibold ${actionColor}`}>{actionLabel}</span>
                    </div>
                    <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`absolute left-0 top-0 h-full rounded-full transition-all ${
                          tier.action === "reduce" ? "bg-amber-500" :
                          tier.action === "buy_more" ? "bg-blue-500" : "bg-green-500"
                        }`}
                        style={{ width: `${Math.min(tier.actual_pct, 100)}%` }}
                      />
                      <div
                        className="absolute top-0 h-full w-0.5 bg-foreground/40"
                        style={{ left: `${Math.min(tier.target_pct, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Actual: <span className="font-medium text-foreground">{tier.actual_pct.toFixed(1)}%</span></span>
                      <span>Target: <span className="font-medium text-foreground">{tier.target_pct.toFixed(1)}%</span></span>
                    </div>
                    {delta !== 0 && (
                      <p className={`text-xs font-medium ${delta > 0 ? "text-amber-500" : "text-blue-500"}`}>
                        {delta > 0 ? "+" : ""}{delta.toFixed(1)}% vs target
                        {tier.gap_amount != null && (
                          <span className="ml-1 text-muted-foreground font-normal">
                            ({tier.gap_amount > 0 ? "−" : "+"}{formatCurrency(Math.abs(tier.gap_amount), rebalance.currency ?? "USD")})
                          </span>
                        )}
                      </p>
                    )}
                    {tier.gap_amount != null && tier.action !== "hold" && (
                      <p className="text-[10px] text-muted-foreground">
                        {tier.action === "reduce"
                          ? `Sell ~${formatCurrency(Math.abs(tier.gap_amount), rebalance.currency ?? "USD")}`
                          : `Buy ~${formatCurrency(Math.abs(tier.gap_amount), rebalance.currency ?? "USD")}`}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {tier.asset_types.join(", ")}
                    </p>
                  </div>
                );
              })}
            </div>
            {rebalance.notes.map((note, i) => (
              <p key={i} className="text-xs text-muted-foreground border-t border-border pt-3">
                {note}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Add account form */}
      {showAccountForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New investment account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Provider</label>
                <Input
                  placeholder="e.g. Meitav, IBI, Interactive Brokers"
                  value={accountForm.provider_name}
                  onChange={e => setAccountForm({ ...accountForm, provider_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Account type</label>
                <Select value={accountForm.account_type} onChange={e => setAccountForm({ ...accountForm, account_type: e.target.value })}>
                  {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Display name (optional)</label>
                <Input
                  placeholder="e.g. My pension fund"
                  value={accountForm.account_name}
                  onChange={e => setAccountForm({ ...accountForm, account_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Currency</label>
                <Input
                  placeholder="ILS"
                  maxLength={3}
                  value={accountForm.currency}
                  onChange={e => setAccountForm({ ...accountForm, currency: e.target.value.toUpperCase() })}
                />
              </div>
              {familyMembers.length > 0 && (
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Belongs to (optional)</label>
                  <Select
                    value={accountForm.family_member_id}
                    onChange={e => setAccountForm({ ...accountForm, family_member_id: e.target.value })}
                  >
                    <option value="">— Household / shared —</option>
                    {familyMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.relationship_type})</option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={createAccount} disabled={!accountForm.provider_name || savingAccount}>
                {savingAccount ? "Saving…" : "Create account"}
              </Button>
              <Button variant="outline" onClick={() => { setShowAccountForm(false); setAccountForm(EMPTY_ACCOUNT); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {accounts.length === 0 && !showAccountForm && (
        <Card>
          <CardContent className="py-16 text-center">
            <Briefcase className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">No investment accounts yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-5">
              Add your existing accounts to track your portfolio performance.
            </p>
            <Button onClick={() => setShowAccountForm(true)}>Add account</Button>
          </CardContent>
        </Card>
      )}

      {/* CSV import result banner */}
      {csvImportResult && (
        <div className={`rounded-lg border px-4 py-3 text-sm flex items-start justify-between gap-4 ${csvImportResult.errors.length === 0 ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400" : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>
          <div>
            <p className="font-medium">{csvImportResult.imported} holding(s) imported successfully.</p>
            {csvImportResult.errors.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs">
                {csvImportResult.errors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            )}
          </div>
          <button onClick={() => setCsvImportResult(null)} className="shrink-0 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Account cards */}
      {accounts.map(account => {
        const analysis = portfolio?.accounts.find(a => a.id === account.id);
        const expanded = expandedAccounts.has(account.id);

        return (
          <Card key={account.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <button
                  className="flex items-center gap-3 text-left"
                  onClick={() => toggleAccount(account.id)}
                >
                  {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <div>
                    <p className="font-medium text-sm">{account.account_name ?? account.provider_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {account.provider_name} · <Badge variant="muted" className="text-[10px] py-0">{accountTypeLabel(account.account_type)}</Badge>
                      {account.family_member_id && (() => {
                        const m = familyMembers.find(m => m.id === account.family_member_id);
                        return m ? <> · <span className="text-primary/70">{m.name}</span></> : null;
                      })()}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-4">
                  {analysis && (
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(analysis.total_current_value, currency)}</p>
                      <PnlBadge pnl={analysis.unrealized_pnl} pct={analysis.unrealized_pnl_pct} />
                    </div>
                  )}
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setAddingHoldingForAccount(account.id); setExpandedAccounts(prev => { const s = new Set(prev); s.add(account.id); return s; }); }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add holding
                    </Button>
                    <label
                      title="Import holdings from CSV"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-input text-xs font-medium cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <input
                        type="file"
                        accept=".csv"
                        className="sr-only"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) importCsvForAccount(account.id, f);
                          e.target.value = "";
                        }}
                      />
                      CSV
                    </label>
                    <Button variant="ghost" size="sm" onClick={() => deleteAccount(account.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>

            {expanded && (
              <CardContent className="pt-0 space-y-3">
                {/* Add holding form */}
                {addingHoldingForAccount === account.id && (
                  <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {isPensionAccount(account.account_type) ? "Add pension fund" : isStudyFundAccount(account.account_type) ? "Add study fund (כה\"ת)" : "Add holding"}
                    </p>
                    {isStudyFundAccount(account.account_type) ? (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1 col-span-3 sm:col-span-1">
                          <label className="text-xs text-muted-foreground">Fund name *</label>
                          <Input placeholder="e.g. Meitav Study Fund" value={holdingForm.name} onChange={e => setHoldingForm({ ...holdingForm, name: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Current balance *</label>
                          <Input type="number" placeholder="120000" value={holdingForm.current_balance} onChange={e => setHoldingForm({ ...holdingForm, current_balance: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Total deposits</label>
                          <Input type="number" placeholder="100000" value={holdingForm.total_deposits} onChange={e => setHoldingForm({ ...holdingForm, total_deposits: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Employee contribution / mo</label>
                          <Input type="number" placeholder="1000" value={holdingForm.monthly_contribution_employee} onChange={e => setHoldingForm({ ...holdingForm, monthly_contribution_employee: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Employer contribution / mo</label>
                          <Input type="number" placeholder="1500" value={holdingForm.monthly_contribution_employer} onChange={e => setHoldingForm({ ...holdingForm, monthly_contribution_employer: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Expected annual return (%)</label>
                          <Input type="number" placeholder="5.0" value={holdingForm.annual_return_rate} onChange={e => setHoldingForm({ ...holdingForm, annual_return_rate: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Currency</label>
                          <Input maxLength={3} value={holdingForm.currency} onChange={e => setHoldingForm({ ...holdingForm, currency: e.target.value.toUpperCase() })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Start date (for tax calculation)</label>
                          <Input type="date" value={holdingForm.purchase_date} onChange={e => setHoldingForm({ ...holdingForm, purchase_date: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Fund status</label>
                          <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={holdingForm.fund_status} onChange={e => setHoldingForm({ ...holdingForm, fund_status: e.target.value })}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                      </div>
                    ) : isPensionAccount(account.account_type) ? (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1 col-span-3 sm:col-span-1">
                          <label className="text-xs text-muted-foreground">Fund name *</label>
                          <Input placeholder="e.g. My Pension Fund" value={holdingForm.name} onChange={e => setHoldingForm({ ...holdingForm, name: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Current balance *</label>
                          <Input type="number" placeholder="500000" value={holdingForm.current_balance} onChange={e => setHoldingForm({ ...holdingForm, current_balance: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Total deposits</label>
                          <Input type="number" placeholder="400000" value={holdingForm.total_deposits} onChange={e => setHoldingForm({ ...holdingForm, total_deposits: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Monthly contribution</label>
                          <Input type="number" placeholder="2000" value={holdingForm.monthly_contribution} onChange={e => setHoldingForm({ ...holdingForm, monthly_contribution: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Expected annual return (%)</label>
                          <Input type="number" placeholder="5.5" value={holdingForm.annual_return_rate} onChange={e => setHoldingForm({ ...holdingForm, annual_return_rate: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Currency</label>
                          <Input maxLength={3} value={holdingForm.currency} onChange={e => setHoldingForm({ ...holdingForm, currency: e.target.value.toUpperCase() })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Start date</label>
                          <Input type="date" value={holdingForm.purchase_date} onChange={e => setHoldingForm({ ...holdingForm, purchase_date: e.target.value })} />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Name *</label>
                          <Input placeholder="e.g. S&P 500 ETF" value={holdingForm.name} onChange={e => setHoldingForm({ ...holdingForm, name: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Ticker</label>
                          <Input placeholder="SPY" value={holdingForm.ticker} onChange={e => setHoldingForm({ ...holdingForm, ticker: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">ISIN</label>
                          <Input placeholder="US78462F1030" value={holdingForm.isin} onChange={e => setHoldingForm({ ...holdingForm, isin: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Asset type</label>
                          <Select value={holdingForm.asset_type} onChange={e => setHoldingForm({ ...holdingForm, asset_type: e.target.value })}>
                            {ASSET_TYPES.filter(t => t.value !== "pension_fund").map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Quantity *</label>
                          <Input type="number" placeholder="10" value={holdingForm.quantity} onChange={e => setHoldingForm({ ...holdingForm, quantity: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Avg buy price *</label>
                          <Input type="number" placeholder="450.00" value={holdingForm.avg_buy_price} onChange={e => setHoldingForm({ ...holdingForm, avg_buy_price: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Currency</label>
                          <Input maxLength={3} value={holdingForm.currency} onChange={e => setHoldingForm({ ...holdingForm, currency: e.target.value.toUpperCase() })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Current price per unit (optional)</label>
                          <Input type="number" placeholder="Auto-calculated if blank" value={holdingForm.current_value} onChange={e => setHoldingForm({ ...holdingForm, current_value: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Purchase date</label>
                          <Input type="date" value={holdingForm.purchase_date} onChange={e => setHoldingForm({ ...holdingForm, purchase_date: e.target.value })} />
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => addHolding(account.id)}
                        disabled={
                          !holdingForm.name || savingHolding ||
                          (isStudyFundAccount(account.account_type)
                            ? !holdingForm.current_balance
                            : isPensionAccount(account.account_type)
                            ? !holdingForm.current_balance
                            : (!holdingForm.quantity || !holdingForm.avg_buy_price))
                        }
                      >
                        {savingHolding ? "Saving…" : isStudyFundAccount(account.account_type) ? "Add study fund" : isPensionAccount(account.account_type) ? "Add fund" : "Add holding"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setAddingHoldingForAccount(null); setHoldingForm(EMPTY_HOLDING); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Holdings table */}
                {account.holdings.length === 0 && addingHoldingForAccount !== account.id && (
                  <p className="text-xs text-muted-foreground py-3 text-center">No holdings yet — click "Add holding" to get started.</p>
                )}
                {account.holdings.length > 0 && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left pb-2 font-medium">Name</th>
                        <th className="text-left pb-2 font-medium">Type</th>
                        <th className="text-right pb-2 font-medium">Qty</th>
                        <th className="text-right pb-2 font-medium">Buy price</th>
                        <th className="text-right pb-2 font-medium">Current value</th>
                        <th className="text-right pb-2 font-medium">P&L</th>
                        <th className="w-16" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {account.holdings.map(h => {
                        const ha = analysis?.holdings.find(x => x.id === h.id);
                        const isEditing = editingHolding?.holdingId === h.id;
                        const isPension = h.asset_type === "pension_fund";
                        const isStudyFund = h.asset_type === "study_fund";
                        const isSavingsFund = isPension || isStudyFund;
                        const taxInfo = isStudyFund ? studyFundTaxStatus(h.purchase_date) : null;
                        const calcValue = isSavingsFund
                          ? (h.current_balance ?? h.total_deposits ?? 0)
                          : h.quantity * h.avg_buy_price;
                        return (
                          <>
                          <tr key={h.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 pr-3">
                              <p className="font-medium">{h.name}</p>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {!isSavingsFund && (h.ticker || h.isin) && (
                                  <p className="text-xs text-muted-foreground">{h.ticker ?? h.isin}</p>
                                )}
                                {!isSavingsFund && ha?.price_source === "live" && (
                                  <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-1.5 py-0 text-[10px] font-medium text-green-700 dark:text-green-400">Live</span>
                                )}
                                {!isSavingsFund && ha?.price_source !== "live" && h.ticker && (
                                  <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0 text-[10px] font-medium text-amber-700 dark:text-amber-400">Manual — refresh for live</span>
                                )}
                                {isPension && (
                                  <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0 text-[10px] font-medium text-blue-700 dark:text-blue-400">Pension fund</span>
                                )}
                                {isStudyFund && taxInfo?.status && (
                                  <span className={`inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium ${taxInfo.status === "Tax-Free" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"}`}>
                                    {taxInfo.status === "Tax-Free" ? "✅ Tax-Free" : `🔒 Locked${taxInfo.yearsLeft ? ` · ${taxInfo.yearsLeft}y` : ""}`}
                                  </span>
                                )}
                                {isStudyFund && h.fund_status === "inactive" && (
                                  <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0 text-[10px] font-medium text-muted-foreground">Inactive</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 pr-3">
                              <Badge variant="muted" className="text-[10px] py-0">{assetTypeLabel(h.asset_type)}</Badge>
                            </td>
                            <td className="py-2.5 text-right tabular-nums">
                              {isStudyFund ? (
                                (() => {
                                  const ee = h.monthly_contribution_employee ?? 0;
                                  const er = h.monthly_contribution_employer ?? 0;
                                  const total = ee + er;
                                  return total > 0
                                    ? <span className="text-xs text-muted-foreground">+{formatCurrency(total, h.currency)}/mo</span>
                                    : <span className="text-muted-foreground">—</span>;
                                })()
                              ) : isPension ? (
                                h.monthly_contribution != null
                                  ? <span className="text-xs text-muted-foreground">+{formatCurrency(h.monthly_contribution, h.currency)}/mo</span>
                                  : <span className="text-muted-foreground">—</span>
                              ) : h.quantity}
                            </td>
                            <td className="py-2.5 text-right tabular-nums">
                              {isSavingsFund ? (
                                h.total_deposits != null
                                  ? <p className="tabular-nums text-xs text-muted-foreground">{formatCurrency(h.total_deposits, h.currency)} deposited</p>
                                  : <span className="text-muted-foreground">—</span>
                              ) : (
                                <>
                                  <p className="tabular-nums">{formatCurrency(h.avg_buy_price, h.currency)}</p>
                                  {ha?.price_source === "live" && ha.live_price != null && (
                                    <p className="text-xs text-green-600 tabular-nums">{formatCurrency(ha.live_price, ha.live_price_currency ?? h.currency)} now</p>
                                  )}
                                </>
                              )}
                            </td>
                            <td className="py-2.5 text-right tabular-nums">
                              {ha ? (
                                <>
                                  <p className="font-medium">{formatCurrency(ha.current_value_base, currency)}</p>
                                  {isSavingsFund ? (
                                    <p className="text-[10px] text-muted-foreground">
                                      {h.current_balance != null ? `Balance: ${formatCurrency(h.current_balance, h.currency)}` : "Balance not set — edit to add"}
                                    </p>
                                  ) : (() => {
                                    const localCur = ha.price_source === "live" && ha.live_price_currency
                                      ? ha.live_price_currency
                                      : h.currency;
                                    const showLocal = localCur !== currency;
                                    const ilsVal = ilsEquiv(ha.current_value_base, portfolio?.fx_rates ?? {}, currency);
                                    const showIls = ilsVal !== null && localCur !== "ILS";
                                    return (
                                      <>
                                        {showLocal && (
                                          <p className="text-[10px] text-muted-foreground tabular-nums">
                                            ≈ {formatCurrency(ha.current_value_local, localCur)}
                                          </p>
                                        )}
                                        {showIls && (
                                          <p className="text-[10px] text-muted-foreground tabular-nums">
                                            ≈ {ilsVal}
                                          </p>
                                        )}
                                        <p className="text-[10px] text-muted-foreground">
                                          {ha.price_source === "live"
                                            ? `${h.quantity} × ${formatCurrency(ha.live_price!, ha.live_price_currency ?? h.currency)}`
                                            : ha.price_source === "manual"
                                            ? `${h.quantity} × ${formatCurrency(ha.current_value_local / h.quantity, h.currency)} (manual — edit to fix)`
                                            : `${h.quantity} × ${formatCurrency(h.avg_buy_price, h.currency)} (cost basis)`}
                                        </p>
                                      </>
                                    );
                                  })()}
                                </>
                              ) : (
                                <>
                                  <p>{formatCurrency(calcValue, h.currency)}</p>
                                  {!isSavingsFund && <p className="text-[10px] text-muted-foreground">{h.quantity} × {formatCurrency(h.avg_buy_price, h.currency)}</p>}
                                </>
                              )}
                            </td>
                            <td className="py-2.5 text-right">
                              {ha ? (
                                <div className="space-y-0.5">
                                  <PnlBadge pnl={ha.unrealized_pnl} pct={ha.unrealized_pnl_pct} />
                                  {ha.unrealized_pnl !== 0 && (
                                    <p className="text-[10px] text-muted-foreground text-right">
                                      After tax: <span className={ha.pnl_after_tax >= 0 ? "text-green-600" : "text-red-500"}>
                                        {ha.pnl_after_tax >= 0 ? "+" : ""}{formatCurrency(ha.pnl_after_tax, currency)}
                                      </span>
                                    </p>
                                  )}
                                </div>
                              ) : "—"}
                            </td>
                            <td className="py-2.5 text-right">
                              <div className="flex justify-end gap-1">
                                {isSavingsFund && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => simulatingHoldingId === h.id ? setSimulatingHoldingId(null) : openSimulation(h)}
                                    className="text-xs text-blue-600 dark:text-blue-400 px-2"
                                  >
                                    Simulate
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" onClick={() => startEditHolding(account.id, h)}>
                                  <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => deleteHolding(account.id, h.id)}>
                                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                          {isSavingsFund && simulatingHoldingId === h.id && (
                            <tr key={`sim-${h.id}`}>
                              <td colSpan={7} className="pb-3">
                                <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-4 bg-blue-50/40 dark:bg-blue-950/20">
                                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">Retirement Simulation — {h.name}</p>
                                  <div className="grid grid-cols-4 gap-4">
                                    <div className="space-y-1">
                                      <label className="text-xs text-muted-foreground">Retirement age</label>
                                      <Input
                                        type="number"
                                        min={50} max={90}
                                        value={simParams.retirement_age}
                                        onChange={e => {
                                          const p = { ...simParams, retirement_age: parseInt(e.target.value) || 67 };
                                          setSimParams(p);
                                          runSimulation(h.id, p);
                                        }}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-xs text-muted-foreground">Monthly contribution ({h.currency})</label>
                                      <Input
                                        type="number"
                                        min={0}
                                        value={simParams.monthly_contribution}
                                        onChange={e => {
                                          const p = { ...simParams, monthly_contribution: parseFloat(e.target.value) || 0 };
                                          setSimParams(p);
                                          runSimulation(h.id, p);
                                        }}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-xs text-muted-foreground">Expected annual return (%)</label>
                                      <Input
                                        type="number"
                                        min={0} max={30} step={0.5}
                                        value={simParams.annual_return_rate}
                                        onChange={e => {
                                          const p = { ...simParams, annual_return_rate: parseFloat(e.target.value) || 0 };
                                          setSimParams(p);
                                          runSimulation(h.id, p);
                                        }}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-xs text-muted-foreground">Withdrawal period (years)</label>
                                      <Input
                                        type="number"
                                        min={10} max={40}
                                        value={simParams.withdrawal_years}
                                        onChange={e => {
                                          const p = { ...simParams, withdrawal_years: parseInt(e.target.value) || 25 };
                                          setSimParams(p);
                                          runSimulation(h.id, p);
                                        }}
                                      />
                                    </div>
                                  </div>
                                  {simLoading && <p className="text-xs text-muted-foreground">Calculating…</p>}
                                  {simResult && simResult.holding_id === h.id && !simLoading && (
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-3 gap-3">
                                        <div className="rounded-lg border border-border bg-background p-3">
                                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Projected balance at {simResult.retirement_age}</p>
                                          <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{formatCurrency(simResult.projected_balance, simResult.currency)}</p>
                                          <p className="text-xs text-muted-foreground mt-0.5">in {simResult.years_to_retirement} years</p>
                                        </div>
                                        <div className="rounded-lg border border-border bg-background p-3">
                                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Monthly pension estimate</p>
                                          <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(simResult.monthly_pension_estimate, simResult.currency)}</p>
                                          <p className="text-xs text-muted-foreground mt-0.5">over {simResult.withdrawal_years} yrs</p>
                                        </div>
                                        <div className="rounded-lg border border-border bg-background p-3">
                                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Investment gains</p>
                                          <p className="text-lg font-bold text-emerald-600">{formatCurrency(simResult.total_gains, simResult.currency)}</p>
                                          <p className="text-xs text-muted-foreground mt-0.5">+{formatCurrency(simResult.total_contributions_added, simResult.currency)} contributions</p>
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                          <span>Current balance</span>
                                          <span>Contributions</span>
                                          <span>Investment gains</span>
                                        </div>
                                        <div className="h-3 rounded-full overflow-hidden flex">
                                          {(() => {
                                            const total = simResult.projected_balance || 1;
                                            const balPct = (simResult.projected_from_current_balance / total) * 100;
                                            const contPct = (simResult.projected_from_contributions / total) * 100;
                                            const gainPct = Math.max(0, 100 - balPct - contPct);
                                            return (
                                              <>
                                                <div className="bg-blue-500" style={{ width: `${balPct}%` }} title={`Current balance: ${balPct.toFixed(1)}%`} />
                                                <div className="bg-indigo-400" style={{ width: `${contPct}%` }} title={`Contributions: ${contPct.toFixed(1)}%`} />
                                                <div className="bg-emerald-500" style={{ width: `${gainPct}%` }} title={`Gains: ${gainPct.toFixed(1)}%`} />
                                              </>
                                            );
                                          })()}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">
                                          Age {simResult.current_age} → {simResult.retirement_age} · {simResult.annual_return_rate}% p.a. return
                                        </p>
                                      </div>
                                      {simResult.asset_type === "study_fund" && (
                                        <div className="flex flex-wrap gap-4 pt-1 border-t border-border">
                                          {simResult.tax_status && (
                                            <span className={`text-xs font-medium ${simResult.tax_status === "Tax-Free" ? "text-green-600" : "text-orange-500"}`}>
                                              {simResult.tax_status === "Tax-Free" ? "✅ Tax-Free" : `🔒 Locked`}
                                              {simResult.tax_exemption_date && ` · Eligible ${simResult.tax_exemption_date}`}
                                              {simResult.years_until_tax_free != null && simResult.years_until_tax_free > 0 && ` · ${simResult.years_until_tax_free}y remaining`}
                                            </span>
                                          )}
                                          {simResult.fund_status === "inactive" && (
                                            <span className="text-xs text-muted-foreground italic">
                                              This fund is inactive — no new contributions. Resuming contributions can significantly increase long-term value.
                                            </span>
                                          )}
                                          {simResult.monthly_contribution_employee != null && simResult.monthly_contribution_employer != null && (
                                            <span className="text-xs text-muted-foreground">
                                              Employee: {formatCurrency(simResult.monthly_contribution_employee, simResult.currency)}/mo · Employer: {formatCurrency(simResult.monthly_contribution_employer, simResult.currency)}/mo
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                          {isEditing && (
                            <tr key={`edit-${h.id}`}>
                              <td colSpan={7} className="pb-3">
                                <div className="border border-primary/30 rounded-lg p-4 space-y-3 bg-muted/30">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    {isStudyFund ? "Edit study fund (כה\"ת)" : isPension ? "Edit pension fund" : "Edit holding"}
                                  </p>
                                  {isStudyFund ? (
                                    <div className="grid grid-cols-3 gap-3">
                                      <div className="space-y-1 col-span-3 sm:col-span-1">
                                        <label className="text-xs text-muted-foreground">Fund name *</label>
                                        <Input value={editHoldingForm.name} onChange={e => setEditHoldingForm({ ...editHoldingForm, name: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Current balance *</label>
                                        <Input type="number" value={editHoldingForm.current_balance} onChange={e => setEditHoldingForm({ ...editHoldingForm, current_balance: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Total deposits</label>
                                        <Input type="number" value={editHoldingForm.total_deposits} onChange={e => setEditHoldingForm({ ...editHoldingForm, total_deposits: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Employee contribution / mo</label>
                                        <Input type="number" value={editHoldingForm.monthly_contribution_employee} onChange={e => setEditHoldingForm({ ...editHoldingForm, monthly_contribution_employee: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Employer contribution / mo</label>
                                        <Input type="number" value={editHoldingForm.monthly_contribution_employer} onChange={e => setEditHoldingForm({ ...editHoldingForm, monthly_contribution_employer: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Expected annual return (%)</label>
                                        <Input type="number" value={editHoldingForm.annual_return_rate} onChange={e => setEditHoldingForm({ ...editHoldingForm, annual_return_rate: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Currency</label>
                                        <Input maxLength={3} value={editHoldingForm.currency} onChange={e => setEditHoldingForm({ ...editHoldingForm, currency: e.target.value.toUpperCase() })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Start date (for tax calculation)</label>
                                        <Input type="date" value={editHoldingForm.purchase_date} onChange={e => setEditHoldingForm({ ...editHoldingForm, purchase_date: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Fund status</label>
                                        <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={editHoldingForm.fund_status} onChange={e => setEditHoldingForm({ ...editHoldingForm, fund_status: e.target.value })}>
                                          <option value="active">Active</option>
                                          <option value="inactive">Inactive</option>
                                        </select>
                                      </div>
                                    </div>
                                  ) : isPension ? (
                                    <div className="grid grid-cols-3 gap-3">
                                      <div className="space-y-1 col-span-3 sm:col-span-1">
                                        <label className="text-xs text-muted-foreground">Fund name *</label>
                                        <Input value={editHoldingForm.name} onChange={e => setEditHoldingForm({ ...editHoldingForm, name: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Current balance *</label>
                                        <Input type="number" value={editHoldingForm.current_balance} onChange={e => setEditHoldingForm({ ...editHoldingForm, current_balance: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Total deposits</label>
                                        <Input type="number" value={editHoldingForm.total_deposits} onChange={e => setEditHoldingForm({ ...editHoldingForm, total_deposits: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Monthly contribution</label>
                                        <Input type="number" value={editHoldingForm.monthly_contribution} onChange={e => setEditHoldingForm({ ...editHoldingForm, monthly_contribution: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Expected annual return (%)</label>
                                        <Input type="number" value={editHoldingForm.annual_return_rate} onChange={e => setEditHoldingForm({ ...editHoldingForm, annual_return_rate: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Currency</label>
                                        <Input maxLength={3} value={editHoldingForm.currency} onChange={e => setEditHoldingForm({ ...editHoldingForm, currency: e.target.value.toUpperCase() })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Start date</label>
                                        <Input type="date" value={editHoldingForm.purchase_date} onChange={e => setEditHoldingForm({ ...editHoldingForm, purchase_date: e.target.value })} />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-3 gap-3">
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Name *</label>
                                        <Input value={editHoldingForm.name} onChange={e => setEditHoldingForm({ ...editHoldingForm, name: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Ticker</label>
                                        <Input value={editHoldingForm.ticker} onChange={e => setEditHoldingForm({ ...editHoldingForm, ticker: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">ISIN</label>
                                        <Input value={editHoldingForm.isin} onChange={e => setEditHoldingForm({ ...editHoldingForm, isin: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Asset type</label>
                                        <Select value={editHoldingForm.asset_type} onChange={e => setEditHoldingForm({ ...editHoldingForm, asset_type: e.target.value })}>
                                          {ASSET_TYPES.filter(t => t.value !== "pension_fund" && t.value !== "study_fund").map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </Select>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Quantity *</label>
                                        <Input type="number" value={editHoldingForm.quantity} onChange={e => setEditHoldingForm({ ...editHoldingForm, quantity: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Avg buy price *</label>
                                        <Input type="number" value={editHoldingForm.avg_buy_price} onChange={e => setEditHoldingForm({ ...editHoldingForm, avg_buy_price: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Currency</label>
                                        <Input maxLength={3} value={editHoldingForm.currency} onChange={e => setEditHoldingForm({ ...editHoldingForm, currency: e.target.value.toUpperCase() })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Current price per unit (optional)</label>
                                        <Input type="number" placeholder="Leave blank to auto-calculate" value={editHoldingForm.current_value} onChange={e => setEditHoldingForm({ ...editHoldingForm, current_value: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Purchase date</label>
                                        <Input type="date" value={editHoldingForm.purchase_date} onChange={e => setEditHoldingForm({ ...editHoldingForm, purchase_date: e.target.value })} />
                                      </div>
                                    </div>
                                  )}
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={() => updateHolding(account.id, h.id)} disabled={savingEditHolding}>
                                      {savingEditHolding ? "Saving…" : "Save changes"}
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => { setEditingHolding(null); setEditHoldingForm(EMPTY_HOLDING); }}>
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
