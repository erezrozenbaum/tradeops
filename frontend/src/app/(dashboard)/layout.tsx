import { Sidebar } from "@/components/layout/sidebar";
import { AuthFetchPatch } from "@/components/layout/auth-fetch-patch";
import { ChatDrawer } from "@/components/ChatDrawer";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <AuthFetchPatch />
      <Sidebar />
      {/* pt-14 for mobile top bar; lg:ml-60 for desktop sidebar; lg:pt-0 resets mobile padding */}
      <main className="flex-1 min-h-screen pt-14 lg:ml-60 lg:pt-0">{children}</main>
      <ChatDrawer />
    </div>
  );
}
