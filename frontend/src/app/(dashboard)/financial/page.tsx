"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, Edit2, Wallet, Briefcase, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";

interface FinancialAsset {
  id: string;
  name: string;
  asset_type: string;
  current_value: number;
  currency: string;
  is_liquid: boolean;
  notes: string | null;
}

interface FinancialLiability {
  id: string;
  name: string;
  liability_type: string;
  outstanding_balance: number;
  monthly_payment: number;
  interest_rate_pct: number | null;
  currency: string;
}

interface PortfolioSummary {
  base_currency: string;
  total_cost_basis: number;
  total_current_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  accounts: { id: string; provider_name: string; account_name: string | null; account_type: string; total_current_value: number }[];
}

interface FinancialProfile {
  id: string;
  monthly_income: number;
  spouse_income: number | null;
  monthly_expenses: number;
  liquid_savings: number;
  emergency_fund_months: number;
  job_stability: string;
  income_trend: string;
  dependents_count: number;
  investable_capital_pct: number;
  currency: string;
  assets: FinancialAsset[];
  liabilities: FinancialLiability[];
}

export default function FinancialPage() {
  const investorId = useInvestorId();
  const [profile, setProfile] = useState<FinancialProfile | null>(null);
  const [investmentPortfolio, setInvestmentPortfolio] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [form, setForm] = useState<Partial<FinancialProfile>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [showCreateProfile, setShowCreateProfile] = useState(false);

  // Asset form
  const [addingAsset, setAddingAsset] = useState(false);
  const [assetForm, setAssetForm] = useState({
    name: "",
    asset_type: "cash",
    current_value: "",
    currency: "ILS",
    is_liquid: true,
  });

  // Liability form
  const [addingLiability, setAddingLiability] = useState(false);
  const [liabilityForm, setLiabilityForm] = useState({
    name: "",
    liability_type: "personal_loan",
    outstanding_balance: "",
    monthly_payment: "",
    interest_rate_pct: "",
    currency: "ILS",
  });

  // Edit asset
  const [editingAsset, setEditingAsset] = useState<string | null>(null);
  const [editAssetForm, setEditAssetForm] = useState({ name: "", asset_type: "cash", current_value: "", currency: "ILS", is_liquid: true });

  // Edit liability
  const [editingLiability, setEditingLiability] = useState<string | null>(null);
  const [editLiabilityForm, setEditLiabilityForm] = useState({ name: "", liability_type: "personal_loan", outstanding_balance: "", monthly_payment: "", interest_rate_pct: "", currency: "ILS" });

  useEffect(() => {
    if (!investorId) return;
    loadProfile();
  }, [investorId]);

  function loadProfile() {
    Promise.all([
      fetch(`/api/v1/investors/${investorId}/financial-profile`).then(r => r.status === 404 ? null : r.json()),
      fetch(`/api/v1/investors/${investorId}/portfolio`).then(r => r.ok ? r.json() : null),
    ])
      .then(([profileData, portfolioData]) => {
        setProfile(profileData);
        if (profileData) setForm(profileData);
        setInvestmentPortfolio(portfolioData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  async function createProfile() {
    if (!investorId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/financial-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthly_income: parseFloat(String(form.monthly_income ?? 0)),
          spouse_income: form.spouse_income != null && String(form.spouse_income) !== "" ? parseFloat(String(form.spouse_income)) : null,
          monthly_expenses: parseFloat(String(form.monthly_expenses ?? 0)),
          liquid_savings: parseFloat(String(form.liquid_savings ?? 0)),
          emergency_fund_months: parseFloat(String(form.emergency_fund_months ?? 0)),
          job_stability: form.job_stability ?? "stable",
          income_trend: form.income_trend ?? "stable",
          dependents_count: parseInt(String(form.dependents_count ?? 0)),
          investable_capital_pct: parseFloat(String(form.investable_capital_pct ?? 20)),
          currency: form.currency ?? "ILS",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setShowCreateProfile(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile() {
    if (!investorId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/financial-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthly_income: parseFloat(String(form.monthly_income)),
          spouse_income: form.spouse_income != null && String(form.spouse_income) !== "" ? parseFloat(String(form.spouse_income)) : null,
          monthly_expenses: parseFloat(String(form.monthly_expenses)),
          liquid_savings: parseFloat(String(form.liquid_savings)),
          emergency_fund_months: parseFloat(String(form.emergency_fund_months)),
          job_stability: form.job_stability,
          income_trend: form.income_trend,
          dependents_count: parseInt(String(form.dependents_count)),
          investable_capital_pct: parseFloat(String(form.investable_capital_pct)),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setEditingProfile(false);
      } else {
        const body = await res.json().catch(() => ({}));
        setSaveError(body.detail ?? "Failed to save profile");
      }
    } catch {
      setSaveError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  async function addAsset() {
    if (!investorId || !assetForm.name) return;
    setAssetError(null);
    const res = await fetch(`/api/v1/investors/${investorId}/financial-profile/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...assetForm,
        current_value: parseFloat(assetForm.current_value),
      }),
    });
    if (res.ok) {
      setAddingAsset(false);
      setAssetForm({ name: "", asset_type: "cash", current_value: "", currency: "ILS", is_liquid: true });
      loadProfile();
    } else {
      const body = await res.json().catch(() => ({}));
      setAssetError(body.detail ?? "Failed to add asset");
    }
  }

  function startEditAsset(asset: FinancialAsset) {
    setEditingAsset(asset.id);
    setEditAssetForm({
      name: asset.name,
      asset_type: asset.asset_type,
      current_value: String(asset.current_value),
      currency: asset.currency,
      is_liquid: asset.is_liquid,
    });
  }

  async function updateAsset(assetId: string) {
    const res = await fetch(`/api/v1/investors/${investorId}/financial-profile/assets/${assetId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editAssetForm.name,
        asset_type: editAssetForm.asset_type,
        current_value: parseFloat(editAssetForm.current_value),
        currency: editAssetForm.currency,
        is_liquid: editAssetForm.is_liquid,
      }),
    });
    if (res.ok) { setEditingAsset(null); loadProfile(); }
  }

  async function removeAsset(assetId: string) {
    if (!confirm("Remove this asset?")) return;
    await fetch(`/api/v1/investors/${investorId}/financial-profile/assets/${assetId}`, {
      method: "DELETE",
    });
    loadProfile();
  }

  async function addLiability() {
    if (!investorId || !liabilityForm.name) return;
    const res = await fetch(`/api/v1/investors/${investorId}/financial-profile/liabilities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: liabilityForm.name,
        liability_type: liabilityForm.liability_type,
        outstanding_balance: parseFloat(liabilityForm.outstanding_balance),
        monthly_payment: parseFloat(liabilityForm.monthly_payment || "0"),
        interest_rate_pct: liabilityForm.interest_rate_pct
          ? parseFloat(liabilityForm.interest_rate_pct)
          : null,
        currency: liabilityForm.currency,
      }),
    });
    if (res.ok) {
      setAddingLiability(false);
      setLiabilityForm({
        name: "",
        liability_type: "personal_loan",
        outstanding_balance: "",
        monthly_payment: "",
        interest_rate_pct: "",
        currency: "ILS",
      });
      loadProfile();
    }
  }

  function startEditLiability(lib: FinancialLiability) {
    setEditingLiability(lib.id);
    setEditLiabilityForm({
      name: lib.name,
      liability_type: lib.liability_type,
      outstanding_balance: String(lib.outstanding_balance),
      monthly_payment: String(lib.monthly_payment),
      interest_rate_pct: lib.interest_rate_pct != null ? String(lib.interest_rate_pct) : "",
      currency: lib.currency,
    });
  }

  async function updateLiability(liabilityId: string) {
    const res = await fetch(`/api/v1/investors/${investorId}/financial-profile/liabilities/${liabilityId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editLiabilityForm.name,
        liability_type: editLiabilityForm.liability_type,
        outstanding_balance: parseFloat(editLiabilityForm.outstanding_balance),
        monthly_payment: parseFloat(editLiabilityForm.monthly_payment || "0"),
        interest_rate_pct: editLiabilityForm.interest_rate_pct ? parseFloat(editLiabilityForm.interest_rate_pct) : null,
        currency: editLiabilityForm.currency,
      }),
    });
    if (res.ok) { setEditingLiability(null); loadProfile(); }
  }

  async function removeLiability(liabilityId: string) {
    if (!confirm("Remove this liability?")) return;
    await fetch(`/api/v1/investors/${investorId}/financial-profile/liabilities/${liabilityId}`, {
      method: "DELETE",
    });
    loadProfile();
  }

  if (!investorId || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 lg:space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Financial Profile</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Income, expenses, assets & liabilities</p>
        </div>

        {!showCreateProfile ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Wallet className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">No financial profile yet</p>
              <p className="text-xs text-muted-foreground mt-1 mb-5">
                Add your income, expenses, and financial data to get started.
              </p>
              <Button onClick={() => setShowCreateProfile(true)}>Create financial profile</Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Financial Profile Setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Primary (your) monthly income">
                  <Input
                    type="number"
                    placeholder="10000"
                    value={form.monthly_income ?? ""}
                    onChange={(e) => setForm({ ...form, monthly_income: parseFloat(e.target.value) })}
                  />
                </Field>
                <Field label="Partner/Spouse income (optional)">
                  <Input
                    type="number"
                    placeholder="Leave blank if not applicable"
                    value={form.spouse_income ?? ""}
                    onChange={(e) => setForm({ ...form, spouse_income: e.target.value === "" ? null : parseFloat(e.target.value) })}
                  />
                </Field>
                <Field label="Monthly expenses">
                  <Input
                    type="number"
                    placeholder="6000"
                    value={form.monthly_expenses ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, monthly_expenses: parseFloat(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Liquid savings">
                  <Input
                    type="number"
                    placeholder="30000"
                    value={form.liquid_savings ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, liquid_savings: parseFloat(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Emergency fund (months)">
                  <Input
                    type="number"
                    placeholder="3"
                    value={form.emergency_fund_months ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, emergency_fund_months: parseFloat(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Job stability">
                  <Select
                    value={form.job_stability ?? "stable"}
                    onChange={(e) => setForm({ ...form, job_stability: e.target.value })}
                  >
                    <option value="stable">Stable</option>
                    <option value="freelance">Freelance / Self-employed</option>
                    <option value="unstable">Unstable</option>
                    <option value="unemployed">Unemployed</option>
                  </Select>
                </Field>
                <Field label="Income trend">
                  <Select
                    value={form.income_trend ?? "stable"}
                    onChange={(e) => setForm({ ...form, income_trend: e.target.value })}
                  >
                    <option value="growing">Growing</option>
                    <option value="stable">Stable</option>
                    <option value="declining">Declining</option>
                  </Select>
                </Field>
                <Field label="Dependents count">
                  <Input
                    type="number"
                    placeholder="0"
                    value={form.dependents_count ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, dependents_count: parseInt(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Investable capital %">
                  <Input
                    type="number"
                    placeholder="20"
                    value={form.investable_capital_pct ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, investable_capital_pct: parseFloat(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Currency">
                  <Input
                    placeholder="ILS"
                    maxLength={3}
                    value={form.currency ?? "ILS"}
                    onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                  />
                </Field>
              </div>
              <div className="flex gap-3 pt-2">
                <Button onClick={createProfile} disabled={saving}>
                  {saving ? "Creating…" : "Create profile"}
                </Button>
                <Button variant="outline" onClick={() => setShowCreateProfile(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  const surplus = profile.monthly_income - profile.monthly_expenses;
  const totalAssets = profile.assets.reduce((s, a) => s + a.current_value, 0);
  const totalLiabilities = profile.liabilities.reduce((s, l) => s + l.outstanding_balance, 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 lg:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Financial Profile</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Income, expenses, assets & liabilities
          </p>
        </div>
        {!editingProfile && (
          <Button variant="outline" size="sm" onClick={() => setEditingProfile(true)}>
            <Edit2 className="h-3.5 w-3.5" />
            Edit
          </Button>
        )}
      </div>

      {/* Cash flow summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label={profile.spouse_income != null ? "Primary income" : "Monthly income"}
          value={formatCurrency(profile.monthly_income, profile.currency)}
        />
        {profile.spouse_income != null && (
          <StatCard
            label="Partner income"
            value={formatCurrency(profile.spouse_income, profile.currency)}
          />
        )}
        <StatCard label="Monthly expenses" value={formatCurrency(profile.monthly_expenses, profile.currency)} />
        <StatCard
          label="Monthly surplus"
          value={formatCurrency(surplus, profile.currency)}
          highlight={surplus >= 0 ? "positive" : "negative"}
        />
        <StatCard label="Liquid savings" value={formatCurrency(profile.liquid_savings, profile.currency)} />
        <StatCard label="Emergency fund" value={`${profile.emergency_fund_months.toFixed(1)} months`} />
        <StatCard label="Investable capital" value={`${profile.investable_capital_pct}%`} />
      </div>

      {/* Edit form */}
      {editingProfile && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Cash Flow & Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Primary (your) monthly income">
                <Input
                  type="number"
                  value={form.monthly_income ?? ""}
                  onChange={(e) => setForm({ ...form, monthly_income: parseFloat(e.target.value) })}
                />
              </Field>
              <Field label="Partner/Spouse monthly income (optional)">
                <Input
                  type="number"
                  placeholder="Leave blank if not applicable"
                  value={form.spouse_income ?? ""}
                  onChange={(e) => setForm({ ...form, spouse_income: e.target.value === "" ? null : parseFloat(e.target.value) })}
                />
              </Field>
              <Field label="Monthly expenses">
                <Input
                  type="number"
                  value={form.monthly_expenses ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, monthly_expenses: parseFloat(e.target.value) })
                  }
                />
              </Field>
              <Field label="Liquid savings">
                <Input
                  type="number"
                  value={form.liquid_savings ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, liquid_savings: parseFloat(e.target.value) })
                  }
                />
              </Field>
              <Field label="Emergency fund (months)">
                <Input
                  type="number"
                  value={form.emergency_fund_months ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, emergency_fund_months: parseFloat(e.target.value) })
                  }
                />
              </Field>
              <Field label="Job stability">
                <Select
                  value={form.job_stability ?? "stable"}
                  onChange={(e) => setForm({ ...form, job_stability: e.target.value })}
                >
                  <option value="very_stable">Very stable</option>
                  <option value="stable">Stable</option>
                  <option value="moderate">Moderate</option>
                  <option value="unstable">Unstable</option>
                </Select>
              </Field>
              <Field label="Income trend">
                <Select
                  value={form.income_trend ?? "stable"}
                  onChange={(e) => setForm({ ...form, income_trend: e.target.value })}
                >
                  <option value="growing">Growing</option>
                  <option value="stable">Stable</option>
                  <option value="declining">Declining</option>
                </Select>
              </Field>
              <Field label="Dependents">
                <Input
                  type="number"
                  value={form.dependents_count ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, dependents_count: parseInt(e.target.value) })
                  }
                />
              </Field>
              <Field label="Investable capital %">
                <Input
                  type="number"
                  value={form.investable_capital_pct ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, investable_capital_pct: parseFloat(e.target.value) })
                  }
                />
              </Field>
            </div>
            {saveError && (
              <p className="text-xs text-destructive">{saveError}</p>
            )}
            <div className="flex gap-3 pt-2">
              <Button onClick={saveProfile} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
              <Button variant="outline" onClick={() => { setForm(profile); setEditingProfile(false); setSaveError(null); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assets and Liabilities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Assets</CardTitle>
              <p className="text-lg font-bold text-foreground mt-1">
                {formatCurrency(totalAssets, profile.currency)}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setAddingAsset(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </CardHeader>
          <CardContent>
            {addingAsset && (
              <div className="mb-4 p-4 rounded-md border border-border bg-muted/50 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name">
                    <Input
                      placeholder="e.g. Savings Account"
                      value={assetForm.name}
                      onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                    />
                  </Field>
                  <Field label="Type">
                    <Select
                      value={assetForm.asset_type}
                      onChange={(e) => setAssetForm({ ...assetForm, asset_type: e.target.value })}
                    >
                      <option value="cash">Cash</option>
                      <option value="stocks">Stocks</option>
                      <option value="bonds">Bonds</option>
                      <option value="etf">ETF</option>
                      <option value="real_estate">Real estate</option>
                      <option value="crypto">Crypto</option>
                      <option value="pension">Pension</option>
                      <option value="vehicle">Vehicle</option>
                      <option value="other">Other</option>
                    </Select>
                  </Field>
                  <Field label="Value">
                    <Input
                      type="number"
                      placeholder="0"
                      value={assetForm.current_value}
                      onChange={(e) => setAssetForm({ ...assetForm, current_value: e.target.value })}
                    />
                  </Field>
                  <Field label="Currency">
                    <Input
                      maxLength={3}
                      value={assetForm.currency}
                      onChange={(e) =>
                        setAssetForm({ ...assetForm, currency: e.target.value.toUpperCase() })
                      }
                    />
                  </Field>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_liquid"
                    checked={assetForm.is_liquid}
                    onChange={(e) => setAssetForm({ ...assetForm, is_liquid: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <label htmlFor="is_liquid" className="text-xs">Liquid asset</label>
                </div>
                {assetError && (
                  <p className="text-xs text-destructive">{assetError}</p>
                )}
                <div className="flex gap-2">
                  <Button size="sm" onClick={addAsset}>Add asset</Button>
                  <Button size="sm" variant="outline" onClick={() => { setAddingAsset(false); setAssetError(null); }}>Cancel</Button>
                </div>
              </div>
            )}
            {profile.assets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assets added yet.</p>
            ) : (
              <div className="space-y-2">
                {profile.assets.map((asset) => (
                  <div key={asset.id}>
                    <div className="flex items-center justify-between py-2.5 px-3 rounded-md border border-border">
                      <div>
                        <p className="text-sm font-medium">{asset.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {asset.asset_type.replace(/_/g, " ")}
                          {asset.is_liquid && " · liquid"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-semibold mr-2">
                          {formatCurrency(asset.current_value, asset.currency)}
                        </span>
                        <Button variant="ghost" size="icon" onClick={() => editingAsset === asset.id ? setEditingAsset(null) : startEditAsset(asset)}>
                          <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeAsset(asset.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                    {editingAsset === asset.id && (
                      <div className="mt-1 p-3 rounded-md border border-primary/30 bg-muted/40 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Name">
                            <Input value={editAssetForm.name} onChange={e => setEditAssetForm({ ...editAssetForm, name: e.target.value })} />
                          </Field>
                          <Field label="Type">
                            <Select value={editAssetForm.asset_type} onChange={e => setEditAssetForm({ ...editAssetForm, asset_type: e.target.value })}>
                              <option value="cash">Cash</option>
                              <option value="stocks">Stocks</option>
                              <option value="bonds">Bonds</option>
                              <option value="etf">ETF</option>
                              <option value="real_estate">Real estate</option>
                              <option value="crypto">Crypto</option>
                              <option value="pension">Pension</option>
                              <option value="vehicle">Vehicle</option>
                              <option value="other">Other</option>
                            </Select>
                          </Field>
                          <Field label="Value">
                            <Input type="number" value={editAssetForm.current_value} onChange={e => setEditAssetForm({ ...editAssetForm, current_value: e.target.value })} />
                          </Field>
                          <Field label="Currency">
                            <Input maxLength={3} value={editAssetForm.currency} onChange={e => setEditAssetForm({ ...editAssetForm, currency: e.target.value.toUpperCase() })} />
                          </Field>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id={`liquid-${asset.id}`} checked={editAssetForm.is_liquid} onChange={e => setEditAssetForm({ ...editAssetForm, is_liquid: e.target.checked })} className="h-4 w-4" />
                          <label htmlFor={`liquid-${asset.id}`} className="text-xs">Liquid asset</label>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => updateAsset(asset.id)} disabled={!editAssetForm.name || !editAssetForm.current_value}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingAsset(null)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Liabilities */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Liabilities</CardTitle>
              <p className="text-lg font-bold text-foreground mt-1">
                {formatCurrency(totalLiabilities, profile.currency)}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setAddingLiability(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </CardHeader>
          <CardContent>
            {addingLiability && (
              <div className="mb-4 p-4 rounded-md border border-border bg-muted/50 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name">
                    <Input
                      placeholder="e.g. Mortgage"
                      value={liabilityForm.name}
                      onChange={(e) => setLiabilityForm({ ...liabilityForm, name: e.target.value })}
                    />
                  </Field>
                  <Field label="Type">
                    <Select
                      value={liabilityForm.liability_type}
                      onChange={(e) =>
                        setLiabilityForm({ ...liabilityForm, liability_type: e.target.value })
                      }
                    >
                      <option value="mortgage">Mortgage</option>
                      <option value="personal_loan">Personal loan</option>
                      <option value="credit_card">Credit card</option>
                      <option value="car_loan">Car loan</option>
                      <option value="student_loan">Student loan</option>
                      <option value="other">Other</option>
                    </Select>
                  </Field>
                  <Field label="Outstanding balance">
                    <Input
                      type="number"
                      value={liabilityForm.outstanding_balance}
                      onChange={(e) =>
                        setLiabilityForm({ ...liabilityForm, outstanding_balance: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Monthly payment">
                    <Input
                      type="number"
                      value={liabilityForm.monthly_payment}
                      onChange={(e) =>
                        setLiabilityForm({ ...liabilityForm, monthly_payment: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Interest rate %">
                    <Input
                      type="number"
                      placeholder="Optional"
                      value={liabilityForm.interest_rate_pct}
                      onChange={(e) =>
                        setLiabilityForm({ ...liabilityForm, interest_rate_pct: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Currency">
                    <Input
                      maxLength={3}
                      value={liabilityForm.currency}
                      onChange={(e) =>
                        setLiabilityForm({ ...liabilityForm, currency: e.target.value.toUpperCase() })
                      }
                    />
                  </Field>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addLiability}>Add liability</Button>
                  <Button size="sm" variant="outline" onClick={() => setAddingLiability(false)}>Cancel</Button>
                </div>
              </div>
            )}
            {profile.liabilities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No liabilities added yet.</p>
            ) : (
              <div className="space-y-2">
                {profile.liabilities.map((lib) => (
                  <div key={lib.id}>
                    <div className="flex items-center justify-between py-2.5 px-3 rounded-md border border-border">
                      <div>
                        <p className="text-sm font-medium">{lib.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {lib.liability_type.replace(/_/g, " ")}
                          {lib.interest_rate_pct != null && ` · ${lib.interest_rate_pct}% p.a.`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="text-right mr-2">
                          <span className="text-sm font-semibold">
                            {formatCurrency(lib.outstanding_balance, lib.currency)}
                          </span>
                          {lib.monthly_payment > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(lib.monthly_payment, lib.currency)}/mo
                            </p>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => editingLiability === lib.id ? setEditingLiability(null) : startEditLiability(lib)}>
                          <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeLiability(lib.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                    {editingLiability === lib.id && (
                      <div className="mt-1 p-3 rounded-md border border-primary/30 bg-muted/40 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Name">
                            <Input value={editLiabilityForm.name} onChange={e => setEditLiabilityForm({ ...editLiabilityForm, name: e.target.value })} />
                          </Field>
                          <Field label="Type">
                            <Select value={editLiabilityForm.liability_type} onChange={e => setEditLiabilityForm({ ...editLiabilityForm, liability_type: e.target.value })}>
                              <option value="mortgage">Mortgage</option>
                              <option value="personal_loan">Personal loan</option>
                              <option value="credit_card">Credit card</option>
                              <option value="car_loan">Car loan</option>
                              <option value="student_loan">Student loan</option>
                              <option value="other">Other</option>
                            </Select>
                          </Field>
                          <Field label="Outstanding balance">
                            <Input type="number" value={editLiabilityForm.outstanding_balance} onChange={e => setEditLiabilityForm({ ...editLiabilityForm, outstanding_balance: e.target.value })} />
                          </Field>
                          <Field label="Monthly payment">
                            <Input type="number" value={editLiabilityForm.monthly_payment} onChange={e => setEditLiabilityForm({ ...editLiabilityForm, monthly_payment: e.target.value })} />
                          </Field>
                          <Field label="Interest rate %">
                            <Input type="number" placeholder="Optional" value={editLiabilityForm.interest_rate_pct} onChange={e => setEditLiabilityForm({ ...editLiabilityForm, interest_rate_pct: e.target.value })} />
                          </Field>
                          <Field label="Currency">
                            <Input maxLength={3} value={editLiabilityForm.currency} onChange={e => setEditLiabilityForm({ ...editLiabilityForm, currency: e.target.value.toUpperCase() })} />
                          </Field>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => updateLiability(lib.id)} disabled={!editLiabilityForm.name || !editLiabilityForm.outstanding_balance}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingLiability(null)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Investment Portfolio — read-only, pulled from Investments page */}
      {investmentPortfolio && investmentPortfolio.accounts.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                Investment Portfolio
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Auto-included in your net worth — managed in the{" "}
                <a href="/investments" className="text-primary underline underline-offset-2">Investments</a> page
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">{formatCurrency(investmentPortfolio.total_current_value, investmentPortfolio.base_currency)}</p>
              {investmentPortfolio.unrealized_pnl !== 0 && (
                <p className={`text-xs flex items-center justify-end gap-1 font-medium ${investmentPortfolio.unrealized_pnl > 0 ? "text-green-600" : "text-red-500"}`}>
                  {investmentPortfolio.unrealized_pnl > 0
                    ? <TrendingUp className="h-3 w-3" />
                    : <TrendingDown className="h-3 w-3" />}
                  {investmentPortfolio.unrealized_pnl > 0 ? "+" : ""}
                  {formatCurrency(investmentPortfolio.unrealized_pnl, investmentPortfolio.base_currency)}
                  {" "}({investmentPortfolio.unrealized_pnl_pct > 0 ? "+" : ""}{investmentPortfolio.unrealized_pnl_pct.toFixed(1)}%)
                </p>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {investmentPortfolio.accounts.map(acc => (
                <div key={acc.id} className="flex items-center justify-between py-2 px-3 rounded-md border border-border">
                  <div>
                    <p className="text-sm font-medium">{acc.account_name ?? acc.provider_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{acc.account_type.replace(/_/g, " ")}</p>
                  </div>
                  <p className="text-sm font-semibold">{formatCurrency(acc.total_current_value, investmentPortfolio.base_currency)}</p>
                </div>
              ))}
            </div>
            <a href="/investments" className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline">
              Manage investments <ArrowRight className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>Job stability: <span className="font-medium text-foreground capitalize">{profile.job_stability.replace(/_/g, " ")}</span></span>
        <span>Income trend: <span className="font-medium text-foreground capitalize">{profile.income_trend}</span></span>
        <span>Dependents: <span className="font-medium text-foreground">{profile.dependents_count}</span></span>
        <span>Investable capital: <span className="font-medium text-foreground">{profile.investable_capital_pct}%</span></span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "positive" | "negative";
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs font-medium text-muted-foreground mb-3">{label}</p>
        <p
          className={`text-xl font-bold tracking-tight ${
            highlight === "positive"
              ? "text-green-600 dark:text-green-400"
              : highlight === "negative"
              ? "text-red-600 dark:text-red-400"
              : ""
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
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
