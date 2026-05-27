"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, AlertCircle, AlertTriangle, Info, X, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppNotification {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  link: string | null;
}

const DISMISSED_KEY = "tradeops_dismissed_notifications";

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function saveDismissed(ids: Set<string>) {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(ids))); } catch {}
}

const ICON_MAP = {
  danger: { Icon: AlertCircle, cls: "text-red-500" },
  warning: { Icon: AlertTriangle, cls: "text-amber-500" },
  info: { Icon: Info, cls: "text-blue-400" },
};

export function NotificationBell() {
  const [all, setAll] = useState<AppNotification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDismissed(getDismissed());
  }, []);

  useEffect(() => {
    const id = typeof window !== "undefined" ? localStorage.getItem("tradeops_investor_id") : null;
    if (!id) return;
    fetch(`/api/v1/investors/${id}/notifications`)
      .then(r => r.ok ? r.json() : [])
      .then(setAll)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const visible = all.filter(n => !dismissed.has(n.id));
  const alertCount = visible.filter(n => n.severity !== "info").length;

  function dismiss(id: string) {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    saveDismissed(next);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "relative flex items-center justify-center h-8 w-8 rounded-lg transition-colors",
          open
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
        )}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {alertCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none px-0.5">
            {alertCount > 9 ? "9+" : alertCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 rounded-xl border shadow-2xl z-50 overflow-hidden"
          style={{ background: "hsl(220 35% 7%)", borderColor: "hsl(217 30% 14%)" }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: "hsl(217 30% 12%)" }}
          >
            <span className="text-sm font-semibold">Notifications</span>
            {alertCount > 0 && (
              <span className="text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/20 rounded px-1.5 py-0.5">
                {alertCount} alert{alertCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Items */}
          <div className="max-h-80 overflow-y-auto divide-y" style={{ borderColor: "hsl(217 30% 10%)" }}>
            {visible.length === 0 ? (
              <div className="py-10 text-center">
                <CheckCircle2 className="h-7 w-7 mx-auto text-emerald-500/50 mb-2" />
                <p className="text-xs text-muted-foreground">All clear — no alerts</p>
              </div>
            ) : (
              visible.slice(0, 6).map(n => {
                const cfg = ICON_MAP[n.severity as keyof typeof ICON_MAP] ?? ICON_MAP.info;
                return (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 px-4 py-3 group"
                  >
                    <cfg.Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.cls}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold leading-snug">{n.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                      {n.link && (
                        <Link
                          href={n.link}
                          onClick={() => setOpen(false)}
                          className="inline-flex items-center gap-0.5 text-[10px] text-primary mt-1 hover:underline"
                        >
                          View <ArrowRight className="h-2.5 w-2.5" />
                        </Link>
                      )}
                    </div>
                    <button
                      onClick={() => dismiss(n.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground/50 hover:text-muted-foreground mt-0.5"
                      aria-label="Dismiss"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t" style={{ borderColor: "hsl(217 30% 12%)" }}>
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              View all notifications <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
