import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, FolderOpen, Loader2 } from "lucide-react";
import { sponsorCategoriesQuery, sponsorResumesQuery } from "@/lib/sponsor-queries";

export const Route = createFileRoute("/_sponsor/sponsor/resumes")({
  head: () => ({
    meta: [
      { title: "Resumes — Sponsor Portal" },
      { name: "description", content: "Browse the resume categories your team has access to." },
    ],
  }),
  component: SponsorResumesTab,
});

function SponsorResumesTab() {
  const { data: categories, isLoading } = useQuery(sponsorCategoriesQuery);
  const { data: resumes } = useQuery(sponsorResumesQuery);

  const countFor = (categoryId: string) =>
    (resumes ?? []).filter((r) => r.category_id === categoryId).length;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Resumes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Categories your team has been granted access to.
      </p>

      <div className="panel mt-6 divide-y divide-border overflow-hidden">
        {(categories ?? []).length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            You don't have access to any resume categories yet. Contact your Blueprint admin.
          </p>
        ) : null}
        {(categories ?? []).map((category) => (
          <Link
            key={category.id}
            to="/sponsor/resumes/$categoryId"
            params={{ categoryId: category.id }}
            className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-secondary/60"
          >
            <div className="flex items-center gap-3">
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-semibold text-foreground group-hover:text-primary">
                  {category.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {countFor(category.id)} resume{countFor(category.id) === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
