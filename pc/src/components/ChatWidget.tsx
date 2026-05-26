import { useState, useRef, useEffect, useCallback } from 'react'
import { Button, Input, Typography, Spin, Tooltip } from 'antd'
import { MessageSquare, X, Send, Bot, User, Minimize2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useTranslation } from 'react-i18next'
import styles from './ChatWidget.module.css'

const { Text } = Typography

// Roles that should see the chat widget
const CHAT_ROLES = ['student', 'parent', 'teacher', 'admin', 'manager', 'principal']

// Preset quick questions per role
const QUICK_QUESTIONS: Record<string, string[]> = {
  student: [
    'When does course registration close?',
    'Can I drop my Science course?',
  ],
  parent: [
    "What is my child's attendance rate?",
    'When is the next parent-teacher meeting?',
  ],
  teacher: [
    'How many students are in my class?',
    'What is the CPD requirement?',
  ],
  default: [
    'How do I contact the school office?',
    'What are the school hours?',
  ],
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const ChatWidget = () => {
  const { t } = useTranslation()
  const user = useAuthStore(s => s.user)
  const token = useAuthStore(s => s.token)

  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [streaming, setStreaming] = useState(false)
  const [minimized, setMinimized] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<any>(null)
  const abortRef = useRef<AbortController | null>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 100)
      if (messages.length === 0) {
        // Welcome message
        const name = user?.displayName?.split(' ')[0] ?? 'there'
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: `Hello ${name}! I'm the MOE AI Assistant. I can help you with course registration, attendance, grades, and school policies. What would you like to know?`,
          timestamp: new Date(),
        }])
      }
    }
  }, [open, minimized])

  if (!user || !CHAT_ROLES.includes(user.role)) return null

  const quickQuestions = QUICK_QUESTIONS[user.role] ?? QUICK_QUESTIONS.default

  const sendMessage = async (messageText: string) => {
    const text = messageText.trim()
    if (!text || streaming) return

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setStreaming(true)

    // Create placeholder for assistant response
    const assistantId = `assistant-${Date.now()}`
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/v1/ai/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text, conversationId }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        throw new Error('Stream request failed')
      }

      const reader = res.body.getReader()
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
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          try {
            const data = JSON.parse(trimmed.slice(6))
            if (data.chunk) {
              fullContent += data.chunk
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: fullContent } : m
              ))
            }
            if (data.done && data.conversationId) {
              setConversationId(data.conversationId)
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return
      // Show error in message
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: 'Sorry, I encountered an error. Please try again.' }
          : m
      ))
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleClose = () => {
    abortRef.current?.abort()
    setOpen(false)
    setMinimized(false)
  }

  return (
    <div className={styles.wrapper}>
      {/* Chat Panel */}
      {open && (
        <div className={`${styles.panel} ${minimized ? styles.minimized : ''}`}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <Bot size={18} />
              <span>{t('nav.aiAssistant')}</span>
              <span className={styles.statusDot} />
            </div>
            <div className={styles.headerActions}>
              <Tooltip title={minimized ? 'Expand' : 'Minimize'}>
                <button className={styles.iconBtn} onClick={() => setMinimized(m => !m)}>
                  <Minimize2 size={14} />
                </button>
              </Tooltip>
              <Tooltip title="Close">
                <button className={styles.iconBtn} onClick={handleClose}>
                  <X size={14} />
                </button>
              </Tooltip>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className={styles.messages}>
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.assistantMessage}`}
                  >
                    <div className={styles.messageAvatar}>
                      {msg.role === 'user'
                        ? <User size={14} />
                        : <Bot size={14} />
                      }
                    </div>
                    <div className={styles.messageBubble}>
                      {msg.content
                        ? <MarkdownText content={msg.content} />
                        : <Spin size="small" />
                      }
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Questions */}
              {messages.length <= 1 && (
                <div className={styles.quickQuestions}>
                  {quickQuestions.map(q => (
                    <button
                      key={q}
                      className={styles.quickBtn}
                      onClick={() => sendMessage(q)}
                      disabled={streaming}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className={styles.inputArea}>
                <Input.TextArea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything..."
                  autoSize={{ minRows: 1, maxRows: 3 }}
                  disabled={streaming}
                  className={styles.textarea}
                />
                <Button
                  type="primary"
                  icon={<Send size={14} />}
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || streaming}
                  className={styles.sendBtn}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Float Button */}
      <Tooltip title={open ? '' : t('nav.aiAssistant')} placement="left">
        <button
          className={`${styles.fab} ${open ? styles.fabOpen : ''}`}
          onClick={() => open ? handleClose() : setOpen(true)}
        >
          {open ? <X size={22} /> : <MessageSquare size={22} />}
        </button>
      </Tooltip>
    </div>
  )
}

// Simple markdown renderer (bold + line breaks)
const MarkdownText = ({ content }: { content: string }) => {
  const lines = content.split('\n')
  return (
    <div>
      {lines.map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/)
        return (
          <div key={i} style={{ minHeight: line ? undefined : '0.5em' }}>
            {parts.map((part, j) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={j}>{part.slice(2, -2)}</strong>
              }
              return <span key={j}>{part}</span>
            })}
          </div>
        )
      })}
    </div>
  )
}

export default ChatWidget
