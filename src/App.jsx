import React, { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './App.css'

const STORAGE_KEY = 'trench.conversations.v1'
const SETTINGS_KEY = 'trench.settings.v1'

const DEFAULT_SETTINGS = {
  serverUrl: 'http://localhost:11434',
  model: '',
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

// Splits a raw streamed string into { reasoning, answer } based on <think> tags.
function splitThinking(raw) {
  const openIdx = raw.indexOf('<think>')
  if (openIdx === -1) return { reasoning: '', answer: raw }
  const afterOpen = raw.slice(openIdx + 7)
  const closeIdx = afterOpen.indexOf('</think>')
  if (closeIdx === -1) {
    return { reasoning: afterOpen, answer: '', reasoning_open: true }
  }
  return {
    reasoning: afterOpen.slice(0, closeIdx),
    answer: afterOpen.slice(closeIdx + 8),
    reasoning_open: false,
  }
}

/* ---------------- Icons ---------------- */

const Icon = {
  Plus: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14"/></svg>
  ),
  Send: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7Z"/></svg>
  ),
  Stop: (p) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" {...p}><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
  ),
  Trash: (p) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
  ),
  Settings: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
  ),
  Menu: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M3 12h18M3 6h18M3 18h18"/></svg>
  ),
  Chevron: (p) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6"/></svg>
  ),
}

/* ---------------- Reasoning "dive" component ---------------- */

function DepthGauge({ reasoning, isOpenTag, streaming }) {
  const [expanded, setExpanded] = useState(false)
  const done = !isOpenTag
  // Depth readout is a stylistic proxy tied to how much reasoning has streamed in —
  // not a literal unit, just a "how deep did it go" cue.
  const depth = Math.min(9999, Math.round(reasoning.length * 1.4))

  if (!reasoning) return null

  return (
    <div className={`dive ${done ? 'done' : ''}`}>
      <button className="dive-header" onClick={() => setExpanded(e => !e)}>
        <span className="sonar">
          <span className="sonar-dot" />
          {!done && <span className="sonar-ping" />}
        </span>
        <span>{done ? 'Surfaced' : 'Diving'}</span>
        <span className="depth-readout">— {depth}m</span>
        <Icon.Chevron className={`dive-chevron ${expanded ? 'open' : ''}`} />
      </button>
      {expanded && <div className="dive-body">{reasoning.trim()}</div>}
    </div>
  )
}

/* ---------------- Message bubble ---------------- */

