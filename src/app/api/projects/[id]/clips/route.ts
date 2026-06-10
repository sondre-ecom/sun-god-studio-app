import { NextRequest, NextResponse } from "next/server";
import { getProject, touch, uid, Scene, Variant } from "@/lib/store";
import { generateVideo, importUrl } from "@/lib/hf";
import { buildVideoPrompt } from "@/lib/prompt";
import { mediaUrl, serializeProject } from "@/lib/serialize";
import { userForProject } from "@/lib/access";

export const dynamic = "force-dynamic";

function chosen(scene: Scene): Variant | undefined {
  return scene.variants.find((v) => v.id === scene.chosenVariantId);
}

/** A stable reference Kling can consume: prefer an imported media id, else the image job id. */
async function ensureRef(v: Variant, origin: string): Promise<string> {
  if (v.mediaId) return v.mediaId;
  const url = v.url || (v.localPath ? new URL(mediaUrl(v.localPath)!, origin).toString() : undefined);
  if (url) {
    try {
      v.mediaId = await importUrl(url);
      return v.mediaId;
    } catch {}
  }
  return v.jobId; // fallback: prior-generation job id is accepted as a media value
}

/**
 * Generate the transition clips. Body: { pairs?: [{from, to}] } to (re)generate
 * specific transitions; omitted = generate every missing transition in scene order.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getProject(id);
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(await userForProject(p, req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const origin = req.nextUrl.origin;
  const body = await req.json().catch(() => ({}));

  // Build the list of (fromScene, toScene|null) transitions to generate.
  const seq: { from: Scene; to: Scene | null; isLoop: boolean }[] = [];
  if (Array.isArray(body.pairs) && body.pairs.length) {
    for (const pr of body.pairs) {
      const from = p.scenes.find((s) => s.id === pr.from);
      const to = pr.to ? p.scenes.find((s) => s.id === pr.to) : null;
      if (from) seq.push({ from, to: to ?? null, isLoop: !!pr.loop });
    }
  } else {
    for (let i = 0; i < p.scenes.length - 1; i++) seq.push({ from: p.scenes[i], to: p.scenes[i + 1], isLoop: false });
    if (p.infinityLoop && p.scenes.length > 1)
      seq.push({ from: p.scenes[p.scenes.length - 1], to: p.scenes[0], isLoop: true });
  }

  const errors: string[] = [];
  for (const { from, to, isLoop } of seq) {
    const cv = chosen(from);
    if (!cv) {
      errors.push(`Scene ${from.n} has no approved still yet.`);
      continue;
    }
    const startRef = await ensureRef(cv, origin);
    let endRef: string | undefined;
    if (to) {
      const tv = chosen(to);
      if (!tv) {
        errors.push(`Scene ${to.n} has no approved still yet.`);
        continue;
      }
      endRef = await ensureRef(tv, origin);
    }

    // Replace any prior clip for this transition
    p.clips = p.clips.filter((c) => !(c.fromSceneId === from.id && c.toSceneId === (to?.id ?? null)));
    const prompt = buildVideoPrompt({
      styleBlock: p.styleBlock,
      motion: from.motion,
      transition: isLoop ? `${from.transitionToNext} (loop seamlessly back to the opening shot)` : from.transitionToNext,
      forceDisclaimer: body.disclaimer,
    });
    try {
      const ids = await generateVideo({
        model: p.videoModel,
        prompt,
        aspect: p.aspect,
        duration: from.duration,
        mode: p.mode,
        sound: p.sound,
        startRef,
        endRef,
      });
      p.clips.push({
        id: uid(),
        fromSceneId: from.id,
        toSceneId: to?.id ?? null,
        isLoop,
        prompt,
        pendingJob: ids[0],
        status: "queued",
      });
    } catch (e) {
      errors.push(`Scene ${from.n}→${to ? to.n : "end"}: ${(e as Error).message}`);
    }
  }

  p.status = "clips";
  touch(p);
  return NextResponse.json({ project: serializeProject(p), errors });
}
