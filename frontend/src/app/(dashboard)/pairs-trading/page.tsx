"use client";

import { useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeftRight, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, XCircle, Minus, RefreshCw, Info,
} from "lucide-react";

interface PairAnalysis {
  ticker1: string;
  ticker2: string;
  lookback_days: number;
  hedge_ratio: number;
  spread_mean: number;
  spread_std: number;
  z_score: number;
  adf_stat: number;
  is_cointegrated: boolean;
  signal: "LONG_SPREAD" | "SHORT_SPREAD" | "EXIT" | "STOP_LOSS" | "NEUTRAL";
  signal_reason: string;
  data_points: number;
}

const SIGNAL_META = {
  LONG_SPREAD:  { label: "Long Spread",  color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200", icon: <TrendingUp className="h-4 w-4" /> },
  SHORT_SPREAD: { label: "Short Spread", color: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-200", icon: <TrendingDown className="h-4 w-4" /> },
  EXIT:         { label: "Exit",         color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200", icon: <Minus className="h-4 w-4" /> },
  STOP_LOSS:    { label: "Stop Loss",    color: "bg-red-600/10 text-red-700 dark:text-red-500 border-red-300", icon: <AlertTriangle className="h-4 w-4" /> },
  NEUTRAL:      { label: "Neutral",      color: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200", icon: <Minus className="h-4 w-4" /> },
};

function ZScoreBar({ z }: { z: number }) {
  const pct = Math.min(Math.max((z + 4) / 8 * 100, 0), 100);
  const color =
    Math.abs(z) >= 3.5 ? "bg-red-500" :
    Math.abs(z) >= 2.0 ? (z > 0 ? "bg-amber-500" : "bg-emerald-500") :
    "bg-blue-400";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>-4</span>
        <span className="font-medium text-foreground">Z = {z.toFixed(3)}</span>
        <span>+4</span>
      </div>
      <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
        {/* Signal zones */}
        <div className="absolute inset-y-0 left-0 w-[6.25%] bg-red-200/40 dark:bg-red-900/30" />
        <div className="absolute inset-y-0 left-[6.25%] w-[18.75%] bg-emerald-200/30 dark:bg-emerald-900/20" />
        <div className="absolute inset-y-0 right-[6.25%] w-[18.75%] bg-amber-200/30 dark:bg-amber-900/20" />
        <div className="absolute inset-y-0 right-0 w-[6.25%] bg-red-200/40 dark:bg-red-900/30" />
        {/* Needle */}
        <div
          className={`absolute top-0 h-full w-1 rounded-full ${color} transition-all duration-500`}
          style={{ left: `calc(${pct}% - 2px)` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Stop</span>
        <span className="ml-3">Long ≤-2</span>
        <span className="ml-auto">Short ≥2</span>
        <span>Stop</span>
      </div>
    </div>
  );
}

function StatRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm py-1.5 border-b border-border last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

export default function PairsTradingPage() {
  const investorId = useInvestorId();
  const [ticker1, setTicker1] = useState("AAPL");
  const [ticker2, setTicker2] = useState("MSFT");
  const [lookback, setLookback] = useState(252);
  const [analysis, setAnalysis] = useState<PairAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function runAnalysis() {
    if (!investorId) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setSaved(false);
    try {
      const r = await fetch(
        `/api/v1/investors/${investorId}/pairs-trading/analyze?ticker1=${ticker1.trim().toUpperCase()}&ticker2=${ticker2.trim().toUpperCase()}&lookback=${lookback}`
      );
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.detail ?? "Analysis failed — check tickers and try again.");
        return;
      }
      setAnalysis(await r.json());
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function saveSignal() {
    if (!investorId || !analysis) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/v1/investors/${investorId}/pairs-trading/signals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker1: analysis.ticker1, ticker2: analysis.ticker2, lookback_days: analysis.lookback_days }),
      });
      if (r.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const meta = analysis ? SIGNAL_META[analysis.signal] : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5 text-blue-500" />
          Pairs Trading Analyzer
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Statistical arbitrage — paper mode only. ADF cointegration test + OLS hedge ratio.
        </p>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3.5">
        <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
          Pairs trading is a market-neutral strategy. Past cointegration does not guarantee future results.
          All signals are for paper trading analysis only — no live execution.
        </p>
      </div>

      {/* Input form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pair Selection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Ticker 1 (long leg)</label>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono uppercase placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={ticker1}
                onChange={e => setTicker1(e.target.value.toUpperCase())}
                placeholder="AAPL"
                maxLength={10}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Ticker 2 (short leg)</label>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono uppercase placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={ticker2}
                onChange={e => setTicker2(e.target.value.toUpperCase())}
                placeholder="MSFT"
                maxLength={10}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Lookback period</label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={lookback}
              onChange={e => setLookback(Number(e.target.value))}
            >
              <option value={63}>63 days (3 months)</option>
              <option value={126}>126 days (6 months)</option>
              <option value={252}>252 days (1 year)</option>
              <option value={504}>504 days (2 years)</option>
            </select>
          </div>

          <Button
            className="w-full"
            onClick={runAnalysis}
            disabled={loading || !ticker1 || !ticker2}
          >
            {loading
              ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Analyzing…</>
              : <><ArrowLeftRight className="h-4 w-4 mr-2" /> Analyze Pair</>
            }
          </Button>

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5" /> {error}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {analysis && meta && (
        <>
          {/* Signal card */}
          <Card className={analysis.signal === "STOP_LOSS" ? "border-red-300 dark:border-red-800" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {analysis.ticker1} / {analysis.ticker2}
                </CardTitle>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${meta.color}`}>
                  {meta.icon} {meta.label}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Z-score meter */}
              <ZScoreBar z={analysis.z_score} />

              <p className="text-sm text-muted-foreground">{analysis.signal_reason}</p>

              {/* Cointegration badge */}
              <div className="flex items-center gap-2">
                {analysis.is_cointegrated ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                      Cointegrated (ADF τ = {analysis.adf_stat.toFixed(3)} &lt; −2.87)
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-600 dark:text-red-400 font-medium">
                      Not cointegrated (ADF τ = {analysis.adf_stat.toFixed(3)}) — do not trade
                    </span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <StatRow label="Hedge ratio (β)" value={analysis.hedge_ratio.toFixed(6)} mono />
              <StatRow label="Spread mean" value={analysis.spread_mean.toFixed(4)} mono />
              <StatRow label="Spread std dev" value={analysis.spread_std.toFixed(4)} mono />
              <StatRow label="Z-score" value={analysis.z_score.toFixed(4)} mono />
              <StatRow label="ADF τ statistic" value={analysis.adf_stat.toFixed(4)} mono />
              <StatRow label="ADF 5% critical" value="−2.870" mono />
              <StatRow label="Data points" value={`${analysis.data_points} trading days`} />
              <StatRow label="Lookback" value={`${analysis.lookback_days} days requested`} />
            </CardContent>
          </Card>

          {/* How to trade */}
          {analysis.is_cointegrated && analysis.signal !== "NEUTRAL" && analysis.signal !== "EXIT" && (
            <Card className="border-blue-200 dark:border-blue-900">
              <CardHeader>
                <CardTitle className="text-base text-blue-700 dark:text-blue-400">How to trade this signal (paper only)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {analysis.signal === "LONG_SPREAD" && (
                  <>
                    <p>• <strong>Buy</strong> {analysis.ticker1} (long leg)</p>
                    <p>• <strong>Sell short</strong> {analysis.ticker2} × {analysis.hedge_ratio.toFixed(4)} units per unit of {analysis.ticker1}</p>
                    <p>• <strong>Exit</strong> when Z-score returns to 0 ± 0.5</p>
                    <p>• <strong>Stop loss</strong> if |Z| reaches 3.5 — spread may have broken down</p>
                  </>
                )}
                {analysis.signal === "SHORT_SPREAD" && (
                  <>
                    <p>• <strong>Sell short</strong> {analysis.ticker1} (long leg)</p>
                    <p>• <strong>Buy</strong> {analysis.ticker2} × {analysis.hedge_ratio.toFixed(4)} units per unit of {analysis.ticker1}</p>
                    <p>• <strong>Exit</strong> when Z-score returns to 0 ± 0.5</p>
                    <p>• <strong>Stop loss</strong> if |Z| reaches 3.5</p>
                  </>
                )}
                {analysis.signal === "STOP_LOSS" && (
                  <p>• <strong>Exit all positions immediately.</strong> The spread has moved beyond the ±3.5 stop-loss boundary — the cointegration relationship may have permanently broken down.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Save signal */}
          <div className="flex justify-end">
            {saved ? (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Signal saved to market signals
              </span>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={saveSignal}
                disabled={saving || !analysis.is_cointegrated}
                title={!analysis.is_cointegrated ? "Only cointegrated pairs can be saved as signals" : undefined}
              >
                {saving ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                Save as market signal
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
