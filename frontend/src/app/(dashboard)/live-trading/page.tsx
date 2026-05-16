"use client";

import { useState, useEffect } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Zap,
  StopCircle,
  RefreshCw,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GateStatus {
  passed: boolean;
  label: string;
  detail: string;
}

interface Readiness {
  all_gates_passed: boolean;
  gates: GateStatus[];
  sharpe_ratio: number | null;
  paper_days: number | null;
}

interface Session {
  id: string;
  is_active: boolean;
  acknowledged_risk: boolean;
  acknowledged_at: string | null;
  halted_at: string | null;
  halt_reason: string | null;
  ibkr_account_id: string;
  gateway_url: string;
}

interface LiveOrder {
  id: string;
  ticker: string;
  order_type: string;
  side: string;
  quantity: number;
  limit_price: number | null;
  estimated_value: number | null;
  ibkr_order_id: string | null;
  status: string;
  submitted_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

// ── Status badge ──────────────────────────────────────────────────────────────

const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  pending:   { label: "Pending",   color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  submitted: { label: "Submitted", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  filled:    { label: "Filled",    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  rejected:  { label: "Rejected",  color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  cancelled: { label: "Cancelled", color: "bg-muted text-muted-foreground" },
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LiveTradingPage() {
  const investorId = useInvestorId();

  // Connection config
  const [gatewayUrl, setGatewayUrl] = useState("https://localhost:5000");
  const [ibkrAccountId, setIbkrAccountId] = useState("");

  // Readiness
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);

  // Session
  const [session, setSession] = useState<Session | null>(null);

  // Acknowledgment
  const [ackConfirmation, setAckConfirmation] = useState("");
  const [ackLoading, setAckLoading] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);

  // Activate
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);

  // Order form
  const [ticker, setTicker] = useState("");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Orders list
  const [orders, setOrders] = useState<LiveOrder[]>([]);

  // Halt
  const [halting, setHalting] = useState(false);
  const [haltConfirm, setHaltConfirm] = useState(false);

  useEffect(() => {
    if (!investorId) return;
    loadOrders();
  }, [investorId]);

  async function checkReadiness() {
    if (!investorId) return;
    setReadinessLoading(true);
    try {
      const params = new URLSearchParams();
      if (gatewayUrl) params.set("gateway_url", gatewayUrl);
      if (ibkrAccountId) params.set("ibkr_account_id", ibkrAccountId);
      const res = await fetch(`/api/v1/investors/${investorId}/live-trading/status?${params}`);
      if (res.ok) setReadiness(await res.json());
    } finally {
      setReadinessLoading(false);
    }
  }

  async function acknowledge() {
    if (!investorId || ackConfirmation !== "I UNDERSTAND") return;
    setAckLoading(true);
    setAckError(null);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/live-trading/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation: ackConfirmation,
          ibkr_account_id: ibkrAccountId,
          gateway_url: gatewayUrl,
        }),
      });
      if (!res.ok) {
        const b = await res.json();
        setAckError(b.detail ?? "Failed to acknowledge");
      } else {
        setSession(await res.json());
        setAckConfirmation("");
        checkReadiness();
      }
    } finally {
      setAckLoading(false);
    }
  }

  async function activateSession() {
    if (!investorId) return;
    setActivating(true);
    setActivateError(null);
    try {
      const params = new URLSearchParams({ gateway_url: gatewayUrl, ibkr_account_id: ibkrAccountId });
      const res = await fetch(`/api/v1/investors/${investorId}/live-trading/session?${params}`, {
        method: "POST",
      });
      if (!res.ok) {
        const b = await res.json();
        setActivateError(b.detail ?? "Failed to activate");
      } else {
        setSession(await res.json());
      }
    } finally {
      setActivating(false);
    }
  }

  async function submitOrder() {
    if (!investorId) return;
    setSubmitting(true);
    setOrderError(null);
    try {
      const body: Record<string, unknown> = {
        ticker: ticker.toUpperCase(),
        order_type: orderType,
        side,
        quantity: parseFloat(quantity),
      };
      if (orderType === "limit" && limitPrice) body.limit_price = parseFloat(limitPrice);
      const res = await fetch(`/api/v1/investors/${investorId}/live-trading/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setOrderError(data.detail ?? "Order failed");
      } else {
        setOrders(prev => [data, ...prev]);
        if (data.status === "rejected") {
          setOrderError(`Order rejected: ${data.rejection_reason}`);
        } else {
          setTicker(""); setQuantity(""); setLimitPrice("");
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function haltTrading() {
    if (!investorId) return;
    setHalting(true);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/live-trading/halt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "User requested halt via dashboard" }),
      });
      if (res.ok) {
        setSession(await res.json());
        setHaltConfirm(false);
        loadOrders();
      }
    } finally {
      setHalting(false);
    }
  }

  async function loadOrders() {
    if (!investorId) return;
    const res = await fetch(`/api/v1/investors/${investorId}/live-trading/orders`);
    if (res.ok) setOrders(await res.json());
  }

  const isActive = session?.is_active ?? false;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Zap className="h-6 w-6 text-amber-500" />
            Live Trading
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-money order execution via IBKR Client Portal Gateway. All 5 safety gates must pass.
          </p>
        </div>
        {isActive && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            LIVE ACTIVE
          </span>
        )}
      </div>

      {/* Warning banner */}
      <div className="flex items-start gap-3 p-4 rounded-lg border border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400 text-sm">
        <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Real money at risk.</p>
          <p className="text-xs mt-0.5 opacity-80">
            Orders submitted here will be executed with real capital via your IBKR account.
            There are no simulations on this page. Only use this if you fully understand the risks.
          </p>
        </div>
      </div>

      {/* IBKR connection config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">IBKR Gateway Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Gateway URL</label>
              <input
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={gatewayUrl}
                onChange={e => setGatewayUrl(e.target.value)}
                placeholder="https://localhost:5000"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">IBKR Account ID</label>
              <input
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={ibkrAccountId}
                onChange={e => setIbkrAccountId(e.target.value)}
                placeholder="U1234567"
              />
            </div>
          </div>
          <Button size="sm" onClick={checkReadiness} disabled={readinessLoading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${readinessLoading ? "animate-spin" : ""}`} />
            Check all gates
          </Button>
        </CardContent>
      </Card>

      {/* Gate checklist */}
      {readiness && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Unlock Requirements
              {readiness.all_gates_passed ? (
                <span className="text-xs font-semibold text-green-600">All gates passed</span>
              ) : (
                <span className="text-xs font-semibold text-red-500">
                  {readiness.gates.filter(g => !g.passed).length} gate(s) not met
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {readiness.gates.map((gate, i) => (
              <div key={i} className="flex items-start gap-3">
                {gate.passed
                  ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  : <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />}
                <div>
                  <p className="text-sm font-medium">{gate.label}</p>
                  <p className="text-xs text-muted-foreground">{gate.detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Risk acknowledgment */}
      {readiness && !session?.acknowledged_risk && (
        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Risk Acknowledgment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Type <strong className="text-foreground">I UNDERSTAND</strong> to confirm you acknowledge
              that orders placed here use real money and you may lose your invested capital.
            </p>
            <div className="flex gap-3">
              <input
                className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                value={ackConfirmation}
                onChange={e => setAckConfirmation(e.target.value)}
                placeholder="I UNDERSTAND"
              />
              <Button
                size="sm"
                disabled={ackConfirmation !== "I UNDERSTAND" || ackLoading || !ibkrAccountId}
                onClick={acknowledge}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {ackLoading ? "Saving…" : "Acknowledge"}
              </Button>
            </div>
            {ackError && <p className="text-xs text-red-500">{ackError}</p>}
          </CardContent>
        </Card>
      )}

      {/* Activate session */}
      {readiness && session?.acknowledged_risk && !isActive && (
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Ready to activate live trading</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                All gates will be re-validated before activation.
              </p>
            </div>
            <Button
              onClick={activateSession}
              disabled={activating || !readiness.all_gates_passed}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {activating ? "Activating…" : "Activate session"}
            </Button>
          </CardContent>
          {activateError && (
            <CardContent className="pt-0">
              <p className="text-xs text-red-500">{activateError}</p>
            </CardContent>
          )}
        </Card>
      )}

      {/* Order form (only when active) */}
      {isActive && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submit Order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Ticker</label>
                <input
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm font-mono uppercase focus:outline-none focus:ring-1 focus:ring-ring"
                  value={ticker}
                  onChange={e => setTicker(e.target.value)}
                  placeholder="AAPL"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Type</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={orderType}
                  onChange={e => setOrderType(e.target.value as "market" | "limit")}
                >
                  <option value="market">Market</option>
                  <option value="limit">Limit</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Side</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={side}
                  onChange={e => setSide(e.target.value as "buy" | "sell")}
                >
                  <option value="buy">Buy</option>
                  <option value="sell">Sell</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Quantity</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="10"
                />
              </div>
            </div>
            {orderType === "limit" && (
              <div className="max-w-[180px] space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Limit price</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={limitPrice}
                  onChange={e => setLimitPrice(e.target.value)}
                  placeholder="150.00"
                />
              </div>
            )}
            {orderError && (
              <div className="flex items-start gap-2 text-xs text-red-500">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                {orderError}
              </div>
            )}
            <div className="flex gap-3">
              <Button
                disabled={submitting || !ticker || !quantity}
                onClick={submitOrder}
                className={side === "buy" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
              >
                {side === "buy" ? <ArrowUp className="h-3.5 w-3.5 mr-1" /> : <ArrowDown className="h-3.5 w-3.5 mr-1" />}
                {submitting ? "Submitting…" : `${side === "buy" ? "Buy" : "Sell"} ${ticker || "…"}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kill switch */}
      {isActive && (
        <Card className="border-red-500/30">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">Emergency halt</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Immediately stops live trading and cancels all open orders.
              </p>
            </div>
            {!haltConfirm ? (
              <Button variant="outline" size="sm" className="border-red-500 text-red-600" onClick={() => setHaltConfirm(true)}>
                <StopCircle className="h-3.5 w-3.5 mr-1.5" />
                Halt trading
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-xs text-red-500 font-medium">Are you sure?</p>
                <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={haltTrading} disabled={halting}>
                  {halting ? "Halting…" : "Yes, halt now"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setHaltConfirm(false)}>Cancel</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Order history */}
      {orders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left pb-2 font-medium">Ticker</th>
                    <th className="text-left pb-2 font-medium">Side</th>
                    <th className="text-right pb-2 font-medium">Qty</th>
                    <th className="text-right pb-2 font-medium">Price</th>
                    <th className="text-right pb-2 font-medium">Est. value</th>
                    <th className="text-left pb-2 font-medium">Status</th>
                    <th className="text-left pb-2 font-medium">IBKR ID</th>
                    <th className="text-right pb-2 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map(o => {
                    const st = ORDER_STATUS[o.status] ?? { label: o.status, color: "bg-muted text-muted-foreground" };
                    return (
                      <tr key={o.id} className="hover:bg-muted/30">
                        <td className="py-2.5 font-mono font-semibold">{o.ticker}</td>
                        <td className="py-2.5">
                          <span className={o.side === "buy" ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                            {o.side.toUpperCase()}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">{o.order_type}</span>
                        </td>
                        <td className="py-2.5 text-right tabular-nums">{o.quantity}</td>
                        <td className="py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                          {o.limit_price ? `$${o.limit_price}` : "MKT"}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-xs">
                          {o.estimated_value ? `$${o.estimated_value.toFixed(2)}` : "—"}
                        </td>
                        <td className="py-2.5">
                          <span className={`inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium ${st.color}`}>
                            {st.label}
                          </span>
                          {o.rejection_reason && (
                            <p className="text-[10px] text-red-500 mt-0.5">{o.rejection_reason}</p>
                          )}
                        </td>
                        <td className="py-2.5 text-xs font-mono text-muted-foreground">{o.ibkr_order_id ?? "—"}</td>
                        <td className="py-2.5 text-right text-xs text-muted-foreground">
                          {new Date(o.created_at).toLocaleTimeString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
