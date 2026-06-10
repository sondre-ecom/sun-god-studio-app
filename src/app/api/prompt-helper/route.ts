import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { craftVisionPrompt, resolveBrainAuth } from "@/lib/brain";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { idea } = await req.json().catch(() => ({}));
  if (!String(idea || "").trim()) return NextResponse.json({ error: "Type a rough idea first." }, { status: 400 });
  try {
    const prompt = await craftVisionPrompt(String(idea), resolveBrainAuth(u));
    return NextResponse.json({ prompt });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
