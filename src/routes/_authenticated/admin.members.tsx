import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  allMembersQuery,
  allResumesQuery,
  categoriesQuery,
  signedUrlFor,
  termLabel,
  type MemberWithTerm,
} from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/members")({
  head: () => ({
    meta: [
      { title: "Members — UW Blueprint Admin" },
      { name: "description", content: "Browse, search and manage UW Blueprint member profiles and resumes." },
      { property: "og:title", content: "Members — UW Blueprint Admin" },
      { property: "og:description", content: "Browse, search and manage member profiles and resumes." },
    ],
  }),
  component: MembersTab,
});

function MembersTab() {
  const queryClient = useQueryClient();
  const { data: members, isLoading } = useQuery(allMembersQuery);
  const { data: resumes } = useQuery(allResumesQuery);
  const { data: categories } = useQuery(categoriesQuery);

  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [detail, setDetail] = useState<MemberWithTerm | null>(null);
  const [deleting, setDeleting] = useState(false);

  const resumeCount = (memberId: string) =>
    (resumes ?? []).filter((r) => r.member_id === memberId).length;

  const terms = useMemo(
    () => Array.from(new Set((members ?? []).map(termLabel))).sort(),
    [members],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (members ?? [])
      .filter((m) => (term === "all" ? true : termLabel(m) === term))
      .filter((m) =>
        q
          ? `${m.first_name} ${m.last_name} ${m.email}`.toLowerCase().includes(q)
          : true,
      )
      .sort((a, b) => (a.term_basis_date < b.term_basis_date ? 1 : -1));
  }, [members, search, term]);

  const selectedResumeCount = selected.reduce((sum, id) => sum + resumeCount(id), 0);

  const bulkDelete = async () => {
    setDeleting(true);
    try {
      const paths = (resumes ?? [])
        .filter((r) => selected.includes(r.member_id))
        .map((r) => r.file_path);
      if (paths.length > 0) await supabase.storage.from("resumes").remove(paths);
      const { error } = await supabase.from("members").delete().in("id", selected);
      if (error) throw new Error(error.message);
      toast.success(`Deleted ${selected.length} member(s).`);
      setSelected([]);
      setConfirmOpen(false);
      await queryClient.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeleting(false);
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Members</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} of {(members ?? []).length} members
          </p>
        </div>
        {selected.length > 0 ? (
          <Button variant="destructive" className="gap-2" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="h-4 w-4" /> Delete {selected.length} selected
          </Button>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="pl-9"
          />
        </div>
        <Select value={term} onValueChange={setTerm}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All terms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All terms</SelectItem>
            {terms.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="panel mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="w-10 px-4 py-3">
                <Checkbox
                  checked={rows.length > 0 && selected.length === rows.length}
                  onCheckedChange={(checked) =>
                    setSelected(checked ? rows.map((r) => r.id) : [])
                  }
                  aria-label="Select all"
                />
              </th>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Term</th>
              <th className="px-4 py-3 font-semibold">LinkedIn</th>
              <th className="px-4 py-3 font-semibold">GitHub</th>
              <th className="px-4 py-3 font-semibold">Resumes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr
                key={m.id}
                className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-secondary/60"
                onClick={() => setDetail(m)}
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selected.includes(m.id)}
                    onCheckedChange={(checked) =>
                      setSelected((prev) =>
                        checked ? [...prev, m.id] : prev.filter((id) => id !== m.id),
                      )
                    }
                    aria-label={`Select ${m.first_name}`}
                  />
                </td>
                <td className="px-4 py-3 font-medium text-foreground">
                  {m.first_name} {m.last_name}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{termLabel(m)}</td>
                <td className="px-4 py-3">
                  {m.linkedin_url ? (
                    <a
                      href={m.linkedin_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Link
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {m.github_url ? (
                    <a
                      href={m.github_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Link
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{resumeCount(m.id)}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  No members match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete members?</DialogTitle>
            <DialogDescription>
              This will permanently delete {selected.length} member
              {selected.length === 1 ? "" : "s"} and {selectedResumeCount} resume
              {selectedResumeCount === 1 ? "" : "s"}. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={() => void bulkDelete()}>
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent>
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {detail.first_name} {detail.last_name}
                </DialogTitle>
                <DialogDescription>
                  {detail.email} · {termLabel(detail)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="space-y-1">
                  {(
                    [
                      ["LinkedIn", detail.linkedin_url],
                      ["GitHub", detail.github_url],
                      ["Portfolio", detail.portfolio_url],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="flex gap-3">
                      <span className="w-20 text-muted-foreground">{label}</span>
                      {value ? (
                        <a
                          href={value}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-primary hover:underline"
                        >
                          {value}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Not provided</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Resumes
                  </p>
                  {(resumes ?? []).filter((r) => r.member_id === detail.id).length === 0 ? (
                    <p className="text-muted-foreground">No resumes uploaded.</p>
                  ) : null}
                  {(resumes ?? [])
                    .filter((r) => r.member_id === detail.id)
                    .map((r) => {
                      const name =
                        (categories ?? []).find((c) => c.id === r.category_id)?.name ?? "Resume";
                      return (
                        <div
                          key={r.id}
                          className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                        >
                          <span className="font-medium">{name}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                window.open(
                                  await signedUrlFor(r.file_path),
                                  "_blank",
                                  "noopener",
                                );
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : "Failed to open.");
                              }
                            }}
                          >
                            View
                          </Button>
                        </div>
                      );
                    })}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
