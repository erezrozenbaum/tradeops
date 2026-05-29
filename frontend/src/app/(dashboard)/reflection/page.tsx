"use client";

import { useEffect, useState, useCallback } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarDays, TrendingUp, TrendingDown, Minus,
  CheckCircle2, AlertTriangle, Lightbulb, Star,
  ChevronLeft, ChevronRight, RefreshCw, Target,
} from "lucide-react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`); }
  return res.json();
}

interface MonthlyStats {
  total_decisions: number;
  executed_decisions: number;
  cancelled_decisions: number;
  documented_decisions: number;
  goal_linked_decisions: number;
  documentation_rate: number;
  goal_alignment_rate: number;
  risk_override_count: number;
}

interface Report {
  month: string;
  month_label: string;
  stats: MonthlyStats;
  dqs_this_month: number | null;
  dqs_previous_month: number | null;
  dqs_change: number | null;
  dqs_trend: string;
  headline: string;
  decision_quality_narrative: string;
  behavioral_narrative: string;
  improvement_focus: string;
  achievements: string[];
  watch_list: string[];
  available_months: string[];
  sufficient_data: boolean;
}

function DQSPill({ score, change, trend }: { score: number | null; change: number | null; trend: string }) {
  if (score === null) return null;
  const color = score >= 80 ? "text-emerald-400" : score >= 65 ? "text-blue-400" : score >= 45 ? "text-amber-400" : "text-rose-400";
  const TrendIcon = trend === "improved" ? TrendingUp : trend === "declined" ? TrendingDown : Minus;
  const trendColor = trend === "improved" ? "text-emerald-400" : trend === "declined" ? "text-rose-400" : "text-muted-foreground";
  return (
    <div className="flex items-center gap-3">
      <span className={`text-4xl font-bold tabular-nums ${color}`}>{score.toFixed(0)}</span>
      <div>
        <div className="text-xs text-muted-foreground">Decision Quality Score</div>
        {change !== null && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${trendColor}`}>
            <TrendIcon className="w-3 h-3" />
            {change >= 0 ? "+" : ""}{change.toFixed(0)} vs last month
          </div>
        )}
        {trend === "first_month" && <div className="text-xs text-muted-foreground">First month</div>}
      </div>
    </div>
  );
}

function StatPill({ label, value, total }: { label: string; value: number; total?: number }) {
  return (
    <div className="text-center">
      <div className="text-xl font-bold tabular-nums text-foreground">{value}</div>
      {total !== undefined && <div className="text-[10px] text-muted-foreground">of {total}</div>}
      <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

export default function ReflectionPage() {
  const investorId = useInvestorId();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);

  const load = useCallback(async (m?: string) => {
    if (!investorId) return;
    setLoading(true); setError(null);
    try {
      const qs = m ? `?month=${m}` : "";
      const data = await apiFetch<Report>(`/investors/${investorId}/reflection-report${qs}`);
      setReport(data);
      setMonth(data.month);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [investorId]);

  useEffect(() => { load(); }, [load]);

  const navigate = (dir: "prev" | "next") => {
    if (!report) return;
    const idx = report.available_months.indexOf(report.month);
    const next = dir === "prev" ? idx - 1 : idx + 1;
    if (next >= 0 && next < report.available_months.length) load(report.available_months[next]);
  };

  if (!investorId || loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header + month nav */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Monthly Review
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your investing behaviour, decision quality, and growth — month by month.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {report && report.available_months.length > 1 && (
            <>
              <button
                onClick={() => navigate("prev")}
                disabled={report.available_months.indexOf(report.month) === 0}
                className="p-1.5 text-muted-foreground hover:text-foreground border border-border rounded hover:bg-muted/50 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium min-w-28 text-center">{report?.month_label}</span>
              <button
                onClick={() => navigate("next")}
                disabled={!report || report.available_months.indexOf(report.month) === report.available_months.length - 1}
                className="p-1.5 text-muted-foreground hover:text-foreground border border-border rounded hover:bg-muted/50 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
          <button onClick={() => load(month ?? undefined)} className="p-2 text-muted-foreground hover:text-foreground">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3">{error}</div>}

      {report && (
        <>
          {/* Headline card */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="pt-5 pb-5 space-y-4">
              <p className="text-lg font-semibold leading-snug">{report.headline}</p>
              <DQSPill score={report.dqs_this_month} change={report.dqs_change} trend={report.dqs_trend} />
            </CardContent>
          </Card>

          {/* Stats bar */}
          {report.stats.total_decisions > 0 && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 divide-x divide-border">
                  <StatPill label="Decisions" value={report.stats.total_decisions} />
                  <StatPill label="Executed" value={report.stats.executed_decisions} />
                  <StatPill label="Documented" value={report.stats.documented_decisions} total={report.stats.total_decisions} />
                  <StatPill label="Goal-Linked" value={report.stats.goal_linked_decisions} total={report.stats.total_decisions} />
                  <StatPill label="Cancelled" value={report.stats.cancelled_decisions} />
                  <StatPill label="Overrides" value={report.stats.risk_override_count} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Narrative sections */}
          {report.sufficient_data && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-4 pb-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-blue-400" /> Decision Quality
                  </p>
                  <p className="text-sm text-foreground/90 leading-relaxed">{report.decision_quality_narrative}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-amber-400" /> Behavior
                  </p>
                  <p className="text-sm text-foreground/90 leading-relaxed">{report.behavioral_narrative}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Improvement focus */}
          {report.sufficient_data && (
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="pt-4 pb-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> Focus for Next Month
                </p>
                <p className="text-sm text-foreground/90 leading-relaxed">{report.improvement_focus}</p>
              </CardContent>
            </Card>
          )}

          {/* Achievements + watch */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.achievements.length > 0 && (
              <Card className="border-emerald-500/20 bg-emerald-500/5">
                <CardContent className="pt-4 pb-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Achievements
                  </p>
                  <ul className="space-y-1.5">
                    {report.achievements.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-foreground/90">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            {report.watch_list.length > 0 && (
              <Card className="border-amber-500/20 bg-amber-500/5">
                <CardContent className="pt-4 pb-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Watch List
                  </p>
                  <ul className="space-y-1.5">
                    {report.watch_list.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-foreground/90">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Empty state */}
          {!report.sufficient_data && (
            <Card>
              <CardContent className="py-12 text-center space-y-2">
                <CalendarDays className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Stage 2+ orders this month to generate your first monthly review.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
