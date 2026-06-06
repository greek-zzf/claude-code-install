import { execSync, spawn, SpawnOptionsWithoutStdio } from 'child_process'
import { platform, homedir } from 'os'
import { BrowserWindow } from 'electron'
import { EnvCheckResult } from './env-check'
import { join } from 'path'
import { existsSync, readdirSync, rmSync } from 'fs'

const NPM_MIRRORS = [
  'https://registry.npmmirror.com',
  'https://mirrors.cloud.tencent.com/npm/',
  'https://mirrors.huaweicloud.com/repository/npm/',
  'https://registry.npmjs.org'
]
const HOMEBREW_GITEE = 'https://gitee.com/cunkai/HomebrewCN/raw/master/Homebrew.sh'
const HOMEBREW_API_MIRROR = 'https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/api'
const HOMEBREW_BOTTLE_MIRROR = 'https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles'
const NODE_MIRRORS = [
  'https://npmmirror.com/mirrors/node',
  'https://mirrors.cloud.tencent.com/nodejs-release',
  'https://repo.huaweicloud.com/nodejs',
  'https://mirrors.tuna.tsinghua.edu.cn/nodejs-release'
]
const NODE_LTS_VERSION = 'v20.18.1'
const GIT_MIRROR = 'https://registry.npmmirror.com/-/binary/git-for-windows'
const GHPROXY_MIRRORS = [
  'https://gh-proxy.com',
  'https://ghproxy.net'
]

function sendLog(step: string, line: string) {
  const win = BrowserWindow.getAllWindows()[0]
  if (win) win.webContents.send('install:log', { step, line })
}

function sendStepComplete(step: string, success: boolean, error?: string) {
  const win = BrowserWindow.getAllWindows()[0]
  if (win) win.webContents.send('install:step-complete', { step, success, error })
}

function runCommand(
  cmd: string,
  args: string[],
  step: string,
  opts?: SpawnOptionsWithoutStdio
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const pathDelimiter = platform() === 'win32' ? ';' : ':'
    const pathKey = platform() === 'win32' ? 'Path' : 'PATH'
    const extraPaths = platform() === 'darwin'
      ? ['/opt/homebrew/bin', '/usr/local/bin']
      : []

    try {
      const npmPrefix = execSync('npm config get prefix', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
      if (npmPrefix) {
        extraPaths.push(platform() === 'win32' ? npmPrefix : join(npmPrefix, 'bin'))
      }
    } catch {}

    // Add NVM path if exists
    if (platform() === 'darwin') {
      const nvmDir = join(homedir(), '.nvm/versions/node')
      if (existsSync(nvmDir)) {
        try {
          const versions = readdirSync(nvmDir)
          if (versions.length > 0) {
            versions.sort()
            const latest = versions[versions.length - 1]
            extraPaths.push(join(nvmDir, latest, 'bin'))
          }
        } catch {}
      }
    }

    const currentPath = process.env[pathKey] || ''
    const newPath = [...extraPaths, currentPath].filter(Boolean).join(pathDelimiter)

    const env = {
      ...process.env,
      [pathKey]: newPath,
      HOMEBREW_API_DOMAIN: HOMEBREW_API_MIRROR,
      HOMEBREW_BOTTLE_DOMAIN: HOMEBREW_BOTTLE_MIRROR,
      ...opts?.env
    }

    const child = spawn(cmd, args, {
      shell: platform() === 'win32',
      env,
      ...opts
    })

    let stderr = ''

    child.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean)
      lines.forEach((line) => sendLog(step, line))
    })

    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString()
      stderr += text
      const lines = text.split('\n').filter(Boolean)
      lines.forEach((line) => sendLog(step, line))
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true })
      } else {
        resolve({ success: false, error: stderr || `Exit code: ${code}` })
      }
    })

    child.on('error', (err) => {
      resolve({ success: false, error: err.message })
    })
  })
}

