#!/usr/bin/env bash
# Records the film scenes from the real app on a virtual 2880x1800 display (the 1440x900 window at 2x fills it).
#
#   capture/record.sh                  record all scenes
#   capture/record.sh s3-chat s5-fanout  record some
#   OPENDOT_SCENE_THEME=dark capture/record.sh s1-sidebar
#
# Needs: Xvfb, ffmpeg, and the app built (cd <app> && npm run build). Output: capture/out/<scene>.mp4 + .cursor.json,
# copied to public/film/raw/.
set -euo pipefail
cd "$(dirname "$0")"
SITE_DIR="$(cd .. && pwd)"
ALL=(s1-sidebar s2-describe s3-chat s4-alwayson s5-fanout s6-approval s7-links s8-privacy)
SCENES=("$@")
[[ ${#SCENES[@]} -eq 0 ]] && SCENES=("${ALL[@]}")

export DISPLAY=:99
Xvfb :99 -screen 0 2880x1800x24 -nolisten tcp -ac >/dev/null 2>&1 &
XVFB=$!
trap 'kill $XVFB 2>/dev/null || true' EXIT
for _ in $(seq 1 50); do
  ffmpeg -hide_banner -loglevel quiet -f x11grab -video_size 64x64 -i :99 -frames:v 1 -f null - 2>/dev/null && break
  sleep 0.2
done

mkdir -p out "$SITE_DIR/public/film/raw"
[[ -n "${REUSE_SEEDS:-}" ]] || npx tsx seed/build-all.ts
for s in "${SCENES[@]}"; do
  echo "== $s"
  npx tsx "scenes/$s.ts" || { echo "scene $s failed"; pkill -x ffmpeg || true; continue; }
  cp "out/$s.mp4" "out/$s.cursor.json" "out/$s.marks.json" "$SITE_DIR/public/film/raw/"
done
echo "done: $SITE_DIR/public/film/raw"
