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

  const [createError, setCreateError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<Category | null>(null);
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const countFor = (id: string) => (resumes ?? []).filter((r) => r.category_id === id).length;

  const nextUntitledName = () => {
    const names = new Set((categories ?? []).map((category) => category.name.toLowerCase()));
    let index = 0;
    let candidate = "Untitled";
    while (names.has(candidate.toLowerCase())) {
      index += 1;
      candidate = `Untitled ${index}`;
    }
    return candidate;
  };

  const create = async () => {
    setCreateError(null);
    if ((categories ?? []).length >= MAX_CATEGORIES) {
      return setCreateError(`You can have at most ${MAX_CATEGORIES} categories.`);
    }
    setBusy(true);
    const initialName = nextUntitledName();
    const { data: created, error } = await supabase
      .from("categories")
      .insert({ name: initialName })
      .select()
      .single();
    setBusy(false);
    if (error) {
      setCreateError(
        error.code === "23505" ? "A category with that name already exists." : error.message,
      );
      return;
    }
    if (!created) {
      setCreateError("The category was created, but could not be opened for renaming.");
      return;
    }
    setRenameValue(initialName);
    setRenaming(created as Category);
    setPendingCategoryId(created.id);
    await queryClient.invalidateQueries({ queryKey: ["categories"] });
    toast.success("Category added. Enter a name to finish.");
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
    setPendingCategoryId(null);
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

      <div className="panel mt-6 overflow-hidden rounded-md shadow-none">
        <div className="hidden grid-cols-[minmax(0,1fr)_7rem_9rem] gap-3 border-b border-border px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
          <span>Category</span>
          <span>Resumes</span>
        </div>
      </div>

      <div className="h-3" aria-hidden="true" />

      <div className="panel overflow-hidden rounded-md shadow-none">
        {(categories ?? []).length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No categories yet.
          </p>
        ) : null}
        {(categories ?? []).map((category) => (
          <div
            key={category.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-5 py-4 transition-colors last:border-0 hover:bg-secondary/60 sm:grid-cols-[minmax(0,1fr)_7rem_9rem]"
          >
            <Link
              to="/admin/categories/$categoryId"
              params={{ categoryId: category.id }}
              className="group flex min-w-0 flex-1 items-center gap-2"
            >
              <div className="min-w-0">
                {renaming?.id === category.id ? (
                  <Input
                    value={renameValue}
                    onChange={(e) => {
                      setRenameValue(e.target.value);
                      setRenameError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void rename();
                      }
                      if (e.key === "Escape") {
                        if (pendingCategoryId === category.id) {
                          void supabase
                            .from("categories")
                            .delete()
                            .eq("id", category.id)
                            .then(() => {
                              setRenaming(null);
                              setPendingCategoryId(null);
                              void queryClient.invalidateQueries({ queryKey: ["categories"] });
                            });
                        } else {
                          setRenaming(null);
                        }
                      }
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onFocus={(e) => e.currentTarget.select()}
                    autoFocus
                    aria-label="Category name"
                    className="h-8 max-w-sm font-semibold"
                  />
                ) : (
                  <p className="truncate font-semibold text-foreground group-hover:text-primary">
                    {category.name}
                  </p>
                )}
                <p className="text-xs text-muted-foreground sm:hidden">
                  {countFor(category.id)} resume{countFor(category.id) === 1 ? "" : "s"}
                </p>
                {renaming?.id === category.id && renameError ? (
                  <p className="mt-1 text-xs text-destructive">{renameError}</p>
                ) : null}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
            <p className="hidden text-sm text-muted-foreground sm:block">{countFor(category.id)}</p>
            <div className="flex gap-2">
              {renaming?.id === category.id ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="shadow-none"
                  onClick={() => void rename()}
                  disabled={busy}
                >
                  Save
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="shadow-none"
                  onClick={() => {
                    setRenaming(category);
                    setPendingCategoryId(null);
                    setRenameValue(category.name);
                    setRenameError(null);
                  }}
                >
                  Rename
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive shadow-none hover:text-destructive"
                onClick={() => setDeleting(category)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Button
          onClick={() => void create()}
          disabled={busy}
          variant="outline"
          className="gap-2 shadow-none"
        >
          <Plus className="h-4 w-4" /> Add category
        </Button>
        {createError ? <p className="mt-2 text-xs text-destructive">{createError}</p> : null}
      </div>

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
