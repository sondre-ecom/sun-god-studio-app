# Sun God ☀ Studio — AI Animated Ad Studio

A real, multi-user web app that turns an idea into a finished Pixar-style (or claymation / anime / felt / paper-cutout / LEGO / your own) animated video ad. Claude is the brain; Higgsfield is the render farm.

## The pipeline

1. **Dashboard** → describe the idea, pick a brand, animation style, image model, scene count, and (optionally) Infinity Loop. The brain writes a storyboard.
2. **Project pipeline** → storyboard table (scene · copy · visual · transition). Generate 1–4 keyframe variants per scene with **Nano Banana Pro (4K)** or **GPT Image 2 (high)**, approve one, or hit **Give feedback** to have the brain rewrite the prompt and regenerate. Scene 1's approved still is fed as a reference into the others for consistency.
3. **Transitions** → once every scene is approved, **Kling 3.0** renders a clip per cut that *starts on one approved scene and ends on the next* — the morph between frames IS the transition.
4. **Infinity Loop canvas** → the chain as a node graph: scene → morph → scene → morph… plus, if enabled, a loop edge where the last scene morphs back into the first.
5. **Assemble** → ffmpeg stitches the clips into one 9:16 MP4. Everything lands in the **Library**.

## Accounts & privacy

- **Per-user logins.** Each person gets their own account. **Members** see only their own ads, characters, and brands; **admins** see and manage everything (Admin tab).
- The first admin is seeded from `ADMIN_USER` / `ADMIN_PASS` on first boot. Add more users in **Admin**.
- The **Higgsfield renderer is one shared connection** (your account renders for everyone) — connect it once from the sidebar.

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000
```

- Sign in with `admin` / `changeme` (override with `ADMIN_USER` / `ADMIN_PASS`).
- Click **Connect Higgsfield** in the sidebar and sign in with your Higgsfield account (OAuth — no API keys to paste).
- Local brain uses your **Claude Code login** (no API key). For the cloud, set `ANTHROPIC_API_KEY`.
- ffmpeg required for final assembly (`brew install ffmpeg`).

## Deploy to a public URL (Render — recommended)

Always-on `https://…` URL, works whether or not your Mac is on.

1. Push this folder to a GitHub repo.
2. On [render.com](https://render.com): **New → Blueprint** → pick the repo (it reads `render.yaml`). Or **New → Web Service → Docker**.
3. Set these environment variables:
   - `ANTHROPIC_API_KEY` — your Anthropic key (powers the brain in the cloud).
   - `AUTH_SECRET` — random string for signing sessions (Render can auto-generate).
   - `ADMIN_USER` / `ADMIN_PASS` — your first admin login.
   - `APP_URL` — set to your Render URL after first deploy, e.g. `https://sun-god-studio.onrender.com` (this is the Higgsfield OAuth redirect base), then redeploy.
4. The blueprint mounts a **5 GB persistent disk at `/data`** (`DATA_DIR=/data`) for the database and generated media. ffmpeg is in the image.
5. Open the URL, sign in, then **Connect Higgsfield** once (OAuth redirects back to `${APP_URL}/api/higgsfield/callback`).

> Railway works the same way: deploy the Dockerfile, add a Volume mounted at `/data`, and set the same env vars.

## Notes
- Prompts that risk being flagged automatically get an educational/authorized-use disclaimer prepended so legitimate animated creative isn't needlessly blocked.
- Data lives in `${DATA_DIR}/db.json`; generated media in `${DATA_DIR}/media/`. Both are on the persistent disk in the cloud, and gitignored locally.
- Brain model: defaults to `claude-fable-5`; override with `BRAIN_MODEL`.
