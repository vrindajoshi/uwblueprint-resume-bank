import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
globalThis.WebSocket ??= WebSocket;

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

const { data, error } = await anon.auth.resetPasswordForEmail("vrindajoshi30@gmail.com", {
  redirectTo: "https://uwblueprint-resume-bank.vercel.app/sponsors/reset-password",
});
console.log("data:", JSON.stringify(data));
console.log("error:", error ? JSON.stringify({ message: error.message, status: error.status, code: error.code }) : null);
