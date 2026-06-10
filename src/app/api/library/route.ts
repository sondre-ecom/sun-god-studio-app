import { NextRequest, NextResponse } from "next/server";
import { db, save } from "@/lib/store";
import { mediaUrl } from "@/lib/serialize";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const kind = req.nextUrl.searchParams.get("kind"); // image | video | null
  const fav = req.nextUrl.searchParams.get("fav");
  let items = db()
    .library.filter((m) => u.role === "admin" || m.ownerId === u.id || !m.ownerId)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt);
  if (kind === "image" || kind === "video") items = items.filter((m) => m.kind === kind);
  if (fav === "1") items = items.filter((m) => m.favorite);
  return NextResponse.json({ items: items.map((m) => ({ ...m, src: mediaUrl(m.localPath) })) });
}

export async function PATCH(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, favorite } = await req.json();
  const m = db().library.find((x) => x.id === id);
  if (!m) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (u.role !== "admin" && m.ownerId && m.ownerId !== u.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  m.favorite = !!favorite;
  save();
  return NextResponse.json({ ok: true });
}
