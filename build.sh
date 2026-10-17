#!/usr/bin/env bash
# Regenerates every template PDF from src/ and refreshes the README previews.
#
# Chrome is driven headless over a local HTTP server: the sources are ES
# modules, which browsers refuse to load from file:// URLs.
set -euo pipefail

cd "$(dirname "$0")"

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
[ -x "$CHROME" ] || { echo "Chrome not found at: $CHROME" >&2; echo "Set CHROME=/path/to/chrome" >&2; exit 1; }

TEMPLATES=(
  chess-1-board-top-left
  chess-3-boards-alternate
  chess-3-boards-left
  chess-cornell-crosshairs
  chess-cornell-dots
)

# A4 at 96 dpi. Add further page sizes as "<suffix>:<width>x<height>".
PAGES=("${PAGES:-:795x1124}")

PORT=${PORT:-8731}
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 40); do
  curl -sf "http://127.0.0.1:$PORT/src/render.html" >/dev/null && break
  sleep 0.1
done

PROFILE=$(mktemp -d)
trap 'kill $SERVER 2>/dev/null || true; rm -rf "$PROFILE"' EXIT

for page in "${PAGES[@]}"; do
  suffix="${page%%:*}"
  dims="${page##*:}"
  w="${dims%x*}"
  h="${dims#*x}"
  for t in "${TEMPLATES[@]}"; do
    out="${t}${suffix}.pdf"
    "$CHROME" --headless --disable-gpu --no-sandbox \
      --user-data-dir="$PROFILE" \
      --virtual-time-budget=4000 \
      --no-pdf-header-footer \
      --print-to-pdf="$out" \
      "http://127.0.0.1:$PORT/src/render.html?t=${t}&w=${w}&h=${h}" \
      >/dev/null 2>&1
    printf '  %-34s %6s bytes\n' "$out" "$(wc -c < "$out" | tr -d ' ')"
  done
done

echo "Refreshing previews"
mkdir -p previews
for t in "${TEMPLATES[@]}"; do
  rm -f "previews/${t}.png"
  qlmanage -t -s 1000 -o previews "${t}.pdf" >/dev/null 2>&1
  mv "previews/${t}.pdf.png" "previews/${t}.png"
done
echo "Done."
