import path from "node:path";
import { MEDIA_DIR, Project } from "./store";

export function mediaUrl(localPath?: string): string | undefined {
  if (!localPath) return undefined;
  const rel = path.relative(MEDIA_DIR, localPath).split(path.sep).join("__");
  return `/api/media/${rel}`;
}

/** Project shaped for the client: every localPath gets a matching `*Url`. */
export function serializeProject(p: Project) {
  return {
    ...p,
    finalUrl: mediaUrl(p.finalPath),
    scenes: p.scenes.map((s) => ({
      ...s,
      variants: s.variants.map((v) => ({ ...v, src: mediaUrl(v.localPath) })),
      generating: s.pendingJobs.length > 0,
    })),
    clips: p.clips.map((c) => ({ ...c, src: mediaUrl(c.localPath), generating: !!c.pendingJob })),
  };
}
