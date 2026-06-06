#!/usr/bin/env bash
# ============================================================================
#  Claude Code + CC-Switch 一键安装器 (macOS / Linux)
#  适用于中国大陆用户，优先使用国内镜像与 GitHub 代理
# ============================================================================
set -euo pipefail

# ── 颜色定义 ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# ── 镜像地址 ──────────────────────────────────────────────────────────────────
NPM_MIRROR="https://registry.npmmirror.com"
GHPROXY_MIRRORS=(
    "https://gh-proxy.com"
    "https://ghproxy.net"
)
NODE_MIRRORS=(
    "https://npmmirror.com/mirrors/node"
    "https://mirrors.cloud.tencent.com/nodejs-release"
    "https://repo.huaweicloud.com/nodejs"
    "https://mirrors.tuna.tsinghua.edu.cn/nodejs-release"
)
NODE_LTS_VERSION="v20.18.1"

# ── 全局变量 ──────────────────────────────────────────────────────────────────
NEED_NODE=false
NEED_GIT=false
NEED_CLAUDE=false
NEED_CCSWITCH=false
NODE_VERSION=""
OS_TYPE=""
OS_ARCH=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── 工具函数 ──────────────────────────────────────────────────────────────────

print_banner() {
    echo ""
    echo -e "${CYAN}${BOLD}"
    echo "  ╔══════════════════════════════════════════════════════════╗"
    echo "  ║                                                        ║"
    echo "  ║     🚀  Claude Code + CC-Switch 一键安装器              ║"
    echo "  ║         适用于中国大陆用户 · 优先国内镜像               ║"
    echo "  ║                                                        ║"
    echo "  ╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

info()    { echo -e "  ${BLUE}ℹ${NC}  $1"; }
success() { echo -e "  ${GREEN}✅${NC} $1"; }
warn()    { echo -e "  ${YELLOW}⚠️${NC}  $1"; }
error()   { echo -e "  ${RED}❌${NC} $1"; }
step()    { echo -e "\n${BOLD}${CYAN}[$1]${NC} ${BOLD}$2${NC}"; echo -e "  ${DIM}────────────────────────────────────────${NC}"; }

spinner() {
    local pid=$1
    local msg=$2
    local spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0
    while kill -0 "$pid" 2>/dev/null; do
        local c=${spin:i++%${#spin}:1}
        printf "\r  ${CYAN}${c}${NC}  %s" "$msg"
        sleep 0.1
    done
    printf "\r"
}

command_exists() {
    command -v "$1" &>/dev/null
}

version_gte() {
    # Returns 0 if $1 >= $2 (version comparison)
    printf '%s\n%s\n' "$2" "$1" | sort -V -C
}

ensure_path_in_profile() {
    local bin_dir="$1"
    local profile="$HOME/.zshrc"

    if [[ -n "${BASH_VERSION:-}" ]]; then
        profile="$HOME/.bashrc"
    fi

    mkdir -p "$(dirname "$profile")"
    touch "$profile"
    if ! grep -Fq "$bin_dir" "$profile"; then
        {
            echo ""
            echo "# Claude Code installer: user-level npm/node bin"
            echo "export PATH=\"${bin_dir}:\$PATH\""
        } >> "$profile"
        info "已将 ${bin_dir} 加入 ${profile}"
    fi
}

ensure_user_npm_prefix() {
    local npm_prefix
    npm_prefix=$(npm config get prefix 2>/dev/null || true)
    if [[ -z "$npm_prefix" || "$npm_prefix" == "undefined" ]]; then
        return 0
    fi

    if [[ ! -w "$npm_prefix" && $EUID -ne 0 ]]; then
        local user_prefix="$HOME/.npm-global"
        warn "全局 Node 目录无写入权限，切换到用户级 npm 目录: ${user_prefix}"
        mkdir -p "${user_prefix}/bin"
        npm config set prefix "$user_prefix"
        export PATH="${user_prefix}/bin:${PATH}"
        ensure_path_in_profile "${user_prefix}/bin"
    fi
}

verify_claude_code() {
    local npm_bin
    npm_bin="$(npm config get prefix 2>/dev/null)/bin"
    if [[ -d "$npm_bin" ]]; then
        export PATH="${npm_bin}:${PATH}"
    fi

    if ! command_exists claude; then
        error "Claude Code 安装后未找到 claude 命令"
        return 1
    fi

    local version_output
    if ! version_output=$(claude --version 2>&1); then
        error "Claude Code 已安装但无法运行: ${version_output}"
        return 1
    fi

    if echo "$version_output" | grep -qi "native binary"; then
        error "Claude Code native binary 缺失，请确认 npm optional dependencies 未被禁用"
        return 1
    fi

    success "Claude Code 安装完成: ${version_output}"
}

download_node_file() {
    local filename="$1"
    local output="$2"

    for mirror in "${NODE_MIRRORS[@]}"; do
        local url="${mirror}/${NODE_LTS_VERSION}/${filename}"
        info "尝试 Node.js 镜像: ${mirror}"
        if curl -fSL --progress-bar "$url" -o "$output"; then
            return 0
        fi
    done

    return 1
}

# ── Step 1: 环境检测 ──────────────────────────────────────────────────────────

detect_env() {
    step "1/5" "检测系统环境"

    # OS
    OS_TYPE=$(uname -s)
    OS_ARCH=$(uname -m)
    local os_name=""
    if [[ "$OS_TYPE" == "Darwin" ]]; then
        local macos_ver
        macos_ver=$(sw_vers -productVersion)
        os_name="macOS ${macos_ver} (${OS_ARCH})"
        success "操作系统: ${os_name}"

        # 检查 macOS 版本 >= 12
        local major_ver
        major_ver=$(echo "$macos_ver" | cut -d. -f1)
        if [[ "$major_ver" -lt 12 ]]; then
            error "需要 macOS 12 或更高版本，当前版本 ${macos_ver}"
            exit 1
        fi
    elif [[ "$OS_TYPE" == "Linux" ]]; then
        if [[ -f /etc/os-release ]]; then
            os_name=$(. /etc/os-release && echo "$PRETTY_NAME")
        else
            os_name="Linux (${OS_ARCH})"
        fi
        success "操作系统: ${os_name}"
    else
        error "不支持的操作系统: ${OS_TYPE}"
        exit 1
    fi

    # 磁盘空间
    local free_space
    if [[ "$OS_TYPE" == "Darwin" ]]; then
        free_space=$(df -g / | awk 'NR==2 {print $4}')
        if [[ "$free_space" -lt 1 ]]; then
            error "磁盘空间不足 (剩余 ${free_space}GB，需要至少 1GB)"
            exit 1
        fi
        success "磁盘空间: ${free_space}GB 可用"
    else
        free_space=$(df -BG / | awk 'NR==2 {print $4}' | tr -d 'G')
        if [[ "$free_space" -lt 1 ]]; then
            error "磁盘空间不足 (剩余 ${free_space}GB，需要至少 1GB)"
            exit 1
        fi
        success "磁盘空间: ${free_space}GB 可用"
    fi

    # Git
    if command_exists git; then
        success "Git: $(git --version | awk '{print $3}')"
    else
        warn "Git: 未安装（建议通过系统包管理器手动安装）"
    fi

    # Node.js
    if command_exists node; then
        NODE_VERSION=$(node --version | tr -d 'v')
        local node_major
        node_major=$(echo "$NODE_VERSION" | cut -d. -f1)
        if [[ "$node_major" -ge 18 ]]; then
            success "Node.js: v${NODE_VERSION}"
        else
            warn "Node.js: v${NODE_VERSION} (版本过低，需要 ≥18) → 将升级"
            NEED_NODE=true
        fi
    else
        warn "Node.js: 未安装 → 将自动安装"
        NEED_NODE=true
    fi

    # Claude Code
    if command_exists claude; then
        success "Claude Code: $(claude --version 2>/dev/null || echo '已安装')"
        info "已安装 Claude Code，将检查更新"
    else
        warn "Claude Code: 未安装 → 将安装"
        NEED_CLAUDE=true
    fi

    # cc-switch
    if [[ "$OS_TYPE" == "Darwin" ]] && [[ -d "/Applications/CC-Switch.app" || -d "/Applications/CC Switch.app" || -d "$HOME/Applications/CC-Switch.app" || -d "$HOME/Applications/CC Switch.app" ]]; then
        success "cc-switch: 已安装"
    elif command_exists cc-switch; then
        success "cc-switch: 已安装"
    else
        warn "cc-switch: 未安装 → 将安装"
        NEED_CCSWITCH=true
    fi

    echo ""
    if ! $NEED_NODE && ! $NEED_GIT && ! $NEED_CLAUDE && ! $NEED_CCSWITCH; then
        success "所有组件已就绪！无需安装。"
        echo ""
        configure_model
        print_completion
        exit 0
    fi
}


# ── Step 2: 安装 Node.js ──────────────────────────────────────────────────────

install_nodejs() {
    if ! $NEED_NODE; then
        return 0
    fi

    step "2/5" "安装 Node.js 20 LTS"

    if [[ "$OS_TYPE" == "Darwin" ]]; then
        # macOS: 直接下载 pkg 安装包
        info "通过 Node.js 镜像下载安装包..."
        local node_pkg="node-${NODE_LTS_VERSION}.pkg"
        local tmp_pkg="/tmp/nodejs-install.pkg"

        download_node_file "$node_pkg" "$tmp_pkg" || {
            error "Node.js 下载失败"
            return 1
        }

        info "正在安装 Node.js（可能需要输入密码）..."
        sudo installer -pkg "$tmp_pkg" -target / || {
            error "Node.js 安装失败"
            rm -f "$tmp_pkg"
            return 1
        }
        rm -f "$tmp_pkg"

        if command_exists node; then
            NODE_VERSION=$(node --version | tr -d 'v')
            success "Node.js v${NODE_VERSION} 安装完成"
        else
            error "Node.js 安装后未找到 node 命令"
            return 1
        fi
    else
        local node_arch=""
        case "$OS_ARCH" in
            x86_64|amd64) node_arch="x64" ;;
            aarch64|arm64) node_arch="arm64" ;;
            *)
                error "暂不支持的 Linux 架构: ${OS_ARCH}"
                return 1
                ;;
        esac

        local node_dir="$HOME/.local/nodejs"
        local tarball="node-${NODE_LTS_VERSION}-linux-${node_arch}.tar.xz"
        local tmp_tar="/tmp/${tarball}"

        info "通过 Node.js 镜像下载 Linux 压缩包..."
        download_node_file "$tarball" "$tmp_tar" || {
            error "Node.js 下载失败"
            return 1
        }

        rm -rf "$node_dir"
        mkdir -p "$node_dir"
        tar -xJf "$tmp_tar" -C "$node_dir" --strip-components=1 || {
            error "Node.js 解压失败"
            rm -f "$tmp_tar"
            return 1
        }
        rm -f "$tmp_tar"

        export PATH="${node_dir}/bin:${PATH}"
        ensure_path_in_profile "${node_dir}/bin"

        if command_exists node; then
            NODE_VERSION=$(node --version | tr -d 'v')
            success "Node.js v${NODE_VERSION} 安装完成"
        else
            error "Node.js 安装失败"
            return 1
        fi
    fi
}

