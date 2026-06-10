import { NextRequest, NextResponse } from "next/server";
import { createUser, publicUser, ensureSeed } from "@/lib/auth";
import { SESSION_COOKIE, createToken } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET → tells the signup page whether an invite code is required.
export async function GET() {
  return NextResponse.json({ codeRequired: !!process.env.SIGNUP_CODE });
}

export async function POST(req: NextRequest) {
  const { username, password, code } = await req.json().catch(() => ({}));

  // Optional invite-code gate. Set SIGNUP_CODE in Render to require it.
  const required = process.env.SIGNUP_CODE;
  if (required && String(code || "") !== required) {
    return NextResponse.json({ error: "Wrong or missing invite code." }, { status: 403 });
  }

  ensureSeed(); // make sure the admin exists before anyone else registers
  try {
    const user = createUser(String(username || ""), String(password || ""), "member");
    const token = await createToken(user.id);
    const res = NextResponse.json({ user: publicUser(user) });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 14 * 864e2,
    });
    return res;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
