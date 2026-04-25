"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";

interface InvestorProfile {
  id: string;
  full_name: string;
  country: string;
  base_currency: string;
  local_currency: string;
  experience_level: string;
  is_minor: boolean;
}

export default function SettingsPage() {
  const investorId = useInvestorId();
  const [profile, setProfile] = useState<InvestorProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!investorId) return;
    fetch(`/api/v1/investors/${investorId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setProfile)
      .catch((e) => setError(e.message));
  }, [investorId]);

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
