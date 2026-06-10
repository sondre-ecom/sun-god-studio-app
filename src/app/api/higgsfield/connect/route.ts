import { NextResponse } from "next/server";
import { startAuth } from "@/lib/hf";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const url = await startAuth();
    if (url) return NextResponse.json({ connected: false, authUrl: url });
    return NextResponse.json({ connected: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
