import AppKit
import Foundation

@MainActor
final class SwitchModel: ObservableObject {
    @Published var statusText = "未检测"
    @Published var lastOutput = "点击“测速”检查当前链路最快节点。"
    @Published var isRunning = false
    @Published var autoSwitchEnabled = true {
        didSet {
            UserDefaults.standard.set(autoSwitchEnabled, forKey: Self.autoSwitchEnabledKey)
            if autoSwitchEnabled {
                scheduleNextAutoSwitch()
            } else {
                stopAutoSwitch()
            }
        }
    }
    @Published var intervalMinutes = 30 {
        didSet {
            if intervalMinutes < 1 {
                intervalMinutes = 1
            }
            UserDefaults.standard.set(intervalMinutes, forKey: Self.intervalMinutesKey)
            if autoSwitchEnabled {
                scheduleNextAutoSwitch()
            }
        }
    }
    @Published var switchThresholdMs = 50 {
        didSet {
            if switchThresholdMs < 0 {
                switchThresholdMs = 0
            }
            UserDefaults.standard.set(switchThresholdMs, forKey: Self.switchThresholdKey)
        }
    }
    @Published var nextRunText = "未开启"
    @Published var lastAutoRunText = "尚未自动执行"

    var statusIcon: String {
        if isRunning {
            return "arrow.triangle.2.circlepath.circle.fill"
        }
        if statusText.contains("可用") || statusText.contains("完成") {
            return "bolt.fill"
        }
        if statusText.contains("失败") || statusText.contains("不可用") {
            return "exclamationmark.triangle.fill"
        }
        return "bolt.fill"
    }

    private let projectRoot: URL
    private let scriptPath: URL
    private var autoSwitchTimer: Timer?

    init() {
        let resolvedProjectRoot: URL
        let resolvedScriptPath: URL

        if let resourceRoot = Bundle.main.resourceURL {
            let bundledScript = resourceRoot.appendingPathComponent("scripts/switch_fastest.py")
            if FileManager.default.fileExists(atPath: bundledScript.path) {
                resolvedProjectRoot = resourceRoot
                resolvedScriptPath = bundledScript
            } else {
                let sourceRoot = Self.sourceProjectRoot()
                resolvedProjectRoot = sourceRoot
                resolvedScriptPath = sourceRoot.appendingPathComponent("scripts/switch_fastest.py")
            }
        } else {
            let sourceRoot = Self.sourceProjectRoot()
            resolvedProjectRoot = sourceRoot
            resolvedScriptPath = sourceRoot.appendingPathComponent("scripts/switch_fastest.py")
        }

        self.projectRoot = resolvedProjectRoot
        self.scriptPath = resolvedScriptPath

        let defaults = UserDefaults.standard
        if defaults.object(forKey: Self.intervalMinutesKey) != nil {
            intervalMinutes = max(defaults.integer(forKey: Self.intervalMinutesKey), 1)
        }
        if defaults.object(forKey: Self.switchThresholdKey) != nil {
            switchThresholdMs = max(defaults.integer(forKey: Self.switchThresholdKey), 0)
        }
        if defaults.object(forKey: Self.autoSwitchEnabledKey) != nil {
            autoSwitchEnabled = defaults.bool(forKey: Self.autoSwitchEnabledKey)
        }

        if autoSwitchEnabled {
            scheduleNextAutoSwitch()
        }
    }

    func refreshStatus() {
        runScript(label: "刷新状态", arguments: ["--list-groups"])
    }

    func dryRun() {
        runScript(label: "测速", arguments: scriptArguments(extra: ["--dry-run"]))
    }

    func switchFastest() {
        runScript(label: "切换最快节点", arguments: scriptArguments(extra: []))
    }

    func quit() {
        NSApplication.shared.terminate(nil)
    }

    private func scriptArguments(extra: [String]) -> [String] {
        var arguments = extra
        arguments.append(contentsOf: [
            "--group-scope", "current",
            "--launch-if-needed",
            "--concurrency", "5",
            "--switch-threshold-ms", String(switchThresholdMs),
        ])
        return arguments
    }

