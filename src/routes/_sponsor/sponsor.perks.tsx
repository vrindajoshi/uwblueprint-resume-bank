import { createFileRoute } from "@tanstack/react-router";
import { Gift } from "lucide-react";

// Perks tracking is its own separate PRD -- this is just a placeholder so the
// dashboard shell's three tabs (Perks/Resumes/Members) all resolve to something.
export const Route = createFileRoute("/_sponsor/sponsor/perks")({
  head: () => ({
    meta: [{ title: "Perks — Sponsor Portal" }],
  }),
  component: SponsorPerksTab,
});

function SponsorPerksTab() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Perks</h1>
      <div className="panel mt-6 flex flex-col items-center gap-3 px-5 py-16 text-center">
        <Gift className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Perks tracking is coming soon.</p>
      </div>
    </div>
  );
}
