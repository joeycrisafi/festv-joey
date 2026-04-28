import { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1';

const WELCOME: Message = {
  role: 'assistant',
  content:
    "Hi! I'm Jess, your FESTV assistant. I can help you find vendors, understand pricing, and plan your event. What can I help you with?",
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

// ── Widget ────────────────────────────────────────────────────────────────────

export default function JessWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom whenever messages change or loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const open = () => {
    setIsOpen(true);
    setHasOpened(true);
  };

  const toggle = () => (isOpen ? setIsOpen(false) : open());

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: 'user', content: text };
    const history = [...messages, userMsg];

    setMessages(history);
    setInput('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE}/jess/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: text,
          conversationHistory: messages, // history before user message, as backend expects
        }),
      });

      const data = await res.json();
      const reply: Message = {
        role: 'assistant',
        content:
          data?.response ??
          data?.data?.response ??
          "Sorry, I'm having trouble connecting. Please try again.",
      };
      setMessages(prev => [...prev, reply]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: "Sorry, I'm having trouble connecting. Please try again.",
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
      <div
        className={`fixed bottom-24 right-4 md:right-6 z-50 w-80 md:w-96 bg-white border border-border rounded-md shadow-xl
          transition-all duration-300 origin-bottom-right
          ${isOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
      >
        {/* Header */}
        <div className="bg-dark px-4 py-3 rounded-t-md flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gold rounded-full flex items-center justify-center flex-shrink-0">
              <span className="font-serif text-dark text-sm font-semibold">J</span>
            </div>
            <div>
              <p className="font-sans text-sm font-semibold text-white leading-none">Jess</p>
              <p className="font-sans text-xs text-white/50 mt-0.5">AI Assistant</p>
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
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
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
            </div>
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
            className="flex-1 text-sm font-sans border border-border rounded-md px-3 py-2 focus:outline-none focus:border-gold transition-colors disabled:opacity-50 bg-white"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="bg-gold text-dark px-3 py-2 rounded-md hover:bg-gold-dark transition-colors disabled:opacity-40 focus:outline-none flex-shrink-0"
            aria-label="Send"
          >
            <Send size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

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
            {/* Unread dot — shows before first open */}
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
