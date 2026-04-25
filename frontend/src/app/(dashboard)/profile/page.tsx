"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AlertCircle, Edit2, RefreshCw } from "lucide-react";

interface InvestorProfile {
  id: string;
  full_name: string;
  date_of_birth: string;
  country: string;
  nationality: string | null;
  tax_residency: string | null;
  base_currency: string;
  local_currency: string;
  experience_level: string;
  is_minor: boolean;
  created_at: string;
  updated_at: string;
}

interface StabilityScore {
  score: number;
  classification: string;
  risk_modifier: string;
  recommendations: string[];
}

const STABILITY_COLORS: Record<string, "success" | "warning" | "danger" | "default"> = {
  unstable: "danger",
  fragile: "warning",
  stable: "success",
  strong: "success",
};

export default function ProfilePage() {
  const investorId = useInvestorId();
  const [profile, setProfile] = useState<InvestorProfile | null>(null);
  const [stability, setStability] = useState<StabilityScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<InvestorProfile>>({});
  const [saving, setSaving] = useState(false);
  const [stabilityLoading, setStabilityLoading] = useState(false);

  useEffect(() => {
    if (!investorId) return;
    fetch(`/api/v1/investors/${investorId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Profile not found");
        return r.json();
      })
      .then((data) => {
        setProfile(data);
        setForm(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [investorId]);

  function loadStability() {
    if (!investorId) return;
    setStabilityLoading(true);
    fetch(`/api/v1/investors/${investorId}/stability-score`)
      .then((r) => r.json())
      .then(setStability)
      .catch(() => {})
      .finally(() => setStabilityLoading(false));
  }

  async function saveProfile() {
    if (!investorId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name,
          country: form.country,
          nationality: form.nationality,
          tax_residency: form.tax_residency,
          base_currency: form.base_currency,
          local_currency: form.local_currency,
          experience_level: form.experience_level,
          is_minor: form.is_minor,
        }),
      });
      const updated = await res.json();
      setProfile(updated);
      setEditing(false);
    } catch {
      alert("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!investorId || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-3 text-red-500">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Investor Profile</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Personal information and experience settings
          </p>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Edit2 className="h-3.5 w-3.5" />
            Edit
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Personal Details</CardTitle>
          </CardHeader>
          <CardContent>
            {!editing ? (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
                {[
                  { label: "Full Name", value: profile.full_name },
                  { label: "Date of Birth", value: new Date(profile.date_of_birth).toLocaleDateString() },
                  { label: "Country", value: profile.country },
                  { label: "Nationality", value: profile.nationality ?? "—" },
                  { label: "Tax Residency", value: profile.tax_residency ?? "—" },
                  { label: "Base Currency", value: profile.base_currency },
                  { label: "Local Currency", value: profile.local_currency },
                  { label: "Experience Level", value: <span className="capitalize">{profile.experience_level}</span> },
                  {
                    label: "Minor",
                    value: (
                      <Badge variant={profile.is_minor ? "warning" : "muted"}>
                        {profile.is_minor ? "Yes — education only" : "No"}
                      </Badge>
                    ),
                  },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground font-medium mb-0.5">{label}</dt>
                    <dd className="text-sm">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="space-y-4">
                <Field label="Full Name">
                  <Input
                    value={form.full_name ?? ""}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Country (2-3 letter code)">
                    <Input
                      value={form.country ?? ""}
                      maxLength={3}
                      onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
                    />
                  </Field>
                  <Field label="Nationality">
                    <Input
                      value={form.nationality ?? ""}
                      onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                    />
                  </Field>
                  <Field label="Base Currency (3-letter code)">
                    <Input
                      value={form.base_currency ?? ""}
                      maxLength={3}
                      onChange={(e) => setForm({ ...form, base_currency: e.target.value.toUpperCase() })}
                    />
                  </Field>
                  <Field label="Local Currency (3-letter code)">
                    <Input
                      value={form.local_currency ?? ""}
                      maxLength={3}
                      onChange={(e) => setForm({ ...form, local_currency: e.target.value.toUpperCase() })}
                    />
                  </Field>
                </div>
                <Field label="Experience Level">
                  <Select
                    value={form.experience_level ?? "beginner"}
                    onChange={(e) => setForm({ ...form, experience_level: e.target.value })}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </Select>
                </Field>
                <Field label="Tax Residency">
                  <Input
                    value={form.tax_residency ?? ""}
                    onChange={(e) => setForm({ ...form, tax_residency: e.target.value })}
                  />
                </Field>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_minor"
                    checked={form.is_minor ?? false}
                    onChange={(e) => setForm({ ...form, is_minor: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <label htmlFor="is_minor" className="text-sm">
                    This investor is a minor (education-only mode)
                  </label>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Button onClick={saveProfile} disabled={saving}>
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setForm(profile);
                      setEditing(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stability score */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Financial Stability</CardTitle>
            <Button variant="ghost" size="icon" onClick={loadStability} disabled={stabilityLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${stabilityLoading ? "animate-spin" : ""}`} />
            </Button>
          </CardHeader>
          <CardContent>
            {!stability ? (
              <div className="text-center py-6">
                <p className="text-xs text-muted-foreground mb-3">
                  Click refresh to calculate your current stability score based on your financial profile.
                </p>
                <Button variant="outline" size="sm" onClick={loadStability} disabled={stabilityLoading}>
                  {stabilityLoading ? "Calculating…" : "Calculate score"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-end gap-3">
                  <span className="text-5xl font-bold">{stability.score}</span>
                  <span className="text-muted-foreground mb-2">/ 100</span>
                  <Badge
                    variant={STABILITY_COLORS[stability.classification]}
                    className="mb-1.5 ml-auto capitalize"
                  >
                    {stability.classification}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Risk modifier:{" "}
                  <span className="font-medium text-foreground capitalize">
                    {stability.risk_modifier.replace(/_/g, " ")}
                  </span>
                </p>
                {stability.recommendations.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-border">
                    <p className="text-xs font-medium">Recommendations</p>
                    {stability.recommendations.map((rec, i) => (
                      <p key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="shrink-0 text-amber-500 mt-0.5">•</span>
                        {rec}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Profile created {new Date(profile.created_at).toLocaleDateString()} · Last updated{" "}
        {new Date(profile.updated_at).toLocaleDateString()}
      </p>
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
