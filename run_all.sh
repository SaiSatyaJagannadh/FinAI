#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "== Starting backend (server) =="
cd "$ROOT_DIR/server"
if [ ! -f package.json ]; then
  echo "server/package.json not found" >&2
  exit 1
fi
npm install
npm run server &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Give backend a moment
sleep 2

echo "== Building frontend (client) =="
cd "$ROOT_DIR/client"
if [ ! -f package.json ]; then
  echo "client/package.json not found" >&2
  exit 1
fi
npm install
npm run build

echo "== Running frontend (client) =="
# Option 1: run dev server (uncomment next line)
# npm start

# Option 2: serve production build (recommended)
if command -v serve >/dev/null 2>&1; then
  serve -s build
else
  npx -y serve -s build
fi

