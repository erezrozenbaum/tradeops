import dynamic from "next/dynamic";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { AuthFetchPatch } from "@/components/layout/auth-fetch-patch";
import { ChatDrawer } from "@/components/ChatDrawer";

// Client-only: both components read localStorage — SSR would cause hydration mismatch
const NotificationBell = dynamic(
  () => import("@/components/layout/NotificationBell").then(m => m.NotificationBell),
  { ssr: false }
);
const NextBestActionBar = dynamic(
  () => import("@/components/layout/NextBestActionBar").then(m => m.NextBestActionBar),
  { ssr: false }
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <AuthFetchPatch />
      <Sidebar />
      {/* pt-14: mobile top bar; pb-16: mobile bottom nav; lg overrides clear both */}
      <main className="flex-1 flex flex-col min-h-screen pt-14 pb-16 lg:ml-56 lg:pt-12 lg:pb-0">
        {/* Desktop header strip */}
        <div
          className="hidden lg:flex h-12 items-center justify-end px-6 shrink-0 fixed top-0 right-0 z-30"
          style={{
            left: "14rem",
            background: "hsl(220 30% 5.5%)",
            borderBottom: "1px solid hsl(217 30% 10%)",
          }}
        >
          <NotificationBell />
        </div>
        {/* Next Best Action bar — one-line contextual prompt, hidden on dashboard/command-center */}
        <NextBestActionBar />
        <div className="flex-1">{children}</div>
        <footer
          className="px-6 py-2.5 text-center text-[11px] text-muted-foreground/50 tracking-wide"
          style={{ borderTop: "1px solid hsl(217 30% 10%)" }}
        >
          TradeOps AI — educational &amp; analytical platform only &mdash; not financial advice &mdash;{" "}
          <a href="/help#disclaimer" className="underline underline-offset-2 hover:text-muted-foreground transition-colors">
            full disclaimer
          </a>
        </footer>
      </main>
      <ChatDrawer />
      <BottomNav />
    </div>
  );
}
