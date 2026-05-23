"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  User,
  Users,
  Wallet,
  Target,
  Shield,
  Lightbulb,
  BarChart2,
  TrendingUp,
  Sparkles,
  FileText,
  Settings,
  LogOut,
  Briefcase,
  ScanSearch,
  Wand2,
  Bell,
  Eye,
  Bot,
  CreditCard,
  Microscope,
  Activity,
  ClipboardList,
  HelpCircle,
  Newspaper,
  Zap,
  Menu,
  X,
  ShieldCheck,
  ArrowLeftRight,
  FileUp,
  Coins,
  Flame,
  Globe,
  PiggyBank,
  Receipt,
  Brain,
  GitBranch,
  Clock,
  Crosshair,
  PieChart,
  Gauge,
  Trophy,
  Cpu,
  AlertTriangle,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

const sections = [
  {
    items: [
      { label: "Command Center", href: "/command-center", icon: Cpu },
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Personal",
    items: [
      { label: "Profile", href: "/profile", icon: User },
      { label: "Family", href: "/family", icon: Users },
      { label: "Financial", href: "/financial", icon: Wallet },
      { label: "Goals", href: "/goals", icon: Target },
      { label: "Net Worth", href: "/net-worth", icon: PiggyBank },
    ],
  },
  {
    label: "Strategy",
    items: [
      { label: "Risk Model", href: "/risk", icon: Shield },
      { label: "Strategies", href: "/strategies", icon: Lightbulb },
      { label: "Backtesting", href: "/backtesting", icon: BarChart2 },
      { label: "Paper Trading", href: "/paper-trading", icon: TrendingUp },
      { label: "Live Trading", href: "/live-trading", icon: Flame },
    ],
  },
  {
    label: "Portfolio",
    items: [
      { label: "Investments", href: "/investments", icon: Briefcase },
      { label: "Performance", href: "/performance", icon: Activity },
      { label: "Stress Test", href: "/stress-test", icon: Zap },
      { label: "Transactions", href: "/transactions", icon: ClipboardList },
      { label: "Watchlist", href: "/watchlist", icon: Eye },
      { label: "Debt Planner", href: "/debt-planner", icon: CreditCard },
      { label: "PDF Import", href: "/pdf-import", icon: FileUp },
      { label: "Crypto Staking", href: "/crypto-staking", icon: Coins },
      { label: "FX Impact", href: "/fx-impact", icon: Globe },
      { label: "Tax Summary", href: "/tax-summary", icon: Receipt },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "AI Agent", href: "/agent", icon: Bot },
      { label: "Recommendations", href: "/recommendations", icon: Wand2 },
      { label: "Market Research", href: "/market-research", icon: Microscope },
      { label: "Market Scan", href: "/market-scan", icon: ScanSearch },
      { label: "AI Report", href: "/reports", icon: Sparkles },
      { label: "News Feed", href: "/news", icon: Newspaper },
      { label: "Pairs Trading", href: "/pairs-trading", icon: ArrowLeftRight },
      { label: "AI Coach", href: "/insights", icon: Brain },
      { label: "Decision Provenance", href: "/decisions", icon: GitBranch },
      { label: "Decision Timeline", href: "/timeline", icon: Clock },
      { label: "Strategy Drift", href: "/strategy-drift", icon: Crosshair },
      { label: "Behavioral Intel", href: "/behavioral", icon: Gauge },
      { label: "Attribution", href: "/attribution", icon: PieChart },
      { label: "Investor Maturity", href: "/maturity", icon: Trophy },
      { label: "Financial Twin", href: "/twin", icon: Cpu },
      { label: "Health Radar", href: "/health-radar", icon: Activity },
      { label: "Behavioral Risk", href: "/behavioral-risk", icon: AlertTriangle },
      { label: "Financial Futures", href: "/futures", icon: Layers },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Notifications", href: "/notifications", icon: Bell },
      { label: "Audit Log", href: "/audit", icon: FileText },
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Help & Guide", href: "/help", icon: HelpCircle },
    ],
  },
];

