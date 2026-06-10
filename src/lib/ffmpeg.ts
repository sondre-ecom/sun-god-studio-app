import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { MEDIA_DIR, Project } from "./store";

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${err.slice(-800)}`))));
    p.on("error", reject);
  });
}

export async function ffmpegAvailable(): Promise<boolean> {
  try {
    await run("ffmpeg", ["-version"]);
    return true;
  } catch {
    return false;
  }
}

/** Concat the project's clips (in scene order, loop clip last) into one MP4. */
export async function assemble(project: Project): Promise<string> {
  const ordered = project.clips
    .filter((c) => c.localPath && fs.existsSync(c.localPath))
    .sort((a, b) => {
      const idx = (c: typeof a) => project.scenes.findIndex((s) => s.id === c.fromSceneId) + (c.isLoop ? 1000 : 0);
      return idx(a) - idx(b);
    });
  if (!ordered.length) throw new Error("No finished clips to assemble.");

  const outDir = path.join(MEDIA_DIR, "final");
  fs.mkdirSync(outDir, { recursive: true });
  const listPath = path.join(outDir, `${project.id}.txt`);
  fs.writeFileSync(listPath, ordered.map((c) => `file '${c.localPath!.replace(/'/g, "'\\''")}'`).join("\n"));
  const outPath = path.join(outDir, `${project.id}.mp4`);
  await run("ffmpeg", [
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", listPath,
    "-c:v", "libx264",
    "-crf", "18",
    "-preset", "medium",
    "-pix_fmt", "yuv420p",
    "-r", "30",
    "-an",
    outPath,
  ]);
  return outPath;
}
