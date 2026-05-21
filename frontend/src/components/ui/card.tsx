import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-cyber-rule bg-cyber-surface text-card-foreground",
        "shadow-card-dark transition-all duration-200",
        "hover:border-cyber-rule/80 hover:shadow-card-hover",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-xs font-semibold text-muted-foreground uppercase tracking-wider", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}

/* Accent cards — coloured top border + optional glow */
export function CyanCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-cyber-rule bg-cyber-surface text-card-foreground",
        "shadow-card-dark transition-all duration-200",
        "border-t border-t-cyber-cyan/40 hover:shadow-glow-cyan",
        className
      )}
      {...props}
    />
  );
}

export function EmeraldCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-cyber-rule bg-cyber-surface text-card-foreground",
        "shadow-card-dark transition-all duration-200",
        "border-t border-t-cyber-emerald/40 hover:shadow-glow-emerald",
        className
      )}
      {...props}
    />
  );
}
