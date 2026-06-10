import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { save } from "@/lib/store";

export const dynamic = "force-dynamic";

// Report whether the current user has their own key, and whether they have a fallback (admin).
export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const hasFallback = u.role === "admin" && (!!process.env.ANTHROPIC_API_KEY || true); // admin can always fall back (env or local login)
  return NextResponse.json({ hasKey: !!u.anthropicKey, role: u.role, hasFallback });
}

export async function POST(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { key } = await req.json().catch(() => ({}));
  const k = String(key || "").trim();
  if (!k.startsWith("sk-ant-")) {
    return NextResponse.json({ error: "That doesn't look like an Anthropic key (it should start with sk-ant-)." }, { status: 400 });
  }
  u.anthropicKey = k;
  save();
  return NextResponse.json({ hasKey: true });
}

export async function DELETE() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  u.anthropicKey = undefined;
  save();
  return NextResponse.json({ hasKey: false });
}
