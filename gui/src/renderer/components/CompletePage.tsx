import { useState } from 'react'
import step1Image from '../assets/tutorial/step1.png'
import step2Image from '../assets/tutorial/step2.png'
import step3Image from '../assets/tutorial/step3.png'
import step4Image from '../assets/tutorial/step4.png'
import wechatQrImage from '../assets/wechat-qr.jpg'

export default function CompletePage() {
  const [activeTab, setActiveTab] = useState<'guide' | 'tutorial' | 'support'>('guide')
  const [currentTutorialStep, setCurrentTutorialStep] = useState(0)
  const [showLightbox, setShowLightbox] = useState(false)

  const tutorialSteps = [
    {
      title: '新建模型配置',
      shortDesc: '在 cc-switch 中为 Claude Code 新建配置',
      description: '启动 cc-switch，选择顶部「Claude Code」标签，点击右上角橘黄色的「+」号。',
      image: step1Image
    },
    {
      title: '选择厂商',
      shortDesc: '在预设厂商列表中选择 DeepSeek 节点',
      description: '从预设厂商的卡片矩阵中，点击蓝色「DeepSeek」按钮以进入配置界面。',
      image: step2Image
    },
    {
      title: '填写 Key 与请求地址',
      shortDesc: '只需粘贴 API Key 即可，无需改动请求地址',
      description: '粘贴你申请的 API Key。下方的请求地址已由软件自动填好，可直接点击右下角「添加」保存。',
      image: step3Image
    },
    {
      title: '一键启用配置',
      shortDesc: '点击蓝色「启用」按钮，配置即可立即生效',
      description: '返回主界面列表，在刚刚添加的 DeepSeek 项目右侧点击「启用」按钮，即可全局生效。',
      image: step4Image
    }
  ]

  return (
    <div className="complete" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
      <div className="complete-icon" style={{ fontSize: '42px', marginBottom: '-10px' }}>🎉</div>
      <h1 style={{ fontSize: '20px' }}>安装完成！</h1>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '6px',
        background: 'rgba(255, 255, 255, 0.03)',
        padding: '4px',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        width: '100%',
        maxWidth: '430px',
        margin: '0 auto 4px'
      }}>
        <button
          onClick={() => setActiveTab('guide')}
          style={{
            flex: 1,
            padding: '6px 10px',
            background: activeTab === 'guide' ? 'linear-gradient(135deg, var(--accent-start), var(--accent-end))' : 'transparent',
            color: activeTab === 'guide' ? 'white' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '12px',
            transition: 'all var(--transition)'
          }}
        >
          🎉 快速开始
        </button>
        <button
          onClick={() => setActiveTab('tutorial')}
          style={{
            flex: 1,
            padding: '6px 10px',
            background: activeTab === 'tutorial' ? 'linear-gradient(135deg, var(--accent-start), var(--accent-end))' : 'transparent',
            color: activeTab === 'tutorial' ? 'white' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '12px',
            transition: 'all var(--transition)'
          }}
        >
          📖 图文教程
        </button>
        <button
          onClick={() => setActiveTab('support')}
          style={{
            flex: 1,
            padding: '6px 10px',
            background: activeTab === 'support' ? 'linear-gradient(135deg, var(--accent-start), var(--accent-end))' : 'transparent',
            color: activeTab === 'support' ? 'white' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '12px',
            transition: 'all var(--transition)'
          }}
        >
          📢 交流与支持
        </button>
      </div>

      {activeTab === 'guide' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="quick-guide" style={{ margin: '0 auto', maxWidth: '440px' }}>
            <div className="quick-guide-step">
              <span className="quick-guide-num">1</span>
              <div>
                点击下方按钮启动 <strong>cc-switch</strong>，并在系统托盘（Mac 顶部菜单栏 / Win 右下角托盘）找到它的图标。
              </div>
            </div>
            <div className="quick-guide-step">
              <span className="quick-guide-num">2</span>
              <div>
                点击图标选择 <strong>DeepSeek</strong> 或其他国产模型，填入 <strong>API Key</strong> 并点击<strong>「启用」</strong>。
              </div>
            </div>
            <div className="quick-guide-step">
              <span className="quick-guide-num">3</span>
              <div>
                打开一个<strong>新的</strong>终端窗口，输入 <code style={{ padding: '2px 8px', background: 'rgba(99,102,241,0.15)', borderRadius: 4, fontFamily: 'monospace', color: '#a78bfa' }}>claude</code> 并回车开始使用！
              </div>
            </div>
          </div>

          <div className="quick-guide" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px dashed rgba(239, 68, 68, 0.25)', margin: '0 auto', maxWidth: '440px' }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#f87171', marginBottom: 4, textAlign: 'left' }}>⚠️ 重要提示（国内免翻墙必看）：</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'left', lineHeight: 1.5 }}>
              必须先通过 <strong>cc-switch</strong> 启用并配置好国产模型，然后打开<strong>新终端</strong>运行。否则 Claude Code 会直接连接官方服务器，导致网络超时或弹出无法访问的 OAuth 登录页面。
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tutorial' && (
        <div style={{
          display: 'flex',
          gap: '16px',
          width: '100%',
          maxWidth: '720px',
          height: '245px',
          margin: '0 auto',
          textAlign: 'left'
        }}>
          {/* Left Panel: Step list */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            overflowY: 'auto'
          }}>
            {tutorialSteps.map((s, idx) => (
              <div
                key={idx}
                onClick={() => setCurrentTutorialStep(idx)}
                style={{
                  padding: '8px 10px',
                  background: currentTutorialStep === idx ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-card)',
                  border: '1px solid',
                  borderColor: currentTutorialStep === idx ? 'var(--accent-start)' : 'var(--border-color)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all var(--transition)'
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '12px', color: currentTutorialStep === idx ? 'var(--accent-start)' : 'var(--text-primary)', marginBottom: '1px' }}>
                  {idx + 1}. {s.title}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                  {s.shortDesc}
                </div>
              </div>
            ))}
          </div>

          {/* Right Panel: Image preview */}
          <div style={{
            width: '390px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            padding: '6px',
            position: 'relative'
          }}>
            <img
              src={tutorialSteps[currentTutorialStep].image}
              style={{
                maxHeight: '185px',
                maxWidth: '100%',
                borderRadius: '4px',
                objectFit: 'contain',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                cursor: 'zoom-in'
              }}
              onClick={() => setShowLightbox(true)}
              title="点击放大图片"
              alt={tutorialSteps[currentTutorialStep].title}
            />
            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.3', padding: '0 4px' }}>
              {tutorialSteps[currentTutorialStep].description}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'support' && (
        <div style={{
          display: 'flex',
          gap: '16px',
          width: '100%',
          maxWidth: '720px',
          height: '245px',
          margin: '0 auto',
          textAlign: 'left'
        }}>
          {/* Left Panel: Info and other project links */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '12px',
            padding: '12px 18px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px'
          }}>
            <h3 style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>📢 关注作者 & 开源支持</h3>
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              微信扫码关注右侧二维码，您可以：<br />
              • 获得此安装器的<strong>最新版本与升级提醒</strong><br />
              • 获取更多<strong>免翻墙 AI 提效工具</strong>和实用教程<br />
              • 交流 AI 编程实战，反馈使用问题
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button 
                onClick={() => window.electronAPI.openUrl('https://github.com/greek-zzf/claude-code-install')}
                style={{
                  padding: '6px 12px',
                  fontSize: '11px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all var(--transition)'
                }}
              >
                ⭐ 支持项目 Star
              </button>
              <button 
                onClick={() => window.electronAPI.openUrl('https://greek-zzf.github.io')}
                style={{
                  padding: '6px 12px',
                  fontSize: '11px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all var(--transition)'
                }}
              >
                💡 探索更多项目
              </button>
            </div>
          </div>

          {/* Right Panel: QR Code */}
          <div style={{
            width: '240px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            padding: '12px'
          }}>
            <img
              src={wechatQrImage}
              style={{
                height: '160px',
                width: '160px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 4px 20px var(--accent-glow)'
              }}
              alt="WeChat QR Code"
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', fontWeight: 500 }}>
              微信扫码 关注公众号
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {showLightbox && (
        <div
          onClick={() => setShowLightbox(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            cursor: 'zoom-out',
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <img
              src={tutorialSteps[currentTutorialStep].image}
              style={{
                maxHeight: '80vh',
                maxWidth: '85vw',
                borderRadius: '8px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
              alt="Zoomed Tutorial"
            />
            <div style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '6px 16px',
              borderRadius: '20px',
              fontSize: '12px',
              color: '#f0f0f5',
              cursor: 'pointer'
            }}>
              点击任意位置关闭
            </div>
          </div>
        </div>
      )}

      <div className="btn-group" style={{ marginTop: '4px' }}>
        <button className="btn-secondary" onClick={() => window.electronAPI.openTerminal()}>
          打开终端
        </button>
        <button className="btn-primary" onClick={() => window.electronAPI.openCCSwitch()}>
          打开 cc-switch
        </button>
      </div>

      <div className="tips" style={{ fontSize: '10px' }}>
        <code>claude --help</code> 查看帮助 · <code>claude /doctor</code> 诊断问题
      </div>

      <div className="warning-text" style={{ fontSize: '11px', marginTop: '0px' }}>⚠️ 请务必打开新终端窗口后再使用 claude命令</div>
    </div>
  )
}
