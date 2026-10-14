import { useEffect, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, Check, ChevronDown, CircleHelp, Code2, Copy,
  FileText, Globe2, GraduationCap, LoaderCircle, Menu, MessageCircle, Moon,
  MoreHorizontal, Plus, Search, Sparkles, Sun, Trash2, X, Zap
} from "lucide-react";

const starterPrompts = [
  { icon: GraduationCap, title: "Help me study", text: "Explain a difficult topic in simple steps." },
  { icon: Code2, title: "Write or debug code", text: "Help me understand a coding problem." },
  { icon: FileText, title: "Write something", text: "Help me write, improve, or summarize text." },
  { icon: Globe2, title: "Explore an idea", text: "Help me brainstorm an idea from scratch." },
];
const STORAGE_KEY = "warren-ai-chats-v1";
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

function loadChats() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (Array.isArray(saved) && saved.length) return saved;
  } catch { /* Ignore invalid local browser data. */ }
  return [{ id: "welcome", title: "Getting started with Warren", messages: [] }];
}

function App() {
  const [chats, setChats] = useState(loadChats);
  const [activeId, setActiveId] = useState(() => loadChats()[0]?.id || "welcome");
  const [input, setInput] = useState("");
  const [dark, setDark] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState("checking");
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);
  const requestRef = useRef(false);

  const activeChat = chats.find((chat) => chat.id === activeId) || chats[0];
  const messages = activeChat?.messages || [];

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chats)); }
    catch { setNotice("Browser storage is full. Some recent chats may not be saved."); }
  }, [chats]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, activeId, loading]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/health`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("API unavailable")))
      .then((data) => { if (!cancelled) setApiStatus(data.configured ? "online" : "needs-key"); })
      .catch(() => { if (!cancelled) setApiStatus("offline"); });
    return () => { cancelled = true; };
  }, []);

  function newChat() {
    if (requestRef.current) {
      setNotice("Please wait for the current answer to finish before starting another chat.");
      return;
    }
    const chat = { id: crypto.randomUUID(), title: "New conversation", messages: [] };
    setChats((current) => [chat, ...current]);
    setActiveId(chat.id);
    setInput("");
    setSidebarOpen(false);
    textareaRef.current?.focus();
  }

  function chooseChat(id) {
    if (requestRef.current) {
      setNotice("Please wait for the current answer to finish.");
      return;
    }
    setActiveId(id);
    setSidebarOpen(false);
  }

  async function sendMessage(value = input) {
    const text = value.trim();
    if (!text || requestRef.current || !activeId) return;
    const targetId = activeId;
    const chatAtSend = chats.find((chat) => chat.id === targetId);
    const priorMessages = (chatAtSend?.messages || [])
      .filter((message) => ["user", "assistant"].includes(message.role) && !message.error)
      .slice(-19)
      .map(({ role, content }) => ({ role, content }));
    const userMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const firstMessage = priorMessages.length === 0;

    requestRef.current = true;
    setLoading(true);
    setInput("");
    setChats((current) => current.map((chat) => chat.id === targetId
      ? { ...chat,
          title: firstMessage ? text.slice(0, 34) + (text.length > 34 ? "…" : "") : chat.title,
          messages: [...chat.messages, userMessage] }
      : chat));

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...priorMessages, { role: "user", content: text }] }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
      if (typeof data.answer !== "string" || !data.answer.trim()) throw new Error("The AI returned an empty response.");
      const assistantMessage = { id: crypto.randomUUID(), role: "assistant", content: data.answer.trim() };
      setChats((current) => current.map((chat) => chat.id === targetId
        ? { ...chat, messages: [...chat.messages, assistantMessage] }
        : chat));
      setApiStatus("online");
    } catch (error) {
      const message = error?.message || "Could not reach Warren's AI service.";
      const errorMessage = { id: crypto.randomUUID(), role: "assistant", content: message, error: true };
      setChats((current) => current.map((chat) => chat.id === targetId
        ? { ...chat, messages: [...chat.messages, errorMessage] }
        : chat));
      setNotice(message);
      if (message.includes("not configured")) setApiStatus("needs-key");
      else if (message.includes("Failed to fetch") || message.includes("NetworkError")) setApiStatus("offline");
    } finally {
      requestRef.current = false;
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  function deleteChat(id) {
    if (requestRef.current) {
      setNotice("Please wait for the current answer to finish.");
      return;
    }
    const remaining = chats.filter((chat) => chat.id !== id);
    if (remaining.length === 0) {
      const fresh = { id: crypto.randomUUID(), title: "New conversation", messages: [] };
      setChats([fresh]);
      setActiveId(fresh.id);
    } else {
      setChats(remaining);
      if (activeId === id) setActiveId(remaining[0].id);
    }
    setNotice("Conversation deleted from this browser.");
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
  const statusText = apiStatus === "online" ? "AI SERVICE READY" : apiStatus === "needs-key" ? "API KEY NEEDED" : apiStatus === "checking" ? "CHECKING API" : "API OFFLINE";

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
          <div className="upgrade-card"><div className="upgrade-icon"><Zap size={16} /></div><div><strong>Your ideas, in motion.</strong><p>One place to think, learn, and create.</p></div></div>
          <button className="profile-button" onClick={() => setNotice("Cloud accounts are not implemented yet. Chats are saved in this browser only.")}>
            <div className="avatar">W</div><div className="profile-copy"><strong>Warren workspace</strong><span>Browser storage</span></div><MoreHorizontal size={18} />
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
            <div className="model-select"><span className={`model-dot ${apiStatus === "offline" ? "model-dot-offline" : ""}`} /><span>Warren AI</span><ChevronDown size={15} /></div>
            <span className="preview-badge">BETA</span>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setDark((value) => !value)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button className="icon-button help-button" aria-label="About Warren" onClick={() => setNotice("Warren uses an AI provider configured on the server. Your provider API key should never be placed in the browser.")}><CircleHelp size={18} /></button>
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
                <article className={`message message-${message.role} ${message.error ? "message-error" : ""}`} key={message.id}>
                  <div className={`message-avatar ${message.role === "assistant" ? "assistant-avatar" : ""}`}>{message.role === "assistant" ? <Sparkles size={16} /> : "Y"}</div>
                  <div className="message-body"><div className="message-author">{message.role === "assistant" ? "Warren" : "You"}{message.error && <span className="error-label"> · NOTICE</span>}</div><p>{message.content}</p>{!message.error && <div className="message-tools"><button onClick={() => copyText(message.content)}><Copy size={13} /> Copy</button></div>}</div>
                </article>
              ))}
              {loading && <div className="message loading-message"><div className="message-avatar assistant-avatar"><Sparkles size={16} /></div><div className="message-body"><div className="message-author">Warren</div><p className="loading-text"><LoaderCircle size={15} /> Thinking through your question…</p></div></div>}
              <div ref={bottomRef} />
            </div>
          )}
        </section>

        <div className="composer-wrap">
          <div className="composer">
            <textarea ref={textareaRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onComposerKeyDown} placeholder="Ask Warren anything…" rows={1} aria-label="Message Warren" disabled={loading} />
            <div className="composer-footer">
              <div className="composer-tools"><button className="tool-button" onClick={() => setNotice("File uploads are planned for a future version.")}><Plus size={16} /><span>Add</span></button><span className="composer-hint">Be curious. Make something great.</span></div>
              <button className={`send-button ${input.trim() && !loading ? "send-ready" : ""}`} onClick={() => sendMessage()} disabled={!input.trim() || loading} aria-label="Send message">{loading ? <LoaderCircle className="spin-icon" size={17} /> : <ArrowUp size={18} />}</button>
            </div>
          </div>
          <p className="disclaimer">Warren can make mistakes. <span>Check important information independently.</span></p>
        </div>
        <footer className="statusbar"><span><span className={`status-dot ${apiStatus === "offline" ? "status-dot-offline" : apiStatus === "needs-key" ? "status-dot-warning" : ""}`} /> {statusText} <span className="status-divider">/</span> LOCAL CHAT HISTORY</span><span>MADE FOR WHAT'S NEXT <Sparkles size={12} /></span></footer>
      </main>
      {notice && <div className="toast" role="status"><Check size={16} /><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={14} /></button></div>}
    </div>
  );
}
export default App;