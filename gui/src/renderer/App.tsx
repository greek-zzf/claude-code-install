import { useState } from 'react'
import type { EnvCheckResult } from '../main/env-check'
import StepWizard from './components/StepWizard'
import WelcomePage from './components/WelcomePage'
import EnvCheckPage from './components/EnvCheckPage'
import InstallingPage from './components/InstallingPage'
import ModelConfigPage from './components/ModelConfigPage'
import CompletePage from './components/CompletePage'

declare global {
  interface Window {
    electronAPI: import('../preload/index').ElectronAPI
  }
}

export default function App() {
  const [step, setStep] = useState(0)
  const [envCheck, setEnvCheck] = useState<EnvCheckResult | null>(null)

  const steps = ['欢迎', '环境检测', '安装', '模型配置', '完成']

  const renderStep = () => {
    switch (step) {
      case 0:
        return <WelcomePage onNext={() => setStep(1)} />
      case 1:
        return (
          <EnvCheckPage
            onNext={() => setStep(2)}
            onEnvChecked={setEnvCheck}
          />
        )
      case 2:
        return <InstallingPage onNext={() => setStep(3)} envCheck={envCheck} />
      case 3:
        return <ModelConfigPage onNext={() => setStep(4)} />
      case 4:
        return <CompletePage />
      default:
        return null
    }
  }

  return (
    <>
      <div className="titlebar" />
      <StepWizard steps={steps} currentStep={step} />
      <div className="page-container">{renderStep()}</div>
    </>
  )
}
