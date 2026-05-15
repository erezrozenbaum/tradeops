"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Check, AlertTriangle, Loader2, Home } from "lucide-react";

interface InviteInfo {
  family_name: string;
  member_name: string;
  relationship_type: string;
  status: string;
}

export default function JoinPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch(`/api/v1/family-profiles/invite/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject("not_found"))
      .then(d => { setInfo(d); setLoading(false); })
      .catch(() => { setError("Invite link is invalid or has expired."); setLoading(false); });
  }, [token]);

  async function accept() {
    if (!token) return;
    setAccepting(true);
    setError(null);
    try {
      const authToken = localStorage.getItem("token");
      if (!authToken) {
        router.push(`/login?redirect=/join?token=${token}`);
        return;
      }
      const res = await fetch(`/api/v1/family-profiles/invite/${token}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        setAccepted(true);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || "Failed to accept invite.");
      }
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!token || error) {
    return (
      <div className="flex items-center justify-center h-screen p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-10 text-center space-y-4">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
            <p className="font-medium">{error ?? "No invite token provided."}</p>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              <Home className="h-4 w-4 mr-2" />Go to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="flex items-center justify-center h-screen p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-10 text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
              <Check className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <p className="font-semibold text-lg">You're linked!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your investment accounts are now visible in <span className="font-medium">{info?.family_name}</span>.
              </p>
            </div>
            <Button onClick={() => router.push("/family")}>
              <Users className="h-4 w-4 mr-2" />View family portfolio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpiredOrUsed = info?.status === "expired" || info?.status === "accepted";

  return (
    <div className="flex items-center justify-center h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Family Invite</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Family</span>
              <span className="text-sm font-semibold">{info?.family_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">You are invited as</span>
              <span className="text-sm font-medium capitalize">{info?.member_name} ({info?.relationship_type})</span>
            </div>
          </div>

          {isExpiredOrUsed ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {info?.status === "accepted" ? "This invite has already been used." : "This invite link has expired."}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground text-center">
                Accepting will link your investment portfolio to this family group.
                Your data remains yours — the family admin will see your portfolio summary.
              </p>
              <Button onClick={accept} disabled={accepting} className="w-full">
                {accepting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Linking…</> : "Accept invite"}
              </Button>
              <p className="text-[10px] text-muted-foreground text-center">
                You must be logged in to accept. Your personal data stays private.
              </p>
            </>
          )}

          <Button variant="ghost" className="w-full text-xs" onClick={() => router.push("/dashboard")}>
            Go to my dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
