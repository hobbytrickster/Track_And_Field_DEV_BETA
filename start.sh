#!/bin/bash
# WinBig Track and Field - Game Launcher

echo ""
echo "  ██╗    ██╗██╗███╗   ██╗██████╗ ██╗ ██████╗ "
echo "  ██║    ██║██║████╗  ██║██╔══██╗██║██╔════╝ "
echo "  ██║ █╗ ██║██║██╔██╗ ██║██████╔╝██║██║  ███╗"
echo "  ██║███╗██║██║██║╚██╗██║██╔══██╗██║██║   ██║"
echo "  ╚███╔███╔╝██║██║ ╚████║██████╔╝██║╚██████╔╝"
echo "   ╚══╝╚══╝ ╚═╝╚═╝  ╚═══╝╚═════╝ ╚═╝ ╚═════╝ "
echo "           TRACK  AND  FIELD"
echo ""
echo "  Collect. Train. Race. Win."
echo ""

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Check if node_modules exist
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Build shared package
echo "Building shared package..."
cd packages/shared && npx tsc 2>/dev/null
cd "$DIR"

# Kill any existing processes on our ports
kill $(lsof -ti:3001) 2>/dev/null
kill $(lsof -ti:5173) 2>/dev/null

# Start server in background
echo "Starting game server on port 3001..."
cd "$DIR"
npx tsx packages/server/src/index.ts &
SERVER_PID=$!

# Wait for server to be ready
sleep 2

# Start client dev server
echo "Starting game client on port 5173..."
echo ""
echo "  ► Open your browser to: http://localhost:5173"
echo "  ► Press Ctrl+C to stop the game"
echo ""

cd "$DIR/packages/client"
npx vite --host 2>&1

# Cleanup on exit
kill $SERVER_PID 2>/dev/null
