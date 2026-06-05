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
