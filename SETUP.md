# Sun God ☀ Studio — Setup (your own private copy)

This is your **own copy** of Sun God Studio. It runs on your computer, with **your** accounts and **your** keys. Nothing is shared with anyone — your keys never leave your machine.

You'll do a one-time setup (~10 minutes), then it's a double-click to start.

---

## What you need

1. **Node.js** — the engine the app runs on. Get the **LTS** version at **[nodejs.org](https://nodejs.org)** and install it (just click through).
2. **A Higgsfield account** — this generates the images and videos. Sign up at [higgsfield.ai](https://higgsfield.ai). (You'll connect it inside the app — no keys to copy.)
3. **An Anthropic API key** — this powers the storyboard "brain."
   - Go to **[console.anthropic.com](https://console.anthropic.com)** → **Billing** → add a small credit (~$5 is plenty).
   - Then **API Keys → Create Key** → copy the key that starts with `sk-ant-…`.
   - ⚠️ Keep this key private — paste it only into this app, nowhere else.
4. **ffmpeg** (optional) — only needed for the final "stitch into one video" step. On Mac: install [Homebrew](https://brew.sh), then run `brew install ffmpeg`.

---

## Start the app

### Mac
Double-click **`start.command`** in this folder.
- The first time, it installs everything (a few minutes) — that's normal.
- After that it opens **http://localhost:3000** in your browser.
- Keep the little black window open while you use the app. Close it to stop.

> If macOS says it "can't be opened," right-click `start.command` → **Open** → **Open** (just the first time).

### Windows / Linux (or if the double-click doesn't work)
Open a terminal in this folder and run:
```bash
npm install      # first time only
npm run dev
```
Then open **http://localhost:3000**.

---

## First time in the app

1. Click **Create one** on the login screen and make your account. **The first account you create becomes the owner of your copy** — that's you.
2. In the sidebar, click **Connect Higgsfield** and sign in with your Higgsfield account.
3. Go to **Settings → Your Anthropic API key**, paste your `sk-ant-…` key, and save.
4. Go to **Dashboard**, describe your ad idea, and hit **Create storyboard →**.

That's it — you're making animated ads on your own keys.

---

## Staying safe (please do this)
Set a **spending limit** on your Anthropic account: console.anthropic.com → **Settings → Limits** → set a monthly cap (e.g. $20). Then there's no way to ever overspend. Higgsfield has its own credit balance, so that's naturally capped too.

## How it works (the short version)
Idea → the brain writes a **storyboard** → you generate a keyframe image per scene and approve the ones you like → **Kling 3.0** animates a clip from each approved scene into the next (that's the smooth "morph" transition) → ffmpeg stitches them into one 9:16 video. Everything you make is saved locally in a `data/` folder.

Enjoy. ☀
