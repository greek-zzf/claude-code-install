# ============================================================================
#  Claude Code + CC-Switch 一键安装器 (Windows)
#  适用于中国大陆用户，优先使用国内镜像与 GitHub 代理
# ============================================================================

#Requires -Version 5.1

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue" # 加速 Invoke-WebRequest

# ── 镜像地址 ──────────────────────────────────────────────────────────────────
$NPM_MIRROR = "https://registry.npmmirror.com"
$NODE_MIRRORS = @(
    "https://npmmirror.com/mirrors/node",
    "https://mirrors.cloud.tencent.com/nodejs-release",
    "https://repo.huaweicloud.com/nodejs",
    "https://mirrors.tuna.tsinghua.edu.cn/nodejs-release"
)
$GIT_MIRROR = "https://registry.npmmirror.com/-/binary/git-for-windows"
$NODE_LTS_VERSION = "v20.18.1"
$GHPROXY_MIRRORS = @(
    "https://gh-proxy.com"
    "https://ghproxy.net"
)

# ── 全局变量 ──────────────────────────────────────────────────────────────────
$script:NeedGit = $false
$script:NeedNode = $false
$script:NeedClaude = $false
$script:NeedCCSwitch = $false
$script:HasWinGet = $false

# ── 工具函数 ──────────────────────────────────────────────────────────────────

function Write-Banner {
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║                                                        ║" -ForegroundColor Cyan
    Write-Host "  ║     🚀  Claude Code + CC-Switch 一键安装器              ║" -ForegroundColor Cyan
    Write-Host "  ║         适用于中国大陆用户 · 优先国内镜像               ║" -ForegroundColor Cyan
    Write-Host "  ║                                                        ║" -ForegroundColor Cyan
    Write-Host "  ╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Info    { param($msg) Write-Host "  ℹ  $msg" -ForegroundColor Blue }
function Write-Success { param($msg) Write-Host "  ✅ $msg" -ForegroundColor Green }
function Write-Warn    { param($msg) Write-Host "  ⚠️  $msg" -ForegroundColor Yellow }
function Write-Err     { param($msg) Write-Host "  ❌ $msg" -ForegroundColor Red }
function Write-Step    { param($num, $msg)
    Write-Host ""
    Write-Host "  [$num] $msg" -ForegroundColor Cyan
    Write-Host "  ────────────────────────────────────────" -ForegroundColor DarkGray
}

function Test-Command {
    param([string]$Name)
    $null = Get-Command $Name -ErrorAction SilentlyContinue
    return $?
}

function Invoke-WithRetry {
    param(
        [scriptblock]$ScriptBlock,
        [int]$MaxRetry = 2,
        [string]$FailMsg = "操作失败"
    )
    for ($i = 0; $i -le $MaxRetry; $i++) {
        try {
            & $ScriptBlock
            return $true
        }
        catch {
            if ($i -lt $MaxRetry) {
                Write-Warn "失败，正在重试 ($($i+1)/$MaxRetry)..."
                Start-Sleep -Seconds 2
            }
        }
    }
    Write-Err $FailMsg
    return $false
}

function Invoke-NodeDownload {
    param(
        [string]$FileName,
        [string]$OutFile
    )

    foreach ($mirror in $NODE_MIRRORS) {
        $url = "$mirror/$NODE_LTS_VERSION/$FileName"
        Write-Info "尝试 Node.js 镜像: $mirror"
        try {
            Invoke-WebRequest -Uri $url -OutFile $OutFile -UseBasicParsing -TimeoutSec 60
            return $true
        }
        catch {
            Write-Warn "此 Node.js 镜像下载失败，尝试下一个..."
        }
    }

    return $false
}

function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

function Add-NpmPrefixToPath {
    try {
        $npmPrefix = (npm config get prefix 2>$null).Trim()
        if ($npmPrefix -and (Test-Path $npmPrefix)) {
            $env:Path = "$npmPrefix;$env:Path"
        }
    }
    catch {}
}

function Confirm-ClaudeCode {
    Refresh-Path
    Add-NpmPrefixToPath

    if (-not (Test-Command "claude")) {
        Write-Err "Claude Code 安装后未找到 claude 命令"
        return $false
    }

    $versionOutput = claude --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Claude Code 已安装但无法运行: $versionOutput"
        return $false
    }

    if (($versionOutput -join "`n") -match "native binary") {
        Write-Err "Claude Code native binary 缺失，请确认 npm optional dependencies 未被禁用"
        return $false
    }

    Write-Success "Claude Code 安装完成: $versionOutput"
    return $true
}

