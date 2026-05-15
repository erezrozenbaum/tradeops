"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, RefreshCw, Bell, BellOff, CheckCircle2, Mail } from "lucide-react";

interface InvestorProfile {
  id: string;
  full_name: string;
  country: string;
  base_currency: string;
  local_currency: string;
  experience_level: string;
  is_minor: boolean;
  alert_email: string | null;
  email_alerts_enabled: boolean;
  weekly_digest_enabled: boolean;
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

  const [alertEmail, setAlertEmail] = useState("");
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState(false);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [alertsSaved, setAlertsSaved] = useState(false);

  useEffect(() => {
    if (!investorId) return;
    fetch(`/api/v1/investors/${investorId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p: InvestorProfile | null) => {
        setProfile(p);
        if (p) {
          setAlertEmail(p.alert_email ?? "");
          setAlertsEnabled(p.email_alerts_enabled ?? false);
          setWeeklyDigestEnabled(p.weekly_digest_enabled ?? false);
        }
      })
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

  async function saveAlertSettings() {
    if (!investorId) return;
    setSavingAlerts(true);
    setAlertsSaved(false);
    try {
      await fetch(`/api/v1/investors/${investorId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert_email: alertEmail.trim() || null,
          email_alerts_enabled: alertsEnabled,
          weekly_digest_enabled: weeklyDigestEnabled,
        }),
      });
      setAlertsSaved(true);
      setTimeout(() => setAlertsSaved(false), 3000);
    } finally {
      setSavingAlerts(false);
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
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
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

      {/* Email notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {alertsEnabled ? (
              <Bell className="h-4 w-4 text-primary" />
            ) : (
              <BellOff className="h-4 w-4 text-muted-foreground" />
            )}
            Email Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Receive a daily digest of actionable alerts — at-risk goals, portfolio rebalancing, stale prices — directly in your inbox. Sent at 08:30 UTC each morning.
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-between py-2 border-y border-border">
            <div>
              <p className="text-sm font-medium">Enable email alerts</p>
              <p className="text-xs text-muted-foreground mt-0.5">Only sent when there are actionable warnings</p>
            </div>
            <button
              onClick={() => setAlertsEnabled(!alertsEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                alertsEnabled ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  alertsEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Weekly digest toggle */}
          <div className="flex items-center justify-between py-2 border-b border-border">
            <div>
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                Weekly AI Digest
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Friday 18:00 UTC — portfolio performance, goal progress, and 1–3 AI suggestions</p>
            </div>
            <button
              onClick={() => setWeeklyDigestEnabled(!weeklyDigestEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                weeklyDigestEnabled ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  weeklyDigestEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Email input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Alert email address</label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={alertEmail}
              onChange={(e) => setAlertEmail(e.target.value)}
            />
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <Button onClick={saveAlertSettings} disabled={savingAlerts} size="sm">
              {savingAlerts ? "Saving…" : "Save"}
            </Button>
            {alertsSaved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Saved
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground border-t border-border pt-3">
            Delivery requires SMTP configuration in the backend environment (
            <span className="font-mono">SMTP_HOST</span>,{" "}
            <span className="font-mono">SMTP_USER</span>,{" "}
            <span className="font-mono">SMTP_PASS</span>). See{" "}
            <span className="font-mono">.env.example</span> for setup instructions.
          </p>
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
