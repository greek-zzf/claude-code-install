import { ipcMain, shell } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { homedir, platform } from 'os'
import { execSync } from 'child_process'
import { checkAll, EnvCheckResult } from './env-check'
import { runInstall } from './installer'

let cachedEnvCheck: EnvCheckResult | null = null

export function registerIpcHandlers() {
  ipcMain.handle('env:check', async () => {
    cachedEnvCheck = checkAll()
    return cachedEnvCheck
  })

  ipcMain.handle('install:start', async () => {
    if (!cachedEnvCheck) {
      cachedEnvCheck = checkAll()
    }
    await runInstall(cachedEnvCheck)
  })

  ipcMain.handle('app:open-terminal', async () => {
    if (platform() === 'darwin') {
      execSync('open -a Terminal')
    } else if (platform() === 'win32') {
      const gitBashPaths = [
        join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'git-bash.exe'),
        join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Git', 'git-bash.exe'),
        join(homedir(), 'AppData', 'Local', 'Programs', 'Git', 'git-bash.exe')
      ]
      let launched = false
      for (const p of gitBashPaths) {
        if (existsSync(p)) {
          execSync(`start "" "${p}"`)
          launched = true
          break
        }
      }
      if (!launched) {
        try {
          execSync('start git-bash')
        } catch {
          execSync('start powershell')
        }
      }
    }
  })

  ipcMain.handle('app:open-ccswitch', async () => {
    if (platform() === 'darwin') {
      const paths = [
        '/Applications/CC-Switch.app',
        '/Applications/CC Switch.app',
        join(homedir(), 'Applications/CC-Switch.app'),
        join(homedir(), 'Applications/CC Switch.app')
      ]
      for (const p of paths) {
        if (existsSync(p)) {
          execSync(`open "${p}"`)
          return
        }
      }
    } else if (platform() === 'win32') {
      const paths = [
        join(process.env.LOCALAPPDATA || '', 'CC-Switch', 'CC-Switch.exe'),
        join(process.env.ProgramFiles || '', 'CC-Switch', 'CC-Switch.exe')
      ]
      for (const p of paths) {
        if (existsSync(p)) {
          execSync(`start "" "${p}"`)
          return
        }
      }
    }
  })

  ipcMain.handle('app:open-url', async (_event, url: string) => {
    shell.openExternal(url)
  })
}
