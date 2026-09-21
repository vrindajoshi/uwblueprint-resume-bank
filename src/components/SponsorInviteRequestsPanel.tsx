import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bell, Check, ChevronDown, ChevronUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { TempPasswordDialog, type SponsorCredential } from "@/components/TempPasswordDialog";
import {
  pendingSponsorInviteRequestsQuery,
  sponsorsQuery,
  type SponsorInviteRequest,
} from "@/lib/queries";
import { adminAddSponsorContact } from "@/lib/sponsor.functions";

/**
 * Pending sponsor-teammate invite requests (Sponsor Dashboard PRD: a sponsor
 * can request a colleague be added but can't grant access themselves). Shown
 * both as a global "You have X requests" banner on the Sponsors list and,
 * scoped to one sponsor, on that sponsor's profile page -- the Sponsors PRD
 * calls out the profile page as where these get approved.
 */
export function SponsorInviteRequestsPanel({ sponsorId }: { sponsorId?: string }) {
  const queryClient = useQueryClient();
  const { data: requests } = useQuery(pendingSponsorInviteRequestsQuery);
  const { data: sponsors } = useQuery(sponsorsQuery);
  const [open, setOpen] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<SponsorCredential[] | null>(null);

  const rows = (requests ?? []).filter((r) => (sponsorId ? r.sponsor_id === sponsorId : true));
  if (rows.length === 0) return null;

  const sponsorName = (id: string) =>
    (sponsors ?? []).find((s) => s.id === id)?.name ?? "Unknown sponsor";

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "sponsor-invite-requests"] });

  const approve = async (request: SponsorInviteRequest) => {
    setBusyId(request.id);
    let tempPassword: string | null = null;
    let alreadyAuthorized = false;
    try {
      const result = await adminAddSponsorContact({
        data: { sponsorId: request.sponsor_id, email: request.invited_email },
      });
      tempPassword = result.tempPassword;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not authorize this contact.";
      if (message.includes("already registered")) {
        alreadyAuthorized = true;
      } else {
        setBusyId(null);
        toast.error(message);
        return;
      }
    }

    const { error } = await supabase
      .from("sponsor_invite_requests")
      .update({ status: "approved" })
      .eq("id", request.id);
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }

    await Promise.all([
      invalidate(),
      queryClient.invalidateQueries({ queryKey: ["admin", "sponsor-emails"] }),
    ]);
    if (alreadyAuthorized) {
      toast.success(`${request.invited_email} was already authorized.`);
    } else if (tempPassword) {
      setCredentials([{ email: request.invited_email, tempPassword }]);
    }
  };

  const dismiss = async (request: SponsorInviteRequest) => {
    setBusyId(request.id);
    const { error } = await supabase
      .from("sponsor_invite_requests")
      .update({ status: "dismissed" })
      .eq("id", request.id);
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    await invalidate();
    toast.success("Request dismissed.");
  };

  return (
    <div className="panel mb-6 overflow-hidden border-primary/30 bg-primary/5">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Bell className="h-4 w-4 text-primary" />
          You have {rows.length} request{rows.length === 1 ? "" : "s"}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open ? (
        <div className="divide-y divide-border border-t border-border">
          {rows.map((request) => (
            <div
              key={request.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {request.invited_email}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sponsorId ? "Requested" : `For ${sponsorName(request.sponsor_id)} — requested`}{" "}
                  by {request.requested_by}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => void dismiss(request)}
                  disabled={busyId === request.id}
                >
                  <X className="h-3.5 w-3.5" /> Dismiss
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => void approve(request)}
                  disabled={busyId === request.id}
                >
                  {busyId === request.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Approve
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <TempPasswordDialog
        open={credentials !== null}
        onOpenChange={(next) => !next && setCredentials(null)}
        credentials={credentials ?? []}
      />
    </div>
  );
}
