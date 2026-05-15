"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Users, GraduationCap, AlertTriangle, BarChart3, TrendingUp, TrendingDown, Briefcase, Mail, Check, Home, Copy } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface FamilyMember {
  id: string;
  name: string;
  relationship_type: string;
  age: number | null;
  is_primary: boolean;
  individual_risk_tolerance: string | null;
  invite_status: string;
  invite_email: string | null;
}

interface FamilyProfile {
  id: string;
  name: string;
  primary_investor_id: string;
  base_currency: string;
  members: FamilyMember[];
  created_at: string;
}

interface FamilyMemberPortfolio {
  member_id: string;
  member_name: string;
  relationship_type: string;
  generation: string;
  age: number | null;
  is_minor: boolean;
  is_primary: boolean;
  individual_risk_tolerance: string | null;
  total_cost_basis: number;
  total_current_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  account_count: number;
  asset_allocation: Record<string, number>;
  education_mode: boolean;
}

interface OverlapHolding {
  ticker: string;
  name: string;
  member_names: string[];
  combined_value: number;
}

interface FamilyPortfolioSummary {
  family_id: string;
  family_name: string;
  currency: string;
  total_current_value: number;
  total_cost_basis: number;
  total_unrealized_pnl: number;
  total_unrealized_pnl_pct: number;
  member_count: number;
  members: FamilyMemberPortfolio[];
  by_generation: Record<string, number>;
  household_asset_allocation: Record<string, number>;
  cross_member_overlap: OverlapHolding[];
  has_minors: boolean;
}

// ── Generation config ─────────────────────────────────────────────────────────

const GENERATION_LABELS: Record<string, string> = {
  primary: "Primary",
  partners: "Partners",
  children: "Children",
  parents: "Parents",
  grandparents: "Grandparents",
  siblings: "Siblings",
  household: "Household",
  other: "Other",
};

const GENERATION_COLORS: Record<string, string> = {
  primary: "bg-indigo-500",
  partners: "bg-violet-500",
  children: "bg-emerald-500",
  parents: "bg-amber-500",
  grandparents: "bg-orange-400",
  siblings: "bg-sky-500",
  household: "bg-teal-500",
  other: "bg-slate-400",
};

// ── Member row ────────────────────────────────────────────────────────────────

function InviteBadge({ status, email }: { status: string; email: string | null }) {
  if (status === "accepted") return (
    <Badge variant="default" className="text-[10px] bg-emerald-600">
      <Check className="h-2.5 w-2.5 mr-0.5" />Linked
    </Badge>
  );
  if (status === "pending") return (
    <Badge variant="muted" className="text-[10px]">
      <Mail className="h-2.5 w-2.5 mr-0.5" />Invite sent
    </Badge>
  );
  return null;
}

