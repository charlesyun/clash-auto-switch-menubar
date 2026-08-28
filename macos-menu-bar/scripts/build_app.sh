#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$APP_PROJECT_DIR/.." && pwd)"
APP_NAME="Clash Verge Auto Switch"
APP_DIR="$APP_PROJECT_DIR/build/${APP_NAME}.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
ICONSET_DIR="$APP_PROJECT_DIR/build/AppIcon.iconset"
APP_VERSION="$(tr -d '[:space:]' < "$ROOT_DIR/VERSION")"

if [[ ! "$APP_VERSION" =~ '^[0-9]+\.[0-9]+\.[0-9]+$' ]]; then
  echo "Invalid VERSION: $APP_VERSION" >&2
  exit 1
fi

cd "$APP_PROJECT_DIR"
swift build -c release

rm -rf "$APP_DIR"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR/scripts" "$RESOURCES_DIR/references"
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

/usr/bin/python3 - "$ICONSET_DIR" <<'PY'
import math
import os
import struct
import sys
import zlib

out_dir = sys.argv[1]

sizes = [
    (16, 1), (16, 2),
    (32, 1), (32, 2),
    (128, 1), (128, 2),
    (256, 1), (256, 2),
    (512, 1), (512, 2),
]


def lerp(a, b, t):
    return int(round(a + (b - a) * t))


def mix(c1, c2, t):
    return tuple(lerp(a, b, t) for a, b in zip(c1, c2))


def rounded_rect_mask(x, y, size, radius):
    inset = 0.094 * size
    left = inset
    top = inset
    right = size - inset
    bottom = size - inset
    if left + radius <= x <= right - radius and top <= y <= bottom:
        return True
    if top + radius <= y <= bottom - radius and left <= x <= right:
        return True
    for cx, cy in (
        (left + radius, top + radius),
        (right - radius, top + radius),
        (left + radius, bottom - radius),
        (right - radius, bottom - radius),
    ):
        if (x - cx) * (x - cx) + (y - cy) * (y - cy) <= radius * radius:
            return True
    return False


def point_in_poly(x, y, points):
    inside = False
    j = len(points) - 1
    for i in range(len(points)):
        xi, yi = points[i]
        xj, yj = points[j]
        if ((yi > y) != (yj > y)) and (
            x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-9) + xi
        ):
            inside = not inside
        j = i
    return inside


def write_png(path, width, height, rgba):
    def chunk(kind, data):
        payload = kind + data
        return (
            struct.pack(">I", len(data))
            + payload
            + struct.pack(">I", zlib.crc32(payload) & 0xFFFFFFFF)
        )

    raw = bytearray()
    row_len = width * 4
    for row in range(height):
        raw.append(0)
        raw.extend(rgba[row * row_len : (row + 1) * row_len])

    with open(path, "wb") as handle:
        handle.write(b"\x89PNG\r\n\x1a\n")
        handle.write(chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)))
        handle.write(chunk(b"IDAT", zlib.compress(bytes(raw), 9)))
        handle.write(chunk(b"IEND", b""))


def render(size):
    pixels = bytearray(size * size * 4)
    bg_a = (32, 201, 151)
    bg_b = (47, 128, 237)
    bg_c = (124, 58, 237)
    radius = 0.184 * size

    lightning = [
        (0.58 * size, 0.12 * size),
        (0.28 * size, 0.55 * size),
        (0.46 * size, 0.55 * size),
        (0.42 * size, 0.89 * size),
        (0.73 * size, 0.46 * size),
        (0.55 * size, 0.46 * size),
    ]
    arrow_right = [
        (0.67 * size, 0.285 * size),
        (0.80 * size, 0.285 * size),
        (0.765 * size, 0.245 * size),
        (0.81 * size, 0.205 * size),
        (0.925 * size, 0.325 * size),
        (0.81 * size, 0.445 * size),
        (0.765 * size, 0.405 * size),
        (0.80 * size, 0.365 * size),
        (0.67 * size, 0.365 * size),
    ]
    arrow_left = [
        (0.33 * size, 0.715 * size),
        (0.20 * size, 0.715 * size),
        (0.235 * size, 0.755 * size),
        (0.19 * size, 0.795 * size),
        (0.075 * size, 0.675 * size),
        (0.19 * size, 0.555 * size),
        (0.235 * size, 0.595 * size),
        (0.20 * size, 0.635 * size),
        (0.33 * size, 0.635 * size),
    ]

    for y in range(size):
        for x in range(size):
            idx = (y * size + x) * 4
            if not rounded_rect_mask(x + 0.5, y + 0.5, size, radius):
                continue

            t = (x + y) / max(1, 2 * size - 2)
            bg = mix(bg_a, bg_b, min(t * 1.8, 1.0)) if t < 0.55 else mix(bg_b, bg_c, (t - 0.55) / 0.45)
            pixels[idx : idx + 4] = bytes((*bg, 255))

            if point_in_poly(x + 0.5, y + 0.5, lightning):
                pixels[idx : idx + 4] = b"\xff\xff\xff\xff"
            elif point_in_poly(x + 0.5, y + 0.5, arrow_right) or point_in_poly(x + 0.5, y + 0.5, arrow_left):
                pixels[idx : idx + 4] = b"\xff\xff\xff\xeb"

    return pixels


for base, scale in sizes:
    pixel_size = base * scale
    name = f"icon_{base}x{base}{'@2x' if scale == 2 else ''}.png"
    write_png(os.path.join(out_dir, name), pixel_size, pixel_size, render(pixel_size))
PY

/usr/bin/iconutil -c icns "$ICONSET_DIR" -o "$RESOURCES_DIR/AppIcon.icns"

cp ".build/release/ClashVergeAutoSwitch" "$MACOS_DIR/ClashVergeAutoSwitch"
cp "$ROOT_DIR/scripts/switch_fastest.py" "$RESOURCES_DIR/scripts/switch_fastest.py"
cp "$ROOT_DIR/references/runtime-notes.md" "$RESOURCES_DIR/references/runtime-notes.md"
chmod +x "$MACOS_DIR/ClashVergeAutoSwitch" "$RESOURCES_DIR/scripts/switch_fastest.py"

cat > "$CONTENTS_DIR/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>ClashVergeAutoSwitch</string>
  <key>CFBundleIdentifier</key>
  <string>com.codex.clash-verge-auto-switch.menubar</string>
  <key>CFBundleName</key>
  <string>Clash Verge Auto Switch</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleShortVersionString</key>
  <string>$APP_VERSION</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

/usr/bin/codesign --force --deep --sign - "$APP_DIR"
/usr/bin/codesign --verify --deep --strict --verbose=2 "$APP_DIR"

echo "Built: $APP_DIR"
