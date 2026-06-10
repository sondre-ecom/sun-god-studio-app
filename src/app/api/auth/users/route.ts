import { NextRequest, NextResponse } from "next/server";
import { currentUser, createUser, deleteUser, setPassword, publicUser } from "@/lib/auth";
import { db } from "@/lib/store";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const u = await currentUser();
  if (!u || u.role !== "admin") return null;
  return u;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ users: db().users.map(publicUser) });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { username, password, role } = await req.json().catch(() => ({}));
  try {
    const u = createUser(String(username || ""), String(password || ""), role === "admin" ? "admin" : "member");
    return NextResponse.json({ user: publicUser(u) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id, password } = await req.json().catch(() => ({}));
  try {
    setPassword(String(id), String(password || ""));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (id === me.id) return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
  deleteUser(String(id));
  return NextResponse.json({ ok: true });
}
