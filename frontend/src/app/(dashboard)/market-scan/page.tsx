"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPercent, formatCurrency } from "@/lib/utils";
import { ScanSearch, RefreshCw, Info, TrendingUp, ShieldCheck, ShieldAlert, ShieldX, GraduationCap, Search, Zap, Bot } from "lucide-react";
import { Input } from "@/components/ui/input";

// ── Types ────────────────────────────────────────────────────────────────────

interface InstrumentSuggestion {
  ticker: string;
  name: string;
  asset_type: string;
  market: string;
  currency: string;
  risk_level: string;
  typical_horizon: string;
  asset_family: string;
  fit_score: number;
  rationale: string;
  tags: string[];
}

interface MarketScanResult {
  investor_id: string;
  readiness_classification: string;
  suggestions: InstrumentSuggestion[];
  scan_notes: string[];
  computed_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const RISK_COLORS: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  moderate: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  very_high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const RISK_BAR_COLORS: Record<string, string> = {
  low: "bg-emerald-500",
  moderate: "bg-blue-500",
  high: "bg-amber-500",
  very_high: "bg-red-500",
};

const FAMILY_COLORS: Record<string, string> = {
  preservation: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  balanced: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  growth: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  speculative: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

const MARKET_COLORS: Record<string, string> = {
  US: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  EU: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  GLOBAL: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  CRYPTO: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

function readinessIcon(classification: string) {
  switch (classification) {
    case "ready": return <ShieldCheck className="h-4 w-4 text-emerald-500" />;
    case "ready_with_limits": return <ShieldAlert className="h-4 w-4 text-amber-500" />;
    case "education_only": return <GraduationCap className="h-4 w-4 text-blue-500" />;
    default: return <ShieldX className="h-4 w-4 text-red-500" />;
  }
}

function readinessBadgeClass(classification: string) {
  switch (classification) {
    case "ready": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "ready_with_limits": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "education_only": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    default: return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  }
}

function label(str: string) {
  return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface QuoteResult {
  ticker: string;
  price: number;
  currency: string;
  cached: boolean;
}

interface AiOpportunity {
  ticker: string;
  name: string;
  asset_type: string;
  why_now: string;
  fit_score: number;
  risk_level: string;
  is_in_portfolio: boolean;
  suggested_allocation_pct: number;
  current_price: number | null;
  price_currency: string | null;
}

export default function MarketScanPage() {
  const investorId = useInvestorId();
  const [result, setResult] = useState<MarketScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTicker, setSearchTicker] = useState("");
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [aiSignals, setAiSignals] = useState<AiOpportunity[] | null>(null);
  const [loadingSignals, setLoadingSignals] = useState(false);

  async function fetchScan() {
    if (!investorId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/market-scan`);
      if (!res.ok) throw new Error("Failed to load market scan");
      setResult(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function searchQuote() {
    const ticker = searchTicker.trim().toUpperCase();
    if (!ticker) return;
    setSearching(true);
    setQuoteResult(null);
    setQuoteError(null);
    try {
      const res = await fetch(`/api/v1/market/quote/${ticker}?force_refresh=true`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `Price unavailable for ${ticker}`);
      }
      setQuoteResult(await res.json());
    } catch (e: unknown) {
      setQuoteError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setSearching(false);
    }
  }

  async function getAiSignals() {
    if (!investorId) return;
    setLoadingSignals(true);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/agent`);
      if (res.ok) {
        const report = await res.json();
        setAiSignals(report.top_opportunities ?? []);
      }
    } finally {
      setLoadingSignals(false);
    }
  }

  useEffect(() => {
    fetchScan();
  }, [investorId]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[300px]">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Scanning instruments…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  const rc = result?.readiness_classification ?? "not_ready";

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 lg:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ScanSearch className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold">Market Scanner</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Curated instruments ranked to your risk profile, time horizon, and portfolio gaps.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={getAiSignals}
            disabled={loadingSignals || !result}
            className="gap-2"
          >
            {loadingSignals ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
            {loadingSignals ? "Analysing…" : "Ask AI"}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchScan} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Ticker search */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Look up any ticker</p>
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 uppercase"
                placeholder="e.g. NVDA, AAPL, BTC"
                value={searchTicker}
                onChange={e => setSearchTicker(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && searchQuote()}
              />
            </div>
            <Button variant="outline" size="sm" onClick={searchQuote} disabled={searching || !searchTicker.trim()}>
              {searching ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Get price"}
            </Button>
          </div>
          {quoteResult && (
            <div className="mt-3 flex items-center gap-4 text-sm">
              <span className="font-mono font-semibold">{quoteResult.ticker}</span>
              <span className="text-xl font-bold">{formatCurrency(quoteResult.price, quoteResult.currency)}</span>
              <span className="text-xs text-muted-foreground">{quoteResult.currency}</span>
              {quoteResult.cached && <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">cached</span>}
            </div>
          )}
          {quoteError && <p className="mt-2 text-xs text-destructive">{quoteError}</p>}
        </CardContent>
      </Card>

      {/* Readiness banner */}
      {result && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3">
          {readinessIcon(rc)}
          <span className="text-sm">
            Investment readiness:
          </span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${readinessBadgeClass(rc)}`}>
            {label(rc)}
          </span>
          {result.suggestions.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">
              {result.suggestions.length} instrument{result.suggestions.length !== 1 ? "s" : ""} matched
            </span>
          )}
        </div>
      )}

      {/* Scan notes */}
      {result && result.scan_notes.length > 0 && (
        <div className="space-y-1.5">
          {result.scan_notes.map((note, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{note}</span>
            </div>
          ))}
        </div>
      )}

      {/* No suggestions */}
      {result && result.suggestions.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <ShieldX className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No instruments available</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Improve your financial stability or generate a risk model to unlock suggestions.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Suggestion grid */}
      {result && result.suggestions.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {result.suggestions.map((s) => (
            <Card key={s.ticker} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-bold tracking-tight leading-none">{s.ticker}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-snug">{s.name}</p>
                  </div>
                  {/* Fit score */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">{s.fit_score.toFixed(0)}</p>
                    <p className="text-[10px] text-muted-foreground">fit score</p>
                  </div>
                </div>

                {/* Fit score bar */}
                <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${RISK_BAR_COLORS[s.risk_level] ?? "bg-primary"}`}
                    style={{ width: `${Math.min(s.fit_score, 100)}%` }}
                  />
                </div>
              </CardHeader>

              <CardContent className="flex flex-col gap-3 flex-1">
                {/* Badge row */}
                <div className="flex flex-wrap gap-1.5">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${RISK_COLORS[s.risk_level] ?? ""}`}>
                    {label(s.risk_level)} risk
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${FAMILY_COLORS[s.asset_family] ?? ""}`}>
                    {label(s.asset_family)}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${MARKET_COLORS[s.market] ?? "bg-muted text-muted-foreground"}`}>
                    {s.market}
                  </span>
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
                    {label(s.typical_horizon)}
                  </span>
                </div>

                {/* Rationale */}
                <p className="text-xs text-muted-foreground leading-relaxed flex-1">{s.rationale}</p>

                {/* Footer */}
                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {s.asset_type} · {s.currency}
                  </span>
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* AI signals section */}
      {aiSignals && aiSignals.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">AI buy signals for you</h2>
            <span className="text-xs text-muted-foreground">· Based on your portfolio, goals & risk profile</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {aiSignals.map((opp) => (
              <Card key={opp.ticker} className={opp.is_in_portfolio ? "border-green-200/60" : ""}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-mono font-bold text-sm">{opp.ticker}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{opp.name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-0.5 text-amber-400 justify-end text-xs">
                        {"★".repeat(Math.min(5, Math.round(opp.fit_score / 2)))}
                        <span className="text-muted-foreground ml-1">{opp.fit_score}/10</span>
                      </div>
                      <p className="text-xs font-semibold text-primary mt-0.5">{opp.suggested_allocation_pct}% of portfolio</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{opp.why_now}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className={`capitalize font-medium ${RISK_COLORS[opp.risk_level] ?? ""}`}>{opp.risk_level.replace("_", " ")} risk</span>
                    {opp.is_in_portfolio && (
                      <span className="text-[10px] bg-green-500/10 text-green-600 border border-green-200 rounded-full px-2 py-0.5">Already owned</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {aiSignals && aiSignals.length === 0 && !loadingSignals && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground text-center">
          AI agent returned no specific buy signals for your current situation.
        </div>
      )}

      {result && (
        <p className="text-[10px] text-muted-foreground text-right">
          Computed {new Date(result.computed_at).toLocaleString()} · For educational purposes only — not financial advice.
        </p>
      )}
    </div>
  );
}
