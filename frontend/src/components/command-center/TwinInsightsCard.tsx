"use client";

import Link from "next/link";
import { ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { MaturityVariant } from "@/hooks/useMaturityVariant";

interface TwinInsight {
  label: string;
  value: number;
}

interface TwinInsightsData {
  positive_drivers: TwinInsight[];
  drag_factors: TwinInsight[];
}

interface TwinInsightsCardProps {
  data: TwinInsightsData;
  variant: MaturityVariant;
}

function InsightBar({ insight, positive }: { insight: TwinInsight; positive: boolean }) {
  const color = positive ? "bg-emerald-400/70" : "bg-red-400/70";
  const textColor = positive ? "text-emerald-400" : "text-red-400";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground/80">{insight.label}</span>
        <span className={cn("text-xs font-mono font-semibold", textColor)}>{insight.value.toFixed(0)}</span>
      </div>
      <div className="h-1 rounded-full bg-white/5">
        <div
          className={cn("h-full rounded-full transition-all duration-700", color)}
          style={{ width: `${Math.min(insight.value, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function TwinInsightsCard({ data, variant }: TwinInsightsCardProps) {
  return (
    <div className="rounded-xl border bg-cyber-surface p-5" style={{ borderColor: "hsl(217 30% 12%)" }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/70">
          Financial Twin Insights
        </h2>
        <Link href="/twin" className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-foreground transition-colors">
          Full Twin <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-5">
        {data.positive_drivers.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <TrendingUp className="h-3 w-3 text-emerald-400" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400/80">
                Positive Drivers
              </span>
            </div>
            <div className="space-y-3">
              {data.positive_drivers.map((d, i) => (
                <InsightBar key={i} insight={d} positive={true} />
              ))}
            </div>
          </div>
        )}

        {variant.showDragFactors && data.drag_factors.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <TrendingDown className="h-3 w-3 text-red-400" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-red-400/80">
                Drag Factors
              </span>
            </div>
            <div className="space-y-3">
              {data.drag_factors.map((d, i) => (
                <InsightBar key={i} insight={d} positive={false} />
              ))}
            </div>
          </div>
        )}

        {data.positive_drivers.length === 0 && data.drag_factors.length === 0 && (
          <p className="text-xs text-muted-foreground">Complete your profile and holdings to generate insights.</p>
        )}
      </div>
    </div>
  );
}
