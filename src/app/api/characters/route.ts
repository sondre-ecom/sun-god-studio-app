import { NextRequest, NextResponse } from "next/server";
import { db, save, uid } from "@/lib/store";
import { importUrl } from "@/lib/hf";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const characters = db().characters.filter((c) => u.role === "admin" || c.ownerId === u.id || !c.ownerId);
  return NextResponse.json({ characters });
}

export async function POST(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const c = await req.json();
  let refMediaId: string | undefined;
  if (c.refUrl) {
    try {
      refMediaId = await importUrl(c.refUrl);
    } catch {}
  }
  const character = {
    id: uid(), name: c.name || "Character", brandId: c.brandId, ownerId: u.id,
    sheet: c.sheet || "", refUrl: c.refUrl, refMediaId, createdAt: Date.now(),
  };
  db().characters.push(character);
  save();
  return NextResponse.json({ character });
}

export async function PUT(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const c = await req.json();
  const ch = db().characters.find((x) => x.id === c.id);
  if (!ch) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (u.role !== "admin" && ch.ownerId && ch.ownerId !== u.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (c.refUrl && c.refUrl !== ch.refUrl) {
    ch.refMediaId = undefined;
    try {
      ch.refMediaId = await importUrl(c.refUrl);
    } catch {}
  }
  Object.assign(ch, { name: c.name ?? ch.name, sheet: c.sheet ?? ch.sheet, brandId: c.brandId ?? ch.brandId, refUrl: c.refUrl ?? ch.refUrl });
  save();
  return NextResponse.json({ character: ch });
}

export async function DELETE(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  const d = db();
  const ch = d.characters.find((x) => x.id === id);
  if (ch && u.role !== "admin" && ch.ownerId && ch.ownerId !== u.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  d.characters = d.characters.filter((x) => x.id !== id);
  save();
  return NextResponse.json({ ok: true });
}
