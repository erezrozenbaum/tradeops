"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Users, UserCircle, Trash2, RefreshCw } from "lucide-react";
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

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<{ profileId: string; userId: string } | null>(null);

  async function loadAll() {
    try {
      const [sRes, uRes, pRes] = await Promise.all([
        fetch("/api/v1/admin/stats"),
        fetch("/api/v1/admin/users"),
        fetch("/api/v1/admin/profiles"),
      ]);
      if (sRes.status === 403 || uRes.status === 403) {
        router.push("/dashboard");
        return;
      }
      setStats(await sRes.json());
      setUsers(await uRes.json());
      setProfiles(await pRes.json());
    } catch {
      setError("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

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
