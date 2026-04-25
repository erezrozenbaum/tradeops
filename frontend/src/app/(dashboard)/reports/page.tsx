"use client";

import { useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Sparkles, RefreshCw } from "lucide-react";

interface AnalysisReport {
  investor_id: string;
  generated_at: string;
  summary: string;
  financial_health: string;
  risk_profile: string;
  strategy_analysis: string;
  backtest_insights: string;
  paper_trading_performance: string;
  recommendations: string;
}

const SECTIONS: { key: keyof AnalysisReport; label: string }[] = [
  { key: "summary", label: "Executive Summary" },
  { key: "financial_health", label: "Financial Health" },
  { key: "risk_profile", label: "Risk Profile" },
  { key: "strategy_analysis", label: "Strategy Analysis" },
  { key: "backtest_insights", label: "Backtest Insights" },
  { key: "paper_trading_performance", label: "Paper Trading Performance" },
  { key: "recommendations", label: "Recommendations" },
];

export default function ReportsPage() {
  const investorId = useInvestorId();
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!investorId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/ai-report`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.detail ?? "Failed to generate report");
      }
      setReport(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setGenerating(false);
    }
  }

  if (!investorId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Financial Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Comprehensive AI-generated analysis of your financial position
          </p>
        </div>
        <Button onClick={generate} disabled={generating}>
          <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
          {generating ? "Generating…" : report ? "Regenerate" : "Generate report"}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-3 text-sm p-4 rounded-lg border border-red-500/20 bg-red-500/5 text-red-500">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!report && !generating && (
        <Card>
          <CardContent className="py-20 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm font-medium mb-1">No report generated yet</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-6">
              The AI will analyse your financial profile, risk model, strategies, backtest results,
              and paper trading performance to produce a comprehensive report.
            </p>
            <Button onClick={generate} disabled={generating}>
              Generate report
            </Button>
          </CardContent>
        </Card>
      )}

      {generating && (
        <Card>
          <CardContent className="py-20 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              Analysing your financial data — this may take a few seconds…
            </p>
          </CardContent>
        </Card>
      )}

      {report && !generating && (
        <>
          <p className="text-xs text-muted-foreground">
            Generated {new Date(report.generated_at).toLocaleString()}
          </p>
          <div className="space-y-4">
            {SECTIONS.map(({ key, label }) => {
              const text = report[key] as string;
              if (!text || typeof text !== "string") return null;
              return (
                <Card key={key}>
                  <CardHeader>
                    <CardTitle>{label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                      {text}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
