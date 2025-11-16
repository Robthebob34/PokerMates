#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT=3000
FRONTEND_PORT=5173

log() {
  printf '\033[1;31m[stop.sh]\033[0m %s\n' "$1"
}

kill_port() {
  local port="$1"
  if lsof -ti tcp:"$port" > /dev/null 2>&1; then
    log "Killing process on port $port"
    lsof -ti tcp:"$port" | xargs kill -9
  else
    log "No process on port $port"
  fi
}

kill_port "$BACKEND_PORT"
kill_port "$FRONTEND_PORT"

log "Attempting to stop npm dev processes"
pkill -f "npm run dev" >/dev/null 2>&1 || true

log "All dev processes terminated"
