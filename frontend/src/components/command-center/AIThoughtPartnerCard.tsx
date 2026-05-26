"use client";

import Link from "next/link";
import { useState } from "react";
import { Bot, ArrowRight, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface EvolutionItem {
  metric: string;
  label: string;
  direction: string;
  delta_display: string;
  cause: string | null;
  item_severity: string;
}

interface AIThoughtPartnerCardProps {
  summary: string;
  verbosityUsed: string;
  maturityStageLabel: string;
  twinDelta: number | null;
  evolutionItems?: EvolutionItem[];
  activeRiskCount?: number;
  onVerbosityChange: (v: "beginner" | "standard" | "advanced") => void;
}

const VERBOSITY_OPTS = [
  { key: "beginner", label: "Simplified" },
  { key: "standard", label: "Standard" },
  { key: "advanced", label: "Detailed" },
] as const;

function DeltaChip({ item }: { item: EvolutionItem }) {
  const up = item.direction === "up";
  const down = item.direction === "down";
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  const color = up ? "text-emerald-400" : down ? "text-red-400" : "text-muted-foreground";
  const severity = item.item_severity;
  const border = severity === "critical" || severity === "alert"
    ? "border-red-500/30 bg-red-500/5"
    : severity === "warning"
    ? "border-amber-500/30 bg-amber-500/5"
    : "border-border/60 bg-card";

  return (
    <div className={`rounded-lg border px-3 py-2 ${border}`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className={`h-3 w-3 shrink-0 ${color}`} />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide truncate">
          {item.label}
        </span>
        <span className={`text-[10px] font-mono font-medium ml-auto shrink-0 ${color}`}>
          {item.delta_display}
        </span>
      </div>
      {item.cause && (
        <p className="text-[10px] text-muted-foreground/60 leading-snug line-clamp-2">{item.cause}</p>
      )}
    </div>
  );
}

export function AIThoughtPartnerCard({
  summary,
  verbosityUsed,
  maturityStageLabel,
  twinDelta,
  evolutionItems = [],
  activeRiskCount = 0,
  onVerbosityChange,
}: AIThoughtPartnerCardProps) {
  const [selected, setSelected] = useState(verbosityUsed || "standard");
  const [showContext, setShowContext] = useState(false);

  const handleSelect = (v: "beginner" | "standard" | "advanced") => {
    setSelected(v);
    onVerbosityChange(v);
  };

  const twinDeltaPositive = twinDelta !== null && twinDelta > 0;
  const twinDeltaNegative = twinDelta !== null && twinDelta < 0;
  const notableItems = evolutionItems.filter(
    (e) => e.item_severity === "critical" || e.item_severity === "alert" || e.item_severity === "warning"
  ).slice(0, 3);
  const hasContext = twinDelta !== null || activeRiskCount > 0 || notableItems.length > 0;

  return (
    <div className="rounded-xl border bg-cyber-surface p-5 space-y-4" style={{ borderColor: "hsl(217 30% 12%)" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-blue-400" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/70">
            Your Financial Thought Partner
          </h2>
          <span className="text-[10px] text-muted-foreground/40 ml-1">{maturityStageLabel}</span>
        </div>
        <Link href="/agent" className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-foreground transition-colors">
          Full report <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Summary */}
      {summary ? (
        <p className="text-sm text-foreground/80 leading-relaxed">{summary}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          AI summary unavailable. Add your ANTHROPIC_API_KEY to enable.
        </p>
      )}

      {/* "What I'm seeing" context panel — collapsible */}
      {hasContext && summary && (
        <div className="border-t pt-3" style={{ borderColor: "hsl(217 30% 12%)" }}>
          <button
            onClick={() => setShowContext((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors w-full text-left"
          >
            {showContext ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            What your AI is seeing right now
          </button>

          {showContext && (
            <div className="mt-3 space-y-3">
              {/* Twin score delta */}
              {twinDelta !== null && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground/60">Twin score 7-day change</span>
                  <span className={cn("font-mono font-semibold flex items-center gap-0.5",
                    twinDeltaPositive ? "text-emerald-400" : twinDeltaNegative ? "text-red-400" : "text-muted-foreground"
                  )}>
                    {twinDeltaPositive ? <TrendingUp className="h-3 w-3" /> : twinDeltaNegative ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    {twinDelta >= 0 ? "+" : ""}{twinDelta.toFixed(1)} pts
                  </span>
                </div>
              )}

              {/* Active behavioral risks */}
              {activeRiskCount > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground/60">Active behavioral risks</span>
                  <span className="font-semibold text-amber-400">{activeRiskCount} active</span>
                  <Link href="/behavioral-risk" className="text-[10px] text-muted-foreground/40 hover:text-foreground transition-colors ml-auto">
                    Review →
                  </Link>
                </div>
              )}

              {/* Notable evolution items */}
              {notableItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-medium">Notable changes</p>
                  <div className="space-y-1.5">
                    {notableItems.map((item, i) => (
                      <DeltaChip key={i} item={item} />
                    ))}
                  </div>
                </div>
              )}

              <Link
                href="/ai-history"
                className="flex items-center gap-1 text-[11px] text-muted-foreground/40 hover:text-foreground transition-colors"
              >
                View full AI assessment history <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Verbosity selector */}
      <div className="flex items-center gap-1.5 pt-1 border-t" style={{ borderColor: "hsl(217 30% 12%)" }}>
        <span className="text-[11px] text-muted-foreground/50 mr-1">Detail:</span>
        {VERBOSITY_OPTS.map(opt => (
          <button
            key={opt.key}
            onClick={() => handleSelect(opt.key)}
            className={cn(
              "px-2.5 py-1 rounded text-[11px] font-medium transition-colors",
              selected === opt.key
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "text-muted-foreground/50 hover:text-muted-foreground border border-transparent hover:border-white/10",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
