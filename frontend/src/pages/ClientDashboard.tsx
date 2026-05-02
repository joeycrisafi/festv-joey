import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PortfolioCard, { type PortfolioPostData } from '../components/PortfolioCard';
import { format, differenceInDays, parseISO } from 'date-fns';
import {
  Search,
  Calendar,
  BookOpen,
  CheckCircle,
  Inbox,
  Heart,
  ChevronRight,
  CalendarPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { eventRequestsApi, quotesApi, bookingsApi, apiFetch, eventsApi, favoritesApi } from '../utils/api';
import { ProviderTypeBadge } from '../components/ProviderTypeBadge';

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProviderInfo {
  id: string;
  businessName: string;
  primaryType?: string;
  city?: string;
  province?: string;
}

interface PackageInfo {
  id: string;
  name: string;
  category?: string;
}

interface EventRequestItem {
  id: string;
  eventType: string;
  eventDate: string;
  guestCount: number;
  status: 'PENDING' | 'QUOTE_SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  calculatedEstimate?: number;
  providerProfile?: ProviderInfo;
  package?: PackageInfo;
  quotes?: { id: string }[];
}

interface QuoteItem {
  id: string;
  eventType: string;
  eventDate: string;
  guestCount: number;
  total: number;
  depositAmount: number;
  expiresAt?: string;
  status: string;
  providerProfile?: ProviderInfo;
  package?: PackageInfo;
  booking?: { id: string };
}

interface BookingItem {
  id: string;
  eventType: string;
  eventDate: string;
  guestCount: number;
  total: number;
  status: 'PENDING_DEPOSIT' | 'DEPOSIT_PAID' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'DISPUTED' | 'PENDING_REVIEW';
  providerProfile?: ProviderInfo;
  package?: PackageInfo;
}

interface FavoriteItem {
  id: string;
  providerId: string;
  providerProfile?: ProviderInfo;
}

interface EventItem {
  id: string;
  name: string;
  eventType: string;
  eventDate: string;
  guestCount: number;
  status: string;
  _count: { requests: number };
  requests: { status: string }[];
}

// ─── Status badge configs ─────────────────────────────────────────────────────

const REQUEST_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:    { label: 'Pending',     cls: 'bg-gold/10 text-gold-dark border border-gold/30' },
  QUOTE_SENT: { label: 'Quote Sent',  cls: 'bg-green/10 text-green border border-green/30' },
  ACCEPTED:   { label: 'Accepted',    cls: 'bg-charcoal/10 text-charcoal border border-charcoal/20' },
  DECLINED:   { label: 'Declined',    cls: 'bg-red/10 text-red border border-red/30' },
  EXPIRED:    { label: 'Expired',     cls: 'bg-muted/10 text-muted border border-muted/20' },
};

