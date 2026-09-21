import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import {
  sponsorCategoriesQuery,
  sponsorMembersQuery,
  sponsorResumesQuery,
  sponsorSignedUrlFor,
} from "@/lib/sponsor-queries";
import { getSponsorShuffleSeed } from "@/lib/sponsor-session";
import { seededShuffle } from "@/lib/shuffle";

export const Route = createFileRoute("/_sponsor/sponsor/resumes/$categoryId")({
  head: () => ({
    meta: [{ title: "Resumes — Sponsor Portal" }],
  }),
  component: SponsorCategoryDetail,
});

function SponsorCategoryDetail() {
  const { categoryId } = Route.useParams();
  const { data: categories } = useQuery(sponsorCategoriesQuery);
  const { data: resumes } = useQuery(sponsorResumesQuery);
  const { data: members } = useQuery(sponsorMembersQuery);
  const [exporting, setExporting] = useState(false);

  const category = (categories ?? []).find((c) => c.id === categoryId);

  const rows = useMemo(() => {
    const matches = (resumes ?? [])
      .filter((r) => r.category_id === categoryId)
      .map((r) => ({ ...r, member: (members ?? []).find((m) => m.id === r.member_id) }))
      .filter((r): r is typeof r & { member: NonNullable<typeof r.member> } => Boolean(r.member));
    // Randomized once per sponsor session (stable seed persisted at login) so
    // browsing feels fair across members, but doesn't reshuffle on reload.
    return seededShuffle(matches, getSponsorShuffleSeed(), (r) => r.id);
  }, [resumes, members, categoryId]);

  const runExport = async () => {
    if (rows.length === 0) return;
    setExporting(true);
    try {
      const zip = new JSZip();
      for (const row of rows) {
        const url = await sponsorSignedUrlFor(row.file_path);
        const blob = await (await fetch(url)).blob();
        const safe = `${row.member.first_name}${row.member.last_name}`.replace(/[^a-z0-9]/gi, "");
        const cat = (category?.name ?? "Resume").replace(/[^a-z0-9]/gi, "");
        zip.file(`${safe}_${cat}_Resume.pdf`, blob);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${(category?.name ?? "resumes").replace(/[^a-z0-9]/gi, "")}_Resumes.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(`Exported ${rows.length} resume(s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  if (!categories || !resumes || !members) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!category) {
    return (
      <div>
        <nav className="text-sm text-muted-foreground">
          <Link to="/sponsor/resumes" className="hover:text-foreground">
            Resumes
          </Link>
        </nav>
        <p className="mt-6 text-sm text-muted-foreground">
          Category not found, or you don't have access to it.
        </p>
      </div>
    );
  }

  return (
    <div>
      <nav className="text-sm text-muted-foreground">
        <Link to="/sponsor/resumes" className="hover:text-foreground">
          Resumes
        </Link>
        <span className="px-1.5">/</span>
        <span className="font-medium text-foreground">{category.name}</span>
      </nav>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => void runExport()}
          disabled={rows.length === 0 || exporting}
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export All as ZIP
        </Button>
        <p className="text-sm text-muted-foreground">
          {rows.length} resume{rows.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="panel mt-6 divide-y divide-border">
        {rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            No resumes in this category yet.
          </p>
        ) : null}
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3 px-5 py-4">
            <p className="truncate font-semibold text-foreground">
              {row.member.first_name} {row.member.last_name}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  window.open(await sponsorSignedUrlFor(row.file_path), "_blank", "noopener");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed to open.");
                }
              }}
            >
              View
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
