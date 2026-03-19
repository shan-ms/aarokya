#!/usr/bin/env bash
# Aarokya — Launch everything locally
# Usage: ./scripts/launch-local.sh

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "=== Aarokya Local Launch ==="

# 1. Start infrastructure (PostgreSQL + Redis)
if command -v docker &>/dev/null; then
  echo "[1/4] Starting PostgreSQL + Redis..."
  cd backend && docker compose up -d && cd ..
  sleep 3
else
  echo "[1/4] Docker not found. Ensure PostgreSQL (port 5432) and Redis (port 6379) are running."
  echo "      Install Docker or run: brew install postgresql@16 redis && brew services start postgresql@16 redis"
  read -p "      Press Enter when DB is ready, or Ctrl+C to exit..."
fi

# 2. Backend
echo "[2/4] Starting Backend (Rust API)..."
cd backend
if [ ! -f .env ]; then cp .env.example .env; fi
cargo run &
BACKEND_PID=$!
cd ..
sleep 5
if curl -s http://localhost:8080/health >/dev/null 2>&1; then
  echo "      Backend OK: http://localhost:8080"
else
  echo "      Backend may still be starting. Check logs if issues persist."
fi

# 3. Control Center
echo "[3/4] Starting Control Center (Next.js)..."
cd apps/control-center
npm run dev &
CC_PID=$!
cd ..
sleep 5
echo "      Control Center: http://localhost:3000"

# 4. React Native apps (Metro)
echo "[4/4] To run Customer or Partner apps:"
echo "      Customer: cd apps/customer && npx react-native start"
echo "      Partner:  cd apps/partner && npx react-native start"
echo ""
echo "=== Services running ==="
echo "  Backend:         http://localhost:8080"
echo "  Control Center:  http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services."

wait $BACKEND_PID $CC_PID 2>/dev/null || true
