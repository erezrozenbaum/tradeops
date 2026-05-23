"use client";

import Link from "next/link";
import { AlertTriangle, AlertCircle, Info, ArrowRight, Shield, Brain, BarChart2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { MaturityVariant } from "@/hooks/useMaturityVariant";

interface Action {
  title: string;
  rationale: string;
  severity: string;
  impact: string;
  urgent: boolean;
  category: string;
  link: string | null;
}

interface ActionsPanelProps {
  actions: Action[];
  variant: MaturityVariant;
}

const SEVERITY_CONFIG = {
  critical: {
    bg: "bg-red-500/8 border-red-500/20",
    accent: "border-l-red-500",
    badge: "bg-red-500/15 text-red-400",
    icon: <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />,
    label: "Critical",
  },
  high: {
    bg: "bg-amber-500/8 border-amber-500/20",
    accent: "border-l-amber-500",
    badge: "bg-amber-500/15 text-amber-400",
    icon: <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />,
    label: "High",
  },
  medium: {
    bg: "bg-blue-500/8 border-blue-500/20",
    accent: "border-l-blue-500",
    badge: "bg-blue-500/15 text-blue-400",
    icon: <Info className="h-4 w-4 text-blue-400 shrink-0" />,
    label: "Monitor",
  },
  positive: {
    bg: "bg-emerald-500/8 border-emerald-500/20",
    accent: "border-l-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-400",
    icon: <Info className="h-4 w-4 text-emerald-400 shrink-0" />,
    label: "Good",
  },
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  safety: <Shield className="h-3 w-3" />,
  behavior: <Brain className="h-3 w-3" />,
  portfolio: <BarChart2 className="h-3 w-3" />,
  contribution: <TrendingUp className="h-3 w-3" />,
};

function ActionCard({ action, variant }: { action: Action; variant: MaturityVariant }) {
  const cfg = SEVERITY_CONFIG[action.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.medium;

  return (
    <div className={cn(
      "rounded-lg border border-l-4 p-4 transition-colors hover:bg-white/[0.02]",
      cfg.bg, cfg.accent,
    )}>
      <div className="flex items-start gap-3">
        {cfg.icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold text-foreground leading-snug">{action.title}</span>
            {action.urgent && (
              <span className="text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">
                Urgent
              </span>
            )}
          </div>
          {(variant.showCausalExplanations || variant.actionCopyDetail !== "minimal") && (
            <p className="text-xs text-muted-foreground leading-relaxed">{action.rationale}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
              {CATEGORY_ICONS[action.category]}
              <span className="capitalize">{action.category}</span>
            </div>
            {variant.showNumericMetrics && (
              <span className={cn("text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded", cfg.badge)}>
                {action.impact} impact
              </span>
            )}
            {action.link && (
              <Link
                href={action.link}
                className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors"
              >
                Details <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ActionsPanel({ actions, variant }: ActionsPanelProps) {
  if (!actions.length) {
    return (
      <div className="rounded-xl border bg-cyber-surface p-5" style={{ borderColor: "hsl(217 30% 12%)" }}>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/70 mb-4">
          Today&apos;s Top Actions
        </h2>
        <p className="text-sm text-muted-foreground">
          No priority actions at this time. Keep up the good work.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-cyber-surface p-5" style={{ borderColor: "hsl(217 30% 12%)" }}>
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/70 mb-4">
        Today&apos;s Top Actions
      </h2>
      <div className="space-y-3">
        {actions.map((action, i) => (
          <ActionCard key={i} action={action} variant={variant} />
        ))}
      </div>
    </div>
  );
}
