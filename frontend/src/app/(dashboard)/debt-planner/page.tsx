"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { TrendingDown, CalendarCheck, Banknote, ArrowRight } from "lucide-react";

interface DebtItem {
  id: string;
  name: string;
  liability_type: string;
  outstanding_balance: number;
  monthly_payment: number;
  interest_rate_pct: number;
  currency: string;
  priority: number;
  payoff_months: number;
  payoff_date: string;
  total_interest: number;
}

interface DebtPlanResult {
  strategy: string;
  total_debt: number;
  currency: string;
  monthly_minimum: number;
  extra_monthly: number;
  effective_monthly: number;
  months_to_debt_free: number;
  debt_free_date: string;
  total_interest_paid: number;
  total_paid: number;
  debts: DebtItem[];
  no_debts: boolean;
}

const LIABILITY_LABELS: Record<string, string> = {
  mortgage: "Mortgage",
  car_loan: "Car Loan",
  personal_loan: "Personal Loan",
  credit_card: "Credit Card",
  student_loan: "Student Loan",
  other: "Other",
};

function months(n: number): string {
  if (n < 12) return `${n}mo`;
  const y = Math.floor(n / 12);
  const m = n % 12;
  return m > 0 ? `${y}y ${m}mo` : `${y}y`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function DebtPlannerPage() {
  const investorId = useInvestorId();
  const [strategy, setStrategy] = useState<"avalanche" | "snowball">("avalanche");
  const [extra, setExtra] = useState(0);
  const [extraInput, setExtraInput] = useState("0");
  const [plan, setPlan] = useState<DebtPlanResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!investorId) return;
    load();
  }, [investorId, strategy, extra]);

  async function load() {
    setLoading(true);
    const r = await fetch(
      `/api/v1/investors/${investorId}/debt-planner?strategy=${strategy}&extra_monthly=${extra}`
    );
    if (r.ok) setPlan(await r.json());
    setLoading(false);
  }

  if (loading && !plan) {
    return <div className="p-8 text-muted-foreground text-sm">Loading…</div>;
  }

  if (plan?.no_debts) {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-xl font-semibold mb-2">Debt Payoff Planner</h1>
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <p className="text-4xl mb-3">🎉</p>
            <p className="font-semibold text-lg">You have no outstanding debt</p>
            <p className="text-muted-foreground text-sm mt-1">
              Add liabilities in your Financial profile to use this planner.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Debt Payoff Planner</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Find the fastest path to debt freedom
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap gap-6 items-end">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Strategy</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setStrategy("avalanche")}
                  className={`px-4 py-1.5 rounded-md text-sm border transition-colors ${
                    strategy === "avalanche"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-input text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Avalanche — highest interest first
                </button>
                <button
                  onClick={() => setStrategy("snowball")}
                  className={`px-4 py-1.5 rounded-md text-sm border transition-colors ${
                    strategy === "snowball"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-input text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Snowball — smallest balance first
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Extra monthly payment</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={extraInput}
                  onChange={e => setExtraInput(e.target.value)}
                  onBlur={() => setExtra(Math.max(0, parseFloat(extraInput) || 0))}
                  className="w-28 h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                />
                <span className="text-sm text-muted-foreground">{plan?.currency}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      {plan && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">Total debt</p>
                <p className="text-xl font-semibold text-red-500">
                  {formatCurrency(plan.total_debt, plan.currency)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">Monthly payment</p>
                <p className="text-xl font-semibold">
                  {formatCurrency(plan.effective_monthly, plan.currency)}
                </p>
                {plan.extra_monthly > 0 && (
                  <p className="text-xs text-green-600 mt-0.5">
                    +{formatCurrency(plan.extra_monthly, plan.currency)} extra
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">Total interest</p>
                <p className="text-xl font-semibold text-amber-500">
                  {formatCurrency(plan.total_interest_paid, plan.currency)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <CalendarCheck className="h-3.5 w-3.5" /> Debt-free date
                </p>
                <p className="text-xl font-semibold text-green-600">
                  {fmtDate(plan.debt_free_date)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {months(plan.months_to_debt_free)} from now
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Strategy explanation */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <TrendingDown className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">
                    {strategy === "avalanche"
                      ? "Avalanche strategy — mathematically optimal"
                      : "Snowball strategy — motivation-first approach"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {strategy === "avalanche"
                      ? "Pay minimums on all debts, then throw every extra dollar at the highest-interest debt first. Saves the most money overall."
                      : "Pay minimums on all debts, then target the smallest balance first. Each payoff gives a psychological win that keeps you going."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Debt list */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Payoff order
            </h2>
            {plan.debts.map((debt, idx) => {
              const pct = Math.min(
                100,
                ((plan.total_debt - debt.outstanding_balance) / plan.total_debt) * 100
              );
              return (
                <Card key={debt.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                          {debt.priority}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{debt.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {LIABILITY_LABELS[debt.liability_type] ?? debt.liability_type}
                            {debt.interest_rate_pct > 0 && ` · ${debt.interest_rate_pct}% p.a.`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm">
                          {formatCurrency(debt.outstanding_balance, debt.currency)}
                        </p>
                        <Badge variant="muted" className="text-xs mt-0.5">
                          {months(debt.payoff_months)} · {fmtDate(debt.payoff_date)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <Banknote className="h-3.5 w-3.5 shrink-0" />
                      <span>Min payment {formatCurrency(debt.monthly_payment, debt.currency)}/mo</span>
                      <ArrowRight className="h-3 w-3" />
                      <span>Interest to pay {formatCurrency(debt.total_interest, debt.currency)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
