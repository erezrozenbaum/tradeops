"use client";

import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface MetricTooltipProps {
  content: string;
  children?: React.ReactNode;
}

export function MetricTooltip({ content, children }: MetricTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex items-center gap-1">
      {children}
      <button
        type="button"
        className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        aria-label="Why this matters"
      >
        <Info className="h-3 w-3" />
      </button>
      {open && (
        <span className="absolute left-0 top-full mt-1.5 z-50 w-64 rounded-lg border border-border bg-card px-3 py-2.5 text-xs text-muted-foreground shadow-xl leading-relaxed pointer-events-none">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">
            Why this matters
          </span>
          {content}
        </span>
      )}
    </span>
  );
}