async function downloadNodeFile(fileName: string, outputPath: string, step: string): Promise<{ success: boolean; error?: string }> {
  let lastError = ''

  for (const mirror of NODE_MIRRORS) {
    sendLog(step, `尝试 Node.js 镜像: ${mirror}`)
    const url = `${mirror}/${NODE_LTS_VERSION}/${fileName}`
    const result = platform() === 'win32'
      ? await runCommand('powershell', ['-Command', `Invoke-WebRequest -Uri '${url}' -OutFile '${outputPath}' -UseBasicParsing -TimeoutSec 60`], step)
      : await runCommand('curl', ['-fSL', '--progress-bar', url, '-o', outputPath], step)

    if (result.success) return result
    lastError = result.error || '下载失败'
  }

  return { success: false, error: lastError || '所有 Node.js 镜像均下载失败' }
}


async function installNodeJS(envCheck: EnvCheckResult): Promise<{ success: boolean; error?: string }> {
  const isMac = platform() === 'darwin'

  if (isMac) {
    // Download pkg directly
    sendLog('nodejs', '通过 Node.js 镜像下载安装包...')
    let result = await downloadNodeFile(`node-${NODE_LTS_VERSION}.pkg`, '/tmp/nodejs-install.pkg', 'nodejs')
    if (!result.success) return result

    sendLog('nodejs', '正在安装 Node.js (需要管理员权限，请在系统弹窗中确认并输入密码)...')
    result = await runCommand(
      'osascript',
      ['-e', 'do shell script "installer -pkg /tmp/nodejs-install.pkg -target /" with administrator privileges'],
      'nodejs'
    )
    return result
  }

  if (platform() !== 'win32') {
    return { success: false, error: '可视化安装器目前仅支持 macOS 和 Windows 自动安装 Node.js' }
  }

  // Windows: prefer direct mirror download, keep WinGet as fallback.
  sendLog('nodejs', '通过 Node.js 镜像下载安装包...')
  const msiPath = `${process.env.TEMP}\\nodejs-install.msi`
  let result = await downloadNodeFile(`node-${NODE_LTS_VERSION}-x64.msi`, msiPath, 'nodejs')
  if (!result.success && envCheck.winget.installed) {
    sendLog('nodejs', '镜像下载失败，尝试通过 WinGet 兜底安装 Node.js...')
    return runCommand(
      'winget',
      ['install', 'OpenJS.NodeJS.LTS', '--accept-source-agreements', '--accept-package-agreements', '--silent'],
      'nodejs'
    )
  }
  if (!result.success) return result

  return runCommand(
    'msiexec',
    ['/i', `"${msiPath}"`, '/qn', '/norestart'],
    'nodejs'
  )
}

async function installGit(): Promise<{ success: boolean; error?: string }> {
  sendLog('git', '正在安装 Git for Windows...')

  sendLog('git', '通过淘宝镜像下载 Git 安装包...')
  const gitUrl = `${GIT_MIRROR}/v2.47.1.windows.1/Git-2.47.1-64-bit.exe`
  const gitPath = `${process.env.TEMP}\\git-installer.exe`
  let result = await runCommand(
    'powershell',
    ['-Command', `Invoke-WebRequest -Uri '${gitUrl}' -OutFile '${gitPath}' -UseBasicParsing`],
    'git'
  )
  if (!result.success) {
    sendLog('git', '镜像下载失败，尝试通过 WinGet 兜底安装 Git...')
    return runCommand(
      'winget',
      ['install', 'Git.Git', '--accept-source-agreements', '--accept-package-agreements', '--silent'],
      'git'
    )
  }

  return runCommand(
    gitPath,
    ['/VERYSILENT', '/NORESTART', '/NOCANCEL', '/SP-'],
    'git'
  )
}

