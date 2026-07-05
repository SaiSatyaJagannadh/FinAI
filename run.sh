#!/usr/bin/env bash
# =============================================================================
# run.sh ===========
# run.sh – One-click setup & launch for the Financial AI Agents project
# ===========================================================================
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="${PROJECT_ROOT}/server"
CLIENT_DIR="${PROJECT_ROOT}/client"
ENV_FILE="${PROJECT_ROOT}/.env"

# Default MongoDB settings (override via .env if desired)
MONGO_DB_NAME="financialai"
MONGO_URI_DEFAULT="mongodb://localhost:27017/${MONGO_DB_NAME}"

echo "🚀 Starting Financial AI Agents setup…"
cd "${PROJECT_ROOT}"

# Load .env if it exists
if [[ -f "${ENV_FILE}" ]]; then
  echo "🔧 Loading environment from ${ENV_FILE}"
  set -a
  # shellcheck source=/dev/null
  source "${ENV_FILE}"
  set +a
else
  echo "⚠️  No .env file found – using defaults."
fi

MONGODB_URI="${MONGODB_URI:-${MONGO_URI_DEFAULT}}"
PORT="${PORT:-5000}"

echo "🗄️  MongoDB URI: ${MONGODB_URI}"
echo "🔌 Backend will listen on port: ${PORT}"

# (Re)install Node dependencies
echo "📦 Installing backend dependencies …"
cd "${SERVER_DIR}"
npm install
cd "${PROJECT_ROOT}"

echo "📦 Installing frontend dependencies …"
cd "${CLIENT_DIR}"
npm install
cd "${PROJECT_ROOT}"

# Ensure MongoDB is reachable; start it if needed
if mongo --eval "quit()" --quiet "${MONGODB_URI}" 2>/dev/null; then
  echo "✅ MongoDB is already reachable at ${MONGODB_URI}"
else
  echo "🔧 MongoDB not reachable – attempting to start it…"
  if command -v brew >/dev/null && brew services list | grep -q mongodb-community; then
    brew services start mongodb-community
    echo "⏳ Waiting for MongoDB to accept connections…"
    for i in {1..10}; do
      if mongo --eval "quit()" --quiet "${MONGODB_URI}" 2>/dev/null; then
        echo "✅ MongoDB started."
        break
      fi
      sleep 2
    done
  else
    echo "Starting mongod in background (data will go to default dbpath)."
    mongod --fork --logpath /tmp/mongod.log
    echo "⏳ Waiting for mongod to be ready…"
    for i in {1..10}; do
      if mongo --eval "quit()" --quiet "${MONGODB_URI}" 2>/dev/null; then
        echo "✅ MongoDB started."
        break
      fi
      sleep 2
    done
  fi
fi

# Launch dev servers (backend + frontend) concurrently
echo "🚀 Launching development servers…"
npm run dev

# Cleanup trap (stop background mongod if we started it)
cleanup() {
  echo ""
  echo "🛑 Shutting down…"
  # Only kill mongod if we started it ourselves (not a brew service)
  if ! command -v brew >/dev/null || ! brew services list | grep -q mongodb-community; then
    pkill -f "mongod --fork" || true
    echo "🧹 Background mongod stopped."
  fi
}
trap cleanup EXIT INT TERM