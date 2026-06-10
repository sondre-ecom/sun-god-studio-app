import { NextRequest, NextResponse } from "next/server";
import { db, save, uid } from "@/lib/store";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const brands = db().brands.filter((b) => u.role === "admin" || b.ownerId === u.id || !b.ownerId);
  return NextResponse.json({ brands });
}

export async function POST(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json();
  const brand = { id: uid(), name: b.name || "Untitled brand", context: b.context || "", ownerId: u.id, createdAt: Date.now() };
  db().brands.push(brand);
  save();
  return NextResponse.json({ brand });
}

export async function PUT(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json();
  const brand = db().brands.find((x) => x.id === b.id);
  if (!brand) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (u.role !== "admin" && brand.ownerId && brand.ownerId !== u.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  Object.assign(brand, { name: b.name ?? brand.name, context: b.context ?? brand.context });
  save();
  return NextResponse.json({ brand });
}

export async function DELETE(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  const d = db();
  const brand = d.brands.find((x) => x.id === id);
  if (brand && u.role !== "admin" && brand.ownerId && brand.ownerId !== u.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  d.brands = d.brands.filter((x) => x.id !== id);
  save();
  return NextResponse.json({ ok: true });
}
