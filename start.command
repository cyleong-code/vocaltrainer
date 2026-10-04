#!/bin/bash
# Mac: double-click this file to start SpeakWell on your own computer.
cd "$(dirname "$0")"
echo "SpeakWell: starting on your computer..."
if ! command -v node >/dev/null 2>&1; then
  echo
  echo "Node.js is not installed. Download the LTS version from https://nodejs.org, install it, then double-click this file again."
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi
if [ ! -f .env ]; then
  echo
  echo "Optional: add your AI keys. Paste a key and press Enter, or just press Enter to skip."
  echo "(Keys are saved only in a file called .env in this folder. Delete that file to start over.)"
  echo
  read -r -p "Anthropic key (coaching note + role-play partner): " ANTHROPIC_IN
  read -r -p "OpenAI key (transcription; press Enter to use the free browser path): " OPENAI_IN
  ANTHROPIC_IN="$(echo "$ANTHROPIC_IN" | tr -d '[:space:]')"
  OPENAI_IN="$(echo "$OPENAI_IN" | tr -d '[:space:]')"
  printf 'ANTHROPIC_API_KEY=%s\nOPENAI_API_KEY=%s\nPORT=3000\n' "$ANTHROPIC_IN" "$OPENAI_IN" > .env
  chmod 600 .env
  echo "Saved."
fi
if [ ! -d node_modules ]; then
  echo "First run: downloading the app's two building blocks (takes about a minute)..."
  npm install --omit=dev || { echo "Install failed. Check your internet connection and try again."; read -n 1 -s -r -p "Press any key to close."; exit 1; }
fi
echo
echo "Opening http://localhost:3000 in your browser. Keep this window open while you use the app."
echo "To stop: close this window or press Ctrl+C."
echo
( sleep 2; open "http://localhost:3000" ) &
npm start
