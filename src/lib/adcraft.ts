/**
 * Elite Meta-ad concept engine + image direction for the brain.
 * General craft (no brand specifics). This is what separates a scroll-stopping 2026
 * Meta ad from a generic one, and a premium AI still from a default-looking one.
 */

export const META_AD_CRAFT = `
HOW META ADS ACTUALLY WIN IN 2026 (internalize before writing a single scene):

THE ALGORITHM REWARDS THE CREATIVE. Meta's delivery (Advantage+/Andromeda) finds the audience for you — so the CREATIVE is the targeting. The job is not "describe the product." The job is to stop a specific person's thumb and make them feel something in the first 2 seconds. A safe, generic, "nice" ad is the worst outcome — it gets no signal. Bold, specific, and a little uncomfortable beats polished and forgettable.

DEVELOP THE CONCEPT BEFORE THE SCENES. Top marketers don't start with "scene 1." They lock:
  1. WHO exactly (one specific person + the precise moment/feeling they're in — not "people who train" but "the lifter who's eaten clean for 8 weeks and still looks soft in the mirror").
  2. THE ONE ANGLE (the single sharp idea — a reframe, a callout, a contrarian truth, a hidden mechanism). One ad = one idea. Kill the second idea.
  3. THE HOOK (the first 1–2 seconds — see archetypes). The hook is 80% of the ad. Write it to stop the *exact* person in WHO.
  4. THE MECHANISM + PROOF (why it's true, and proof they already recognize from their own life).
  5. THE FORMAT (which archetype below fits).
Silently consider 2–3 different angles, then BUILD ON THE SHARPEST ONE. Do not produce the obvious/first idea.

HOOK ARCHETYPES (pick the one that fits; make the FIRST frame deliver it):
  • Callout — name the exact person + symptom ("If you train hard but still look soft, watch this").
  • Curiosity gap / open loop — tease the real reason without revealing it ("The reason your abs show in the morning and vanish by lunch").
  • Contrarian / myth-bust — attack what they believe ("Stop cutting. More cardio won't fix this.").
  • Visual anomaly / pattern interrupt — a striking or "wait, what?" image in frame 1 (the style itself helps, but the IMAGE must be unusual).
  • Relatable confession / POV — drop them into a moment they live ("POV: you flex in the mirror and feel nothing but disappointment").
  • Demonstration / "watch this" — show the mechanism happening literally.
  • Recognized proof — surface a lived experience they can't deny and reattribute it.

2026 CRAFT RULES:
  • First 2 seconds win or lose. No slow intros, no logo openers, no throat-clearing. Open ON the hook.
  • Sound-off by default — the idea must read with eyes only (on-screen action + text), audio is a bonus.
  • Native > polished. The best ads don't look like ads. Even an animated ad should feel like a story someone *made*, not a corporate spot.
  • One idea, specific and concrete. Specifics are believed; "improve your body" is skipped.
  • Tension → relief. Earn the product reveal; don't lead with it.
  • End on the product as the lever + a clear, single next step.
  • The animation style is a pattern-interrupt bonus — but the IDEA must carry the ad. Never rely on "it looks cool."

THE BAR: before finalizing, ask "would a sharp media buyer stop scrolling on scene 1, and would they bet money this gets watched to the end?" If not, sharpen the hook and the angle.
`.trim();

export const IMAGE_DIRECTION = `
WRITING THE KEYFRAME "visual" PROMPTS (make each still look premium, not default-AI):
Each scene's "visual" must be a fully-directed shot, not a label. Always specify:
  • SUBJECT + a SPECIFIC EMOTION on the face (not "a man" but "a lean man, jaw tight, a flicker of disbelief in his eyes").
  • FRAMING for 9:16 mobile — subject large in frame, clear focal point, strong vertical composition, headroom considered.
  • LIGHTING — motivated and directional (window light, golden hour, hard rim light, soft key), with shadow and depth. Never flat, even, lifeless light.
  • LENS / DEPTH — shallow depth of field, subject in crisp focus, background softly separated; a sense of a real camera.
  • DETAIL + MATERIAL — skin/fabric/surface texture, environment specifics that sell the world.
  • MOOD / COLOR — a deliberate grade that matches the emotional beat.
Keep continuity: same character, same wardrobe, same world across scenes. Direct each frame like a cinematographer.
`.trim();

/** Appended to every image prompt to push premium production quality across models. */
export const QUALITY_SUFFIX =
  "Cinematic directional lighting with soft shadow falloff, shallow depth of field, the subject's face in crisp focus with a genuine specific expression, rich material and texture detail, deliberate filmic color grade, strong 9:16 vertical composition with the subject prominent, premium high-detail production quality. Avoid: flat even lighting, blank or dead eyes, plastic over-smoothed skin, garbled text, extra fingers or limbs, watermarks, generic stock-photo feel.";
