"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, X } from "lucide-react";

interface Investor {
  id: string;
  full_name: string;
  base_currency: string;
  country: string;
  experience_level: string;
  is_minor: boolean;
}

const EXPERIENCE_OPTIONS = ["beginner", "intermediate", "advanced"] as const;

const INVESTMENT_GOAL_OPTIONS = [
  { value: "growth", label: "Capital Growth" },
  { value: "income", label: "Passive Income" },
  { value: "preservation", label: "Capital Preservation" },
  { value: "education", label: "Education / Learning" },
  { value: "retirement", label: "Retirement Planning" },
  { value: "debt_reduction", label: "Debt Reduction" },
];

const RISK_TOLERANCE_OPTIONS = [
  { value: "very_low", label: "Very Low" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "very_high", label: "Very High" },
];

const TIME_HORIZON_OPTIONS = [
  { value: "short_term", label: "Short Term (< 2 years)" },
  { value: "medium_term", label: "Medium Term (2–7 years)" },
  { value: "long_term", label: "Long Term (7+ years)" },
];

const TRADING_FREQUENCY_OPTIONS = [
  { value: "none", label: "None — passive only" },
  { value: "low", label: "Low — occasionally" },
  { value: "medium", label: "Medium — monthly" },
  { value: "high", label: "High — weekly or more" },
];

const ASSET_OPTIONS = ["stocks", "bonds", "etf", "crypto", "real_estate", "forex", "commodities"];

const EMPTY_FORM = {
  full_name: "",
  date_of_birth: "",
  country: "",
  base_currency: "",
  local_currency: "",
  experience_level: "beginner" as (typeof EXPERIENCE_OPTIONS)[number],
  is_minor: false,
  investment_goal: "",
  risk_tolerance: "",
  time_horizon: "",
  preferred_assets: [] as string[],
  trading_frequency: "",
};

export default function LoginPage() {
  const router = useRouter();
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    const existing = localStorage.getItem("tradeops_investor_id");
    if (existing) {
      router.push("/dashboard");
      return;
    }
    fetch("/api/v1/investors")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setInvestors(list);
        if (list.length === 0) setShowCreate(true);
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

  function toggleAsset(asset: string) {
    const current = form.preferred_assets;
    setForm({
      ...form,
      preferred_assets: current.includes(asset)
        ? current.filter((a) => a !== asset)
        : [...current, asset],
    });
  }

  async function createInvestor(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const payload = {
        ...form,
        investment_goal: form.investment_goal || null,
        risk_tolerance: form.risk_tolerance || null,
        time_horizon: form.time_horizon || null,
        preferred_assets: form.preferred_assets.length > 0 ? form.preferred_assets : null,
        trading_frequency: form.trading_frequency || null,
      };
      const res = await fetch("/api/v1/investors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.detail ?? "Failed to create profile");
      }
      const inv: Investor = await res.json();
      selectInvestor(inv.id);
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Unknown error");
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
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
          {loading ? (
            <div className="flex items-center justify-center h-20">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : error ? (
            <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          ) : (
            <>
              {investors.length > 0 && !showCreate && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-sm font-semibold">Select your profile</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Choose an investor profile to continue
                      </p>
                    </div>
                    <button
                      onClick={() => setShowCreate(true)}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      New profile
                    </button>
                  </div>
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
                </>
              )}

              {showCreate && (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="text-sm font-semibold">Create investor profile</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Set up your personal financial profile
                      </p>
                    </div>
                    {investors.length > 0 && (
                      <button
                        onClick={() => { setShowCreate(false); setCreateError(null); }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {createError && (
                    <div className="mb-4 rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                      {createError}
                    </div>
                  )}

                  <form onSubmit={createInvestor} className="space-y-4">
                    <Field label="Full name">
                      <input
                        required
                        type="text"
                        value={form.full_name}
                        onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                        placeholder="Jane Smith"
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Date of birth">
                      <input
                        required
                        type="date"
                        value={form.date_of_birth}
                        onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                        className={inputClass}
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Country code">
                        <input
                          required
                          type="text"
                          maxLength={3}
                          value={form.country}
                          onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
                          placeholder="IL"
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Experience">
                        <select
                          value={form.experience_level}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              experience_level: e.target.value as typeof form.experience_level,
                            })
                          }
                          className={inputClass}
                        >
                          {EXPERIENCE_OPTIONS.map((o) => (
                            <option key={o} value={o} className="capitalize">
                              {o.charAt(0).toUpperCase() + o.slice(1)}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Base currency">
                        <input
                          required
                          type="text"
                          maxLength={3}
                          value={form.base_currency}
                          onChange={(e) =>
                            setForm({ ...form, base_currency: e.target.value.toUpperCase() })
                          }
                          placeholder="USD"
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Local currency">
                        <input
                          required
                          type="text"
                          maxLength={3}
                          value={form.local_currency}
                          onChange={(e) =>
                            setForm({ ...form, local_currency: e.target.value.toUpperCase() })
                          }
                          placeholder="ILS"
                          className={inputClass}
                        />
                      </Field>
                    </div>

                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.is_minor}
                        onChange={(e) => setForm({ ...form, is_minor: e.target.checked })}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                      <span className="text-sm text-muted-foreground">
                        Minor — education-only mode
                      </span>
                    </label>

                    {/* Investment preferences */}
                    <div className="pt-2">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground font-medium">
                          Investment preferences <span className="opacity-60">(optional)</span>
                        </span>
                        <div className="flex-1 h-px bg-border" />
                      </div>

                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Investment goal">
                            <select
                              value={form.investment_goal}
                              onChange={(e) => setForm({ ...form, investment_goal: e.target.value })}
                              className={inputClass}
                            >
                              <option value="">Select…</option>
                              {INVESTMENT_GOAL_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Risk tolerance">
                            <select
                              value={form.risk_tolerance}
                              onChange={(e) => setForm({ ...form, risk_tolerance: e.target.value })}
                              className={inputClass}
                            >
                              <option value="">Select…</option>
                              {RISK_TOLERANCE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </Field>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Time horizon">
                            <select
                              value={form.time_horizon}
                              onChange={(e) => setForm({ ...form, time_horizon: e.target.value })}
                              className={inputClass}
                            >
                              <option value="">Select…</option>
                              {TIME_HORIZON_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Trading frequency">
                            <select
                              value={form.trading_frequency}
                              onChange={(e) => setForm({ ...form, trading_frequency: e.target.value })}
                              className={inputClass}
                            >
                              <option value="">Select…</option>
                              {TRADING_FREQUENCY_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </Field>
                        </div>

                        <Field label="Preferred assets">
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {ASSET_OPTIONS.map((asset) => {
                              const selected = form.preferred_assets.includes(asset);
                              return (
                                <button
                                  key={asset}
                                  type="button"
                                  onClick={() => toggleAsset(asset)}
                                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${
                                    selected
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                                  }`}
                                >
                                  {asset.replace(/_/g, " ")}
                                </button>
                              );
                            })}
                          </div>
                        </Field>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={creating}
                      className="w-full py-2 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {creating ? "Creating…" : "Create profile & continue"}
                    </button>
                  </form>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
