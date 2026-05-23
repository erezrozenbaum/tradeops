"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { MaturityVariant } from "@/hooks/useMaturityVariant";

interface EvolutionItem {
  metric: string;
  label: string;
  direction: string;
  from_value: number | null;
  to_value: number | null;
  delta_display: string;
  cause: string | null;
  item_severity: string;
}

interface EvolutionFeedProps {
  items: EvolutionItem[];
  variant: MaturityVariant;
}

const SEVERITY_COLORS = {
  positive: "text-emerald-400",
  negative: "text-red-400",
  neutral: "text-muted-foreground",
};

const DIR_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

export function EvolutionFeed({ items, variant }: EvolutionFeedProps) {
  return (
    <div className="rounded-xl border bg-cyber-surface p-5" style={{ borderColor: "hsl(217 30% 12%)" }}>
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/70 mb-4">
        What Changed This Week
      </h2>
      {!items.length ? (
        <p className="text-xs text-muted-foreground">No significant changes in the past 7 days.</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((item, i) => {
            const Icon = DIR_ICONS[item.direction as keyof typeof DIR_ICONS] || Minus;
            const color = SEVERITY_COLORS[item.item_severity as keyof typeof SEVERITY_COLORS] || "text-muted-foreground";
            return (
              <div key={i} className="flex items-start gap-3">
                <div className={cn("mt-0.5 shrink-0", color)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-foreground/90 font-medium leading-snug">{item.label}</span>
                    <span className={cn("text-xs font-mono font-semibold shrink-0", color)}>
                      {item.delta_display}
                    </span>
                  </div>
                  {variant.showCausalExplanations && item.cause && (
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5 leading-relaxed">{item.cause}</p>
                  )}
                  {variant.showNumericMetrics && item.from_value !== null && item.to_value !== null && (
                    <span className="text-[11px] text-muted-foreground/50 font-mono">
                      {item.from_value} → {item.to_value}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
