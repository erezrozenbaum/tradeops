import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "ILS", compact = false): string {
  if (compact) {
    const abs = Math.abs(amount);
    if (abs >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${Math.round(amount / 1_000)}K`;
    return String(Math.round(amount));
  }
  return new Intl.NumberFormat("he-IL", { style: "currency", currency }).format(amount);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
