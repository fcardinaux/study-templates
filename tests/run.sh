#!/usr/bin/env bash
# Runs the download-page tests in tests/page.html under headless Chrome and
# prints one line per test. Exits non-zero if any test fails, or if the run
# never finishes. Needs Chrome and Python 3, like the build; the zip test also
# needs network access, to fetch the zip library the page itself loads.
set -euo pipefail

cd "$(dirname "$0")/.."

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
[ -x "$CHROME" ] || { echo "Chrome not found at: $CHROME" >&2; exit 1; }

PORT=${PORT:-8732}
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
PROFILE=$(mktemp -d)
trap '{ kill $SERVER; wait $SERVER; } 2>/dev/null || true; rm -rf "$PROFILE"' EXIT
for _ in $(seq 40); do
  curl -sf "http://127.0.0.1:$PORT/tests/page.html" >/dev/null && break
  sleep 0.1
done

# The budget is virtual time, which only runs while the page is idle, so it
# bounds the run without making a fast run wait for it.
DOM=$("$CHROME" --headless --disable-gpu --no-sandbox \
  --user-data-dir="$PROFILE" --virtual-time-budget=120000 \
  --dump-dom "http://127.0.0.1:$PORT/tests/page.html" 2>/dev/null)

python3 - "$DOM" <<'REPORT'
import html, re, sys

dom = sys.argv[1]
for li in re.findall(r'<li class="(?:pass|fail)".*?</li>', dom, re.S):
    line = html.unescape(re.sub(r'<div class="why">.*?</div>', '', li, flags=re.S))
    print('  ' + re.sub(r'<[^>]+>', '', line).strip())
summary = re.search(r'<pre id="summary">(.*?)</pre>', dom)
status = summary.group(1) if summary else 'no summary'
print(status)
if not status.startswith('DONE') or ' 0 failed' not in status:
    sys.exit(1)
REPORT
