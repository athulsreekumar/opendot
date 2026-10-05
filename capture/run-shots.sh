#!/usr/bin/env bash
# Build fresh seeds and take every still. Usage: capture/run-shots.sh [--only a,b] [--theme light|dark] [--reuse]
set -euo pipefail
cd "$(dirname "$0")"
args=("$@")
if [[ " ${args[*]} " != *" --reuse "* ]]; then
  xvfb-run -a -s "-screen 0 2880x1800x24" npx tsx seed/build-all.ts
  args+=(--reuse)
fi
exec xvfb-run -a -s "-screen 0 2880x1800x24" npx tsx shots.ts "${args[@]}"
