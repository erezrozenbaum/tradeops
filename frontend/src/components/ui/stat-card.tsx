"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { MetricTooltip } from "@/components/ui/metric-tooltip";

/* Animated number counter */
function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(target)) { setValue(target); return; }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out-cubic
      setValue(target * eased);
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);

  return value;
}

type Trend = "up" | "down" | "neutral";

interface StatCardProps {
  label: string;
  value: string;           // pre-formatted string (e.g. "₪1,234,567")
  rawValue?: number;       // if provided, animates the number
  sub?: string;
  trend?: Trend;
  trendLabel?: string;
  icon?: ReactNode;
  accent?: "cyan" | "emerald" | "amber" | "red" | "purple";
  className?: string;
  animate?: boolean;
  tooltip?: string;
}

const ACCENT_MAP = {
  cyan:    { border: "border-t-cyber-cyan/40",    text: "text-cyber-cyan",    glow: "hover:shadow-glow-cyan" },
  emerald: { border: "border-t-cyber-emerald/40", text: "text-cyber-emerald", glow: "hover:shadow-glow-emerald" },
  amber:   { border: "border-t-cyber-amber/40",   text: "text-cyber-amber",   glow: "hover:shadow-glow-amber" },
  red:     { border: "border-t-cyber-red/40",     text: "text-cyber-red",     glow: "hover:shadow-glow-red" },
  purple:  { border: "border-t-cyber-purple/40",  text: "text-cyber-purple",  glow: "" },
};

const TREND_ICON = {
  up:      <TrendingUp  className="h-3 w-3 text-up"   />,
  down:    <TrendingDown className="h-3 w-3 text-down" />,
  neutral: <Minus        className="h-3 w-3 text-muted-foreground" />,
};
const TREND_COLOR = {
  up: "text-up", down: "text-down", neutral: "text-muted-foreground",
};

export function StatCard({
  label, value, rawValue, sub, trend, trendLabel, icon, accent = "cyan", className, animate = true, tooltip,
}: StatCardProps) {
  const cfg = ACCENT_MAP[accent];
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);

  return (
    <div
      className={cn(
        "rounded-lg bg-cyber-surface border border-cyber-rule shadow-card-dark",
        "transition-all duration-200",
        "border-t-2", cfg.border, cfg.glow,
        animate && mounted ? "animate-fade-up" : "opacity-0",
        className
      )}
    >
      <div className="p-4 space-y-2">
        {/* label + icon row */}
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70">
            {tooltip ? (
              <MetricTooltip content={tooltip}>{label}</MetricTooltip>
            ) : label}
          </p>
          {icon && (
            <div className={cn("opacity-60", cfg.text)}>{icon}</div>
          )}
        </div>

        {/* value */}
        <p className={cn(
          "text-2xl font-bold tracking-tight font-mono tabular-nums",
          trend === "up" ? "text-up" : trend === "down" ? "text-down" : "text-foreground"
        )}>
          {value}
        </p>

        {/* trend + sub */}
        {(trend || sub) && (
          <div className="flex items-center justify-between gap-2">
            {trend && trendLabel && (
              <div className={cn("flex items-center gap-1 text-xs font-mono", TREND_COLOR[trend])}>
                {TREND_ICON[trend]}
                {trendLabel}
              </div>
            )}
            {sub && (
              <p className="text-[11px] text-muted-foreground/60 ml-auto">{sub}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
