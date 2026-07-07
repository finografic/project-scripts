#!/bin/bash
set -e

echo "========================================"
echo "{{APP_NAME}} - Linux Setup"
echo "========================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is not installed. Attempting to install..."
  if command -v apt >/dev/null 2>&1; then
    sudo apt update && sudo apt install -y nodejs npm
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y nodejs npm
  elif command -v pacman >/dev/null 2>&1; then
    sudo pacman -Sy --noconfirm nodejs npm
  else
    echo "⚠️  Could not auto-install Node.js. Please install Node 20+ from https://nodejs.org/ then re-run ./setup.sh"
    exit 1
  fi
fi

echo "✅ Node.js: $(node -v)"
echo "✅ npm: $(npm -v)"

echo "📦 Installing dependencies (production)..."

# Try multiple npm install strategies to handle peer dependency conflicts
echo "🔧 Attempting with --legacy-peer-deps..."
if npm install --production --legacy-peer-deps; then
    echo "✅ Dependencies installed successfully with --legacy-peer-deps"
elif npm install --production --force; then
    echo "✅ Dependencies installed successfully with --force"
elif npm install --production --force --legacy-peer-deps; then
    echo "✅ Dependencies installed successfully with --force --legacy-peer-deps"
else
    echo "❌ All npm install strategies failed. Please check the error messages above."
    echo "💡 You may need to manually resolve peer dependency conflicts."
    echo "💡 Try running: npm install --production --force --legacy-peer-deps"
    exit 1
fi

echo "🚀 Starting application (server + client)..."
chmod +x start-server.sh start-client.sh || true
(./start-server.sh &) >/dev/null 2>&1
(./start-client.sh &) >/dev/null 2>&1

echo "🎉 Setup completed. Server and client started in background."
