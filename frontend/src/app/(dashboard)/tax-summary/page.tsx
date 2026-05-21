"use client";

import { useEffect, useState, useCallback } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, DollarSign, Receipt, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface RealizedRow {
  ticker: string;
  asset_name: string;
  sell_date: string;
  proceeds: number;
  cost_basis: number;
  gain: number;
  holding_days: number;
  is_long_term: boolean;
  currency: string;
}

interface DividendRow {
  ticker: string;
  asset_name: string;
  pay_date: string;
  amount: number;
  currency: string;
}

interface TaxYearSummary {
  year: number;
  total_gains: number;
  total_losses: number;
  net_realized: number;
  total_dividends: number;
  estimated_tax: number;
  realized_rows: RealizedRow[];
  dividend_rows: DividendRow[];
}

interface TaxSummaryData {
  available_years: number[];
  selected_year: number | null;
  summary: TaxYearSummary | null;
}

// ── Stat card ──────────────────────────────────────────────────────────────

function StatCard({
  label, value, currency, positive, icon: Icon,
}: {
  label: string;
  value: number;
  currency?: string;
  positive?: boolean;
  icon: React.ElementType;
}) {
  const color = positive === undefined
    ? "bg-blue-500/10 text-blue-500"
    : positive
    ? "bg-emerald-500/10 text-emerald-500"
    : "bg-red-500/10 text-red-500";
  const textColor = positive === undefined ? "" : positive ? "text-emerald-500" : "text-red-500";
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-semibold mt-1 tabular-nums ${textColor}`}>
              {currency ? formatCurrency(value, currency) : value.toLocaleString()}
            </p>
          </div>
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function TaxSummaryPage() {
  const investorId = useInvestorId();
  const [data, setData] = useState<TaxSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showDividends, setShowDividends] = useState(false);

  const load = useCallback(async (year?: number) => {
    if (!investorId) return;
    setLoading(true);
    const url = `/api/v1/investors/${investorId}/tax-summary${year ? `?year=${year}` : ""}`;
    const r = await fetch(url);
    if (r.ok) {
      const d: TaxSummaryData = await r.json();
      setData(d);
      setSelectedYear(d.selected_year);
    }
    setLoading(false);
  }, [investorId]);

  useEffect(() => { load(); }, [load]);

  function handleYearChange(year: number) {
    setSelectedYear(year);
    load(year);
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-48 bg-muted rounded" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.available_years.length) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl space-y-4">
        <h1 className="text-xl font-semibold">Tax Summary</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <Receipt className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-medium">No transaction data yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Import your transaction history to see realized gains and estimated tax.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const s = data.summary;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Tax Summary</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Realized capital gains · WACC method · For reference only
          </p>
        </div>

        {/* Year selector */}
        <div className="flex gap-1.5 flex-wrap">
          {data.available_years.map(y => (
            <button
              key={y}
              onClick={() => handleYearChange(y)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                y === selectedYear
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-400">
          This is an estimate using weighted average cost method. Verify with your broker&apos;s official statements before filing taxes. Tax laws vary by jurisdiction.
        </p>
      </div>

      {s && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Realized Gains" value={s.total_gains} positive={true} icon={TrendingUp} />
            <StatCard label="Realized Losses" value={s.total_losses} positive={false} icon={TrendingDown} />
            <StatCard label="Net P&L" value={s.net_realized} positive={s.net_realized >= 0} icon={DollarSign} />
            <StatCard label="Est. Tax (25%)" value={s.estimated_tax} icon={Receipt} />
          </div>

          {/* Dividends summary if any */}
          {s.total_dividends > 0 && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Total Dividends Received</span>
                  <span className="tabular-nums font-semibold">{s.total_dividends.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Included in estimated tax above at 25% rate.</p>
              </CardContent>
            </Card>
          )}

          {/* Realized gains table */}
          {s.realized_rows.length > 0 ? (
            <Card>
              <div className="px-5 py-4 border-b border-border">
                <p className="text-sm font-medium">Realized Transactions ({s.year})</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-5 py-2.5 text-xs text-muted-foreground font-medium">Ticker</th>
                      <th className="text-left px-3 py-2.5 text-xs text-muted-foreground font-medium">Sold</th>
                      <th className="text-right px-3 py-2.5 text-xs text-muted-foreground font-medium">Proceeds</th>
                      <th className="text-right px-3 py-2.5 text-xs text-muted-foreground font-medium">Cost Basis</th>
                      <th className="text-right px-3 py-2.5 text-xs text-muted-foreground font-medium">Gain/Loss</th>
                      <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-medium">Term</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.realized_rows.map((row, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-mono font-semibold text-xs">{row.ticker}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[140px]">{row.asset_name}</p>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground text-xs whitespace-nowrap">
                          {new Date(row.sell_date).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-xs">
                          {row.proceeds.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-xs text-muted-foreground">
                          {row.cost_basis > 0 ? row.cost_basis.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
                        </td>
                        <td className={`px-3 py-3 text-right tabular-nums text-xs font-medium ${
                          row.gain >= 0 ? "text-emerald-500" : "text-red-500"
                        }`}>
                          {row.gain >= 0 ? "+" : ""}{row.gain.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Badge variant={row.is_long_term ? "muted" : "default"} className="text-[10px]">
                            {row.is_long_term ? "Long" : "Short"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-border bg-muted/30">
                    <tr>
                      <td colSpan={4} className="px-5 py-2.5 text-xs font-medium">Total</td>
                      <td className={`px-3 py-2.5 text-right text-xs font-bold tabular-nums ${
                        s.net_realized >= 0 ? "text-emerald-500" : "text-red-500"
                      }`}>
                        {s.net_realized >= 0 ? "+" : ""}{s.net_realized.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No sell transactions recorded for {s.year}.</p>
              </CardContent>
            </Card>
          )}

          {/* Dividend detail (collapsible) */}
          {s.dividend_rows.length > 0 && (
            <Card>
              <button
                onClick={() => setShowDividends(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-sm font-medium">Dividends ({s.dividend_rows.length})</span>
                {showDividends ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {showDividends && (
                <div className="px-5 pb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-xs text-muted-foreground font-medium">Ticker</th>
                        <th className="text-left py-2 text-xs text-muted-foreground font-medium">Date</th>
                        <th className="text-right py-2 text-xs text-muted-foreground font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.dividend_rows.map((d, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          <td className="py-2.5 font-mono font-semibold text-xs">{d.ticker}</td>
                          <td className="py-2.5 text-muted-foreground text-xs">{new Date(d.pay_date).toLocaleDateString()}</td>
                          <td className="py-2.5 text-right tabular-nums text-xs">
                            {d.currency} {d.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
