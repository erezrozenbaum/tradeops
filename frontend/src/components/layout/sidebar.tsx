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
} from "lucide-react";
import { cn } from "@/lib/utils";

const sections = [
  {
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Personal",
    items: [
      { label: "Profile", href: "/profile", icon: User },
      { label: "Family", href: "/family", icon: Users },
      { label: "Financial", href: "/financial", icon: Wallet },
      { label: "Goals", href: "/goals", icon: Target },
    ],
  },
  {
    label: "Strategy",
    items: [
      { label: "Risk Model", href: "/risk", icon: Shield },
      { label: "Strategies", href: "/strategies", icon: Lightbulb },
      { label: "Backtesting", href: "/backtesting", icon: BarChart2 },
      { label: "Paper Trading", href: "/paper-trading", icon: TrendingUp },
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
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {sections.map((section, i) => (
          <div key={i}>
            {section.label && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
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
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                        active
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3 shrink-0 space-y-0.5">
        {isAdmin && (
          <Link
            href="/admin"
            onClick={onNav}
            className={cn(
              "flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              pathname === "/admin"
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <ShieldCheck className="h-4 w-4" />
            Admin Panel
          </Link>
        )}
      </div>
      <div className="border-t border-border p-3 shrink-0 space-y-0.5">
        <button
          onClick={handleSwitchProfile}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Users className="h-4 w-4" />
          Switch profile
        </button>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close on route change
  const pathname = usePathname();
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:left-0 lg:top-0 lg:h-screen lg:w-60 lg:border-r lg:border-border lg:bg-card lg:flex lg:flex-col lg:z-40">
        <div className="h-14 flex items-center px-6 border-b border-border shrink-0">
          <span className="text-sm font-semibold tracking-tight">TradeOps AI</span>
        </div>
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b border-border flex items-center px-4 z-40">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-md text-muted-foreground hover:bg-muted transition-colors"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="ml-3 text-sm font-semibold tracking-tight">TradeOps AI</span>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="bg-card w-72 h-full flex flex-col border-r border-border shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="h-14 flex items-center justify-between px-6 border-b border-border shrink-0">
              <span className="text-sm font-semibold tracking-tight">TradeOps AI</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarContent onNav={() => setMobileOpen(false)} />
          </div>
          {/* Dimmed backdrop */}
          <div className="flex-1 bg-black/40" />
        </div>
      )}
    </>
  );
}
