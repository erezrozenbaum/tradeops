"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "tradeops_cc_collapsed";

function readCollapsed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeCollapsed(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

interface CollapsibleSectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleSection({ id, title, children, className }: CollapsibleSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(readCollapsed().includes(id));
  }, [id]);

  function toggle() {
    const current = readCollapsed();
    const next = collapsed
      ? current.filter(k => k !== id)
      : [...current, id];
    writeCollapsed(next);
    setCollapsed(!collapsed);
  }

  return (
    <div className={className}>
      <button
        onClick={toggle}
        className="flex items-center justify-between w-full mb-3 group"
        aria-expanded={!collapsed}
      >
        <span className="text-xs font-semibold text-cyber-muted uppercase tracking-wider">
          {title}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            "text-cyber-muted group-hover:text-cyber-text transition-transform duration-200",
            collapsed ? "-rotate-90" : "rotate-0",
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-[max-height] duration-300 ease-in-out",
          collapsed ? "max-h-0" : "max-h-[2000px]",
        )}
      >
        {children}
      </div>
    </div>
  );
}
