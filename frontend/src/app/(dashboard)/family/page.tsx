"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Users, TrendingUp, TrendingDown, GraduationCap, AlertTriangle, BarChart3 } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface FamilyMember {
  id: string;
  name: string;
  relationship_type: string;
  age: number | null;
  is_primary: boolean;
  individual_risk_tolerance: string | null;
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

// ── Generation labels ─────────────────────────────────────────────────────────

const GENERATION_LABELS: Record<string, string> = {
  primary: "Primary",
  partners: "Partners",
  children: "Children",
  parents: "Parents",
  grandparents: "Grandparents",
  siblings: "Siblings",
  other: "Other",
};

const GENERATION_COLORS: Record<string, string> = {
  primary: "bg-indigo-500",
  partners: "bg-violet-500",
  children: "bg-emerald-500",
  parents: "bg-amber-500",
  grandparents: "bg-orange-400",
  siblings: "bg-sky-500",
  other: "bg-slate-400",
};

// ── HouseholdPortfolioCard ────────────────────────────────────────────────────

function HouseholdPortfolioCard({ investorId }: { investorId: string }) {
  const [data, setData] = useState<FamilyPortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/investors/${investorId}/family-portfolio`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [investorId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Loading household portfolio…
        </CardContent>
      </Card>
    );
  }
  if (error || !data) return null;

  const currency = data.currency;
  const totalVal = data.total_current_value;
  const pnl = data.total_unrealized_pnl;
  const pnlPct = data.total_unrealized_pnl_pct;
  const isGain = pnl >= 0;
  const generationEntries = Object.entries(data.by_generation).sort((a, b) => b[1] - a[1]);

  return (
    <Card className="mt-5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-indigo-500" />
          Household Portfolio
          {data.has_minors && (
            <Badge variant="warning" className="ml-auto text-[10px]">
              <GraduationCap className="h-3 w-3 mr-1" />
              Minors in household
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Household AUM summary */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold tracking-tight">
              {currency} {totalVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-sm text-muted-foreground">Total household AUM</p>
          </div>
          <div className={`text-right ${isGain ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
            <p className="text-lg font-semibold">
              {isGain ? "+" : ""}{currency} {Math.abs(pnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-sm">
              {isGain ? "+" : ""}{pnlPct.toFixed(2)}% unrealized
            </p>
          </div>
        </div>

        {/* Generation breakdown bar */}
        {generationEntries.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">By Generation</p>
            <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
              {generationEntries.map(([gen, val]) => (
                <div
                  key={gen}
                  className={`${GENERATION_COLORS[gen] ?? "bg-slate-400"} transition-all`}
                  style={{ width: `${totalVal > 0 ? (val / totalVal) * 100 : 0}%` }}
                  title={`${GENERATION_LABELS[gen] ?? gen}: ${currency} ${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {generationEntries.map(([gen, val]) => (
                <span key={gen} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-sm ${GENERATION_COLORS[gen] ?? "bg-slate-400"}`} />
                  <span className="font-medium text-foreground">{GENERATION_LABELS[gen] ?? gen}</span>
                  <span className="text-muted-foreground">
                    {currency} {val.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    {totalVal > 0 && <span className="ml-1 opacity-60">({((val / totalVal) * 100).toFixed(1)}%)</span>}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Per-member breakdown */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Per Member</p>
          <div className="space-y-2">
            {data.members.map((m) => {
              const memberPct = totalVal > 0 ? (m.total_current_value / totalVal) * 100 : 0;
              const mPnl = m.unrealized_pnl;
              const mGain = mPnl >= 0;
              return (
                <div key={m.member_id} className="flex items-center gap-3 py-2 px-3 rounded-md border border-border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{m.member_name}</p>
                      <Badge variant="muted" className="text-[10px] capitalize shrink-0">
                        {m.relationship_type}
                      </Badge>
                      {m.education_mode && (
                        <Badge variant="warning" className="text-[10px] shrink-0">
                          <GraduationCap className="h-2.5 w-2.5 mr-0.5" />
                          Education mode
                        </Badge>
                      )}
                      {m.is_primary && (
                        <Badge variant="default" className="text-[10px] shrink-0">Primary</Badge>
                      )}
                    </div>
                    <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${GENERATION_COLORS[m.generation] ?? "bg-indigo-500"}`}
                        style={{ width: `${memberPct}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium">
                      {currency} {m.total_current_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <p className={`text-xs ${mGain ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                      {mGain ? "+" : ""}{mPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({mGain ? "+" : ""}{m.unrealized_pnl_pct.toFixed(1)}%)
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cross-member ticker overlap */}
        {data.cross_member_overlap.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Shared Holdings (concentration risk)
            </p>
            <div className="space-y-1">
              {data.cross_member_overlap.map((o) => (
                <div key={o.ticker} className="flex items-center justify-between py-1.5 px-3 rounded-md bg-amber-50 dark:bg-amber-900/10 text-xs border border-amber-200 dark:border-amber-900/30">
                  <div>
                    <span className="font-medium">{o.ticker}</span>
                    <span className="text-muted-foreground ml-1.5">{o.name}</span>
                    <span className="text-muted-foreground ml-2">— held by {o.member_names.join(" & ")}</span>
                  </div>
                  <span className="font-medium text-foreground">
                    {currency} {o.combined_value.toLocaleString(undefined, { maximumFractionDigits: 0 })} combined
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FamilyPage() {
  const investorId = useInvestorId();
  const [families, setFamilies] = useState<FamilyProfile[]>([]);
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
    loadFamilies();
  }, [investorId]);

  function loadFamilies() {
    fetch(`/api/v1/family-profiles/?investor_id=${investorId}`)
      .then((r) => r.json())
      .then((data) => {
        setFamilies(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

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
        loadFamilies();
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
      loadFamilies();
    }
  }

  async function removeMember(familyId: string, memberId: string) {
    if (!confirm("Remove this family member?")) return;
    const res = await fetch(`/api/v1/family-profiles/${familyId}/members/${memberId}`, {
      method: "DELETE",
    });
    if (res.ok) loadFamilies();
  }

  async function deleteFamily(familyId: string) {
    if (!confirm("Delete this family profile?")) return;
    const res = await fetch(`/api/v1/family-profiles/${familyId}`, { method: "DELETE" });
    if (res.ok) loadFamilies();
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
        <div key={family.id} className="space-y-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base font-semibold text-foreground">{family.name}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{family.base_currency}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddingMember(family.id)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add member
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteFamily(family.id)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {addingMember === family.id && (
                <div className="mb-5 p-4 rounded-md border border-border bg-muted/50 space-y-3">
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
                        onChange={(e) =>
                          setNewMember({ ...newMember, relationship_type: e.target.value })
                        }
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
                        onChange={(e) =>
                          setNewMember({ ...newMember, individual_risk_tolerance: e.target.value })
                        }
                      >
                        <option value="">Not specified</option>
                        <option value="conservative">Conservative</option>
                        <option value="moderate">Moderate</option>
                        <option value="aggressive">Aggressive</option>
                      </Select>
                    </Field>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => addMember(family.id)}>
                      Add
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAddingMember(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {family.members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No members yet.</p>
              ) : (
                <div className="space-y-2">
                  {family.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between py-2.5 px-3 rounded-md border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-sm font-medium">{member.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {member.relationship_type}
                            {member.age != null && ` · ${member.age} years old`}
                            {member.individual_risk_tolerance && ` · ${member.individual_risk_tolerance} risk`}
                          </p>
                        </div>
                        {member.is_primary && (
                          <Badge variant="default" className="text-[10px]">
                            Primary
                          </Badge>
                        )}
                        {member.age != null && member.age < 18 && (
                          <Badge variant="warning" className="text-[10px]">
                            <GraduationCap className="h-2.5 w-2.5 mr-0.5" />
                            Minor
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMember(family.id, member.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Household portfolio view — shown when family has members */}
          {family.members.length > 0 && investorId && (
            <HouseholdPortfolioCard investorId={investorId} />
          )}
        </div>
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
