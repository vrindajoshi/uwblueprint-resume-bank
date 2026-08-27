import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { uploadResume } from "@/lib/resume.functions";
import { fileToBase64, isValidUrl, validateResumeFile } from "@/lib/session";
import type { Category, Member, Resume } from "@/lib/queries";

type Props = {
  member: Member;
  categories: Category[];
  resumes: Resume[];
  saveLabel?: string;
  onCancel?: () => void;
  onSaved: () => void;
};

export function MemberEditor({
  member,
  categories,
  resumes,
  saveLabel = "Save",
  onCancel,
  onSaved,
}: Props) {
  const queryClient = useQueryClient();
  const [links, setLinks] = useState({
    linkedin_url: member.linkedin_url ?? "",
    github_url: member.github_url ?? "",
    portfolio_url: member.portfolio_url ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [saving, setSaving] = useState(false);

  const existingFor = (categoryId: string) => resumes.find((r) => r.category_id === categoryId);

  const pickFile = (categoryId: string, file: File | undefined) => {
    if (!file) return;
    const error = validateResumeFile(file);
    setErrors((prev) => ({ ...prev, [categoryId]: error ?? "" }));
    if (error) return;
    setFiles((prev) => ({ ...prev, [categoryId]: file }));
  };

  const save = async () => {
    const nextErrors: Record<string, string> = {};
    (["linkedin_url", "github_url", "portfolio_url"] as const).forEach((key) => {
      if (!isValidUrl(links[key])) nextErrors[key] = "Enter a valid URL (https://…).";
    });
    Object.entries(errors).forEach(([k, v]) => {
      if (v) nextErrors[k] = v;
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("members")
        .update({
          linkedin_url: links.linkedin_url.trim() || null,
          github_url: links.github_url.trim() || null,
          portfolio_url: links.portfolio_url.trim() || null,
        })
        .eq("id", member.id);
      if (error) throw new Error(error.message);

      for (const [categoryId, file] of Object.entries(files)) {
        const fileBase64 = await fileToBase64(file);
        await uploadResume({ data: { categoryId, fileBase64 } });
      }

      await queryClient.invalidateQueries();
      toast.success("Profile saved.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="panel p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Your details
        </h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="field-label">First name</label>
            <Input value={member.first_name} disabled />
          </div>
          <div>
            <label className="field-label">Last name</label>
            <Input value={member.last_name} disabled />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">Email</label>
            <Input value={member.email} disabled />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Contact an admin to correct your name.
        </p>
      </section>

      <section className="panel p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Links</h2>
        <div className="mt-5 space-y-5">
          {(
            [
              ["linkedin_url", "LinkedIn", "https://linkedin.com/in/…"],
              ["github_url", "GitHub", "https://github.com/…"],
              ["portfolio_url", "Portfolio", "https://…"],
            ] as const
          ).map(([key, label, placeholder]) => (
            <div key={key}>
              <label className="field-label">
                {label} <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Input
                value={links[key]}
                placeholder={placeholder}
                onChange={(e) => setLinks((prev) => ({ ...prev, [key]: e.target.value }))}
                aria-invalid={Boolean(errors[key])}
              />
              {errors[key] ? (
                <p className="mt-1.5 text-xs text-destructive">{errors[key]}</p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Resumes
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF only, 5MB max. Each category is optional and uploading replaces any previous file.
        </p>
        <div className="mt-5 space-y-3">
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categories have been created yet.</p>
          ) : null}
          {categories.map((category) => {
            const existing = existingFor(category.id);
            const staged = files[category.id];
            return (
              <div
                key={category.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{category.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {staged ? (
                      <span className="text-primary">{staged.name} (pending save)</span>
                    ) : existing ? (
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3 w-3" /> Uploaded
                      </span>
                    ) : (
                      "No resume uploaded"
                    )}
                  </p>
                  {errors[category.id] ? (
                    <p className="mt-1 text-xs text-destructive">{errors[category.id]}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {staged ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setFiles((prev) => {
                          const next = { ...prev };
                          delete next[category.id];
                          return next;
                        })
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  ) : null}
                  <label>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="sr-only"
                      onChange={(e) => pickFile(category.id, e.target.files?.[0])}
                    />
                    <span className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-accent">
                      <Upload className="h-4 w-4" />
                      {existing || staged ? "Replace" : "Upload"}
                    </span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex justify-end gap-3">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        ) : null}
        <Button onClick={() => void save()} disabled={saving} size="lg" className="min-w-32">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
