import { NextResponse } from "next/server";
import { startAuth } from "@/lib/hf";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const url = await startAuth(u.id);
    if (url) return NextResponse.json({ connected: false, authUrl: url });
    return NextResponse.json({ connected: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
