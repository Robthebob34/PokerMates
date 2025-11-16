#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/pokermates/backend"
FRONTEND_DIR="$ROOT_DIR/pokermates/frontend"
BACKEND_PORT=3000
FRONTEND_PORT=5173

log() {
  printf '\033[1;34m[dev.sh]\033[0m %s\n' "$1"
}

kill_port() {
  local port="$1"
  if lsof -ti tcp:"$port" > /dev/null 2>&1; then
    log "Port $port in use — terminating process"
    lsof -ti tcp:"$port" | xargs kill -9
  else
    log "Port $port is free"
  fi
}

ensure_deps() {
  local dir="$1"
  local name="$2"
  if [ ! -d "$dir/node_modules" ]; then
    log "Installing $name dependencies (npm install)"
    (cd "$dir" && npm install)
  else
    log "$name dependencies already installed"
  fi
}

cleanup() {
  log "Stopping dev servers"
  if [[ -n "${BACKEND_PID:-}" ]] && ps -p "$BACKEND_PID" > /dev/null 2>&1; then
    kill "$BACKEND_PID" || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]] && ps -p "$FRONTEND_PID" > /dev/null 2>&1; then
    kill "$FRONTEND_PID" || true
  fi
}

trap cleanup EXIT

log "Killing ports if necessary"
kill_port "$BACKEND_PORT"
kill_port "$FRONTEND_PORT"

log "Ensuring dependencies are installed"
ensure_deps "$BACKEND_DIR" "backend"
ensure_deps "$FRONTEND_DIR" "frontend"

log "Starting backend (npm run dev)"
(
  cd "$BACKEND_DIR"
  npm run dev
) &
BACKEND_PID=$!

log "Starting frontend (npm run dev)"
(
  cd "$FRONTEND_DIR"
  npm run dev
) &
FRONTEND_PID=$!

log "Backend PID: $BACKEND_PID"
log "Frontend PID: $FRONTEND_PID"

log "Dev servers are running. Press Ctrl+C to stop both."

wait
