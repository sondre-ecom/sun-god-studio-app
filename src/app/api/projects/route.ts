import { NextRequest, NextResponse } from "next/server";
import { db, save, uid, Project, Scene } from "@/lib/store";
import { makeStoryboard, resolveBrainAuth } from "@/lib/brain";
import { serializeProject } from "@/lib/serialize";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const projects = db()
    .projects.filter((p) => u.role === "admin" || p.ownerId === u.id || !p.ownerId)
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(serializeProject);
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const d = db();
  const style = d.styles.find((s) => s.id === body.styleId) || d.styles[0];
  const characters = (body.characterIds || []).map((id: string) => d.characters.find((c) => c.id === id)).filter(Boolean);

  // Length-driven: derive scene count + per-clip seconds from a target total length (sec).
  // Each transition clip runs ~6s, and N scenes make N−1 clips, so length ≈ (scenes−1) × clipDuration.
  let sceneCount: number | "auto" = body.sceneCount ?? "auto";
  let clipDuration = body.clipDuration ?? 5;
  if (body.lengthSec) {
    const lengthSec = Math.min(150, Math.max(10, Number(body.lengthSec)));
    sceneCount = Math.min(26, Math.max(3, Math.round(lengthSec / 6) + 1));
    clipDuration = Math.min(10, Math.max(3, Math.round(lengthSec / Math.max(1, sceneCount - 1))));
  }

  let sb;
  try {
    const auth = resolveBrainAuth(u);
    sb = await makeStoryboard({
      vision: body.vision || "",
      brandId: body.brandId,
      styleName: style.name,
      styleBlock: style.block,
      characterSheets: characters.map((c: { name: string; sheet: string }) => `${c.name}: ${c.sheet}`),
      sceneCount,
      clipDuration,
      infinityLoop: !!body.infinityLoop,
    }, auth);
  } catch (e) {
    return NextResponse.json({ error: "Brain failed: " + (e as Error).message }, { status: 500 });
  }

  const scenes: Scene[] = sb.scenes.map((s, i) => ({
    id: uid(),
    n: i + 1,
    copy: s.copy,
    visual: s.visual,
    motion: s.motion,
    transitionToNext: s.transitionToNext,
    duration: s.duration || body.clipDuration || 5,
    pendingJobs: [],
    variants: [],
  }));

  const project: Project = {
    id: uid(),
    title: body.title || sb.title || "Untitled ad",
    ownerId: u.id,
    brandId: body.brandId,
    styleId: style.id,
    imageModel: body.imageModel || "nano_banana_pro",
    videoModel: "kling3_0",
    resolution: body.resolution || "4k",
    aspect: body.aspect || "9:16",
    mode: body.mode || "pro",
    sound: body.sound || "off",
    infinityLoop: !!body.infinityLoop,
    vision: body.vision || "",
    script: sb.script,
    styleBlock: sb.styleBlock || style.block,
    characterSheet: sb.characterSheet || "",
    characterIds: body.characterIds || [],
    scenes,
    clips: [],
    status: "storyboard",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  d.projects.push(project);
  save();
  return NextResponse.json({ project: serializeProject(project) });
}