    private func scheduleNextAutoSwitch() {
        autoSwitchTimer?.invalidate()

        let seconds = TimeInterval(max(intervalMinutes, 1) * 60)
        let nextRun = Date().addingTimeInterval(seconds)
        nextRunText = Self.timeFormatter.string(from: nextRun)

        autoSwitchTimer = Timer.scheduledTimer(withTimeInterval: seconds, repeats: false) { [weak self] _ in
            guard let model = self else {
                return
            }
            Task { @MainActor [model] in
                model.runAutoSwitch()
            }
        }
    }

    private func stopAutoSwitch() {
        autoSwitchTimer?.invalidate()
        autoSwitchTimer = nil
        nextRunText = "未开启"
    }

    private func runAutoSwitch() {
        guard autoSwitchEnabled else {
            return
        }

        if isRunning {
            lastAutoRunText = "上次跳过：任务运行中"
            scheduleNextAutoSwitch()
            return
        }

        lastAutoRunText = "正在自动切换"
        runScript(label: "自动切换", arguments: scriptArguments(extra: [])) { [weak self] result in
            guard let self else { return }
            self.lastAutoRunText = result.exitCode == 0
                ? "上次成功：\(Self.timeFormatter.string(from: Date()))"
                : "上次失败：\(Self.timeFormatter.string(from: Date()))"
            if self.autoSwitchEnabled {
                self.scheduleNextAutoSwitch()
            }
        }
    }

    private func runScript(label: String, arguments: [String]) {
        runScript(label: label, arguments: arguments, completion: nil)
    }

    private func runScript(
        label: String,
        arguments: [String],
        completion: ((CommandResult) -> Void)?
    ) {
        guard FileManager.default.fileExists(atPath: scriptPath.path) else {
            statusText = "脚本不存在"
            lastOutput = scriptPath.path
            return
        }

        Task {
            isRunning = true
            statusText = "\(label)中"
            lastOutput = "[\(Self.timeFormatter.string(from: Date()))] \(label)中...\n"
            let result = await CommandRunner.run(
                "/usr/bin/python3",
                arguments: [scriptPath.path] + arguments,
                workingDirectory: projectRoot,
                onOutput: { [weak self] text in
                    guard let model = self else {
                        return
                    }
                    Task { @MainActor [model] in
                        model.appendLog(text)
                    }
                }
            )
            isRunning = false
            statusText = result.exitCode == 0 ? "\(label)完成" : "\(label)失败：\(result.exitCode)"
            appendLog(
                "\n[\(Self.timeFormatter.string(from: Date()))] "
                + (result.exitCode == 0 ? "\(label)完成" : "\(label)失败：\(result.exitCode)")
            )
            if result.output.isEmpty {
                appendLog("\n无脚本输出。")
            }
            completion?(result)
        }
    }

    private func appendLog(_ text: String) {
        if lastOutput.isEmpty {
            lastOutput = text
        } else {
            lastOutput += text
        }

        if lastOutput.count > Self.maximumLogCharacters {
            lastOutput = "[较早日志已省略]\n" + String(lastOutput.suffix(Self.retainedLogCharacters))
        }
    }

    private static func sourceProjectRoot() -> URL {
        let currentDirectory = URL(
            fileURLWithPath: FileManager.default.currentDirectoryPath,
            isDirectory: true
        )
        let candidates = [currentDirectory, currentDirectory.deletingLastPathComponent()]

        for candidate in candidates {
            let script = candidate.appendingPathComponent("scripts/switch_fastest.py")
            if FileManager.default.fileExists(atPath: script.path) {
                return candidate
            }
        }

        return currentDirectory
    }

    private static let intervalMinutesKey = "intervalMinutes"
    private static let switchThresholdKey = "switchThresholdMs"
    private static let autoSwitchEnabledKey = "autoSwitchEnabled"
    private static let maximumLogCharacters = 100_000
    private static let retainedLogCharacters = 80_000

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        return formatter
    }()
}
