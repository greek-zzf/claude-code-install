import { useEffect, useState } from 'react'
import type { EnvCheckResult } from '../../main/env-check'

interface Props {
  onNext: () => void
  onEnvChecked: (result: EnvCheckResult) => void
}

interface CheckItem {
  key: string
  name: string
  icon: string
  status: string
  action?: string
}

export default function EnvCheckPage({ onNext, onEnvChecked }: Props) {
  const [checking, setChecking] = useState(true)
  const [items, setItems] = useState<CheckItem[]>([])
  const [needCount, setNeedCount] = useState(0)

  useEffect(() => {
    // Show loading state
    setItems([
      { key: 'os', name: '操作系统', icon: '⏳', status: '检测中...' },
      { key: 'disk', name: '磁盘空间', icon: '⏳', status: '检测中...' },
      { key: 'nodejs', name: 'Node.js', icon: '⏳', status: '检测中...' },
      { key: 'git', name: 'Git', icon: '⏳', status: '检测中...' },
      { key: 'claude', name: 'Claude Code', icon: '⏳', status: '检测中...' },
      { key: 'ccswitch', name: 'cc-switch', icon: '⏳', status: '检测中...' }
    ])

    window.electronAPI.checkEnv().then((env) => {
      onEnvChecked(env)
      const isMac = env.os.type === 'mac'
      const isWin = env.os.type === 'win'
      let needs = 0

      const result: CheckItem[] = []

      // OS
      const osLabel = { mac: 'macOS', win: 'Windows', linux: 'Linux' }[env.os.type] || env.os.type
      result.push({
        key: 'os',
        name: '操作系统',
        icon: '✅',
        status: `${osLabel} ${env.os.version} (${env.os.arch})`
      })

      // Disk
      result.push({
        key: 'disk',
        name: '磁盘空间',
        icon: env.diskSpace.sufficient ? '✅' : '❌',
        status: env.diskSpace.freeGB > 0 ? `${env.diskSpace.freeGB}GB 可用` : '无法检测',
        action: env.diskSpace.sufficient ? undefined : '空间不足'
      })


      // Node.js
      if (env.nodejs.installed && !env.nodejs.needsUpgrade) {
        result.push({ key: 'nodejs', name: 'Node.js', icon: '✅', status: `v${env.nodejs.version}` })
      } else if (env.nodejs.installed && env.nodejs.needsUpgrade) {
        result.push({ key: 'nodejs', name: 'Node.js', icon: '⬆️', status: `v${env.nodejs.version} (需要 ≥18)`, action: '将自动升级' })
        needs++
      } else {
        result.push({ key: 'nodejs', name: 'Node.js', icon: '📦', status: '未安装', action: '将自动安装' })
        needs++
      }

      // Git
      if (env.git.installed) {
        result.push({ key: 'git', name: 'Git', icon: '✅', status: env.git.version || '已安装' })
      } else if (isWin) {
        result.push({ key: 'git', name: 'Git', icon: '📦', status: '未安装', action: '将自动安装' })
        needs++
      } else {
        result.push({ key: 'git', name: 'Git', icon: '⚠️', status: '未安装', action: '建议安装' })
      }

      // Claude Code
      if (env.claudeCode.installed) {
        result.push({ key: 'claude', name: 'Claude Code', icon: '✅', status: env.claudeCode.version || '已安装' })
      } else {
        result.push({ key: 'claude', name: 'Claude Code', icon: '📦', status: '未安装', action: '将安装' })
        needs++
      }

      // cc-switch
      if (env.ccSwitch.installed) {
        result.push({ key: 'ccswitch', name: 'cc-switch', icon: '✅', status: '已安装' })
      } else {
        result.push({ key: 'ccswitch', name: 'cc-switch', icon: '📦', status: '未安装', action: '将安装' })
        needs++
      }

      setItems(result)
      setNeedCount(needs)
      setChecking(false)
    })
  }, [])

  return (
    <>
      <div className="page-title">环境检测</div>
      <div className="check-list">
        {items.map((item) => (
          <div className="check-item" key={item.key}>
            <span className="check-icon">
              {item.icon === '⏳' ? <span className="spinner" /> : item.icon}
            </span>
            <span className="check-name">{item.name}</span>
            <span className="check-status">{item.status}</span>
            {item.action && <span className="check-action">{item.action}</span>}
          </div>
        ))}
      </div>
      <div className="check-summary">
        {checking
          ? '正在检测环境...'
          : needCount > 0
            ? `需要安装 ${needCount} 个组件`
            : '✅ 所有组件已就绪'}
      </div>
      <div className="btn-group">
        <button className="btn-primary" onClick={onNext} disabled={checking}>
          {needCount > 0 ? '开始安装' : '下一步'}
        </button>
      </div>
    </>
  )
}
