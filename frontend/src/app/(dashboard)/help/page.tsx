"use client";

import Link from "next/link";
import {
  LayoutDashboard, User, Wallet, Target, Shield, Lightbulb,
  BarChart2, TrendingUp, Briefcase, Activity, ClipboardList,
  Eye, CreditCard, Bot, Wand2, Microscope, ScanSearch,
  Sparkles, Bell, FileText, HelpCircle, ArrowRight, Terminal,
  Database, Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SECTIONS = [
  {
    title: "Personal Setup",
    description: "Complete your profile first — the AI and all recommendations depend on this data.",
    color: "border-blue-200/60 bg-blue-500/5",
    dot: "bg-blue-500",
    pages: [
      {
        label: "Profile", href: "/profile", icon: User,
        desc: "Your identity, age, country, and experience level. Used to determine suitability for investment products and apply the correct tax rules.",
      },
      {
        label: "Financial", href: "/financial", icon: Wallet,
        desc: "Income, expenses, savings, assets, and debts. Required to compute your Financial Stability Score and investable capital.",
      },
      {
        label: "Goals", href: "/goals", icon: Target,
        desc: "Define what you're saving for (retirement, house, education) and by when. The AI tracks progress and adjusts recommendations accordingly.",
      },
    ],
  },
  {
    title: "Strategy & Risk",
    description: "Build your investment framework before putting money to work.",
    color: "border-amber-200/60 bg-amber-500/5",
    dot: "bg-amber-500",
    pages: [
      {
        label: "Risk Model", href: "/risk", icon: Shield,
        desc: "Sets the percentage of capital allocated to low-risk, growth, and high-risk buckets. Generated from your financial profile and stability score.",
      },
      {
        label: "Strategies", href: "/strategies", icon: Lightbulb,
        desc: "Browse and select strategy templates (ETF blend, growth, dividend, etc.). Each template includes asset allocation rules and rationale.",
      },
      {
        label: "Backtesting", href: "/backtesting", icon: BarChart2,
        desc: "Test your selected strategy against historical data. Review total return, drawdowns, and win rates before risking real capital.",
      },
      {
        label: "Paper Trading", href: "/paper-trading", icon: TrendingUp,
        desc: "Run your strategy on a simulated portfolio with live prices. Validate performance before committing real funds.",
      },
    ],
  },
  {
    title: "Portfolio",
    description: "Manage and monitor your real holdings and transactions.",
    color: "border-emerald-200/60 bg-emerald-500/5",
    dot: "bg-emerald-500",
    pages: [
      {
        label: "Investments", href: "/investments", icon: Briefcase,
        desc: "View all your investment accounts and holdings. Add accounts and positions manually. Prices refresh on demand via Yahoo Finance.",
      },
      {
        label: "Performance", href: "/performance", icon: Activity,
        desc: "Equity curve, Sharpe ratio, Sortino ratio, max drawdown, and S&P 500 benchmark comparison. Snapshots captured daily at 21:00 UTC.",
      },
      {
        label: "Transactions", href: "/transactions", icon: ClipboardList,
        desc: "Complete log of buys, sells, dividends, and fees. Add transactions manually to maintain an accurate trade history.",
      },
      {
        label: "Watchlist", href: "/watchlist", icon: Eye,
        desc: "Track tickers you're watching but haven't bought. Set price alerts (above/below a target) — you'll be notified when triggered.",
      },
      {
        label: "Debt Planner", href: "/debt-planner", icon: CreditCard,
        desc: "Model your debt payoff schedule and see how it affects your investable capital. The AI factors this into its recommendations.",
      },
    ],
  },
  {
    title: "AI Intelligence",
    description: "AI-powered analysis — requires ANTHROPIC_API_KEY to be configured.",
    color: "border-violet-200/60 bg-violet-500/5",
    dot: "bg-violet-500",
    pages: [
      {
        label: "AI Agent", href: "/agent", icon: Bot,
        desc: "Free-form financial assistant. Ask questions about your portfolio, explain concepts, or get second opinions on investment ideas.",
      },
      {
        label: "Recommendations", href: "/recommendations", icon: Wand2,
        desc: "AI-generated investment recommendations tailored to your risk model, goals, and current holdings. Refreshes on demand.",
      },
      {
        label: "Market Research", href: "/market-research", icon: Microscope,
        desc: "Screens 60+ stocks and ETFs for fundamental quality (P/E, growth, analyst upside). Claude generates investment theses across three tiers. Takes 45-60 seconds. Results cached for 6 hours.",
      },
      {
        label: "Market Scan", href: "/market-scan", icon: ScanSearch,
        desc: "Real-time live market signals: momentum, volume anomalies, sector rotation. Refreshes every 30 minutes via background worker.",
      },
      {
        label: "AI Report", href: "/reports", icon: Sparkles,
        desc: "Comprehensive AI financial report covering your full profile, risk exposure, goals progress, and forward-looking recommendations.",
      },
    ],
  },
  {
    title: "System",
    description: "Notifications, audit trail, and configuration.",
    color: "border-border bg-muted/20",
    dot: "bg-muted-foreground",
    pages: [
      {
        label: "Notifications", href: "/notifications", icon: Bell,
        desc: "System notifications including triggered price alerts, goal milestones, and risk warnings. Computed dynamically on each visit.",
      },
      {
        label: "Audit Log", href: "/audit", icon: FileText,
        desc: "Tamper-proof log of all significant actions (profile changes, strategy selections, report generation). Useful for compliance.",
      },
    ],
  },
];

const ONBOARDING_STEPS = [
  { step: 1, label: "Create your investor profile", href: "/profile", icon: User },
  { step: 2, label: "Fill in your financial profile", href: "/financial", icon: Wallet },
  { step: 3, label: "Define your financial goals", href: "/goals", icon: Target },
  { step: 4, label: "Generate your risk model", href: "/risk", icon: Shield },
  { step: 5, label: "Select a strategy template", href: "/strategies", icon: Lightbulb },
  { step: 6, label: "Run a backtest", href: "/backtesting", icon: BarChart2 },
  { step: 7, label: "Start paper trading", href: "/paper-trading", icon: TrendingUp },
  { step: 8, label: "Add your real holdings", href: "/investments", icon: Briefcase },
];

const TECH_NOTES = [
  {
    icon: Zap,
    title: "AI features require an API key",
    body: "Set ANTHROPIC_API_KEY in backend/.env and restart the backend container. Without it, AI Report, Recommendations, Market Research, and the AI Agent will return an error.",
  },
  {
    icon: Database,
    title: "Performance snapshots are daily",
    body: "The equity curve and risk metrics (Sharpe, drawdown) are computed from daily portfolio snapshots. The snapshot worker runs at 21:00 UTC. New accounts will see data the following day.",
  },
  {
    icon: Terminal,
    title: "Applying database migrations",
    body: "Migrations run automatically when the backend container starts. To apply manually: docker compose exec backend alembic upgrade head",
  },
];

export default function HelpPage() {
  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <HelpCircle className="h-6 w-6" />
          User Guide
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          How TradeOps AI works — what each page does and how to get started
        </p>
      </div>

      {/* Recommended onboarding flow */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recommended onboarding flow</CardTitle>
          <p className="text-xs text-muted-foreground">
            Complete these steps in order. Each step unlocks better AI recommendations.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ONBOARDING_STEPS.map(({ step, label, href, icon: Icon }) => (
              <Link
                key={step}
                href={href}
                className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Step {step}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium leading-snug">{label}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Page guide by section */}
      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`h-2.5 w-2.5 rounded-full ${section.dot}`} />
              <h2 className="text-sm font-semibold">{section.title}</h2>
              <span className="text-xs text-muted-foreground">— {section.description}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {section.pages.map(({ label, href, icon: Icon, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className={`rounded-lg border p-4 hover:shadow-sm transition-all group ${section.color}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    <span className="text-sm font-medium group-hover:text-foreground transition-colors">{label}</span>
                    <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Technical notes */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Technical notes</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {TECH_NOTES.map(({ icon: Icon, title, body }) => (
            <Card key={title}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold mb-1">{title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
