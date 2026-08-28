import SwiftUI

@main
struct ClashVergeAutoSwitchApp: App {
    @StateObject private var model = SwitchModel()

    var body: some Scene {
        MenuBarExtra {
            ContentView()
                .environmentObject(model)
        } label: {
            Image(systemName: model.statusIcon)
                .font(.system(size: 17, weight: .heavy))
                .imageScale(.large)
                .symbolRenderingMode(.monochrome)
                .accessibilityLabel("Clash Auto Switch：\(model.statusText)")
        }
        .menuBarExtraStyle(.window)
    }
}
