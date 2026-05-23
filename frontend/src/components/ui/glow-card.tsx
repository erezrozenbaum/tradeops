import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function GlowCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-cyber-rule bg-cyber-surface text-card-foreground",
        "shadow-card-dark transition-all duration-200",
        "hover:border-cyber-cyan/20 hover:shadow-glow-cyan",
        className
      )}
      {...props}
    />
  );
}
