#!/usr/bin/env bash
# The checks to run before every commit, as one script, so that a
# person and CI run the same commands. Each check has caught a real regression.
#
#   tools/check.sh           check the files as they are
#   tools/check.sh --build   build twice first, and fail if the two builds differ
#
# Needs macOS: the QR check decodes through Vision, and the build makes its
# previews with qlmanage. Exits non-zero if any check fails; all of them run
# regardless, so one run reports everything that is wrong.
set -euo pipefail

cd "$(dirname "$0")/.."

# The URL every QR code must decode to. Change it only together with src/qr.js.
QR_URL='https://fcardinaux.github.io/study-templates/'

failed=0
step() { printf '\n== %s\n' "$1"; }
pass() { echo "ok: $1"; }
fail() { echo "FAIL: $1"; failed=1; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# 1. A rebuild with no source change must produce the same bytes. Compared here
#    run against run, rather than against the commit, because a different Chrome
#    version legitimately writes different bytes; locally, also check `git status`.
if [ "${1:-}" = --build ]; then
  step "Reproducible build"
  outputs() { shasum pdf/*.pdf previews/*.png catalog.json; }
  ./build.sh >/dev/null
  outputs > "$TMP/first"
  ./build.sh >/dev/null
  outputs > "$TMP/second"
  if diff "$TMP/first" "$TMP/second" >/dev/null; then
    pass "two builds are byte for byte the same"
  else
    fail "the second build differs from the first:"
    diff "$TMP/first" "$TMP/second" || true
  fi
fi

# 2. Chrome rasterises CSS gradients when printing, which once shipped the grids
#    as 72 dpi bitmaps. Every page must be pure vector.
step "No bitmaps"
with_images=$(for f in pdf/*.pdf; do
  n=$(strings "$f" | grep -c '/Subtype */Image' || true)
  [ "$n" = 0 ] || echo "$f"
done)
if [ -z "$with_images" ]; then pass "$(ls pdf/*.pdf | wc -l | tr -d ' ') PDFs, no images"
else fail "bitmaps in:"; echo "$with_images"; fi

# 3. Renaming files has broken the README's links twice.
step "README links every PDF, and only PDFs that exist"
grep -o 'pdf/[^)]*\.pdf' README.md | sort -u > "$TMP/linked"
ls pdf/*.pdf | sort > "$TMP/files"
if diff "$TMP/linked" "$TMP/files" >/dev/null; then pass "links and files match"
else
  fail "README and pdf/ disagree (< linked only, > file only):"
  diff "$TMP/linked" "$TMP/files" || true
fi

# 4. A subtly wrong QR looks fine, so it is decoded, on a page of each size.
step "QR decodes on every page size"
if swiftc -O tools/decode-qr.swift -o "$TMP/decode" 2>"$TMP/swiftc.log"; then
  for size in a4 3x4 letter; do
    page=$(ls pdf/*-"$size".pdf | head -1)
    sips -s format png --resampleWidth 2448 "$page" --out "$TMP/page.png" >/dev/null
    got=$("$TMP/decode" "$TMP/page.png" | sed -n 's/^payload *: //p')
    if [ "$got" = "$QR_URL" ]; then pass "$page"
    else fail "$page decodes to '${got:-nothing}'"; fi
  done
else
  fail "could not compile tools/decode-qr.swift"; cat "$TMP/swiftc.log"
fi

# 5. A note app lists a file by its title. Chrome writes titles as UTF-16 hex,
#    so they are decoded rather than grepped.
step "Every PDF titles itself"
if python3 - pdf/*.pdf <<'TITLES'
import re, sys
bad = []
for path in sys.argv[1:]:
    m = re.search(rb'/Title\s*<([0-9A-Fa-f]+)>|/Title\s*\(([^)]*)\)', open(path, 'rb').read())
    if not m:
        bad.append(f'{path}: no title'); continue
    title = bytes.fromhex(m[1].decode()).decode('utf-16') if m[1] else m[2].decode('latin-1')
    if not title.startswith('Chess: '):
        bad.append(f'{path}: "{title}"')
print('\n'.join(bad) or f'{len(sys.argv) - 1} titles')
sys.exit(1 if bad else 0)
TITLES
then pass "titles"; else fail "titles"; fi

# 6. The download page in every language is generated; a hand edit, or a
#    source change without a build, leaves it stale.
step "Download page is generated from src/site/"
if python3 tools/site.py --check; then pass "every language page is current"
else fail "generated pages are stale"; fi

# 7. The download page, driven in a browser, in every language.
step "Download page tests"
if tests/run.sh; then pass "page tests"; else fail "page tests"; fi

echo
if [ "$failed" = 0 ]; then echo "All checks passed."; else echo "Some checks FAILED."; fi
exit "$failed"
