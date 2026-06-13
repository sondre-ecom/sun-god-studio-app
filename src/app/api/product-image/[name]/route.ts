import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { PRODUCTS_DIR } from "@/lib/store";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
};

// PUBLIC (allow-listed in middleware): product photos are non-sensitive and must be fetchable
// by Higgsfield's servers so they can be imported as a generation reference. Filenames are random.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const p = path.join(PRODUCTS_DIR, path.basename(name));
  if (!p.startsWith(PRODUCTS_DIR) || !fs.existsSync(p)) return new Response("not found", { status: 404 });
  const ext = path.extname(p).toLowerCase();
  const data = fs.readFileSync(p);
  return new Response(new Uint8Array(data), {
    headers: { "content-type": TYPES[ext] || "application/octet-stream", "cache-control": "public, max-age=86400" },
  });
}
