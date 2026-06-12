import { NextRequest, NextResponse } from "next/server";
import { db, getProject, touch } from "@/lib/store";
import { generateImage } from "@/lib/hf";
import { buildImagePrompt } from "@/lib/prompt";
import { serializeProject } from "@/lib/serialize";
import { userForProject } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const { id, sid } = await params;
  const p = getProject(id);
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(await userForProject(p, req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const renderUserId = p.ownerId; // renders go through the project owner's own Higgsfield
  if (!renderUserId) return NextResponse.json({ error: "Project has no owner." }, { status: 400 });
  const scene = p.scenes.find((s) => s.id === sid);
  if (!scene) return NextResponse.json({ error: "scene not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const count = Math.min(4, Math.max(1, body.count || 2));

  // Reference: scene 1's chosen variant (for consistency) + any character refs
  const refs: string[] = [];
  const scene1 = p.scenes[0];
  if (scene1 && scene1.id !== sid) {
    const chosen = scene1.variants.find((v) => v.id === scene1.chosenVariantId);
    if (chosen?.mediaId) refs.push(chosen.mediaId);
    else if (chosen?.jobId) refs.push(chosen.jobId);
  }
  for (const cid of p.characterIds) {
    const c = db().characters.find((x) => x.id === cid);
    if (c?.refMediaId) refs.push(c.refMediaId);
  }

  const prompt = buildImagePrompt({
    styleBlock: p.styleBlock,
    characterSheet: p.characterSheet,
    visual: scene.visual,
    forceDisclaimer: body.disclaimer,
  });

  try {
    const ids = await generateImage(renderUserId, {
      model: p.imageModel,
      prompt,
      aspect: p.aspect,
      resolution: p.resolution,
      count,
      refMediaIds: refs.length ? refs : undefined,
    });
    scene.pendingJobs.push(...ids);
    scene.pendingStartedAt = Date.now();
    if (p.status === "storyboard") p.status = "stills";
    touch(p);
    return NextResponse.json({ project: serializeProject(p) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
