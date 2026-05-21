import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  className?: string;
  indicatorClassName?: string;
  color?: "cyan" | "emerald" | "amber" | "red";
}

const COLOR_MAP = {
  cyan:    "bg-cyber-cyan shadow-[0_0_8px_hsl(199_95%_52%/0.5)]",
  emerald: "bg-cyber-emerald shadow-[0_0_8px_hsl(160_84%_39%/0.5)]",
  amber:   "bg-cyber-amber shadow-[0_0_8px_hsl(38_92%_50%/0.5)]",
  red:     "bg-cyber-red shadow-[0_0_8px_hsl(0_84%_60%/0.5)]",
};

export function Progress({ value, className, indicatorClassName, color = "cyan" }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, value));
  const autoColor = pct >= 80 ? "emerald" : pct >= 50 ? "cyan" : pct >= 25 ? "amber" : "red";
  const usedColor = indicatorClassName ? "cyan" : autoColor;

  return (
    <div className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-cyber-rule", className)}>
      <div
        className={cn(
          "h-full transition-all duration-700 ease-out rounded-full",
          indicatorClassName ?? COLOR_MAP[usedColor]
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