function Get-LatestCCSwitchVersion {
    $defaultVersion = "v3.16.1"
    $apiUrls = @("https://api.github.com/repos/farion1231/cc-switch/releases/latest")
    foreach ($proxy in $GHPROXY_MIRRORS) {
        $apiUrls += "$proxy/https://api.github.com/repos/farion1231/cc-switch/releases/latest"
    }

    foreach ($url in $apiUrls) {
        try {
            $release = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10 | ConvertFrom-Json
            if ($release.tag_name) {
                return $release.tag_name
            }
        }
        catch {}
    }

    return $defaultVersion
}

# ── Step 1: 环境检测 ──────────────────────────────────────────────────────────

function Test-Environment {
    Write-Step "1/6" "检测系统环境"

    # OS
    $osInfo = Get-CimInstance Win32_OperatingSystem
    $osVersion = $osInfo.Version
    $osBuild = [int]($osVersion.Split('.')[2])
    $osCaption = $osInfo.Caption
    Write-Success "操作系统: $osCaption ($osVersion)"

    # Windows 10+ 检测
    $major = [int]($osVersion.Split('.')[0])
    if ($major -lt 10) {
        Write-Err "需要 Windows 10 或更高版本"
        exit 1
    }

    # 磁盘空间
    $drive = Get-PSDrive C
    $freeGB = [math]::Round($drive.Free / 1GB, 1)
    if ($freeGB -lt 1) {
        Write-Err "磁盘空间不足 (剩余 ${freeGB}GB，需要至少 1GB)"
        exit 1
    }
    Write-Success "磁盘空间: ${freeGB}GB 可用"

    # WinGet
    if (Test-Command "winget") {
        $script:HasWinGet = $true
        Write-Success "WinGet: 已安装"
    } else {
        Write-Warn "WinGet: 未安装（将使用直接下载方式）"
    }

    # Git
    if (Test-Command "git") {
        $gitVer = (git --version) -replace 'git version ', ''
        Write-Success "Git: $gitVer"
    } else {
        Write-Warn "Git: 未安装 → 将自动安装"
        $script:NeedGit = $true
    }

    # Node.js
    if (Test-Command "node") {
        $nodeVer = (node --version) -replace 'v', ''
        $nodeMajor = [int]($nodeVer.Split('.')[0])
        if ($nodeMajor -ge 18) {
            Write-Success "Node.js: v$nodeVer"
        } else {
            Write-Warn "Node.js: v$nodeVer (版本过低，需要 ≥18) → 将升级"
            $script:NeedNode = $true
        }
    } else {
        Write-Warn "Node.js: 未安装 → 将自动安装"
        $script:NeedNode = $true
    }

    # Claude Code
    Refresh-Path
    if (Test-Command "claude") {
        Write-Success "Claude Code: 已安装"
    } else {
        Write-Warn "Claude Code: 未安装 → 将安装"
        $script:NeedClaude = $true
    }

    # cc-switch
    $ccSwitchPaths = @(
        "$env:LOCALAPPDATA\CC-Switch\CC-Switch.exe",
        "$env:ProgramFiles\CC-Switch\CC-Switch.exe",
        "${env:ProgramFiles(x86)}\CC-Switch\CC-Switch.exe"
    )
    $ccSwitchFound = $false
    foreach ($p in $ccSwitchPaths) {
        if (Test-Path $p) {
            $ccSwitchFound = $true
            break
        }
    }
    if ($ccSwitchFound -or (Test-Command "cc-switch")) {
        Write-Success "cc-switch: 已安装"
    } else {
        Write-Warn "cc-switch: 未安装 → 将安装"
        $script:NeedCCSwitch = $true
    }

    # 全部已就绪？
    if (-not $script:NeedGit -and -not $script:NeedNode -and -not $script:NeedClaude -and -not $script:NeedCCSwitch) {
        Write-Host ""
        Write-Success "所有组件已就绪！无需安装。"
        Set-ModelConfig
        Write-Completion
        exit 0
    }
}

