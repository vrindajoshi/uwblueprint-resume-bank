import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FileText, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { MemberEditor } from "@/components/MemberEditor";
import { Button } from "@/components/ui/button";
import { useSessionInfo } from "@/lib/session";
import { categoriesQuery, myMemberQuery, myResumesQuery, signedUrlFor } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My profile — UW Blueprint Resume Hub" },
      { name: "description", content: "View and update your UW Blueprint member profile and resumes." },
      { property: "og:title", content: "My profile — UW Blueprint Resume Hub" },
      { property: "og:description", content: "View and update your member profile and resumes." },
    ],
  }),
  component: ProfilePage,
});

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-4 last:border-0 sm:flex-row sm:items-center">
      <p className="w-40 shrink-0 text-sm font-semibold text-muted-foreground">{label}</p>
      {value ? (
        value.startsWith("http") ? (
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="truncate text-sm font-medium text-primary hover:underline"
          >
            {value}
          </a>
        ) : (
          <p className="text-sm text-foreground">{value}</p>
        )
      ) : (
        <p className="text-sm text-muted-foreground">Not provided</p>
      )}
    </div>
  );
}

function ProfilePage() {
  const navigate = useNavigate();
  const { data: session } = useSessionInfo();
  const email = session?.email ?? "";
  const { data: member } = useQuery(myMemberQuery(email));
  const { data: categories } = useQuery(categoriesQuery);
  const { data: resumes } = useQuery(myResumesQuery(member?.id));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (session?.isAdmin) navigate({ to: "/admin/members", replace: true });
  }, [session, navigate]);

  const openResume = async (path: string) => {
    try {
      window.open(await signedUrlFor(path), "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open the file.");
    }
  };

  if (!member || !categories) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader email={member.email} subtitle="Member profile" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold text-foreground">
          {member.first_name} {member.last_name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {editing ? "Editing your profile" : "Your saved profile"}
        </p>

        <div className="mt-8">
          {editing ? (
            <MemberEditor
              member={member}
              categories={categories}
              resumes={resumes ?? []}
              saveLabel="Save changes"
              onCancel={() => setEditing(false)}
              onSaved={() => setEditing(false)}
            />
          ) : (
            <div className="space-y-8">
              <section className="panel px-6 py-2">
                <Row label="Name" value={`${member.first_name} ${member.last_name}`} />
                <Row label="Email" value={member.email} />
                <Row label="LinkedIn" value={member.linkedin_url} />
                <Row label="GitHub" value={member.github_url} />
                <Row label="Portfolio" value={member.portfolio_url} />
              </section>

              <section className="panel p-6">
                <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  Resumes
                </h2>
                <div className="mt-5 space-y-3">
                  {categories.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No categories yet.</p>
                  ) : null}
                  {categories.map((category) => {
                    const resume = (resumes ?? []).find((r) => r.category_id === category.id);
                    return (
                      <div
                        key={category.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">{category.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {resume
                              ? `${member.first_name}${member.last_name}_${category.name}_Resume.pdf`
                              : "No resume uploaded"}
                          </p>
                        </div>
                        {resume ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => void openResume(resume.file_path)}
                          >
                            <FileText className="h-4 w-4" /> View
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
        </div>
      </main>

      {!editing ? (
        <Button
          size="lg"
          onClick={() => setEditing(true)}
          className="fixed bottom-8 left-8 gap-2 rounded-full shadow-lg"
        >
          <Pencil className="h-4 w-4" /> Edit
        </Button>
      ) : null}
    </div>
  );
}
