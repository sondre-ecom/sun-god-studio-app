import { NextRequest, NextResponse } from "next/server";
import { db, save, uid } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ styles: db().styles });
}

export async function POST(req: NextRequest) {
  const s = await req.json();
  const style = { id: uid(), name: s.name || "New style", block: s.block || "" };
  db().styles.push(style);
  save();
  return NextResponse.json({ style });
}

export async function PUT(req: NextRequest) {
  const s = await req.json();
  const style = db().styles.find((x) => x.id === s.id);
  if (!style) return NextResponse.json({ error: "not found" }, { status: 404 });
  Object.assign(style, { name: s.name ?? style.name, block: s.block ?? style.block });
  save();
  return NextResponse.json({ style });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const d = db();
  d.styles = d.styles.filter((x) => x.id !== id || x.builtin);
  save();
  return NextResponse.json({ ok: true });
}
