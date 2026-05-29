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
  Home,
  Sun,
  Moon,
  Scale,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  CalendarClock,
  BookOpen,
  BrainCircuit,
  Activity,
  CalendarDays,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/layout/NotificationBell";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  secondary?: boolean;
};

type NavSection = {
  label?: string;
  items: NavItem[];
};

const sections: NavSection[] = [
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
      { label: "Financial", href: "/financial", icon: Wallet },
      { label: "Goals", href: "/goals", icon: Target },
      { label: "Net Worth", href: "/net-worth", icon: PiggyBank },
      { label: "Family", href: "/family", icon: Users, secondary: true },
      { label: "Household", href: "/household", icon: Home, secondary: true },
    ],
  },
  {
    label: "Strategy",
    items: [
      { label: "Risk Model", href: "/risk", icon: Shield },
      { label: "Backtesting", href: "/backtesting", icon: BarChart2 },
      { label: "Paper Trading", href: "/paper-trading", icon: TrendingUp },
      { label: "Live Trading", href: "/live-trading", icon: Flame },
      { label: "Strategies", href: "/strategies", icon: Lightbulb, secondary: true },
    ],
  },
  {
    label: "Portfolio",
    items: [
      { label: "Investments", href: "/investments", icon: Briefcase },
      { label: "Order Builder", href: "/order-builder", icon: Layers },
      { label: "Recurring Plans", href: "/recurring-plans", icon: CalendarClock },
      { label: "Portfolio Compare", href: "/portfolio-comparison", icon: BarChart2 },
      { label: "Rebalance", href: "/rebalance", icon: Scale },
      { label: "Performance", href: "/performance", icon: Activity },
      { label: "Transactions", href: "/transactions", icon: ClipboardList },
      { label: "Sync Status", href: "/broker-sync", icon: RefreshCw, secondary: true },
      { label: "Stress Test", href: "/stress-test", icon: Zap, secondary: true },
      { label: "Watchlist", href: "/watchlist", icon: Eye, secondary: true },
      { label: "Debt Planner", href: "/debt-planner", icon: CreditCard, secondary: true },
      { label: "PDF Import", href: "/pdf-import", icon: FileUp, secondary: true },
      { label: "Crypto Staking", href: "/crypto-staking", icon: Coins, secondary: true },
      { label: "FX Impact", href: "/fx-impact", icon: Globe, secondary: true },
      { label: "Tax Summary", href: "/tax-summary", icon: Receipt, secondary: true },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "AI Agent", href: "/agent", icon: Bot },
      { label: "Decision Intelligence", href: "/decision-intelligence", icon: BrainCircuit },
      { label: "Behavioral Alpha", href: "/behavioral-alpha", icon: Activity },
      { label: "Monthly Review", href: "/reflection", icon: CalendarDays },
      { label: "Trade Journal", href: "/journal", icon: BookOpen },
      { label: "AI Coach", href: "/insights", icon: Brain },
      { label: "Market Research", href: "/market-research", icon: Microscope },
      { label: "Simulation", href: "/futures", icon: Layers },
      { label: "AI Report", href: "/reports", icon: Sparkles },
      { label: "Behavioral Intel", href: "/behavioral", icon: Gauge },
      { label: "Recommendations", href: "/recommendations", icon: Wand2, secondary: true },
      { label: "Market Scan", href: "/market-scan", icon: ScanSearch, secondary: true },
      { label: "News Feed", href: "/news", icon: Newspaper, secondary: true },
      { label: "Pairs Trading", href: "/pairs-trading", icon: ArrowLeftRight, secondary: true },
      { label: "AI Memory", href: "/ai-history", icon: Brain, secondary: true },
      { label: "Score History", href: "/score-history", icon: Activity, secondary: true },
      { label: "Decision Provenance", href: "/decisions", icon: GitBranch, secondary: true },
      { label: "Decision Timeline", href: "/timeline", icon: Clock, secondary: true },
      { label: "Strategy Drift", href: "/strategy-drift", icon: Crosshair, secondary: true },
      { label: "Attribution", href: "/attribution", icon: PieChart, secondary: true },
      { label: "Investor Maturity", href: "/maturity", icon: Trophy, secondary: true },
      { label: "Financial Twin", href: "/twin", icon: Cpu, secondary: true },
      { label: "Health Radar", href: "/health-radar", icon: Activity, secondary: true },
      { label: "Behavioral Risk", href: "/behavioral-risk", icon: AlertTriangle, secondary: true },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Morning Brief", href: "/morning-brief", icon: Sun },
      { label: "Notifications", href: "/notifications", icon: Bell },
      { label: "Setup Guide", href: "/onboarding", icon: Sparkles },
      { label: "Audit Log", href: "/audit", icon: FileText },
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Help & Guide", href: "/help", icon: HelpCircle, secondary: true },
    ],
  },
];

