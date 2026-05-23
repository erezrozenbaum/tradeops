import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { AuthFetchPatch } from "@/components/layout/auth-fetch-patch";
import { ChatDrawer } from "@/components/ChatDrawer";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <AuthFetchPatch />
      <Sidebar />
      {/* pt-14: mobile top bar; pb-16: mobile bottom nav; lg overrides clear both */}
      <main className="flex-1 flex flex-col min-h-screen pt-14 pb-16 lg:ml-56 lg:pt-0 lg:pb-0">
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
