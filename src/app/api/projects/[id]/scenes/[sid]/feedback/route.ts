import { NextRequest, NextResponse } from "next/server";
import { db, getProject, touch } from "@/lib/store";
import { reviseVisual, resolveBrainAuth } from "@/lib/brain";
import { generateImage } from "@/lib/hf";
import { buildImagePrompt } from "@/lib/prompt";
import { serializeProject } from "@/lib/serialize";
import { userForProject } from "@/lib/access";

export const dynamic = "force-dynamic";

/** Take feedback, let the brain rewrite the visual prompt, regenerate fresh variants. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const { id, sid } = await params;
  const p = getProject(id);
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  const user = await userForProject(p, req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const renderUserId = p.ownerId;
  if (!renderUserId) return NextResponse.json({ error: "Project has no owner." }, { status: 400 });
  const scene = p.scenes.find((s) => s.id === sid);
  if (!scene) return NextResponse.json({ error: "scene not found" }, { status: 404 });
  const { feedback, count } = await req.json();

  try {
    scene.visual = await reviseVisual({
      styleBlock: p.styleBlock,
      characterSheet: p.characterSheet,
      visual: scene.visual,
      feedback: feedback || "make it better",
    }, resolveBrainAuth(user));
  } catch (e) {
    return NextResponse.json({ error: "Brain failed: " + (e as Error).message }, { status: 500 });
  }

  const refs: string[] = [];
  const scene1 = p.scenes[0];
  if (scene1 && scene1.id !== sid) {
    const chosen = scene1.variants.find((v) => v.id === scene1.chosenVariantId);
    if (chosen?.mediaId || chosen?.jobId) refs.push((chosen.mediaId || chosen.jobId)!);
  }
  for (const cid of p.characterIds) {
    const c = db().characters.find((x) => x.id === cid);
    if (c?.refMediaId) refs.push(c.refMediaId);
  }

  try {
    const ids = await generateImage(renderUserId, {
      model: p.imageModel,
      prompt: buildImagePrompt({ styleBlock: p.styleBlock, characterSheet: p.characterSheet, visual: scene.visual }),
      aspect: p.aspect,
      resolution: p.resolution,
      count: Math.min(4, Math.max(1, count || 2)),
      refMediaIds: refs.length ? refs : undefined,
    });
    scene.pendingJobs.push(...ids);
    touch(p);
    return NextResponse.json({ project: serializeProject(p) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
