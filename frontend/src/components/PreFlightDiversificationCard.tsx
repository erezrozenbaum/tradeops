"use client";

import { Layers, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";

interface DiversificationIndicator {
  status: string;
  avg_correlation: number | null;
  risk_tier: string;
  individual_breakdown: Record<string, number>;
  insight: string;
}

export function PreFlightDiversificationCard({
  status,
  avg_correlation,
  risk_tier,
  individual_breakdown,
  insight,
}: DiversificationIndicator) {
  if (status === "SKIPPED") return null;

  const isHighRisk = risk_tier === "HIGH_OVERLAP";
  const isGood = risk_tier === "HIGHLY_DIVERSIFIED" || risk_tier === "LOW";
  const isInsufficient = status === "INSUFFICIENT_DATA";

  const borderBg = isInsufficient
    ? "bg-card border-border"
    : isHighRisk
    ? "bg-amber-500/10 border-amber-500/30"
    : isGood
    ? "bg-emerald-500/10 border-emerald-500/30"
    : "bg-card border-border";

  const iconColor = isInsufficient
    ? "text-muted-foreground"
    : isHighRisk
    ? "text-amber-500"
    : isGood
    ? "text-emerald-500"
    : "text-muted-foreground";

  const corrColor = isHighRisk ? "text-amber-400" : isGood ? "text-emerald-400" : "text-foreground";

  const peerTickers = Object.entries(individual_breakdown);

  return (
    <div className={`p-3 rounded-lg border transition-all ${borderBg}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Layers className={`h-4 w-4 ${iconColor}`} />
          <span className="font-semibold text-xs text-foreground">Portfolio Correlation Shield</span>
        </div>
        {avg_correlation !== null ? (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">Avg r:</span>
            <span className={`font-mono font-bold text-xs ${corrColor}`}>
              {avg_correlation >= 0 ? `+${avg_correlation.toFixed(2)}` : avg_correlation.toFixed(2)}
            </span>
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground font-medium">N/A</span>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">{insight}</p>

      {peerTickers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {peerTickers.map(([ticker, corr]) => (
            <span
              key={ticker}
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                corr >= 0.7
                  ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
                  : corr <= 0.3
                  ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                  : "border-border text-muted-foreground bg-muted/20"
              }`}
            >
              {ticker} {corr >= 0 ? "+" : ""}{corr.toFixed(2)}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-1 text-[10px] font-medium">
        {isHighRisk && (
          <span className="text-amber-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            High Clustering Risk
          </span>
        )}
        {isGood && (
          <span className="text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Efficient Frontier Fit
          </span>
        )}
        {!isHighRisk && !isGood && (
          <span className="text-muted-foreground flex items-center gap-1">
            <HelpCircle className="h-3 w-3" />
            {isInsufficient ? "Awaiting price history" : "Neutral Asset Allocation"}
          </span>
        )}
      </div>
    </div>
  );
}
