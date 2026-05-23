"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cpu, Activity, Bot, User, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Home",    href: "/command-center", icon: Cpu },
  { label: "Actions", href: "/insights",        icon: Zap },
  { label: "Health",  href: "/health-radar",    icon: Activity },
  { label: "Report",  href: "/agent",            icon: Bot },
  { label: "Profile", href: "/profile",          icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t bg-cyber-bg"
      style={{ borderColor: "hsl(217 30% 12%)" }}
    >
      <div className="flex h-16">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                active ? "text-cyber-blue" : "text-cyber-muted hover:text-cyber-text",
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