function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  const { reasoning, answer, reasoning_open } = isUser
    ? { reasoning: '', answer: message.content }
    : splitThinking(message.content)

  return (
    <div className={`msg-row ${isUser ? 'user' : 'assistant'}`}>
      <div className={`avatar ${isUser ? 'user' : 'assistant'}`}>
        {isUser ? 'YOU' : 'R1'}
      </div>
      <div className="bubble-col">
        {!isUser && <DepthGauge reasoning={reasoning} isOpenTag={reasoning_open} />}
        {(isUser || answer) && (
          <div className={`bubble ${isUser ? 'user' : 'assistant'}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {answer || '\u00A0'}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------- Settings modal ---------------- */

function SettingsModal({ settings, onSave, onClose }) {
  const [serverUrl, setServerUrl] = useState(settings.serverUrl)
  const [model, setModel] = useState(settings.model)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Connection</h2>
        <p className="modal-sub">
          Point this at your Ollama server. For phone access, use your computer's
          LAN IP instead of localhost, and make sure Ollama is listening on your network.
        </p>

        <div className="field">
          <label>Server URL</label>
          <input
            value={serverUrl}
            onChange={e => setServerUrl(e.target.value)}
            placeholder="http://192.168.1.42:11434"
            spellCheck={false}
          />
          <div className="field-hint">
            On your phone this can't be "localhost" — use your computer's IP on the same Wi-Fi.
          </div>
        </div>

        <div className="field">
          <label>Model tag</label>
          <input
            value={model}
            onChange={e => setModel(e.target.value)}
            placeholder="e.g. huihui_ai/deepseek-r1-abliterated:8b"
            spellCheck={false}
          />
          <div className="field-hint">
            Must match the exact tag from <code>ollama list</code>.
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => onSave({ serverUrl: serverUrl.trim().replace(/\/$/, ''), model: model.trim() })}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- App ---------------- */

export default function App() {
  const [conversations, setConversations] = useState(() =>
    loadJSON(STORAGE_KEY, [])
  )
  const [activeId, setActiveId] = useState(() => conversations[0]?.id ?? null)
  const [settings, setSettings] = useState(() => loadJSON(SETTINGS_KEY, DEFAULT_SETTINGS))
  const [showSettings, setShowSettings] = useState(() => !loadJSON(SETTINGS_KEY, null)?.model)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [connStatus, setConnStatus] = useState('unknown') // unknown | online | offline
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const abortRef = useRef(null)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  const activeConversation = conversations.find(c => c.id === activeId) || null

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations))
  }, [conversations])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConversation?.messages, streaming])

  // Ping the server to show a connection status dot
  useEffect(() => {
    let cancelled = false
    async function ping() {
      try {
        const res = await fetch(`${settings.serverUrl}/api/tags`, { method: 'GET' })
        if (!cancelled) setConnStatus(res.ok ? 'online' : 'offline')
      } catch {
        if (!cancelled) setConnStatus('offline')
      }
    }
    ping()
    const interval = setInterval(ping, 15000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [settings.serverUrl])

  function newConversation() {
    const conv = { id: uid(), title: 'New conversation', messages: [], createdAt: Date.now() }
    setConversations(prev => [conv, ...prev])
    setActiveId(conv.id)
    setSidebarOpen(false)
  }

  function deleteConversation(id, e) {
    e.stopPropagation()
    setConversations(prev => prev.filter(c => c.id !== id))
    if (activeId === id) setActiveId(null)
  }

  function updateActiveMessages(updater) {
    setConversations(prev =>
      prev.map(c => (c.id === activeId ? { ...c, messages: updater(c.messages) } : c))
    )
  }

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
  }, [])

  async function sendMessage() {
    const text = input.trim()
    if (!text || streaming) return
    if (!settings.model) {
      setShowSettings(true)
      return
    }

    let convId = activeId
    let baseMessages = activeConversation?.messages ?? []

    if (!convId) {
      const conv = { id: uid(), title: text.slice(0, 40), messages: [], createdAt: Date.now() }
      setConversations(prev => [conv, ...prev])
      convId = conv.id
      setActiveId(conv.id)
      baseMessages = []
    }

    const userMsg = { role: 'user', content: text, id: uid() }
    const assistantMsg = { role: 'assistant', content: '', id: uid() }
    const nextMessages = [...baseMessages, userMsg, assistantMsg]

    setConversations(prev =>
      prev.map(c => {
        if (c.id !== convId) return c
        const isFirst = c.messages.length === 0
        return {
          ...c,
          title: isFirst ? text.slice(0, 40) : c.title,
          messages: nextMessages,
        }
      })
    )
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`${settings.serverUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: settings.model,
          messages: [...baseMessages, userMsg].map(m => ({ role: m.role, content: m.content })),
          stream: true,
        }),
      })

      if (!res.ok || !res.body) {
        throw new Error(`Server responded ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          let json
          try {
            json = JSON.parse(trimmed)
          } catch {
            continue
          }
          if (json.message?.content) {
            accumulated += json.message.content
            const snapshot = accumulated
            setConversations(prev =>
              prev.map(c =>
                c.id === convId
                  ? {
                      ...c,
                      messages: c.messages.map(m =>
                        m.id === assistantMsg.id ? { ...m, content: snapshot } : m
                      ),
                    }
                  : c
              )
            )
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        const errText = `_Connection error: ${err.message}. Check the server URL in settings and that Ollama is reachable._`
        setConversations(prev =>
          prev.map(c =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map(m =>
                    m.id === assistantMsg.id
                      ? { ...m, content: m.content || errText }
                      : m
                  ),
                }
              : c
          )
        )
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function autoGrow(e) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
  }

  return (
    <div className="app">
      <div className={`sidebar-scrim ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand">
            <span className="brand-mark">◆</span> Trench
          </div>
          <div className="brand-sub">local model, no cloud</div>
        </div>

        <button className="new-chat-btn" onClick={newConversation}>
          <Icon.Plus /> New conversation
        </button>

        <div className="conversation-list">
          {conversations.map(c => (
            <div
              key={c.id}
              className={`conversation-item ${c.id === activeId ? 'active' : ''}`}
              onClick={() => { setActiveId(c.id); setSidebarOpen(false) }}
            >
              <span className="conversation-title">{c.title || 'New conversation'}</span>
              <button className="conversation-delete" onClick={(e) => deleteConversation(c.id, e)}>
                <Icon.Trash />
              </button>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="status-row">
            <span className={`status-dot ${connStatus}`} />
            {connStatus === 'online' && 'connected'}
            {connStatus === 'offline' && 'server unreachable'}
            {connStatus === 'unknown' && 'checking…'}
          </div>
          <button className="settings-btn" onClick={() => setShowSettings(true)}>
            <Icon.Settings /> {settings.model || 'Set up model'}
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)}>
            <Icon.Menu />
          </button>
          <div className="brand" style={{ fontSize: 15 }}>
            <span className="brand-mark">◆</span> Trench
          </div>
        </div>

        <div className="messages">
          {!activeConversation || activeConversation.messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-title">Nothing surfaced yet</div>
              <div className="empty-sub">
                {settings.model
                  ? `Talking to ${settings.model} at ${settings.serverUrl}`
                  : 'Set your Ollama server and model in settings to get started.'}
              </div>
            </div>
          ) : (
            <div className="messages-inner">
              {activeConversation.messages.map(m => (
                <MessageBubble key={m.id} message={m} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="composer-wrap">
          <div className="composer">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={autoGrow}
              onKeyDown={handleKeyDown}
              placeholder="Send a message…"
              rows={1}
            />
            {streaming ? (
              <button className="send-btn stop" onClick={stopStreaming}>
                <Icon.Stop />
              </button>
            ) : (
              <button className="send-btn" onClick={sendMessage} disabled={!input.trim()}>
                <Icon.Send />
              </button>
            )}
          </div>
          <div className="composer-hint">Enter to send · Shift+Enter for a new line</div>
        </div>
      </main>

      {showSettings && (
        <SettingsModal
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={(next) => { setSettings(next); setShowSettings(false) }}
        />
      )}
    </div>
  )
}
