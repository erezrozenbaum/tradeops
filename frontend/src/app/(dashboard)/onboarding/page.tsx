"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2, Circle, ArrowRight, Sparkles,
  User, Wallet, Target, Shield, ChevronRight,
} from "lucide-react";
import { useInvestorId } from "@/hooks/useInvestorId";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StepStatus {
  hasProfile: boolean;
  hasFinancial: boolean;
  hasGoals: boolean;
  hasRiskModel: boolean;
}

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  {
    number: 1,
    key: "hasProfile" as keyof StepStatus,
    icon: User,
    title: "Complete your investor profile",
    description: "Your name, date of birth, base currency, experience level, and investment horizon. This is the foundation everything else builds on.",
    unlocks: "Personalised risk assessment, education mode for minors, maturity tracking",
    href: "/profile",
    cta: "Set up profile",
  },
  {
    number: 2,
    key: "hasFinancial" as keyof StepStatus,
    icon: Wallet,
    title: "Add your financial data",
    description: "Monthly income and expenses, your assets, liabilities, and emergency fund. Takes about 5 minutes. This is where the system starts understanding your real situation.",
    unlocks: "Financial Stability Score, net worth tracking, cash flow analysis, investment readiness check",
    href: "/financial",
    cta: "Add finances",
  },
  {
    number: 3,
    key: "hasGoals" as keyof StepStatus,
    icon: Target,
    title: "Set your first financial goal",
    description: "Retirement, house purchase, emergency fund, education — any concrete target with a date and amount. Goals turn abstract savings into a plan.",
    unlocks: "Monthly contribution plan, goal progress tracking, gap analysis, contribution budget card",
    href: "/goals",
    cta: "Add a goal",
  },
  {
    number: 4,
    key: "hasRiskModel" as keyof StepStatus,
    icon: Shield,
    title: "Generate your risk model",
    description: "The system computes your investable capital, and splits it into Low Risk / Growth / High Risk tiers based on your stability score and goals. This is what makes investment recommendations safe and personalised.",
    unlocks: "Strategy recommendations, backtesting, paper trading, portfolio rebalancing, Command Center",
    href: "/risk",
    cta: "Generate risk model",
  },
];

// ─── Step card ────────────────────────────────────────────────────────────────

function StepCard({
  step,
  done,
  active,
  onActivate,
}: {
  step: typeof STEPS[number];
  done: boolean;
  active: boolean;
  onActivate: () => void;
}) {
  const Icon = step.icon;
  return (
    <div
      className={`rounded-xl border transition-all cursor-pointer ${
        done
          ? "border-emerald-500/30 bg-emerald-500/5"
          : active
          ? "border-primary/40 bg-primary/5 shadow-lg"
          : "border-border/60 bg-card hover:border-border"
      }`}
      onClick={onActivate}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Icon + step number */}
          <div className={`shrink-0 flex flex-col items-center gap-1.5`}>
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
              done ? "bg-emerald-500/15" : active ? "bg-primary/15" : "bg-muted"
            }`}>
              {done
                ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                : <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />}
            </div>
            <span className={`text-[10px] font-bold ${done ? "text-emerald-500" : active ? "text-primary" : "text-muted-foreground/40"}`}>
              {done ? "Done" : `Step ${step.number}`}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-semibold mb-1 ${done ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
              {step.title}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              {step.description}
            </p>
            <div className="rounded-lg bg-muted/40 px-3 py-2 mb-3">
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-0.5">Unlocks</p>
              <p className="text-xs text-muted-foreground">{step.unlocks}</p>
            </div>
            {!done && (
              <Link
                href={step.href}
                onClick={(e) => e.stopPropagation()}
                className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
                  active ? "text-primary hover:text-primary/80" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {step.cta} <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const investorId = useInvestorId();
  const router = useRouter();
  const [status, setStatus] = useState<StepStatus>({
    hasProfile: false,
    hasFinancial: false,
    hasGoals: false,
    hasRiskModel: false,
  });
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!investorId) return;
    Promise.all([
      fetch(`/api/v1/investors/${investorId}/dashboard`).then(r => r.ok ? r.json() : null),
      fetch(`/api/v1/investors/${investorId}/risk-model`).then(r => r.ok ? r.json() : null),
    ]).then(([dash, risk]) => {
      const s: StepStatus = {
        hasProfile: true, // if we got a dashboard response, profile exists
        hasFinancial: !!(dash?.net_worth || dash?.cash_flow),
        hasGoals: !!(dash?.goals?.length > 0),
        hasRiskModel: !!risk,
      };
      setStatus(s);
      // Auto-select first incomplete step
      const firstIncomplete = STEPS.findIndex(step => !s[step.key]);
      setActiveStep(firstIncomplete === -1 ? STEPS.length - 1 : firstIncomplete);
    }).finally(() => setLoading(false));
  }, [investorId]);

  const completedCount = STEPS.filter(s => status[s.key]).length;
  const allDone = completedCount === STEPS.length;

  function finish() {
    localStorage.setItem("tradeops_onboarding_dismissed", "1");
    router.push("/command-center");
  }

  return (
    <div className="min-h-screen p-6 sm:p-10 lg:p-16 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-8">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-primary/10 mb-2">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {allDone ? "You're all set." : "Set up TradeOps AI"}
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {allDone
              ? "Your Command Center is ready. Everything is personalised to your financial situation."
              : "Four steps to unlock your personalised financial intelligence platform. Takes about 10 minutes."}
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{completedCount} of {STEPS.length} complete</span>
            <span>{Math.round((completedCount / STEPS.length) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Step cards */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {STEPS.map((step, i) => (
              <StepCard
                key={step.key}
                step={step}
                done={status[step.key]}
                active={i === activeStep}
                onActivate={() => setActiveStep(i)}
              />
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={finish}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {allDone ? null : "Skip for now"}
          </button>
          <button
            onClick={finish}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              allDone
                ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
            }`}
          >
            {allDone ? "Go to Command Center" : "Continue to dashboard"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Footer note */}
        <p className="text-[11px] text-muted-foreground/40 text-center">
          All data stays on your device and your private server. Nothing is shared externally.
        </p>
      </div>
    </div>
  );
}
