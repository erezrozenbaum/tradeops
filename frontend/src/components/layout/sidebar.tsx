"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
      { label: "Watchlist", href: "/watchlist", icon: Eye },
      { label: "Debt Planner", href: "/debt-planner", icon: CreditCard },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "AI Agent", href: "/agent", icon: Bot },
      { label: "Recommendations", href: "/recommendations", icon: Wand2 },
      { label: "Market Scan", href: "/market-scan", icon: ScanSearch },
      { label: "AI Report", href: "/reports", icon: Sparkles },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Notifications", href: "/notifications", icon: Bell },
      { label: "Audit Log", href: "/audit", icon: FileText },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem("tradeops_investor_id");
    router.push("/login");
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 border-r border-border bg-card flex flex-col z-40">
      <div className="h-14 flex items-center px-6 border-b border-border shrink-0">
        <span className="text-sm font-semibold tracking-tight">TradeOps AI</span>
      </div>

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

      <div className="border-t border-border p-3 shrink-0">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Switch profile
        </button>
      </div>
    </aside>
  );
}
