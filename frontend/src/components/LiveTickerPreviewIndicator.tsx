"use client";

import { Loader2, Layers, ShieldCheck } from "lucide-react";

interface PreviewData {
  status: string;
  correlationRiskTier: string | null;
  avgCorrelation: number | null;
  insight: string | null;
}

interface LiveTickerPreviewIndicatorProps {
  isLoading: boolean;
  data: PreviewData | null;
}

export function LiveTickerPreviewIndicator({ isLoading, data }: LiveTickerPreviewIndicatorProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1.5 animate-pulse">
        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
        Checking portfolio overlap…
      </div>
    );
  }

  if (!data || !["PREVIEW_READY"].includes(data.status)) return null;

  const tier = data.correlationRiskTier;

  if (tier === "HIGH_OVERLAP") {
    return (
      <div className="mt-1.5 flex items-start gap-2 rounded border border-amber-500/25 bg-amber-500/8 px-2.5 py-1.5 text-[11px] text-amber-400">
        <Layers className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          <span className="font-semibold">High correlation detected</span>
          {data.avgCorrelation !== null && (
            <span className="text-amber-400/70"> (r={data.avgCorrelation > 0 ? "+" : ""}{data.avgCorrelation.toFixed(2)})</span>
          )}
          {data.insight && <span className="text-amber-300/80"> — {data.insight}</span>}
        </span>
      </div>
    );
  }

  if (tier === "HIGHLY_DIVERSIFIED") {
    return (
      <div className="mt-1.5 flex items-center gap-2 rounded border border-emerald-500/20 bg-emerald-500/6 px-2.5 py-1.5 text-[11px] text-emerald-400">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
        <span>
          <span className="font-semibold">Diversification benefit</span>
          {data.avgCorrelation !== null && (
            <span className="text-emerald-400/70"> (r={data.avgCorrelation > 0 ? "+" : ""}{data.avgCorrelation.toFixed(2)})</span>
          )}
        </span>
      </div>
    );
  }

  return null;
}
