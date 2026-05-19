"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Users, UserCircle, Trash2, RefreshCw, Bot, ChevronDown, ChevronRight, Flame, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AdminUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
  profile_count: number;
}

interface AdminProfile {
  id: string;
  full_name: string;
  country: string;
  base_currency: string;
  user_id: string | null;
  user_email: string | null;
  created_at: string;
}

interface Stats {
  total_users: number;
  total_profiles: number;
  unassigned_profiles: number;
}

interface LiveTradingGate {
  label: string;
  passed: boolean;
  detail: string;
}

interface LiveTradingQueueEntry {
  investor_id: string;
  investor_name: string;
  user_email: string | null;
  sharpe_ratio: number | null;
  paper_days: number | null;
  gates: LiveTradingGate[];
  gates_1_2_4_passed: boolean;
  live_trading_allowed: boolean;
}

interface AiFeatureRow {
  feature_name: string;
  model: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

interface AiUserRow {
  user_email: string | null;
  investor_id: string | null;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  by_feature: AiFeatureRow[];
}

interface AiUsageSummary {
  period_label: string;
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  monthly_budget_usd: number;
  budget_remaining_usd: number | null;
  by_feature: AiFeatureRow[];
  by_user: AiUserRow[];
}

function fmtCost(usd: number): string {
  if (usd < 0.001) return `$${(usd * 100).toFixed(4)}¢`;
  return `$${usd.toFixed(4)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function modelLabel(model: string): string {
  if (model.includes("sonnet-4-6")) return "Sonnet 4.6";
  if (model.includes("haiku-4-5")) return "Haiku 4.5";
  if (model.includes("opus-4-7")) return "Opus 4.7";
  if (model.includes("opus-4-6")) return "Opus 4.6";
  return model;
}

function FeatureLabel({ name }: { name: string }) {
  const labels: Record<string, string> = {
    market_signals: "Market Signals",
    ai_report: "AI Report",
    market_research: "Deep Market Research",
    recommendations: "Recommendations",
    ai_agent: "AI Agent",
    portfolio_chat: "Portfolio Chat",
  };
  return <span>{labels[name] ?? name}</span>;
}

function UserCostRow({ row }: { row: AiUserRow }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        className="border-b border-border hover:bg-muted/30 cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <td className="px-5 py-3">
          <div className="flex items-center gap-1.5">
            {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            <span className="font-medium">{row.user_email ?? <span className="text-muted-foreground italic">Unknown</span>}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-muted-foreground">{row.calls}</td>
        <td className="px-4 py-3 text-muted-foreground">{fmtTokens(row.input_tokens + row.output_tokens)}</td>
        <td className="px-4 py-3 font-medium tabular-nums">{fmtCost(row.cost_usd)}</td>
      </tr>
      {open && row.by_feature.map(f => (
        <tr key={f.feature_name} className="border-b border-border bg-muted/20">
          <td className="pl-12 pr-4 py-2 text-xs text-muted-foreground">
            <FeatureLabel name={f.feature_name} />
          </td>
          <td className="px-4 py-2 text-xs text-muted-foreground">{f.calls}</td>
          <td className="px-4 py-2 text-xs text-muted-foreground">{fmtTokens(f.input_tokens + f.output_tokens)}</td>
          <td className="px-4 py-2 text-xs tabular-nums">{fmtCost(f.cost_usd)}</td>
        </tr>
      ))}
    </>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [aiUsage, setAiUsage] = useState<AiUsageSummary | null>(null);
  const [aiDays, setAiDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<{ profileId: string; userId: string } | null>(null);
  const [liveQueue, setLiveQueue] = useState<LiveTradingQueueEntry[]>([]);
  const [expandedGates, setExpandedGates] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [sRes, uRes, pRes, aRes, lRes] = await Promise.all([
        fetch("/api/v1/admin/stats"),
        fetch("/api/v1/admin/users"),
        fetch("/api/v1/admin/profiles"),
        fetch(`/api/v1/admin/ai-usage?days=${aiDays}`),
        fetch("/api/v1/admin/live-trading/queue"),
      ]);
      if (sRes.status === 403 || uRes.status === 403) {
        router.push("/dashboard");
        return;
      }
      setStats(await sRes.json());
      setUsers(await uRes.json());
      setProfiles(await pRes.json());
      if (aRes.ok) setAiUsage(await aRes.json());
      if (lRes.ok) setLiveQueue(await lRes.json());
    } catch {
      setError("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, [aiDays]);

  async function toggleRole(user: AdminUser) {
    const newRole = user.role === "admin" ? "user" : "admin";
    await fetch(`/api/v1/admin/users/${user.id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    loadAll();
  }

  async function deleteUser(id: string) {
    if (!confirm("Delete this user? Their investor profiles will be unassigned.")) return;
    await fetch(`/api/v1/admin/users/${id}`, { method: "DELETE" });
    loadAll();
  }

  async function assignProfile(profileId: string, userId: string | null) {
    await fetch(`/api/v1/admin/profiles/${profileId}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId || null }),
    });
    setAssignTarget(null);
    loadAll();
  }

  if (loading) return (
    <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center h-64">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  if (error) return (
    <div className="p-4 sm:p-6 lg:p-8">
      <p className="text-destructive">{error}</p>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
          </div>
          <p className="text-sm text-muted-foreground">System management — users, profiles, and access control</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Total users</p>
            <p className="text-2xl font-bold">{stats.total_users}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Investor profiles</p>
            <p className="text-2xl font-bold">{stats.total_profiles}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Unassigned profiles</p>
            <p className="text-2xl font-bold text-amber-500">{stats.unassigned_profiles}</p>
          </div>
        </div>
      )}

      {/* AI Usage */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">AI API Cost</h2>
            {aiUsage && (
              <span className="text-xs text-muted-foreground">({aiUsage.period_label})</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {[7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setAiDays(d)}
                className={`text-xs px-2.5 py-1 rounded transition-colors ${
                  aiDays === d
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {aiUsage ? (
          <div className="p-5 space-y-5">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground mb-1">Total cost</p>
                <p className="text-xl font-bold tabular-nums">{fmtCost(aiUsage.total_cost_usd)}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground mb-1">API calls</p>
                <p className="text-xl font-bold">{aiUsage.total_calls}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground mb-1">Input tokens</p>
                <p className="text-xl font-bold">{fmtTokens(aiUsage.total_input_tokens)}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground mb-1">Output tokens</p>
                <p className="text-xl font-bold">{fmtTokens(aiUsage.total_output_tokens)}</p>
              </div>
              <div className={`rounded-md border p-3 ${
                aiUsage.monthly_budget_usd === 0
                  ? "border-border bg-muted/30"
                  : aiUsage.budget_remaining_usd !== null && aiUsage.budget_remaining_usd < 0
                    ? "border-destructive/40 bg-destructive/10"
                    : "border-border bg-muted/30"
              }`}>
                <p className="text-xs text-muted-foreground mb-1">
                  {aiUsage.budget_remaining_usd !== null ? "Budget remaining" : "Monthly budget"}
                </p>
                {aiUsage.monthly_budget_usd === 0 ? (
                  <p className="text-sm font-medium text-muted-foreground">Unlimited</p>
                ) : aiUsage.budget_remaining_usd !== null ? (
                  <p className={`text-xl font-bold tabular-nums ${aiUsage.budget_remaining_usd < 0 ? "text-destructive" : ""}`}>
                    {fmtCost(Math.max(0, aiUsage.budget_remaining_usd))}
                    <span className="text-xs font-normal text-muted-foreground ml-1">of {fmtCost(aiUsage.monthly_budget_usd)}</span>
                  </p>
                ) : (
                  <p className="text-xl font-bold tabular-nums">{fmtCost(aiUsage.monthly_budget_usd)}<span className="text-xs font-normal text-muted-foreground ml-1">/mo</span></p>
                )}
              </div>
            </div>

            {/* By feature */}
            {aiUsage.by_feature.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">By feature</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-xs font-medium text-muted-foreground">Feature</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Model</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Calls</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Tokens (in+out)</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiUsage.by_feature.map(f => (
                        <tr key={f.feature_name} className="border-b border-border last:border-0">
                          <td className="py-2 font-medium"><FeatureLabel name={f.feature_name} /></td>
                          <td className="px-4 py-2">
                            <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{modelLabel(f.model)}</span>
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">{f.calls}</td>
                          <td className="px-4 py-2 text-muted-foreground">{fmtTokens(f.input_tokens + f.output_tokens)}</td>
                          <td className="px-4 py-2 font-medium tabular-nums">{fmtCost(f.cost_usd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* By user */}
            {aiUsage.by_user.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">By user — click to expand</p>
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        <th className="text-left px-5 py-2 text-xs font-medium text-muted-foreground">User</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Calls</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Tokens</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiUsage.by_user.map((row, i) => (
                        <UserCostRow key={row.investor_id ?? i} row={row} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {aiUsage.total_calls === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No AI calls recorded in this period. Costs are logged when AI Report, Deep Market Research, Recommendations, AI Agent, Portfolio Chat, or Market Signals features are used.
              </p>
            )}
          </div>
        ) : (
          <div className="p-5 text-sm text-muted-foreground">Failed to load AI usage data.</div>
        )}
      </div>

      {/* Live Trading Queue */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Flame className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Live Trading Queue</h2>
          <span className="text-xs text-muted-foreground">
            ({liveQueue.filter(e => e.gates_1_2_4_passed && !e.live_trading_allowed).length} pending approval)
          </span>
        </div>
        {liveQueue.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            No investor profiles found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Investor</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Gates 1–4</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Sharpe</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Paper days</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {liveQueue.map(entry => (
                  <>
                    <tr
                      key={entry.investor_id}
                      className="border-b border-border hover:bg-muted/30 cursor-pointer"
                      onClick={() => setExpandedGates(expandedGates === entry.investor_id ? null : entry.investor_id)}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          {expandedGates === entry.investor_id
                            ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                            : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                          <div>
                            <div className="font-medium">{entry.investor_name}</div>
                            {entry.user_email && <div className="text-xs text-muted-foreground">{entry.user_email}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {entry.gates.map((g, i) => (
                            <span key={i} title={g.detail}>
                              {g.passed
                                ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                : <XCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {entry.sharpe_ratio != null ? entry.sharpe_ratio.toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {entry.paper_days != null ? `${entry.paper_days}d` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {entry.live_trading_allowed ? (
                          <Badge variant="default">Live enabled</Badge>
                        ) : entry.gates_1_2_4_passed ? (
                          <Badge variant="muted" className="bg-amber-500/20 text-amber-600 border-amber-500/30">Pending approval</Badge>
                        ) : (
                          <Badge variant="muted">Not eligible</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end" onClick={e => e.stopPropagation()}>
                          {!entry.live_trading_allowed && entry.gates_1_2_4_passed && (
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={async () => {
                                await fetch(`/api/v1/admin/live-trading/${entry.investor_id}/approve`, { method: "POST" });
                                loadAll();
                              }}
                            >
                              Approve
                            </Button>
                          )}
                          {entry.live_trading_allowed && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                              onClick={async () => {
                                await fetch(`/api/v1/admin/live-trading/${entry.investor_id}/revoke`, { method: "POST" });
                                loadAll();
                              }}
                            >
                              Revoke
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedGates === entry.investor_id && entry.gates.map((g, i) => (
                      <tr key={`${entry.investor_id}-gate-${i}`} className="border-b border-border bg-muted/20">
                        <td className="pl-12 pr-4 py-2 text-xs text-muted-foreground" colSpan={6}>
                          <div className="flex items-center gap-2">
                            {g.passed
                              ? <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                              : <XCircle className="h-3 w-3 text-rose-500 shrink-0" />}
                            <span className="font-medium">{g.label}:</span>
                            <span>{g.detail}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Users */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Users</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Profiles</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Registered</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-5 py-3 font-medium">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={u.role === "admin" ? "default" : "muted"}>
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.profile_count}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => toggleRole(u)}
                      >
                        {u.role === "admin" ? "Demote" : "Promote"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => deleteUser(u.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Profiles */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <UserCircle className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Investor Profiles</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Country / Currency</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Assigned to</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {profiles.map(p => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-5 py-3 font-medium">{p.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.country} · {p.base_currency}</td>
                  <td className="px-4 py-3">
                    {assignTarget?.profileId === p.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          className="text-xs rounded border border-border bg-background px-2 py-1"
                          value={assignTarget.userId}
                          onChange={e => setAssignTarget({ profileId: p.id, userId: e.target.value })}
                        >
                          <option value="">— unassign —</option>
                          {users.map(u => (
                            <option key={u.id} value={u.id}>{u.email}</option>
                          ))}
                        </select>
                        <Button size="sm" className="h-6 text-xs" onClick={() => assignProfile(p.id, assignTarget.userId)}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setAssignTarget(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <span className={p.user_email ? "text-foreground" : "text-amber-500 text-xs"}>
                        {p.user_email ?? "Unassigned"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {assignTarget?.profileId !== p.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setAssignTarget({ profileId: p.id, userId: p.user_id ?? "" })}
                      >
                        Reassign
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
