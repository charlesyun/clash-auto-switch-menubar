**中文** | [English](README_EN.md)

# Clash Auto Switch Menubar

一款免费开源的 macOS 菜单栏工具。它会通过 Clash Verge Rev / Mihomo 控制器并发测试当前链路中的候选节点，并在新节点明显更快时自动切换。

> 本项目不是 Clash Verge Rev 官方项目，也不隶属于 Clash、Mihomo 或 Clash Verge Rev。

## 功能

- 自动发现当前实际使用的 selector 链路
- 默认 5 路并发测速，减少多节点和超时场景下的等待
- 一键测速或切换到最快可用节点
- 默认仅在新节点快 50ms 以上时切换，避免频繁抖动
- 切换后回读控制器，确认切换结果
- 首次启动默认开启自动切换，默认间隔 30 分钟
- 自动切换开关、间隔和阈值会保存在本机
- 可选 launchd 后台定时任务，不依赖菜单栏 App 持续运行
- 支持 HTTP 控制器和 Unix socket

## 下载安装

[下载 Clash Verge Auto Switch.app](https://github.com/charlesYun/clash-auto-switch-menubar/raw/main/downloads/Clash-Verge-Auto-Switch-macOS-arm64.zip)

下载后解压，把 `Clash Verge Auto Switch.app` 拖到“应用程序”目录或直接运行。

当前安装包面向 Apple Silicon Mac，未使用 Apple Developer ID 签名或公证。如果 macOS 提示无法验证开发者，请在 Finder 中右键 App，然后选择“打开”。

安装包校验值见 [SHA256SUMS.txt](downloads/SHA256SUMS.txt)。下载后也可以运行：

```bash
shasum -a 256 Clash-Verge-Auto-Switch-macOS-arm64.zip
```

## 系统要求

- macOS 13 或更高版本
- Apple Silicon Mac
- 已安装 Clash Verge Rev 或其他兼容 Mihomo 控制器的客户端
- 系统提供 `/usr/bin/python3` 和 `curl`

## Clash 配置

工具会读取以下常见配置文件：

```text
~/Library/Application Support/io.github.clash-verge-rev.clash-verge-rev/config.yaml
~/.config/clash/config.yaml
```

支持 HTTP 控制器：

```yaml
external-controller: 127.0.0.1:9097
secret: ""
```

也支持 Unix socket：

```yaml
external-controller-unix: /path/to/socket
```

## 菜单栏使用

打开 App 后，它只显示在 macOS 顶部菜单栏：

- “测速”：只测量当前链路，不修改 selector。
- “立即切换”：测速后，在满足切换阈值时切换。
- “自动切换最快节点”：首次启动默认开启，30 分钟后执行第一次；用户手动关闭后，下次启动保持关闭。
- “切换阈值”：新节点至少快于当前节点多少毫秒才允许切换；设为 `0` 表示始终选择最快节点。

首次自动切换前会等待完整的 30 分钟。建议在此之前先使用“测速”，确认控制器和节点识别正常。

## 命令行使用

只测速：

```bash
/usr/bin/python3 scripts/switch_fastest.py --dry-run --launch-if-needed
```

切换当前链路：

```bash
/usr/bin/python3 scripts/switch_fastest.py --group-scope current --launch-if-needed
```

调整并发数和阈值：

```bash
/usr/bin/python3 scripts/switch_fastest.py --concurrency 5 --switch-threshold-ms 50
```

并发数允许 `1-10`，默认 `5`；切换阈值默认 `50ms`。

查看全部参数：

```bash
/usr/bin/python3 scripts/switch_fastest.py --help
```

## launchd 定时任务

每 30 分钟检查一次当前链路：

```bash
scripts/install_launch_agent.sh \
  --interval-minutes 30 \
  --group-scope current \
  --launch-if-needed
```

安装脚本会把运行副本放到：

```text
~/Library/Application Support/ClashVergeAutoSwitch/
```

因此安装后移动或删除 Git 仓库不会影响任务。卸载：

```bash
scripts/uninstall_launch_agent.sh
```

## 从源码构建

```bash
git clone https://github.com/charlesYun/clash-auto-switch-menubar.git
cd clash-auto-switch-menubar/macos-menu-bar
./scripts/build_app.sh
```

构建结果位于 `macos-menu-bar/build/Clash Verge Auto Switch.app`。

生成并同步下载 ZIP：

```bash
./scripts/package_release.sh
```

该命令每次都会重新构建 App、进行 ad-hoc 签名、生成 ZIP，并同步到仓库 `downloads/` 目录。

## 隐私与安全

- 本项目不包含遥测、账号系统或远程服务。
- 控制器 secret 只用于连接用户配置的控制器，不会写入日志。
- CLI 通过标准输入把 Authorization 请求头交给 `curl`，避免 secret 出现在进程参数中。
- 如果控制器使用远程 HTTP 地址，secret 会通过未加密网络传输；建议优先使用本机地址、Unix socket 或 HTTPS。
- 切换操作会修改 Mihomo selector，可能短暂影响当前网络连接。

## 测试

```bash
/usr/bin/python3 -m unittest discover -s tests -v
cd macos-menu-bar && swift build
```

## 来源与许可

核心脚本最初基于 [tankeito/clash-verge-auto-switch](https://github.com/tankeito/clash-verge-auto-switch)，本仓库保留其提交历史和署名，并增加 SwiftUI 菜单栏 App、并发测速、防抖切换、构建及直接下载能力。

本项目采用 [MIT License](LICENSE)。第三方来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
