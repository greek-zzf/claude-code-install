import { useEffect, useState } from 'react'

interface Props {
  onNext: () => void
}

export default function WelcomePage({ onNext }: Props) {
  const [osInfo, setOsInfo] = useState('')

  useEffect(() => {
    window.electronAPI.checkEnv().then((env) => {
      const typeLabel = { mac: 'macOS', win: 'Windows', linux: 'Linux' }[env.os.type] || env.os.type
      setOsInfo(`${typeLabel} ${env.os.version} (${env.os.arch})`)
    })
  }, [])

  return (
    <div className="welcome">
      <div className="welcome-logo">🤖</div>
      <h1>Claude Code 安装助手</h1>
      <p>
        一键安装 Claude Code + CC-Switch
        <br />
        全程国内镜像，无需翻墙
      </p>
      {osInfo && <div className="system-info">💻 {osInfo}</div>}
      <button className="btn-primary" onClick={onNext}>
        开始安装
      </button>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>v1.0.0</div>
    </div>
  )
}
