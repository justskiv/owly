#!/usr/bin/env bash
# One-shot: rasterize for a given day (default = today) and build icns + Tauri icons.
# Usage: ./build-all.sh [day]
set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
DAY="${1:-}"

cd "$SCRIPT_DIR/.."
node scripts/generate.mjs $DAY
bash scripts/build-icns.sh
echo
echo "Output:"
echo "  svg/favicon.svg        — static SVG with day baked in"
echo "  png/favicon-*.png      — all sizes"
echo "  tauri/icons/*          — ready-to-drop for src-tauri/icons/"
