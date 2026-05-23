"use client";

import Link from "next/link";
import { useState } from "react";
import { Bot, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIThoughtPartnerCardProps {
  summary: string;
  verbosityUsed: string;
  maturityStageLabel: string;
  onVerbosityChange: (v: "beginner" | "standard" | "advanced") => void;
}

const VERBOSITY_OPTS = [
  { key: "beginner", label: "Simplified" },
  { key: "standard", label: "Standard" },
  { key: "advanced", label: "Detailed" },
] as const;

export function AIThoughtPartnerCard({
  summary,
  verbosityUsed,
  maturityStageLabel,
  onVerbosityChange,
}: AIThoughtPartnerCardProps) {
  const [selected, setSelected] = useState(verbosityUsed || "standard");

  const handleSelect = (v: "beginner" | "standard" | "advanced") => {
    setSelected(v);
    onVerbosityChange(v);
  };

  return (
    <div className="rounded-xl border bg-cyber-surface p-5" style={{ borderColor: "hsl(217 30% 12%)" }}>
      <div className="flex items-center justify-between mb-4">
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

      {summary ? (
        <p className="text-sm text-foreground/80 leading-relaxed">{summary}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          AI summary unavailable. Add your ANTHROPIC_API_KEY to enable.
        </p>
      )}

      <div className="flex items-center gap-1.5 mt-4 pt-3 border-t" style={{ borderColor: "hsl(217 30% 12%)" }}>
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
