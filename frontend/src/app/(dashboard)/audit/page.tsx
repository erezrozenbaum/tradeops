"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, FileText } from "lucide-react";

interface AuditEvent {
  id: string;
  investor_profile_id: string | null;
  event_type: string;
  description: string;
  event_metadata: Record<string, unknown> | null;
  created_at: string;
}

const PAGE_SIZE = 50;

export default function AuditPage() {
  const investorId = useInvestorId();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function fetchPage(skip: number, append: boolean) {
    if (!investorId) return;
    const setter = append ? setLoadingMore : setLoading;
    setter(true);
    fetch(`/api/v1/investors/${investorId}/audit-events?skip=${skip}&limit=${PAGE_SIZE}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: AuditEvent[]) => {
        if (append) {
          setEvents((prev) => [...prev, ...data]);
        } else {
          setEvents(data);
        }
        setHasMore(data.length === PAGE_SIZE);
      })
      .catch((e) => setError(e.message))
      .finally(() => setter(false));
  }

  useEffect(() => {
    if (investorId) fetchPage(0, false);
  }, [investorId]);

  function loadMore() {
    fetchPage(events.length, true);
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          All significant actions recorded for your account
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 text-red-500 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Card>
        {events.length === 0 ? (
          <CardContent className="py-16 text-center">
            <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No audit events yet</p>
          </CardContent>
        ) : (
          <>
            <CardHeader>
              <CardTitle>{events.length} event{events.length !== 1 ? "s" : ""}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {events.map((ev) => (
                  <div key={ev.id} className="px-6 py-4 flex items-start gap-4">
                    <div className="shrink-0 mt-0.5">
                      <span className="inline-flex h-2 w-2 rounded-full bg-primary/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-0.5">
                        <span className="text-xs font-mono font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {ev.event_type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(ev.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm">{ev.description}</p>
                      {ev.event_metadata && Object.keys(ev.event_metadata).length > 0 && (
                        <details className="mt-1.5">
                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                            Metadata
                          </summary>
                          <pre className="text-xs text-muted-foreground mt-1.5 overflow-x-auto bg-muted rounded p-2">
                            {JSON.stringify(ev.event_metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {hasMore && (
                <div className="px-6 py-4 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="w-full"
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </Button>
                </div>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
