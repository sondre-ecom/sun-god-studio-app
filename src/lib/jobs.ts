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

/** Sweep all pending jobs of a project: poll, download finished media, update records. */
export async function refreshProject(project: Project): Promise<void> {
  let dirty = false;

  for (const scene of project.scenes) {
    if (!scene.pendingJobs.length) continue;
    const still: string[] = [];
    for (const jobId of scene.pendingJobs) {
      try {
        const st = await jobStatus(jobId);
        if (st.status === "completed") {
          let i = 0;
          for (const url of st.urls) {
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

  for (const clip of project.clips) {
    if (!clip.pendingJob) continue;
    try {
      const st = await jobStatus(clip.pendingJob);
      if (st.status === "completed") {
        const vid = st.urls.find((u) => /\.(mp4|webm|mov)(\?|$)/i.test(u)) ?? st.urls[0];
        if (vid) {
          clip.url = vid;
          clip.localPath = await download(vid, `${clip.pendingJob}_clip${extFor(vid, "video")}`);
          addLibrary({ kind: "video", projectId: project.id, ownerId: project.ownerId, label: `${project.title} · transition`, jobId: clip.pendingJob, url: vid, localPath: clip.localPath });
        }
        clip.status = "completed";
        clip.pendingJob = undefined;
        dirty = true;
      } else if (st.status === "failed" || st.status === "nsfw" || st.status === "canceled") {
        clip.status = st.status as typeof clip.status;
        clip.pendingJob = undefined;
        dirty = true;
      } else {
        clip.status = "in_progress";
      }
    } catch {}
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
}

export function busy(project: Project): boolean {
  return project.scenes.some((s) => s.pendingJobs.length > 0) || project.clips.some((c) => c.pendingJob);
}
