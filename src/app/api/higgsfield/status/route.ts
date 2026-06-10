import { NextResponse } from "next/server";
import { isConnected, disconnect } from "@/lib/hf";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ connected: await isConnected() });
}

export async function DELETE() {
  disconnect();
  return NextResponse.json({ connected: false });
}
