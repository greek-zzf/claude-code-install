interface Props {
  steps: string[]
  currentStep: number
}

export default function StepWizard({ steps, currentStep }: Props) {
  return (
    <div className="step-indicator">
      {steps.map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            className={`step-dot ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'completed' : ''}`}
          />
          {i < steps.length - 1 && (
            <div className={`step-line ${i < currentStep ? 'completed' : ''}`} />
          )}
        </div>
      ))}
    </div>
  )
}
