"use client";

import Link from "next/link";
import { ArrowRight, GitBranch } from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

interface FuturesPath {
  label: string;
  values: number[];
  color: string;
}

interface FuturesPreview {
  paths: FuturesPath[];
  fi_probability: number | null;
  has_data: boolean;
}

interface FuturesPreviewCardProps {
  data: FuturesPreview;
}

export function FuturesPreviewCard({ data }: FuturesPreviewCardProps) {
  if (!data.has_data) {
    return (
      <div className="rounded-xl border bg-cyber-surface p-5" style={{ borderColor: "hsl(217 30% 12%)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/70">
            Parallel Futures
          </h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Run your first simulation to see projected financial paths here.
        </p>
        <Link href="/futures" className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
          <GitBranch className="h-3.5 w-3.5" />
          Open Simulation Engine
        </Link>
      </div>
    );
  }

  // Build chart data by aligning all paths to same x-axis
  const maxLen = Math.max(...data.paths.map(p => p.values.length));
  const chartData = Array.from({ length: maxLen }, (_, i) => {
    const row: Record<string, number | string> = { month: `M${i + 1}` };
    data.paths.forEach(path => {
      row[path.label] = path.values[i] ?? path.values[path.values.length - 1];
    });
    return row;
  });

  return (
    <div className="rounded-xl border bg-cyber-surface p-5" style={{ borderColor: "hsl(217 30% 12%)" }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/70">
          Parallel Futures
        </h2>
        <Link href="/futures" className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-foreground transition-colors">
          Full simulation <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <XAxis dataKey="month" hide />
          <Tooltip
            contentStyle={{ background: "hsl(220 30% 8%)", border: "1px solid hsl(217 30% 15%)", borderRadius: 6, fontSize: 11 }}
            formatter={(v: number) => v.toLocaleString()}
          />
          {data.paths.map(path => (
            <Line
              key={path.label}
              type="monotone"
              dataKey={path.label}
              stroke={path.color}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-3 mt-3">
        {data.paths.map(path => (
          <div key={path.label} className="flex items-center gap-1.5">
            <div className="h-2 w-4 rounded-full" style={{ background: path.color }} />
            <span className="text-[11px] text-muted-foreground">{path.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
