#!/bin/zsh
set -euo pipefail

LABEL="com.codex.clash-verge-auto-switch"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"
INSTALL_ROOT="$HOME/Library/Application Support/ClashVergeAutoSwitch"
INSTALLED_SCRIPT="$INSTALL_ROOT/switch_fastest.py"

launchctl bootout "gui/$(id -u)" "$PLIST_PATH" >/dev/null 2>&1 || true
rm -f "$PLIST_PATH"
rm -f "$INSTALLED_SCRIPT"
rmdir "$INSTALL_ROOT" >/dev/null 2>&1 || true

echo "Removed $LABEL"