# ── Step 3: 安装 Claude Code ──────────────────────────────────────────────────

install_claude_code() {
    if ! $NEED_CLAUDE; then
        # 即使已安装，也检查更新
        if command_exists claude; then
            step "3/5" "检查 Claude Code 更新"
            info "正在检查更新（淘宝镜像）..."
            ensure_user_npm_prefix
            npm install -g @anthropic-ai/claude-code@latest --include=optional --registry="${NPM_MIRROR}" 2>&1 | while IFS= read -r line; do
                echo -e "  ${DIM}${line}${NC}"
            done
            verify_claude_code
        fi
        return 0
    fi

    step "3/5" "安装 Claude Code（淘宝 NPM 镜像）"

    info "正在通过淘宝 NPM 镜像安装..."
    ensure_user_npm_prefix

    # 清理残留临时目录防 npm ENOTEMPTY 报错
    local npm_prefix
    npm_prefix=$(npm config get prefix 2>/dev/null || true)
    if [[ -n "$npm_prefix" && -d "${npm_prefix}/lib/node_modules/@anthropic-ai" ]]; then
        find "${npm_prefix}/lib/node_modules/@anthropic-ai" -maxdepth 1 -name ".claude-code-*" -exec rm -rf {} + 2>/dev/null || true
    fi

    local retry=0
    local npm_mirrors=(
        "https://registry.npmmirror.com"
        "https://mirrors.cloud.tencent.com/npm/"
        "https://mirrors.huaweicloud.com/repository/npm/"
        "https://registry.npmjs.org"
    )
    local max_retry=$((${#npm_mirrors[@]} - 1))

    while [[ $retry -le $max_retry ]]; do
        local mirror="${npm_mirrors[$retry]}"
        if [[ "$mirror" == "https://registry.npmjs.org" ]]; then
            info "使用官方源作为最终兜底: ${mirror}"
        else
            info "使用镜像: ${mirror}"
        fi

        if npm install -g @anthropic-ai/claude-code@latest --include=optional --registry="${mirror}" 2>&1 | while IFS= read -r line; do
            echo -e "  ${DIM}${line}${NC}"
        done; then
            break
        fi

        retry=$((retry + 1))
        if [[ $retry -le $max_retry ]]; then
            warn "安装失败，尝试下一个源 (${retry}/${max_retry})..."
        fi
    done

    if ! verify_claude_code; then
        error "Claude Code 安装失败"
        error "请尝试手动运行: npm install -g @anthropic-ai/claude-code@latest --include=optional --registry=${NPM_MIRROR}"
        return 1
    fi
}

# ── Step 4: 安装 cc-switch ────────────────────────────────────────────────────

install_ccswitch() {
    if ! $NEED_CCSWITCH; then
        return 0
    fi

    step "4/5" "安装 cc-switch"

    if [[ "$OS_TYPE" == "Darwin" ]]; then
        install_ccswitch_mac
    else
        install_ccswitch_linux
    fi
}

install_ccswitch_mac() {
    # 不再使用 Homebrew，直接通过 ghproxy 下载 dmg
    download_ccswitch_direct "dmg"
}

install_ccswitch_linux() {
    # Linux: 通过 ghproxy 下载 AppImage
    download_ccswitch_direct "AppImage"
}

download_ccswitch_direct() {
    local ext="$1"
    info "正在通过 GitHub 镜像代理下载 cc-switch..."

    # 获取最新版本号
    local version="v3.16.1" # 默认兜底版本
    if command_exists curl; then
        local api_version
        api_version=$(curl -s -f --connect-timeout 5 "https://api.github.com/repos/farion1231/cc-switch/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/') || true
        if [[ -z "$api_version" ]]; then
            for proxy in "${GHPROXY_MIRRORS[@]}"; do
                api_version=$(curl -s -f --connect-timeout 5 "${proxy}/https://api.github.com/repos/farion1231/cc-switch/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/') || true
                if [[ -n "$api_version" ]]; then
                    break
                fi
            done
        fi
        if [[ -n "$api_version" ]]; then
            version="$api_version"
        fi
    fi

    local filename=""
    if [[ "$ext" == "dmg" ]]; then
        filename="CC-Switch-${version}-macOS.dmg"
    elif [[ "$ext" == "AppImage" ]]; then
        filename="CC-Switch-${version}-Linux-x86_64.AppImage"
    fi

    local download_url=""

    for proxy in "${GHPROXY_MIRRORS[@]}"; do
        info "尝试镜像: ${proxy}"
        download_url="${proxy}/https://github.com/farion1231/cc-switch/releases/download/${version}/${filename}"

        local tmp_file="/tmp/cc-switch.${ext}"
        if curl -fSL --progress-bar --connect-timeout 15 "$download_url" -o "$tmp_file" 2>/dev/null; then
            if [[ "$ext" == "dmg" ]]; then
                info "正在挂载并安装 cc-switch..."
                local mount_point
                mount_point=$(hdiutil attach "$tmp_file" -nobrowse 2>/dev/null | grep "/Volumes" | awk '{print $NF}')
                if [[ -n "$mount_point" ]]; then
                    cp -R "${mount_point}"/*.app /Applications/ 2>/dev/null || \
                    cp -R "${mount_point}"/*.app "$HOME/Applications/" 2>/dev/null
                    hdiutil detach "$mount_point" -quiet 2>/dev/null || true
                fi
                rm -f "$tmp_file"
            else
                chmod +x "$tmp_file"
                mkdir -p "$HOME/.local/bin"
                mv "$tmp_file" "$HOME/.local/bin/cc-switch"
            fi

            success "cc-switch 安装完成"
            return 0
        fi
    done

    warn "cc-switch 自动安装失败"
    info "请手动下载安装: https://github.com/farion1231/cc-switch/releases"
    info "提示：使用浏览器访问 https://gh-proxy.com/https://github.com/farion1231/cc-switch/releases"
}

# ── Step 5: 配置模型 ──────────────────────────────────────────────────────────

configure_model() {
    step "5/5" "配置 AI 模型"

    echo ""
    echo -e "  ${BOLD}请通过 cc-switch 配置并启用国产模型。${NC}"
    echo -e "  ${DIM}Claude Code 需要 Anthropic 协议接口；不要把国产模型地址直接写入 ~/.claude/settings.json。${NC}"
    echo -e "  ${DIM}cc-switch 会负责协议转换，并在启用配置后写入本地代理地址。${NC}"
    echo ""
    echo -e "  ${GREEN}${BOLD}1)${NC} ${BOLD}DeepSeek${NC} ${GREEN}(推荐)${NC}"
    echo -e "     ${DIM}API Key: https://platform.deepseek.com/api_keys${NC}"
    echo ""
    echo -e "  ${BOLD}2)${NC} ${BOLD}智谱 GLM-4${NC}"
    echo -e "     ${DIM}API Key: https://open.bigmodel.cn/usercenter/apikeys${NC}"
    echo ""
    echo -e "  ${BOLD}3)${NC} ${BOLD}通义千问${NC}"
    echo -e "     ${DIM}API Key: https://dashscope.console.aliyun.com/apiKey${NC}"
    echo ""
    echo -e "  ${CYAN}下一步：打开 cc-switch → Claude Code → 新建/选择模型 → 填入 API Key → 启用。${NC}"
    echo ""
    read -rp "  已在 cc-switch 中启用模型后按回车继续，或直接按回车稍后配置... " </dev/tty
}

# ── 完成页面 ──────────────────────────────────────────────────────────────────

print_completion() {
    echo ""
    echo -e "${GREEN}${BOLD}"
    echo "  ╔══════════════════════════════════════════════════════════╗"
    echo "  ║                                                        ║"
    echo "  ║              🎉  安装完成！                              ║"
    echo "  ║                                                        ║"
    echo "  ╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo -e "  ${BOLD}快速开始:${NC}"
    echo ""
    echo -e "  ${CYAN}1.${NC} 打开一个${BOLD}新的${NC}终端窗口"
    echo -e "  ${CYAN}2.${NC} 输入 ${GREEN}${BOLD}claude${NC} 并回车"
    echo -e "  ${CYAN}3.${NC} 开始使用 AI 编程助手！"
    echo ""
    echo -e "  ${BOLD}模型切换与管理 (cc-switch):${NC}"
    echo -e "  ${DIM}• 启动后，cc-switch 会运行在系统托盘（Mac 顶部菜单栏 / Windows 右下角托盘）${NC}"
    echo -e "  ${DIM}• 点击其图标可一键在 DeepSeek, GLM-4, Qwen 等模型之间切换${NC}"
    echo -e "  ${DIM}• 切换后，下次在终端运行 \`claude\` 就会自动生效${NC}"
    echo ""
    echo -e "  ${BOLD}其他提示:${NC}"
    echo -e "  ${DIM}• claude --help 查看帮助${NC}"
    echo -e "  ${DIM}• claude /doctor 诊断环境问题${NC}"
    echo ""
    echo -e "  ${DIM}⚠️  请务必打开新终端窗口后再使用 claude 命令${NC}"
    echo ""
}

# ── 主流程 ────────────────────────────────────────────────────────────────────

main() {
    print_banner

    # 检测环境
    detect_env

    echo ""
    echo -e "  ${BOLD}即将安装以上标记的组件。${NC}"
    read -rp "  按回车键开始安装，或 Ctrl+C 取消... " </dev/tty

    # 按顺序安装

    install_nodejs || {
        error "Node.js 安装失败，无法继续"
        exit 1
    }

    install_claude_code || {
        error "Claude Code 安装失败"
        exit 1
    }

    install_ccswitch || true

    # 配置模型
    configure_model

    # 完成
    print_completion
}

# 运行
main "$@"
