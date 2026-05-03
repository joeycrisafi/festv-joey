import { Fragment, useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useAuth } from '../context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConversationUser {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

interface Conversation {
  id: string;
  participants: string[];
  lastMessageAt: string | null;
  messages: {
    id: string;
    content: string;
    createdAt: string;
    senderId: string;
    isRead: boolean;
  }[];
  otherUser: ConversationUser | null;
  unreadCount: number;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender: ConversationUser;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isSameDay = (a: string, b: string) =>
  new Date(a).toDateString() === new Date(b).toDateString();

const formatDateLabel = (dateStr: string) => {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return format(d, 'EEEE, MMMM d');
};

function getInitials(user: ConversationUser | null) {
  if (!user) return '?';
  return `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();
}

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60 * 60 * 1000) return formatDistanceToNow(d, { addSuffix: true });
  if (diffMs < 24 * 60 * 60 * 1000) return format(d, 'h:mm a');
  return format(d, 'MMM d');
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Messages() {
  const { user } = useAuth();
  const token = localStorage.getItem('accessToken');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConversation = conversations.find(c => c.id === activeId) ?? null;

  // ── Fetch conversations ──────────────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/messages/conversations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const d = await res.json();
      setConversations(d?.data?.conversations ?? []);
    } catch {
      // silent
    } finally {
      setLoadingConvs(false);
    }
  }, [token]);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 15000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // ── Fetch messages for active conversation ───────────────────────────────

  const fetchMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/v1/messages/conversations/${convId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const d = await res.json();
      setMessages(d?.data?.messages ?? []);
    } catch {
      // silent
    } finally {
      setLoadingMsgs(false);
    }
  }, [token]);

  // Mark as read + fetch on conversation open
  const openConversation = useCallback(async (convId: string) => {
    setActiveId(convId);
    await fetchMessages(convId);
    // Mark as read
    fetch(`/api/v1/messages/conversations/${convId}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
    // Clear local unread badge
    setConversations(prev =>
      prev.map(c => c.id === convId ? { ...c, unreadCount: 0 } : c)
    );
  }, [fetchMessages, token]);

  // Poll messages every 15s when a conversation is open
  useEffect(() => {
    if (!activeId) return;
    const interval = setInterval(() => fetchMessages(activeId), 15000);
    return () => clearInterval(interval);
  }, [activeId, fetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send message ─────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!input.trim() || !activeId || sending) return;
    const recipientId = activeConversation?.otherUser?.id;
    if (!recipientId) return;
    setSending(true);
    const content = input.trim();
    setInput('');
    try {
      const res = await fetch(`/api/v1/messages/conversations/${activeId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content, recipientId }),
      });
      if (res.ok) {
        await fetchMessages(activeId);
        await fetchConversations();
      }
    } catch {
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg">
      {/* Page header */}
      <div className="bg-white border-b border-border">
        <div className="section-padding py-6">
          <h1 className="font-serif text-2xl text-dark">Messages</h1>
        </div>
      </div>

      <div className="section-padding py-6">
        {loadingConvs ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-gold border-t-transparent" />
          </div>
        ) : conversations.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <MessageSquare className="w-12 h-12 text-muted mb-4" />
            <h2 className="font-serif text-xl text-dark mb-2">No messages yet</h2>
            <p className="font-sans text-sm text-muted mb-6">
              Send a request to a vendor to start a conversation.
            </p>
            <Link to="/providers" className="btn-primary text-xs uppercase tracking-widest">
              Browse Vendors
            </Link>
          </div>
        ) : (
          /* Two-column layout */
          <div
            className="bg-white border border-border rounded-md overflow-hidden"
            style={{ height: 'calc(100vh - 220px)', minHeight: 500 }}
          >
            <div className="flex h-full">

              {/* ── Conversation list ────────────────────────────────── */}
              <div
                className={`
                  flex-shrink-0 border-r border-border overflow-y-auto
                  ${activeId ? 'hidden md:flex md:flex-col' : 'flex flex-col w-full md:w-80'}
                  md:w-80
                `}
              >
                <div className="px-4 py-3 border-b border-border">
                  <p className="font-sans text-xs font-bold uppercase tracking-widest text-muted">
                    Conversations
                  </p>
                </div>

                {conversations.map(conv => {
                  const other = conv.otherUser;
                  const lastMsg = conv.messages[0];
                  const isActive = conv.id === activeId;

                  return (
                    <button
                      key={conv.id}
                      onClick={() => openConversation(conv.id)}
                      className={`w-full text-left px-4 py-4 flex items-start gap-3 border-b border-border transition-colors hover:bg-white ${
                        isActive ? 'border-l-2 border-l-gold bg-white' : 'border-l-2 border-l-transparent'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gold flex items-center justify-center">
                        {other?.avatarUrl ? (
                          <img src={other.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <span className="font-sans font-semibold text-sm text-dark">
                            {getInitials(other)}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-sans font-semibold text-sm text-dark truncate">
                            {other ? `${other.firstName} ${other.lastName}` : 'Unknown'}
                          </p>
                          {lastMsg && (
                            <p className="font-sans text-xs text-muted flex-shrink-0">
                              {formatTimestamp(lastMsg.createdAt)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="font-sans text-xs text-muted truncate">
                            {lastMsg
                              ? `${lastMsg.senderId === user?.id ? 'You: ' : ''}${lastMsg.content}`
                              : 'No messages yet'}
                          </p>
                          {conv.unreadCount > 0 && (
                            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#C4A06A]" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* ── Message thread ───────────────────────────────────── */}
              <div className={`flex-1 flex flex-col min-w-0 ${!activeId ? 'hidden md:flex' : 'flex'}`}>
                {activeConversation ? (
                  <>
                    {/* Thread header */}
                    <div className="px-5 py-4 border-b border-border flex items-center gap-3">
                      {/* Back button on mobile */}
                      <button
                        className="md:hidden mr-1 text-muted hover:text-charcoal"
                        onClick={() => setActiveId(null)}
                      >
                        ←
                      </button>

                      <div className="w-9 h-9 rounded-full bg-gold flex items-center justify-center flex-shrink-0">
                        {activeConversation.otherUser?.avatarUrl ? (
                          <img
                            src={activeConversation.otherUser.avatarUrl}
                            alt=""
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span className="font-sans font-semibold text-sm text-dark">
                            {getInitials(activeConversation.otherUser)}
                          </span>
                        )}
                      </div>

                      <div>
                        <p className="font-sans font-semibold text-sm text-dark">
                          {activeConversation.otherUser
                            ? `${activeConversation.otherUser.firstName} ${activeConversation.otherUser.lastName}`
                            : 'Unknown'}
                        </p>
                      </div>
                    </div>

                    {/* Messages area */}
                    <div
                      className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3"
                      style={{
                        backgroundColor: '#F5F3EF',
                        backgroundImage: 'radial-gradient(#E2DDD6 1px, transparent 1px)',
                        backgroundSize: '20px 20px',
                      }}
                    >
                      {loadingMsgs && messages.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-4 border-gold border-t-transparent" />
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
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
                                <div className="flex gap-2 items-end justify-end flex-row-reverse">
                                  <div
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-medium flex-shrink-0"
                                    style={{ background: 'rgba(196,160,106,0.15)', color: '#9A7A4A', border: '0.5px solid rgba(196,160,106,0.3)' }}
                                  >
                                    {user?.firstName?.[0]}{user?.lastName?.[0]}
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
                                <div className="flex gap-2 items-end justify-start">
                                  <div className="w-6 h-6 rounded-full bg-[#F5F3EF] border border-border flex items-center justify-center text-[9px] font-medium text-[#7A7068] flex-shrink-0">
                                    {activeConversation?.otherUser?.firstName?.[0]}{activeConversation?.otherUser?.lastName?.[0]}
                                  </div>
                                  <div className="flex flex-col max-w-[65%]">
                                    <div
                                      className="px-4 py-2.5 rounded-xl rounded-tl-none bg-white text-[#3A3530] text-[13px] leading-relaxed"
                                      style={{ borderLeft: '2px solid rgba(196,160,106,0.4)', borderTop: '0.5px solid #E2DDD6', borderRight: '0.5px solid #E2DDD6', borderBottom: '0.5px solid #E2DDD6' }}
                                    >
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
                    <div className="px-4 py-3 border-t border-border bg-white flex gap-3 items-center">
                      <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Write a message…"
                        className="flex-1 bg-[#F5F3EF] border border-border rounded-md px-4 py-2.5 font-sans text-[13px] text-[#3A3530] focus:outline-none focus:border-[#C4A06A]"
                      />
                      <button
                        onClick={handleSend}
                        disabled={!input.trim() || sending}
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
                  </>
                ) : (
                  /* No conversation selected (desktop) */
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <MessageSquare className="w-10 h-10 text-muted mb-3" />
                    <p className="font-sans text-sm text-muted">
                      Select a conversation to start messaging
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
