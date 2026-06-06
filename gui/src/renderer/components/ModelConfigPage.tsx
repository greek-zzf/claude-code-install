import { useState } from 'react'

interface Model {
  id: string
  name: string
  description: string
  recommended?: boolean
  apiKeyUrl: string
  pricing?: string
}

const MODELS: Model[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: '国产顶级编程模型，性价比极高',
    recommended: true,
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
    pricing: '约 ¥0.001/千token'
  },
  {
    id: 'glm',
    name: '智谱 GLM-4',
    description: '清华系大模型，中文理解能力强',
    apiKeyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    pricing: '约 ¥0.05/千token'
  },
  {
    id: 'qwen',
    name: '通义千问',
    description: '阿里云大模型，生态完善',
    apiKeyUrl: 'https://dashscope.console.aliyun.com/apiKey',
    pricing: '约 ¥0.02/千token'
  }
]

interface Props {
  onNext: () => void
}

export default function ModelConfigPage({ onNext }: Props) {
  const [selected, setSelected] = useState<string | null>(null)

  const selectedModel = MODELS.find((m) => m.id === selected)

  return (
    <>
      <div className="page-title">通过 cc-switch 配置模型</div>
      <div className="model-grid">
        {MODELS.map((model) => (
          <div
            key={model.id}
            className={`model-card ${selected === model.id ? 'selected' : ''}`}
            onClick={() => {
              setSelected(model.id)
            }}
          >
            {model.recommended && <div className="model-badge">推荐</div>}
            <div className="model-name">{model.name}</div>
            <div className="model-desc">{model.description}</div>
            <div className="model-price">{model.pricing}</div>
            <span
              className="model-link"
              onClick={(e) => {
                e.stopPropagation()
                window.electronAPI.openUrl(model.apiKeyUrl)
              }}
            >
              获取 API Key →
            </span>
          </div>
        ))}
      </div>

      {selectedModel && (
        <div className="api-key-input">
          <label>{selectedModel.name} 配置方式</label>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
            先打开上方 API Key 地址复制密钥，再到 cc-switch 的 Claude Code 配置中选择该模型、粘贴 API Key 并启用。
          </div>
        </div>
      )}

      <div className="btn-group">
        <button className="btn-secondary" onClick={onNext}>
          已启用，下一步
        </button>
        <button className="btn-primary" onClick={() => window.electronAPI.openCCSwitch()}>
          打开 cc-switch
        </button>
      </div>
    </>
  )
}
