import { NextResponse } from "next/server";
import { currentUser, publicUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user: publicUser(u) });
}
