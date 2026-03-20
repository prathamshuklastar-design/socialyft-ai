'use client'
import { useState, useEffect, useRef } from 'react'

const SUGGESTED = [
  "Top Instagram trends for food brands in India",
  "How to grow a D2C brand on Reels",
  "Competitor analysis for fashion startups",
  "Content strategy for luxury skincare brand",
  "Best hashtag strategy for Delhi creators",
  "Viral content ideas for marketing agencies",
]

const CHAT_MODES = [
  { id: 'trends', label: 'Trends', icon: '📈', desc: "What's trending now" },
  { id: 'competitor', label: 'Competitor', icon: '🔍', desc: 'Analyse competitors' },
  { id: 'content', label: 'Content Ideas', icon: '💡', desc: 'Generate content' },
  { id: 'strategy', label: 'Strategy', icon: '🎯', desc: 'Build your strategy' },
  { id: 'audience', label: 'Audience', icon: '👥', desc: 'Know your audience' },
]

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  mode?: string
  followups?: string[]
  timestamp: string
}

type Chat = {
  id: string
  title: string
  messages: Message[]
  createdAt: string
}

type SavedIdea = { id: string; query: string; result: string; savedAt: string }

export default function Search() {
  const [query, setQuery] = useState('')
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeMode, setActiveMode] = useState('trends')
  const [savedIdeas, setSavedIdeas] = useState<SavedIdea[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [displayedContent, setDisplayedContent] = useState<Record<string, string>>({})
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const c = localStorage.getItem('sai_chats')
    const s = localStorage.getItem('sai_saved')
    if (c) setChats(JSON.parse(c))
    if (s) setSavedIdeas(JSON.parse(s))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayedContent, loading])

  const activeChat = chats.find(c => c.id === activeChatId) || null
  const messages = activeChat?.messages || []

  function newChat() {
    setActiveChatId(null)
    setQuery('')
    setDisplayedContent({})
    inputRef.current?.focus()
  }

  function typewriterEffect(msgId: string, fullText: string) {
    setDisplayedContent(prev => ({ ...prev, [msgId]: '' }))
    let i = 0
    const speed = 8
    const interval = setInterval(() => {
      i += speed
      if (i >= fullText.length) {
        setDisplayedContent(prev => ({ ...prev, [msgId]: fullText }))
        clearInterval(interval)
      } else {
        setDisplayedContent(prev => ({ ...prev, [msgId]: fullText.slice(0, i) }))
      }
    }, 16)
  }

  async function sendMessage(q?: string) {
    const searchQuery = (q || query).trim()
    if (!searchQuery) return
    setQuery('')

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: searchQuery,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    }

    let currentChatId = activeChatId
    let updatedChats = [...chats]

    if (!currentChatId) {
      const newChatObj: Chat = {
        id: Date.now().toString(),
        title: searchQuery.slice(0, 40),
        messages: [userMsg],
        createdAt: new Date().toLocaleDateString('en-IN')
      }
      updatedChats = [newChatObj, ...chats]
      currentChatId = newChatObj.id
      setActiveChatId(currentChatId)
    } else {
      updatedChats = updatedChats.map(c =>
        c.id === currentChatId ? { ...c, messages: [...c.messages, userMsg] } : c
      )
    }

    setChats(updatedChats)
    localStorage.setItem('sai_chats', JSON.stringify(updatedChats))
    setLoading(true)

    try {
      const modePrefix: Record<string, string> = {
        trends: 'What are the latest trends for: ',
        competitor: 'Do a competitor analysis for: ',
        content: 'Give me viral content ideas for: ',
        strategy: 'Build a marketing strategy for: ',
        audience: 'Analyse the target audience for: ',
      }
      const fullQuery = (modePrefix[activeMode] || '') + searchQuery +
        '\n\nAt the end of your response, add a section called "FOLLOWUP_QUESTIONS:" with exactly 3 short follow-up questions the user might want to ask next, each on a new line starting with "- ".'

      const res = await fetch('/api/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: fullQuery })
})

