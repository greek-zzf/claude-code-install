import { spawn, SpawnOptionsWithoutStdio } from 'child_process'
import { platform } from 'os'
import { BrowserWindow } from 'electron'
import { EnvCheckResult } from './env-check'

const NPM_MIRRORS = [
  'https://registry.npmmirror.com',
  'https://mirrors.cloud.tencent.com/npm/',
  'https://mirrors.huaweicloud.com/repository/npm/'
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
    const env = {
      ...process.env,
      HOMEBREW_API_DOMAIN: HOMEBREW_API_MIRROR,
      HOMEBREW_BOTTLE_DOMAIN: HOMEBREW_BOTTLE_MIRROR,
      ...opts?.env
    }

    const child = spawn(cmd, args, {
      shell: true,
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

async function installHomebrew(): Promise<{ success: boolean; error?: string }> {
  sendLog('homebrew', '正在通过 Gitee 镜像安装 Homebrew...')
  const result = await runCommand(
    '/bin/zsh',
    ['-c', `curl -fsSL ${HOMEBREW_GITEE} | /bin/zsh`],
    'homebrew'
  )
  return result
}

async function installNodeJS(envCheck: EnvCheckResult): Promise<{ success: boolean; error?: string }> {
  const isMac = platform() === 'darwin'

  if (isMac && envCheck.homebrew.installed) {
    sendLog('nodejs', '通过 Homebrew 安装 Node.js 20 (清华镜像)...')
    let result = await runCommand('brew', ['install', 'node@20'], 'nodejs')
    if (result.success) {
      await runCommand('brew', ['link', '--overwrite', 'node@20'], 'nodejs')
    }
    return result
  }

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

    sendLog('nodejs', '正在安装 Node.js...')
    result = await runCommand(
      'sudo',
      ['installer', '-pkg', '/tmp/nodejs-install.pkg', '-target', '/'],
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
  for (const mirror of NPM_MIRRORS) {
    sendLog('claude', `使用镜像: ${mirror}`)
    const result = await runCommand(
      'npm',
      ['install', '-g', '@anthropic-ai/claude-code', `--registry=${mirror}`],
      'claude'
    )
    if (result.success) return result
    sendLog('claude', '此镜像失败，尝试下一个...')
  }
  return { success: false, error: '所有 NPM 镜像均安装失败' }
}

async function installCCSwitchMac(): Promise<{ success: boolean; error?: string }> {
  sendLog('ccswitch', '通过 Homebrew 安装 cc-switch...')
  let result = await runCommand('brew', ['tap', 'farion1231/ccswitch'], 'ccswitch')
  if (result.success) {
    result = await runCommand('brew', ['install', '--cask', 'cc-switch'], 'ccswitch')
    if (result.success) return result
  }

  // Fallback: ghproxy
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

  // Step 1: Homebrew (macOS, if needed)
  if (isMac && !envCheck.homebrew.installed) {
    const result = await installHomebrew()
    sendStepComplete('homebrew', result.success, result.error)
    if (!result.success) {
      sendLog('homebrew', '⚠️ Homebrew 安装失败，将使用备用方案安装 Node.js')
    }
  } else {
    sendStepComplete('homebrew', true)
  }

  // Step 2: Node.js (if needed)
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
