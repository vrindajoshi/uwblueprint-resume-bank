import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  allSponsorCategoryAccessQuery,
  allSponsorEmailsQuery,
  allSponsorPerksQuery,
  categoriesQuery,
  sponsorsQuery,
  validateSponsorEmail,
  type SponsorEmail,
} from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/sponsors/$sponsorSlug")({
  head: () => ({
    meta: [
      { title: "UW Blueprint Sponsor Resume Book" },
      { name: "description", content: "Manage a sponsor's resume access, perks and contacts." },
      { property: "og:title", content: "UW Blueprint Sponsor Resume Book" },
      { property: "og:description", content: "Manage a sponsor's resume access, perks and contacts." },
    ],
  }),
  component: SponsorProfile,
});

function SponsorProfile() {
  const { sponsorSlug } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: sponsors, isLoading: sponsorsLoading } = useQuery(sponsorsQuery);
  const { data: categories } = useQuery(categoriesQuery);
  const { data: categoryAccess } = useQuery(allSponsorCategoryAccessQuery);
  const { data: perks } = useQuery(allSponsorPerksQuery);
  const { data: emails } = useQuery(allSponsorEmailsQuery);

  const sponsor = (sponsors ?? []).find((s) => s.slug === sponsorSlug);

  const [renaming, setRenaming] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<SponsorEmail | null>(null);

  const invalidateAll = () =>
    queryClient.invalidateQueries({ queryKey: ["admin"] });

  const startRename = () => {
    if (!sponsor) return;
    setNameValue(sponsor.name);
    setNameError(null);
    setRenaming(true);
  };

  const saveRename = async () => {
    if (!sponsor) return;
    const trimmed = nameValue.trim();
    if (!trimmed) return setNameError("Enter a sponsor name.");
    setBusy(true);
    const { error } = await supabase.from("sponsors").update({ name: trimmed }).eq("id", sponsor.id);
    setBusy(false);
    if (error) {
      setNameError(
        error.code === "23505" ? "A sponsor with that name already exists." : error.message,
      );
      return;
    }
    setRenaming(false);
    await invalidateAll();
    toast.success("Sponsor renamed.");
  };

  const toggleCategory = async (categoryId: string, checked: boolean) => {
    if (!sponsor) return;
    const { error } = checked
      ? await supabase
          .from("sponsor_category_access")
          .insert({ sponsor_id: sponsor.id, category_id: categoryId })
      : await supabase
          .from("sponsor_category_access")
          .delete()
          .eq("sponsor_id", sponsor.id)
          .eq("category_id", categoryId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["admin", "sponsor-category-access"] });
  };

  const togglePerkStatus = async (perkId: string, current: "not_redeemed" | "redeemed") => {
    const next = current === "redeemed" ? "not_redeemed" : "redeemed";
    const { error } = await supabase.from("sponsor_perks").update({ status: next }).eq("id", perkId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["admin", "sponsor-perks"] });
  };

  const addEmail = async () => {
    if (!sponsor) return;
    const validationError = validateSponsorEmail(newEmail);
    if (validationError) {
      setEmailError(validationError);
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("sponsor_emails")
      .insert({ sponsor_id: sponsor.id, email: newEmail.trim().toLowerCase() });
    setBusy(false);
    if (error) {
      setEmailError(
        error.code === "23505" ? "That email is already registered to a sponsor." : error.message,
      );
      return;
    }
    setNewEmail("");
    setEmailError(null);
    await queryClient.invalidateQueries({ queryKey: ["admin", "sponsor-emails"] });
    toast.success("Email added.");
  };

  const revokeEmail = async () => {
    if (!revoking) return;
    setBusy(true);
    const { error } = await supabase.from("sponsor_emails").delete().eq("id", revoking.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRevoking(null);
    await queryClient.invalidateQueries({ queryKey: ["admin", "sponsor-emails"] });
    toast.success("Email revoked.");
  };

  if (sponsorsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sponsor) {
    return (
      <div>
        <nav className="text-sm text-muted-foreground">
          <Link to="/admin/sponsors" className="hover:text-foreground">
            Sponsors
          </Link>
        </nav>
        <p className="mt-6 text-sm text-muted-foreground">Sponsor not found.</p>
      </div>
    );
  }

  const sponsorEmails = (emails ?? []).filter((e) => e.sponsor_id === sponsor.id);
  const sponsorPerks = (perks ?? []).filter((p) => p.sponsor_id === sponsor.id);
  const grantedCategoryIds = new Set(
    (categoryAccess ?? []).filter((a) => a.sponsor_id === sponsor.id).map((a) => a.category_id),
  );

  return (
    <div>
      <nav className="text-sm text-muted-foreground">
        <Link to="/admin/sponsors" className="hover:text-foreground">
          Sponsors
        </Link>
        <span className="px-1.5">/</span>
        <span className="font-medium text-foreground">{sponsor.name}</span>
      </nav>

      <div className="mt-4">
        {renaming ? (
          <div className="flex max-w-md items-start gap-2">
            <div className="flex-1">
              <Input
                value={nameValue}
                onChange={(e) => {
                  setNameValue(e.target.value);
                  setNameError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void saveRename();
                  }
                  if (e.key === "Escape") setRenaming(false);
                }}
                autoFocus
                className="text-2xl font-bold h-auto py-1"
                aria-label="Sponsor name"
              />
              {nameError ? <p className="mt-1 text-xs text-destructive">{nameError}</p> : null}
            </div>
            <Button size="sm" onClick={() => void saveRename()} disabled={busy}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRenaming(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{sponsor.name}</h1>
            <Button variant="outline" size="sm" className="shadow-none" onClick={startRename}>
              Rename
            </Button>
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="panel p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Resume access
          </h2>
          {(categories ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No categories exist yet.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {(categories ?? []).map((category) => (
                <div key={category.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm">{category.name}</span>
                  <Switch
                    checked={grantedCategoryIds.has(category.id)}
                    onCheckedChange={(checked) => void toggleCategory(category.id, checked)}
                    aria-label={`Toggle access to ${category.name}`}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Perks</h2>
          {sponsorPerks.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No perks recorded.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {sponsorPerks.map((perk) => (
                <div
                  key={perk.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                >
                  <span className="text-sm">{perk.description}</span>
                  <Button
                    variant={perk.status === "redeemed" ? "default" : "outline"}
                    size="sm"
                    className="shrink-0 shadow-none"
                    onClick={() => void togglePerkStatus(perk.id, perk.status)}
                  >
                    {perk.status === "redeemed" ? "Redeemed" : "Not Redeemed"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="panel mt-6 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Authorized contacts
        </h2>

        <div className="mt-4 space-y-2">
          {sponsorEmails.length === 0 ? (
            <p className="text-sm text-muted-foreground">No authorized contacts yet.</p>
          ) : null}
          {sponsorEmails.map((email) => (
            <div
              key={email.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <span className="text-sm">{email.email}</span>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground shadow-none hover:text-destructive"
                onClick={() => setRevoking(email)}
                aria-label={`Revoke ${email.email}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-4 max-w-sm">
          <Label htmlFor="new-sponsor-email">Add an authorized email</Label>
          <div className="mt-1.5 flex gap-2">
            <Input
              id="new-sponsor-email"
              type="email"
              value={newEmail}
              onChange={(e) => {
                setNewEmail(e.target.value);
                setEmailError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addEmail();
                }
              }}
              placeholder="contact@sponsor.com"
            />
            <Button onClick={() => void addEmail()} disabled={busy} className="shrink-0 gap-1.5">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          {emailError ? <p className="mt-1 text-xs text-destructive">{emailError}</p> : null}
        </div>
      </section>

      <Dialog open={Boolean(revoking)} onOpenChange={(open) => !open && setRevoking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke "{revoking?.email}"?</DialogTitle>
            <DialogDescription>
              This contact will no longer be able to sign in to {sponsor.name}'s sponsor portal.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRevoking(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void revokeEmail()} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
