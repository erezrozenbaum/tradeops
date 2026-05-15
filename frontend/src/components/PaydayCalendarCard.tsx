"use client";

import { useEffect, useState } from "react";
import { CalendarDays, TrendingUp, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface DividendHolding {
  holding_id: string;
  name: string;
  ticker: string;
  quantity: number;
  annual_dividend_per_share: number;
  annual_income: number;
  yield_on_cost: number;
  yield_on_value: number;
  next_ex_date: string | null;
  pay_frequency: string;
}

interface IncomeResult {
  currency: string;
  total_annual_income: number;
  portfolio_yield_on_value: number;
  portfolio_yield_on_cost: number;
  holdings: DividendHolding[];
  upcoming_ex_dates: {
    ticker: string;
    name: string;
    ex_date: string;
    estimated_payment: number;
    currency: string;
  }[];
  monthly_income: Record<string, number>;
}

function CustomTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-muted-foreground mb-1">{MONTH_LABELS[Number(label) - 1]}</p>
      <p className="font-bold">{formatCurrency(payload[0].value, currency)}</p>
    </div>
  );
}

export function PaydayCalendarCard({ investorId }: { investorId: string }) {
  const [data, setData] = useState<IncomeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showHoldings, setShowHoldings] = useState(false);

  const load = async (showSpin = false) => {
    if (!investorId) return;
    if (showSpin) setRefreshing(true);
    try {
      const r = await fetch(`/api/v1/investors/${investorId}/portfolio/income`);
      if (r.ok) setData(await r.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [investorId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4" /> Payday Calendar</CardTitle></CardHeader>
        <CardContent><div className="h-32 animate-pulse rounded bg-muted" /></CardContent>
      </Card>
    );
  }

  if (!data || data.total_annual_income <= 0) return null;

  const currentMonth = new Date().getMonth() + 1;
  const chartData = Object.entries(data.monthly_income)
    .map(([m, v]) => ({ month: Number(m), value: v }))
    .sort((a, b) => a.month - b.month);

  const maxMonth = chartData.reduce((a, b) => (b.value > a.value ? b : a), chartData[0]);
  const nextUpcoming = data.upcoming_ex_dates[0] ?? null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-green-500" />
            Payday Calendar
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">Expected dividend income by calendar month</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Annual Income</p>
            <p className="text-base font-bold text-green-500">{formatCurrency(data.total_annual_income, data.currency)}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Yield on Value</p>
            <p className="text-base font-bold">{data.portfolio_yield_on_value.toFixed(2)}%</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Best Month</p>
            <p className="text-base font-bold">{MONTH_LABELS[maxMonth.month - 1]}</p>
            <p className="text-[10px] text-muted-foreground">{formatCurrency(maxMonth.value, data.currency)}</p>
          </div>
        </div>

        {/* Monthly bar chart */}
        <div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={(m) => MONTH_LABELS[m - 1]}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip content={<CustomTooltip currency={data.currency} />} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell
                    key={entry.month}
                    fill={
                      entry.month === currentMonth
                        ? "hsl(var(--primary))"
                        : entry.value > 0
                        ? "#22c55e"
                        : "hsl(var(--muted))"
                    }
                    opacity={entry.month === currentMonth ? 1 : 0.7}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-muted-foreground text-center mt-1">
            Highlighted bar = current month · Green = expected income
          </p>
        </div>

        {/* Next payday */}
        {nextUpcoming && (
          <div className="flex items-center gap-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 px-3 py-2.5">
            <TrendingUp className="h-4 w-4 text-green-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">Next payday — {nextUpcoming.name}
                <span className="font-mono text-muted-foreground ml-1.5 text-[10px]">{nextUpcoming.ticker}</span>
              </p>
              <p className="text-[10px] text-muted-foreground">
                Ex-dividend: {new Date(nextUpcoming.ex_date).toLocaleDateString()} ·
                Est. {formatCurrency(nextUpcoming.estimated_payment, data.currency)}
              </p>
            </div>
          </div>
        )}

        {/* Holdings table toggle */}
        {data.holdings.length > 0 && (
          <div>
            <button
              onClick={() => setShowHoldings(!showHoldings)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showHoldings ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showHoldings ? "Hide" : "Show"} {data.holdings.length} dividend-paying holdings
            </button>

            {showHoldings && (
              <div className="mt-2 rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Holding</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Frequency</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Yield</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Annual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.holdings.map((h) => (
                      <tr key={h.holding_id} className="hover:bg-muted/20">
                        <td className="px-3 py-2">
                          <span className="font-medium">{h.name}</span>
                          <span className="font-mono text-muted-foreground ml-1.5 text-[10px]">{h.ticker}</span>
                        </td>
                        <td className="px-3 py-2 text-right capitalize text-muted-foreground">{h.pay_frequency}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          <Badge variant="muted" className="text-[10px]">{h.yield_on_value.toFixed(2)}%</Badge>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-green-500">
                          {formatCurrency(h.annual_income, data.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
