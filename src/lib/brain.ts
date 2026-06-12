import fs from "node:fs";
import path from "node:path";
import { db, User } from "./store";
import { COPY_PRINCIPLES } from "./copywriting";
import { META_AD_CRAFT, IMAGE_DIRECTION } from "./adcraft";
import { EVOLVE_PLAYBOOK, EVAL_RUBRIC } from "./playbook";

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
  const prompt = `You are one of the best paid-social creative directors in the world — elite at Meta/TikTok direct-response (9:16 vertical). You make ads that stop the scroll and sell. You do NOT produce safe, generic, "mid" concepts.

${EVOLVE_PLAYBOOK}

${META_AD_CRAFT}

${COPY_PRINCIPLES}

${IMAGE_DIRECTION}

${brandContext(input.brandId)}

ANIMATION STYLE: ${input.styleName}
STYLE BLOCK (must be respected; do NOT repeat it inside scene visuals): ${input.styleBlock}
${input.characterSheets.length ? "CHARACTERS IN THIS AD:\n" + input.characterSheets.join("\n") : ""}

THE IDEA FROM THE USER:
${input.vision}

FIRST (silently, before scenes): lock the concept — WHO exactly, the ONE sharp angle (consider 2–3, build on the best — never the obvious first idea), the HOOK archetype, the mechanism + recognizable proof, the format. THEN write the scenes from that locked concept.

Create a storyboard of exactly ${count} scenes. Rules:
- Scene 1 IS the hook delivered in the first frame — it must stop the exact person in WHO and make them feel something instantly. No slow intro, no logo, no throat-clearing.
- Escalate the tension scene by scene, then earn the relief; last scene is the product-as-lever + one clear next step.
- Every "visual" must be a fully-directed cinematic shot (subject + specific facial emotion + 9:16 framing + directional lighting + shallow depth + texture/detail + color grade) per the IMAGE DIRECTION above — not a flat label.
- FOLLOW THE BRIEF'S APPROACH. If the brief asks for science/mechanism, a literal depiction, or recognizable real-life proof, do exactly that — show the real subject and the real phenomenon. Do NOT invent a metaphor, mascot, town, weather, or fantasy world unless the brief explicitly asks for one. Honor the product's real usage ritual (e.g. a daily powder stirred into water) so the format reads correctly.
- Each scene gets ONE keyframe still. Between consecutive scenes a video model animates from scene N's exact frame to scene N+1's exact frame — so every "transitionToNext" must describe a PHYSICALLY ANIMATABLE in-between. That can be a literal continuity move (match-cut, a time-of-day change, the same subject visibly changing state, a camera push) OR — only if the brief wants it — a morph. Direct the in-between like a director.
${input.infinityLoop ? "- INFINITY LOOP MODE: the LAST scene must be composed so it can flow back into scene 1 seamlessly (similar framing/palette) — write the last scene's transitionToNext as the journey back into scene 1's exact frame." : ""}
- "visual" = a complete, self-contained image prompt for that keyframe (subject, framing, lighting, emotion). Do NOT include the style block — it gets prepended automatically. Characters must be described consistently using the character sheets.
- "copy" = the VO / on-screen line for that scene (short, punchy).
- "motion" = what moves during this scene's clip.
- "duration" = seconds for the clip leaving this scene (default ${input.clipDuration}, range 3-10).

Respond with ONLY this JSON, no commentary:
{"title": "...", "script": "full VO script as one text", "styleBlock": "refined style block (start from the given one, you may sharpen it)", "characterSheet": "ONE consolidated character sheet paragraph used verbatim in every image prompt (empty string if no recurring characters)", "scenes": [{"copy": "...", "visual": "...", "motion": "...", "transitionToNext": "...", "duration": ${input.clipDuration}}]}`;
  return parseJson<StoryboardOut>(await ask(prompt, auth));
}

/** Rewrite an existing storyboard from a director's note — before any images are generated (cheapest place to iterate). */
export async function reviseStoryboard(input: {
  feedback: string;
  styleName: string;
  styleBlock: string;
  brandId?: string;
  infinityLoop: boolean;
  clipDuration: number;
  current: { title: string; script: string; scenes: { copy: string; visual: string; motion: string; transitionToNext: string; duration: number }[] };
}, auth: BrainAuth): Promise<StoryboardOut> {
  const prompt = `You are one of the best paid-social creative directors in the world, revising an animated-ad storyboard from a director's note. Keep everything that works; change exactly what the note asks; keep the concept sharp (strong who/angle/hook).

${EVOLVE_PLAYBOOK}

${META_AD_CRAFT}

${COPY_PRINCIPLES}

${IMAGE_DIRECTION}

${brandContext(input.brandId)}

ANIMATION STYLE: ${input.styleName}
STYLE BLOCK (respected; do not repeat inside scene visuals): ${input.styleBlock}
${input.infinityLoop ? "INFINITY LOOP MODE: the last scene must flow back into scene 1." : ""}

CURRENT STORYBOARD (JSON):
${JSON.stringify(input.current)}

THE DIRECTOR'S NOTE (what to change):
${input.feedback}

Return the FULL revised storyboard as ONLY this JSON (same schema), with cinematic, fully-directed "visual" prompts:
{"title": "...", "script": "full VO script", "styleBlock": "refined style block", "characterSheet": "consolidated character sheet paragraph (empty if no recurring characters)", "scenes": [{"copy": "...", "visual": "...", "motion": "...", "transitionToNext": "...", "duration": ${input.clipDuration}}]}`;
  return parseJson<StoryboardOut>(await ask(prompt, auth));
}