# ── Step 2: 安装 Git ──────────────────────────────────────────────────────────

function Install-Git {
    if (-not $script:NeedGit) { return }

    Write-Step "2/6" "安装 Git for Windows"

    # 优先使用国内镜像直接下载安装
    Write-Info "通过淘宝镜像下载 Git 安装包..."
    $gitUrl = "https://registry.npmmirror.com/-/binary/git-for-windows/v2.47.1.windows.1/Git-2.47.1-64-bit.exe"
    $gitInstaller = "$env:TEMP\git-installer.exe"

    try {
        Invoke-WebRequest -Uri $gitUrl -OutFile $gitInstaller -UseBasicParsing
        Write-Info "正在静默安装 Git..."
        Start-Process -FilePath $gitInstaller -ArgumentList "/VERYSILENT /NORESTART /NOCANCEL /SP- /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS /COMPONENTS=`"icons,ext\reg\shellhere,assoc,assoc_sh`"" -Wait
        Remove-Item $gitInstaller -Force -ErrorAction SilentlyContinue

        Refresh-Path
        # Git 安装后路径可能需要手动添加
        $gitPath = "C:\Program Files\Git\cmd"
        if (Test-Path $gitPath) {
            $env:Path = "$gitPath;$env:Path"
        }

        if (Test-Command "git") {
            Write-Success "Git 安装完成"
            return
        } else {
            Write-Warn "Git 安装完成但需要重启终端才能使用"
        }
    }
    catch {
        Write-Warn "Git 镜像下载/安装失败: $_"
    }

    if ($script:HasWinGet) {
        Write-Info "尝试通过 WinGet 兜底安装 Git..."
        try {
            winget install Git.Git --accept-source-agreements --accept-package-agreements --silent 2>&1 | ForEach-Object {
                Write-Host "  $_" -ForegroundColor DarkGray
            }
            Refresh-Path
            if (Test-Command "git") {
                Write-Success "Git 安装完成"
                return
            }
        }
        catch {
            Write-Warn "WinGet 安装失败"
        }
    }

    Write-Err "Git 安装失败"
    Write-Info "请手动下载安装: https://registry.npmmirror.com/-/binary/git-for-windows/"
}

# ── Step 3: 安装 Node.js ──────────────────────────────────────────────────────

function Install-NodeJS {
    if (-not $script:NeedNode) { return }

    Write-Step "3/6" "安装 Node.js 20 LTS"

    # 优先使用国内镜像直接下载 MSI
    Write-Info "通过 Node.js 镜像下载安装包..."
    $nodeFile = "node-$NODE_LTS_VERSION-x64.msi"
    $nodeMsi = "$env:TEMP\nodejs-install.msi"

    try {
        if (-not (Invoke-NodeDownload -FileName $nodeFile -OutFile $nodeMsi)) {
            throw "所有 Node.js 镜像均下载失败"
        }
        Write-Info "正在静默安装 Node.js..."
        Start-Process msiexec.exe -ArgumentList "/i `"$nodeMsi`" /qn /norestart" -Wait
        Remove-Item $nodeMsi -Force -ErrorAction SilentlyContinue

        Refresh-Path
        # Node.js 默认安装路径
        $nodePath = "C:\Program Files\nodejs"
        if (Test-Path $nodePath) {
            $env:Path = "$nodePath;$env:Path"
        }

        if (Test-Command "node") {
            $ver = node --version
            Write-Success "Node.js $ver 安装完成"
            return
        } else {
            Write-Err "Node.js 安装失败"
            exit 1
        }
    }
    catch {
        Write-Warn "Node.js 镜像下载/安装失败: $_"
    }

    if ($script:HasWinGet) {
        Write-Info "尝试通过 WinGet 兜底安装 Node.js..."
        try {
            winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent 2>&1 | ForEach-Object {
                Write-Host "  $_" -ForegroundColor DarkGray
            }
            Refresh-Path
            if (Test-Command "node") {
                $ver = node --version
                Write-Success "Node.js $ver 安装完成"
                return
            }
        }
        catch {
            Write-Warn "WinGet 安装失败"
        }
    }

    Write-Err "Node.js 安装失败"
    exit 1
}

