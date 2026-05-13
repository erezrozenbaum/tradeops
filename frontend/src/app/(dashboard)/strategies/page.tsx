"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Lightbulb, RefreshCw } from "lucide-react";

interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  strategy_type: string;
  asset_classes: string[];
  markets: string[];
  min_stability_score: number;
  allowed_risk_modifiers: string[];
  min_experience_level: string;
  suitable_for_minors: boolean;
  min_investable_capital: number;
  time_horizon_min_months: number;
  is_active: boolean;
}

interface Recommendation {
  id: string;
  strategy_template_id: string;
  template: StrategyTemplate;
  fit_score: number;
  notes: string;
  generated_at: string;
}

const TYPE_COLORS: Record<string, string> = {
  conservative: "text-green-500",
  balanced: "text-blue-500",
  growth: "text-purple-500",
  aggressive: "text-red-500",
};

export default function StrategiesPage() {
  const investorId = useInvestorId();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!investorId) return;
    fetch(`/api/v1/investors/${investorId}/strategies`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setRecommendations)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (investorId) load();
  }, [investorId]);

  async function generate() {
    if (!investorId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/strategies`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.detail ?? "Failed to generate");
      }
      const recs = await res.json();
      setRecommendations(recs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setGenerating(false);
    }
  }

  if (!investorId || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Strategy Recommendations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Suitable strategies based on your risk model and profile
          </p>
        </div>
        <Button onClick={generate} disabled={generating}>
          <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
          {generating ? "Generating…" : "Regenerate"}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-3 text-red-500 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {recommendations.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Lightbulb className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">No recommendations yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Generate a risk model first, then click &quot;Regenerate&quot; to see strategies suited to your profile.
            </p>
            <Button className="mt-4" onClick={generate} disabled={generating}>
              {generating ? "Generating…" : "Generate recommendations"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {recommendations.map((rec, i) => (
            <Card key={rec.id} className="relative">
              {i === 0 && (
                <div className="absolute top-3 right-3">
                  <Badge variant="success">Best fit</Badge>
                </div>
              )}
              <CardHeader className="pb-3">
                <p className="text-xs text-muted-foreground capitalize mb-1">
                  {rec.template.strategy_type.replace(/_/g, " ")}
                </p>
                <CardTitle className="text-base leading-tight">{rec.template.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {rec.template.description}
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Fit score</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${rec.fit_score * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium">
                      {(rec.fit_score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {rec.template.asset_classes.map((a) => (
                    <span
                      key={a}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize"
                    >
                      {a}
                    </span>
                  ))}
                  {rec.template.markets.map((m) => (
                    <span
                      key={m}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase"
                    >
                      {m}
                    </span>
                  ))}
                </div>

                <div className="border-t border-border pt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Min. horizon</p>
                    <p className="font-medium">{rec.template.time_horizon_min_months} months</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Experience</p>
                    <p className="font-medium capitalize">{rec.template.min_experience_level}</p>
                  </div>
                </div>

                {rec.notes && (
                  <p className={`text-xs italic ${TYPE_COLORS[rec.template.strategy_type] ?? "text-muted-foreground"}`}>
                    {rec.notes}
                  </p>
                )}

                <p className="text-[10px] text-muted-foreground">
                  Generated {new Date(rec.generated_at).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
