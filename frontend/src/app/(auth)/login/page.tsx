"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

interface Investor {
  id: string;
  full_name: string;
  base_currency: string;
  country: string;
  experience_level: string;
  is_minor: boolean;
}

export default function LoginPage() {
  const router = useRouter();
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existing = localStorage.getItem("tradeops_investor_id");
    if (existing) {
      router.push("/dashboard");
      return;
    }
    fetch("/api/v1/investors/")
      .then((r) => r.json())
      .then((data) => {
        setInvestors(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not connect to the API. Is the backend running?");
        setLoading(false);
      });
  }, [router]);

  function selectInvestor(id: string) {
    localStorage.setItem("tradeops_investor_id", id);
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
            <span className="text-xl">⚡</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">TradeOps AI</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Personal Financial Intelligence Platform
          </p>
        </div>

        <div className="border border-border rounded-lg bg-card shadow-sm p-6">
          <h2 className="text-sm font-semibold mb-1">Select your profile</h2>
          <p className="text-xs text-muted-foreground mb-5">
            Choose an investor profile to continue
          </p>

          {loading && (
            <div className="flex items-center justify-center h-20">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {!loading && !error && investors.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No investor profiles found.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create one via the API or Swagger UI at{" "}
                <code className="font-mono text-xs bg-muted px-1 rounded">
                  /api/v1/investors/
                </code>
              </p>
            </div>
          )}

          {!loading && investors.length > 0 && (
            <ul className="space-y-2">
              {investors.map((inv) => (
                <li key={inv.id}>
                  <button
                    onClick={() => selectInvestor(inv.id)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-md border border-border hover:bg-muted hover:border-primary/40 transition-colors text-left group"
                  >
                    <div>
                      <p className="text-sm font-medium">{inv.full_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {inv.country} · {inv.base_currency} · {inv.experience_level}
                        {inv.is_minor && " · Minor (education only)"}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
