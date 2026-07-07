#!/usr/bin/env bash
set -e

# Start the Aetherforge game dev server (hot-reloads on code changes)
# Usage: ./run-game.sh
#
# Opens at http://localhost:18742  (or whatever PORT is assigned)
# Keep this terminal open while you work — Vite will re-bundle on every save.

echo "Starting Aetherforge dev server..."
pnpm --filter @workspace/aetherforge run dev
