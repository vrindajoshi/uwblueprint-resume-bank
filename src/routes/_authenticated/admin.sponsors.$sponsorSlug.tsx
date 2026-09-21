import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { KeyRound, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { SponsorInviteRequestsPanel } from "@/components/SponsorInviteRequestsPanel";
import { TempPasswordDialog, type SponsorCredential } from "@/components/TempPasswordDialog";
import {
  allSponsorCategoryAccessQuery,
  allSponsorEmailsQuery,
  allSponsorPerksQuery,
  categoriesQuery,
  sponsorsQuery,
  validateSponsorEmail,
  type SponsorEmail,
} from "@/lib/queries";
import {
  faviconUrlFor,
  normalizeWebsiteUrl,
  uploadSponsorLogo,
  validateSponsorLogoFile,
} from "@/lib/sponsor-logo";
import { adminAddSponsorContact, adminReissueSponsorPassword } from "@/lib/sponsor.functions";

export const Route = createFileRoute("/_authenticated/admin/sponsors/$sponsorSlug")({
  head: () => ({
    meta: [
      { title: "UW Blueprint Sponsor Resume Book" },
      { name: "description", content: "Manage a sponsor's resume access, perks and contacts." },
      { property: "og:title", content: "UW Blueprint Sponsor Resume Book" },
      {
        property: "og:description",
        content: "Manage a sponsor's resume access, perks and contacts.",
      },
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
  const [credentials, setCredentials] = useState<SponsorCredential[] | null>(null);
  const [reissuingId, setReissuingId] = useState<string | null>(null);

  const [editingWebsite, setEditingWebsite] = useState(false);
  const [websiteValue, setWebsiteValue] = useState("");
  const [websiteError, setWebsiteError] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);

  const invalidateAll = () => queryClient.invalidateQueries({ queryKey: ["admin"] });

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
    const { error } = await supabase
      .from("sponsors")
      .update({ name: trimmed })
      .eq("id", sponsor.id);
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

  const startEditWebsite = () => {
    if (!sponsor) return;
    setWebsiteValue(sponsor.website_url);
    setWebsiteError(null);
    setEditingWebsite(true);
  };

  const saveWebsite = async () => {
    if (!sponsor) return;
    const websiteUrl = normalizeWebsiteUrl(websiteValue);
    if (!websiteUrl) return setWebsiteError("Enter a valid website (e.g. acme.com).");
    setBusy(true);
    // Refreshing a favicon-sourced logo to match the new domain, but leaving
    // a deliberately-uploaded custom logo alone.
    const update: { website_url: string; logo_url?: string | null } = { website_url: websiteUrl };
    if (sponsor.logo_source === "favicon") update.logo_url = faviconUrlFor(websiteUrl);
    const { error } = await supabase.from("sponsors").update(update).eq("id", sponsor.id);
    setBusy(false);
    if (error) {
      setWebsiteError(error.message);
      return;
    }
    setEditingWebsite(false);
    await invalidateAll();
    toast.success("Website updated.");
  };

  const uploadCustomLogo = async (file: File) => {
    if (!sponsor) return;
    const validationError = validateSponsorLogoFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setLogoBusy(true);
    try {
      const logoUrl = await uploadSponsorLogo(file);
      const { error } = await supabase
        .from("sponsors")
        .update({ logo_url: logoUrl, logo_source: "custom" })
        .eq("id", sponsor.id);
      if (error) throw new Error(error.message);
      await invalidateAll();
      toast.success("Logo updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload the logo.");
    } finally {
      setLogoBusy(false);
    }
  };

  const resetLogoToFavicon = async () => {
    if (!sponsor) return;
    setLogoBusy(true);
    const { error } = await supabase
      .from("sponsors")
      .update({ logo_url: faviconUrlFor(sponsor.website_url), logo_source: "favicon" })
      .eq("id", sponsor.id);
    setLogoBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await invalidateAll();
    toast.success("Logo reset to the site's favicon.");
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
    const { error } = await supabase
      .from("sponsor_perks")
      .update({ status: next })
      .eq("id", perkId);
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
    let result: Awaited<ReturnType<typeof adminAddSponsorContact>>;
    try {
      result = await adminAddSponsorContact({
        data: { sponsorId: sponsor.id, email: newEmail.trim().toLowerCase() },
      });
    } catch (e) {
      setBusy(false);
      setEmailError(e instanceof Error ? e.message : "Could not add contact.");
      return;
    }
    setBusy(false);
    setNewEmail("");
    setEmailError(null);
    await queryClient.invalidateQueries({ queryKey: ["admin", "sponsor-emails"] });
    setCredentials([{ email: result.email, tempPassword: result.tempPassword }]);
  };

  const reissuePassword = async (email: SponsorEmail) => {
    setReissuingId(email.id);
    try {
      const result = await adminReissueSponsorPassword({ data: { sponsorEmailId: email.id } });
      setCredentials([{ email: result.email, tempPassword: result.tempPassword }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not issue a password.");
    } finally {
      setReissuingId(null);
    }
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
      <SponsorInviteRequestsPanel sponsorId={sponsor.id} />

      <nav className="text-sm text-muted-foreground">
        <Link to="/admin/sponsors" className="hover:text-foreground">
          Sponsors
        </Link>
        <span className="px-1.5">/</span>
        <span className="font-medium text-foreground">{sponsor.name}</span>
      </nav>

      <div className="mt-4 flex items-start gap-4">
        <div className="relative shrink-0">
          <Avatar className="h-14 w-14 rounded-md border border-border">
            <AvatarImage src={sponsor.logo_url ?? undefined} alt="" />
            <AvatarFallback className="rounded-md text-sm font-semibold">
              {sponsor.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {logoBusy ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/70">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
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

          <div className="mt-2">
            {editingWebsite ? (
              <div className="flex max-w-md items-start gap-2">
                <div className="flex-1">
                  <Input
                    value={websiteValue}
                    onChange={(e) => {
                      setWebsiteValue(e.target.value);
                      setWebsiteError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void saveWebsite();
                      }
                      if (e.key === "Escape") setEditingWebsite(false);
                    }}
                    autoFocus
                    placeholder="acme.com"
                    aria-label="Company website"
                  />
                  {websiteError ? (
                    <p className="mt-1 text-xs text-destructive">{websiteError}</p>
                  ) : null}
                </div>
                <Button size="sm" onClick={() => void saveWebsite()} disabled={busy}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingWebsite(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <a
                  href={sponsor.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-sm text-muted-foreground hover:text-primary hover:underline"
                >
                  {sponsor.website_url}
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs text-muted-foreground shadow-none hover:text-foreground"
                  onClick={startEditWebsite}
                >
                  Edit
                </Button>
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 shadow-none"
              asChild
            >
              <label className="cursor-pointer">
                <Upload className="h-3.5 w-3.5" /> Upload logo
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={logoBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void uploadCustomLogo(file);
                  }}
                />
              </label>
            </Button>
            {sponsor.logo_source === "custom" ? (
              <Button
                variant="ghost"
                size="sm"
                className="shadow-none text-muted-foreground"
                onClick={() => void resetLogoToFavicon()}
                disabled={logoBusy}
              >
                Reset to favicon
              </Button>
            ) : null}
          </div>
        </div>
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
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground shadow-none hover:text-foreground"
                  onClick={() => void reissuePassword(email)}
                  disabled={reissuingId === email.id}
                  aria-label={`Reissue password for ${email.email}`}
                >
                  {reissuingId === email.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="h-4 w-4" />
                  )}
                </Button>
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

      <TempPasswordDialog
        open={credentials !== null}
        onOpenChange={(next) => !next && setCredentials(null)}
        credentials={credentials ?? []}
      />
    </div>
  );
}
