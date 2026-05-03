import { Fragment, useState, useEffect, useRef } from 'react';
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
  otherName?: string;
  otherInitials?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const isSameDay = (a: string, b: string) =>
  new Date(a).toDateString() === new Date(b).toDateString();

const formatDateLabel = (dateStr: string) => {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return format(d, 'EEEE, MMMM d');
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function MessageThread({
  otherUserId,
  otherName,
  otherInitials,
}: MessageThreadProps) {
  const { user, token } = useAuth();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  const ownInitials =
    `${(user as any)?.firstName?.[0] ?? ''}${(user as any)?.lastName?.[0] ?? ''}`.toUpperCase() || '?';

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

  // ── Scroll to bottom only when message count increases ────────────────────

  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

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
    <div className="flex flex-col h-[460px]">

      {/* Thread header */}
      <div className="bg-white border-b border-border px-5 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-[#F5F3EF] border border-border flex items-center justify-center text-[10px] font-medium text-[#7A7068] flex-shrink-0">
          {otherInitials ?? '?'}
        </div>
        <div>
          <p className="font-serif text-[16px] text-[#1A1714]">
            {otherName ?? 'Messages'}
          </p>
        </div>
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3"
        style={{
          backgroundColor: '#F5F3EF',
          backgroundImage: 'radial-gradient(#E2DDD6 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      >
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
          messages.map((msg, i) => {
            const showDate = i === 0 || !isSameDay(messages[i - 1].createdAt, msg.createdAt);
            const isOwn = msg.senderId === user?.id;

            return (
              <Fragment key={msg.id}>
                {showDate && (
                  <div className="flex items-center gap-3 my-1">
                    <div className="flex-1 h-px bg-[#E2DDD6]" />
                    <span className="text-[10px] uppercase tracking-widest text-[#B0A89E]">
                      {formatDateLabel(msg.createdAt)}
                    </span>
                    <div className="flex-1 h-px bg-[#E2DDD6]" />
                  </div>
                )}

                {isOwn ? (
                  <div className="flex gap-2 items-end flex-row-reverse">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-medium flex-shrink-0"
                      style={{
                        background: 'rgba(196,160,106,0.15)',
                        color: '#9A7A4A',
                        border: '0.5px solid rgba(196,160,106,0.3)',
                      }}
                    >
                      {ownInitials}
                    </div>
                    <div className="flex flex-col items-end max-w-[65%]">
                      <div
                        className="px-4 py-2.5 rounded-xl rounded-tr-none text-[13px] leading-relaxed"
                        style={{ background: '#F0EAE0', color: '#1A1714', border: '0.5px solid #E2D5C3' }}
                      >
                        {msg.content}
                      </div>
                      <span className="text-[10px] text-[#B0A89E] mt-1">
                        {format(new Date(msg.createdAt), 'h:mm a')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 items-end">
                    <div className="w-6 h-6 rounded-full bg-[#F5F3EF] border border-border flex items-center justify-center text-[9px] font-medium text-[#7A7068] flex-shrink-0">
                      {otherInitials ?? '?'}
                    </div>
                    <div className="flex flex-col max-w-[65%]">
                      <div className="px-4 py-2.5 rounded-xl rounded-tl-none bg-white border-l-2 border-t border-r border-b text-[13px] text-[#3A3530] leading-relaxed"
                        style={{ borderColor: 'rgba(0,0,0,0.09)', borderLeftColor: 'rgba(196,160,106,0.4)' }}>
                        {msg.content}
                      </div>
                      <span className="text-[10px] text-[#B0A89E] mt-1">
                        {format(new Date(msg.createdAt), 'h:mm a')}
                      </span>
                    </div>
                  </div>
                )}
              </Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Compose bar */}
      <div className="bg-white border-t border-border px-4 py-3 flex gap-3 items-center flex-shrink-0">
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
          placeholder="Write a message…"
          className="flex-1 bg-[#F5F3EF] border border-border rounded-md px-4 py-2.5 font-sans text-[13px] text-[#3A3530] focus:outline-none focus:border-[#C4A06A]"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending || !conversationId}
          className="w-9 h-9 bg-[#1A1714] rounded-md flex items-center justify-center flex-shrink-0 hover:bg-[#C4A06A] transition-colors disabled:opacity-40 group"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            className="stroke-[#F5F3EF] group-hover:stroke-[#1A1714] transition-colors"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
