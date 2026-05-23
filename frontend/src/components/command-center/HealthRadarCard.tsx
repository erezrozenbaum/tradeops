"use client";

import Link from "next/link";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { ArrowRight } from "lucide-react";

interface RadarPoint {
  dimension: string;
  label: string;
  value: number;
}

interface HealthRadarCardProps {
  data: RadarPoint[];
}

const SIMPLE_LABELS: Record<string, string> = {
  stability: "Stability",
  liquidity: "Liquidity",
  discipline: "Discipline",
  diversification: "Diversify",
  emotional_control: "Emotions",
  contribution_consistency: "Savings",
  tax_efficiency: "Tax",
  risk_alignment: "Risk",
  resilience: "Resilience",
};

export function HealthRadarCard({ data }: HealthRadarCardProps) {
  const chartData = data.map((d) => ({
    subject: SIMPLE_LABELS[d.dimension] ?? d.label,
    value: d.value,
    fullMark: 100,
  }));

  return (
    <div className="rounded-xl border bg-cyber-surface p-5" style={{ borderColor: "hsl(217 30% 12%)" }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/70">
          Financial Health Radar
        </h2>
        <Link href="/health-radar" className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-foreground transition-colors">
          Full view <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {!chartData.length ? (
        <p className="text-xs text-muted-foreground">No health data yet. Complete your financial profile to enable radar.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
            <PolarGrid stroke="hsl(217 30% 15%)" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: "hsl(215 20% 50%)", fontSize: 10 }}
            />
            <Radar
              name="Health"
              dataKey="value"
              stroke="hsl(200 100% 60%)"
              fill="hsl(200 100% 60%)"
              fillOpacity={0.15}
              strokeWidth={1.5}
            />
          </RadarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
