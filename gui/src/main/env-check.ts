import { execSync } from 'child_process'
import { existsSync, statfsSync, readdirSync } from 'fs'
import { homedir, platform, arch, release } from 'os'
import { join } from 'path'

export interface EnvCheckResult {
  os: { type: 'mac' | 'win' | 'linux'; version: string; arch: string }
  homebrew: { installed: boolean; version?: string }
  winget: { installed: boolean }
  nodejs: { installed: boolean; version?: string; needsUpgrade: boolean }
  git: { installed: boolean; version?: string }
  claudeCode: { installed: boolean; version?: string }
  ccSwitch: { installed: boolean }
  diskSpace: { freeGB: number; sufficient: boolean }
}

function getExecutablePath(name: string): string {
  if (platform() !== 'darwin') return name
  const searchDirs = [
    '/opt/homebrew/bin',
    '/usr/local/bin'
  ]
  for (const dir of searchDirs) {
    const fullPath = join(dir, name)
    if (existsSync(fullPath)) return fullPath
  }

  // 特殊处理 NVM 安装的 node / npm
  if (name === 'node' || name === 'npm') {
    const nvmDir = join(homedir(), '.nvm/versions/node')
    if (existsSync(nvmDir)) {
      try {
        const versions = readdirSync(nvmDir)
        if (versions.length > 0) {
          versions.sort()
          const latest = versions[versions.length - 1]
          const fullPath = join(nvmDir, latest, 'bin', name)
          if (existsSync(fullPath)) return fullPath
        }
      } catch {}
    }
  }

  return name
}

function tryExec(cmd: string): string | null {
  try {
    // 自动提取命令名并尝试用绝对路径替换，例如 "brew --version" 变为 "/opt/homebrew/bin/brew --version"
    const parts = cmd.split(' ')
    const exe = parts[0]
    const resolvedExe = getExecutablePath(exe)
    parts[0] = resolvedExe
    const resolvedCmd = parts.join(' ')
    
    return execSync(resolvedCmd, { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch {
    return null
  }
}

function checkOS(): EnvCheckResult['os'] {
  const p = platform()
  const type = p === 'darwin' ? 'mac' : p === 'win32' ? 'win' : 'linux'
  let version = release()

  if (type === 'mac') {
    version = tryExec('sw_vers -productVersion') || version
  } else if (type === 'win') {
    const ver = tryExec('ver')
    if (ver) version = ver
  }

  return { type, version, arch: arch() }
}

function checkHomebrew(): EnvCheckResult['homebrew'] {
  if (platform() !== 'darwin') return { installed: false }
  const ver = tryExec('brew --version')
  if (ver) {
    const match = ver.match(/Homebrew\s+([\d.]+)/)
    return { installed: true, version: match?.[1] || ver.split('\n')[0] }
  }
  return { installed: false }
}

function checkWinGet(): EnvCheckResult['winget'] {
  if (platform() !== 'win32') return { installed: false }
  const result = tryExec('winget --version')
  return { installed: !!result }
}

function checkNodeJS(): EnvCheckResult['nodejs'] {
  const ver = tryExec('node --version')
  if (ver) {
    const version = ver.replace('v', '')
    const major = parseInt(version.split('.')[0], 10)
    return { installed: true, version, needsUpgrade: major < 18 }
  }
  return { installed: false, needsUpgrade: false }
}

function checkGit(): EnvCheckResult['git'] {
  const ver = tryExec('git --version')
  if (ver) {
    const match = ver.match(/([\d.]+)/)
    return { installed: true, version: match?.[1] }
  }
  return { installed: false }
}

function checkClaudeCode(): EnvCheckResult['claudeCode'] {
  const ver = tryExec('claude --version')
  if (ver) return { installed: true, version: ver.trim() }

  // Check common install paths
  const npmGlobalBin = tryExec('npm config get prefix')
  if (npmGlobalBin) {
    const claudePath = platform() === 'win32'
      ? join(npmGlobalBin, 'claude.cmd')
      : join(npmGlobalBin, 'bin', 'claude')
    if (existsSync(claudePath)) return { installed: true }
  }
  return { installed: false }
}

function checkCCSwitch(): EnvCheckResult['ccSwitch'] {
  if (platform() === 'darwin') {
    if (
      existsSync('/Applications/CC-Switch.app') ||
      existsSync('/Applications/CC Switch.app') ||
      existsSync(join(homedir(), 'Applications/CC-Switch.app')) ||
      existsSync(join(homedir(), 'Applications/CC Switch.app'))
    ) {
      return { installed: true }
    }
  }

  if (platform() === 'win32') {
    const paths = [
      join(process.env.LOCALAPPDATA || '', 'CC-Switch', 'CC-Switch.exe'),
      join(process.env.ProgramFiles || '', 'CC-Switch', 'CC-Switch.exe'),
      join(process.env['ProgramFiles(x86)'] || '', 'CC-Switch', 'CC-Switch.exe')
    ]
    for (const p of paths) {
      if (p && existsSync(p)) return { installed: true }
    }
  }

  const result = tryExec('which cc-switch') || tryExec('where cc-switch')
  return { installed: !!result }
}

function checkDiskSpace(): EnvCheckResult['diskSpace'] {
  try {
    const stats = statfsSync(homedir())
    const freeGB = Math.round((stats.bfree * stats.bsize) / (1024 ** 3) * 10) / 10
    return { freeGB, sufficient: freeGB >= 1 }
  } catch {
    return { freeGB: -1, sufficient: true } // Assume sufficient if can't check
  }
}

export function checkAll(): EnvCheckResult {
  return {
    os: checkOS(),
    homebrew: checkHomebrew(),
    winget: checkWinGet(),
    nodejs: checkNodeJS(),
    git: checkGit(),
    claudeCode: checkClaudeCode(),
    ccSwitch: checkCCSwitch(),
    diskSpace: checkDiskSpace()
  }
}
