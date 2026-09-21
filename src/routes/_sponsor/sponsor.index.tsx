import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_sponsor/sponsor/")({
  beforeLoad: () => {
    throw redirect({ to: "/sponsor/resumes" });
  },
});
