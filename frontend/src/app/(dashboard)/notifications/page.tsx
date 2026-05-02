"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Bell, CheckCircle2, AlertTriangle, AlertCircle, Info, ArrowRight } from "lucide-react";

interface AppNotification {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  link: string | null;
}

const SEVERITY_CONFIG = {
  danger: {
    icon: AlertCircle,
    badge: "bg-red-500/10 text-red-600 border-red-200",
    border: "border-l-red-500",
    iconClass: "text-red-500",
  },
  warning: {
    icon: AlertTriangle,
    badge: "bg-amber-500/10 text-amber-600 border-amber-200",
    border: "border-l-amber-400",
    iconClass: "text-amber-500",
  },
  info: {
    icon: Info,
    badge: "bg-blue-500/10 text-blue-600 border-blue-200",
    border: "border-l-blue-400",
    iconClass: "text-blue-500",
  },
};

const TYPE_LABELS: Record<string, string> = {
  goal: "Goals",
  portfolio: "Portfolio",
  market: "Market",
  setup: "Setup",
};

export default function NotificationsPage() {
  const investorId = useInvestorId();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!investorId) return;
    fetch(`/api/v1/investors/${investorId}/notifications`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setNotifications(data); setLoading(false); });
  }, [investorId]);

  const warnings = notifications.filter(n => n.severity !== "info");
  const infos = notifications.filter(n => n.severity === "info");

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? "Loading…" : notifications.length === 0 ? "All clear" : `${notifications.length} item${notifications.length !== 1 ? "s" : ""} need your attention`}
          </p>
        </div>
        {notifications.length > 0 && (
          <Badge className="bg-primary/10 text-primary border-primary/20">
            {notifications.length}
          </Badge>
        )}
      </div>

      {!loading && notifications.length === 0 && (
        <Card>
          <CardContent className="py-14 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500/50 mb-3" />
            <p className="font-semibold">Everything looks good</p>
            <p className="text-sm text-muted-foreground mt-1">
              No alerts right now. We check your goals, portfolio, and market data daily.
            </p>
          </CardContent>
        </Card>
      )}

      {warnings.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Alerts</p>
          {warnings.map(n => {
            const cfg = SEVERITY_CONFIG[n.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.info;
            const Icon = cfg.icon;
            return (
              <Card key={n.id} className={`border-l-4 ${cfg.border}`}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${cfg.iconClass}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-medium text-sm">{n.title}</p>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.badge}`}>
                          {TYPE_LABELS[n.type] ?? n.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{n.message}</p>
                      {n.link && (
                        <Link
                          href={n.link}
                          className="inline-flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
                        >
                          View <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {infos.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Suggestions</p>
          {infos.map(n => {
            const cfg = SEVERITY_CONFIG.info;
            const Icon = cfg.icon;
            return (
              <Card key={n.id} className={`border-l-4 ${cfg.border}`}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${cfg.iconClass}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-medium text-sm">{n.title}</p>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.badge}`}>
                          {TYPE_LABELS[n.type] ?? n.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{n.message}</p>
                      {n.link && (
                        <Link
                          href={n.link}
                          className="inline-flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
                        >
                          View <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
