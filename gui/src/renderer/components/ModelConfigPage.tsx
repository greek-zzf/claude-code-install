import { useState } from 'react'

interface Model {
  id: string
  name: string
  description: string
  recommended?: boolean
  apiKeyUrl: string
  baseUrl: string
  pricing?: string
}

const MODELS: Model[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: '国产顶级编程模型，性价比极高',
    recommended: true,
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
    baseUrl: 'https://api.deepseek.com',
    pricing: '约 ¥0.001/千token'
  },
  {
    id: 'glm',
    name: '智谱 GLM-4',
    description: '清华系大模型，中文理解能力强',
    apiKeyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    pricing: '约 ¥0.05/千token'
  },
  {
    id: 'qwen',
    name: '通义千问',
    description: '阿里云大模型，生态完善',
    apiKeyUrl: 'https://dashscope.console.aliyun.com/apiKey',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    pricing: '约 ¥0.02/千token'
  }
]

interface Props {
  onNext: () => void
}

export default function ModelConfigPage({ onNext }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const selectedModel = MODELS.find((m) => m.id === selected)

  const handleSave = async () => {
    if (!selectedModel || !apiKey.trim()) return
    setSaving(true)
    try {
      await window.electronAPI.saveConfig({
        baseUrl: selectedModel.baseUrl,
        authToken: apiKey.trim()
      })
      setSaved(true)
      setTimeout(() => onNext(), 800)
    } catch {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="page-title">选择 AI 模型</div>
      <div className="model-grid">
        {MODELS.map((model) => (
          <div
            key={model.id}
            className={`model-card ${selected === model.id ? 'selected' : ''}`}
            onClick={() => {
              setSelected(model.id)
              setApiKey('')
              setSaved(false)
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
          <label>输入 {selectedModel.name} API Key</label>
          <input
            type="password"
            placeholder="sk-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
          />
        </div>
      )}

      <div className="btn-group">
        <button className="btn-secondary" onClick={onNext}>
          跳过，稍后配置
        </button>
        {selectedModel && (
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={!apiKey.trim() || saving}
          >
            {saved ? '✅ 已保存' : saving ? '保存中...' : '完成配置'}
          </button>
        )}
      </div>
    </>
  )
}
