"use client";

import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";

interface BehavioralIndicator {
  kappa_score: number | null;
  confidence_tier: string;
  suggested_action: string;
  rationale: string;
}

export function PreFlightBehavioralShield({
  kappa_score,
  confidence_tier,
  suggested_action,
  rationale,
}: BehavioralIndicator) {
  if (confidence_tier === "INSUFFICIENT_DATA") {
    return (
      <div className="flex items-start gap-2 text-[11px] text-muted-foreground/70 pt-0.5">
        <ShieldQuestion className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>{rationale}</span>
      </div>
    );
  }

  const score = kappa_score ?? 0;
  const isHigh = score >= 0.75 && confidence_tier === "HIGH_ALPHA";
  const isLow = score < 0.50;
  const isCaution = !isHigh && !isLow;

  const colorClass = isLow
    ? "border-rose-500/25 bg-rose-500/5 text-rose-400"
    : isCaution
    ? "border-amber-500/25 bg-amber-500/5 text-amber-500"
    : "border-emerald-500/25 bg-emerald-500/5 text-emerald-400";

  const Icon = isLow || isCaution ? ShieldAlert : ShieldCheck;

  const actionLabel =
    suggested_action === "RECOMMEND_PAPER_TRADING"
      ? "Consider paper trading this setup first"
      : suggested_action === "CONSIDER_REDUCING_SIZE"
      ? "Consider reducing position size"
      : null;

  return (
    <div className={`rounded-md border p-2.5 space-y-1.5 ${colorClass}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="font-semibold text-[10px] uppercase tracking-wide">
            Behavioral Confidence
          </span>
        </div>
        {kappa_score !== null && (
          <span className="font-mono font-bold text-xs tabular-nums">
            {kappa_score.toFixed(2)}
          </span>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{rationale}</p>
      {actionLabel && (
        <div className="text-[10px] font-medium border-t border-current/20 pt-1.5 text-foreground/70">
          {actionLabel}
        </div>
      )}
    </div>
  );
}
