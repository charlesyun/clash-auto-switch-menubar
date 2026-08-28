import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var model: SwitchModel

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Label(model.statusText, systemImage: model.statusIcon)
                    .font(.headline)
                Spacer()
                ProgressView()
                    .controlSize(.small)
                    .opacity(model.isRunning ? 1 : 0)
            }

            HStack(spacing: 8) {
                Button {
                    model.dryRun()
                } label: {
                    Label("测速", systemImage: "speedometer")
                }
                .disabled(model.isRunning)

                Button {
                    model.switchFastest()
                } label: {
                    Label("立即切换", systemImage: "bolt.fill")
                }
                .disabled(model.isRunning)
            }

            VStack(alignment: .leading, spacing: 8) {
                Toggle("自动切换最快节点", isOn: $model.autoSwitchEnabled)
                    .toggleStyle(.switch)

                HStack {
                    Stepper("每 \(model.intervalMinutes) 分钟", value: $model.intervalMinutes, in: 1...240)
                        .disabled(model.autoSwitchEnabled)
                    Spacer()
                }

                HStack {
                    Stepper(
                        "切换阈值 \(model.switchThresholdMs) 毫秒",
                        value: $model.switchThresholdMs,
                        in: 0...500,
                        step: 10
                    )
                    Spacer()
                }

                Text("仅当新节点至少快于当前节点该数值时切换")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                HStack {
                    Text("上次：\(model.lastAutoRunText)")
                    Spacer()
                    Text("下次：\(model.nextRunText)")
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            .padding(10)
            .background(Color(nsColor: .controlBackgroundColor))
            .clipShape(RoundedRectangle(cornerRadius: 6))

            ScrollView {
                Text(model.lastOutput)
                    .font(.system(.caption, design: .monospaced))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
                    .padding(8)
            }
            .frame(height: 220)
            .background(Color(nsColor: .textBackgroundColor))
            .clipShape(RoundedRectangle(cornerRadius: 6))

            Divider()

            HStack {
                Text("每次检测当前链路，需要时自动打开 Clash Verge")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Spacer()
                Button {
                    model.quit()
                } label: {
                    Label("退出", systemImage: "power")
                }
            }
        }
        .padding(14)
        .frame(width: 420)
    }
}
