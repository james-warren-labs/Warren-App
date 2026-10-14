import { useEffect, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, Check, ChevronDown, CircleHelp, Code2, Copy,
  FileText, Globe2, GraduationCap, Menu, MessageCircle, Moon, MoreHorizontal,
  Plus, Search, Settings2, Sparkles, Sun, Trash2, X, Zap
} from "lucide-react";

const starterPrompts = [
  { icon: GraduationCap, title: "Help me study", text: "Explain a difficult topic in simple steps." },
  { icon: Code2, title: "Write or debug code", text: "Help me understand a coding problem." },
  { icon: FileText, title: "Write something", text: "Help me write, improve, or summarize text." },
  { icon: Globe2, title: "Explore an idea", text: "Help me brainstorm an idea from scratch." },
];

const initialChats = [
  { id: "welcome", title: "Getting started with Warren", messages: [] },
];

function App() {
  const [chats, setChats] = useState(initialChats);
  const [activeId, setActiveId] = useState("welcome");
  const [input, setInput] = useState("");
  const [dark, setDark] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);

  const activeChat = chats.find((chat) => chat.id === activeId) || chats[0];
  const messages = activeChat?.messages || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, activeId]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function newChat() {
    const chat = { id: crypto.randomUUID(), title: "New conversation", messages: [] };
    setChats((current) => [chat, ...current]);
    setActiveId(chat.id);
    setInput("");
    setSidebarOpen(false);
    textareaRef.current?.focus();
  }

  function chooseChat(id) {
    setActiveId(id);
    setSidebarOpen(false);
  }

  function sendMessage(value = input) {
    const text = value.trim();
    if (!text) return;
    const firstMessage = messages.length === 0;
    setChats((current) => current.map((chat) => chat.id === activeId
      ? { ...chat, title: firstMessage ? text.slice(0, 34) + (text.length > 34 ? "…" : "") : chat.title,
          messages: [...chat.messages, { id: crypto.randomUUID(), role: "user", content: text }] }
      : chat));
    setInput("");
    setNotice("Chat interface is ready. Connect an AI API to enable real responses.");
  }

  function deleteChat(id) {
    const remaining = chats.filter((chat) => chat.id !== id);
    if (remaining.length === 0) {
      const fresh = { id: crypto.randomUUID(), title: "New conversation", messages: [] };
      setChats([fresh]);
      setActiveId(fresh.id);
    } else {
      setChats(remaining);
      if (activeId === id) setActiveId(remaining[0].id);
    }
    setNotice("Conversation removed from this demo session.");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied to clipboard.");
    } catch {
      setNotice("Clipboard access isn't available in this browser.");
    }
  }

  function onComposerKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  const visibleChats = chats.filter((chat) => chat.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={`app-shell ${dark ? "theme-dark" : "theme-light"}`}>
      {sidebarOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark"><Sparkles size={19} strokeWidth={2.2} /></div>
          <span className="brand-name">warren<span className="brand-ai">.ai</span></span>
          <button className="icon-button sidebar-close" aria-label="Close menu" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>

        <button className="new-chat-button" onClick={newChat}><Plus size={17} /><span>New chat</span><span className="shortcut">↵</span></button>
        <button className="nav-item" onClick={() => { setShowSearch((value) => !value); setSearch(""); }}><Search size={17} /><span>Search chats</span></button>
        {showSearch && <div className="search-box"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations…" autoFocus /></div>}

        <div className="sidebar-label">YOUR WORKSPACE</div>
        <div className="chat-list">
          {visibleChats.map((chat) => (
            <div className={`chat-row ${chat.id === activeId ? "chat-row-active" : ""}`} key={chat.id}>
              <button className="chat-link" onClick={() => chooseChat(chat.id)}><MessageCircle size={15} /><span>{chat.title}</span></button>
              <button className="chat-delete" aria-label={`Delete ${chat.title}`} onClick={() => deleteChat(chat.id)}><Trash2 size={14} /></button>
            </div>
          ))}
          {visibleChats.length === 0 && <p className="empty-search">No matching chats</p>}
        </div>

        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <div className="upgrade-icon"><Zap size={16} /></div>
            <div><strong>Your ideas, in motion.</strong><p>Warren is just getting started.</p></div>
          </div>
          <button className="profile-button" onClick={() => setNotice("Account sign-in will be added with the backend.")}>
            <div className="avatar">W</div><div className="profile-copy"><strong>Warren workspace</strong><span>Local demo</span></div><MoreHorizontal size={18} />
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
            <div className="model-select"><span className="model-dot" /><span>Warren AI</span><ChevronDown size={15} /></div>
            <span className="preview-badge">PREVIEW</span>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setDark((value) => !value)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button className="icon-button help-button" aria-label="About Warren" onClick={() => setNotice("Warren AI is an early prototype. AI responses and accounts are not connected yet.")}><CircleHelp size={18} /></button>
            <div className="topbar-avatar">W</div>
          </div>
        </header>

        <section className={`conversation ${messages.length ? "conversation-active" : ""}`}>
          {messages.length === 0 ? (
            <div className="welcome-content">
              <div className="welcome-orb"><div className="orb-core"><Sparkles size={30} /></div><span className="orb-ring orb-ring-one" /><span className="orb-ring orb-ring-two" /></div>
              <div className="eyebrow"><span className="eyebrow-line" /> A LITTLE MORE POSSIBLE <span className="eyebrow-line" /></div>
              <h1>What will we <span>figure out</span><br className="desktop-break" /> today?</h1>
              <p className="welcome-description">A space to think clearly, learn something new, and turn your ideas into action.</p>
              <div className="prompt-grid">
                {starterPrompts.map(({ icon: Icon, title, text }) => (
                  <button className="prompt-card" key={title} onClick={() => { setInput(text); textareaRef.current?.focus(); }}>
                    <div className="prompt-icon"><Icon size={18} /></div><strong>{title}</strong><span>{text}</span><ArrowDown className="prompt-arrow" size={15} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list">
              <div className="thread-heading"><span className="thread-dot" /> CONVERSATION</div>
              {messages.map((message) => (
                <article className={`message message-${message.role}`} key={message.id}>
                  <div className={`message-avatar ${message.role === "assistant" ? "assistant-avatar" : ""}`}>{message.role === "assistant" ? <Sparkles size={16} /> : "Y"}</div>
                  <div className="message-body"><div className="message-author">{message.role === "assistant" ? "Warren" : "You"}</div><p>{message.content}</p><div className="message-tools"><button onClick={() => copyText(message.content)}><Copy size={13} /> Copy</button></div></div>
                </article>
              ))}
              <div className="demo-note"><Sparkles size={15} /><span>Your message is shown in this prototype. Connect a backend AI provider to receive generated answers.</span></div>
              <div ref={bottomRef} />
            </div>
          )}
        </section>

        <div className="composer-wrap">
          <div className="composer">
            <textarea ref={textareaRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onComposerKeyDown} placeholder="Ask Warren anything…" rows={1} aria-label="Message Warren" />
            <div className="composer-footer">
              <div className="composer-tools"><button className="tool-button" onClick={() => setNotice("File uploads will be added in a future version.")}><Plus size={16} /><span>Add</span></button><span className="composer-hint">Be curious. Make something great.</span></div>
              <button className={`send-button ${input.trim() ? "send-ready" : ""}`} onClick={() => sendMessage()} disabled={!input.trim()} aria-label="Send message"><ArrowUp size={18} /></button>
            </div>
          </div>
          <p className="disclaimer">Warren AI is in preview. <span>Check important information independently.</span></p>
        </div>

        <footer className="statusbar"><span><span className="status-dot" /> ALL SYSTEMS READY <span className="status-divider">/</span> UI PREVIEW</span><span>MADE FOR WHAT'S NEXT <Sparkles size={12} /></span></footer>
      </main>

      {notice && <div className="toast" role="status"><Check size={16} /><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={14} /></button></div>}
    </div>
  );
}

export default App;