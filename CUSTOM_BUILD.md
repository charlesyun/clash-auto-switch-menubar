# Integrated automatic node switching

This customization is based on Clash Verge Rev v2.5.8 (4337bd85758d54d7b9044b2da3c9ac1176eae1f3).

The Settings page includes an opt-in automatic node switcher, a speed-test-only action, a manual switch action, and recent execution results. Defaults are a 30-minute interval, a 50 ms improvement threshold, and 5 concurrent delay requests. The Rust scheduler continues when the window is closed or lightweight mode destroys the webview; a separate Auto Switch application is unnecessary.

The switcher preserves direct/reject selections, tests valid members of the currently selected proxy chains, and revalidates the profile, mode, core generation and selection before applying measured results. Successful switches are verified, persisted, and synchronized with the existing proxy refresh event and tray update flow. Window focus also requests a throttled proxy refresh.

## Validation

- 6 Rust regression tests cover group traversal, cycles, member eligibility, bypass exclusions, thresholds, failed current nodes, overlapping execution and schedule shutdown.
- 9 frontend event tests pass, including focus refresh and throttling.
- TypeScript, changed-file ESLint, architecture checks, formatting and frontend build pass.
- A macOS arm64 Debug app was built and locally ad-hoc signed; deep strict signature verification passes.
- Real-network switching, service/TUN compatibility and long-running scheduling have not yet been exercised in this customized app. The build is not notarized.

```sh
pnpm install --frozen-lockfile
pnpm prebuild
pnpm exec vitest run src/services/bus/create-bus-handlers.test.ts
cargo test --locked -p clash-verge --features clippy --lib core::auto_switch::tests
pnpm web:build
pnpm exec tauri build --debug --bundles app --config '{"bundle":{"createUpdaterArtifacts":false}}'
```

Use the Node, pnpm, Rust and Xcode versions required by the upstream project. Disable the separate switcher's scheduler when trying this integrated version. Official update packages do not include this customization.

Keep custom changes on the feature branch and retain an upstream remote for merging future official releases. Build outputs, dependencies, and personal proxy configurations do not belong in Git.

## Essential UI customization

The local `feature/minimal-ui` branch reduces navigation to Proxy, Subscriptions and Settings. The proxy page combines mode selection, system proxy/TUN controls, native automatic switching and a searchable virtualized node list. Settings retain startup, appearance/language, ports, latency parameters and local ZIP backups.

Removed feature implementations include connection/rule/log viewers, media unlock and website tests, statistics/home cards, custom proxy-chain editing, embedded YAML/script and custom theme editors, QR rendering, navigation reordering and WebDAV backup. The core rule engine, existing merge/script execution, local backups, service/TUN support and diagnostic logging remain. Legacy WebDAV configuration fields remain readable for compatibility; the WebDAV transport and dependency are removed.

Validation: 46 frontend tests and 385 Rust library tests pass; TypeScript, ESLint and the event architecture check pass. The production frontend and macOS arm64 Debug application build successfully. UI verification uses isolated mock IPC data and does not exercise real-network switching or modify the installed application's data. The customized app is locally ad-hoc signed, not notarized. Official updates replace customizations.
