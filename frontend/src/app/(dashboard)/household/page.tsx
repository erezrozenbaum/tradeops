"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Users, TrendingUp, Wallet, AlertTriangle, Plus, LogIn, LogOut, Copy, CheckCheck } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HouseholdSummary {
  household: { id: string; name: string; created_at: string };
  members: Array<{
    investor_id: string;
    full_name: string;
    maturity_stage: string;
    twin_overall_score: number | null;
    stability_score: number | null;
    stability_classification: string | null;
    is_self: boolean;
  }>;
  member_count: number;
}

interface AggregateMetrics {
  combined_net_worth: number;
  combined_portfolio_value: number;
  combined_monthly_surplus: number;
  total_active_behavioral_risks: number;
  member_count: number;
  currency: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STAGE_LABEL: Record<string, string> = {
  foundation: "Foundation",
  discipline: "Discipline",
  optimization: "Optimization",
  advanced_cognition: "Advanced Cognition",
};

const STAGE_COLOR: Record<string, string> = {
  foundation: "text-amber-400",
  discipline: "text-cyber-blue",
  optimization: "text-emerald-400",
  advanced_cognition: "text-purple-400",
};

const STABILITY_COLOR: Record<string, string> = {
  unstable: "text-red-400",
  fragile: "text-amber-400",
  stable: "text-emerald-400",
  strong: "text-cyan-400",
};

function fmt(n: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, icon: Icon, color = "text-cyber-blue" }: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="bg-cyber-surface border border-cyber-border rounded-xl p-4 flex items-start gap-3">
      <div className={`mt-0.5 ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs text-cyber-muted uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-cyber-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function MemberCard({ member }: { member: HouseholdSummary["members"][0] }) {
  return (
    <div className={`bg-cyber-surface border rounded-xl p-4 ${member.is_self ? "border-cyber-blue/50" : "border-cyber-border"}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-cyber-text">{member.full_name}</p>
          {member.is_self && (
            <span className="text-xs text-cyber-blue bg-cyber-blue/10 px-2 py-0.5 rounded-full">You</span>
          )}
        </div>
        <span className={`text-xs font-medium ${STAGE_COLOR[member.maturity_stage] ?? "text-cyber-muted"}`}>
          {STAGE_LABEL[member.maturity_stage] ?? member.maturity_stage}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-cyber-muted mb-1">Twin Score</p>
          <p className="text-lg font-bold text-cyber-text">
            {member.twin_overall_score !== null ? member.twin_overall_score.toFixed(1) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-cyber-muted mb-1">Stability</p>
          <p className={`text-sm font-semibold capitalize ${STABILITY_COLOR[member.stability_classification ?? ""] ?? "text-cyber-muted"}`}>
            {member.stability_classification ?? "—"}
          </p>
          {member.stability_score !== null && (
            <p className="text-xs text-cyber-muted">{member.stability_score.toFixed(0)} / 100</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Setup panel (not in a household) ────────────────────────────────────────

function SetupPanel({ investorId, onSuccess }: { investorId: string; onSuccess: () => void }) {
  const [tab, setTab] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [joinId, setJoinId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/household/create`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const text = await res.text();
        let detail = `HTTP ${res.status}`;
        try { detail = JSON.parse(text).detail || detail; } catch { /* non-JSON body */ }
        throw new Error(detail);
      }
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create household");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!joinId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/household/join/${joinId.trim()}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        let detail = `HTTP ${res.status}`;
        try { detail = JSON.parse(text).detail || detail; } catch { /* non-JSON body */ }
        throw new Error(detail);
      }
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join household");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="bg-cyber-surface border border-cyber-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Users size={24} className="text-cyber-blue" />
          <div>
            <h2 className="font-bold text-cyber-text text-lg">Household View</h2>
            <p className="text-sm text-cyber-muted">Connect with a partner to see combined financial metrics</p>
          </div>
        </div>

        <div className="flex border border-cyber-border rounded-lg overflow-hidden mb-5">
          {(["create", "join"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === t ? "bg-cyber-blue/10 text-cyber-blue" : "text-cyber-muted hover:text-cyber-text"}`}
            >
              {t === "create" ? "Create New" : "Join Existing"}
            </button>
          ))}
        </div>

        {tab === "create" ? (
          <div className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Household name (e.g. Smith Family)"
              className="w-full bg-cyber-bg border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-text placeholder:text-cyber-muted focus:outline-none focus:border-cyber-blue"
            />
            <button
              onClick={handleCreate}
              disabled={loading || !name.trim()}
              className="w-full flex items-center justify-center gap-2 bg-cyber-blue text-white rounded-lg py-2 text-sm font-medium hover:bg-cyber-blue/80 disabled:opacity-50 transition-colors"
            >
              <Plus size={16} />
              {loading ? "Creating…" : "Create Household"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              value={joinId}
              onChange={e => setJoinId(e.target.value)}
              placeholder="Household ID (UUID)"
              className="w-full bg-cyber-bg border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-text placeholder:text-cyber-muted focus:outline-none focus:border-cyber-blue font-mono"
            />
            <button
              onClick={handleJoin}
              disabled={loading || !joinId.trim()}
              className="w-full flex items-center justify-center gap-2 bg-cyber-blue text-white rounded-lg py-2 text-sm font-medium hover:bg-cyber-blue/80 disabled:opacity-50 transition-colors"
            >
              <LogIn size={16} />
              {loading ? "Joining…" : "Join Household"}
            </button>
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
        )}
      </div>
    </div>
  );
}

// ─── Household ID copy helper ─────────────────────────────────────────────────

function CopyHouseholdId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 text-xs text-cyber-muted hover:text-cyber-text transition-colors font-mono"
      title="Copy household ID to invite partner"
    >
      {copied ? <CheckCheck size={13} className="text-emerald-400" /> : <Copy size={13} />}
      <span className="truncate max-w-[180px]">{id}</span>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HouseholdPage() {
  const investorId = useInvestorId();
  const [summary, setSummary] = useState<HouseholdSummary | null>(null);
  const [metrics, setMetrics] = useState<AggregateMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [inHousehold, setInHousehold] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function fetchData(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/investors/${id}/household`, { credentials: "include" });
      if (res.status === 404) {
        setInHousehold(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const s: HouseholdSummary = await res.json();
      setSummary(s);
      setInHousehold(true);

      const mRes = await fetch(`/api/v1/investors/${id}/household/aggregate`, { credentials: "include" });
      if (mRes.ok) setMetrics(await mRes.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (investorId) fetchData(investorId);
  }, [investorId]);

  async function handleLeave() {
    if (!investorId) return;
    setLeaving(true);
    await fetch(`/api/v1/investors/${investorId}/household`, {
      method: "DELETE",
      credentials: "include",
    });
    setSummary(null);
    setMetrics(null);
    setInHousehold(false);
    setLeaving(false);
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6 animate-pulse">
        <div className="h-10 w-48 rounded-lg bg-cyber-surface/60" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-cyber-surface/60" />)}
        </div>
      </div>
    );
  }

  if (!inHousehold) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-cyber-text mb-1">Household</h1>
        <p className="text-cyber-muted text-sm mb-8">Combine finances with a partner for a unified view</p>
        {investorId && (
          <SetupPanel investorId={investorId} onSuccess={() => investorId && fetchData(investorId)} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-cyber-text">{summary?.household.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-cyber-muted">{summary?.member_count} member{summary?.member_count !== 1 ? "s" : ""}</span>
            {summary && <CopyHouseholdId id={summary.household.id} />}
          </div>
        </div>
        <button
          onClick={handleLeave}
          disabled={leaving}
          className="flex items-center gap-1.5 text-xs text-cyber-muted hover:text-red-400 transition-colors py-1.5 px-3 border border-cyber-border rounded-lg"
        >
          <LogOut size={13} />
          {leaving ? "Leaving…" : "Leave"}
        </button>
      </div>

      {/* Aggregate metrics */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Combined Net Worth"
            value={fmt(metrics.combined_net_worth, metrics.currency)}
            icon={Wallet}
            color="text-emerald-400"
          />
          <MetricCard
            label="Combined Portfolio"
            value={fmt(metrics.combined_portfolio_value, metrics.currency)}
            icon={TrendingUp}
            color="text-cyber-blue"
          />
          <MetricCard
            label="Monthly Surplus"
            value={fmt(metrics.combined_monthly_surplus, metrics.currency)}
            sub="combined"
            icon={Plus}
            color="text-cyan-400"
          />
          <MetricCard
            label="Active Risks"
            value={String(metrics.total_active_behavioral_risks)}
            sub="behavioral"
            icon={AlertTriangle}
            color={metrics.total_active_behavioral_risks > 0 ? "text-amber-400" : "text-emerald-400"}
          />
        </div>
      )}

      {/* Member cards */}
      <div>
        <h2 className="text-sm font-semibold text-cyber-muted uppercase tracking-wider mb-3">Members</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {summary?.members.map(m => (
            <MemberCard key={m.investor_id} member={m} />
          ))}
        </div>
      </div>

      <p className="text-xs text-cyber-muted">
        Share your Household ID with your partner so they can join. All data shown is read from each member's own profile.
      </p>
    </div>
  );
}
