"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* Recharts dark theme token exports — import these into any chart page */
export const CHART_COLORS = {
  cyan:    "#0dcaf0",
  emerald: "#10b981",
  amber:   "#f59e0b",
  red:     "#ef4444",
  purple:  "#8b5cf6",
  blue:    "#3b82f6",
  pink:    "#ec4899",
  orange:  "#f97316",
  teal:    "#14b8a6",
} as const;

export const CHART_PALETTE = Object.values(CHART_COLORS);

export const AXIS_PROPS = {
  tick:      { fill: "#64748b", fontSize: 11, fontFamily: "JetBrains Mono, monospace" },
  axisLine:  { stroke: "#1e2a3a" },
  tickLine:  false as const,
};

export const GRID_PROPS = {
  stroke:          "#1e2a3a",
  strokeDasharray: "3 3",
};

export const TOOLTIP_STYLE: React.CSSProperties = {
  background:   "hsl(222 38% 8%)",
  border:       "1px solid hsl(217 30% 18%)",
  borderRadius: "8px",
  boxShadow:    "0 8px 32px hsl(220 30% 3% / 0.8), 0 0 0 1px hsl(199 95% 52% / 0.1)",
  padding:      "8px 12px",
  fontSize:     "12px",
  fontFamily:   "JetBrains Mono, monospace",
  color:        "#e2e8f0",
};

export const TOOLTIP_LABEL_STYLE: React.CSSProperties = {
  color:        "#94a3b8",
  marginBottom: "4px",
  fontSize:     "11px",
};

/* GlowChart — wraps any recharts ResponsiveContainer with a dark panel */
interface GlowChartProps {
  children: ReactNode;
  className?: string;
  height?: number;
  label?: string;
  accentColor?: string;
}

export function GlowChart({
  children,
  className,
  height = 180,
  label,
  accentColor = "#0dcaf0",
}: GlowChartProps) {
  return (
    <div
      className={cn("relative rounded-lg overflow-hidden", className)}
      style={{
        background: "hsl(222 38% 6%)",
        border:     `1px solid hsl(217 30% 12%)`,
        borderTop:  `1px solid ${accentColor}22`,
        boxShadow:  `0 0 0 0 transparent, inset 0 1px 0 ${accentColor}18`,
      }}
    >
      {label && (
        <p
          className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: accentColor, opacity: 0.7 }}
        >
          {label}
        </p>
      )}
      <div style={{ height }}>
        {children}
      </div>
    </div>
  );
}
