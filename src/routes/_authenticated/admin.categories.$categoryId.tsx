import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  allMembersQuery,
  allResumesQuery,
  categoriesQuery,
  signedUrlFor,
  termOf,
} from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/categories/$categoryId")({
  head: () => ({
    meta: [
      { title: "UW Blueprint Sponsor Resumes Books" },
      { name: "description", content: "Review and export the resumes submitted for a category." },
      { property: "og:title", content: "UW Blueprint Sponsor Resume Book" },
      { property: "og:description", content: "Review and export the resumes submitted for a category." },
    ],
  }),
  component: CategoryDetail,
});

function CategoryDetail() {
  const { categoryId } = Route.useParams();
  const { data: categories } = useQuery(categoriesQuery);
  const { data: resumes } = useQuery(allResumesQuery);
  const { data: members } = useQuery(allMembersQuery);

  const [exportOpen, setExportOpen] = useState(false);
  const [selectedTerms, setSelectedTerms] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  const category = (categories ?? []).find((c) => c.id === categoryId);

  const rows = useMemo(() => {
    return (resumes ?? [])
      .filter((r) => r.category_id === categoryId)
      .map((r) => ({
        ...r,
        member: (members ?? []).find((m) => m.id === r.member_id),
        term: termOf(r.uploaded_at),
      }))
      .sort((a, b) => (a.uploaded_at < b.uploaded_at ? 1 : -1));
  }, [resumes, members, categoryId]);

  const terms = useMemo(() => Array.from(new Set(rows.map((r) => r.term))).sort(), [rows]);

  const runExport = async () => {
    const picked = rows.filter((r) => selectedTerms.includes(r.term) && r.member);
    if (picked.length === 0) {
      toast.error("Select at least one term with resumes.");
      return;
    }
    setExporting(true);
    try {
      const zip = new JSZip();
      for (const row of picked) {
        const url = await signedUrlFor(row.file_path);
        const blob = await (await fetch(url)).blob();
        const safe = `${row.member!.first_name}${row.member!.last_name}`.replace(/[^a-z0-9]/gi, "");
        const cat = (category?.name ?? "Resume").replace(/[^a-z0-9]/gi, "");
        zip.file(`${safe}_${cat}_Resume.pdf`, blob);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${(category?.name ?? "resumes").replace(/[^a-z0-9]/gi, "")}_Resumes.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
      setExportOpen(false);
      toast.success(`Exported ${picked.length} resume(s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  if (!categories || !resumes) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <nav className="text-sm text-muted-foreground">
        <Link to="/admin/categories" className="hover:text-foreground">
          Categories
        </Link>
        <span className="px-1.5">/</span>
        <span className="font-medium text-foreground">{category?.name ?? "Unknown"}</span>
      </nav>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => {
            setSelectedTerms(terms);
            setExportOpen(true);
          }}
          disabled={rows.length === 0}
        >
          <Download className="h-4 w-4" /> Export All as ZIP
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
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">
                {row.member ? `${row.member.first_name} ${row.member.last_name}` : "Unknown member"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {row.member?.email} · {row.term}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  window.open(await signedUrlFor(row.file_path), "_blank", "noopener");
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

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export resumes</DialogTitle>
            <DialogDescription>Choose which terms to include in the ZIP.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {terms.map((term) => (
              <label key={term} className="flex items-center gap-3 text-sm">
                <Checkbox
                  checked={selectedTerms.includes(term)}
                  onCheckedChange={(checked) =>
                    setSelectedTerms((prev) =>
                      checked ? [...prev, term] : prev.filter((t) => t !== term),
                    )
                  }
                />
                <span className="font-medium">{term}</span>
                <span className="text-muted-foreground">
                  ({rows.filter((r) => r.term === term).length})
                </span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void runExport()} disabled={exporting}>
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Download ZIP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
