#!/bin/bash
echo "Building frontend..."
if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
  echo "Building frontend in subdirectory..."
  cd frontend && npm install && npm run build && cd ..
else
  echo "Building frontend in root..."
  npm install && npm run build
fi
echo "Starting Human Drift server..."
echo "Access from this machine: http://localhost:8000"
echo "Access from phone (same WiFi): http://$(hostname -I | awk '{print $1}'):8000"
uvicorn backend.main:app --host 0.0.0.0 --port 8000
