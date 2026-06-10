import { NextResponse } from "next/server";
import { isConnected, disconnect } from "@/lib/hf";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ connected: false }, { status: 401 });
  return NextResponse.json({ connected: await isConnected(u.id) });
}

export async function DELETE() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  disconnect(u.id);
  return NextResponse.json({ connected: false });
}
