"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Users } from "lucide-react";

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

export default function FamilyPage() {
  const investorId = useInvestorId();
  const [families, setFamilies] = useState<FamilyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newFamily, setNewFamily] = useState({ name: "", base_currency: "ILS" });
  const [creating, setCreating] = useState(false);

  // Add member state
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
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Family Profile</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Household members and shared financial context
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