function MemberRow({
  member,
  portfolio,
  currency,
  totalValue,
  familyId,
  onRemove,
  onInviteSent,
}: {
  member: FamilyMember;
  portfolio: FamilyMemberPortfolio | undefined;
  currency: string;
  totalValue: number;
  familyId: string;
  onRemove: () => void;
  onInviteSent: () => void;
}) {
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState(member.invite_email ?? "");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasPortfolio = portfolio && portfolio.account_count > 0;
  const pnl = portfolio?.unrealized_pnl ?? 0;
  const isGain = pnl >= 0;
  const memberPct = totalValue > 0 && portfolio ? (portfolio.total_current_value / totalValue) * 100 : 0;
  const isMinor = member.age != null && member.age < 18;

  async function sendInvite() {
    if (!inviteEmail) return;
    setSending(true);
    try {
      const res = await fetch(`/api/v1/family-profiles/${familyId}/members/${member.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });
      if (res.ok) {
        const data = await res.json();
        setInviteUrl(data.invite_url);
        onInviteSent();
      }
    } finally {
      setSending(false);
    }
  }

  async function copyLink() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="py-3 px-4 rounded-md border border-border hover:bg-muted/20 transition-colors">
      <div className="flex items-start justify-between">
        {/* Left: identity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">{member.name}</p>
            {member.is_primary && (
              <Badge variant="default" className="text-[10px]">Primary</Badge>
            )}
            {isMinor && (
              <Badge variant="warning" className="text-[10px]">
                <GraduationCap className="h-2.5 w-2.5 mr-0.5" />Minor
              </Badge>
            )}
            <InviteBadge status={member.invite_status} email={member.invite_email} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">
            {member.relationship_type}
            {member.age != null && ` · ${member.age} yrs`}
            {member.individual_risk_tolerance && ` · ${member.individual_risk_tolerance} risk`}
          </p>

          {/* Portfolio summary */}
          {hasPortfolio ? (
            <div className="mt-2 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Briefcase className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium">
                  {currency} {portfolio!.total_current_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span className={`text-xs font-medium ${isGain ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                  ({isGain ? "+" : ""}{pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}, {isGain ? "+" : ""}{portfolio!.unrealized_pnl_pct.toFixed(1)}%)
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {portfolio!.account_count} {portfolio!.account_count === 1 ? "account" : "accounts"}
              </span>
              {totalValue > 0 && (
                <span className="text-xs text-muted-foreground">{memberPct.toFixed(1)}% of household</span>
              )}
              {totalValue > 0 && (
                <div className="flex-1 min-w-[80px] max-w-[120px] h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${GENERATION_COLORS[portfolio?.generation ?? "other"] ?? "bg-indigo-500"}`}
                    style={{ width: `${memberPct}%` }}
                  />
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/60 mt-1.5 italic">No linked investment accounts</p>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {!member.is_primary && member.invite_status !== "accepted" && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => setShowInvite(v => !v)}
            >
              <Mail className="h-3 w-3 mr-1" />
              {member.invite_status === "pending" ? "Resend" : "Invite"}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Invite panel */}
      {showInvite && (
        <div className="mt-3 p-3 rounded-md bg-muted/50 border border-border space-y-2">
          {inviteUrl ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Share this link with {member.name}:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-background border border-border rounded px-2 py-1.5 truncate">{inviteUrl}</code>
                <Button size="sm" variant="outline" className="text-xs h-7 shrink-0" onClick={copyLink}>
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Link expires in 7 days. They must be a registered user to accept.</p>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder={`${member.name}'s email`}
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="h-8 text-xs flex-1"
              />
              <Button size="sm" className="h-8 text-xs" onClick={sendInvite} disabled={sending || !inviteEmail}>
                {sending ? "Sending…" : "Generate link"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Household summary bar ─────────────────────────────────────────────────────

function HouseholdSummary({ data }: { data: FamilyPortfolioSummary }) {
  const { currency, total_current_value: totalVal, total_unrealized_pnl: pnl, total_unrealized_pnl_pct: pnlPct } = data;
  const isGain = pnl >= 0;
  const generationEntries = Object.entries(data.by_generation).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mt-4 pt-4 border-t border-border space-y-4">
      {/* AUM row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-indigo-500" />
          <div>
            <p className="text-sm font-semibold">
              {currency} {totalVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-muted-foreground">Total household AUM</p>
          </div>
        </div>
        <div className={`text-right text-sm font-medium ${isGain ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
          {isGain ? <TrendingUp className="h-3.5 w-3.5 inline mr-1" /> : <TrendingDown className="h-3.5 w-3.5 inline mr-1" />}
          {isGain ? "+" : ""}{currency} {Math.abs(pnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          <span className="text-xs ml-1 opacity-70">({isGain ? "+" : ""}{pnlPct.toFixed(1)}%)</span>
        </div>
      </div>

      {/* Generation breakdown */}
      {generationEntries.length > 1 && (
        <div className="space-y-1.5">
          <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
            {generationEntries.map(([gen, val]) => (
              <div
                key={gen}
                className={`${GENERATION_COLORS[gen] ?? "bg-slate-400"}`}
                style={{ width: `${totalVal > 0 ? (val / totalVal) * 100 : 0}%` }}
                title={`${GENERATION_LABELS[gen] ?? gen}: ${currency} ${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {generationEntries.map(([gen, val]) => (
              <span key={gen} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-sm ${GENERATION_COLORS[gen] ?? "bg-slate-400"}`} />
                {GENERATION_LABELS[gen] ?? gen}:&nbsp;
                <span className="text-foreground font-medium">
                  {currency} {val.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Overlap warnings */}
      {data.cross_member_overlap.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            Shared holdings (concentration risk)
          </p>
          {data.cross_member_overlap.map((o) => (
            <div key={o.ticker} className="flex items-center justify-between py-1.5 px-3 rounded-md bg-amber-50 dark:bg-amber-900/10 text-xs border border-amber-200 dark:border-amber-900/30">
              <span>
                <span className="font-medium">{o.ticker}</span>
                <span className="text-muted-foreground ml-1.5">{o.name}</span>
                <span className="text-muted-foreground ml-2">— {o.member_names.join(" & ")}</span>
              </span>
              <span className="font-medium">{currency} {o.combined_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FamilyPage() {
  const investorId = useInvestorId();
  const [families, setFamilies] = useState<FamilyProfile[]>([]);
  const [portfolioData, setPortfolioData] = useState<FamilyPortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newFamily, setNewFamily] = useState({ name: "", base_currency: "ILS" });
  const [creating, setCreating] = useState(false);

  const [addingMember, setAddingMember] = useState<string | null>(null);
  const [newMember, setNewMember] = useState({
    name: "",
    relationship_type: "spouse",
    age: "",
    individual_risk_tolerance: "",
  });

  useEffect(() => {
    if (!investorId) return;
    loadAll();
  }, [investorId]);

  async function loadAll() {
    setLoading(true);
    try {
      const [fRes, pRes] = await Promise.all([
        fetch(`/api/v1/family-profiles/?investor_id=${investorId}`),
        fetch(`/api/v1/investors/${investorId}/family-portfolio`),
      ]);
      setFamilies(fRes.ok ? await fRes.json() : []);
      setPortfolioData(pRes.ok ? await pRes.json() : null);
    } catch {
      setFamilies([]);
    } finally {
      setLoading(false);
    }
  }

  // Build a lookup: member_name → FamilyMemberPortfolio
  const portfolioByName = Object.fromEntries(
    (portfolioData?.members ?? []).map((m) => [m.member_name.toLowerCase(), m])
  );
  const currency = portfolioData?.currency ?? "ILS";
  const totalValue = portfolioData?.total_current_value ?? 0;

  async function createFamily() {
    if (!investorId || !newFamily.name) return;
    setCreating(true);
    try {
      const res = await fetch("/api/v1/family-profiles/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newFamily, primary_investor_id: investorId }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewFamily({ name: "", base_currency: "ILS" });
        loadAll();
      }
    } finally {
      setCreating(false);
    }
  }

  async function addMember(familyId: string) {
    if (!newMember.name) return;
    const res = await fetch(`/api/v1/family-profiles/${familyId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newMember.name,
        relationship_type: newMember.relationship_type,
        age: newMember.age ? parseInt(newMember.age) : null,
        individual_risk_tolerance: newMember.individual_risk_tolerance || null,
      }),
    });
    if (res.ok) {
      setAddingMember(null);
      setNewMember({ name: "", relationship_type: "spouse", age: "", individual_risk_tolerance: "" });
      loadAll();
    }
  }

  async function removeMember(familyId: string, memberId: string) {
    if (!confirm("Remove this family member?")) return;
    const res = await fetch(`/api/v1/family-profiles/${familyId}/members/${memberId}`, { method: "DELETE" });
    if (res.ok) loadAll();
  }

  async function deleteFamily(familyId: string) {
    if (!confirm("Delete this family profile?")) return;
    const res = await fetch(`/api/v1/family-profiles/${familyId}`, { method: "DELETE" });
    if (res.ok) loadAll();
  }

  if (!investorId || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 lg:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Family Profile</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Household members, shared financial context, and consolidated wealth view
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="h-4 w-4" />
          New family profile
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Create Family Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Family name">
              <Input
                placeholder="e.g. The Smith Household"
                value={newFamily.name}
                onChange={(e) => setNewFamily({ ...newFamily, name: e.target.value })}
              />
            </Field>
            <Field label="Base currency">
              <Input
                value={newFamily.base_currency}
                maxLength={3}
                onChange={(e) =>
                  setNewFamily({ ...newFamily, base_currency: e.target.value.toUpperCase() })
                }
              />
            </Field>
            <div className="flex gap-3">
              <Button onClick={createFamily} disabled={creating || !newFamily.name}>
                {creating ? "Creating…" : "Create"}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {families.length === 0 && !showCreate && (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">No family profiles yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create a family profile to model shared household finances.
            </p>
          </CardContent>
        </Card>
      )}

      {families.map((family) => (
        <Card key={family.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-semibold">{family.name}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{family.base_currency}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setAddingMember(family.id)}>
                <Plus className="h-3.5 w-3.5" />
                Add member
              </Button>
              <Button variant="ghost" size="icon" onClick={() => deleteFamily(family.id)}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Add member form */}
            {addingMember === family.id && (
              <div className="mb-2 p-4 rounded-md border border-border bg-muted/50 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name">
                    <Input
                      placeholder="Name"
                      value={newMember.name}
                      onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                    />
                  </Field>
                  <Field label="Relationship">
                    <Select
                      value={newMember.relationship_type}
                      onChange={(e) => setNewMember({ ...newMember, relationship_type: e.target.value })}
                    >
                      <option value="spouse">Spouse</option>
                      <option value="child">Child</option>
                      <option value="parent">Parent</option>
                      <option value="sibling">Sibling</option>
                      <option value="partner">Partner</option>
                      <option value="other">Other</option>
                    </Select>
                  </Field>
                  <Field label="Age (optional)">
                    <Input
                      type="number"
                      placeholder="Age"
                      value={newMember.age}
                      onChange={(e) => setNewMember({ ...newMember, age: e.target.value })}
                    />
                  </Field>
                  <Field label="Risk tolerance">
                    <Select
                      value={newMember.individual_risk_tolerance}
                      onChange={(e) => setNewMember({ ...newMember, individual_risk_tolerance: e.target.value })}
                    >
                      <option value="">Not specified</option>
                      <option value="conservative">Conservative</option>
                      <option value="moderate">Moderate</option>
                      <option value="aggressive">Aggressive</option>
                    </Select>
                  </Field>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => addMember(family.id)}>Add</Button>
                  <Button size="sm" variant="outline" onClick={() => setAddingMember(null)}>Cancel</Button>
                </div>
              </div>
            )}

            {/* Member list */}
            {family.members.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No members yet.</p>
            ) : (
              <div className="space-y-2">
                {family.members.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    portfolio={portfolioByName[member.name.toLowerCase()]}
                    currency={currency}
                    totalValue={totalValue}
                    familyId={family.id}
                    onRemove={() => removeMember(family.id, member.id)}
                    onInviteSent={loadAll}
                  />
                ))}
              </div>
            )}

            {/* Household summary */}
            {portfolioData && portfolioData.total_current_value > 0 && (
              <HouseholdSummary data={portfolioData} />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