function SidebarContent({ onNav }: { onNav?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/v1/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u?.role === "admin") setIsAdmin(true); })
      .catch(() => {});
  }, []);

  function handleSwitchProfile() {
    localStorage.removeItem("tradeops_investor_id");
    router.push("/login");
  }

  async function handleSignOut() {
    localStorage.removeItem("tradeops_investor_id");
    await fetch("/api/v1/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
  }

  return (
    <>
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
        {sections.map((section, i) => (
          <div key={i}>
            {section.label && (
              <p className="px-3 mb-1.5 text-[9px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNav}
                      className={cn(
                        "group flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-all duration-150",
                        active
                          ? [
                              "bg-cyber-cyan/10 text-cyber-cyan font-medium",
                              "border border-cyber-cyan/20",
                              "shadow-[0_0_12px_hsl(199_95%_52%/0.08)]",
                            ]
                          : "text-muted-foreground hover:bg-cyber-rule/60 hover:text-foreground border border-transparent"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 transition-colors",
                          active ? "text-cyber-cyan" : "text-muted-foreground/70 group-hover:text-foreground"
                        )}
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Admin + actions */}
      <div className="border-t border-cyber-rule/60 p-2 shrink-0 space-y-0.5">
        {isAdmin && (
          <Link
            href="/admin"
            onClick={onNav}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-all duration-150 border",
              pathname === "/admin"
                ? "bg-cyber-purple/10 text-cyber-purple border-cyber-purple/20"
                : "text-muted-foreground hover:bg-cyber-rule/60 hover:text-foreground border-transparent"
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin Panel
          </Link>
        )}
      </div>
      <div className="border-t border-cyber-rule/60 p-2 shrink-0 space-y-0.5">
        <button
          onClick={handleSwitchProfile}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] text-muted-foreground hover:bg-cyber-rule/60 hover:text-foreground transition-all duration-150 border border-transparent"
        >
          <Users className="h-3.5 w-3.5" />
          Switch profile
        </button>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] text-muted-foreground hover:bg-cyber-red/10 hover:text-cyber-red transition-all duration-150 border border-transparent hover:border-cyber-red/20"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:left-0 lg:top-0 lg:h-screen lg:w-56 lg:flex lg:flex-col lg:z-40"
        style={{
          background: "linear-gradient(180deg, hsl(220 35% 6%) 0%, hsl(222 38% 5%) 100%)",
          borderRight: "1px solid hsl(217 30% 12%)",
        }}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-5 shrink-0"
          style={{ borderBottom: "1px solid hsl(217 30% 10%)" }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyber-cyan to-cyber-blue flex items-center justify-center shadow-glow-cyan">
              <BarChart2 className="h-3.5 w-3.5 text-cyber-navy" />
            </div>
            <span className="text-sm font-bold tracking-tight text-foreground">
              TradeOps <span className="text-cyber-cyan">AI</span>
            </span>
          </div>
        </div>
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 h-14 flex items-center px-4 z-40"
        style={{
          background: "hsl(220 35% 6%)",
          borderBottom: "1px solid hsl(217 30% 10%)",
        }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-md text-muted-foreground hover:bg-cyber-rule/60 transition-colors"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="ml-3 flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-cyber-cyan to-cyber-blue flex items-center justify-center shadow-glow-cyan">
            <BarChart2 className="h-3 w-3 text-cyber-navy" />
          </div>
          <span className="text-sm font-bold tracking-tight">
            TradeOps <span className="text-cyber-cyan">AI</span>
          </span>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex" onClick={() => setMobileOpen(false)}>
          <div
            className="w-64 h-full flex flex-col shadow-2xl"
            style={{
              background: "linear-gradient(180deg, hsl(220 35% 6%) 0%, hsl(222 38% 5%) 100%)",
              borderRight: "1px solid hsl(217 30% 12%)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="h-14 flex items-center justify-between px-5 shrink-0"
              style={{ borderBottom: "1px solid hsl(217 30% 10%)" }}
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-gradient-to-br from-cyber-cyan to-cyber-blue flex items-center justify-center shadow-glow-cyan">
                  <BarChart2 className="h-3 w-3 text-cyber-navy" />
                </div>
                <span className="text-sm font-bold tracking-tight">
                  TradeOps <span className="text-cyber-cyan">AI</span>
                </span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-cyber-rule/60 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarContent onNav={() => setMobileOpen(false)} />
          </div>
          <div className="flex-1 bg-black/60 backdrop-blur-sm" />
        </div>
      )}
    </>
  );
}
