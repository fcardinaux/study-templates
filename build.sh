#!/usr/bin/env bash
# Regenerates every template PDF from src/ and refreshes the README previews.
#
# Chrome is driven headless over a local HTTP server: the sources are ES
# modules, which browsers refuse to load from file:// URLs.
set -euo pipefail

cd "$(dirname "$0")"

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
[ -x "$CHROME" ] || { echo "Chrome not found at: $CHROME" >&2; echo "Set CHROME=/path/to/chrome" >&2; exit 1; }

# Chrome stamps the moment of the run into every PDF, so an unchanged source
# still produced a new file on every build. Both dates are rewritten to a fixed
# value afterwards, which makes the build reproducible: a diff under pdf/ now
# means the artwork really changed.
PDF_DATE="${PDF_DATE:-D:20260101000000+00'00'}"

TEMPLATES=(
  chess-1-board-top-left
  chess-1-board-top-right
  chess-3-boards-alternate
  chess-3-boards-alternate-right-first
  chess-3-boards-left
  chess-3-boards-right
  chess-cornell-crosshairs
  chess-cornell-crosshairs-cue-right
  chess-cornell-dots
  chess-cornell-dots-cue-right
  chess-scoresheet
)

# Page sizes at 96 dpi, as "<suffix>:<width>x<height>".
#   -a4      210 x 297mm
#   -3x4     8.0 x 10.67in portrait, matching a 13.3in 4:3 e-ink panel
#   -letter  8.5 x 11in, US Letter
PAGES=("-a4:795x1124" "-3x4:768x1024" "-letter:816x1056")

# Board labelling. The squares are the same in all three.
VIEWS=(white-view black-view no-coords)

# The scoresheet's diagrams are too small to label, and with no coordinates the
# three views would be the same page under three names, so it is built once.
views_for() {
  case "$1" in
    chess-scoresheet) echo no-coords ;;
    *) echo "${VIEWS[@]}" ;;
  esac
}

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
trap '{ kill $SERVER; wait $SERVER; } 2>/dev/null || true; rm -rf "$PROFILE" 2>/dev/null || true' EXIT

# <template> <view> <width> <height> <page size> <output file>. The page size is
# passed through so the PDF can title itself the way its filename reads.
render() {
  "$CHROME" --headless --disable-gpu --no-sandbox \
    --user-data-dir="$PROFILE" \
    --virtual-time-budget=4000 \
    --no-pdf-header-footer \
    --print-to-pdf="$6" \
    "http://127.0.0.1:$PORT/src/render.html?t=${1}&v=${2}&w=${3}&h=${4}&p=${5}" \
    >/dev/null 2>&1
  printf '  %-64s %7s bytes\n' "$6" "$(wc -c < "$6" | tr -d ' ')"
}

for page in "${PAGES[@]}"; do
  suffix="${page%%:*}"
  dims="${page##*:}"
  w="${dims%x*}"
  h="${dims#*x}"
  size="${suffix#-}"
  for t in "${TEMPLATES[@]}"; do
    for v in $(views_for "$t"); do
      render "$t" "$v" "$w" "$h" "$size" "pdf/${t}-${v}${suffix}.pdf"
    done
  done
  # Every layout in one file, a page each, for importing the set in one go. These
  # are an addition to the single-layout files, not a replacement for them.
  for v in "${VIEWS[@]}"; do
    render all "$v" "$w" "$h" "$size" "pdf/chess-all-layouts-${v}${suffix}.pdf"
  done
done

# The replacement is the same length as the stamp it overwrites, so every byte
# offset in the cross-reference table stays valid without rebuilding it.
echo "Normalising timestamps"
python3 - "$PDF_DATE" pdf/*.pdf <<'NORM'
import re, sys

date, paths = sys.argv[1].encode(), sys.argv[2:]
stamp = re.compile(rb"/(CreationDate|ModDate) \(D:[^)]*\)")

for path in paths:
    with open(path, 'rb') as f:
        raw = f.read()
    out, n = stamp.subn(lambda m: b"/%s (%s)" % (m.group(1), date), raw)
    if n != 2 or len(out) != len(raw):
        sys.exit(f"{path}: expected two same-length date stamps, found {n}")
    if out != raw:
        with open(path, 'wb') as f:
            f.write(out)
NORM

# The download page lists files from this rather than knowing them itself, so a
# new layout or page size shows up there without touching the page. Sizes are
# stable because the PDFs are.
echo "Writing catalog"
python3 - pdf/*.pdf > catalog.json <<'CAT'
import json, os, sys
files = [{"file": p, "bytes": os.path.getsize(p)} for p in sorted(sys.argv[1:])]
json.dump(files, sys.stdout, indent=1)
print()
CAT

# Previews illustrate the layouts in the README, so they use the coordinate-free
# view: at 300px wide the labels are about 3px tall and read as speckle, not text.
echo "Refreshing previews"
mkdir -p previews
for t in "${TEMPLATES[@]}"; do
  rm -f "previews/${t}.png"
  qlmanage -t -s 1000 -o previews "pdf/${t}-no-coords-a4.pdf" >/dev/null 2>&1
  mv "previews/${t}-no-coords-a4.pdf.png" "previews/${t}.png"
done

# The image a link to the download page shows when shared, made from the
# previews above, at the 1200x630 that link previews expect.
echo "Refreshing social card"
"$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --user-data-dir="$PROFILE" --virtual-time-budget=4000 \
  --window-size=1200,630 --screenshot=previews/social.png \
  "http://127.0.0.1:$PORT/src/social.html" >/dev/null 2>&1
echo "Done."
