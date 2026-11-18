// Shared helpers for the payment functions. Ported from dhequest checkout.middleware.ts
// (generateSignature / signatureMatches) to Web Crypto.
import { createClient } from "jsr:@supabase/supabase-js@2";

export const KEY_ID = Deno.env.get("RAZOR_PAY_KEY") ?? "";
export const KEY_SECRET = Deno.env.get("RAZOR_PAY_SECRET") ?? "";
export const WEBHOOK_SECRET = Deno.env.get("RAZOR_PAY_WEBHOOK_SECRET") || KEY_SECRET;
// No secret configured = local dev: payments are simulated.
export const MOCK = !KEY_SECRET;

export const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

export const preflight = (req: Request) => (req.method === "OPTIONS" ? new Response("ok", { headers: cors }) : null);

export async function userFrom(req: Request) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data } = await admin.auth.getUser(token);
  return data.user;
}

export async function hmacHex(secret: string, data: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: unknown) {
  if (typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
