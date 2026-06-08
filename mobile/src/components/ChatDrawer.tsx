import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Popup } from 'antd-mobile'
import { MessageSquare, Bot, Send, ChevronDown, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import type { ChatMessage } from '@/types'

const QUICK_QUESTIONS: Record<string, string[]> = {
  student: [
    'What is my current GPA?',
    'How is my attendance rate?',
    'When are my next exams?',
    'What courses am I enrolled in?',
  ],
  parent: [
    'How is my child doing in school?',
    'What is my child\'s attendance rate?',
    'When are the next parent-teacher meetings?',
    'Are there any upcoming fees due?',
  ],
  teacher: [
    'What classes do I teach?',
    'How many students do I have?',
    'What is the attendance rate for my classes?',
    'When is my next CPD workshop?',
  ],
}

let msgIdCounter = 0
function genMsgId() {
  return `msg_${Date.now()}_${++msgIdCounter}`
}

export default function ChatDrawer() {
  const { t } = useTranslation()
  const { user, token } = useAuthStore()
  const role = user?.role ?? 'student'

  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [streaming, setStreaming] = useState(false)
  const [minimized, setMinimized] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const fabRef = useRef<HTMLButtonElement>(null)

  // Draggable FAB position (bottom/right offsets from viewport edges)
  const [fabPos, setFabPos] = useState({ bottom: 96, right: 16 })
  const dragState = useRef({ active: false, startX: 0, startY: 0, startBottom: 0, startRight: 0, moved: false })

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Prevent passive scroll during drag
  useEffect(() => {
    const btn = fabRef.current
    if (!btn) return
    const onMove = (e: TouchEvent) => {
      if (dragState.current.active) e.preventDefault()
    }
    btn.addEventListener('touchmove', onMove, { passive: false })
    return () => btn.removeEventListener('touchmove', onMove)
  }, [])

  const handleFabTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    dragState.current = {
      active: true,
      startX: touch.clientX,
      startY: touch.clientY,
      startBottom: fabPos.bottom,
      startRight: fabPos.right,
      moved: false,
    }
  }

  const handleFabTouchMove = (e: React.TouchEvent) => {
    if (!dragState.current.active) return
    const touch = e.touches[0]
    const dx = touch.clientX - dragState.current.startX
    const dy = touch.clientY - dragState.current.startY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragState.current.moved = true
      const newRight = Math.max(8, Math.min(window.innerWidth - 56, dragState.current.startRight - dx))
      const newBottom = Math.max(8, Math.min(window.innerHeight - 56, dragState.current.startBottom + dy))
      setFabPos({ right: newRight, bottom: newBottom })
    }
  }

  const handleFabTouchEnd = () => {
    if (!dragState.current.moved) {
      handleOpen()
    }
    dragState.current.active = false
  }

  const fabStyle = useMemo(() => ({
    bottom: fabPos.bottom,
    right: fabPos.right,
  }), [fabPos])

  const quickQuestions = QUICK_QUESTIONS[role] ?? QUICK_QUESTIONS.student

  const handleSend = useCallback(async (text?: string) => {
    const messageText = text ?? input.trim()
    if (!messageText || streaming) return

    const userMsg: ChatMessage = { id: genMsgId(), role: 'user', content: messageText }
    const assistantMsg: ChatMessage = { id: genMsgId(), role: 'assistant', content: '' }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/v1/ai/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: messageText,
          conversationId,
        }),
        signal: controller.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.chunk) {
                fullContent += data.chunk
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMsg.id ? { ...m, content: fullContent } : m
                  )
                )
              }
              if (data.done) {
                if (data.conversationId) setConversationId(data.conversationId)
              }
            } catch { /* skip non-JSON lines */ }
          }
        }
      }
      // process remaining buffer
      if (buffer.startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.slice(6))
          if (data.chunk) {
            fullContent += data.chunk
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMsg.id ? { ...m, content: fullContent } : m
              )
            )
          }
          if (data.done && data.conversationId) setConversationId(data.conversationId)
        } catch { /* skip */ }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsg.id && !m.content
              ? { ...m, content: t('chat.error') }
              : m
          )
        )
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [input, streaming, token, conversationId, t])

  const handleCancel = () => {
    abortRef.current?.abort()
    setStreaming(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleOpen = () => {
    setOpen(true)
    setMinimized(false)
    setTimeout(() => inputRef.current?.focus(), 300)
  }

  const handleClose = () => {
    setOpen(false)
    setMinimized(false)
  }

  const handleMinimize = () => {
    setMinimized(!minimized)
  }

  if (!user) return null

  return (
    <>
      {/* Floating Action Button — draggable */}
      <button
        ref={fabRef}
        className="chat-fab"
        style={fabStyle}
        onTouchStart={handleFabTouchStart}
        onTouchMove={handleFabTouchMove}
        onTouchEnd={handleFabTouchEnd}
        onClick={handleOpen}
        aria-label={t('chat.title')}
      >
        <MessageSquare size={22} />
      </button>

      {/* Chat Panel */}
      <Popup
        visible={open}
        onMaskClick={minimized ? handleOpen : handleClose}
        bodyStyle={{
          height: minimized ? 'auto' : '80vh',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        position="bottom"
      >
        <div className="chat-container">
          {/* Header */}
          <div className="chat-header" onClick={handleMinimize}>
            <div className="chat-header-left">
              <div style={{
                width: 32, height: 32, borderRadius: 16,
                background: 'rgba(255,255,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bot size={18} />
              </div>
              <div>
                <div className="chat-header-title">{t('chat.title')}</div>
                <div className="chat-header-status">
                  {streaming ? t('chat.thinking') : 'Online'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={(e) => { e.stopPropagation(); handleMinimize() }}
                style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 4 }}
              >
                {minimized ? <ChevronDown size={18} /> : <ChevronDown size={18} style={{ transform: 'rotate(180deg)' }} />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleClose() }}
                style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className="chat-messages">
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#86909c', padding: '40px 20px' }}>
                    <Bot size={40} color="#c9cdd4" style={{ marginBottom: 12 }} />
                    <div style={{ fontSize: 14 }}>Ask me anything about your school!</div>
                  </div>
                )}
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`chat-bubble ${
                      msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'
                    }`}
                  >
                    {msg.role === 'assistant' && !msg.content && streaming ? (
                      <div className="chat-typing-dots">
                        <span /><span /><span />
                      </div>
                    ) : msg.role === 'assistant' ? (
                      <div style={{ fontSize: 13 }}>
                        {msg.content.split('\n').map((line, i) => (
                          <p key={i} style={{ margin: line ? '0 0 4px' : '4px 0' }}>
                            {line || '\u00A0'}
                          </p>
                        ))}
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Questions */}
              {messages.length <= 1 && (
                <div className="chat-quick-qs">
                  {quickQuestions.map((q, i) => (
                    <button
                      key={i}
                      className="chat-quick-q"
                      onClick={() => handleSend(q)}
                      disabled={streaming}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Input Area */}
              <div className="chat-input-area">
                <textarea
                  ref={inputRef}
                  className="chat-input-field"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('chat.placeholder')}
                  rows={1}
                  disabled={streaming}
                />
                {streaming ? (
                  <button className="chat-send-btn" onClick={handleCancel} style={{ background: '#F53F3F' }}>
                    <X size={16} />
                  </button>
                ) : (
                  <button
                    className="chat-send-btn"
                    onClick={() => handleSend()}
                    disabled={!input.trim()}
                  >
                    <Send size={16} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </Popup>
    </>
  )
}
