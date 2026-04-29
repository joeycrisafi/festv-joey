import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Send, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant';
  content: string;
  links?: { label: string; href: string }[];
}

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1';

const WELCOME: Message = {
  role: 'assistant',
  content:
    "Hi! 👋 I'm Jess — your personal event planning assistant. I can help you find vendors, get real pricing, and even send booking requests, all right here in chat. What are we planning? ✨",
};

// ── Typing dots ───────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-bg rounded-md self-start">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

// ── Link pills ────────────────────────────────────────────────────────────────

function LinkPills({
  links,
  onNavigate,
}: {
  links: { label: string; href: string }[];
  onNavigate: (href: string) => void;
}) {
  if (!links || links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {links.map((link, i) => (
        <button
          key={i}
          onClick={() => onNavigate(link.href)}
          className="inline-block border border-gold text-gold text-xs px-3 py-1 rounded-full
                     hover:bg-gold hover:text-dark transition-colors duration-150 font-sans font-semibold"
        >
          {link.label}
        </button>
      ))}
    </div>
  );
}

// ── Widget ────────────────────────────────────────────────────────────────────

export default function JessWidget() {
  const navigate = useNavigate();

  const [isOpen, setIsOpen]     = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput]       = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen]);

  const open   = () => { setIsOpen(true); setHasOpened(true); };
  const toggle = () => (isOpen ? setIsOpen(false) : open());

  // Handle link navigation — close widget for internal paths, open new tab for external
  const handleLinkNavigate = (href: string) => {
    if (href.startsWith('/')) {
      setIsOpen(false);
      navigate(href);
    } else {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: 'user', content: text };

    // Full history including the new user message
    const history: Message[] = [...messages, userMsg];

    setMessages(history);
    setInput('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('accessToken');

      // Strip any assistant message that leads the array — Anthropic requires
      // the first message to be from the user.
      const firstUserIdx = history.findIndex(m => m.role === 'user');
      const apiMessages = history
        .slice(firstUserIdx)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch(`${API_BASE}/jess/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages:    apiMessages,
          pageContext: window.location.pathname,
        }),
      });

      const data = await res.json();

      const reply: Message = {
        role:    'assistant',
        content: data?.data?.message ?? "Hmm, I'm having a little trouble connecting right now 😅 Give me a moment and try again!",
        links:   data?.data?.links ?? [],
      };

      setMessages(prev => [...prev, reply]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role:    'assistant',
          content: "Hmm, I'm having a little trouble connecting right now 😅 Give me a moment and try again!",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* ── Chat Panel ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2 }}
            style={{ transformOrigin: 'bottom right' }}
            className="fixed bottom-24 right-4 md:right-6 z-50 w-80 md:w-96 bg-white border border-border rounded-md shadow-xl"
          >
            {/* Header */}
            <div className="bg-dark px-4 py-3 rounded-t-md flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-gold rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="font-serif text-dark text-sm font-semibold">J</span>
                </div>
                <div>
                  <p className="font-sans text-sm font-semibold text-white leading-none">Jess</p>
                  <p className="font-sans text-xs text-white/50 mt-0.5">AI Event Planner</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/50 hover:text-white transition-colors focus:outline-none p-1"
                aria-label="Close"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            {/* Messages */}
            <div className="h-80 overflow-y-auto px-4 py-4 flex flex-col gap-3">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-md px-3 py-2 text-sm font-sans leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gold/10 text-dark'
                        : 'bg-bg text-charcoal'
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Link pills — only for Jess messages with links */}
                  {msg.role === 'assistant' && msg.links && msg.links.length > 0 && (
                    <LinkPills links={msg.links} onNavigate={handleLinkNavigate} />
                  )}
                </motion.div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <TypingDots />
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border px-3 py-3 flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                placeholder="Ask Jess anything…"
                className="flex-1 text-sm font-sans border border-border rounded-md px-3 py-2
                           focus:outline-none focus:border-gold transition-colors disabled:opacity-50 bg-white"
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="bg-gold text-dark px-3 py-2 rounded-md hover:bg-gold-dark
                           transition-colors disabled:opacity-40 focus:outline-none flex-shrink-0"
                aria-label="Send"
              >
                <Send size={14} strokeWidth={2} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating Button ──────────────────────────────────────────────────── */}
      <button
        onClick={toggle}
        className={`fixed bottom-4 right-4 md:right-6 z-50 w-14 h-14 bg-dark rounded-full shadow-lg
          flex items-center justify-center
          hover:bg-charcoal transition-colors duration-200 focus:outline-none
          ${isOpen ? 'bg-charcoal' : ''}`}
        aria-label={isOpen ? 'Close Jess' : 'Chat with Jess'}
      >
        {isOpen ? (
          <X size={20} strokeWidth={2} className="text-gold" />
        ) : (
          <>
            {!hasOpened && (
              <span className="absolute top-1 right-1 w-3 h-3 bg-gold rounded-full border-2 border-dark" />
            )}
            <Sparkles size={20} strokeWidth={1.5} className="text-gold" />
          </>
        )}
      </button>
    </>
  );
}
