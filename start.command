#!/bin/bash
# Sun God Studio — double-click launcher (macOS).
# First run installs everything; after that it just starts the app.
cd "$(dirname "$0")" || exit 1

echo "☀  Sun God Studio"
echo "-------------------------------------"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js isn't installed yet."
  echo "1) Go to https://nodejs.org and install the LTS version."
  echo "2) Then double-click this file again."
  read -r -p "Press Enter to close..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First-time setup — installing (this takes a few minutes)…"
  npm install || { echo "Install failed. Make sure you have internet, then try again."; read -r -p "Press Enter to close..."; exit 1; }
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Note: ffmpeg isn't installed. Everything works except the final 'Assemble' step."
  echo "      To enable it later: install Homebrew (brew.sh), then run: brew install ffmpeg"
fi

echo ""
echo "Starting… your browser will open at http://localhost:3000"
echo "Keep this window open while you use the app. Close it to stop."
echo ""
( sleep 5; open http://localhost:3000 ) &
npm run dev
