import { spawn, SpawnOptionsWithoutStdio } from 'child_process'
import { platform, homedir } from 'os'
import { BrowserWindow } from 'electron'
import { EnvCheckResult } from './env-check'
import { join } from 'path'
import { existsSync, readdirSync } from 'fs'

const NPM_MIRRORS = [
  'https://registry.npmmirror.com',
  'https://mirrors.cloud.tencent.com/npm/',
  'https://mirrors.huaweicloud.com/repository/npm/',
  'https://registry.npmjs.org'
]
const HOMEBREW_GITEE = 'https://gitee.com/cunkai/HomebrewCN/raw/master/Homebrew.sh'
const HOMEBREW_API_MIRROR = 'https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/api'
const HOMEBREW_BOTTLE_MIRROR = 'https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles'
const NODE_MIRROR = 'https://mirrors.tuna.tsinghua.edu.cn/nodejs-release'
const GIT_MIRROR = 'https://registry.npmmirror.com/-/binary/git-for-windows'
const GHPROXY_MIRRORS = [
  'https://mirror.ghproxy.com',
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


async function installNodeJS(envCheck: EnvCheckResult): Promise<{ success: boolean; error?: string }> {
  const isMac = platform() === 'darwin'

  if (isMac) {
    // Download pkg directly
    sendLog('nodejs', '通过清华镜像下载 Node.js 安装包...')
    const url = `${NODE_MIRROR}/v20.18.1/node-v20.18.1.pkg`
    let result = await runCommand(
      'curl',
      ['-fSL', '--progress-bar', url, '-o', '/tmp/nodejs-install.pkg'],
      'nodejs'
    )
    if (!result.success) return result

    sendLog('nodejs', '正在安装 Node.js (需要管理员权限，请在系统弹窗中确认并输入密码)...')
    result = await runCommand(
      'osascript',
      ['-e', 'do shell script "installer -pkg /tmp/nodejs-install.pkg -target /" with administrator privileges'],
      'nodejs'
    )
    return result
  }

  // Windows
  if (envCheck.winget.installed) {
    sendLog('nodejs', '通过 WinGet 安装 Node.js...')
    return runCommand(
      'winget',
      ['install', 'OpenJS.NodeJS.LTS', '--accept-source-agreements', '--accept-package-agreements', '--silent'],
      'nodejs'
    )
  }

  // Direct download MSI
  sendLog('nodejs', '通过清华镜像下载 Node.js 安装包...')
  const msiUrl = `${NODE_MIRROR}/v20.18.1/node-v20.18.1-x64.msi`
  const msiPath = `${process.env.TEMP}\\nodejs-install.msi`
  let result = await runCommand(
    'powershell',
    ['-Command', `Invoke-WebRequest -Uri '${msiUrl}' -OutFile '${msiPath}' -UseBasicParsing`],
    'nodejs'
  )
  if (!result.success) return result

  return runCommand(
    'msiexec',
    ['/i', `"${msiPath}"`, '/qn', '/norestart'],
    'nodejs'
  )
}

async function installGit(): Promise<{ success: boolean; error?: string }> {
  sendLog('git', '正在安装 Git for Windows...')

  // Try WinGet first
  let result = await runCommand(
    'winget',
    ['install', 'Git.Git', '--accept-source-agreements', '--accept-package-agreements', '--silent'],
    'git'
  )
  if (result.success) return result

  // Fallback: direct download
  sendLog('git', '通过淘宝镜像下载 Git 安装包...')
  const gitUrl = `${GIT_MIRROR}/v2.47.1.windows.1/Git-2.47.1-64-bit.exe`
  const gitPath = `${process.env.TEMP}\\git-installer.exe`
  result = await runCommand(
    'powershell',
    ['-Command', `Invoke-WebRequest -Uri '${gitUrl}' -OutFile '${gitPath}' -UseBasicParsing`],
    'git'
  )
  if (!result.success) return result

  return runCommand(
    gitPath,
    ['/VERYSILENT', '/NORESTART', '/NOCANCEL', '/SP-'],
    'git'
  )
}

async function installClaudeCode(): Promise<{ success: boolean; error?: string }> {
  const isMac = platform() === 'darwin'
  
  // Find absolute npm path for macOS do shell script
  let npmPath = 'npm'
  if (isMac) {
    if (existsSync('/usr/local/bin/npm')) {
      npmPath = '/usr/local/bin/npm'
    } else if (existsSync('/opt/homebrew/bin/npm')) {
      npmPath = '/opt/homebrew/bin/npm'
    }
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
      ['install', '-g', '@anthropic-ai/claude-code', `--registry=${mirror}`],
      'claude'
    )

    // If it fails with permission error on Mac, try using osascript with administrator privileges
    if (
      !result.success &&
      isMac &&
      result.error &&
      (result.error.includes('EACCES') ||
        result.error.includes('permission') ||
        result.error.includes('checkPermissions'))
    ) {
      sendLog('claude', '检测到全局安装权限不足，正在请求管理员权限安装...')
      result = await runCommand(
        'osascript',
        ['-e', `do shell script "${npmPath} install -g @anthropic-ai/claude-code --registry=${mirror}" with administrator privileges`],
        'claude'
      )
    }

    if (result.success) return result
    sendLog('claude', '此镜像失败，尝试下一个...')
  }
  return { success: false, error: '所有 NPM 镜像均安装失败' }
}

async function installCCSwitchMac(): Promise<{ success: boolean; error?: string }> {
  // 直接下载 dmg，避免 brew cask 导致的速度瓶颈
  return downloadCCSwitchDirect('dmg')
}

async function downloadCCSwitchDirect(ext: string): Promise<{ success: boolean; error?: string }> {
  for (const proxy of GHPROXY_MIRRORS) {
    sendLog('ccswitch', `尝试镜像: ${proxy}`)
    const url = `${proxy}/https://github.com/farion1231/cc-switch/releases/latest/download/CC-Switch.${ext}`

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
      const msiUrl = `${proxy}/https://github.com/farion1231/cc-switch/releases/latest/download/CC-Switch-Windows-x64.msi`
      const msiPath = `${process.env.TEMP}\\cc-switch.msi`
      let result = await runCommand(
        'powershell',
        ['-Command', `Invoke-WebRequest -Uri '${msiUrl}' -OutFile '${msiPath}' -UseBasicParsing -TimeoutSec 60`],
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
    const result = isMac
      ? await installCCSwitchMac()
      : await downloadCCSwitchDirect('msi')
    sendStepComplete('ccswitch', result.success, result.error)
  } else {
    sendStepComplete('ccswitch', true)
  }
}
