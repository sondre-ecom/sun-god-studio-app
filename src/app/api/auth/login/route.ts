import { NextRequest, NextResponse } from "next/server";
import { login, publicUser } from "@/lib/auth";
import { SESSION_COOKIE, createToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}));
  const user = login(String(username || ""), String(password || ""));
  if (!user) return NextResponse.json({ error: "Wrong username or password." }, { status: 401 });
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
}