/** Claude ruthlessly self-critiques the storyboard against the playbook + rubric and rewrites it sharper — no human note needed. */
export async function improveStoryboard(input: {
  styleName: string;
  styleBlock: string;
  brandId?: string;
  infinityLoop: boolean;
  clipDuration: number;
  current: { title: string; script: string; scenes: { copy: string; visual: string; motion: string; transitionToNext: string; duration: number }[] };
}, auth: BrainAuth): Promise<StoryboardOut> {
  const prompt = `You are one of the best direct-response marketers in the world doing a RUTHLESS self-review and upgrade of this animated-ad storyboard. Treat it like a junior wrote it and you're making it a winner. Be honest — most first drafts are "fine," and "fine" loses on Meta.

${EVOLVE_PLAYBOOK}

${META_AD_CRAFT}

${COPY_PRINCIPLES}

${IMAGE_DIRECTION}

${EVAL_RUBRIC}

${brandContext(input.brandId)}

ANIMATION STYLE: ${input.styleName}
STYLE BLOCK (respected; not repeated inside scene visuals): ${input.styleBlock}
${input.infinityLoop ? "INFINITY LOOP MODE: the last scene must flow back into scene 1." : ""}

CURRENT STORYBOARD (JSON):
${JSON.stringify(input.current)}

Silently score it against the rubric, find the 2–3 biggest weaknesses (usually a soft hook, diluted idea, missing mechanism, asserted-not-recognized proof, or a surface-level desire), then output the IMPROVED full storyboard that fixes them — sharper hook that enters the conversation in their head, one big idea, a clear believable mechanism, recognized lived proof, the deeper real desire, cinematic fully-directed visuals. Keep what already works. Do not water it down to be "safe."

Return ONLY this JSON (same schema):
{"title": "...", "script": "full VO script", "styleBlock": "refined style block", "characterSheet": "consolidated character sheet paragraph (empty if none)", "scenes": [{"copy": "...", "visual": "...", "motion": "...", "transitionToNext": "...", "duration": ${input.clipDuration}}]}`;
  return parseJson<StoryboardOut>(await ask(prompt, auth));
}

/**
 * Prompt Helper: turn a rough idea (even a few words) into ONE polished, storyboard-ready
 * vision prompt that this app's brain renders well. Encodes what makes a great animated-ad
 * brief: a visual metaphor, a clear who + feeling, a scroll-stopping hook, an emotional arc,
 * concrete *animatable* imagery, a style, and an ending on the product.
 */
export async function craftVisionPrompt(idea: string, auth: BrainAuth): Promise<string> {
  const prompt = `You are one of the best paid-social creative directors in the world. You write the single best possible "vision" brief for an AI animated-ad generator. The user gives a rough idea; you return ONE tight, vivid paragraph (90–160 words) they can paste straight into the generator. It must be a SHARP concept — a specific person, one strong angle, a scroll-stopping hook — never a safe/generic idea.

${EVOLVE_PLAYBOOK}

${META_AD_CRAFT}

${COPY_PRINCIPLES}


A great vision brief for this tool always has:
- A clear THROUGH-LINE the whole ad is built around. Prefer the mechanism + recognizable real-life proof when the idea is science/claim-driven; use a visual metaphor ONLY if it genuinely clarifies an invisible idea and suits the product. Never bolt on a metaphor (a town, a mascot, weather) when the user wants the real thing shown.
- WHO it's for and the core EMOTION/desire (name the viewer and what they feel).
- A scroll-stopping HOOK for the very first moment.
- A simple EMOTIONAL ARC (e.g. frustrated → relieved → confident).
- Concrete, ANIMATABLE imagery shown on the real subject (states changing, a feature sharpening, a layer receding) — not abstract claims.
- The product's real USAGE RITUAL if relevant (e.g. a daily powder stirred into water), so the format reads right.
- A clear ENDING on the product / call-to-action.
- A note of the desired ANIMATION STYLE (default Pixar 3D if unspecified) and rough length (~30s).

Write it as flowing directive prose (not bullet points, not a storyboard — that comes later). Keep the user's product, audience, intent, AND chosen approach (if they asked for science/literal/proof, honor it — do not substitute an analogy). If the idea is vague, make confident, sensible creative choices rather than asking questions.

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
