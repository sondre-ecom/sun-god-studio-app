import fs from "node:fs";
import path from "node:path";
import { db, User } from "./store";

const MODEL = process.env.BRAIN_MODEL || "claude-fable-5";

/** Per-user brain credentials. members must bring their own key; admin may fall back. */
export interface BrainAuth {
  apiKey?: string; // this user's own Anthropic key (or admin's env key)
  useLocal?: boolean; // admin only, local dev: use Claude Code login
}

/**
 * Decide which credentials power the brain for a given user.
 *  - Any user with their own key → use it (BYOK).
 *  - Admin without a key → fall back to the server env key, else the local Claude login.
 *  - Member without a key → blocked (they must add their own).
 */
export function resolveBrainAuth(user: Pick<User, "role" | "anthropicKey">): BrainAuth {
  if (user.anthropicKey) return { apiKey: user.anthropicKey };
  if (user.role === "admin") {
    if (process.env.ANTHROPIC_API_KEY) return { apiKey: process.env.ANTHROPIC_API_KEY };
    return { useLocal: true };
  }
  throw new Error("Add your own Anthropic API key in Settings to generate storyboards.");
}

async function ask(prompt: string, auth: BrainAuth): Promise<string> {
  if (auth.apiKey) return askViaApi(prompt, auth.apiKey);
  if (auth.useLocal) return askViaSdk(prompt);
  throw new Error("No brain credentials available.");
}

async function askViaApi(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000, // storyboards with detailed visuals easily exceed 4096 and get truncated mid-JSON
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[]; stop_reason?: string };
  if (data.stop_reason === "max_tokens")
    throw new Error("Brain response hit the output limit and was truncated — try fewer scenes or a shorter idea.");
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
}, auth: BrainAuth): Promise<StoryboardOut> {
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
  return parseJson<StoryboardOut>(await ask(prompt, auth));
}

/**
 * Prompt Helper: turn a rough idea (even a few words) into ONE polished, storyboard-ready
 * vision prompt that this app's brain renders well. Encodes what makes a great animated-ad
 * brief: a visual metaphor, a clear who + feeling, a scroll-stopping hook, an emotional arc,
 * concrete *animatable* imagery, a style, and an ending on the product.
 */
export async function craftVisionPrompt(idea: string, auth: BrainAuth): Promise<string> {
  const prompt = `You are a world-class creative director who writes the single best possible "vision" brief for an AI animated-ad generator. The user gives a rough idea; you return ONE tight, vivid paragraph (90–160 words) they can paste straight into the generator.

A great vision brief for this tool always has:
- A concrete VISUAL METAPHOR or through-line the whole ad can be built around (this is what makes it cinematic, not a list of features).
- WHO it's for and the core EMOTION/desire (name the viewer and what they feel).
- A scroll-stopping HOOK image for the very first moment.
- A simple EMOTIONAL ARC (e.g. frustrated → hopeful → confident).
- Concrete, ANIMATABLE imagery (things that can physically move/morph on screen), not abstract claims.
- A clear ENDING on the product / call-to-action.
- A note of the desired ANIMATION STYLE (default Pixar 3D if unspecified) and rough length (~30s).

Write it as flowing directic prose (not bullet points, not a storyboard — that comes later). Keep the user's product, audience, and intent; enrich the rest. If the idea is vague, make confident, sensible creative choices rather than asking questions.

THE USER'S ROUGH IDEA:
${idea}

Respond with ONLY JSON: {"prompt": "the polished vision paragraph"}`;
  const out = parseJson<{ prompt: string }>(await ask(prompt, auth));
  return out.prompt;
}

export async function reviseVisual(input: {
  styleBlock: string;
  characterSheet: string;
  visual: string;
  feedback: string;
}, auth: BrainAuth): Promise<string> {
  const prompt = `You refine image prompts for an animated ad keyframe. Current prompt body (style block "${input.styleBlock}" and character sheet are prepended automatically — do not include them):

${input.visual}

The user rejected the generated image with this feedback: "${input.feedback}"

Rewrite the prompt body to fix exactly what the feedback asks while keeping everything else. Respond with ONLY JSON: {"visual": "..."}`;
  const out = parseJson<{ visual: string }>(await ask(prompt, auth));
  return out.visual;
}
