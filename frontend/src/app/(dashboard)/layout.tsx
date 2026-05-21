import { Sidebar } from "@/components/layout/sidebar";
import { AuthFetchPatch } from "@/components/layout/auth-fetch-patch";
import { ChatDrawer } from "@/components/ChatDrawer";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <AuthFetchPatch />
      <Sidebar />
      {/* pt-14 for mobile top bar; lg:ml-60 for desktop sidebar; lg:pt-0 resets mobile padding */}
      <main className="flex-1 flex flex-col min-h-screen pt-14 lg:ml-60 lg:pt-0">
        <div className="flex-1">{children}</div>
        <footer className="border-t border-border px-6 py-3 text-center text-xs text-muted-foreground lg:ml-0">
          TradeOps AI is not a licensed financial advisor &mdash; for educational and analytical use only &mdash; use at your own risk &mdash;{" "}
          <a href="/help#disclaimer" className="underline underline-offset-2 hover:text-foreground transition-colors">
            Full disclaimer
          </a>
        </footer>
      </main>
      <ChatDrawer />
    </div>
  );
}