# ── Step 4: 安装 Claude Code ──────────────────────────────────────────────────

function Install-ClaudeCode {
    if (-not $script:NeedClaude) {
        # 检查更新
        if (Test-Command "claude") {
            Write-Step "4/6" "检查 Claude Code 更新"
            npm install -g @anthropic-ai/claude-code@latest --include=optional --registry="$NPM_MIRROR" 2>&1 | ForEach-Object {
                Write-Host "  $_" -ForegroundColor DarkGray
            }
            if (-not (Confirm-ClaudeCode)) {
                Write-Err "Claude Code 更新后验证失败"
                exit 1
            }
        }
        return
    }

    Write-Step "4/6" "安装 Claude Code（淘宝 NPM 镜像）"

    # 清理残留临时目录防 npm ENOTEMPTY 报错
    try {
        $npmPrefix = (npm config get prefix 2>$null).Trim()
        if ($npmPrefix -and (Test-Path "$npmPrefix\node_modules\@anthropic-ai")) {
            Get-ChildItem -Path "$npmPrefix\node_modules\@anthropic-ai" -Filter ".claude-code-*" -Directory | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        }
    } catch {}

    $mirrors = @(
        "https://registry.npmmirror.com",
        "https://mirrors.cloud.tencent.com/npm/",
        "https://mirrors.huaweicloud.com/repository/npm/",
        "https://registry.npmjs.org"
    )

    foreach ($mirror in $mirrors) {
        if ($mirror -eq "https://registry.npmjs.org") {
            Write-Info "使用官方源作为最终兜底: $mirror"
        } else {
            Write-Info "使用镜像: $mirror"
        }
        try {
            $output = npm install -g @anthropic-ai/claude-code@latest --include=optional --registry="$mirror" 2>&1
            $output | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
            if ($LASTEXITCODE -eq 0) {
                break
            } else {
                Write-Warn "安装失败，尝试下一个镜像..."
            }
        }
        catch {
            Write-Warn "安装失败，尝试下一个镜像..."
        }
    }

    Refresh-Path
    Add-NpmPrefixToPath

    if (-not (Confirm-ClaudeCode)) {
        Write-Err "Claude Code 安装失败"
        Write-Err "请尝试手动运行: npm install -g @anthropic-ai/claude-code@latest --include=optional --registry=$NPM_MIRROR"
        exit 1
    }
}

# ── Step 5: 安装 cc-switch ────────────────────────────────────────────────────

