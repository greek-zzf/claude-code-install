import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  checkEnv: () => Promise<import('../main/env-check').EnvCheckResult>
  startInstall: () => Promise<void>
  saveConfig: (config: { baseUrl: string; authToken: string }) => Promise<{ success: boolean; path: string }>
  openTerminal: () => Promise<void>
  openCCSwitch: () => Promise<void>
  openUrl: (url: string) => Promise<void>
  onInstallLog: (callback: (data: { step: string; line: string }) => void) => void
  onStepComplete: (callback: (data: { step: string; success: boolean; error?: string }) => void) => void
}

const api: ElectronAPI = {
  checkEnv: () => ipcRenderer.invoke('env:check'),
  startInstall: () => ipcRenderer.invoke('install:start'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  openTerminal: () => ipcRenderer.invoke('app:open-terminal'),
  openCCSwitch: () => ipcRenderer.invoke('app:open-ccswitch'),
  openUrl: (url) => ipcRenderer.invoke('app:open-url', url),
  onInstallLog: (callback) => {
    ipcRenderer.on('install:log', (_event, data) => callback(data))
  },
  onStepComplete: (callback) => {
    ipcRenderer.on('install:step-complete', (_event, data) => callback(data))
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
