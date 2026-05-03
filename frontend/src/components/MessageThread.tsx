import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}

interface ConversationResponse {
  success: boolean;
  data: {
    id: string;
    messages: Message[];
  } | null;
}

interface MessagesResponse {
  success: boolean;
  data: {
    messages: Message[];
    pagination: unknown;
  };
}

export interface MessageThreadProps {
  otherUserId: string;
  requestId: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MessageThread({ otherUserId }: MessageThreadProps) {
  const { user, token } = useAuth();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Find conversation on mount ─────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      try {
        const res = await apiFetch<ConversationResponse>(
          `/messages/conversations/by-participants?otherUserId=${otherUserId}`,
          { token: token ?? undefined },
        );
        if (res.data) {
          setConversationId(res.data.id);
          setMessages(res.data.messages ?? []);
          apiFetch(`/messages/conversations/${res.data.id}/read`, {
            method: 'POST',
            token: token ?? undefined,
          }).catch(() => {});
        }
      } catch {
        // silent — empty state will show
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [otherUserId, token]);

  // ── Poll messages every 15s ────────────────────────────────────────────────

  useEffect(() => {
    if (!conversationId) return;
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch<MessagesResponse>(
          `/messages/conversations/${conversationId}/messages`,
          { token: token ?? undefined },
        );
        setMessages(res.data?.messages ?? []);
      } catch {
        // silent
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [conversationId, token]);

  // ── Scroll to bottom ───────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send message ───────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!input.trim() || sending || !conversationId) return;
    setSending(true);
    const content = input.trim();
    setInput('');

    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      content,
      senderId: user!.id,
      createdAt: new Date().toISOString(),
      sender: {
        id: user!.id,
        firstName: (user as any).firstName ?? '',
        lastName: (user as any).lastName ?? '',
        avatarUrl: null,
      },
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      await apiFetch(`/messages/conversations/${conversationId}/messages`, {
        method: 'POST',
        token: token ?? undefined,
        body: JSON.stringify({ content, recipientId: otherUserId }),
      });
      const res = await apiFetch<MessagesResponse>(
        `/messages/conversations/${conversationId}/messages`,
        { token: token ?? undefined },
      );
      setMessages(res.data?.messages ?? []);
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[400px]">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 bg-[#F5F3EF]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-[#C4A06A] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="font-serif italic text-[14px] text-[#7A7068]">
              No messages yet. Say hello!
            </p>
          </div>
        ) : (
          messages.map(msg => {
            const isOwn = msg.senderId === user?.id;
            return (
              <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[70%] px-4 py-2.5 rounded-md ${
                    isOwn
                      ? 'bg-[#1A1714] text-[#F5F3EF]'
                      : 'bg-white border border-border text-[#3A3530]'
                  }`}
                >
                  <p className="font-sans text-[13px] leading-relaxed">{msg.content}</p>
                  <p
                    className={`font-sans text-[10px] mt-1 ${
                      isOwn ? 'text-[rgba(245,243,239,0.6)]' : 'text-[#7A7068]'
                    }`}
                  >
                    {format(new Date(msg.createdAt), 'h:mm a')}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Compose bar */}
      <div className="px-4 py-3 border-t border-border bg-white flex items-center gap-3">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message…"
          className="flex-1 border border-border rounded-md px-3 py-2 font-sans text-[13px] text-[#3A3530] focus:outline-none focus:border-[#C4A06A] bg-[#F5F3EF]"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending || !conversationId}
          className="bg-[#1A1714] text-[#F5F3EF] px-4 py-2 rounded-md font-sans text-[10px] uppercase tracking-widest hover:bg-[#3A3530] disabled:opacity-40 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
