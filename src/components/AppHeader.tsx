import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/lib/session";

export function AppHeader({ email, subtitle }: { email?: string; subtitle?: string }) {
  const signOut = useSignOut();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <img src="public/blueprint-logo.png" alt="UW Blueprint" className="h-9 w-9" />
          <div className="leading-tight">
            <p className="text-sm font-bold text-foreground">UW Blueprint Sponsor Resume Book</p>
            {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {email ? (
            <span className="hidden text-sm text-muted-foreground sm:inline">{email}</span>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => void signOut()} className="gap-2">
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
