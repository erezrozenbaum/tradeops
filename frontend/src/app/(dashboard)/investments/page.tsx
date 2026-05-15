"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { Plus, Trash2, Edit2, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight, Briefcase, RefreshCw, Scale, CheckCircle2, XCircle, ShieldCheck, Shield, AlertTriangle } from "lucide-react";
import { FxImpactCard } from "@/components/FxImpactCard";
import { ProactiveInsightsCard } from "@/components/ProactiveInsightsCard";
import { PaydayCalendarCard } from "@/components/PaydayCalendarCard";
import { LiquidityRunwayCard } from "@/components/LiquidityRunwayCard";
import { MarketSignalCard } from "@/components/MarketSignalCard";
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
  is_emergency_fund: boolean;
  management_fee_balance_pct: number | null;
  management_fee_contribution_pct: number | null;
  makdam: number | null;
  strike_price: number | null;
  expiry_date: string | null;
  option_type: string | null;
  underlying_ticker: string | null;
  contract_multiplier: number | null;
  position_type: string | null;
}

interface Account {
  id: string;
  provider_name: string;
  account_type: string;
  account_name: string | null;
  currency: string;
  notes: string | null;
  family_member_id: string | null;
  is_emergency_fund: boolean;
  auto_sync_enabled: boolean;
  last_synced_at: string | null;
  sync_broker_type: string | null;
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
  has_stale_prices: boolean;
  prices_updated_at: string | null;
  realized_pnl_total: number;
  realized_pnl_ytd: number;
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

interface SuggestedTrade {
  ticker: string;
  name: string;
  action: string;
  suggested_units: number;
  unit_price: number;
  estimated_value: number;
  currency: string;
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
  suggested_trades: SuggestedTrade[];
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
  { value: "call_option", label: "Call Option" },
  { value: "put_option", label: "Put Option" },
  { value: "other", label: "Other" },
];

const EMPTY_ACCOUNT = { provider_name: "", account_type: "brokerage", account_name: "", currency: "ILS", notes: "", family_member_id: "", is_emergency_fund: false };
const EMPTY_HOLDING = { ticker: "", isin: "", name: "", asset_type: "stock", quantity: "", avg_buy_price: "", currency: "ILS", fees: "", purchase_date: "", current_value: "", notes: "", current_balance: "", total_deposits: "", monthly_contribution: "", annual_return_rate: "", monthly_contribution_employee: "", monthly_contribution_employer: "", fund_status: "active", management_fee_balance_pct: "", management_fee_contribution_pct: "", makdam: "", strike_price: "", expiry_date: "", option_type: "call", underlying_ticker: "", contract_multiplier: "100", position_type: "long" };
const _OPTION_TYPES = new Set(["call_option", "put_option"]);

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
  const [income, setIncome] = useState<{
    total_annual_income: number;
    portfolio_yield_on_value: number;
    portfolio_yield_on_cost: number;
    currency: string;
    holdings: { holding_id: string; name: string; ticker: string; annual_income: number; yield_on_value: number; next_ex_date: string | null }[];
    upcoming_ex_dates: { ticker: string; name: string; ex_date: string; estimated_payment: number }[];
  } | null>(null);
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

  // Options summary
  const [optionsSummary, setOptionsSummary] = useState<any>(null);

  // Pension simulation
  const [simulatingHoldingId, setSimulatingHoldingId] = useState<string | null>(null);
  const [simParams, setSimParams] = useState({ retirement_age: 67, monthly_contribution: 0, annual_return_rate: 5.0, withdrawal_years: 25 });
  const [simResult, setSimResult] = useState<PensionSimResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  // CSV import
  const [csvImportResult, setCsvImportResult] = useState<{ accountId: string; imported: number; errors: string[] } | null>(null);

  // Broker sync
  const [brokerModal, setBrokerModal] = useState<{ accountId: string } | null>(null);
  const [brokerType, setBrokerType] = useState("ibkr");
  const [brokerImporting, setBrokerImporting] = useState(false);
  const [brokerResult, setBrokerResult] = useState<{ imported: number; updated: number; skipped: number; errors: string[] } | null>(null);

