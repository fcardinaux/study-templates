#!/usr/bin/env bash
# Runs the download-page tests in tests/page.html under headless Chrome and
# prints one line per test. Exits non-zero if any test fails, or if the run does
# not finish within TIMEOUT seconds. Needs Chrome and Python 3, like the build;
# the zip test also needs network access, to fetch the zip library the page
# itself loads.
#
# The page reports each result to this script's server as it finishes, and the
# script waits in real time for the last one. An earlier version had Chrome dump
# the page after a "virtual time" budget instead, which a slow machine used up
# while the page polled for network results, cutting the run short.
set -euo pipefail

cd "$(dirname "$0")/.."

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
[ -x "$CHROME" ] || { echo "Chrome not found at: $CHROME" >&2; exit 1; }

PORT=${PORT:-8732}
TIMEOUT=${TIMEOUT:-180}
WORK=$(mktemp -d)
REPORT="$WORK/report"
touch "$REPORT"

# A static server for the repository that also accepts the page's reports.
python3 - "$PORT" "$REPORT" >/dev/null 2>&1 <<'SERVER' &
import http.server, sys

port, report = int(sys.argv[1]), sys.argv[2]

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/__report':
            self.send_error(404); return
        line = self.rfile.read(int(self.headers['Content-Length'])).decode()
        with open(report, 'a') as f:
            f.write(line.replace('\n', ' ') + '\n')
        self.send_response(204); self.end_headers()

http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
SERVER
SERVER=$!
CHROME_PID=
trap '{ kill $SERVER ${CHROME_PID:-}; wait $SERVER ${CHROME_PID:-}; } 2>/dev/null || true; rm -rf "$WORK"' EXIT
for _ in $(seq 40); do
  curl -sf "http://127.0.0.1:$PORT/tests/page.html" >/dev/null && break
  sleep 0.1
done

# Remote debugging keeps headless Chrome open on the page until it is killed.
"$CHROME" --headless --disable-gpu --no-sandbox --user-data-dir="$WORK/profile" \
  --remote-debugging-port=0 "http://127.0.0.1:$PORT/tests/page.html" >/dev/null 2>&1 &
CHROME_PID=$!

end=$((SECONDS + TIMEOUT))
until grep -q '^DONE' "$REPORT"; do
  if [ $SECONDS -ge $end ]; then
    { grep -v '^START' "$REPORT" || true; } | sed 's/^/  /'
    echo "TIMED OUT after ${TIMEOUT}s, during: $({ grep '^START' "$REPORT" || echo 'START the page loading'; } | tail -1 | cut -c7-)"
    exit 1
  fi
  sleep 0.2
done

{ grep -v '^START\|^DONE' "$REPORT" || true; } | sed 's/^/  /'
summary=$(grep '^DONE' "$REPORT")
echo "$summary"
[[ "$summary" == *" 0 failed" ]]
