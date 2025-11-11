#!/bin/bash

# Start Frontend Vue Development Server
# This script sets up environment variables and starts the Vue frontend
#
# Usage:
#   ./start-frontend-vue.sh
#   VITE_API_BASE_URL=http://localhost:5000 ./start-frontend-vue.sh

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
FRONTEND_DIR="$SCRIPT_DIR/frontend-vue"

# Default API base URL (can be overridden by environment variable)
# This will be used for all API requests (e.g., /api/formulas/query)
API_BASE_URL="${VITE_API_BASE_URL:-http://localhost:4000}"

echo "🚀 Starting Frontend Vue Development Server..."
echo "📡 API Base URL: $API_BASE_URL"
echo "📁 Frontend directory: $FRONTEND_DIR"
echo ""

# Change to frontend directory
cd "$FRONTEND_DIR" || exit 1

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "⚠️  node_modules not found. Installing dependencies..."
  npm install
fi

# Export the environment variable so Vite can use it
# Note: Vite loads env files in this order (higher priority first):
# 1. .env.[mode].local (highest)
# 2. .env.local
# 3. .env.[mode]
# 4. .env
# Command-line env vars should override .env files, but to be safe,
# we'll create a temporary .env.development.local file
export VITE_API_BASE_URL="$API_BASE_URL"

# Create/update .env.development.local to ensure our value is used
# This file has higher priority than .env.development
ENV_LOCAL_FILE="$FRONTEND_DIR/.env.development.local"
echo "VITE_API_BASE_URL=$API_BASE_URL" > "$ENV_LOCAL_FILE"
echo "VITE_WS_BASE_URL=${VITE_WS_BASE_URL:-ws://localhost:4000}" >> "$ENV_LOCAL_FILE"

echo "✅ Environment variable set: VITE_API_BASE_URL=$API_BASE_URL"
echo "✅ Created/updated .env.development.local to ensure override"
echo ""

# Start the development server
# Frontend will run on http://localhost:3002 (configured in vite.config.ts)
npm run dev

