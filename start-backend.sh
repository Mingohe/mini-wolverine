#!/bin/bash

# Start Backend Development Server
# This script starts the Node.js backend server
#
# Usage:
#   ./start-backend.sh
#   PORT=5000 ./start-backend.sh

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$SCRIPT_DIR/backend"

# Default port (can be overridden by environment variable)
PORT="${PORT:-4000}"

# CAITLYN_TOKEN is required for backend to connect to Caitlyn service
CAITLYN_TOKEN="${CAITLYN_TOKEN:-58abd12edbde042536637bfba9d20d5faf366ef481651cdbb046b1c3b4f7bf7a97ae7a2e6e5dc8fe05cd91147c8906f8a82aaa1bb1356d8cb3d6a076eadf5b5a}"

echo "🚀 Starting Backend Development Server..."
echo "🔌 Port: $PORT"
echo "🔑 CAITLYN_TOKEN: ${CAITLYN_TOKEN:0:20}..." # Show first 20 chars for verification
echo "📁 Backend directory: $BACKEND_DIR"
echo ""

# Change to backend directory
cd "$BACKEND_DIR" || exit 1

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "⚠️  node_modules not found. Installing dependencies..."
  npm install
fi

# Start the development server
# Backend will run on http://localhost:$PORT
PORT="$PORT" CAITLYN_TOKEN="$CAITLYN_TOKEN" npm run dev

