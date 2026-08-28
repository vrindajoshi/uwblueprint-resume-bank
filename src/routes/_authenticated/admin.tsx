import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { FolderTree, Loader2, Users } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useSessionInfo } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const { data: session, isLoading } = useSessionInfo();

  useEffect(() => {
    if (session && !session.isAdmin) navigate({ to: "/profile", replace: true });
  }, [session, navigate]);

  if (isLoading || !session?.isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tabs = [
    { to: "/admin/members", label: "Members", icon: Users },
    { to: "/admin/categories", label: "Categories", icon: FolderTree },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader email={session.email} subtitle="Admin dashboard" />
      <div className="mx-auto flex max-w-6xl gap-8 px-6 py-8">
        <nav className="hidden w-52 shrink-0 md:block">
          <div className="sticky top-24 space-y-1">
            {tabs.map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                className="flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                activeProps={{
                  className:
                    "flex items-center gap-2.5 rounded-sm !bg-transparent px-3 py-2 text-sm !font-bold !text-[#173b7a] transition-colors",
                }}
                activeOptions={{ exact: false }}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </Link>
            ))}
          </div>
        </nav>
        <div className="flex flex-1 flex-col">
          <nav className="mb-6 flex gap-2 md:hidden">
            {tabs.map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground",
                )}
                activeProps={{
                  className:
                    "rounded-lg border border-border !bg-transparent px-3 py-2 text-sm !font-bold !text-[#173b7a]",
                }}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
