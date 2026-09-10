import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronRight, Loader2, Plus, Search, X } from "lucide-react";
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
  allSponsorEmailsQuery,
  allSponsorPerksQuery,
  categoriesQuery,
  sponsorsQuery,
  validateSponsorEmail,
} from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/sponsors/")({
  head: () => ({
    meta: [
      { title: "UW Blueprint Sponsor Resume Book" },
      { name: "description", content: "Create and manage sponsor accounts, access and perks." },
      { property: "og:title", content: "UW Blueprint Sponsor Resume Book" },
      { property: "og:description", content: "Create and manage sponsor accounts, access and perks." },
    ],
  }),
  component: SponsorsTab,
});

function SponsorsTab() {
  const { data: sponsors, isLoading } = useQuery(sponsorsQuery);
  const { data: sponsorEmails } = useQuery(allSponsorEmailsQuery);
  const { data: sponsorPerks } = useQuery(allSponsorPerksQuery);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const emailCountFor = (id: string) => (sponsorEmails ?? []).filter((e) => e.sponsor_id === id).length;
  const perksFor = (id: string) => (sponsorPerks ?? []).filter((p) => p.sponsor_id === id);

  const rows = (sponsors ?? []).filter((s) =>
    search.trim() ? s.name.toLowerCase().includes(search.trim().toLowerCase()) : true,
  );

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
          <h1 className="text-2xl font-bold text-foreground">Sponsors</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} of {(sponsors ?? []).length} sponsors
          </p>
        </div>
        <Button size="lg" className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Add Sponsor
        </Button>
      </div>

      <div className="relative mt-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name"
          className="pl-9"
        />
      </div>

      <div className="panel mt-6 divide-y divide-border overflow-hidden">
        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {(sponsors ?? []).length === 0 ? "No sponsors yet." : "No sponsors match your search."}
          </p>
        ) : null}
        {rows.map((sponsor) => {
          const perks = perksFor(sponsor.id);
          const redeemed = perks.filter((p) => p.status === "redeemed").length;
          return (
            <Link
              key={sponsor.id}
              to="/admin/sponsors/$sponsorSlug"
              params={{ sponsorSlug: sponsor.slug }}
              className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-secondary/60"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground group-hover:text-primary">
                  {sponsor.name}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {emailCountFor(sponsor.id)} contact{emailCountFor(sponsor.id) === 1 ? "" : "s"} ·{" "}
                  {perks.length} perk{perks.length === 1 ? "" : "s"}
                  {perks.length > 0 ? ` (${redeemed} redeemed)` : ""}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          );
        })}
      </div>

      <CreateSponsorDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CreateSponsorDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: categories } = useQuery(categoriesQuery);

  const empty = () => ({
    name: "",
    emails: [""],
    categoryIds: [] as string[],
    perks: [""],
  });
  const [form, setForm] = useState(empty());
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailErrors, setEmailErrors] = useState<(string | null)[]>([null]);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setForm(empty());
    setNameError(null);
    setEmailErrors([null]);
  };

  const close = (openState: boolean) => {
    if (!openState) reset();
    onOpenChange(openState);
  };

  const updateEmail = (index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      emails: prev.emails.map((e, i) => (i === index ? value : e)),
    }));
    setEmailErrors((prev) => prev.map((err, i) => (i === index ? null : err)));
  };

  const removeEmail = (index: number) => {
    setForm((prev) => ({ ...prev, emails: prev.emails.filter((_, i) => i !== index) }));
    setEmailErrors((prev) => prev.filter((_, i) => i !== index));
  };

  const removePerk = (index: number) => {
    setForm((prev) => ({ ...prev, perks: prev.perks.filter((_, i) => i !== index) }));
  };

  const toggleCategory = (categoryId: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      categoryIds: checked
        ? [...prev.categoryIds, categoryId]
        : prev.categoryIds.filter((id) => id !== categoryId),
    }));
  };

  const create = async () => {
    setNameError(null);
    const name = form.name.trim();
    if (!name) {
      setNameError("Enter a sponsor name.");
      return;
    }

    const emails = form.emails.map((e) => e.trim()).filter((e) => e.length > 0);
    if (emails.length === 0) {
      setEmailErrors(form.emails.map((_, i) => (i === 0 ? "At least one email is required." : null)));
      return;
    }
    const errors = form.emails.map((e) => (e.trim() ? validateSponsorEmail(e) : null));
    if (errors.some(Boolean)) {
      setEmailErrors(errors);
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.rpc("admin_create_sponsor", {
      p_name: name,
      p_emails: emails,
      p_category_ids: form.categoryIds,
      p_perks: form.perks.map((p) => p.trim()).filter((p) => p.length > 0),
    });
    setBusy(false);

    if (error) {
      setNameError(
        error.code === "23505" ? "A sponsor with that name already exists." : error.message,
      );
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["admin"] });
    toast.success("Sponsor created.");
    close(false);
    if (data) navigate({ to: "/admin/sponsors/$sponsorSlug", params: { sponsorSlug: data.slug } });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Sponsor</DialogTitle>
          <DialogDescription>
            Create the sponsor, its contacts, resume access and perks all at once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-1.5">
            <Label htmlFor="sponsor-name">Sponsor name</Label>
            <Input
              id="sponsor-name"
              value={form.name}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, name: e.target.value }));
                setNameError(null);
              }}
              placeholder="Acme Inc."
              autoFocus
            />
            {nameError ? <p className="text-xs text-destructive">{nameError}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label>Contact emails</Label>
            <div className="space-y-2">
              {form.emails.map((email, index) => (
                <div key={index}>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => updateEmail(index, e.target.value)}
                      placeholder="contact@sponsor.com"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeEmail(index)}
                      disabled={form.emails.length === 1}
                      aria-label="Remove email"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {emailErrors[index] ? (
                    <p className="mt-1 text-xs text-destructive">{emailErrors[index]}</p>
                  ) : null}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setForm((prev) => ({ ...prev, emails: [...prev.emails, ""] }));
                setEmailErrors((prev) => [...prev, null]);
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Add email
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>Resume access</Label>
            {(categories ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No categories exist yet.</p>
            ) : (
              <div className="space-y-2 rounded-md border border-border p-3">
                {(categories ?? []).map((category) => (
                  <div key={category.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm">{category.name}</span>
                    <Switch
                      checked={form.categoryIds.includes(category.id)}
                      onCheckedChange={(checked) => toggleCategory(category.id, checked)}
                      aria-label={`Grant access to ${category.name}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Perks</Label>
            <div className="space-y-2">
              {form.perks.map((perk, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={perk}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        perks: prev.perks.map((p, i) => (i === index ? e.target.value : p)),
                      }))
                    }
                    placeholder="e.g. Logo on event banner"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removePerk(index)}
                    disabled={form.perks.length === 1}
                    aria-label="Remove perk"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setForm((prev) => ({ ...prev, perks: [...prev.perks, ""] }))}
            >
              <Plus className="h-3.5 w-3.5" /> Add perk
            </Button>
            <p className="text-xs text-muted-foreground">
              New perks start as "Not Redeemed." Update status from the sponsor's page.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => close(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void create()} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

