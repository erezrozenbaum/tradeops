"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Minus, ShoppingCart, AlertTriangle,
  PiggyBank, AlertCircle, Bell, Info, X, ChevronRight, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionItem {
  id: string;
  priority: number;
  category: string;
  action_type: string;
  title: string;
  reasoning: string;
  ticker: string | null;
  amount: number | null;
  units: number | null;
  unit_price: number | null;
  currency: string;
  source: string;
}

interface ActionFeed {
  items: ActionItem[];
  urgent_count: number;
  high_count: number;
}

const DISMISSED_KEY = "tradeops_dismissed_nba";

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function saveDismissed(ids: Set<string>) {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(ids))); } catch {}
}

const ACTION_STYLE: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  BUY:        { bg: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-400", icon: TrendingUp },
  SELL:       { bg: "bg-red-500/10 border-red-500/20",         text: "text-red-400",     icon: TrendingDown },
  REDUCE:     { bg: "bg-amber-500/10 border-amber-500/20",     text: "text-amber-400",   icon: Minus },
  ACCUMULATE: { bg: "bg-blue-500/10 border-blue-500/20",       text: "text-blue-400",    icon: ShoppingCart },
  WATCH:      { bg: "bg-slate-500/10 border-slate-500/20",     text: "text-slate-400",   icon: AlertTriangle },
  CONTRIBUTE: { bg: "bg-purple-500/10 border-purple-500/20",   text: "text-purple-400",  icon: PiggyBank },
  URGENT:     { bg: "bg-red-600/10 border-red-600/20",         text: "text-red-400",     icon: AlertCircle },
  ALERT:      { bg: "bg-orange-500/10 border-orange-500/20",   text: "text-orange-400",  icon: Bell },
  REVIEW:     { bg: "bg-sky-500/10 border-sky-500/20",         text: "text-sky-400",     icon: Info },
};

const SOURCE_HREF: Record<string, string> = {
  rebalancing:       "/rebalance",
  proactive_insights: "/insights",
  goals:             "/goals",
  price_alerts:      "/investments",
  market_signals:    "/market-scan",
};

const PRIORITY_COLOR = ["", "bg-red-500", "bg-amber-500", "bg-blue-400"];

export function NextBestActionBar() {
  const pathname = usePathname();
  const [feed, setFeed] = useState<ActionFeed | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [idx, setIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);

  // Don't show on the dashboard (full DailyActionFeedCard is there) or onboarding
  const hidden = pathname === "/dashboard" || pathname === "/onboarding" || pathname === "/command-center";

  useEffect(() => {
    setDismissed(getDismissed());
  }, []);

  useEffect(() => {
    if (hidden) return;
    const id = typeof window !== "undefined" ? localStorage.getItem("tradeops_investor_id") : null;
    if (!id) return;
    fetch(`/api/v1/investors/${id}/action-feed`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setFeed(data); })
      .catch(() => {});
  }, [hidden]);

  if (hidden || !feed) return null;

  const visible = feed.items.filter(item => !dismissed.has(item.id));
  if (visible.length === 0) return null;

  // Only show P1 + P2 items as the bar
  const urgent = visible.filter(i => i.priority <= 2);
  if (urgent.length === 0) return null;

  const currentIdx = Math.min(idx, urgent.length - 1);
  const item = urgent[currentIdx];
  const style = ACTION_STYLE[item.action_type] ?? ACTION_STYLE.REVIEW;
  const Icon = style.icon;
  const href = SOURCE_HREF[item.source] ?? "/recommendations";

  function dismiss(id: string) {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    saveDismissed(next);
    setIdx(0);
    setExpanded(false);
  }

  return (
    <div
      className={cn(
        "border-b transition-all",
        style.bg,
      )}
      style={{ borderColor: "hsl(217 30% 14%)" }}
    >
      {/* Compact bar */}
      <div className="flex items-center gap-2.5 px-4 py-2 min-h-[40px]">
        {/* Priority dot */}
        <span className={cn("h-2 w-2 rounded-full shrink-0", PRIORITY_COLOR[item.priority] ?? "bg-blue-400")} />

        {/* Action type badge */}
        <span className={cn("shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold", style.bg, style.text)}>
          <Icon className="h-3 w-3" />
          {item.action_type}
        </span>

        {/* Title */}
        <span className="text-xs font-semibold text-foreground truncate flex-1">
          {item.title}
          {item.ticker && <span className="ml-1.5 font-mono text-muted-foreground">{item.ticker}</span>}
        </span>

        {/* Count badge */}
        {urgent.length > 1 && (
          <span className="text-[10px] text-muted-foreground shrink-0">
            {currentIdx + 1}/{urgent.length}
          </span>
        )}

        {/* Expand reasoning */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Details"
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
        </button>

        {/* CTA */}
        <Link
          href={href}
          className={cn("shrink-0 inline-flex items-center gap-0.5 text-[11px] font-medium transition-colors", style.text, "hover:opacity-80")}
        >
          Act <ChevronRight className="h-3 w-3" />
        </Link>

        {/* Cycle next */}
        {urgent.length > 1 && (
          <button
            onClick={() => { setIdx((currentIdx + 1) % urgent.length); setExpanded(false); }}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors text-[10px] px-1"
            aria-label="Next action"
          >
            next
          </button>
        )}

        {/* Dismiss */}
        <button
          onClick={() => dismiss(item.id)}
          className="shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Expanded reasoning row */}
      {expanded && (
        <div className="px-4 pb-2.5">
          <p className="text-[11px] text-muted-foreground leading-relaxed pl-[4.25rem]">
            {item.reasoning}
          </p>
        </div>
      )}
    </div>
  );
}
