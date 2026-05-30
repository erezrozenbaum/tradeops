"use client";

import Link from "next/link";
import { ShieldAlert, AlertTriangle, CheckCircle2, X, FlaskConical, Fingerprint } from "lucide-react";
import { PreFlightBehavioralShield } from "./PreFlightBehavioralShield";
import { PreFlightDiversificationCard } from "./PreFlightDiversificationCard";

interface BehavioralIndicator {
  kappa_score: number | null;
  confidence_tier: string;
  suggested_action: string;
  rationale: string;
}

interface DiversificationIndicator {
  status: string;
  avg_correlation: number | null;
  risk_tier: string;
  individual_breakdown: Record<string, number>;
  insight: string;
}

interface InterceptorOrder {
  ticker: string | null;
  name: string;
  action: string;
  quantity: number;
  currency: string;
  pre_flight_review: {
    verdict: string;
    behavioral?: BehavioralIndicator | null;
    diversification?: DiversificationIndicator | null;
  } | null;
}

interface Props {
  order: InterceptorOrder;
  onDismiss: () => void;
  onPaperSandbox: () => void;
}

export function PreFlightInterceptorPanel({ order, onDismiss, onPaperSandbox }: Props) {
  const review = order.pre_flight_review;
  const behavioral = review?.behavioral ?? null;
  const diversification = review?.diversification ?? null;

  const isHighRisk =
    (behavioral?.kappa_score != null && behavioral.kappa_score < 0.5) ||
    diversification?.risk_tier === "HIGH_OVERLAP";

  const hasBehavioral = behavioral !== null;
  const hasDiversification = diversification !== null && diversification.status !== "SKIPPED";

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-primary/[0.03] p-5 space-y-4 shadow-lg">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <ShieldAlert className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold tracking-tight uppercase">
              Pre-Flight Interceptor
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {order.action.toUpperCase()} ·{" "}
            {order.ticker ? (
              <span className="font-mono font-semibold">{order.ticker}</span>
            ) : (
              order.name
            )}{" "}
            · {order.quantity.toLocaleString()} units · {order.currency}
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors mt-0.5"
          aria-label="Dismiss interceptor"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Dual-column shield grid */}
      {(hasBehavioral || hasDiversification) ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {hasBehavioral && <PreFlightBehavioralShield {...behavioral!} />}
          {hasDiversification && <PreFlightDiversificationCard {...diversification!} />}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground/70 text-center py-2">
          Pre-flight analysis unavailable for this order type.
        </p>
      )}

      {/* Aggregate risk banner */}
      {isHighRisk && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/8 border border-amber-500/25 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <span className="text-foreground">
              <strong className="text-amber-400">System Alert:</strong> Both behavioral confidence and
              correlation signals are unfavorable. This order fits your historical profile for elevated
              execution risk — consider routing to the paper sandbox first.
            </span>
            <Link
              href="/investor-dna"
              className="flex items-center gap-1 text-primary hover:underline"
            >
              <Fingerprint className="w-3 h-3" />
              View your Investor DNA for the full pattern breakdown
            </Link>
          </div>
        </div>
      )}

      {/* Clean signal confirmation */}
      {!isHighRisk && (hasBehavioral || hasDiversification) && (
        <div className="flex items-center gap-2 text-[11px] text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Pre-flight signals are within acceptable parameters.
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center justify-end gap-3 pt-1 border-t border-white/6">
        <button
          onClick={onPaperSandbox}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-muted/40 text-muted-foreground border border-border hover:bg-muted/70 hover:text-foreground transition-colors"
        >
          <FlaskConical className="w-3.5 h-3.5" />
          Route to Paper Sandbox
        </button>
        <button
          onClick={onDismiss}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            isHighRisk
              ? "bg-amber-600/80 text-white hover:bg-amber-600 border border-amber-500/40"
              : "bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30"
          }`}
        >
          {isHighRisk ? "Proceed Anyway" : "Continue to Queue"}
        </button>
      </div>
    </div>
  );
}
