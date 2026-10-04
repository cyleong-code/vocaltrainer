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
