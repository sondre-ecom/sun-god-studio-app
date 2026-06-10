/**
 * Edge-safe stateless sessions. Signed with AUTH_SECRET via Web Crypto HMAC so the
 * SAME code verifies in both middleware (edge) and route handlers (node).
 * Token = base64url(payload) "." base64url(hmac). Payload = { uid, exp }.
 */

export const SESSION_COOKIE = "sg_session";

function secret(): string {
  return process.env.AUTH_SECRET || "sun-god-dev-secret-change-me";
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

export async function createToken(uid: string, days = 14): Promise<string> {
  const payload = b64urlEncode(new TextEncoder().encode(JSON.stringify({ uid, exp: Date.now() + days * 864e5 })));
  const sig = b64urlEncode(await hmac(payload));
  return `${payload}.${sig}`;
}

export async function verifyToken(token: string | undefined | null): Promise<string | null> {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  try {
    const expected = b64urlEncode(await hmac(payload));
    if (expected !== sig) return null;
    const data = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as { uid: string; exp: number };
    if (!data.uid || typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return data.uid;
  } catch {
    return null;
  }
}
