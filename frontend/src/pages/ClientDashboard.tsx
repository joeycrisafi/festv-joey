import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import PortfolioCard, { type PortfolioPostData } from '../components/PortfolioCard';
import PostComposer from '../components/PostComposer';
import { format, parseISO } from 'date-fns';
import {
  Search,
  Heart,
  ChevronRight,
  CalendarPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { eventRequestsApi, bookingsApi, apiFetch, eventsApi, favoritesApi } from '../utils/api';

// ─── Formatters ───────────────────────────────────────────────────────────────

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
  quotes?: { id: string; status: string }[];
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

  const [dashTab, setDashTab] = useState<'overview' | 'saved' | 'portfolio'>('overview');
  const [savedPosts, setSavedPosts] = useState<PortfolioPostData[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedLoaded, setSavedLoaded] = useState(false);
  const [portfolioPosts, setPortfolioPosts] = useState<PortfolioPostData[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioLoaded, setPortfolioLoaded] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const [events, setEvents]     = useState<EventItem[]>([]);
  const [requests, setRequests] = useState<EventRequestItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [requestFilter, setRequestFilter] = useState<'All' | 'Action Required' | 'Confirmed'>('All');

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      const [evtRes, reqRes, bkRes, favRes] = await Promise.allSettled([
        eventsApi.getMyEvents(token),
        eventRequestsApi.getMyRequestsAsClient(token),
        bookingsApi.getMyBookingsAsClient(token),
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

  const fetchPortfolioPosts = useCallback(async () => {
    if (!token || portfolioLoaded) return;
    setPortfolioLoading(true);
    try {
      const res = await fetch('/api/v1/portfolio/my-posts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setPortfolioPosts(d?.data?.posts ?? []);
        setPortfolioLoaded(true);
      }
    } catch {
      // silent
    } finally {
      setPortfolioLoading(false);
    }
  }, [token, portfolioLoaded]);

  const handleTabChange = (tab: 'overview' | 'saved' | 'portfolio') => {
    setDashTab(tab);
    if (tab === 'saved') fetchSavedPosts();
    if (tab === 'portfolio') fetchPortfolioPosts();
  };

  // ── Request status helpers ───────────────────────────────────────────────────

  const statusLabel = (req: EventRequestItem): string => {
    if (req.status === 'DECLINED') return 'Declined';
    if (req.status === 'EXPIRED') return 'Expired';
    const quote = req.quotes?.[0];
    if (!quote) return 'Pending';
    if (quote.status === 'PENDING_VENDOR_APPROVAL') return 'Awaiting Vendor';
    if (quote.status === 'SENT' || quote.status === 'VIEWED') return 'Quote Ready';
    if (quote.status === 'ACCEPTED') {
      const booking = bookings.find(
        b =>
          b.providerProfile?.id === req.providerProfile?.id &&
          new Date(b.eventDate).toDateString() === new Date(req.eventDate).toDateString(),
      );
      if (!booking) return 'Confirmed';
      if (booking.status === 'PENDING_DEPOSIT') return 'Deposit Due';
      if (booking.status === 'DEPOSIT_PAID' || booking.status === 'CONFIRMED') return 'Confirmed';
      return 'Confirmed';
    }
    if (quote.status === 'REJECTED') return 'Declined';
    return 'Pending';
  };

  const statusStyle = (req: EventRequestItem): string => {
    const label = statusLabel(req);
    const styles: Record<string, string> = {
      'Deposit Due':     'bg-[#FBF7F0] border-[rgba(196,160,106,0.4)] text-[#9A7A4A]',
      'Quote Ready':     'bg-[#EAF3DE] border-[rgba(59,109,17,0.2)] text-[#3B6D11]',
      'Confirmed':       'bg-[#E6F1FB] border-[rgba(24,95,165,0.2)] text-[#185FA5]',
      'Awaiting Vendor': 'bg-[#F5F3EF] border-border text-[#7A7068]',
      'Pending':         'bg-[#F5F3EF] border-border text-[#7A7068]',
      'Declined':        'bg-[#FCEBEB] border-[rgba(163,45,45,0.2)] text-[#A32D2D]',
      'Expired':         'bg-[#F5F3EF] border-border text-[#7A7068]',
    };
    return styles[label] ?? styles['Pending'];
  };

  const getActionButton = (req: EventRequestItem) => {
    const label = statusLabel(req);
    if (label === 'Quote Ready') {
      return (
        <Link
          to={`/requests/${req.id}`}
          className="text-[10px] uppercase tracking-widest text-[#C4A06A] hover:text-[#9A7A4A]"
        >
          View Quote →
        </Link>
      );
    }
    if (label === 'Deposit Due') {
      return (
        <Link
          to={`/requests/${req.id}`}
          className="text-[10px] uppercase tracking-widest text-[#C4A06A] hover:text-[#9A7A4A]"
        >
          Pay Deposit →
        </Link>
      );
    }
    return (
      <Link
        to={`/requests/${req.id}`}
        className="text-[10px] uppercase tracking-widest text-[#7A7068] hover:text-[#3A3530]"
      >
        View →
      </Link>
    );
  };

  // ── Derived values ───────────────────────────────────────────────────────────

  const actionRequiredCount = requests.filter(r => {
    const label = statusLabel(r);
    return label === 'Quote Ready' || label === 'Deposit Due';
  }).length;

  const filteredRequests = requests
    .filter(r => {
      if (requestFilter === 'Action Required') {
        const label = statusLabel(r);
        return label === 'Quote Ready' || label === 'Deposit Due';
      }
      if (requestFilter === 'Confirmed') {
        return statusLabel(r) === 'Confirmed';
      }
      return r.status !== 'EXPIRED' && r.status !== 'DECLINED';
    })
    .sort((a, b) => {
      const aLabel = statusLabel(a);
      const bLabel = statusLabel(b);
      const actionA = aLabel === 'Quote Ready' || aLabel === 'Deposit Due' ? 0 : 1;
      const actionB = bLabel === 'Quote Ready' || bLabel === 'Deposit Due' ? 0 : 1;
      if (actionA !== actionB) return actionA - actionB;
      return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
    });

  const handleUnsave = async (providerId: string) => {
    if (!token) return;
    setFavorites(prev => prev.filter(f => f.providerId !== providerId));
    try {
      await favoritesApi.removeFavorite(providerId, token);
    } catch {
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
        {([
          { key: 'overview',  label: 'Overview' },
          { key: 'saved',     label: 'Saved Posts' },
          { key: 'portfolio', label: 'My Portfolio' },
        ] as { key: 'overview' | 'saved' | 'portfolio'; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className="font-sans pb-3 transition-colors focus:outline-none"
            style={{
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: dashTab === key ? '#1A1714' : '#7A7068',
              borderBottom: dashTab === key ? '2px solid #C4A06A' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {label}
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

      {/* My Portfolio tab */}
      {dashTab === 'portfolio' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <div />
            <button
              onClick={() => setComposerOpen(true)}
              className="font-sans rounded-md transition-opacity hover:opacity-80"
              style={{ background: '#1A1714', color: '#F5F3EF', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '8px 16px' }}
            >
              + Add to Portfolio
            </button>
          </div>

          {portfolioLoading ? (
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
          ) : portfolioPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: 18, fontStyle: 'italic', color: '#7A7068' }}>
                Share your first event to start your portfolio.
              </p>
            </div>
          ) : (
            <motion.div
              className="columns-2 gap-4"
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            >
              {portfolioPosts.map(post => (
                <motion.div
                  key={post.id}
                  className="break-inside-avoid mb-4"
                  variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
                >
                  <PortfolioCard
                    post={post}
                    token={token}
                    managementMode
                    onDelete={id => setPortfolioPosts(prev => prev.filter(p => p.id !== id))}
                    onUpdate={updated => setPortfolioPosts(prev => prev.map(p => p.id === updated.id ? updated : p))}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      )}

      {/* Post composer */}
      {composerOpen && (
        <PostComposer
          forcedType="PLANNER_POST"
          onClose={() => setComposerOpen(false)}
          onPosted={post => {
            setPortfolioPosts(prev => [post, ...prev]);
            setPortfolioLoaded(true);
          }}
        />
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

          {/* SECTION 1 — MY REQUESTS (unified) */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] uppercase tracking-widest text-[#7A7068]">My Requests</h2>
              {actionRequiredCount > 0 && (
                <span className="text-[10px] text-[#C4A06A]">{actionRequiredCount} need your attention</span>
              )}
            </div>

            {/* Filter pills */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {(['All', 'Action Required', 'Confirmed'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setRequestFilter(f)}
                  className={`text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-sm border transition-colors ${
                    requestFilter === f
                      ? 'bg-[#1A1714] text-[#F5F3EF] border-[#1A1714]'
                      : 'bg-white text-[#7A7068] border-border hover:border-[#C4A06A]'
                  }`}
                >
                  {f}
                  {f === 'Action Required' && actionRequiredCount > 0 && (
                    <span className="ml-1.5 bg-[#C4A06A] text-[#1A1714] rounded-full px-1.5 text-[9px]">
                      {actionRequiredCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-8">
                <p className="font-serif italic text-[15px] text-[#7A7068]">No requests yet.</p>
                <Link to="/providers" className="text-[10px] uppercase tracking-widest text-[#C4A06A] mt-2 block">
                  Browse Vendors →
                </Link>
              </div>
            ) : (
              filteredRequests.map((req, i) => (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 4) * 0.07, duration: 0.4 }}
                >
                  <div className="bg-white border border-border rounded-md p-4 mb-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-serif text-[16px] text-[#1A1714]">
                          {req.providerProfile?.businessName ?? 'Unknown Vendor'}
                        </p>
                        <p className="text-[11px] text-[#7A7068] mt-0.5">
                          {req.package?.name && `${req.package.name} · `}
                          {req.eventDate
                            ? format(parseISO(req.eventDate), 'MMM d, yyyy')
                            : '—'}
                          {` · ${req.guestCount} guests`}
                        </p>
                      </div>
                      <span className={`text-[9px] uppercase tracking-widest px-2 py-1 rounded-sm border ${statusStyle(req)}`}>
                        {statusLabel(req)}
                      </span>
                    </div>
                    {getActionButton(req)}
                  </div>
                </motion.div>
              ))
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
