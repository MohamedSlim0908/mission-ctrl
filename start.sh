#!/bin/bash
# Mission Controller - Start Script

set -e

cd "$(dirname "$0")"

echo "🚀 Starting Mission Controller..."
echo ""

# Kill any existing processes
pkill -f "node server.js" 2>/dev/null || true
pkill -f "vite.*3333" 2>/dev/null || true
sleep 1

# Start backend
echo "📡 Starting backend on port 3334..."
cd backend
node server.js > /tmp/mc-backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"
cd ..

sleep 2

# Start frontend
echo "🌐 Starting frontend on port 3333..."
cd frontend
npx vite --port 3333 --host > /tmp/mc-frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"
cd ..

sleep 2

echo ""
echo "✅ Mission Controller running!"
echo "   Frontend: http://localhost:3333"
echo "   Backend:  http://localhost:3334"
echo ""
echo "   Logs: /tmp/mc-backend.log, /tmp/mc-frontend.log"
echo ""
echo "Press Ctrl+C to stop..."

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'; exit 0" INT
wait