const BOOKING_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING_DEPOSIT: { label: 'Deposit Pending', cls: 'bg-gold/10 text-gold-dark border border-gold/30' },
  DEPOSIT_PAID:    { label: 'Deposit Paid',    cls: 'bg-charcoal/10 text-charcoal border border-charcoal/20' },
  CONFIRMED:       { label: 'Confirmed',       cls: 'bg-green/10 text-green border border-green/30' },
  IN_PROGRESS:     { label: 'In Progress',     cls: 'bg-green/10 text-green border border-green/30' },
  COMPLETED:       { label: 'Completed',       cls: 'bg-charcoal/10 text-charcoal border border-charcoal/20' },
  CANCELLED:       { label: 'Cancelled',       cls: 'bg-red/10 text-red border border-red/30' },
  PENDING_REVIEW:  { label: 'Pending Review',  cls: 'bg-gold/10 text-gold-dark border border-gold/30' },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white border border-border rounded-md p-5 mb-3 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 bg-bg rounded-md flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-bg rounded w-1/2" />
          <div className="h-3 bg-bg rounded w-1/3" />
          <div className="h-3 bg-bg rounded w-1/4" />
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClientDashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [dashTab, setDashTab] = useState<'overview' | 'saved'>('overview');
  const [savedPosts, setSavedPosts] = useState<PortfolioPostData[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedLoaded, setSavedLoaded] = useState(false);

  const [events, setEvents]     = useState<EventItem[]>([]);
  const [requests, setRequests] = useState<EventRequestItem[]>([]);
  const [quotes, setQuotes] = useState<QuoteItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingIds, setAcceptingIds] = useState<Set<string>>(new Set());
  const [decliningIds, setDecliningIds] = useState<Set<string>>(new Set());

  const quotesRef = useRef<HTMLDivElement>(null);
  const requestsRef = useRef<HTMLDivElement>(null);
  const bookingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      const [evtRes, reqRes, bkRes, qtRes, favRes] = await Promise.allSettled([
        eventsApi.getMyEvents(token),
        eventRequestsApi.getMyRequestsAsClient(token),
        bookingsApi.getMyBookingsAsClient(token),
        quotesApi.getMyQuotesAsClient(token),
        apiFetch('/favorites', { token }),
      ]);

      if (evtRes.status === 'fulfilled') {
        const d = evtRes.value as any;
        const arr = d?.data ?? [];
        setEvents(Array.isArray(arr) ? arr : []);
      }

      if (reqRes.status === 'fulfilled') {
        const d = reqRes.value as any;
        const arr = d?.data ?? d?.eventRequests ?? [];
        setRequests(Array.isArray(arr) ? arr : []);
      }

      if (bkRes.status === 'fulfilled') {
        const d = bkRes.value as any;
        const arr = d?.data ?? d?.bookings ?? [];
        setBookings(Array.isArray(arr) ? arr : []);
      }

      if (qtRes.status === 'fulfilled') {
        const d = qtRes.value as any;
        const arr: QuoteItem[] = d?.data ?? d?.quotes ?? [];
        // Only show quotes awaiting response
        setQuotes(
          (Array.isArray(arr) ? arr : []).filter(
            (q) => q.status === 'SENT' || q.status === 'PENDING'
          )
        );
      }

      if (favRes.status === 'fulfilled') {
        const d = favRes.value as any;
        const arr = d?.data?.favorites ?? d?.data ?? d?.favorites ?? [];
        setFavorites(Array.isArray(arr) ? arr : []);
      }

      setLoading(false);
    };

    load();
  }, [token]);

  // ── Saved posts ─────────────────────────────────────────────────────────────
  const fetchSavedPosts = useCallback(async () => {
    if (!token || savedLoaded) return;
    setSavedLoading(true);
    try {
      const res = await fetch('/api/v1/portfolio/saved', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setSavedPosts(d?.data?.posts ?? []);
        setSavedLoaded(true);
      }
    } catch {
      // silent
    } finally {
      setSavedLoading(false);
    }
  }, [token, savedLoaded]);

  const handleTabChange = (tab: 'overview' | 'saved') => {
    setDashTab(tab);
    if (tab === 'saved') fetchSavedPosts();
  };

  // ── Accept quote ────────────────────────────────────────────────────────────
  const handleAccept = async (quoteId: string) => {
    if (!token) return;
    setAcceptingIds((s) => new Set(s).add(quoteId));
    try {
      const res = await quotesApi.accept(quoteId, token);
      const data = res as any;
      const bookingId = data?.data?.id ?? data?.booking?.id ?? data?.id;
      setQuotes((prev) => prev.filter((q) => q.id !== quoteId));
      if (bookingId) navigate(`/bookings/${bookingId}`);
    } catch {
      // silently fail — quote stays in list
    } finally {
      setAcceptingIds((s) => {
        const next = new Set(s);
        next.delete(quoteId);
        return next;
      });
    }
  };

  // ── Decline quote ───────────────────────────────────────────────────────────
  const handleDecline = async (quoteId: string) => {
    if (!token) return;
    setDecliningIds((s) => new Set(s).add(quoteId));
    try {
      await quotesApi.reject(quoteId, token);
      setQuotes((prev) => prev.filter((q) => q.id !== quoteId));
    } catch {
      // silently fail
    } finally {
      setDecliningIds((s) => {
        const next = new Set(s);
        next.delete(quoteId);
        return next;
      });
    }
  };

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const upcomingBookings = bookings.filter((b) =>
    ['PENDING_DEPOSIT', 'DEPOSIT_PAID', 'CONFIRMED', 'IN_PROGRESS', 'PENDING_REVIEW'].includes(b.status)
  );

  const handleUnsave = async (providerId: string) => {
    if (!token) return;
    setFavorites(prev => prev.filter(f => f.providerId !== providerId));
    try {
      await favoritesApi.removeFavorite(providerId, token);
    } catch {
      // Revert on error
      apiFetch<any>('/favorites', { token }).then((res: any) => {
        const arr = res?.data?.favorites ?? res?.data ?? res?.favorites ?? [];
        if (Array.isArray(arr)) setFavorites(arr);
      }).catch(() => {});
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg px-6 md:px-12 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-10">
        <div>
          <h1 className="font-serif text-3xl text-dark">
            {greeting()}{user?.firstName ? `, ${user.firstName}` : ''}
          </h1>
          <p className="font-sans text-sm text-muted mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <Link
          to="/providers"
          className="inline-flex items-center gap-2 bg-gold text-dark font-sans text-xs font-bold uppercase tracking-widest px-6 py-2.5 rounded-md hover:bg-gold-dark transition-colors"
        >
          <Search size={14} strokeWidth={2} />
          Browse Vendors
        </Link>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-6 mb-8 border-b border-border">
        {(['overview', 'saved'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className="font-sans pb-3 transition-colors focus:outline-none"
            style={{
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: dashTab === tab ? '#1A1714' : '#7A7068',
              borderBottom: dashTab === tab ? '2px solid #C4A06A' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {tab === 'overview' ? 'Overview' : 'Saved Posts'}
          </button>
        ))}
      </div>

      {/* Saved posts tab */}
      {dashTab === 'saved' && (
        <div>
          {savedLoading ? (
            <div className="columns-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="break-inside-avoid mb-4 bg-white border border-border rounded-md overflow-hidden animate-pulse">
                  <div style={{ height: 140, background: '#E8E0D4' }} />
                  <div className="p-3.5 space-y-2">
                    <div className="h-3 bg-bg rounded w-1/2" />
                    <div className="h-3 bg-bg rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : savedPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: 18, fontStyle: 'italic', color: '#7A7068' }}>
                Posts you save will appear here.
              </p>
              <Link
                to="/feed"
                className="font-sans text-xs text-gold hover:text-gold-dark font-semibold mt-4 transition-colors"
              >
                Browse the Feed →
              </Link>
            </div>
          ) : (
            <div className="columns-2 gap-4">
              {savedPosts.map(post => (
                <div key={post.id} className="break-inside-avoid mb-4">
                  <PortfolioCard
                    post={post}
                    token={token}
                    onSaveChange={(id, saved) => {
                      if (!saved) setSavedPosts(prev => prev.filter(p => p.id !== id));
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Two-column grid */}
      {dashTab === 'overview' && <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-10">

          {/* SECTION 0 — MY EVENTS */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="font-sans text-xs font-bold uppercase tracking-widest text-charcoal">
                My Events
              </p>
              <Link
                to="/events/new"
                className="bg-gold text-dark font-sans text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-md hover:bg-gold-dark transition-colors flex items-center gap-1.5"
              >
                <CalendarPlus size={12} strokeWidth={2} />
                Plan a New Event
              </Link>
            </div>

            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : events.length === 0 ? (
              <div className="bg-white border border-border rounded-md p-8 flex flex-col items-center gap-3 text-center">
                <CalendarPlus size={32} strokeWidth={1} className="text-muted" />
                <p className="font-serif text-lg text-muted">No events yet</p>
                <p className="font-sans text-xs text-muted mb-2">
                  Start planning your next event and find the perfect vendors.
                </p>
                <Link
                  to="/events/new"
                  className="bg-gold text-dark font-sans text-xs font-bold uppercase tracking-widest px-5 py-2 rounded-md hover:bg-gold-dark transition-colors"
                >
                  Plan Your First Event
                </Link>
              </div>
            ) : (
              events.map((evt, i) => {
                const bookedCount = evt.requests.filter(r => r.status === 'ACCEPTED').length;
                const totalVendors = evt._count.requests;
                const eventTypeLabel = evt.eventType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

                return (
                  <motion.div
                    key={evt.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 4) * 0.07, duration: 0.4 }}
                  >
                  <div className="bg-white border border-gold/20 rounded-md p-5 mb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-serif text-xl text-dark truncate">{evt.name}</p>
                        <p className="font-sans text-xs text-muted mt-0.5">
                          {eventTypeLabel}
                          {evt.eventDate ? ` · ${format(parseISO(evt.eventDate), 'MMM d, yyyy')}` : ''}
                          {` · ${evt.guestCount} guests`}
                        </p>
                        {totalVendors > 0 && (
                          <p className="font-sans text-xs text-muted mt-1">
                            {bookedCount} of {totalVendors} vendor{totalVendors !== 1 ? 's' : ''} booked
                          </p>
                        )}
                      </div>
                      <Link
                        to={`/events/${evt.id}`}
                        className="font-sans text-xs text-gold hover:text-gold-dark font-semibold transition-colors flex-shrink-0 flex items-center gap-1"
                      >
                        View Event <ChevronRight size={12} />
                      </Link>
                    </div>
                  </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* SECTION 1 — QUOTES AWAITING RESPONSE */}
          <div ref={quotesRef}>
            <p className="font-sans text-xs font-bold uppercase tracking-widest text-charcoal mb-4">
              Quotes Awaiting Response
            </p>

            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : quotes.length === 0 ? (
              <div className="bg-white border border-border rounded-md p-8 flex flex-col items-center gap-3 text-center">
                <CheckCircle size={32} strokeWidth={1} className="text-muted" />
                <p className="font-serif text-lg text-muted">You're all caught up</p>
                <p className="font-sans text-xs text-muted">No quotes waiting for a response.</p>
              </div>
            ) : (
              quotes.map((quote, i) => {
                const daysLeft = quote.expiresAt
                  ? differenceInDays(parseISO(quote.expiresAt), new Date())
                  : null;
                const isAccepting = acceptingIds.has(quote.id);
                const isDeclining = decliningIds.has(quote.id);
                const busy = isAccepting || isDeclining;

                return (
                  <motion.div
                    key={quote.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 4) * 0.07, duration: 0.4 }}
                  >
                  <div
                    className="bg-white border border-gold/30 rounded-md p-5 mb-3"
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-sans text-sm font-semibold text-dark">
                            {quote.providerProfile?.businessName ?? 'Vendor'}
                          </span>
                          {quote.providerProfile?.primaryType && (
                            <ProviderTypeBadge type={quote.providerProfile.primaryType} size="sm" />
                          )}
                        </div>
                        <p className="font-sans text-xs text-muted">
                          {quote.eventType?.replace(/_/g, ' ')} ·{' '}
                          {quote.eventDate
                            ? format(parseISO(quote.eventDate), 'MMM d, yyyy')
                            : '—'}
                        </p>
                        {quote.package?.name && (
                          <p className="font-sans text-xs text-muted mt-0.5">
                            {quote.package.name}
                          </p>
                        )}
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="font-serif text-2xl text-dark">{fmt(quote.total)}</p>
                        <p className="font-sans text-xs text-muted">
                          Deposit: {fmt(quote.depositAmount)}
                        </p>
                      </div>
                    </div>

                    {daysLeft !== null && (
                      <p
                        className={`font-sans text-xs mb-4 ${
                          daysLeft < 3 ? 'text-red font-semibold' : 'text-muted'
                        }`}
                      >
                        {daysLeft <= 0
                          ? 'Expired'
                          : `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
                      </p>
                    )}

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleAccept(quote.id)}
                        disabled={busy}
                        className="bg-gold text-dark font-sans text-xs font-bold uppercase tracking-widest px-5 py-2 rounded-md hover:bg-gold-dark transition-colors disabled:opacity-50"
                      >
                        {isAccepting ? 'Accepting…' : 'Accept & Pay Deposit'}
                      </button>
                      <button
                        onClick={() => handleDecline(quote.id)}
                        disabled={busy}
                        className="font-sans text-xs text-muted hover:text-charcoal transition-colors disabled:opacity-50"
                      >
                        {isDeclining ? 'Declining…' : 'Decline'}
                      </button>
                    </div>
                  </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* SECTION 2 — MY REQUESTS */}
          <div ref={requestsRef}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-sans text-xs font-bold uppercase tracking-widest text-charcoal">
                My Requests
              </p>
              <Link
                to="/providers"
                className="font-sans text-xs text-gold hover:text-gold-dark transition-colors font-semibold"
              >
                + New Request
              </Link>
            </div>

            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : requests.length === 0 ? (
              <div className="bg-white border border-border rounded-md p-8 flex flex-col items-center gap-3 text-center">
                <Inbox size={32} strokeWidth={1} className="text-muted" />
                <p className="font-serif text-lg text-muted">No requests yet</p>
                <p className="font-sans text-xs text-muted mb-2">
                  Browse vendors and send your first request.
                </p>
                <Link
                  to="/providers"
                  className="bg-gold text-dark font-sans text-xs font-bold uppercase tracking-widest px-5 py-2 rounded-md hover:bg-gold-dark transition-colors"
                >
                  Browse Vendors
                </Link>
              </div>
            ) : (
              requests.map((req, i) => {
                const badge = REQUEST_STATUS[req.status] ?? {
                  label: req.status,
                  cls: 'bg-muted/10 text-muted border border-muted/20',
                };
                return (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 4) * 0.07, duration: 0.4 }}
                  >
                  <div
                    className="bg-white border border-border rounded-md p-5 mb-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span
                            className={`font-sans text-xs px-2.5 py-0.5 rounded-md ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                          <span className="font-sans text-xs text-muted">
                            {req.eventType?.replace(/_/g, ' ')}
                          </span>
                          {req.eventDate && (
                            <span className="font-sans text-xs text-muted">
                              · {format(parseISO(req.eventDate), 'MMM d, yyyy')}
                            </span>
                          )}
                        </div>

                        <p className="font-sans text-sm text-charcoal">
                          {req.providerProfile?.businessName ?? 'Vendor TBD'}
                          {req.package?.name ? ` — ${req.package.name}` : ''}
                        </p>

                        <p className="font-sans text-xs text-muted mt-0.5">
                          {req.guestCount} guests
                        </p>

                        {req.calculatedEstimate != null && (
                          <p className="font-serif text-lg text-dark mt-1">
                            {fmt(req.calculatedEstimate)}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        {req.status === 'QUOTE_SENT' && (req.quotes?.length ?? 0) > 0 && (
                          <Link
                            to={`/event-requests/${req.id}`}
                            className="font-sans text-xs text-gold hover:text-gold-dark font-semibold flex items-center gap-1"
                          >
                            View Quote <ChevronRight size={12} />
                          </Link>
                        )}
                        <Link
                          to={`/event-requests/${req.id}`}
                          className="font-sans text-xs text-muted hover:text-charcoal transition-colors"
                        >
                          Details →
                        </Link>
                      </div>
                    </div>
                  </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* SECTION 3 — UPCOMING BOOKINGS */}
          <div ref={bookingsRef}>
            <p className="font-sans text-xs font-bold uppercase tracking-widest text-charcoal mb-4">
              Upcoming Bookings
            </p>

            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : upcomingBookings.length === 0 ? (
              <div className="bg-white border border-border rounded-md p-8 flex flex-col items-center gap-3 text-center">
                <BookOpen size={32} strokeWidth={1} className="text-muted" />
                <p className="font-serif text-lg text-muted">No upcoming bookings</p>
                <p className="font-sans text-xs text-muted">
                  Accept a quote to create your first booking.
                </p>
              </div>
            ) : (
              upcomingBookings.map((booking, i) => {
                const badge = BOOKING_STATUS[booking.status] ?? {
                  label: booking.status.replace(/_/g, ' '),
                  cls: 'bg-muted/10 text-muted border border-muted/20',
                };
                const date = booking.eventDate ? parseISO(booking.eventDate) : null;

                return (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 4) * 0.07, duration: 0.4 }}
                  >
                  <Link
                    to={`/bookings/${booking.id}`}
                    className="bg-white border border-border rounded-md p-5 mb-3 flex items-start gap-4 hover:border-gold/30 transition-colors group"
                  >
                    {/* Date block */}
                    {date && (
                      <div className="bg-gold/10 rounded-md p-3 w-14 flex-shrink-0 text-center">
                        <p className="font-serif text-2xl text-gold-dark leading-none">
                          {format(date, 'd')}
                        </p>
                        <p className="font-sans text-xs uppercase text-gold-dark tracking-widest mt-0.5">
                          {format(date, 'MMM')}
                        </p>
                      </div>
                    )}

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-sans text-sm font-semibold text-dark group-hover:text-gold-dark transition-colors">
                          {booking.providerProfile?.businessName ?? 'Vendor'}
                        </span>
                        {booking.providerProfile?.primaryType && (
                          <ProviderTypeBadge type={booking.providerProfile.primaryType} size="sm" />
                        )}
                      </div>
                      <p className="font-sans text-xs text-muted">
                        {booking.eventType?.replace(/_/g, ' ')}
                        {booking.package?.name ? ` · ${booking.package.name}` : ''}
                        {` · ${booking.guestCount} guests`}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`font-sans text-xs px-2.5 py-0.5 rounded-md ${badge.cls}`}>
                          {badge.label}
                        </span>
                        <span className="font-serif text-lg text-dark">
                          {fmt(booking.total)}
                        </span>
                      </div>
                    </div>

                    <ChevronRight size={16} className="text-muted flex-shrink-0 mt-1 group-hover:text-gold-dark transition-colors" />
                  </Link>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-6">

          {/* Quick Actions */}
          <div className="bg-dark rounded-md p-6">
            <p className="font-sans text-xs font-bold uppercase tracking-widest text-white/40 mb-4">
              Quick Actions
            </p>
            <div className="divide-y divide-white/10">
              <Link
                to="/events/new"
                className="flex items-center justify-between py-3 text-white/60 hover:text-gold-light font-sans text-sm transition-colors group"
              >
                <span className="flex items-center gap-2">
                  <CalendarPlus size={14} strokeWidth={1.5} />
                  Plan an Event
                </span>
                <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
              <Link
                to="/providers"
                className="flex items-center justify-between py-3 text-white/60 hover:text-gold-light font-sans text-sm transition-colors group"
              >
                <span className="flex items-center gap-2">
                  <Search size={14} strokeWidth={1.5} />
                  Browse Vendors
                </span>
                <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
              <button
                onClick={() => scrollTo(requestsRef)}
                className="w-full flex items-center justify-between py-3 text-white/60 hover:text-gold-light font-sans text-sm transition-colors group"
              >
                <span className="flex items-center gap-2">
                  <Inbox size={14} strokeWidth={1.5} />
                  My Requests
                </span>
                <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              <button
                onClick={() => scrollTo(bookingsRef)}
                className="w-full flex items-center justify-between py-3 text-white/60 hover:text-gold-light font-sans text-sm transition-colors group"
              >
                <span className="flex items-center gap-2">
                  <Calendar size={14} strokeWidth={1.5} />
                  My Bookings
                </span>
                <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          </div>

          {/* Saved Vendors */}
          <div className="bg-white border border-border rounded-md p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="font-sans text-xs font-bold uppercase tracking-widest text-charcoal">
                Saved Vendors
              </p>
              <Heart size={14} strokeWidth={1.5} className="text-muted" />
            </div>

            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="animate-pulse flex items-center justify-between">
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3 bg-bg rounded w-2/3" />
                      <div className="h-3 bg-bg rounded w-1/3" />
                    </div>
                    <div className="h-3 bg-bg rounded w-8" />
                  </div>
                ))}
              </div>
            ) : favorites.length === 0 ? (
              <div className="text-center py-4">
                <p className="font-sans text-xs text-muted">No saved vendors yet</p>
                <Link
                  to="/providers"
                  className="font-sans text-xs text-gold hover:text-gold-dark font-semibold mt-2 inline-block transition-colors"
                >
                  Browse Vendors →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {favorites.slice(0, 5).map((fav) => {
                  const p = fav.providerProfile;
                  if (!p) return null;
                  const initials = p.businessName.trim().split(/\s+/).length >= 2
                    ? (p.businessName.trim().split(/\s+/)[0][0] + p.businessName.trim().split(/\s+/).slice(-1)[0][0]).toUpperCase()
                    : p.businessName.slice(0, 2).toUpperCase();
                  return (
                    <div key={fav.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
                        style={{ background: 'rgba(196,160,106,0.12)' }}>
                        <span className="font-serif text-xs text-gold">{initials}</span>
                      </div>
                      <Link to={`/providers/${fav.providerId}`} className="flex-1 min-w-0 hover:text-gold-dark transition-colors">
                        <p className="font-sans text-sm text-charcoal truncate">{p.businessName}</p>
                        {p.city && (
                          <p className="font-sans text-xs text-muted truncate">{p.city}</p>
                        )}
                      </Link>
                      <button
                        onClick={() => handleUnsave(fav.providerId)}
                        className="text-muted hover:text-red transition-colors flex-shrink-0 focus:outline-none"
                        aria-label="Remove from saved"
                      >
                        <span className="font-sans text-sm leading-none">×</span>
                      </button>
                    </div>
                  );
                })}
                {favorites.length > 5 && (
                  <p className="font-sans text-xs text-muted pt-1">
                    +{favorites.length - 5} more saved
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>}
    </div>
  );
}
