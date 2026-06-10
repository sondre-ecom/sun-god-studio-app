import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { MEDIA_DIR } from "@/lib/store";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const sub = name.includes("__") ? name.replace("__", "/") : name;
  const p = path.join(MEDIA_DIR, sub);
  if (!p.startsWith(MEDIA_DIR) || !fs.existsSync(p)) return new Response("not found", { status: 404 });
  const ext = path.extname(p).toLowerCase();
  const data = fs.readFileSync(p);
  return new Response(new Uint8Array(data), {
    headers: { "content-type": TYPES[ext] || "application/octet-stream", "cache-control": "public, max-age=31536000, immutable" },
  });
}