function cleanConflictDirs(npmPrefix: string) {
  try {
    if (!npmPrefix) return
    const isMac = platform() === 'darwin'
    const targetDir = isMac
      ? join(npmPrefix, 'lib', 'node_modules', '@anthropic-ai')
      : join(npmPrefix, 'node_modules', '@anthropic-ai')
    if (existsSync(targetDir)) {
      const files = readdirSync(targetDir)
      for (const file of files) {
        if (file.startsWith('.claude-code-') || file === 'claude-code') {
          const pathToRemove = join(targetDir, file)
          rmSync(pathToRemove, { recursive: true, force: true })
        }
      }
    }
  } catch (err: any) {
    // Silent fail if no permission to write to root-owned dir
  }
}

async function installClaudeCode(): Promise<{ success: boolean; error?: string }> {
  const isMac = platform() === 'darwin'

  // 清理可能存在的主路径残留冲突目录
  try {
    const npmPrefix = execSync('npm config get prefix', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    cleanConflictDirs(npmPrefix)
  } catch {}

  const installArgs = (mirror: string) => [
    'install',
    '-g',
    '@anthropic-ai/claude-code@latest',
    '--include=optional',
    `--registry=${mirror}`
  ]

  const ensureUserNpmPrefix = async (): Promise<SpawnOptionsWithoutStdio | undefined> => {
    if (!isMac) return undefined

    const userPrefix = join(homedir(), '.npm-global')
    // 同时也清理用户目录下的残留冲突文件夹
    cleanConflictDirs(userPrefix)
    sendLog('claude', `切换到用户级 npm 目录: ${userPrefix}`)
    await runCommand('/bin/zsh', ['-lc', `mkdir -p "${userPrefix}/bin" && npm config set prefix "${userPrefix}"`], 'claude')
    await runCommand('/bin/zsh', ['-lc', `touch "$HOME/.zshrc" && grep -F "${userPrefix}/bin" "$HOME/.zshrc" >/dev/null || printf '\\n# Claude Code installer: user-level npm bin\\nexport PATH="${userPrefix}/bin:$PATH"\\n' >> "$HOME/.zshrc"`], 'claude')

    const pathKey = 'PATH'
    return {
      env: {
        [pathKey]: `${join(userPrefix, 'bin')}:${process.env[pathKey] || ''}`
      }
    }
  }

  const verifyClaudeCode = async (): Promise<{ success: boolean; error?: string }> => {
    const shellCommand = platform() === 'win32'
      ? 'claude --version'
      : 'export PATH="$(npm config get prefix)/bin:$PATH"; claude --version'
    return runCommand(platform() === 'win32' ? 'cmd' : '/bin/zsh', platform() === 'win32' ? ['/c', shellCommand] : ['-lc', shellCommand], 'claude')
  }

  for (const mirror of NPM_MIRRORS) {
    if (mirror === 'https://registry.npmjs.org') {
      sendLog('claude', `使用官方源作为最终兜底: ${mirror}`)
    } else {
      sendLog('claude', `使用镜像: ${mirror}`)
    }
    
    // First, try running normally
    let result = await runCommand(
      'npm',
      installArgs(mirror),
      'claude'
    )

    // If it fails with permission error on Mac, retry with a user-level npm prefix.
    if (
      !result.success &&
      isMac &&
      result.error &&
      (result.error.includes('EACCES') ||
        result.error.includes('permission') ||
        result.error.includes('checkPermissions'))
    ) {
      const userPrefixOpts = await ensureUserNpmPrefix()
      result = await runCommand('npm', installArgs(mirror), 'claude', userPrefixOpts)
    }

    if (result.success) return verifyClaudeCode()
    sendLog('claude', '此镜像失败，尝试下一个...')
  }
  return { success: false, error: '所有 NPM 镜像均安装失败' }
}

async function installCCSwitchMac(): Promise<{ success: boolean; error?: string }> {
  // 直接下载 dmg，避免 brew cask 导致的速度瓶颈
  return downloadCCSwitchDirect('dmg')
}

async function getLatestCCSwitchVersion(): Promise<string> {
  const defaultVersion = 'v3.16.1'
  const apiUrls = [
    'https://api.github.com/repos/farion1231/cc-switch/releases/latest',
    ...GHPROXY_MIRRORS.map((proxy) => `${proxy}/https://api.github.com/repos/farion1231/cc-switch/releases/latest`)
  ]

  for (const url of apiUrls) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (response.ok) {
        const data = await response.json() as { tag_name: string }
        if (data && data.tag_name) {
          return data.tag_name
        }
      }
    } catch {
      // Try next mirror
    }
  }
  return defaultVersion
}

