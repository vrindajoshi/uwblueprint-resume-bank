import { queryOptions, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapSession } from "./resume.functions";

export type SessionInfo = Awaited<ReturnType<typeof bootstrapSession>>;

export const sessionQuery = queryOptions({
  queryKey: ["session-bootstrap"],
  queryFn: async (): Promise<SessionInfo> => bootstrapSession(),
  staleTime: 60_000,
  retry: false,
});

export function useSessionInfo() {
  return useQuery(sessionQuery);
}

export function useSignOut() {
  const navigate = useNavigate();
  return async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export function validateResumeFile(file: File): string | null {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return "Only PDF files are accepted.";
  }
  if (file.size > MAX_RESUME_BYTES) return "File must be 5MB or smaller.";
  return null;
}

export function isValidUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
