import { NextRequest, NextResponse } from "next/server";
import { finishAuthCode } from "@/lib/hf";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });
  try {
    await finishAuthCode(code);
    return new NextResponse(
      `<html><body style="background:#0c0c0e;color:#eee;font-family:system-ui;display:grid;place-items:center;height:100vh"><div style="text-align:center"><h2>Higgsfield connected ✓</h2><p>You can close this tab and return to Sun God Studio.</p><script>setTimeout(()=>window.close(),1200)</script></div></body></html>`,
      { headers: { "content-type": "text/html" } }
    );
  } catch (e) {
    return new NextResponse(`Auth failed: ${(e as Error).message}`, { status: 500 });
  }
}