function NavLink({ item, pathname, onNav }: { item: NavItem; pathname: string; onNav?: () => void }) {
  const active = pathname === item.href;
  return (
    <li>
      <Link
        href={item.href}
        onClick={onNav}
        className={cn(
          "group flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-all duration-150",
          active
            ? ["bg-cyber-cyan/10 text-cyber-cyan font-medium", "border border-cyber-cyan/20", "shadow-[0_0_12px_hsl(199_95%_52%/0.08)]"]
            : "text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
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
}

function SidebarContent({ onNav }: { onNav?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [isAdmin, setIsAdmin] = useState(false);

  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>(() => {
    const result: Record<string, boolean> = {};
    sections.forEach(s => {
      if (s.label) result[s.label] = s.items.some(item => item.href === pathname);
    });
    return result;
  });

  const [moreOpen, setMoreOpen] = useState<Record<string, boolean>>(() => {
    const result: Record<string, boolean> = {};
    sections.forEach(s => {
      if (s.label) result[s.label] = s.items.some(item => item.secondary && item.href === pathname);
    });
    return result;
  });

  // Auto-open section and "more" when navigating to a route in it
  useEffect(() => {
    sections.forEach(s => {
      if (!s.label) return;
      if (s.items.some(item => item.href === pathname)) {
        setSectionOpen(prev => ({ ...prev, [s.label!]: true }));
      }
      if (s.items.some(item => item.secondary && item.href === pathname)) {
        setMoreOpen(prev => ({ ...prev, [s.label!]: true }));
      }
    });
  }, [pathname]);

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
        {sections.map((section, i) => {
          if (!section.label) {
            return (
              <div key={i}>
                <ul className="space-y-0.5">
                  {section.items.map(item => (
                    <NavLink key={item.href} item={item} pathname={pathname} onNav={onNav} />
                  ))}
                </ul>
              </div>
            );
          }

          const isOpen = sectionOpen[section.label] ?? false;
          const isMoreExpanded = moreOpen[section.label] ?? false;
          const primaryItems = section.items.filter(item => !item.secondary);
          const secondaryItems = section.items.filter(item => item.secondary);

          return (
            <div key={i}>
              <button
                onClick={() => setSectionOpen(prev => ({ ...prev, [section.label!]: !isOpen }))}
                className="w-full flex items-center justify-between px-3 mb-1.5 group"
              >
                <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">
                  {section.label}
                </p>
                {isOpen
                  ? <ChevronDown className="h-2.5 w-2.5 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors" />
                  : <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors" />
                }
              </button>

              {isOpen && (
                <ul className="space-y-0.5">
                  {primaryItems.map(item => (
                    <NavLink key={item.href} item={item} pathname={pathname} onNav={onNav} />
                  ))}

                  {secondaryItems.length > 0 && (
                    <>
                      {isMoreExpanded && secondaryItems.map(item => (
                        <NavLink key={item.href} item={item} pathname={pathname} onNav={onNav} />
                      ))}
                      <li>
                        <button
                          onClick={() => setMoreOpen(prev => ({ ...prev, [section.label!]: !isMoreExpanded }))}
                          className="flex items-center gap-1.5 px-3 py-1 text-[11px] text-muted-foreground/45 hover:text-muted-foreground/75 transition-colors w-full"
                        >
                          {isMoreExpanded
                            ? <><ChevronDown className="h-2.5 w-2.5" /> Show less</>
                            : <><ChevronRight className="h-2.5 w-2.5" /> {secondaryItems.length} more</>
                          }
                        </button>
                      </li>
                    </>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border p-2 shrink-0 space-y-0.5">
        {isAdmin && (
          <Link
            href="/admin"
            onClick={onNav}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-all duration-150 border",
              pathname === "/admin"
                ? "bg-cyber-purple/10 text-cyber-purple border-cyber-purple/20"
                : "text-muted-foreground hover:bg-muted hover:text-foreground border-transparent"
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin Panel
          </Link>
        )}
      </div>
      <div className="border-t border-border p-2 shrink-0 space-y-0.5">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150 border border-transparent"
        >
          {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <button
          onClick={handleSwitchProfile}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150 border border-transparent"
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
          background: "linear-gradient(180deg, var(--sidebar-from) 0%, var(--sidebar-to) 100%)",
          borderRight: "1px solid var(--sidebar-border)",
        }}
      >
        <div className="h-14 flex items-center px-5 shrink-0"
          style={{ borderBottom: "1px solid var(--sidebar-divider)" }}
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
          background: "var(--sidebar-from)",
          borderBottom: "1px solid var(--sidebar-divider)",
        }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-md text-muted-foreground hover:bg-muted transition-colors"
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
        <div className="ml-auto pr-1">
          <NotificationBell />
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex" onClick={() => setMobileOpen(false)}>
          <div
            className="w-64 h-full flex flex-col shadow-2xl"
            style={{
              background: "linear-gradient(180deg, var(--sidebar-from) 0%, var(--sidebar-to) 100%)",
              borderRight: "1px solid var(--sidebar-border)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="h-14 flex items-center justify-between px-5 shrink-0"
              style={{ borderBottom: "1px solid var(--sidebar-divider)" }}
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
                className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
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
