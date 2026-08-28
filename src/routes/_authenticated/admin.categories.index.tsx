import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { allResumesQuery, categoriesQuery, type Category } from "@/lib/queries";

const MAX_CATEGORIES = 20;

export const Route = createFileRoute("/_authenticated/admin/categories/")({
  head: () => ({
    meta: [
      { title: "UW Blueprint Sponsor Resume Book" },
      { name: "description", content: "Create, rename and delete resume categories for UW Blueprint." },
      { property: "og:title", content: "UW Blueprint Sponsor Resume Book" },
      { property: "og:description", content: "Create, rename and delete resume categories." },
    ],
  }),
  component: CategoriesTab,
});

function CategoriesTab() {
  const queryClient = useQueryClient();
  const { data: categories, isLoading } = useQuery(categoriesQuery);
  const { data: resumes } = useQuery(allResumesQuery);

  const [name, setName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<Category | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const countFor = (id: string) => (resumes ?? []).filter((r) => r.category_id === id).length;

  const create = async () => {
    setCreateError(null);
    const trimmed = name.trim();
    if (!trimmed) return setCreateError("Enter a category name.");
    if ((categories ?? []).length >= MAX_CATEGORIES) {
      return setCreateError(`You can have at most ${MAX_CATEGORIES} categories.`);
    }
    setBusy(true);
    const { data, error: debugError } = await supabase.rpc("debug_whoami");
    console.log(data, debugError);
    const { error } = await supabase.from("categories").insert({ name: trimmed });
    setBusy(false);
    if (error) {
      setCreateError(
        error.code === "23505" ? "A category with that name already exists." : error.message,
      );
      return;
    }
    setName("");
    await queryClient.invalidateQueries({ queryKey: ["categories"] });
    toast.success("Category created.");
  };

  

  const rename = async () => {
    if (!renaming) return;
    setRenameError(null);
    const trimmed = renameValue.trim();
    if (!trimmed) return setRenameError("Enter a category name.");
    setBusy(true);
    const { error } = await supabase
      .from("categories")
      .update({ name: trimmed })
      .eq("id", renaming.id);
    setBusy(false);
    if (error) {
      setRenameError(
        error.code === "23505" ? "A category with that name already exists." : error.message,
      );
      return;
    }
    setRenaming(null);
    await queryClient.invalidateQueries();
    toast.success("Category renamed.");
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const paths = (resumes ?? [])
        .filter((r) => r.category_id === deleting.id)
        .map((r) => r.file_path);
      if (paths.length > 0) await supabase.storage.from("resumes").remove(paths);
      const { error } = await supabase.from("categories").delete().eq("id", deleting.id);
      if (error) throw new Error(error.message);
      setDeleting(null);
      await queryClient.invalidateQueries();
      toast.success("Category deleted.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
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
      <h1 className="text-2xl font-bold text-foreground">Resume Categories</h1>

      <div className="panel mt-6 p-5">
        <label className="field-label">Create category</label>
        <div className="flex flex-wrap gap-3">
          <Input
            value={name}
            placeholder="e.g. Product Management"
            className="min-w-56 flex-1"
            onChange={(e) => {
              setName(e.target.value);
              setCreateError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && void create()}
          />
          <Button onClick={() => void create()} disabled={busy} className="gap-2">
            <Plus className="h-4 w-4" /> Create
          </Button>
        </div>
        {createError ? <p className="mt-2 text-xs text-destructive">{createError}</p> : null}
      </div>

      <div className="panel mt-6 divide-y divide-border">
        {(categories ?? []).length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            No categories yet.
          </p>
        ) : null}
        {(categories ?? []).map((category) => (
          <div key={category.id} className="flex items-center justify-between gap-3 px-5 py-4">
            <Link
              to="/admin/categories/$categoryId"
              params={{ categoryId: category.id }}
              className="group flex min-w-0 flex-1 items-center gap-2"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground group-hover:text-primary">
                  {category.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {countFor(category.id)} resume{countFor(category.id) === 1 ? "" : "s"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRenaming(category);
                  setRenameValue(category.name);
                  setRenameError(null);
                }}
              >
                Rename
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleting(category)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={Boolean(renaming)} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename category</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => {
              setRenameValue(e.target.value);
              setRenameError(null);
            }}
          />
          {renameError ? <p className="text-xs text-destructive">{renameError}</p> : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button onClick={() => void rename()} disabled={busy}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{deleting?.name}"?</DialogTitle>
            <DialogDescription>
              This permanently removes the category and {deleting ? countFor(deleting.id) : 0}{" "}
              resume{deleting && countFor(deleting.id) === 1 ? "" : "s"}. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void remove()} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