async function downloadCCSwitchDirect(ext: string): Promise<{ success: boolean; error?: string }> {
  const version = await getLatestCCSwitchVersion()
  
  for (const proxy of GHPROXY_MIRRORS) {
    sendLog('ccswitch', `尝试镜像: ${proxy}`)
    
    let filename = ''
    if (ext === 'dmg') {
      filename = `CC-Switch-${version}-macOS.dmg`
    } else {
      filename = `CC-Switch-${version}-Windows.msi`
    }

    const url = `${proxy}/https://github.com/farion1231/cc-switch/releases/download/${version}/${filename}`

    if (ext === 'dmg') {
      const tmpPath = '/tmp/cc-switch.dmg'
      let result = await runCommand('curl', ['-fSL', '--connect-timeout', '15', url, '-o', tmpPath], 'ccswitch')
      if (!result.success) continue

      sendLog('ccswitch', '正在安装 cc-switch...')
      result = await runCommand('/bin/zsh', ['-c', `
        mount_point=$(hdiutil attach "${tmpPath}" -nobrowse 2>/dev/null | grep "/Volumes" | awk '{print $NF}')
        if [ -n "$mount_point" ]; then
          cp -R "$mount_point"/*.app /Applications/ 2>/dev/null || cp -R "$mount_point"/*.app ~/Applications/ 2>/dev/null
          hdiutil detach "$mount_point" -quiet 2>/dev/null
        fi
        rm -f "${tmpPath}"
      `], 'ccswitch')
      if (result.success) return result
    } else {
      // Windows MSI
      const msiPath = `${process.env.TEMP}\\cc-switch.msi`
      let result = await runCommand(
        'powershell',
        ['-Command', `Invoke-WebRequest -Uri '${url}' -OutFile '${msiPath}' -UseBasicParsing -TimeoutSec 60`],
        'ccswitch'
      )
      if (!result.success) continue

      result = await runCommand('msiexec', ['/i', `"${msiPath}"`, '/qn', '/norestart'], 'ccswitch')
      if (result.success) return result
    }
  }
  return { success: false, error: 'cc-switch 下载失败，请手动安装' }
}

export async function runInstall(envCheck: EnvCheckResult): Promise<void> {
  const isMac = platform() === 'darwin'
  const isWin = platform() === 'win32'

  // Step 1: Node.js (if needed)
  if (!envCheck.nodejs.installed || envCheck.nodejs.needsUpgrade) {
    const result = await installNodeJS(envCheck)
    sendStepComplete('nodejs', result.success, result.error)
    if (!result.success) return
  } else {
    sendStepComplete('nodejs', true)
  }

  // Step 3: Git (Windows, if needed)
  if (isWin && !envCheck.git.installed) {
    const result = await installGit()
    sendStepComplete('git', result.success, result.error)
  } else {
    sendStepComplete('git', true)
  }

  // Step 4: Claude Code
  if (!envCheck.claudeCode.installed) {
    const result = await installClaudeCode()
    sendStepComplete('claude', result.success, result.error)
    if (!result.success) return
  } else {
    sendStepComplete('claude', true)
  }

  // Step 5: cc-switch
  if (!envCheck.ccSwitch.installed) {
    if (!isMac && !isWin) {
      sendStepComplete('ccswitch', false, '可视化安装器目前仅支持 macOS 和 Windows 自动安装 cc-switch，请在 Linux 上使用 scripts/install.sh')
      return
    }
    const result = isMac
      ? await installCCSwitchMac()
      : await downloadCCSwitchDirect('msi')
    sendStepComplete('ccswitch', result.success, result.error)
  } else {
    sendStepComplete('ccswitch', true)
  }
}
