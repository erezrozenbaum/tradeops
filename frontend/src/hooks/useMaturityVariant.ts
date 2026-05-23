"use client";

export type MaturityStage = "foundation" | "discipline" | "optimization" | "advanced_cognition";

export interface MaturityVariant {
  showNumericMetrics: boolean;
  showCausalExplanations: boolean;
  showProbabilisticLanguage: boolean;
  actionCopyDetail: "minimal" | "standard" | "detailed";
  radarLabelStyle: "simple" | "full";
  aiVerbosity: "beginner" | "standard" | "advanced";
  showFuturesPreview: boolean;
  showReplayHighlight: boolean;
  showDragFactors: boolean;
}

const VARIANTS: Record<MaturityStage, MaturityVariant> = {
  foundation: {
    showNumericMetrics: false,
    showCausalExplanations: false,
    showProbabilisticLanguage: false,
    actionCopyDetail: "minimal",
    radarLabelStyle: "simple",
    aiVerbosity: "beginner",
    showFuturesPreview: false,
    showReplayHighlight: false,
    showDragFactors: false,
  },
  discipline: {
    showNumericMetrics: true,
    showCausalExplanations: true,
    showProbabilisticLanguage: false,
    actionCopyDetail: "standard",
    radarLabelStyle: "full",
    aiVerbosity: "standard",
    showFuturesPreview: true,
    showReplayHighlight: true,
    showDragFactors: true,
  },
  optimization: {
    showNumericMetrics: true,
    showCausalExplanations: true,
    showProbabilisticLanguage: true,
    actionCopyDetail: "detailed",
    radarLabelStyle: "full",
    aiVerbosity: "standard",
    showFuturesPreview: true,
    showReplayHighlight: true,
    showDragFactors: true,
  },
  advanced_cognition: {
    showNumericMetrics: true,
    showCausalExplanations: true,
    showProbabilisticLanguage: true,
    actionCopyDetail: "detailed",
    radarLabelStyle: "full",
    aiVerbosity: "advanced",
    showFuturesPreview: true,
    showReplayHighlight: true,
    showDragFactors: true,
  },
};

export function useMaturityVariant(stage: string | undefined): MaturityVariant {
  const key = (stage ?? "foundation") as MaturityStage;
  return VARIANTS[key] ?? VARIANTS.foundation;
}
