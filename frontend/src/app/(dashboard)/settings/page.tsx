"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface InvestorProfile {
  id: string;
  full_name: string;
  country: string;
  base_currency: string;
  local_currency: string;
  experience_level: string;
  is_minor: boolean;
}

interface HoldingInfo {
  ticker: string | null;
  currency: string;
}

interface AccountWithHoldings {
  id: string;
  holdings: HoldingInfo[];
}

export default function SettingsPage() {
  const investorId = useInvestorId();
  const [profile, setProfile] = useState<InvestorProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tickers, setTickers] = useState<string[]>([]);
  const [quoteCache, setQuoteCache] = useState<Record<string, { price: number; currency: string; cached: boolean } | null>>({});
  const [refreshingCache, setRefreshingCache] = useState(false);

  useEffect(() => {
    if (!investorId) return;
    fetch(`/api/v1/investors/${investorId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setProfile)
      .catch((e) => setError(e.message));

    fetch(`/api/v1/investors/${investorId}/accounts`)
      .then((r) => r.ok ? r.json() : [])
      .then((accounts: AccountWithHoldings[]) => {
        const found = Array.from(new Set(
          accounts.flatMap(a => a.holdings.map(h => h.ticker).filter(Boolean) as string[])
        ));
        setTickers(found);
        if (found.length > 0) {
          Promise.all(
            found.map(t =>
              fetch(`/api/v1/market/quote/${t}`)
                .then(r => r.ok ? r.json() : null)
                .catch(() => null)
            )
          ).then(results => {
            const map: Record<string, { price: number; currency: string; cached: boolean } | null> = {};
            found.forEach((t, i) => { map[t] = results[i]; });
            setQuoteCache(map);
          });
        }
      });
  }, [investorId]);

  async function refreshAllPrices() {
    if (!investorId) return;
    setRefreshingCache(true);
    try {
      await fetch(`/api/v1/investors/${investorId}/portfolio/refresh-prices`, { method: "POST" });
      const results = await Promise.all(
        tickers.map(t =>
          fetch(`/api/v1/market/quote/${t}`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        )
      );
      const map: Record<string, { price: number; currency: string; cached: boolean } | null> = {};
      tickers.forEach((t, i) => { map[t] = results[i]; });
      setQuoteCache(map);
    } finally {
      setRefreshingCache(false);
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Account and platform preferences
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 text-red-500 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Current session */}
      <Card>
        <CardHeader>
          <CardTitle>Active Session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile ? (
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 text-sm">
              {[
                { label: "Name", value: profile.full_name },
                { label: "Country", value: profile.country },
                { label: "Base Currency", value: profile.base_currency },
                { label: "Local Currency", value: profile.local_currency },
                {
                  label: "Experience",
                  value: <span className="capitalize">{profile.experience_level}</span>,
                },
                {
                  label: "Mode",
                  value: (
                    <Badge variant={profile.is_minor ? "warning" : "muted"}>
                      {profile.is_minor ? "Education only" : "Full access"}
                    </Badge>
                  ),
                },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground mb-0.5">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="h-5 w-32 rounded bg-muted animate-pulse" />
          )}
          <p className="text-xs text-muted-foreground pt-2 border-t border-border">
            Investor ID:{" "}
            <span className="font-mono">{investorId}</span>
          </p>
        </CardContent>
      </Card>

      {/* Platform info */}
      <Card>
        <CardHeader>
          <CardTitle>Platform</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="Live trading" value={<Badge variant="muted">Disabled — MVP scope</Badge>} />
          <Row label="Leverage / margin" value={<Badge variant="muted">Not available</Badge>} />
          <Row label="AI analysis" value={<Badge variant="success">Available</Badge>} />
          <Row label="Paper trading" value={<Badge variant="success">Available</Badge>} />
          <Row label="Backtesting" value={<Badge variant="success">Available</Badge>} />
        </CardContent>
      </Card>

      {/* Market data cache */}
      {tickers.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Market Data Cache</CardTitle>
              <Button variant="outline" size="sm" onClick={refreshAllPrices} disabled={refreshingCache}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshingCache ? "animate-spin" : ""}`} />
                {refreshingCache ? "Refreshing…" : "Refresh all"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Alpha Vantage free tier: 25 calls/day · 24h cache TTL. TASE tickers may not be available.
            </p>
            <div className="space-y-2">
              {tickers.map(ticker => {
                const q = quoteCache[ticker];
                return (
                  <div key={ticker} className="flex items-center justify-between text-sm">
                    <span className="font-mono font-medium">{ticker}</span>
                    {q === undefined ? (
                      <span className="text-xs text-muted-foreground">Loading…</span>
                    ) : q === null ? (
                      <Badge variant="warning">Unavailable</Badge>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="tabular-nums">{q.price.toFixed(2)} {q.currency}</span>
                        <Badge variant={q.cached ? "muted" : "success"}>{q.cached ? "Cached" : "Fresh"}</Badge>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The platform uses your system preference for light or dark mode via{" "}
            <span className="font-mono text-xs">next-themes</span>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      {value}
    </div>
  );
}
