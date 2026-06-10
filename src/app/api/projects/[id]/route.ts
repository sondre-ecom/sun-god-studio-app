import { NextRequest, NextResponse } from "next/server";
import { db, getProject, save, touch } from "@/lib/store";
import { serializeProject } from "@/lib/serialize";
import { refreshProject, busy } from "@/lib/jobs";
import { userForProject } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getProject(id);
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(await userForProject(p, req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (busy(p)) {
    try {
      await refreshProject(p);
    } catch {}
  }
  return NextResponse.json({ project: serializeProject(p) });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getProject(id);
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(await userForProject(p, req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  // Editable scene fields + project settings
  if (Array.isArray(body.scenes)) {
    for (const patch of body.scenes) {
      const s = p.scenes.find((x) => x.id === patch.id);
      if (s) Object.assign(s, {
        copy: patch.copy ?? s.copy,
        visual: patch.visual ?? s.visual,
        motion: patch.motion ?? s.motion,
        transitionToNext: patch.transitionToNext ?? s.transitionToNext,
        duration: patch.duration ?? s.duration,
      });
    }
  }
  const rec = p as unknown as Record<string, unknown>;
  for (const k of ["title", "mode", "sound", "imageModel", "resolution", "infinityLoop"] as const) {
    if (body[k] !== undefined) rec[k] = body[k];
  }
  touch(p);
  return NextResponse.json({ project: serializeProject(p) });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getProject(id);
  if (p && !(await userForProject(p, req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const d = db();
  d.projects = d.projects.filter((x) => x.id !== id);
  save();
  return NextResponse.json({ ok: true });
}