if (!res.ok) throw new Error('Search failed')

const reader = res.body!.getReader()
const decoder = new TextDecoder()
let raw = ''
const assistantMsgId = (Date.now() + 1).toString()

// Add empty assistant message first
const emptyMsg: Message = {
  id: assistantMsgId,
  role: 'assistant',
  content: '',
  mode: activeMode,
  followups: [],
  timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

const chatsWithEmpty = updatedChats.map(c =>
  c.id === currentChatId ? { ...c, messages: [...c.messages, emptyMsg] } : c
)
setChats(chatsWithEmpty)
setLoading(false)

// Stream chunks
while (true) {
  const { done, value } = await reader.read()
  if (done) break

  const chunk = decoder.decode(value)
  const lines = chunk.split('\n')

  for (const line of lines) {
    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
      try {
        const json = JSON.parse(line.slice(6))
        if (json.text) {
          raw += json.text
          // Update message in real time
          setChats(prev => prev.map(c =>
            c.id === currentChatId ? {
              ...c,
              messages: c.messages.map(m =>
                m.id === assistantMsgId ? { ...m, content: raw } : m
              )
            } : c
          ))
        }
      } catch {}
    }
  }
}

      let mainContent = raw
      let followups: string[] = []
      const fqIndex = raw.indexOf('FOLLOWUP_QUESTIONS:')
      if (fqIndex !== -1) {
        mainContent = raw.slice(0, fqIndex).trim()
        const fqSection = raw.slice(fqIndex + 'FOLLOWUP_QUESTIONS:'.length)
        followups = fqSection.split('\n')
          .filter((l: string) => l.trim().startsWith('- '))
          .map((l: string) => l.replace(/^- /, '').trim())
          .slice(0, 3)
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: mainContent,
        mode: activeMode,
        followups,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      }

      const finalChats = updatedChats.map(c =>
        c.id === currentChatId ? { ...c, messages: [...c.messages, assistantMsg] } : c
      )
      setChats(finalChats)
      localStorage.setItem('sai_chats', JSON.stringify(finalChats))
      setLoading(false)
    } catch {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      }
      const finalChats = updatedChats.map(c =>
        c.id === currentChatId ? { ...c, messages: [...c.messages, errMsg] } : c
      )
      setChats(finalChats)
      localStorage.setItem('sai_chats', JSON.stringify(finalChats))
      setLoading(false)
    }
  }

  function deleteChat(chatId: string, e: React.MouseEvent) {
    e.stopPropagation()
    const updated = chats.filter(c => c.id !== chatId)
    setChats(updated)
    localStorage.setItem('sai_chats', JSON.stringify(updated))
    if (activeChatId === chatId) setActiveChatId(null)
  }

  function saveMessage(msg: Message) {
    const idea: SavedIdea = {
      id: Date.now().toString(),
      query: msg.content.slice(0, 60),
      result: msg.content,
      savedAt: new Date().toLocaleDateString('en-IN')
    }
    const updated = [idea, ...savedIdeas]
    setSavedIdeas(updated)
    localStorage.setItem('sai_saved', JSON.stringify(updated))
  }

  function deleteSaved(id: string) {
    const updated = savedIdeas.filter(i => i.id !== id)
    setSavedIdeas(updated)
    localStorage.setItem('sai_saved', JSON.stringify(updated))
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text)
  }

  function exportText(content: string, query: string) {
    const blob = new Blob([`SOCIALYFT AI\n\nQuery: ${query}\n\n${content}`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `socialyft-${query.slice(0, 20).replace(/ /g, '-')}.txt`
    a.click()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function renderContent(text: string) {
    return text.split('\n\n').filter(Boolean).map((para, i) => {
      const clean = para.replace(/^#+\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1')
      const isHeading = para.startsWith('#') || (para.length < 80 && para.endsWith(':'))
      if (isHeading) return (
        <h3 key={i} style={{ fontSize: 14, fontWeight: 600, marginTop: 18, marginBottom: 6, color: '#0d0d0d', fontFamily: '"DM Sans", sans-serif' }}>
          {clean.replace(/:$/, '')}
        </h3>
      )
      if (para.startsWith('- ') || para.startsWith('• ')) {
        const items = para.split('\n').filter(l => l.trim())
        return (
          <ul key={i} style={{ paddingLeft: 20, marginBottom: 12 }}>
            {items.map((item, j) => (
              <li key={j} style={{ lineHeight: 1.75, fontSize: 15, color: '#0d0d0d', marginBottom: 4, fontFamily: '"DM Sans", sans-serif' }}>
                {item.replace(/^[-•]\s*/, '')}
              </li>
            ))}
          </ul>
        )
      }
      return (
        <p key={i} style={{ marginBottom: 12, lineHeight: 1.75, fontSize: 15, color: '#0d0d0d', fontFamily: '"DM Sans", sans-serif', fontWeight: 400 }}>
          {clean}
        </p>
      )
    })
  }

  const isEmpty = messages.length === 0

  return (
    <div style={{ height: '100vh', background: '#ffffff', fontFamily: '"DM Sans", sans-serif', color: '#0d0d0d', display: 'flex', overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: #FFC107; color: #0a0a0a; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #e5e5e5; border-radius: 3px; }
        .chat-item { padding: 10px 12px; border-radius: 8px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s; group: true; }
        .chat-item:hover { background: #f5f5f5; }
        .chat-item.active { background: #f0f0f0; }
        .chat-delete { opacity: 0; background: none; border: none; cursor: pointer; color: #bbb; font-size: 16px; transition: all 0.15s; padding: 2px 4px; border-radius: 4px; }
        .chat-item:hover .chat-delete { opacity: 1; }
        .chat-delete:hover { color: #ff4444; background: #fff0f0; }
        .mode-btn { border: 1px solid #e5e5e5; background: #fafafa; cursor: pointer; padding: 5px 12px; border-radius: 20px; font-family: "DM Sans", sans-serif; font-size: 12px; font-weight: 500; transition: all 0.15s; color: #666; display: flex; align-items: center; gap: 5px; white-space: nowrap; }
        .mode-btn.active { background: #0d0d0d; color: white; border-color: #0d0d0d; }
        .mode-btn:hover:not(.active) { border-color: #FFC107; color: #0a0a0a; background: #fffdf0; }
        .followup-btn { background: #fafafa; border: 1px solid #e5e5e5; padding: 8px 14px; border-radius: 8px; font-family: "DM Sans", sans-serif; font-size: 13px; color: #444; cursor: pointer; transition: all 0.15s; text-align: left; width: 100%; }
        .followup-btn:hover { border-color: #FFC107; background: #fffdf0; color: #0a0a0a; }
        .action-icon { background: none; border: none; cursor: pointer; padding: 5px 7px; border-radius: 6px; color: #ccc; font-size: 13px; transition: all 0.15s; }
        .action-icon:hover { background: #f5f5f5; color: #555; }
        .suggest-chip { background: white; border: 1px solid #e5e5e5; padding: 10px 16px; border-radius: 12px; font-family: "DM Sans", sans-serif; font-size: 13px; color: #555; cursor: pointer; transition: all 0.15s; text-align: left; }
        .suggest-chip:hover { border-color: #FFC107; color: #0a0a0a; background: #fffdf0; }
        .send-btn { background: #0d0d0d; border: none; border-radius: 8px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s; flex-shrink: 0; }
        .send-btn:hover { background: #333; }
        .send-btn:disabled { background: #e5e5e5; cursor: not-allowed; }
        .new-chat-btn { width: 100%; background: #0d0d0d; color: white; border: none; padding: 10px; border-radius: 8px; font-family: "DM Sans", sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .new-chat-btn:hover { background: #333; }
        .saved-card { background: white; border: 1px solid #e5e5e5; border-left: 3px solid #FFC107; padding: 16px; margin-bottom: 10px; border-radius: 8px; }
        .delete-btn { background: none; border: none; cursor: pointer; color: #ccc; font-size: 18px; transition: color 0.15s; }
        .delete-btn:hover { color: #ff4444; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.25s ease forwards; }
        @keyframes blink { 0%,100%{opacity:0.2} 50%{opacity:1} }
        .dot { width: 6px; height: 6px; background: #FFC107; border-radius: 50%; display: inline-block; animation: blink 1.2s ease infinite; }
        .dot:nth-child(2){animation-delay:.2s} .dot:nth-child(3){animation-delay:.4s}
        .textarea-input { width: 100%; border: none; outline: none; resize: none; font-family: "DM Sans", sans-serif; font-size: 15px; color: #0d0d0d; background: transparent; line-height: 1.5; max-height: 200px; overflow-y: auto; }
        .textarea-input::placeholder { color: #aaa; }
        .cursor { display: inline-block; width: 2px; height: 16px; background: #FFC107; margin-left: 2px; animation: cursorBlink 0.8s infinite; vertical-align: text-bottom; }
        @keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }
        .tab-btn { background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-family: "DM Sans", sans-serif; font-size: 11px; font-weight: 500; letter-spacing: 1px; text-transform: uppercase; padding: 6px 0; color: #aaa; transition: all 0.2s; }
        .tab-btn.active { color: #0a0a0a; border-bottom-color: #FFC107; }
        .tab-btn:hover:not(.active) { color: #0a0a0a; }
        .sidebar-toggle { background: none; border: none; cursor: pointer; padding: 6px; border-radius: 6px; color: #888; transition: all 0.15s; }
        .sidebar-toggle:hover { background: #f5f5f5; color: #0d0d0d; }
      `}</style>

      {/* LEFT SIDEBAR */}
      {sidebarOpen && (
        <div style={{ width: 260, background: '#fafafa', borderRight: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column', height: '100vh', flexShrink: 0 }}>
          {/* Sidebar Header */}
          <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid #e5e5e5' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <img src="/logo-icon.png" alt="S" style={{ height: 26, width: 26, objectFit: 'contain' }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: '"DM Sans", sans-serif', lineHeight: 1.1 }}>
                  Socialyft <span style={{ color: '#FFC107' }}>AI</span>
                </div>
                <div style={{ fontSize: 8, color: '#bbb', letterSpacing: 2, textTransform: 'uppercase' }}>Marketing Intelligence</div>
              </div>
            </div>
            <button className="new-chat-btn" onClick={newChat}>
              <span style={{ fontSize: 16 }}>+</span> New Chat
            </button>
          </div>

          {/* Saved Ideas link */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #e5e5e5' }}>
            <button
              onClick={() => setActiveChatId('saved')}
              style={{ width: '100%', background: activeChatId === 'saved' ? '#f0f0f0' : 'none', border: 'none', padding: '8px 12px', borderRadius: 8, fontFamily: '"DM Sans", sans-serif', fontSize: 13, color: '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', transition: 'background 0.15s' }}
            >
              💾 <span>Saved Ideas ({savedIdeas.length})</span>
            </button>
          </div>

          {/* Chat History */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
            {chats.length === 0 ? (
              <p style={{ fontSize: 12, color: '#ccc', textAlign: 'center', padding: '20px 0', fontFamily: '"DM Sans", sans-serif' }}>No chats yet</p>
            ) : (
              <>
                <p style={{ fontSize: 10, color: '#bbb', letterSpacing: 2, textTransform: 'uppercase', padding: '4px 12px 8px', fontFamily: '"DM Sans", sans-serif' }}>Recent</p>
                {chats.map(chat => (
                  <div key={chat.id} className={`chat-item ${activeChatId === chat.id ? 'active' : ''}`} onClick={() => setActiveChatId(chat.id)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: '#222', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: '"DM Sans", sans-serif' }}>
                        {chat.title}
                      </p>
                      <p style={{ fontSize: 11, color: '#bbb', marginTop: 1, fontFamily: '"DM Sans", sans-serif' }}>{chat.createdAt}</p>
                    </div>
                    <button className="chat-delete" onClick={(e) => deleteChat(chat.id, e)}>×</button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* MAIN AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

        {/* Top bar */}
        <div style={{ borderBottom: '1px solid #e5e5e5', padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', gap: 12, background: 'white', flexShrink: 0 }}>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} title="Toggle sidebar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          {activeChatId && activeChatId !== 'saved' && activeChat && (
            <p style={{ fontSize: 14, fontWeight: 500, color: '#555', fontFamily: '"DM Sans", sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeChat.title}
            </p>
          )}
          {activeChatId === 'saved' && (
            <p style={{ fontSize: 14, fontWeight: 500, color: '#555', fontFamily: '"DM Sans", sans-serif' }}>💾 Saved Ideas</p>
          )}
        </div>

        {/* SAVED IDEAS VIEW */}
        {activeChatId === 'saved' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', maxWidth: 760, width: '100%', margin: '0 auto' }}>
            <div className="fade-up">
              <h2 style={{ fontSize: 22, fontWeight: 700, fontFamily: '"DM Sans", sans-serif', marginBottom: 24 }}>Saved Ideas</h2>
              {savedIdeas.length === 0
                ? <div style={{ textAlign: 'center', padding: '48px 0' }}>
                    <p style={{ fontSize: 36, marginBottom: 12 }}>💡</p>
                    <p style={{ color: '#bbb', fontFamily: '"DM Sans", sans-serif', fontSize: 14 }}>No saved ideas yet.</p>
                    <p style={{ color: '#ccc', fontFamily: '"DM Sans", sans-serif', fontSize: 12, marginTop: 4 }}>Chat and click 💾 to save!</p>
                  </div>
                : savedIdeas.map(idea => (
                  <div key={idea.id} className="saved-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, fontFamily: '"DM Sans", sans-serif', marginBottom: 2 }}>{idea.query}</p>
                        <p style={{ fontSize: 11, color: '#bbb', fontFamily: '"DM Sans", sans-serif' }}>Saved {idea.savedAt}</p>
                      </div>
                      <button className="delete-btn" onClick={() => deleteSaved(idea.id)}>×</button>
                    </div>
                    <p style={{ fontSize: 13, color: '#555', fontFamily: '"DM Sans", sans-serif', lineHeight: 1.7, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{idea.result}</p>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* CHAT VIEW */}
        {activeChatId !== 'saved' && (
          <>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
              <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px' }}>

                {/* Empty state */}
                {isEmpty && (
                  <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 60 }}>
                    <img src="/logo-icon.png" alt="S" style={{ height: 44, width: 44, objectFit: 'contain', marginBottom: 18, opacity: 0.12 }} />
                    <h1 style={{ fontSize: 26, fontWeight: 600, fontFamily: '"DM Sans", sans-serif', textAlign: 'center', marginBottom: 6, letterSpacing: -0.5 }}>
                      What do you want to know?
                    </h1>
                    <p style={{ fontSize: 14, color: '#888', fontFamily: '"DM Sans", sans-serif', marginBottom: 36, textAlign: 'center' }}>
                      For Creators · Brands · Agencies
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', maxWidth: 580 }}>
                      {SUGGESTED.map((s, i) => (
                        <button key={i} className="suggest-chip" onClick={() => sendMessage(s)}>{s}</button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Messages list */}
                {messages.map((msg, idx) => (
                  <div key={msg.id} className="fade-up" style={{ marginBottom: 28 }}>
                    {msg.role === 'user' ? (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ background: '#f5f5f5', borderRadius: '18px 18px 4px 18px', padding: '11px 16px', maxWidth: '72%' }}>
                          <p style={{ fontSize: 15, fontFamily: '"DM Sans", sans-serif', color: '#0d0d0d', lineHeight: 1.5 }}>{msg.content}</p>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <img src="/logo-icon.png" alt="AI" style={{ width: 26, height: 26, objectFit: 'contain', flexShrink: 0, marginTop: 2 }} />
                        <div style={{ flex: 1 }}>
                          {msg.mode && (
                            <p style={{ fontSize: 10, fontWeight: 600, color: '#bbb', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, fontFamily: '"DM Sans", sans-serif' }}>
                              {CHAT_MODES.find(m => m.id === msg.mode)?.icon} {CHAT_MODES.find(m => m.id === msg.mode)?.label}
                            </p>
                          )}

                          {/* Typewriter content */}
                          <div>
                            {renderContent(displayedContent[msg.id] !== undefined ? displayedContent[msg.id] : msg.content)}
                            {displayedContent[msg.id] !== undefined && displayedContent[msg.id] !== msg.content && (
                              <span className="cursor" />
                            )}
                          </div>

                          {/* Show actions + followups only when typing is done */}
                          {(displayedContent[msg.id] === msg.content || displayedContent[msg.id] === undefined) && (
                            <>
                              <div style={{ display: 'flex', gap: 2, marginTop: 8 }}>
                                <button className="action-icon" onClick={() => copyText(msg.content)} title="Copy">📋</button>
                                <button className="action-icon" onClick={() => exportText(msg.content, messages[idx - 1]?.content || '')} title="Export">↓</button>
                                <button className="action-icon" onClick={() => saveMessage(msg)} title="Save">💾</button>
                              </div>
                              {msg.followups && msg.followups.length > 0 && (
                                <div style={{ marginTop: 14 }}>
                                  <p style={{ fontSize: 10, color: '#bbb', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, fontFamily: '"DM Sans", sans-serif' }}>Follow up</p>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {msg.followups.map((fq, i) => (
                                      <button key={i} className="followup-btn" onClick={() => sendMessage(fq)}>{fq}</button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Loading dots */}
                {loading && (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 28 }}>
                    <img src="/logo-icon.png" alt="AI" style={{ width: 26, height: 26, objectFit: 'contain', flexShrink: 0 }} />
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '10px 0' }}>
                      <span className="dot" /><span className="dot" /><span className="dot" />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            {/* Input area */}
            <div style={{ borderTop: '1px solid #f0f0f0', padding: '12px 24px 20px', background: 'white', flexShrink: 0 }}>
              <div style={{ maxWidth: 720, margin: '0 auto' }}>
                {/* Mode pills */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  {CHAT_MODES.map(mode => (
                    <button key={mode.id} className={`mode-btn ${activeMode === mode.id ? 'active' : ''}`} onClick={() => setActiveMode(mode.id)}>
                      <span>{mode.icon}</span>{mode.label}
                    </button>
                  ))}
                </div>
                {/* Input box */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, border: '1.5px solid #e5e5e5', borderRadius: 14, padding: '10px 12px', background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                  <textarea
                    ref={inputRef}
                    className="textarea-input"
                    value={query}
                    onChange={e => { setQuery(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px' }}
                    onKeyDown={handleKeyDown}
                    placeholder={CHAT_MODES.find(m => m.id === activeMode)?.desc + '...'}
                    rows={1}
                  />
                  <button className="send-btn" onClick={() => sendMessage()} disabled={!query.trim() || loading}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </button>
                </div>
                <p style={{ fontSize: 11, color: '#ddd', textAlign: 'center', marginTop: 6, fontFamily: '"DM Sans", sans-serif' }}>
                  Enter to send · Shift+Enter for new line
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
