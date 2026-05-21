"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIDisclaimerProps {
  className?: string;
  compact?: boolean;
}

export function AIDisclaimer({ className, compact = false }: AIDisclaimerProps) {
  if (compact) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        AI-generated output — for informational purposes only. Not financial advice.{" "}
        <a href="/help#disclaimer" className="underline underline-offset-2 hover:text-foreground transition-colors">
          Learn more
        </a>
      </p>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm",
        className
      )}
    >
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
      <div className="space-y-0.5">
        <p className="font-medium text-amber-600 dark:text-amber-400">AI-generated — not financial advice</p>
        <p className="text-muted-foreground">
          This output is produced by an AI model and is for informational and educational purposes only.
          It may be incomplete or inaccurate. Always verify independently and consult a licensed financial
          professional before making any investment decision.{" "}
          <a href="/help#disclaimer" className="underline underline-offset-2 hover:text-foreground transition-colors">
            Full disclaimer
          </a>
        </p>
      </div>
    </div>
  );
}