function Install-CCSwitch {
    if (-not $script:NeedCCSwitch) { return }

    Write-Step "5/6" "安装 cc-switch"

    Write-Info "正在通过 GitHub 镜像代理下载 cc-switch..."
    $version = Get-LatestCCSwitchVersion
    $filename = "CC-Switch-$version-Windows.msi"

    foreach ($proxy in $GHPROXY_MIRRORS) {
        Write-Info "尝试镜像: $proxy"

        $downloadUrl = "$proxy/https://github.com/farion1231/cc-switch/releases/download/$version/$filename"
        $msiPath = "$env:TEMP\cc-switch.msi"

        try {
            Invoke-WebRequest -Uri $downloadUrl -OutFile $msiPath -UseBasicParsing -TimeoutSec 60
            Write-Info "正在静默安装 cc-switch..."
            Start-Process msiexec.exe -ArgumentList "/i `"$msiPath`" /qn /norestart" -Wait
            Remove-Item $msiPath -Force -ErrorAction SilentlyContinue

            Write-Success "cc-switch 安装完成"
            return
        }
        catch {
            Write-Warn "此镜像下载失败，尝试下一个..."
            continue
        }
    }

    Write-Warn "cc-switch 自动安装失败"
    Write-Info "请手动下载安装:"
    Write-Info "  https://gh-proxy.com/https://github.com/farion1231/cc-switch/releases"
}

# ── Step 6: 配置模型 ──────────────────────────────────────────────────────────

function Set-ModelConfig {
    Write-Step "6/6" "配置 AI 模型"

    Write-Host ""
    Write-Host "  请通过 cc-switch 配置并启用国产模型。" -ForegroundColor White
    Write-Host "  Claude Code 需要 Anthropic 协议接口；不要把国产模型地址直接写入 ~/.claude/settings.json。" -ForegroundColor DarkGray
    Write-Host "  cc-switch 会负责协议转换，并在启用配置后写入本地代理地址。" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  1) DeepSeek " -NoNewline -ForegroundColor White
    Write-Host "(推荐)" -ForegroundColor Green
    Write-Host "     API Key: https://platform.deepseek.com/api_keys" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  2) 智谱 GLM-4" -ForegroundColor White
    Write-Host "     API Key: https://open.bigmodel.cn/usercenter/apikeys" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  3) 通义千问" -ForegroundColor White
    Write-Host "     API Key: https://dashscope.console.aliyun.com/apiKey" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  下一步：打开 cc-switch → Claude Code → 新建/选择模型 → 填入 API Key → 启用。" -ForegroundColor Cyan
    Write-Host ""
    $null = Read-Host "  已在 cc-switch 中启用模型后按回车继续，或直接按回车稍后配置"
}

# ── 完成页面 ──────────────────────────────────────────────────────────────────

function Write-Completion {
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "  ║                                                        ║" -ForegroundColor Green
    Write-Host "  ║              🎉  安装完成！                              ║" -ForegroundColor Green
    Write-Host "  ║                                                        ║" -ForegroundColor Green
    Write-Host "  ╚══════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "  快速开始:" -ForegroundColor White
    Write-Host ""
    Write-Host "  1. 打开一个" -NoNewline -ForegroundColor Cyan
    Write-Host "新的" -NoNewline -ForegroundColor White
    Write-Host " Git Bash 或 PowerShell 窗口" -ForegroundColor Cyan
    Write-Host "  2. 输入 " -NoNewline -ForegroundColor Cyan
    Write-Host "claude" -NoNewline -ForegroundColor Green
    Write-Host " 并回车" -ForegroundColor Cyan
    Write-Host "  3. 开始使用 AI 编程助手！" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  模型切换与管理 (cc-switch):" -ForegroundColor White
    Write-Host "  • 启动后，cc-switch 会运行在系统右下角托盘" -ForegroundColor DarkGray
    Write-Host "  • 点击托盘图标可一键在 DeepSeek, GLM-4, Qwen 等模型之间切换" -ForegroundColor DarkGray
    Write-Host "  • 切换后，下次在终端运行 claude 就会自动生效" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  其他提示:" -ForegroundColor White
    Write-Host "  • claude --help 查看帮助" -ForegroundColor DarkGray
    Write-Host "  • claude /doctor 诊断环境问题" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  ⚠️  请务必打开新终端窗口后再使用 claude 命令" -ForegroundColor Yellow
    Write-Host ""
}

# ── 主流程 ────────────────────────────────────────────────────────────────────

function Main {
    Write-Banner

    # 检测环境
    Test-Environment

    Write-Host ""
    Write-Host "  即将安装以上标记的组件。" -ForegroundColor White
    $null = Read-Host "  按回车键开始安装，或关闭窗口取消"

    # 按顺序安装
    Install-Git
    Install-NodeJS
    Install-ClaudeCode
    Install-CCSwitch

    # 配置模型
    Set-ModelConfig

    # 完成
    Write-Completion
}

# 运行
Main
