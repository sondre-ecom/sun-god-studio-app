import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { db, save, uid, PRODUCTS_DIR, Brand } from "@/lib/store";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Save a base64 data URL (data:image/png;base64,...) into PRODUCTS_DIR; returns the filename. */
function saveProductDataUrl(dataUrl: string): string | null {
  const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const ext = m[1].toLowerCase().replace("jpeg", "jpg");
  const buf = Buffer.from(m[2], "base64");
  fs.mkdirSync(PRODUCTS_DIR, { recursive: true });
  const name = `${uid()}.${ext}`;
  fs.writeFileSync(path.join(PRODUCTS_DIR, name), buf);
  return name;
}

function withUrls(b: Brand) {
  return { ...b, productImageUrl: b.productImage ? `/api/product-image/${b.productImage}` : undefined };
}

export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const brands = db().brands.filter((b) => u.role === "admin" || b.ownerId === u.id || !b.ownerId).map(withUrls);
  return NextResponse.json({ brands });
}

export async function POST(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json();
  const brand: Brand = { id: uid(), name: b.name || "Untitled brand", context: b.context || "", voc: b.voc || "", ownerId: u.id, createdAt: Date.now() };
  if (b.productImageDataUrl) brand.productImage = saveProductDataUrl(b.productImageDataUrl) ?? undefined;
  db().brands.push(brand);
  save();
  return NextResponse.json({ brand: withUrls(brand) });
}

export async function PUT(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json();
  const brand = db().brands.find((x) => x.id === b.id);
  if (!brand) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (u.role !== "admin" && brand.ownerId && brand.ownerId !== u.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  Object.assign(brand, { name: b.name ?? brand.name, context: b.context ?? brand.context, voc: b.voc ?? brand.voc });
  if (b.productImageDataUrl) {
    const name = saveProductDataUrl(b.productImageDataUrl);
    if (name) {
      brand.productImage = name;
      brand.productMediaId = undefined; // re-import the new photo on next product scene
      brand.productMediaOwner = undefined;
    }
  }
  save();
  return NextResponse.json({ brand: withUrls(brand) });
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
