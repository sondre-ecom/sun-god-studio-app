import { NextRequest, NextResponse } from "next/server";
import { getProject, touch, db, uid } from "@/lib/store";
import { assemble, ffmpegAvailable } from "@/lib/ffmpeg";
import { mediaUrl, serializeProject } from "@/lib/serialize";
import { userForProject } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getProject(id);
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(await userForProject(p, req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!(await ffmpegAvailable()))
    return NextResponse.json({ error: "ffmpeg is not installed. Run: brew install ffmpeg" }, { status: 500 });
  try {
    const out = await assemble(p);
    p.finalPath = out;
    p.status = "done";
    db().library.push({
      id: uid(),
      kind: "video",
      projectId: p.id,
      ownerId: p.ownerId,
      label: `${p.title} · FINAL`,
      localPath: out,
      favorite: true,
      createdAt: Date.now(),
    });
    touch(p);
    return NextResponse.json({ project: serializeProject(p), finalUrl: mediaUrl(out) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
