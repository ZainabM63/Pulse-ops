"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { DashboardDataProvider } from "@/hooks/useDashboardData";
import Sidebar from "@/components/Sidebar";
import Shell from "@/components/layout/Shell";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-amber" />
          <span className="text-[10px] uppercase tracking-widest text-fg-muted">Initializing Grid...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <DashboardDataProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        <Shell menuOpen={sidebarOpen} onMenuToggle={() => setSidebarOpen((o) => !o)} />
        <div className="flex flex-1 overflow-hidden">
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-30 bg-black/50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-hidden
            />
          )}
          <div
            className={`fixed bottom-0 left-0 top-12 z-40 transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0 ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
          <main className="flex-1 overflow-y-auto bg-canvas">{children}</main>
        </div>
      </div>
    </DashboardDataProvider>
  );
}
