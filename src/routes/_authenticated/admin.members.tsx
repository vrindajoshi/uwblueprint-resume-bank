import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search, Trash2 } from "lucide-react";
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

const MEMBERS_PER_PAGE = 50;

export const Route = createFileRoute("/_authenticated/admin/members")({
  head: () => ({
    meta: [
      { title: "UW Blueprint Sponsor Resume Book" },
      { name: "description", content: "Browse, search and manage UW Blueprint member profiles and resumes." },
      { property: "og:title", content: "UW Blueprint Sponsor Resume Book" },
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
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [detail, setDetail] = useState<MemberWithTerm | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);

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

  useEffect(() => {
    setPage(1);
  }, [search, term]);

  const totalPages = Math.max(1, Math.ceil(rows.length / MEMBERS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = rows.slice(
    (currentPage - 1) * MEMBERS_PER_PAGE,
    currentPage * MEMBERS_PER_PAGE,
  );

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

  const deleteMember = (memberId: string) => {
    setSelected([memberId]);
    setConfirmOpen(true);
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
        <div className="flex items-center gap-2">
          {selectMode && selected.length > 0 ? (
            <Button
              variant="destructive"
              size="lg"
              className="gap-2"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4" /> Delete {selected.length} selected
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setSelectMode((previous) => !previous);
              setSelected([]);
            }}
          >
            {selectMode ? "Cancel" : "Select"}
          </Button>
        </div>
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

      <div className="panel mt-6 overflow-hidden">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            {selectMode ? <col style={{ width: "4rem" }} /> : null}
            <col style={{ width: selectMode ? "calc((100% - 4rem) * 0.5)" : "50%" }} />
            <col style={{ width: selectMode ? "calc((100% - 4rem) * 0.25)" : "25%" }} />
            <col style={{ width: selectMode ? "calc((100% - 4rem) * 0.25)" : "12.5%" }} />
            {!selectMode ? <col style={{ width: "12.5%" }} /> : null}
          </colgroup>
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              {selectMode ? (
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    checked={
                      paginatedRows.length > 0 &&
                      paginatedRows.every((member) => selected.includes(member.id))
                    }
                    onCheckedChange={(checked) =>
                      setSelected((previous) => {
                        const pageIds = paginatedRows.map((member) => member.id);
                        return checked
                          ? Array.from(new Set([...previous, ...pageIds]))
                          : previous.filter((id) => !pageIds.includes(id));
                      })
                    }
                    aria-label="Select all"
                    className="!rounded-sm !shadow-none"
                  />
                </th>
              ) : null}
              <th className="px-4 py-3 font-bold">Name</th>
              <th className="px-4 py-3 font-bold">Term</th>
              <th className="px-4 py-3 font-bold">Resumes</th>
            </tr>
          </thead>
        </table>
      </div>

      <div className="h-3" aria-hidden="true" />

      <div className="panel overflow-hidden">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            {selectMode ? <col style={{ width: "4rem" }} /> : null}
            <col style={{ width: selectMode ? "calc((100% - 4rem) * 0.5)" : "50%" }} />
            <col style={{ width: selectMode ? "calc((100% - 4rem) * 0.25)" : "25%" }} />
            <col style={{ width: selectMode ? "calc((100% - 4rem) * 0.25)" : "12.5%" }} />
            {!selectMode ? <col style={{ width: "12.5%" }} /> : null}
          </colgroup>
          <tbody>
            {paginatedRows.map((m) => (
              <tr
                key={m.id}
                className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-secondary/60"
                onClick={() => setDetail(m)}
              >
                {selectMode ? (
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.includes(m.id)}
                      onCheckedChange={(checked) =>
                        setSelected((prev) =>
                          checked ? [...prev, m.id] : prev.filter((id) => id !== m.id),
                        )
                      }
                      aria-label={`Select ${m.first_name}`}
                      className="!rounded-sm !shadow-none"
                    />
                  </td>
                ) : null}
                <td className="px-4 py-3 font-medium text-foreground">
                  {m.first_name} {m.last_name}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{termLabel(m)}</td>
                <td className="px-4 py-3 text-muted-foreground">{resumeCount(m.id)}</td>
                {!selectMode ? (
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground shadow-none hover:text-destructive"
                      onClick={() => deleteMember(m.id)}
                      aria-label={`Delete ${m.first_name} ${m.last_name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={selectMode ? 4 : 4} className="px-4 py-12 text-center text-muted-foreground">
                  No members match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((previous) => Math.max(1, previous - 1))}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
              disabled={currentPage === totalPages}
              aria-label="Next page"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selected.length === 1
                ? `Delete "${members?.find((member) => member.id === selected[0])?.first_name ?? ""} ${members?.find((member) => member.id === selected[0])?.last_name ?? ""}"?`
                : "Delete members?"}
            </DialogTitle>
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
