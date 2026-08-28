import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { MemberEditor } from "@/components/MemberEditor";
import { useSessionInfo } from "@/lib/session";
import { categoriesQuery, myMemberQuery, myResumesQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "UW Blueprint Sponsor Resume Book" },
      { name: "description", content: "Complete your UW Blueprint member profile and upload your resumes." },
      { property: "og:title", content: "UW Blueprint Sponsor Resume Book" },
      { property: "og:description", content: "Complete your member profile and upload your resumes." },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const { data: session } = useSessionInfo();
  const email = session?.email ?? "";
  const { data: member } = useQuery(myMemberQuery(email));
  const { data: categories } = useQuery(categoriesQuery);
  const { data: resumes } = useQuery(myResumesQuery(member?.id));
  const [greeting, setGreeting] = useState(true);

  useEffect(() => {
    if (!member) return;
    const timer = setTimeout(() => setGreeting(false), 2200);
    return () => clearTimeout(timer);
  }, [member]);

  useEffect(() => {
    if (session?.isAdmin) navigate({ to: "/admin/members", replace: true });
  }, [session, navigate]);

  if (!member || !categories) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (greeting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <div className="animate-in fade-in zoom-in-95 duration-700">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            UW Blueprint
          </p>
          <h1 className="mt-4 text-4xl font-extrabold text-foreground sm:text-5xl">
            Welcome, {member.first_name}
          </h1>
          <p className="mt-4 animate-in fade-in text-muted-foreground delay-300 duration-1000">
            Let's set up your resume profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader email={member.email} subtitle="Member onboarding" />
      <main className="mx-auto max-w-3xl px-6 py-10 animate-in fade-in duration-500">
        <h1 className="text-2xl font-bold text-foreground">Set up your profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add your links and upload a resume for any categories that apply to you.
        </p>
        <div className="mt-8">
          <MemberEditor
            member={member}
            categories={categories}
            resumes={resumes ?? []}
            saveLabel="Save profile"
            onSaved={() => navigate({ to: "/profile", replace: true })}
          />
        </div>
      </main>
    </div>
  );
}
