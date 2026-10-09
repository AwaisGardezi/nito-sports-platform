#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# NITO SPORTS — full regression suite
#
#   bash tests/run-tests.sh
#
# Starts a local static server on :8099 if one is not already listening, runs
# every test exactly once, prints a summary and exits non-zero on any failure.
#
# Exception: `local-backend-test.js` is self-contained. It spawns tools/server.js
# itself on :8842 against a THROWAWAY database (--data in the temp dir), so it
# neither needs nor touches the :8099 server or the owner's data/platform-db.json.
# ---------------------------------------------------------------------------
set -u

ROOT="C:/Users/PcR/OneDrive/Desktop/Sports Platform"
PORT=8099
NODE_DEFAULT="C:/Users/PcR/.local-node/binaries/node/versions/22.22.2-6/node.exe"
PY="C:/Users/PcR/.local-node/binaries/python/versions/3.13.12/python.exe"

if [ -x "$NODE_DEFAULT" ]; then NODE="$NODE_DEFAULT"; else NODE="node"; fi

cd "$ROOT" || exit 1

# ---- loopback must not go through a proxy ---------------------------------
# This shell sets http_proxy/https_proxy but NOT no_proxy, so every request to
# 127.0.0.1 was being sent to the proxy, which cannot reach loopback and answers
# 502. That made the readiness probe below believe a server was already up, so
# the runner never started one and every browser suite died with an opaque
# CdpFrame.goto stack. Explicitly bypass the proxy for loopback.
export no_proxy="127.0.0.1,localhost,::1"
export NO_PROXY="127.0.0.1,localhost,::1"
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY

# ---- server ---------------------------------------------------------------
# "Is anything listening?" is NOT the same question as "can I fetch a page?".
# A proxy, a stale socket, or any unrelated listener can answer the port and
# still return an error. So probe for a real HTML page and judge it by code.
server_up() {
  code="$(curl -s -o /dev/null -w '%{http_code}' --noproxy '*' \
          "http://127.0.0.1:$PORT/index.html" 2>/dev/null)"
  [ "$code" = "200" ]
}

STARTED=0
SERVER_PID=""
if ! server_up; then
  if [ -x "$PY" ]; then
    "$PY" -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
  else
    python -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
  fi
  SERVER_PID=$!
  STARTED=1
  READY=0
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    sleep 0.5
    if server_up; then READY=1; break; fi
  done
  if [ "$READY" -ne 1 ]; then
    echo "FATAL: no static server answering on 127.0.0.1:$PORT — every browser"
    echo "       suite would fail for the wrong reason. Something else is holding"
    echo "       the port, or the server could not start. Free the port and retry."
    cleanup() { [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null; }
    exit 2
  fi
fi

cleanup() { [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null; }
trap cleanup EXIT

# ---- suite ----------------------------------------------------------------
NAMES=(
  "smoke — pages render, no console errors"
  "enquiry — every field reaches WhatsApp with an order ref"
  "admin — console: sign-in gate, add, edit, persist, delete"
  "export — publish to website round-trips catalog.js"
  "add-product — console to live site, end to end"
  "logo — real artwork everywhere, no 404s"
  "console — login, session survives a new tab, owner role, viewer refused"
  "live-data — public site reads the published catalogue; drafts held back"
  "console-ui — 8 console screens: icons sized, no overflow, density holds"
  "product-images — upload → store → save → grid → export round trip"
  "enquiry-pipeline — contact form → capture → console inbox → CSV export"
  "staff-login — one staff account, no create-account anywhere"
  "local-backend — the one-click server IS a backend, and says so honestly"
  "layout — no horizontal overflow, 9 pages x 6 widths"
  "sticky — nav and sidebar stick, reveals fire"
  "a11y — accessibility and quality audit"
)
FILES=(
  smoke-test.js
  enquiry-test.js
  admin-test.js
  export-test.js
  add-product-test.js
  logo-check.js
  console-test.js
  live-data-test.js
  console-ui-test.js
  product-images-test.js
  enquiry-pipeline-test.js
  staff-login-test.js
  local-backend-test.js
  layout-guard.js
  sticky-scroll-test.js
  a11y-audit.js
)

PASS=0
FAIL=0
FAILED_NAMES=""

echo "======================================================================"
echo " NITO SPORTS regression suite"
echo "======================================================================"

for i in "${!FILES[@]}"; do
  name="${NAMES[$i]}"
  file="${FILES[$i]}"
  printf '\n--- %s\n' "$name"
  # Capture first: `if cmd | tail` would test tail's exit status, not the test's.
  out="$("$NODE" "tests/$file" 2>&1)"
  code=$?
  if [ "$code" -eq 0 ]; then
    printf '%s\n' "$out" | tail -n 5
    printf '    >>> PASS\n'
    PASS=$((PASS + 1))
  else
    # On failure print the FAILING LINES, not just the tail. The tail of a failed
    # suite is its summary ("FAILURES: 3"), which says how many broke but never
    # which check or why. Keeping the full log lets the next reader diagnose
    # instead of re-running and guessing.
    printf '%s\n' "$out" | grep -E '✗|FAIL|Error|error:|✘' | head -n 20
    LOGDIR="tests/test-logs"
    mkdir -p "$LOGDIR"
    printf '%s\n' "$out" > "$LOGDIR/${file%.js}.log"
    printf '    (full output: %s)\n' "$LOGDIR/${file%.js}.log"
    printf '    >>> FAIL (exit %s)\n' "$code"
    FAIL=$((FAIL + 1))
    FAILED_NAMES="$FAILED_NAMES ${file%.js}"
  fi
done

echo
echo "======================================================================"
echo " $PASS passed, $FAIL failed"
[ "$FAIL" -gt 0 ] && echo " failing:$FAILED_NAMES"
echo "======================================================================"

[ "$FAIL" -gt 0 ] && exit 1
exit 0