  // Earnings calendar
  const [earningsMap, setEarningsMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!investorId) return;
    loadAll();
    fetch(`/api/v1/investors/${investorId}/portfolio/income`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setIncome(d); });
    fetch(`/api/v1/investors/${investorId}/calendar`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.events) {
          const map: Record<string, string> = {};
          for (const ev of d.events) map[ev.ticker] = ev.earnings_date;
          setEarningsMap(map);
        }
      });
  }, [investorId]);

  async function loadAll() {
    setLoading(true);
    const [accts, port, reb, hist, families, opts] = await Promise.all([
      fetch(`/api/v1/investors/${investorId}/accounts`).then(r => r.ok ? r.json() : []),
      fetch(`/api/v1/investors/${investorId}/portfolio`).then(r => r.ok ? r.json() : null),
      fetch(`/api/v1/investors/${investorId}/portfolio/rebalance`).then(r => r.ok ? r.json() : null),
      fetch(`/api/v1/investors/${investorId}/portfolio/history`).then(r => r.ok ? r.json() : null),
      fetch(`/api/v1/family-profiles?investor_id=${investorId}`).then(r => r.ok ? r.json() : []),
      fetch(`/api/v1/investors/${investorId}/portfolio/options`).then(r => r.ok ? r.json() : null),
    ]);
    setAccounts(accts);
    setPortfolio(port);
    setRebalance(reb);
    setHistory(hist?.snapshots ?? []);
    const members: FamilyMember[] = (families as { members: FamilyMember[] }[]).flatMap(f => f.members ?? []);
    setFamilyMembers(members);
    setOptionsSummary(opts);
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
          is_emergency_fund: accountForm.is_emergency_fund,
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

  async function toggleEmergencyFund(accountId: string, current: boolean) {
    await fetch(`/api/v1/investors/${investorId}/accounts/${accountId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_emergency_fund: !current }),
    });
    loadAll();
  }

  async function toggleAutoSync(account: Account) {
    const newEnabled = !account.auto_sync_enabled;
    await fetch(`/api/v1/investors/${investorId}/accounts/${account.id}/auto-sync`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auto_sync_enabled: newEnabled,
        sync_broker_type: account.sync_broker_type ?? "ibkr",
      }),
    });
    loadAll();
  }

  async function toggleHoldingEmergencyFund(accountId: string, holdingId: string, current: boolean) {
    await fetch(`/api/v1/investors/${investorId}/accounts/${accountId}/holdings/${holdingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_emergency_fund: !current }),
    });
    loadAll();
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
            management_fee_balance_pct: holdingForm.management_fee_balance_pct ? parseFloat(holdingForm.management_fee_balance_pct) : null,
            management_fee_contribution_pct: holdingForm.management_fee_contribution_pct ? parseFloat(holdingForm.management_fee_contribution_pct) : null,
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
            management_fee_balance_pct: holdingForm.management_fee_balance_pct ? parseFloat(holdingForm.management_fee_balance_pct) : null,
            management_fee_contribution_pct: holdingForm.management_fee_contribution_pct ? parseFloat(holdingForm.management_fee_contribution_pct) : null,
            makdam: holdingForm.makdam ? parseFloat(holdingForm.makdam) : null,
            notes: holdingForm.notes || null,
          }
        : _OPTION_TYPES.has(holdingForm.asset_type)
        ? {
            name: holdingForm.name,
            asset_type: holdingForm.asset_type,
            quantity: parseFloat(holdingForm.quantity) || 0,
            avg_buy_price: parseFloat(holdingForm.avg_buy_price) || 0,
            currency: holdingForm.currency,
            fees: 0,
            current_value: holdingForm.current_value ? parseFloat(holdingForm.current_value) : null,
            strike_price: holdingForm.strike_price ? parseFloat(holdingForm.strike_price) : null,
            expiry_date: holdingForm.expiry_date || null,
            option_type: holdingForm.option_type || null,
            underlying_ticker: holdingForm.underlying_ticker || null,
            contract_multiplier: holdingForm.contract_multiplier ? parseFloat(holdingForm.contract_multiplier) : 100,
            position_type: holdingForm.position_type || "long",
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
      management_fee_balance_pct: h.management_fee_balance_pct != null ? String(h.management_fee_balance_pct) : "",
      management_fee_contribution_pct: h.management_fee_contribution_pct != null ? String(h.management_fee_contribution_pct) : "",
      makdam: h.makdam != null ? String(h.makdam) : "",
      strike_price: h.strike_price != null ? String(h.strike_price) : "",
      expiry_date: h.expiry_date ?? "",
      option_type: h.option_type ?? "call",
      underlying_ticker: h.underlying_ticker ?? "",
      contract_multiplier: h.contract_multiplier != null ? String(h.contract_multiplier) : "100",
      position_type: h.position_type ?? "long",
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
            management_fee_balance_pct: editHoldingForm.management_fee_balance_pct ? parseFloat(editHoldingForm.management_fee_balance_pct) : null,
            management_fee_contribution_pct: editHoldingForm.management_fee_contribution_pct ? parseFloat(editHoldingForm.management_fee_contribution_pct) : null,
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
            management_fee_balance_pct: editHoldingForm.management_fee_balance_pct ? parseFloat(editHoldingForm.management_fee_balance_pct) : null,
            management_fee_contribution_pct: editHoldingForm.management_fee_contribution_pct ? parseFloat(editHoldingForm.management_fee_contribution_pct) : null,
            makdam: editHoldingForm.makdam ? parseFloat(editHoldingForm.makdam) : null,
            notes: editHoldingForm.notes || null,
          }
        : _OPTION_TYPES.has(editHoldingForm.asset_type)
        ? {
            name: editHoldingForm.name || undefined,
            asset_type: editHoldingForm.asset_type,
            quantity: parseFloat(editHoldingForm.quantity) || undefined,
            avg_buy_price: parseFloat(editHoldingForm.avg_buy_price) || undefined,
            currency: editHoldingForm.currency || undefined,
            current_value: editHoldingForm.current_value ? parseFloat(editHoldingForm.current_value) : null,
            strike_price: editHoldingForm.strike_price ? parseFloat(editHoldingForm.strike_price) : null,
            expiry_date: editHoldingForm.expiry_date || null,
            option_type: editHoldingForm.option_type || null,
            underlying_ticker: editHoldingForm.underlying_ticker || null,
            contract_multiplier: editHoldingForm.contract_multiplier ? parseFloat(editHoldingForm.contract_multiplier) : 100,
            position_type: editHoldingForm.position_type || "long",
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

  async function importBrokerFile(accountId: string, file: File) {
    setBrokerImporting(true);
    setBrokerResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("broker_type", brokerType);
      const res = await fetch(
        `/api/v1/investors/${investorId}/accounts/${accountId}/broker-sync`,
        { method: "POST", body: form }
      );
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.detail?.message ?? data?.detail ?? "Import failed";
        const errs: string[] = data?.detail?.errors ?? [];
        setBrokerResult({ imported: 0, updated: 0, skipped: 0, errors: [msg, ...errs] });
      } else {
        setBrokerResult({ imported: data.imported, updated: data.updated, skipped: data.skipped, errors: data.errors ?? [] });
        if (data.imported > 0 || data.updated > 0) loadAll();
      }
    } finally {
      setBrokerImporting(false);
    }
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
    <>
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 lg:space-y-6">
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

      {/* Stale price warning */}
      {portfolio?.has_stale_prices && (
        <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Some holdings are showing cost basis instead of live market prices — prices may be stale or unavailable.
            Click <strong>Refresh prices</strong> to fetch current market data.
          </span>
        </div>
      )}

      {/* Portfolio summary */}
      {portfolio && (portfolio.total_current_value > 0 || accounts.length > 0) && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
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
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Realized P&L</p>
                {portfolio.realized_pnl_total === 0 ? (
                  <p className="text-xl font-semibold text-muted-foreground">—</p>
                ) : (
                  <p className={`text-xl font-semibold ${portfolio.realized_pnl_total >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {portfolio.realized_pnl_total >= 0 ? "+" : ""}{formatCurrency(portfolio.realized_pnl_total, currency)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">From closed positions</p>
                {portfolio.realized_pnl_total !== 0 && (
                  <div className="mt-2 pt-2 border-t border-border/60">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">This year (YTD)</p>
                    <p className={`text-sm font-semibold ${portfolio.realized_pnl_ytd >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {portfolio.realized_pnl_ytd >= 0 ? "+" : ""}{formatCurrency(portfolio.realized_pnl_ytd, currency)}
                    </p>
                  </div>
                )}
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
                    {tier.suggested_trades && tier.suggested_trades.length > 0
                      ? tier.suggested_trades.map((trade) => (
                          <p key={trade.ticker} className={`text-[10px] font-medium ${trade.action === "buy" ? "text-blue-500" : "text-amber-500"}`}>
                            {trade.action === "buy" ? "↑ Buy" : "↓ Sell"} ~{trade.suggested_units < 1 ? trade.suggested_units.toFixed(4) : trade.suggested_units.toFixed(2)} units {trade.ticker}{" "}
                            <span className="text-muted-foreground font-normal">
                              @ {formatCurrency(trade.unit_price, trade.currency)} ≈ {formatCurrency(trade.estimated_value, trade.currency)}
                            </span>
                          </p>
                        ))
                      : tier.gap_amount != null && tier.action !== "hold" && (
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

      {/* Dividend Income Card */}
      {income && income.total_annual_income > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Dividend Income
              <Badge variant="muted" className="ml-auto text-xs font-normal">Annual estimate</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary strip */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/40 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Annual Income</p>
                <p className="text-lg font-bold text-green-500">{formatCurrency(income.total_annual_income, income.currency)}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Yield on Value</p>
                <p className="text-lg font-bold">{income.portfolio_yield_on_value.toFixed(2)}%</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Yield on Cost</p>
                <p className="text-lg font-bold">{income.portfolio_yield_on_cost.toFixed(2)}%</p>
              </div>
            </div>

            {/* Upcoming ex-dividend dates */}
            {income.upcoming_ex_dates.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Upcoming Ex-Dividend Dates (90 days)</p>
                <div className="space-y-1.5">
                  {income.upcoming_ex_dates.map((ev) => (
                    <div key={`${ev.ticker}-${ev.ex_date}`} className="flex items-center justify-between text-xs bg-muted/30 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-primary">{ev.ticker}</span>
                        <span className="text-muted-foreground">{ev.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <span className="text-muted-foreground">{new Date(ev.ex_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        <span className="font-medium text-green-500">~{formatCurrency(ev.estimated_payment, income.currency)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top dividend holdings */}
            {income.holdings.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Income by Holding</p>
                <div className="space-y-1">
                  {income.holdings.slice(0, 5).map((h) => (
                    <div key={h.holding_id} className="flex items-center gap-3 text-xs">
                      <span className="font-mono font-semibold w-16 shrink-0">{h.ticker}</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-green-500"
                          style={{ width: `${Math.min(h.annual_income / income.total_annual_income * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-green-500 font-medium w-24 text-right shrink-0">
                        {formatCurrency(h.annual_income, income.currency)}
                      </span>
                      <span className="text-muted-foreground w-14 text-right shrink-0">
                        {h.yield_on_value.toFixed(1)}% yld
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Belongs to (optional)</label>
                {familyMembers.length > 0 ? (
                  <Select
                    value={accountForm.family_member_id}
                    onChange={e => setAccountForm({ ...accountForm, family_member_id: e.target.value })}
                  >
                    <option value="">— Household / shared —</option>
                    {familyMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.relationship_type})</option>
                    ))}
                  </Select>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No family members found.{" "}
                    <a href="/family" className="text-primary underline underline-offset-2">Set up your family profile</a>{" "}
                    to assign accounts to a specific person.
                  </p>
                )}
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={accountForm.is_emergency_fund}
                    onChange={e => setAccountForm({ ...accountForm, is_emergency_fund: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-amber-500" />
                    Use as emergency fund
                  </span>
                  <span className="text-xs text-muted-foreground">(e.g. Keren Hishtalmut / study fund)</span>
                </label>
              </div>
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

      {/* Proactive Insights */}
      {investorId && <ProactiveInsightsCard investorId={investorId} />}

      {/* FX Impact Analysis */}
      {investorId && <FxImpactCard investorId={investorId} />}

      {/* Payday Calendar */}
      {investorId && <PaydayCalendarCard investorId={investorId} />}

      {/* Liquidity Runway */}
      {investorId && <LiquidityRunwayCard investorId={investorId} />}

      {/* Market Signal Monitor */}
      {investorId && <MarketSignalCard investorId={investorId} />}

      {/* Options P&L summary */}
      {optionsSummary && optionsSummary.total_positions > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Options Positions
              <span className="text-xs font-normal text-muted-foreground ml-1">{optionsSummary.total_positions} active</span>
              {optionsSummary.expiring_soon_count > 0 && (
                <span className="text-[10px] font-medium rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5">
                  {optionsSummary.expiring_soon_count} expiring within 30d
                </span>
              )}
              {optionsSummary.has_short_positions && (
                <span className="text-[10px] font-medium rounded-full bg-destructive/15 text-destructive px-2 py-0.5">
                  Short positions — unlimited max loss
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left pb-2 font-medium">Name</th>
                    <th className="text-right pb-2 font-medium">Strike</th>
                    <th className="text-right pb-2 font-medium">Expiry</th>
                    <th className="text-right pb-2 font-medium">Cost basis</th>
                    <th className="text-right pb-2 font-medium">Current value</th>
                    <th className="text-right pb-2 font-medium">P&L</th>
                    <th className="text-right pb-2 font-medium">Max loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {optionsSummary.positions.map((p: any) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="py-2.5 pr-3">
                        <p className="font-medium">{p.name}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-muted-foreground">{p.asset_type === "call_option" ? "Call" : "Put"} · {p.position_type}</span>
                          {p.underlying_ticker && <span className="text-[10px] text-muted-foreground">{p.underlying_ticker}</span>}
                          {p.days_to_expiry !== null && (
                            <span className={`text-[10px] font-medium rounded-full px-1.5 py-0 ${p.expiry_status === "expired" || p.expiry_status === "critical" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" : p.expiry_status === "warning" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"}`}>
                              {p.days_to_expiry === 0 ? "Expired" : `${p.days_to_expiry}d`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{p.strike_price != null ? formatCurrency(p.strike_price, p.currency) : "—"}</td>
                      <td className="py-2.5 text-right text-xs text-muted-foreground">{p.expiry_date ?? "—"}</td>
                      <td className="py-2.5 text-right tabular-nums">{formatCurrency(p.cost_basis, p.currency)}</td>
                      <td className="py-2.5 text-right tabular-nums">{p.current_value != null ? formatCurrency(p.current_value, p.currency) : <span className="text-muted-foreground text-xs">—</span>}</td>
                      <td className={`py-2.5 text-right tabular-nums font-medium ${p.unrealized_pnl == null ? "" : p.unrealized_pnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {p.unrealized_pnl != null ? `${p.unrealized_pnl >= 0 ? "+" : ""}${formatCurrency(p.unrealized_pnl, p.currency)}` : <span className="text-muted-foreground text-xs font-normal">—</span>}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-xs">
                        {p.max_loss_unlimited
                          ? <span className="text-destructive font-semibold">Unlimited ⚠️</span>
                          : p.max_loss != null ? formatCurrency(p.max_loss, p.currency) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold text-sm">
                    <td colSpan={3} className="pt-2 text-muted-foreground text-xs">Total</td>
                    <td className="pt-2 text-right tabular-nums">{formatCurrency(optionsSummary.total_cost_basis, portfolio?.base_currency ?? "USD")}</td>
                    <td className="pt-2 text-right tabular-nums">{formatCurrency(optionsSummary.total_current_value, portfolio?.base_currency ?? "USD")}</td>
                    <td className={`pt-2 text-right tabular-nums ${optionsSummary.total_unrealized_pnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {optionsSummary.total_unrealized_pnl >= 0 ? "+" : ""}{formatCurrency(optionsSummary.total_unrealized_pnl, portfolio?.base_currency ?? "USD")}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
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
                    <p className="font-medium text-sm flex items-center gap-2">
                      {account.account_name ?? account.provider_name}
                      {account.is_emergency_fund && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                          <ShieldCheck className="h-3 w-3" /> Emergency Fund
                        </span>
                      )}
                    </p>
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
                    <Button
                      variant="outline"
                      size="sm"
                      title="Import holdings from broker export"
                      onClick={() => { setBrokerModal({ accountId: account.id }); setBrokerResult(null); }}
                    >
                      Broker Import
                    </Button>
                    <Button
                      variant={account.auto_sync_enabled ? "outline" : "ghost"}
                      size="sm"
                      title={account.auto_sync_enabled
                        ? `Auto-sync ON · Last synced: ${account.last_synced_at ? new Date(account.last_synced_at).toLocaleDateString() : "never"}`
                        : "Enable daily price auto-sync for this account"}
                      onClick={() => toggleAutoSync(account)}
                      className={account.auto_sync_enabled ? "text-blue-600 border-blue-300 hover:text-blue-700 gap-1" : "gap-1 text-muted-foreground"}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span className="text-[10px]">{account.auto_sync_enabled ? "Auto" : "Sync"}</span>
                    </Button>
                    <Button
                      variant={account.is_emergency_fund ? "outline" : "ghost"}
                      size="sm"
                      title={account.is_emergency_fund ? "Unmark as emergency fund" : "Mark as emergency fund"}
                      onClick={() => toggleEmergencyFund(account.id, account.is_emergency_fund)}
                      className={account.is_emergency_fund ? "text-amber-600 border-amber-300 hover:text-amber-700 gap-1" : "gap-1 text-muted-foreground"}
                    >
                      {account.is_emergency_fund
                        ? <><ShieldCheck className="h-3.5 w-3.5" /><span className="text-[10px] font-medium">EF</span></>
                        : <><Shield className="h-3.5 w-3.5" /><span className="text-[10px]">EF</span></>}
                    </Button>
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
                          <label className="text-xs text-muted-foreground">Expected annual return — gross (%)</label>
                          <Input type="number" step="0.5" placeholder="5.0" value={holdingForm.annual_return_rate} onChange={e => setHoldingForm({ ...holdingForm, annual_return_rate: e.target.value })} />
                          <p className="text-[10px] text-muted-foreground">Conservative: 4–5% · Moderate: 5–6% · Historical avg: 7–9%. Net = gross minus fee on balance.</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Fee on balance % — דמי ניהול מצבירה</label>
                          <Input type="number" step="0.01" placeholder="0.25" value={holdingForm.management_fee_balance_pct} onChange={e => setHoldingForm({ ...holdingForm, management_fee_balance_pct: e.target.value })} />
                          <p className="text-[10px] text-muted-foreground">Typical: 0.25–0.5% (כה&quot;ת) · Check your policy document.</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Fee on contribution % — דמי ניהול מהפקדות</label>
                          <Input type="number" step="0.01" placeholder="1.0" value={holdingForm.management_fee_contribution_pct} onChange={e => setHoldingForm({ ...holdingForm, management_fee_contribution_pct: e.target.value })} />
                          <p className="text-[10px] text-muted-foreground">Typical: 0.5–1.5%. Deducted from each deposit before it compounds.</p>
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
                          <label className="text-xs text-muted-foreground">Expected annual return — gross (%)</label>
                          <Input type="number" step="0.5" placeholder="5.5" value={holdingForm.annual_return_rate} onChange={e => setHoldingForm({ ...holdingForm, annual_return_rate: e.target.value })} />
                          <p className="text-[10px] text-muted-foreground">Conservative: 4–5% · Moderate: 5–6% · Historical avg: 7–9%. Net = gross minus fee on balance. Use realistic net for planning.</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Fee on balance % — דמי ניהול מצבירה</label>
                          <Input type="number" step="0.01" placeholder="0.5" value={holdingForm.management_fee_balance_pct} onChange={e => setHoldingForm({ ...holdingForm, management_fee_balance_pct: e.target.value })} />
                          <p className="text-[10px] text-muted-foreground">Typical: 0.5–1% (ביטוח מנהלים) · Check your policy document (פוליסה).</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Fee on contribution % — דמי ניהול מהפקדות</label>
                          <Input type="number" step="0.01" placeholder="1.5" value={holdingForm.management_fee_contribution_pct} onChange={e => setHoldingForm({ ...holdingForm, management_fee_contribution_pct: e.target.value })} />
                          <p className="text-[10px] text-muted-foreground">Typical: 1–2% (ביטוח מנהלים). Deducted from each deposit before it compounds.</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Makdam — מקדם פנסיה</label>
                          <Input type="number" step="1" min="50" max="400" placeholder="200" value={holdingForm.makdam} onChange={e => setHoldingForm({ ...holdingForm, makdam: e.target.value })} />
                          <p className="text-[10px] text-muted-foreground">Coefficient for monthly pension calc. Old ביטוח מנהלים: fixed (check policy). Post-2013 / קרן פנסיה: ~200–220.</p>
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
                    ) : _OPTION_TYPES.has(holdingForm.asset_type) ? (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Name *</label>
                          <Input placeholder="e.g. AAPL Jun 200 Call" value={holdingForm.name} onChange={e => setHoldingForm({ ...holdingForm, name: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Asset type</label>
                          <Select value={holdingForm.asset_type} onChange={e => setHoldingForm({ ...holdingForm, asset_type: e.target.value })}>
                            {ASSET_TYPES.filter(t => t.value !== "pension_fund").map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Underlying ticker</label>
                          <Input placeholder="AAPL" value={holdingForm.underlying_ticker} onChange={e => setHoldingForm({ ...holdingForm, underlying_ticker: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Strike price *</label>
                          <Input type="number" placeholder="200.00" value={holdingForm.strike_price} onChange={e => setHoldingForm({ ...holdingForm, strike_price: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Expiry date *</label>
                          <Input type="date" value={holdingForm.expiry_date} onChange={e => setHoldingForm({ ...holdingForm, expiry_date: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Contracts (qty) *</label>
                          <Input type="number" placeholder="1" value={holdingForm.quantity} onChange={e => setHoldingForm({ ...holdingForm, quantity: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Premium paid per unit</label>
                          <Input type="number" placeholder="3.50" value={holdingForm.avg_buy_price} onChange={e => setHoldingForm({ ...holdingForm, avg_buy_price: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Contract multiplier</label>
                          <Input type="number" placeholder="100" value={holdingForm.contract_multiplier} onChange={e => setHoldingForm({ ...holdingForm, contract_multiplier: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Position type</label>
                          <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={holdingForm.position_type} onChange={e => setHoldingForm({ ...holdingForm, position_type: e.target.value })}>
                            <option value="long">Long</option>
                            <option value="short">Short ⚠️</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Current value (total)</label>
                          <Input type="number" placeholder="Optional" value={holdingForm.current_value} onChange={e => setHoldingForm({ ...holdingForm, current_value: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Currency</label>
                          <Input maxLength={3} value={holdingForm.currency} onChange={e => setHoldingForm({ ...holdingForm, currency: e.target.value.toUpperCase() })} />
                        </div>
                        {holdingForm.position_type === "short" && (
                          <div className="col-span-3 flex items-center gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-xs">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            Short positions carry unlimited max loss. Ensure this reflects your actual position.
                          </div>
                        )}
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
                  <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-sm min-w-[600px]">
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
                        const isOption = _OPTION_TYPES.has(h.asset_type);
                        const isSavingsFund = isPension || isStudyFund;
                        const taxInfo = isStudyFund ? studyFundTaxStatus(h.purchase_date) : null;
                        const optDays = isOption && h.expiry_date ? Math.max(0, Math.floor((new Date(h.expiry_date).getTime() - Date.now()) / 86400000)) : null;
                        const calcValue = isSavingsFund
                          ? (h.current_balance ?? h.total_deposits ?? 0)
                          : isOption
                          ? (h.current_value ?? (h.avg_buy_price * h.quantity * (h.contract_multiplier ?? 100)))
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
                                {isSavingsFund && h.annual_return_rate !== null && h.annual_return_rate > 7 && (
                                  <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0 text-[10px] font-medium text-amber-700 dark:text-amber-400" title="Return rate above 7% — may be a historical gross rate, not a realistic net planning rate. Click edit (✏️) to update.">
                                    ⚠️ {h.annual_return_rate}% rate
                                  </span>
                                )}
                                {isStudyFund && taxInfo?.status && (
                                  <span className={`inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium ${taxInfo.status === "Tax-Free" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"}`}>
                                    {taxInfo.status === "Tax-Free" ? "✅ Tax-Free" : `🔒 Locked${taxInfo.yearsLeft ? ` · ${taxInfo.yearsLeft}y` : ""}`}
                                  </span>
                                )}
                                {h.is_emergency_fund && (
                                  <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                                    <ShieldCheck className="h-2.5 w-2.5" /> EF
                                  </span>
                                )}
                                {isStudyFund && h.fund_status === "inactive" && (
                                  <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0 text-[10px] font-medium text-muted-foreground">Inactive</span>
                                )}
                                {isOption && optDays !== null && (
                                  <span className={`inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium ${optDays === 0 ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" : optDays <= 7 ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" : optDays <= 30 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"}`}>
                                    {optDays === 0 ? "Expired" : `${optDays}d to expiry`}
                                  </span>
                                )}
                                {isOption && h.position_type === "short" && (
                                  <span className="inline-flex items-center rounded-full bg-destructive/15 px-1.5 py-0 text-[10px] font-medium text-destructive">Short ⚠️</span>
                                )}
                                {isOption && h.underlying_ticker && (
                                  <span className="text-xs text-muted-foreground">{h.underlying_ticker} · Strike {h.strike_price}</span>
                                )}
                                {!isSavingsFund && h.ticker && earningsMap[h.ticker.toUpperCase()] && (() => {
                                  const earningsDate = earningsMap[h.ticker.toUpperCase()];
                                  const daysUntil = Math.ceil((new Date(earningsDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                  return (
                                    <span className={`inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium ${daysUntil <= 7 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"}`}>
                                      Earnings {daysUntil <= 0 ? "today" : `in ${daysUntil}d`}
                                    </span>
                                  );
                                })()}
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
                                <Button
                                  variant={h.is_emergency_fund ? "outline" : "ghost"}
                                  size="sm"
                                  title={h.is_emergency_fund ? "Unmark as emergency fund" : "Mark as emergency fund"}
                                  onClick={() => toggleHoldingEmergencyFund(account.id, h.id, h.is_emergency_fund)}
                                  className={h.is_emergency_fund ? "text-amber-600 border-amber-300 hover:text-amber-700 gap-1" : "gap-1 text-muted-foreground"}
                                >
                                  {h.is_emergency_fund
                                    ? <><ShieldCheck className="h-3.5 w-3.5" /><span className="text-[10px] font-medium">EF</span></>
                                    : <><Shield className="h-3.5 w-3.5" /><span className="text-[10px]">EF</span></>}
                                </Button>
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
                                        <label className="text-xs text-muted-foreground">Expected annual return — gross (%)</label>
                                        <Input type="number" step="0.5" value={editHoldingForm.annual_return_rate} onChange={e => setEditHoldingForm({ ...editHoldingForm, annual_return_rate: e.target.value })} />
                                        <p className="text-[10px] text-muted-foreground">Conservative: 4–5% · Moderate: 5–6% · Historical avg: 7–9%. Net = gross minus fee on balance.</p>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Fee on balance % — דמי ניהול מצבירה</label>
                                        <Input type="number" step="0.01" placeholder="0.25" value={editHoldingForm.management_fee_balance_pct} onChange={e => setEditHoldingForm({ ...editHoldingForm, management_fee_balance_pct: e.target.value })} />
                                        <p className="text-[10px] text-muted-foreground">Typical: 0.25–0.5% (כה&quot;ת) · Check your policy document.</p>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Fee on contribution % — דמי ניהול מהפקדות</label>
                                        <Input type="number" step="0.01" placeholder="1.0" value={editHoldingForm.management_fee_contribution_pct} onChange={e => setEditHoldingForm({ ...editHoldingForm, management_fee_contribution_pct: e.target.value })} />
                                        <p className="text-[10px] text-muted-foreground">Typical: 0.5–1.5%. Deducted from each deposit before it compounds.</p>
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
                                        <label className="text-xs text-muted-foreground">Expected annual return — gross (%)</label>
                                        <Input type="number" step="0.5" value={editHoldingForm.annual_return_rate} onChange={e => setEditHoldingForm({ ...editHoldingForm, annual_return_rate: e.target.value })} />
                                        <p className="text-[10px] text-muted-foreground">Conservative: 4–5% · Moderate: 5–6% · Historical avg: 7–9%. Net = gross minus fee on balance. Use realistic net for planning.</p>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Fee on balance % — דמי ניהול מצבירה</label>
                                        <Input type="number" step="0.01" placeholder="0.5" value={editHoldingForm.management_fee_balance_pct} onChange={e => setEditHoldingForm({ ...editHoldingForm, management_fee_balance_pct: e.target.value })} />
                                        <p className="text-[10px] text-muted-foreground">Typical: 0.5–1% (ביטוח מנהלים) · Check your policy document (פוליסה).</p>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Fee on contribution % — דמי ניהול מהפקדות</label>
                                        <Input type="number" step="0.01" placeholder="1.0" value={editHoldingForm.management_fee_contribution_pct} onChange={e => setEditHoldingForm({ ...editHoldingForm, management_fee_contribution_pct: e.target.value })} />
                                        <p className="text-[10px] text-muted-foreground">Typical: 1–2% (ביטוח מנהלים). Deducted from each deposit before it compounds.</p>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Makdam — מקדם פנסיה</label>
                                        <Input type="number" step="1" min="50" max="400" placeholder="200" value={editHoldingForm.makdam} onChange={e => setEditHoldingForm({ ...editHoldingForm, makdam: e.target.value })} />
                                        <p className="text-[10px] text-muted-foreground">Conversion coefficient for monthly pension. Old ביטוח מנהלים: fixed (check your policy). New post-2013: variable ~200. קרן פנסיה: ~200–220.</p>
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
                                  ) : _OPTION_TYPES.has(editHoldingForm.asset_type) ? (
                                    <div className="grid grid-cols-3 gap-3">
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Name *</label>
                                        <Input value={editHoldingForm.name} onChange={e => setEditHoldingForm({ ...editHoldingForm, name: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Underlying ticker</label>
                                        <Input value={editHoldingForm.underlying_ticker} onChange={e => setEditHoldingForm({ ...editHoldingForm, underlying_ticker: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Strike price</label>
                                        <Input type="number" value={editHoldingForm.strike_price} onChange={e => setEditHoldingForm({ ...editHoldingForm, strike_price: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Expiry date</label>
                                        <Input type="date" value={editHoldingForm.expiry_date} onChange={e => setEditHoldingForm({ ...editHoldingForm, expiry_date: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Contracts (qty)</label>
                                        <Input type="number" value={editHoldingForm.quantity} onChange={e => setEditHoldingForm({ ...editHoldingForm, quantity: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Premium per unit</label>
                                        <Input type="number" value={editHoldingForm.avg_buy_price} onChange={e => setEditHoldingForm({ ...editHoldingForm, avg_buy_price: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Contract multiplier</label>
                                        <Input type="number" value={editHoldingForm.contract_multiplier} onChange={e => setEditHoldingForm({ ...editHoldingForm, contract_multiplier: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Position type</label>
                                        <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={editHoldingForm.position_type} onChange={e => setEditHoldingForm({ ...editHoldingForm, position_type: e.target.value })}>
                                          <option value="long">Long</option>
                                          <option value="short">Short ⚠️</option>
                                        </select>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Current value (total)</label>
                                        <Input type="number" value={editHoldingForm.current_value} onChange={e => setEditHoldingForm({ ...editHoldingForm, current_value: e.target.value })} />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Currency</label>
                                        <Input maxLength={3} value={editHoldingForm.currency} onChange={e => setEditHoldingForm({ ...editHoldingForm, currency: e.target.value.toUpperCase() })} />
                                      </div>
                                      {editHoldingForm.position_type === "short" && (
                                        <div className="col-span-3 flex items-center gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-xs">
                                          <AlertTriangle className="h-4 w-4 shrink-0" />
                                          Short positions carry unlimited max loss.
                                        </div>
                                      )}
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
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>

    {/* Broker Import Modal */}
    {brokerModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { if (!brokerImporting) setBrokerModal(null); }}>
        <div className="bg-card border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
          <div>
            <h2 className="text-base font-semibold">Broker Import</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Import holdings from your broker's portfolio export file. Existing holdings are matched by ISIN or ticker and updated; new positions are added.</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Broker</label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={brokerType}
              onChange={e => setBrokerType(e.target.value)}
            >
              <option value="ibkr">IBKR — Interactive Brokers (Flex Query XML)</option>
              <option value="etoro">eToro (portfolio CSV)</option>
              <option value="altshuler_shaham">Altshuler Shaham Trade (CSV / Excel)</option>
              <option value="altrade">ALTrade (CSV / Excel)</option>
            </select>
          </div>

          {brokerType === "ibkr" && (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              In IBKR Account Management: Reports → Flex Queries → Create query with <strong>Open Positions</strong> section → Run → Download XML.
            </p>
          )}
          {(brokerType === "altshuler_shaham" || brokerType === "altrade") && (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              Export your portfolio from the broker's web portal as CSV or Excel (.xlsx). Both Hebrew and English column names are supported.
            </p>
          )}

          {!brokerResult ? (
            <label className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 cursor-pointer transition-colors ${brokerImporting ? "opacity-50 pointer-events-none" : "hover:border-primary/50 hover:bg-muted/30"}`}>
              <input
                type="file"
                className="sr-only"
                accept=".csv,.xlsx,.xml"
                disabled={brokerImporting}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) importBrokerFile(brokerModal.accountId, f);
                  e.target.value = "";
                }}
              />
              {brokerImporting ? (
                <span className="text-sm text-muted-foreground animate-pulse">Importing…</span>
              ) : (
                <>
                  <span className="text-sm font-medium">Click to select file</span>
                  <span className="text-xs text-muted-foreground">.csv, .xlsx or .xml accepted</span>
                </>
              )}
            </label>
          ) : (
            <div className={`rounded-lg border px-4 py-3 text-sm space-y-1 ${brokerResult.errors.length > 0 && brokerResult.imported === 0 && brokerResult.updated === 0 ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400" : "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"}`}>
              <p className="font-medium">
                {brokerResult.imported} new · {brokerResult.updated} updated · {brokerResult.skipped} skipped
              </p>
              {brokerResult.errors.length > 0 && (
                <ul className="text-xs space-y-0.5 mt-1">
                  {brokerResult.errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            {brokerResult && (
              <Button variant="outline" size="sm" onClick={() => setBrokerResult(null)}>Import another</Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setBrokerModal(null)} disabled={brokerImporting}>Close</Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
