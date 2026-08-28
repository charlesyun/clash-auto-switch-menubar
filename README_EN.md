[中文](README.md) | **English**

# Clash Auto Switch Menubar

A free and open-source macOS menu bar app that concurrently tests candidates in the active Clash Verge Rev / Mihomo selector chain and switches only when a meaningfully faster node is available.

> This is an unofficial project. It is not affiliated with Clash, Mihomo, or Clash Verge Rev.

## Features

- Discovers selectors in the currently active chain
- Tests up to 5 nodes concurrently by default
- Supports test-only and switch-now actions
- Uses a 50ms improvement threshold by default to prevent switch flapping
- Reads the selector back after a switch to verify the result
- Enables auto switching on first launch with a default 30-minute interval
- Persists the auto-switch preference, interval, and threshold locally
- Includes an optional launchd job that runs without the menu bar app
- Supports HTTP controllers and Unix sockets

## Download

[Download Clash Verge Auto Switch.app](https://github.com/charlesYun/clash-auto-switch-menubar/raw/main/downloads/Clash-Verge-Auto-Switch-macOS-arm64.zip)

Unzip the archive and move `Clash Verge Auto Switch.app` to Applications, or run it directly.

The current package targets Apple Silicon and is not signed or notarized with an Apple Developer ID. If macOS cannot verify the developer, right-click the app in Finder and choose Open.

The published digest is in [SHA256SUMS.txt](downloads/SHA256SUMS.txt). You can verify the download with:

```bash
shasum -a 256 Clash-Verge-Auto-Switch-macOS-arm64.zip
```

## Requirements

- macOS 13 or later
- Apple Silicon Mac
- Clash Verge Rev or another client with a compatible Mihomo controller
- `/usr/bin/python3` and `curl`

## Clash Configuration

The tool checks these common configuration paths:

```text
~/Library/Application Support/io.github.clash-verge-rev.clash-verge-rev/config.yaml
~/.config/clash/config.yaml
```

HTTP controller example:

```yaml
external-controller: 127.0.0.1:9097
secret: ""
```

Unix socket example:

```yaml
external-controller-unix: /path/to/socket
```

## Menu Bar Usage

- Test measures the active chain without changing selectors.
- Switch Now tests nodes and switches only when the configured threshold is met.
- Auto Switch is enabled on first launch and first runs after 30 minutes. If the user turns it off, it remains off on the next launch.
- Switch Threshold controls the required improvement. Set it to `0` to always select the measured winner.

The first automatic run waits for the full 30-minute interval. Use Test before then to verify controller and group discovery.

## Command Line

Test only:

```bash
/usr/bin/python3 scripts/switch_fastest.py --dry-run --launch-if-needed
```

Switch the active chain:

```bash
/usr/bin/python3 scripts/switch_fastest.py --group-scope current --launch-if-needed
```

Configure concurrency and threshold:

```bash
/usr/bin/python3 scripts/switch_fastest.py --concurrency 5 --switch-threshold-ms 50
```

Concurrency accepts `1-10` and defaults to `5`. The switch threshold defaults to `50ms`.

See every option with:

```bash
/usr/bin/python3 scripts/switch_fastest.py --help
```

## launchd Scheduling

Check the active chain every 30 minutes:

```bash
scripts/install_launch_agent.sh \
  --interval-minutes 30 \
  --group-scope current \
  --launch-if-needed
```

The installer copies its runtime script to `~/Library/Application Support/ClashVergeAutoSwitch/`, so moving or deleting the Git clone does not break the job.

Uninstall with:

```bash
scripts/uninstall_launch_agent.sh
```

## Build From Source

```bash
git clone https://github.com/charlesYun/clash-auto-switch-menubar.git
cd clash-auto-switch-menubar/macos-menu-bar
./scripts/build_app.sh
```

The app is written to `macos-menu-bar/build/Clash Verge Auto Switch.app`.

Create and synchronize the downloadable archive with:

```bash
./scripts/package_release.sh
```

The packaging command always rebuilds and ad-hoc signs the app, creates the ZIP, copies it to `downloads/`, and writes its SHA-256 digest.

## Privacy and Security

- The project contains no telemetry, account system, or hosted service.
- The controller secret is used only for the configured controller and is not logged.
- The CLI passes the Authorization header to `curl` over standard input instead of exposing the secret in process arguments.
- A remote HTTP controller transmits its secret without transport encryption. Prefer localhost, a Unix socket, or HTTPS.
- Switching changes Mihomo selectors and can briefly affect the active network connection.

## Tests

```bash
/usr/bin/python3 -m unittest discover -s tests -v
cd macos-menu-bar && swift build
```

## Credits and License

The core script was originally based on [tankeito/clash-verge-auto-switch](https://github.com/tankeito/clash-verge-auto-switch). This repository preserves the original history and attribution, and adds the SwiftUI menu bar app, concurrent testing, switch hysteresis, build tooling, and direct downloads.

Released under the [MIT License](LICENSE). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution details.
