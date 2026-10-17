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

# Page sizes at 96 dpi, as "<suffix>:<width>x<height>".
#   -a4    210x297mm
#   -3x4   8.0 x 10.67in portrait, matching a 13.3in 4:3 e-ink panel
PAGES=("-a4:795x1124" "-3x4:768x1024")

# Board labelling. The squares are the same in all three.
VIEWS=(white-view black-view no-coords)

PORT=${PORT:-8731}
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 40); do
  curl -sf "http://127.0.0.1:$PORT/src/render.html" >/dev/null && break
  sleep 0.1
done

mkdir -p pdf
PROFILE=$(mktemp -d)
trap 'kill $SERVER 2>/dev/null || true; rm -rf "$PROFILE"' EXIT

for page in "${PAGES[@]}"; do
  suffix="${page%%:*}"
  dims="${page##*:}"
  w="${dims%x*}"
  h="${dims#*x}"
  for t in "${TEMPLATES[@]}"; do
    for v in "${VIEWS[@]}"; do
      out="pdf/${t}-${v}${suffix}.pdf"
      "$CHROME" --headless --disable-gpu --no-sandbox \
        --user-data-dir="$PROFILE" \
        --virtual-time-budget=4000 \
        --no-pdf-header-footer \
        --print-to-pdf="$out" \
        "http://127.0.0.1:$PORT/src/render.html?t=${t}&v=${v}&w=${w}&h=${h}" \
        >/dev/null 2>&1
      printf '  %-50s %7s bytes\n' "$out" "$(wc -c < "$out" | tr -d ' ')"
    done
  done
done

# Previews illustrate the layouts in the README; one size is enough.
echo "Refreshing previews"
mkdir -p previews
for t in "${TEMPLATES[@]}"; do
  rm -f "previews/${t}.png"
  qlmanage -t -s 1000 -o previews "pdf/${t}-white-view-a4.pdf" >/dev/null 2>&1
  mv "previews/${t}-white-view-a4.pdf.png" "previews/${t}.png"
done
echo "Done."
