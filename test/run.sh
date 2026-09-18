#!/usr/bin/env bash
# Serve the game locally and play it through headless Chrome.
cd "$(dirname "$0")/.."
# test/serve.py, not `python3 -m http.server`: the stock server keeps a listen
# queue of five and resets connections when Chrome asks for several files at
# once, so a script can silently fail to load.
python3 test/serve.py 8766 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER; pkill -f "remote-debugging-port=93[45]1" 2>/dev/null' EXIT
sleep 1
node test/e2e.js || exit 1
echo
echo "=== the effects layer, Canvas renderer (no GPU) ==="
node test/fx.js || exit 1
echo
echo "=== the effects layer, WebGL renderer ==="
CDP_PORT=9351 CDP_WEBGL=1 node test/fx.js
