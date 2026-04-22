#!/usr/bin/env bash
# Build icon.icns from png/ set using iconutil (macOS).
set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT="$SCRIPT_DIR/.."
PNG="$ROOT/png"
ICONSET="$ROOT/png/icon.iconset"
OUT="$ROOT/tauri/icons/icon.icns"

[ -f "$PNG/favicon-16.png" ] || { echo "png/ not populated — run generate.mjs first"; exit 1; }

mkdir -p "$ICONSET" "$ROOT/tauri/icons"
cp "$PNG/favicon-16.png"   "$ICONSET/icon_16x16.png"
cp "$PNG/favicon-32.png"   "$ICONSET/icon_16x16@2x.png"
cp "$PNG/favicon-32.png"   "$ICONSET/icon_32x32.png"
cp "$PNG/favicon-64.png"   "$ICONSET/icon_32x32@2x.png"
cp "$PNG/favicon-128.png"  "$ICONSET/icon_128x128.png"
cp "$PNG/favicon-256.png"  "$ICONSET/icon_128x128@2x.png"
cp "$PNG/favicon-256.png"  "$ICONSET/icon_256x256.png"
cp "$PNG/favicon-512.png"  "$ICONSET/icon_256x256@2x.png"
cp "$PNG/favicon-512.png"  "$ICONSET/icon_512x512.png"
cp "$PNG/favicon-1024.png" "$ICONSET/icon_512x512@2x.png"

iconutil -c icns -o "$OUT" "$ICONSET"
rm -rf "$ICONSET"

# Copy Tauri-canonical names
cp "$PNG/favicon-32.png"   "$ROOT/tauri/icons/32x32.png"
cp "$PNG/favicon-128.png"  "$ROOT/tauri/icons/128x128.png"
cp "$PNG/favicon-256.png"  "$ROOT/tauri/icons/128x128@2x.png"
cp "$PNG/favicon-1024.png" "$ROOT/tauri/icons/icon.png"

echo "✓ tauri/icons/icon.icns"
echo "✓ tauri/icons/{32x32,128x128,128x128@2x,icon}.png"
