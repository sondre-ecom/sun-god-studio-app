"use client";

export async function jget<T = any>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || r.statusText);
  return d;
}

export async function jsend<T = any>(url: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || r.statusText);
  return d;
}

export const jpost = <T = any>(url: string, body?: unknown) => jsend<T>(url, "POST", body);
export const jpatch = <T = any>(url: string, body?: unknown) => jsend<T>(url, "PATCH", body);
export const jput = <T = any>(url: string, body?: unknown) => jsend<T>(url, "PUT", body);
export const jdel = <T = any>(url: string) => jsend<T>(url, "DELETE");
