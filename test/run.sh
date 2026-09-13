#!/usr/bin/env bash
# Serve the game locally and play it through headless Chrome.
cd "$(dirname "$0")/.."
python3 -m http.server 8766 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER; curl -s http://127.0.0.1:9341/json/close >/dev/null; pkill -f "remote-debugging-port=9341" 2>/dev/null' EXIT
sleep 1
node test/e2e.js
