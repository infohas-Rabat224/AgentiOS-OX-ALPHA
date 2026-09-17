#!/usr/bin/env bash
# AgenticOS Kernel Daemon Supervisor

set -euo pipefail

PORT=8001
HOST="127.0.0.1"

PID=$(pgrep -f "agentic_os serve --host ${HOST} --port ${PORT}" || true)

if [ -n "${PID}" ]; then
  echo "AgenticOS is already running on ${HOST}:${PORT} (PID: ${PID})"
  exit 0
fi

echo "Starting AgenticOS kernel daemon on ${HOST}:${PORT}..."
nohup env PYTHONPATH="./AgenticosHybrid/src:./AgenticosHybrid" python3 -m agentic_os serve --host "${HOST}" --port "${PORT}" > /tmp/agentic_os.log 2>&1 &
DAEMON_PID=$!
echo "Daemon started with PID ${DAEMON_PID}. Waiting for healthz check..."

for i in {1..15}; do
  if curl -s "http://${HOST}:${PORT}/healthz" > /dev/null 2>&1; then
    echo "AgenticOS kernel is healthy and listening on http://${HOST}:${PORT}"
    exit 0
  fi
  sleep 1
done

echo "AgenticOS kernel started, checking log:"
tail -n 20 /tmp/agentic_os.log
