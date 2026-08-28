#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_NAME="Clash Verge Auto Switch"
APP_DIR="$APP_PROJECT_DIR/build/${APP_NAME}.app"
RELEASE_DIR="$APP_PROJECT_DIR/build/release"
ZIP_PATH="$RELEASE_DIR/Clash-Verge-Auto-Switch-macOS-arm64.zip"
DOWNLOADS_DIR="$APP_PROJECT_DIR/../downloads"
DOWNLOAD_ZIP="$DOWNLOADS_DIR/Clash-Verge-Auto-Switch-macOS-arm64.zip"
CHECKSUM_PATH="$DOWNLOADS_DIR/SHA256SUMS.txt"

cd "$APP_PROJECT_DIR"

"$SCRIPT_DIR/build_app.sh"

mkdir -p "$RELEASE_DIR" "$DOWNLOADS_DIR"
rm -f "$ZIP_PATH"

/usr/bin/ditto -c -k --keepParent "$APP_DIR" "$ZIP_PATH"
cp "$ZIP_PATH" "$DOWNLOAD_ZIP"

DIGEST="$(/usr/bin/shasum -a 256 "$DOWNLOAD_ZIP" | /usr/bin/awk '{print $1}')"
print -r -- "$DIGEST  Clash-Verge-Auto-Switch-macOS-arm64.zip" > "$CHECKSUM_PATH"

echo "Packaged: $ZIP_PATH"
echo "Download: $DOWNLOAD_ZIP"
echo "Checksum: $CHECKSUM_PATH"
