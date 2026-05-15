"use client";

import { useEffect, useState, useCallback } from "react";
import { TrendingUp, TrendingDown, Minus, Eye, X, Fish, Newspaper, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SentimentTick {
  signal_date: string;
  sentiment_score: number;
  composite_score: number;
}

interface TickerSignal {
  signal_id: string;
  ticker: string;
  signal_type: string;
  signal_date: string;
  sentiment_score: number;
  composite_score: number;
  rationale: string;
  whale_entities: string[];
  guard_status: string;
  mute_reason: string | null;
  is_dismissed: boolean;
  position_value: number | null;
  position_pct: number | null;
  unrealized_pnl: number | null;
  holding_days: number | null;
  trend_direction: string;
  trend_history: SentimentTick[];
  connected_insight: string | null;
}

interface MarketSignalsResult {
  investor_id: string;
  currency: string;
  tickers_monitored: number;
  approved_count: number;
  muted_count: number;
  whale_mention_count: number;
  signals: TickerSignal[];
  computed_at: string;
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 70 ? "bg-emerald-500" :
    score >= 45 ? "bg-amber-400" :
    "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums w-7 text-right">{score}</span>
    </div>
  );
}

function Sparkline({ history }: { history: SentimentTick[] }) {
  if (history.length < 2) return null;
  const scores = history.map((t) => t.sentiment_score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const W = 72;
  const H = 24;
  const pts = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * W;
    const y = H - ((s - min) / range) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = scores[scores.length - 1];
  const dotColor = last > 0.1 ? "#10b981" : last < -0.1 ? "#ef4444" : "#f59e0b";
  const [lx, ly] = pts[pts.length - 1].split(",").map(Number);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-muted-foreground/60"
      />
      <circle cx={lx} cy={ly} r="2.5" fill={dotColor} />
    </svg>
  );
}

function TrendIcon({ direction }: { direction: string }) {
  if (direction === "improving") return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (direction === "deteriorating") return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function fmt(v: number | null, currency: string) {
  if (v === null || v === undefined) return "—";
  return `${currency} ${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function SignalCard({
  signal,
  currency,
  onDismiss,
}: {
  signal: TickerSignal;
  currency: string;
  onDismiss: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const isWhale = signal.signal_type === "WHALE_MENTION";

  async function handleDismiss() {
    setDismissing(true);
    onDismiss(signal.signal_id);
  }

  const pnlColor =
    signal.unrealized_pnl === null ? "" :
    signal.unrealized_pnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500";

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2.5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-sm">{signal.ticker}</span>
          {isWhale ? (
            <Badge className="text-[10px] py-0 px-1.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border-0">
              <Fish className="h-2.5 w-2.5 mr-0.5" />
              WHALE
            </Badge>
          ) : (
            <Badge className="text-[10px] py-0 px-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-0">
              <Newspaper className="h-2.5 w-2.5 mr-0.5" />
              NEWS
            </Badge>
          )}
          <div className="flex items-center gap-1">
            <TrendIcon direction={signal.trend_direction} />
            <span className="text-[10px] text-muted-foreground capitalize">{signal.trend_direction}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Sparkline history={signal.trend_history} />
        </div>
      </div>

      {/* Composite score bar */}
      <ScoreBar score={signal.composite_score} />

      {/* Position context */}
      {signal.position_pct !== null && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{signal.position_pct.toFixed(1)}% of portfolio</span>
          {signal.position_value !== null && <span>{fmt(signal.position_value, currency)}</span>}
          {signal.unrealized_pnl !== null && (
            <span className={pnlColor}>
              {signal.unrealized_pnl >= 0 ? "+" : "−"}{fmt(signal.unrealized_pnl, currency)} P&L
            </span>
          )}
          {signal.holding_days !== null && <span>{signal.holding_days}d held</span>}
        </div>
      )}

      {/* Connected insight */}
      {signal.connected_insight && (
        <div className="text-[11px] rounded-md px-2.5 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
          {signal.connected_insight}
        </div>
      )}

      {/* Whale entities */}
      {isWhale && signal.whale_entities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {signal.whale_entities.map((e) => (
            <span key={e} className="text-[10px] rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 px-2 py-0.5">
              {e}
            </span>
          ))}
        </div>
      )}

      {/* Rationale (expandable) */}
      <div>
        <button
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          <Eye className="h-3 w-3" />
          {expanded ? "Hide" : "View"} rationale
        </button>
        {expanded && (
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{signal.rationale}</p>
        )}
      </div>

      {/* Dismiss */}
      <div className="flex justify-end pt-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[11px] text-muted-foreground hover:text-foreground px-2"
          onClick={handleDismiss}
          disabled={dismissing}
        >
          <X className="h-3 w-3 mr-1" />
          Dismiss
        </Button>
      </div>
    </div>
  );
}

export function MarketSignalCard({ investorId }: { investorId: string }) {
  const [data, setData] = useState<MarketSignalsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMuted, setShowMuted] = useState(false);
  const [signals, setSignals] = useState<TickerSignal[]>([]);

  const load = useCallback(
    (muted: boolean) => {
      setLoading(true);
      fetch(`/api/v1/investors/${investorId}/market-signals?include_muted=${muted}&days=7`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: MarketSignalsResult | null) => {
          setData(d);
          setSignals(d?.signals ?? []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    },
    [investorId]
  );

  useEffect(() => {
    load(showMuted);
  }, [load, showMuted]);

  async function dismiss(signalId: string) {
    await fetch(`/api/v1/investors/${investorId}/market-signals/${signalId}/dismiss`, {
      method: "POST",
    });
    setSignals((prev) => prev.filter((s) => s.signal_id !== signalId));
  }

  if (loading) return null;
  if (!data) return null;

  const currency = data.currency;
  const hasSignals = signals.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          Market Signal Monitor
          <span className="text-xs font-normal text-muted-foreground ml-1">
            {data.tickers_monitored} tickers
          </span>
          {data.whale_mention_count > 0 && (
            <span className="text-[10px] font-medium rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 px-2 py-0.5 flex items-center gap-1">
              <Fish className="h-2.5 w-2.5" />
              {data.whale_mention_count} whale
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Summary strip */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{data.approved_count}</span> approved
          </span>
          {data.muted_count > 0 && (
            <span>
              <span className="font-medium text-foreground">{data.muted_count}</span> muted
            </span>
          )}
          <button
            className="ml-auto flex items-center gap-1 hover:text-foreground"
            onClick={() => load(showMuted)}
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
          {data.muted_count > 0 && (
            <button
              className="text-[11px] underline underline-offset-2 hover:text-foreground"
              onClick={() => setShowMuted((v) => !v)}
            >
              {showMuted ? "Hide muted" : "Show muted"}
            </button>
          )}
        </div>

        {/* Signal list */}
        {hasSignals ? (
          <div className="space-y-2">
            {signals.map((s) => (
              <SignalCard key={s.signal_id} signal={s} currency={currency} onDismiss={dismiss} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 space-y-1">
            <TrendingUp className="h-8 w-8 mx-auto text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No signals yet</p>
            <p className="text-xs text-muted-foreground/70">
              The daily worker runs at 20:15 UTC — check back after market close.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
