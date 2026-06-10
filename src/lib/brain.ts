import fs from "node:fs";
import path from "node:path";
import { db } from "./store";

const MODEL = process.env.BRAIN_MODEL || "claude-fable-5";

/**
 * The brain has two backends:
 *  - Cloud / server: ANTHROPIC_API_KEY set → call the Messages API directly (robust in containers).
 *  - Local dev: no key → use the Claude Agent SDK with your local Claude Code login.
 */
async function ask(prompt: string): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) return askViaApi(prompt);
  return askViaSdk(prompt);
}

async function askViaApi(prompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const out = (data.content || []).filter((b) => b.type === "text").map((b) => b.text || "").join("");
  if (!out) throw new Error("Anthropic API returned no text.");
  return out;
}

async function askViaSdk(prompt: string): Promise<string> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  let out = "";
  for await (const m of query({
    prompt,
    options: { model: MODEL, maxTurns: 1, allowedTools: [], permissionMode: "bypassPermissions", settingSources: [] },
  })) {
    const msg = m as { type: string; subtype?: string; result?: string };
    if (msg.type === "result" && msg.subtype === "success" && msg.result) out = msg.result;
  }
  if (!out) throw new Error("Claude returned no result — set ANTHROPIC_API_KEY, or log in to Claude Code locally.");
  return out;
}

function parseJson<T>(text: string): T {
  const stripped = text.replace(/```(?:json)?/g, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON in brain response: " + text.slice(0, 200));
  return JSON.parse(stripped.slice(start, end + 1)) as T;
}

export interface StoryboardOut {
  title: string;
  script: string;
  styleBlock: string;
  characterSheet: string;
  scenes: {
    copy: string;
    visual: string;
    motion: string;
    transitionToNext: string;
    duration: number;
  }[];
}

function brandContext(brandId?: string): string {
  const d = db();
  const brand = d.brands.find((b) => b.id === brandId);
  let ctx = brand ? `BRAND: ${brand.name}\n${brand.context}\n` : "";
  // Auto-pull workspace positioning if present
  try {
    const pos = path.join(d.settings.workspacePath, "brand", "positioning.md");
    if (fs.existsSync(pos)) ctx += "\nWORKSPACE POSITIONING:\n" + fs.readFileSync(pos, "utf8").slice(0, 4000);
  } catch {}
  return ctx;
}

export async function makeStoryboard(input: {
  vision: string;
  brandId?: string;
  styleName: string;
  styleBlock: string;
  characterSheets: string[];
  sceneCount: number | "auto";
  clipDuration: number;
  infinityLoop: boolean;
}): Promise<StoryboardOut> {
  const count = input.sceneCount === "auto" ? "5 to 7" : String(input.sceneCount);
  const prompt = `You are an elite animated-ad director for paid social (Meta/TikTok, 9:16 vertical).

${brandContext(input.brandId)}

ANIMATION STYLE: ${input.styleName}
STYLE BLOCK (must be respected; do NOT repeat it inside scene visuals): ${input.styleBlock}
${input.characterSheets.length ? "CHARACTERS IN THIS AD:\n" + input.characterSheets.join("\n") : ""}

THE IDEA FROM THE USER:
${input.vision}

Create a storyboard of exactly ${count} scenes. Rules:
- Scene 1 is the HOOK: must stop the scroll in frame one, label who it's for, paint a picture.
- Escalate emotionally scene by scene; last scene is the product/CTA frame.
- Each scene gets ONE keyframe still. Between consecutive scenes a video model will animate from scene N's exact frame to scene N+1's exact frame — so every "transitionToNext" must describe a PHYSICALLY ANIMATABLE journey (camera push, morph, object carrying across, liquid draining, zoom through a doorway). Direct the in-between like a director.
${input.infinityLoop ? "- INFINITY LOOP MODE: the LAST scene must be composed so it can morph back into scene 1 seamlessly (similar framing/era/palette) — write the last scene's transitionToNext as the journey back into scene 1's exact frame." : ""}
- "visual" = a complete, self-contained image prompt for that keyframe (subject, framing, lighting, emotion). Do NOT include the style block — it gets prepended automatically. Characters must be described consistently using the character sheets.
- "copy" = the VO / on-screen line for that scene (short, punchy).
- "motion" = what moves during this scene's clip.
- "duration" = seconds for the clip leaving this scene (default ${input.clipDuration}, range 3-10).

Respond with ONLY this JSON, no commentary:
{"title": "...", "script": "full VO script as one text", "styleBlock": "refined style block (start from the given one, you may sharpen it)", "characterSheet": "ONE consolidated character sheet paragraph used verbatim in every image prompt (empty string if no recurring characters)", "scenes": [{"copy": "...", "visual": "...", "motion": "...", "transitionToNext": "...", "duration": ${input.clipDuration}}]}`;
  return parseJson<StoryboardOut>(await ask(prompt));
}

export async function reviseVisual(input: {
  styleBlock: string;
  characterSheet: string;
  visual: string;
  feedback: string;
}): Promise<string> {
  const prompt = `You refine image prompts for an animated ad keyframe. Current prompt body (style block "${input.styleBlock}" and character sheet are prepended automatically — do not include them):

${input.visual}

The user rejected the generated image with this feedback: "${input.feedback}"

Rewrite the prompt body to fix exactly what the feedback asks while keeping everything else. Respond with ONLY JSON: {"visual": "..."}`;
  const out = parseJson<{ visual: string }>(await ask(prompt));
  return out.visual;
}
