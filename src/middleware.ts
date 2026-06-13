import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/session";

// Paths reachable without an app login.
const PUBLIC = [
  "/login",
  "/signup",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/higgsfield/callback", // OAuth return from Higgsfield
  "/api/product-image", // public so Higgsfield can fetch product photos to import (non-sensitive, random names)
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();

  const uid = await verifyToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (uid) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Protect everything except Next internals. We do NOT exempt by file extension,
  // so /api/media/* (users' private stills & clips) still requires a valid session.
  // Same-origin <img>/<video> requests carry the session cookie automatically.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
