import { useEffect, useRef, useState } from 'react'
import type { EnvCheckResult } from '../../main/env-check'

interface Props {
  onNext: () => void
  envCheck: EnvCheckResult | null
}

interface StepState {
  id: string
  name: string
  status: 'pending' | 'running' | 'success' | 'error'
  logs: string[]
  error?: string
}

const STEP_DEFS = [
  { id: 'nodejs', name: '安装 Node.js' },
  { id: 'git', name: '安装 Git' },
  { id: 'claude', name: '安装 Claude Code' },
  { id: 'ccswitch', name: '安装 cc-switch' }
]

export default function InstallingPage({ onNext, envCheck }: Props) {
  const [steps, setSteps] = useState<StepState[]>(
    STEP_DEFS.map((d) => ({ ...d, status: 'pending', logs: [] }))
  )
  const [done, setDone] = useState(false)
  const [hasError, setHasError] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)
  const completedCount = useRef(0)

  useEffect(() => {
    // Listen for log events
    window.electronAPI.onInstallLog(({ step, line }) => {
      setSteps((prev) =>
        prev.map((s) =>
          s.id === step
            ? { ...s, status: 'running', logs: [...s.logs, line] }
            : s
        )
      )
    })

    // Listen for step completion
    window.electronAPI.onStepComplete(({ step, success, error }) => {
      setSteps((prev) =>
        prev.map((s) =>
          s.id === step
            ? { ...s, status: success ? 'success' : 'error', error }
            : s
        )
      )
      completedCount.current++
      if (!success) setHasError(true)

      // All steps done?
      if (completedCount.current >= STEP_DEFS.length) {
        setDone(true)
      }
    })

    // Start installation
    window.electronAPI.startInstall()
  }, [])

  // Auto-scroll active log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [steps])

  const completedSteps = steps.filter((s) => s.status === 'success' || s.status === 'error').length
  const progress = Math.round((completedSteps / steps.length) * 100)

  const statusIcon = (s: StepState['status']) => {
    switch (s) {
      case 'pending': return '○'
      case 'running': return '⏳'
      case 'success': return '✅'
      case 'error': return '❌'
    }
  }

  return (
    <>
      <div className="page-title">正在安装</div>
      <div className="install-progress">
        <div className="install-progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <div className="install-steps">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`install-step ${step.status === 'running' ? 'active' : ''}`}
          >
            <span className="check-icon">
              {step.status === 'running' ? <span className="spinner" /> : statusIcon(step.status)}
            </span>
            <div style={{ flex: 1 }}>
              <div className="install-step-name">{step.name}</div>
              {step.error && (
                <div style={{ fontSize: 12, color: 'var(--error)', marginTop: 4 }}>
                  {step.error}
                </div>
              )}
              <div className="install-log">
                <div className="install-log-content">
                  {step.logs.slice(-20).join('\n')}
                  <div ref={step.status === 'running' ? logEndRef : undefined} />
                </div>
              </div>
              {step.id === 'claude' && step.status === 'error' && (
                <div className="npm-error-guide" style={{
                  marginTop: 10,
                  padding: '12px 16px',
                  background: 'rgba(248, 113, 113, 0.08)',
                  border: '1px solid rgba(248, 113, 113, 0.2)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  lineHeight: '1.6',
                  color: 'var(--text-primary)'
                }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--error)', marginBottom: 6 }}>
                    ⚠️ 自动安装失败？这通常是由于本地存在残留文件或网络代理失效导致的。
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
                    你可以打开终端（Terminal / PowerShell）手动执行以下命令进行清理并安装：
                  </div>
                  <pre style={{
                    background: 'rgba(0, 0, 0, 0.5)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    color: '#38bdf8',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all'
                  }}>
                    {window.navigator.platform.toUpperCase().indexOf('WIN') > -1 
                      ? `# 清除失效代理（若有）并手动重装\nnpm config delete proxy\nnpm config delete https-proxy\nnpm install -g @anthropic-ai/claude-code@latest --include=optional --registry=https://registry.npmmirror.com`
                      : `# 1. 强制清理冲突的残留目录\nrm -rf $(npm config get prefix)/lib/node_modules/@anthropic-ai/claude-code 2>/dev/null\nrm -rf $(npm config get prefix)/lib/node_modules/@anthropic-ai/.claude-code-* 2>/dev/null\n\n# 2. 清除失效代理并手动重装\nnpm config delete proxy\nnpm config delete https-proxy\nnpm install -g @anthropic-ai/claude-code@latest --include=optional --registry=https://registry.npmmirror.com`
                    }
                  </pre>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {done && (
        <div className="btn-group">
          <button className="btn-primary" onClick={onNext}>
            {hasError ? '继续配置' : '下一步'}
          </button>
        </div>
      )}
    </>
  )
}
