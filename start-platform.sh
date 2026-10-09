#!/usr/bin/env bash
# ============================================================================
#  NITO SPORTS — one-command platform launcher (macOS / Linux)
# ----------------------------------------------------------------------------
#  On Windows use "Start NITO Platform.cmd" instead — double-click it.
#
#    ./start-platform.sh
#
#  Serves the website and the backend API from one process, then opens your
#  browser. Data is saved to data/platform-db.json and survives a restart.
# ============================================================================
set -u

cd "$(dirname "$0")" || exit 1

NODE=""
if command -v node >/dev/null 2>&1; then
  NODE="node"
fi

if [ -z "$NODE" ]; then
  echo
  echo "  Node.js was not found on this machine."
  echo "  Install it from https://nodejs.org (the LTS build), then run this again."
  echo "  Nothing else is needed — the platform has no other dependencies."
  echo
  exit 1
fi

exec "$NODE" "tools/server.js" "$@"
