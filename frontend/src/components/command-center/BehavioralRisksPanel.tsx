"use client";

import Link from "next/link";
import { AlertTriangle, AlertCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BehavioralRiskCard {
  event_type: string;
  severity: string;
  description: string;
  recommendation: string;
}

interface BehavioralRisksPanelProps {
  risks: BehavioralRiskCard[];
}

const SEV_CONFIG = {
  high: { icon: <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />, badge: "bg-red-500/15 text-red-400", border: "border-red-500/20" },
  medium: { icon: <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />, badge: "bg-amber-500/15 text-amber-400", border: "border-amber-500/20" },
  low: { icon: <AlertCircle className="h-4 w-4 text-blue-400 shrink-0" />, badge: "bg-blue-500/15 text-blue-400", border: "border-blue-500/20" },
};

export function BehavioralRisksPanel({ risks }: BehavioralRisksPanelProps) {
  return (
    <div className="rounded-xl border bg-cyber-surface p-5" style={{ borderColor: "hsl(217 30% 12%)" }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/70">
          Active Behavioral Risks
        </h2>
        <Link href="/behavioral-risk" className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-foreground transition-colors">
          Manage <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {!risks.length ? (
        <p className="text-xs text-emerald-400/70">No active behavioral risks detected.</p>
      ) : (
        <div className="space-y-3">
          {risks.map((risk, i) => {
            const cfg = SEV_CONFIG[risk.severity as keyof typeof SEV_CONFIG] || SEV_CONFIG.medium;
            return (
              <div key={i} className={cn("rounded-lg border p-3.5", cfg.border, "bg-white/[0.02]")}>
                <div className="flex items-start gap-2.5">
                  {cfg.icon}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-foreground">
                        {risk.event_type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                      <span className={cn("text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded", cfg.badge)}>
                        {risk.severity}
                      </span>
                    </div>
                    {risk.description && (
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{risk.description}</p>
                    )}
                    {risk.recommendation && (
                      <p className="text-[11px] text-muted-foreground/60 mt-1 italic">{risk.recommendation}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
