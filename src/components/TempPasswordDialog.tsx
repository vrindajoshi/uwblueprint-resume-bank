import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type SponsorCredential = {
  email: string;
  tempPassword: string | null;
  error?: string | null;
};

/**
 * Shows admin-issued sponsor temp passwords exactly once -- they can't be
 * retrieved again after this closes, so each row gets its own copy button
 * rather than relying on a toast that would auto-dismiss sensitive text.
 */
export function TempPasswordDialog({
  open,
  onOpenChange,
  credentials,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credentials: SponsorCredential[];
}) {
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const copy = async (email: string, password: string) => {
    try {
      await navigator.clipboard.writeText(password);
      setCopiedEmail(email);
      setTimeout(() => setCopiedEmail((current) => (current === email ? null : current)), 2000);
    } catch {
      toast.error("Couldn't copy to clipboard.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign-in password{credentials.length === 1 ? "" : "s"} issued</DialogTitle>
          <DialogDescription>
            Copy {credentials.length === 1 ? "this now" : "these now"} and share{" "}
            {credentials.length === 1 ? "it" : "them"} with the sponsor through a secure channel —
            it won't be shown again.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {credentials.map((cred) => (
            <div
              key={cred.email}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{cred.email}</p>
                {cred.tempPassword ? (
                  <p className="font-mono text-sm text-muted-foreground">{cred.tempPassword}</p>
                ) : (
                  <p className="text-sm text-destructive">
                    {cred.error ?? "Could not issue a password."}
                  </p>
                )}
              </div>
              {cred.tempPassword ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={() => void copy(cred.email, cred.tempPassword!)}
                >
                  {copiedEmail === cred.email ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copiedEmail === cred.email ? "Copied" : "Copy"}
                </Button>
              ) : null}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
