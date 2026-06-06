# Claude Code + CC-Switch 一键安装器

> 专为中国大陆用户设计，优先使用中国大陆可访问的镜像源与 GitHub 代理。

## 这是什么？

这是一个帮助你一键安装 [Claude Code](https://claude.ai/code)（AI 编程助手）和 [CC-Switch](https://github.com/farion1231/cc-switch)（模型切换管理工具）的安装器。

安装完成后，你可以通过 CC-Switch 使用国产 AI 模型（DeepSeek、智谱 GLM、通义千问等）来驱动 Claude Code，完全不需要翻墙。

## 两种安装方式

### 方式 1：脚本安装（推荐有一定基础的用户）

**macOS / Linux：**

打开终端（Terminal），复制粘贴以下命令并回车：

```bash
bash scripts/install.sh
```

或者下载后双击 `install.sh` 文件。

**Windows：**

双击 `scripts/install.bat` 文件即可。

### 方式 2：可视化安装器（推荐完全不懂代码的用户）

下载对应系统的安装包：

| 系统 | 下载文件 |
|------|---------|
| Windows | `ClaudeCodeInstaller-Setup.exe` |
| macOS | `ClaudeCodeInstaller.dmg` |

> ⚠️ **macOS 用户注意：** 由于安装器未签名，首次打开时会被 macOS 拦截。请右键点击 → 选择"打开" → 点击"仍要打开"。
>
> ⚠️ **Windows 用户注意：** 首次运行时可能会弹出 SmartScreen 警告。请点击"更多信息" → "仍要运行"。

## 安装器会做什么？

安装器会自动完成以下步骤：

1. **安装 Node.js 20 LTS**（使用 npmmirror / 腾讯云 / 华为云 / 清华镜像）
2. **安装 Git**（仅 Windows 需要，使用淘宝镜像）
3. **安装 Claude Code**（使用淘宝 / 腾讯云 / 华为云 NPM 镜像，包含官方 optional 二进制包）
4. **安装 CC-Switch**（使用 GitHub 代理镜像）
5. **引导配置 AI 模型**（在 cc-switch 中选择国产模型 + 填入 API Key）

## 支持的国产模型

| 模型 | 说明 | 价格参考 | 获取 API Key |
|------|------|---------|-------------|
| **DeepSeek** ⭐推荐 | 顶级编程模型，性价比极高 | ~¥0.001/千token | [platform.deepseek.com](https://platform.deepseek.com/api_keys) |
| 智谱 GLM-4 | 清华系大模型，中文理解强 | ~¥0.05/千token | [open.bigmodel.cn](https://open.bigmodel.cn/usercenter/apikeys) |
| 通义千问 | 阿里云大模型，生态完善 | ~¥0.02/千token | [dashscope.console.aliyun.com](https://dashscope.console.aliyun.com/apiKey) |

## 安装完成后

1. **打开新终端窗口**（重要！必须新开窗口）
2. 输入 `claude` 回车
3. 开始使用 AI 编程助手！

### 常用命令

```bash
claude              # 启动 Claude Code
claude --help       # 查看帮助
claude /doctor      # 诊断环境问题
```

### 切换模型

打开 CC-Switch 桌面应用，可以一键切换不同的 AI 模型。

## 常见问题

### Q: 安装后输入 claude 提示"找不到命令"？

A: 请关闭当前终端，打开一个新的终端窗口再试。如果还是不行，请运行 `npm list -g @anthropic-ai/claude-code` 检查是否安装成功。

### Q: 提示 403 错误？

A: 说明当前配置的模型 API 有问题。打开 CC-Switch 检查 API Key 是否正确，或尝试切换到其他模型。

### Q: macOS 提示"无法验证开发者"？

A: 右键点击应用 → 选择"打开" → 点击"仍要打开"。

### Q: 安装过程中卡住/失败？

A: 可能是镜像站临时不稳定。请等几分钟后重新运行安装脚本，安装器会自动跳过已安装的组件。

## 中国大陆可用镜像覆盖

| 环境 | Node.js | NPM / Claude Code | Git | cc-switch |
|------|---------|-------------------|-----|-----------|
| macOS | npmmirror、腾讯云、华为云、清华 | npmmirror、腾讯云、华为云，官方源兜底 | 使用系统已有 Git | GitHub 代理镜像 |
| Windows | npmmirror、腾讯云、华为云、清华，WinGet 兜底 | npmmirror、腾讯云、华为云，官方源兜底 | npmmirror Git for Windows，WinGet 兜底 | GitHub 代理镜像 |
| Linux | npmmirror、腾讯云、华为云、清华 tarball | npmmirror、腾讯云、华为云，官方源兜底 | 使用系统包管理器或已有 Git | GitHub 代理镜像 |

> 说明：Claude Code 官方 NPM 包依赖 optional dependencies 下载平台二进制，安装器会使用 `--include=optional` 并在安装后运行 `claude --version` 验证。
>
> cc-switch 发布包来自 GitHub Releases，安装器提供多个 GitHub 代理镜像；代理可用性会波动，失败时请稍后重试或手动下载。

## 项目结构

```
claude-code-install/
├── scripts/              # 脚本安装方式
│   ├── install.sh        # macOS / Linux
│   ├── install.bat       # Windows 入口（双击运行）
│   └── install.ps1       # Windows 核心逻辑
├── gui/                  # 可视化安装器（Electron）
│   └── ...
├── shared/
│   └── models.json       # 预设模型配置
└── README.md             # 本文件
```

## License

MIT
