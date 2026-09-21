import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sponsorSupabase } from "@/integrations/supabase/sponsor-client";
import { sponsorContactsQuery } from "@/lib/sponsor-queries";
import { requestSponsorInvite } from "@/lib/sponsor.functions";

export const Route = createFileRoute("/_sponsor/sponsor/members")({
  head: () => ({
    meta: [
      { title: "Members — Sponsor Portal" },
      { name: "description", content: "Contacts authorized to sign in to your sponsor portal." },
    ],
  }),
  component: SponsorMembersTab,
});

function SponsorMembersTab() {
  const { data: contacts, isLoading } = useQuery(sponsorContactsQuery);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const closeInvite = (open: boolean) => {
    setInviteOpen(open);
    if (!open) {
      setEmail("");
      setError(null);
    }
  };

  const submitInvite = async () => {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter an email address.");
      return;
    }
    setBusy(true);
    try {
      const { data: sessionData } = await sponsorSupabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Your session has expired. Sign in again.");
      await requestSponsorInvite({ data: { accessToken, invitedEmail: trimmed } });
      toast.success("Request sent. UW Blueprint will review it shortly.");
      closeInvite(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Members</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Contacts authorized to sign in to this portal.
          </p>
        </div>
        <Button size="lg" className="gap-2" onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4" /> Invite
        </Button>
      </div>

      <div className="panel mt-6 divide-y divide-border overflow-hidden">
        {(contacts ?? []).length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            No authorized contacts yet.
          </p>
        ) : null}
        {(contacts ?? []).map((contact) => (
          <div key={contact.id} className="flex items-center gap-3 px-5 py-4">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{contact.email}</span>
          </div>
        ))}
      </div>

      <Dialog open={inviteOpen} onOpenChange={closeInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a teammate</DialogTitle>
            <DialogDescription>
              We'll send this to UW Blueprint for review — it doesn't grant access right away.
              Once approved, your colleague can sign in with this email through the normal
              sponsor login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Colleague's email</Label>
            <Input
              id="invite-email"
              type="email"
              autoFocus
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submitInvite();
                }
              }}
              placeholder="colleague@company.com"
              disabled={busy}
            />
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => closeInvite(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void submitInvite()} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
