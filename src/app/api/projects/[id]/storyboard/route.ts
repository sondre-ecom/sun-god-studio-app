import { NextRequest, NextResponse } from "next/server";
import { db, getProject, touch, uid, Scene } from "@/lib/store";
import { reviseStoryboard, resolveBrainAuth } from "@/lib/brain";
import { serializeProject } from "@/lib/serialize";
import { userForProject } from "@/lib/access";

export const dynamic = "force-dynamic";

/** Rewrite the whole storyboard from a director's note. Resets stills/clips (this is the cheap, pre-generation iteration step). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getProject(id);
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  const user = await userForProject(p, req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { feedback } = await req.json().catch(() => ({}));
  if (!String(feedback || "").trim()) return NextResponse.json({ error: "Add a note describing what to change." }, { status: 400 });

  const d = db();
  const style = d.styles.find((s) => s.id === p.styleId) || d.styles[0];

  let sb;
  try {
    sb = await reviseStoryboard({
      feedback: String(feedback),
      styleName: style?.name || "Pixar 3D",
      styleBlock: p.styleBlock || style?.block || "",
      brandId: p.brandId,
      infinityLoop: p.infinityLoop,
      clipDuration: p.scenes[0]?.duration || 5,
      current: {
        title: p.title,
        script: p.script,
        scenes: p.scenes.map((s) => ({ copy: s.copy, visual: s.visual, motion: s.motion, transitionToNext: s.transitionToNext, duration: s.duration })),
      },
    }, resolveBrainAuth(user));
  } catch (e) {
    return NextResponse.json({ error: "Brain failed: " + (e as Error).message }, { status: 500 });
  }

  // Replace the plan; clear any generated stills/clips/final (the plan changed).
  p.scenes = sb.scenes.map((s, i): Scene => ({
    id: uid(),
    n: i + 1,
    copy: s.copy,
    visual: s.visual,
    motion: s.motion,
    transitionToNext: s.transitionToNext,
    duration: s.duration || 5,
    pendingJobs: [],
    variants: [],
  }));
  p.clips = [];
  p.finalPath = undefined;
  p.script = sb.script;
  p.styleBlock = sb.styleBlock || p.styleBlock;
  p.characterSheet = sb.characterSheet || p.characterSheet;
  if (sb.title) p.title = sb.title;
  p.status = "storyboard";
  touch(p);
  return NextResponse.json({ project: serializeProject(p) });
}
