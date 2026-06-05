#!/usr/bin/env bash
# ============================================================================
#  Claude Code + CC-Switch 一键安装器 (macOS / Linux)
#  适用于中国大陆用户，全程使用国内镜像，无需翻墙
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
    "https://ghp.ci"
    "https://gh-proxy.com"
    "https://ghproxy.net"
)
NODE_MIRROR="https://npmmirror.com/mirrors/node/"

# ── 全局变量 ──────────────────────────────────────────────────────────────────
NEED_NODE=false
NEED_GIT=false
NEED_CLAUDE=false
NEED_CCSWITCH=false
NODE_VERSION=""
OS_TYPE=""
OS_ARCH=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELS_JSON=""

# ── 工具函数 ──────────────────────────────────────────────────────────────────

print_banner() {
    echo ""
    echo -e "${CYAN}${BOLD}"
    echo "  ╔══════════════════════════════════════════════════════════╗"
    echo "  ║                                                        ║"
    echo "  ║     🚀  Claude Code + CC-Switch 一键安装器              ║"
    echo "  ║         适用于中国大陆用户 · 全程国内镜像               ║"
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

# ── 加载模型配置 ──────────────────────────────────────────────────────────────

load_models() {
    local models_file="${SCRIPT_DIR}/../shared/models.json"
    if [[ -f "$models_file" ]]; then
        MODELS_JSON=$(cat "$models_file")
    else
        # 内嵌默认配置
        MODELS_JSON='[
  {"id":"deepseek","name":"DeepSeek","description":"国产顶级编程模型，性价比极高","recommended":true,"apiKeyUrl":"https://platform.deepseek.com/api_keys","baseUrl":"https://api.deepseek.com","modelId":"deepseek-coder"},
  {"id":"glm","name":"智谱 GLM-4","description":"清华系大模型，中文理解能力强","recommended":false,"apiKeyUrl":"https://open.bigmodel.cn/usercenter/apikeys","baseUrl":"https://open.bigmodel.cn/api/paas/v4","modelId":"glm-4-plus"},
  {"id":"qwen","name":"通义千问","description":"阿里云大模型，生态完善","recommended":false,"apiKeyUrl":"https://dashscope.console.aliyun.com/apiKey","baseUrl":"https://dashscope.aliyuncs.com/compatible-mode/v1","modelId":"qwen-max"}
]'
    fi
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
        warn "Git: 未安装 → 将自动安装"
        NEED_GIT=true
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
        info "通过清华镜像直接下载 Node.js 安装包..."
        local node_pkg_url="https://mirrors.tuna.tsinghua.edu.cn/nodejs-release/v20.18.1/node-v20.18.1.pkg"
        local tmp_pkg="/tmp/nodejs-install.pkg"

        curl -fSL --progress-bar "$node_pkg_url" -o "$tmp_pkg" || {
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
        # Linux: 如果有 brew，通过 brew 安装，否则提示错误
        if command_exists brew; then
            info "通过 Homebrew 安装 Node.js 20..."
            brew install node@20 2>&1 | while IFS= read -r line; do
                echo -e "  ${DIM}${line}${NC}"
            done

            # 链接 node@20
            brew link --overwrite node@20 2>/dev/null || true

            if command_exists node; then
                NODE_VERSION=$(node --version | tr -d 'v')
                success "Node.js v${NODE_VERSION} 安装完成"
            else
                # 添加到 PATH
                local node_path
                node_path="$(brew --prefix node@20)/bin"
                export PATH="${node_path}:${PATH}"
                if command_exists node; then
                    NODE_VERSION=$(node --version | tr -d 'v')
                    success "Node.js v${NODE_VERSION} 安装完成"
                else
                    error "Node.js 安装失败"
                    return 1
                fi
            fi
        else
            error "Linux 环境下未找到 Node.js 且未安装 Homebrew，请先手动安装 Node.js (>=18)"
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
            npm update -g @anthropic-ai/claude-code --registry="${NPM_MIRROR}" 2>&1 | while IFS= read -r line; do
                echo -e "  ${DIM}${line}${NC}"
            done
            success "Claude Code 已是最新版本"
        fi
        return 0
    fi

    step "3/5" "安装 Claude Code（淘宝 NPM 镜像）"

    info "正在通过淘宝 NPM 镜像安装..."

    local use_sudo=""
    local npm_prefix
    npm_prefix=$(npm config get prefix 2>/dev/null || echo "/usr/local")
    if [[ ! -w "$npm_prefix" ]] && [[ $EUID -ne 0 ]]; then
        use_sudo="sudo"
        info "检测到全局 Node 目录无写入权限，将尝试使用 sudo 进行安装..."
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

        if $use_sudo npm install -g @anthropic-ai/claude-code --registry="${mirror}" 2>&1 | while IFS= read -r line; do
            echo -e "  ${DIM}${line}${NC}"
        done; then
            break
        fi

        retry=$((retry + 1))
        if [[ $retry -le $max_retry ]]; then
            warn "安装失败，尝试下一个源 (${retry}/${max_retry})..."
        fi
    done

    # 验证安装
    # npm 全局 bin 可能不在 PATH 中
    if ! command_exists claude; then
        local npm_bin
        npm_bin="$(npm config get prefix)/bin"
        export PATH="${npm_bin}:${PATH}"
    fi

    if command_exists claude; then
        success "Claude Code 安装完成: $(claude --version 2>/dev/null || echo '已安装')"
    else
        error "Claude Code 安装失败"
        error "请尝试手动运行: npm install -g @anthropic-ai/claude-code --registry=${NPM_MIRROR}"
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
    info "提示：使用浏览器访问 https://mirror.ghproxy.com/https://github.com/farion1231/cc-switch/releases"
}

# ── Step 5: 配置模型 ──────────────────────────────────────────────────────────

configure_model() {
    step "5/5" "配置 AI 模型"

    load_models

    echo ""
    echo -e "  ${BOLD}请选择默认使用的 AI 模型:${NC}"
    echo ""
    echo -e "  ${GREEN}${BOLD}1)${NC} ${BOLD}DeepSeek${NC} ${GREEN}(推荐)${NC}"
    echo -e "     ${DIM}国产顶级编程模型，性价比极高，约 ¥0.001/千token${NC}"
    echo ""
    echo -e "  ${BOLD}2)${NC} ${BOLD}智谱 GLM-4${NC}"
    echo -e "     ${DIM}清华系大模型，中文理解能力强，约 ¥0.05/千token${NC}"
    echo ""
    echo -e "  ${BOLD}3)${NC} ${BOLD}通义千问${NC}"
    echo -e "     ${DIM}阿里云大模型，生态完善，约 ¥0.02/千token${NC}"
    echo ""
    echo -e "  ${BOLD}4)${NC} ${DIM}跳过，稍后在 cc-switch 中配置${NC}"
    echo ""

    local choice
    read -rp "  请输入选项 [1-4] (默认 1): " choice </dev/tty
    choice="${choice:-1}"

    local base_url=""
    local model_name=""
    local api_key_url=""

    case "$choice" in
        1)
            model_name="DeepSeek"
            base_url="https://api.deepseek.com"
            api_key_url="https://platform.deepseek.com/api_keys"
            ;;
        2)
            model_name="智谱 GLM-4"
            base_url="https://open.bigmodel.cn/api/paas/v4"
            api_key_url="https://open.bigmodel.cn/usercenter/apikeys"
            ;;
        3)
            model_name="通义千问"
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
            api_key_url="https://dashscope.console.aliyun.com/apiKey"
            ;;
        4)
            info "跳过模型配置。请安装完成后打开 cc-switch 进行配置。"
            return 0
            ;;
        *)
            warn "无效选项，跳过配置"
            return 0
            ;;
    esac

    echo ""
    info "已选择: ${BOLD}${model_name}${NC}"
    info "请在以下网址获取 API Key:"
    echo -e "  ${CYAN}${api_key_url}${NC}"
    echo ""

    local api_key
    read -rp "  请输入 API Key (输入后回车): " api_key </dev/tty

    if [[ -z "$api_key" ]]; then
        warn "未输入 API Key，跳过配置"
        return 0
    fi

    # 写入配置
    local claude_dir="$HOME/.claude"
    local settings_file="${claude_dir}/settings.json"
    mkdir -p "$claude_dir"

    # 如果已有配置，先备份
    if [[ -f "$settings_file" ]]; then
        cp "$settings_file" "${settings_file}.bak"
        info "已备份原有配置到 settings.json.bak"
    fi

    # 写入新配置（保留已有配置中的其他字段）
    if command_exists python3; then
        python3 -c "
import json, os

settings_file = os.path.expanduser('~/.claude/settings.json')
settings = {}
if os.path.exists(settings_file):
    try:
        with open(settings_file) as f:
            settings = json.load(f)
    except:
        pass

if 'env' not in settings:
    settings['env'] = {}

settings['env']['ANTHROPIC_BASE_URL'] = '${base_url}'
settings['env']['ANTHROPIC_AUTH_TOKEN'] = '${api_key}'

with open(settings_file, 'w') as f:
    json.dump(settings, f, indent=2, ensure_ascii=False)
"
    else
        # 没有 python3，直接写入
        cat > "$settings_file" << EOJSON
{
  "env": {
    "ANTHROPIC_BASE_URL": "${base_url}",
    "ANTHROPIC_AUTH_TOKEN": "${api_key}"
  }
}
EOJSON
    fi

    success "模型配置已写入 ${settings_file}"
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
