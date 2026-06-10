import fs from "node:fs";
import path from "node:path";
import { MEDIA_DIR, Project, db, save, uid } from "./store";
import { jobStatus } from "./hf";

function extFor(url: string, kind: "image" | "video"): string {
  const m = url.split("?")[0].match(/\.(jpe?g|png|webp|mp4|webm|mov)$/i);
  if (m) return "." + m[1].toLowerCase().replace("jpeg", "jpg");
  return kind === "video" ? ".mp4" : ".jpg";
}

async function download(url: string, name: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status} for ${url.slice(0, 80)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  const p = path.join(MEDIA_DIR, name);
  fs.writeFileSync(p, buf);
  return p;
}

function addLibrary(opts: { kind: "image" | "video"; projectId: string; ownerId?: string; label: string; jobId: string; url: string; localPath: string }) {
  const d = db();
  if (d.library.some((m) => m.jobId === opts.jobId && m.url === opts.url)) return;
  d.library.push({ id: uid(), favorite: false, createdAt: Date.now(), ...opts });
}

// One sweep per project at a time. Prevents overlapping polls from double-processing
// the same finished job and creating duplicate variants.
const refreshing = new Set<string>();

/** Collapse duplicate variants (same jobId+url) per scene; repoint a chosen variant if it was a dup. Returns true if it changed anything. */
export function dedupeProject(project: Project): boolean {
  let changed = false;
  for (const scene of project.scenes) {
    const seen = new Map<string, string>(); // jobId|url -> kept variant id
    const kept: typeof scene.variants = [];
    for (const v of scene.variants) {
      const key = `${v.jobId}|${v.url ?? v.localPath ?? v.id}`;
      const existing = seen.get(key);
      if (existing) {
        if (scene.chosenVariantId === v.id) scene.chosenVariantId = existing; // keep selection valid
        changed = true;
        continue;
      }
      seen.set(key, v.id);
      kept.push(v);
    }
    if (kept.length !== scene.variants.length) scene.variants = kept;
    if (scene.chosenVariantId && !scene.variants.some((v) => v.id === scene.chosenVariantId)) {
      scene.chosenVariantId = scene.variants[0]?.id;
      changed = true;
    }
  }
  if (changed) {
    project.updatedAt = Date.now();
    save();
  }
  return changed;
}

/** Sweep all pending jobs of a project: poll, download finished media, update records. */
export async function refreshProject(project: Project): Promise<void> {
  const renderUserId = project.ownerId; // poll with the project owner's own Higgsfield connection
  if (!renderUserId) return;
  if (refreshing.has(project.id)) return; // a sweep is already running for this project
  refreshing.add(project.id);
  let dirty = false;
  try {
  for (const scene of project.scenes) {
    if (!scene.pendingJobs.length) continue;
    const still: string[] = [];
    for (const jobId of scene.pendingJobs) {
      try {
        const st = await jobStatus(renderUserId, jobId);
        if (st.status === "completed") {
          let i = 0;
          for (const url of st.urls) {
            if (scene.variants.some((v) => v.jobId === jobId && v.url === url)) continue; // already have it
            const localPath = await download(url, `${jobId}_${i}${extFor(url, "image")}`);
            scene.variants.push({ id: uid(), jobId, url, localPath });
            addLibrary({ kind: "image", projectId: project.id, ownerId: project.ownerId, label: `${project.title} · scene ${scene.n}`, jobId, url, localPath });
            i++;
          }
          if (!scene.chosenVariantId && scene.variants.length) scene.chosenVariantId = scene.variants[0].id;
          dirty = true;
        } else if (st.status === "failed" || st.status === "nsfw" || st.status === "canceled") {
          dirty = true; // drop the job
        } else {
          still.push(jobId);
        }
      } catch {
        still.push(jobId); // transient — try again next poll
      }
    }
    if (still.length !== scene.pendingJobs.length) dirty = true;
    scene.pendingJobs = still;
  }

  const CLIP_TIMEOUT_MS = 8 * 60 * 1000; // give up on a Kling job stuck past 8 minutes
  for (const clip of project.clips) {
    if (!clip.pendingJob) continue;
    try {
      const st = await jobStatus(renderUserId, clip.pendingJob);
      const vid = st.urls.find((u) => /\.(mp4|webm|mov)(\?|$)/i.test(u)) ?? (st.status === "completed" ? st.urls[0] : undefined);
      if (vid) {
        // Finish as soon as a video URL exists — even if the status field was unparseable.
        clip.url = vid;
        clip.localPath = await download(vid, `${clip.pendingJob}_clip${extFor(vid, "video")}`);
        addLibrary({ kind: "video", projectId: project.id, ownerId: project.ownerId, label: `${project.title} · transition`, jobId: clip.pendingJob, url: vid, localPath: clip.localPath });
        clip.status = "completed";
        clip.error = undefined;
        clip.pendingJob = undefined;
        dirty = true;
      } else if (st.status === "failed" || st.status === "nsfw" || st.status === "canceled") {
        clip.status = st.status as typeof clip.status;
        clip.error = st.status === "nsfw" ? "Blocked by the content filter — try rewording the motion, or regenerate." : "Render failed — click to retry.";
        clip.pendingJob = undefined;
        dirty = true;
      } else if (clip.startedAt && Date.now() - clip.startedAt > CLIP_TIMEOUT_MS) {
        // Stuck job: stop polling forever so the user can retry.
        clip.status = "failed";
        clip.error = "This clip got stuck (timed out). Click to retry.";
        clip.pendingJob = undefined;
        dirty = true;
      } else {
        clip.status = "in_progress";
      }
    } catch {
      // transient poll error — but still honor the timeout so a permanently-erroring job doesn't hang forever
      if (clip.startedAt && Date.now() - clip.startedAt > CLIP_TIMEOUT_MS) {
        clip.status = "failed";
        clip.error = "This clip got stuck (timed out). Click to retry.";
        clip.pendingJob = undefined;
        dirty = true;
      }
    }
  }

  const allChosen = project.scenes.length > 0 && project.scenes.every((s) => s.chosenVariantId);
  const allClips = project.clips.length > 0 && project.clips.every((c) => c.localPath);
  if (project.finalPath) project.status = "done";
  else if (allClips) project.status = "clips";
  else if (allChosen) project.status = "clips";
  else if (project.scenes.some((s) => s.variants.length || s.pendingJobs.length)) project.status = "stills";

  if (dirty) {
    project.updatedAt = Date.now();
    save();
  }
  } finally {
    refreshing.delete(project.id);
  }
}

export function busy(project: Project): boolean {
  return project.scenes.some((s) => s.pendingJobs.length > 0) || project.clips.some((c) => c.pendingJob);
}
