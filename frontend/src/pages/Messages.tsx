import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Send } from 'lucide-react';
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
                      className={`w-full text-left px-4 py-4 flex items-start gap-3 border-b border-border transition-colors hover:bg-bg ${
                        isActive ? 'border-l-2 border-l-gold bg-bg' : 'border-l-2 border-l-transparent'
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
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gold text-dark text-xs font-sans font-bold flex items-center justify-center">
                              {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                            </span>
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
                    <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
                      {loadingMsgs && messages.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-4 border-gold border-t-transparent" />
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <p className="font-sans text-sm text-muted">
                            No messages yet. Say hello!
                          </p>
                        </div>
                      ) : (
                        messages.map(msg => {
                          const isOwn = msg.senderId === user?.id;
                          return (
                            <div
                              key={msg.id}
                              className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[70%] px-4 py-2.5 rounded-md ${
                                  isOwn
                                    ? 'bg-gold/10'
                                    : 'bg-white border border-border'
                                }`}
                              >
                                <p className="font-sans text-sm text-charcoal leading-relaxed">
                                  {msg.content}
                                </p>
                                <p className="font-sans text-xs text-muted mt-1">
                                  {format(new Date(msg.createdAt), 'h:mm a')}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Input area */}
                    <div className="px-5 py-4 border-t border-border flex items-center gap-3">
                      <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message…"
                        className="flex-1 border border-border rounded-md px-4 py-2.5 font-sans text-sm text-charcoal focus:outline-none focus:border-gold bg-white"
                      />
                      <button
                        onClick={handleSend}
                        disabled={!input.trim() || sending}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-md font-sans text-sm font-medium transition-opacity disabled:opacity-40"
                        style={{ backgroundColor: '#C4A06A', color: '#1A1714' }}
                      >
                        <Send className="w-4 h-4" />
                        Send
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
