import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar, Inbox, Star, Package, Eye, Clock, ChevronRight, User,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import PortfolioCard, { type PortfolioPostData } from '../components/PortfolioCard';
import PostComposer from '../components/PostComposer';

// ── Helpers ───────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);

function fmtDate(iso: string) {
  const d = new Date(iso.split('T')[0] + 'T00:00:00');
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.round(diff / 86400000));
}

function greeting(firstName: string): string {
  const h = new Date().getHours();
  const salutation = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${salutation}, ${firstName}`;
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  businessName: string;
  primaryType: string;
  verificationStatus: string;
  averageRating: number;
  totalReviews: number;
  user: { firstName: string; lastName: string };
}

interface EventRequest {
  id: string;
  eventType: string;
  eventDate?: string | null;
  guestCount?: number | null;
  budget?: number | null;
  specialRequests?: string | null;
  isOutOfParameters?: boolean;
  packageId?: string | null;
  package?: { name: string } | null;
  client?: { firstName: string; lastName: string } | null;
  quotes?: { id: string; status: string }[];
  createdAt: string;
}

interface Booking {
  id: string;
  status: string;
  eventDate?: string | null;
  totalAmount: number;
  eventType?: string | null;
  guestCount?: number | null;
  package?: { name: string } | null;
  client?: { firstName: string; lastName: string } | null;
  quote?: { client?: { firstName: string; lastName: string } | null } | null;
}

interface BookingStats {
  totalBookings: number;
  confirmedBookings: number;
  completedBookings: number;
  totalRevenue: number;
}

interface PendingQuote {
  id: string;
  total: number;
  expiresAt?: string | null;
  eventRequest?: {
    id?: string | null;
    eventType?: string | null;
    client?: { firstName: string; lastName: string } | null;
  } | null;
}

type DashboardItem =
  | { kind: 'request'; data: EventRequest }
  | { kind: 'booking'; data: Booking };

// ── Status helpers ─────────────────────────────────────────────────────────────

const bookingStatusLabel = (status: string): string => {
  const map: Record<string, string> = {
    PENDING_DEPOSIT: 'Awaiting Deposit',
    DEPOSIT_PAID:    'Deposit Paid',
    CONFIRMED:       'Confirmed',
    IN_PROGRESS:     'In Progress',
    COMPLETED:       'Completed',
    CANCELLED:       'Cancelled',
  };
  return map[status] ?? status;
};

const bookingStatusStyle = (status: string): string => {
  if (status === 'CONFIRMED' || status === 'DEPOSIT_PAID') return 'bg-[#E6F1FB] border-[rgba(24,95,165,0.2)] text-[#185FA5]';
  if (status === 'PENDING_DEPOSIT') return 'bg-[#FBF7F0] border-[rgba(196,160,106,0.4)] text-[#9A7A4A]';
  if (status === 'COMPLETED') return 'bg-[#F5F3EF] border-border text-[#7A7068]';
  return 'bg-[#F5F3EF] border-border text-[#7A7068]';
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-border rounded-md ${className ?? ''}`} />;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ProviderDashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [dashTab, setDashTab] = useState<'overview' | 'portfolio'>('overview');

  const [profile,  setProfile]  = useState<Profile | null>(null);
  const [requests, setRequests] = useState<EventRequest[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats,    setStats]    = useState<BookingStats>({ totalBookings: 0, confirmedBookings: 0, completedBookings: 0, totalRevenue: 0 });
  const [quotes,   setQuotes]   = useState<PendingQuote[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [stripeStatus, setStripeStatus] = useState<'ACTIVE' | 'PENDING' | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);

  const [portfolioPosts, setPortfolioPosts] = useState<PortfolioPostData[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioLoaded, setPortfolioLoaded] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const [approvingId,        setApprovingId]        = useState<string | null>(null);
  const [decliningRequestId, setDecliningRequestId] = useState<string | null>(null);
  const [declineReason,      setDeclineReason]      = useState('');
  const [toast,              setToast]              = useState<{ msg: string; ok: boolean } | null>(null);

  // ── Fetch all data on mount ────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { navigate('/login'); return; }

    const headers = { Authorization: `Bearer ${token}` };

    Promise.allSettled([
      fetch(`${API_BASE}/providers/profile/me`,                { headers }).then(r => r.json()),
      fetch(`${API_BASE}/event-requests/incoming?limit=5`,      { headers }).then(r => r.json()),
      fetch(`${API_BASE}/bookings/upcoming`,                    { headers }).then(r => r.json()),
      fetch(`${API_BASE}/bookings/stats`,                       { headers }).then(r => r.json()),
      fetch(`${API_BASE}/quotes/me/vendor?status=SENT&limit=5`, { headers }).then(r => r.json()),
    ]).then(([profileRes, reqRes, bookRes, statsRes, quotesRes]) => {
      // Profile
      if (profileRes.status === 'fulfilled' && profileRes.value?.success) {
        const p = profileRes.value.data?.providerProfile ?? profileRes.value.data;
        if (p) {
          setProfile(p);
          fetch(`${API_BASE}/stripe/connect/status?profileId=${p.id}`, { headers })
            .then(r => r.json())
            .then(d => {
              if (d.success) {
                setStripeStatus(d.data?.chargesEnabled ? 'ACTIVE' : (d.data?.stripeAccountId ? 'PENDING' : null));
              }
            })
            .catch(() => {});
        } else {
          navigate('/vendor/setup', { replace: true });
          return;
        }
      }

      if (reqRes.status === 'fulfilled' && reqRes.value?.success) {
        setRequests(reqRes.value.data ?? []);
      }

      if (bookRes.status === 'fulfilled' && bookRes.value?.success) {
        setBookings(bookRes.value.data ?? []);
      }

      if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
        const s = statsRes.value.data;
        if (s) setStats({
          totalBookings:     s.totalBookings     ?? 0,
          confirmedBookings: s.confirmedBookings ?? 0,
          completedBookings: s.completedBookings ?? 0,
          totalRevenue:      s.totalRevenue      ?? 0,
        });
      }

      if (quotesRes.status === 'fulfilled' && quotesRes.value?.success) {
        setQuotes(quotesRes.value.data ?? []);
      }

      setLoading(false);
    });
  }, [token, navigate]);

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

  const handleTabChange = (tab: 'overview' | 'portfolio') => {
    setDashTab(tab);
    if (tab === 'portfolio') fetchPortfolioPosts();
  };

  const connectStripe = async () => {
    if (!token || !profileId || stripeLoading) return;
    setStripeLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stripe/connect/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ profileId }),
      });
      const data = await res.json();
      if (data.success && data.data?.url) {
        window.location.href = data.data.url;
      }
    } catch {
      setStripeLoading(false);
    }
  };

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const handleApproveQuote = async (quoteId: string) => {
    if (!quoteId) return;
    setApprovingId(quoteId);
    try {
      await apiFetch(`/quotes/${quoteId}/vendor-approve`, { method: 'POST', token: token ?? undefined });
      setRequests(prev => prev.filter(r => r.quotes?.[0]?.id !== quoteId));
      showToast('Request accepted — planner has been notified', true);
    } catch {
      showToast('Failed to approve request', false);
    } finally {
      setApprovingId(null);
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      await apiFetch(`/quotes/requests/${requestId}/vendor-decline`, {
        method: 'POST',
        token: token ?? undefined,
        body: JSON.stringify({ rejectionReason: declineReason.trim() || undefined }),
      });
      setRequests(prev => prev.filter(r => r.id !== requestId));
      setDecliningRequestId(null);
      setDeclineReason('');
      showToast('Request declined — planner has been notified', true);
    } catch {
      showToast('Failed to decline request', false);
    }
  };

  const firstName = profile?.user?.firstName ?? user?.firstName ?? 'there';

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-bg min-h-screen px-6 md:px-12 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-40" />
              <div className="mt-8 space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-28" />)}
              </div>
            </div>
            <div className="space-y-4">
              <Skeleton className="h-48" />
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    navigate('/vendor/setup', { replace: true });
    return null;
  }

  const isVerified = profile.verificationStatus === 'VERIFIED';
  const profileId  = profile.id;

  const allItems: DashboardItem[] = [
    ...requests.map(r => ({ kind: 'request' as const, data: r })),
    ...bookings.map(b => ({ kind: 'booking' as const, data: b })),
  ].sort((a, b) => {
    const dateA = new Date(a.data.eventDate ?? 0).getTime();
    const dateB = new Date(b.data.eventDate ?? 0).getTime();
    return dateA - dateB;
  });

  return (
    <div className="bg-bg min-h-screen">

      {/* ── PENDING APPROVAL BANNER ──────────────────────────────────────── */}
      {!isVerified && (
        <div className="bg-dark border-b border-gold/20 px-6 md:px-12 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Clock size={18} strokeWidth={1.5} className="text-gold flex-shrink-0" />
            <div>
              <p className="font-sans text-sm font-semibold text-white">
                Your profile is under review
              </p>
              <p className="font-sans text-xs text-white/50 mt-0.5">
                We'll notify you by email once approved. This usually takes 1–2 business days.
              </p>
            </div>
          </div>
          <Link
            to="/vendor/setup"
            className="font-sans text-xs font-semibold text-gold hover:text-gold-light transition-colors flex-shrink-0 whitespace-nowrap"
          >
            Complete profile →
          </Link>
        </div>
      )}

      {/* ── STRIPE CONNECT BANNER ────────────────────────────────────────── */}
      {stripeStatus !== 'ACTIVE' && (
        <div className="bg-gold/5 border-b border-gold/20 px-6 md:px-12 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <p className="font-sans text-sm font-semibold text-charcoal">
                {stripeStatus === 'PENDING' ? 'Stripe account pending' : 'Connect your bank account'}
              </p>
              <p className="font-sans text-xs text-muted mt-0.5">
                {stripeStatus === 'PENDING'
                  ? 'Complete your Stripe onboarding to receive deposit payments.'
                  : 'Set up Stripe to receive deposit payments directly into your bank.'}
              </p>
            </div>
          </div>
          <button
            onClick={connectStripe}
            disabled={stripeLoading}
            className="font-sans text-xs font-semibold text-gold hover:text-gold-dark transition-colors flex-shrink-0 whitespace-nowrap disabled:opacity-60"
          >
            {stripeLoading ? 'Redirecting…' : stripeStatus === 'PENDING' ? 'Continue setup →' : 'Connect Stripe →'}
          </button>
        </div>
      )}

      {/* ── PAGE BODY ─────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 md:px-12 py-8">

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="font-serif text-3xl text-dark">
              {greeting(firstName)}
            </h1>
            <p className="font-sans text-sm text-muted mt-1">{todayLabel()}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/vendor/packages"
              className="border border-border text-charcoal font-sans text-xs uppercase tracking-widest px-4 py-2 hover:border-gold hover:text-gold transition-colors rounded-md focus:outline-none"
            >
              Edit Packages
            </Link>
            <Link
              to="/vendor/availability"
              className="border border-border text-charcoal font-sans text-xs uppercase tracking-widest px-4 py-2 hover:border-gold hover:text-gold transition-colors rounded-md focus:outline-none"
            >
              Update Availability
            </Link>
          </div>
        </div>

        {/* ── TAB BAR ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-6 mb-8 border-b border-border">
          {([
            { key: 'overview',  label: 'Overview' },
            { key: 'portfolio', label: 'Portfolio' },
          ] as { key: 'overview' | 'portfolio'; label: string }[]).map(({ key, label }) => (
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

        {/* ── PORTFOLIO TAB ───────────────────────────────────────────────── */}
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
                  Your portfolio is empty. Add your first piece of work.
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

            {composerOpen && (
              <PostComposer
                forcedType="VENDOR_POST"
                onClose={() => setComposerOpen(false)}
                onPosted={post => {
                  setPortfolioPosts(prev => [post, ...prev]);
                  setPortfolioLoaded(true);
                }}
              />
            )}
          </div>
        )}

        {/* ── TWO-COLUMN GRID ─────────────────────────────────────────────── */}
        {dashTab === 'overview' && <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* ── LEFT COLUMN (col-span-2) ───────────────────────────────────── */}
          <div className="md:col-span-2">

            {/* ── REQUESTS & BOOKINGS ──────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] uppercase tracking-widest text-[#7A7068]">Requests & Bookings</h2>
              {requests.length > 0 && (
                <span className="text-[10px] text-[#C4A06A]">{requests.length} pending approval</span>
              )}
            </div>

            {allItems.length === 0 ? (
              <div className="bg-white border border-border rounded-md p-8 text-center mb-4">
                <Inbox size={32} strokeWidth={1.5} className="text-muted mx-auto mb-3" />
                <p className="font-serif text-lg text-muted">No requests yet</p>
                <p className="font-sans text-xs text-muted mt-2">
                  Share your profile to start receiving bookings
                </p>
                {profileId && (
                  <Link
                    to={`/providers/${profileId}`}
                    className="inline-block mt-4 font-sans text-xs text-gold hover:text-gold-dark transition-colors"
                  >
                    Preview your profile →
                  </Link>
                )}
              </div>
            ) : (
              <>
                {allItems.map((item, idx) => {
                  if (item.kind === 'request') {
                    const req = item.data;
                    const pendingQuote = req.quotes?.find(q => q.status === 'PENDING_VENDOR_APPROVAL');
                    const clientName = req.client
                      ? `${req.client.firstName} ${req.client.lastName}`
                      : 'Anonymous';

                    return (
                      <motion.div
                        key={`req-${req.id}`}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx, 4) * 0.07, duration: 0.4 }}
                      >
                        <div className="bg-white border border-border rounded-md p-4 mb-3">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-serif text-[16px] text-[#1A1714]">{clientName}</p>
                              <p className="text-[11px] text-[#7A7068] mt-0.5">
                                {req.package?.name && `${req.package.name} · `}
                                {req.eventDate ? fmtDate(req.eventDate) : '—'}
                                {req.guestCount != null && ` · ${req.guestCount} guests`}
                              </p>
                            </div>
                            <span className="text-[9px] uppercase tracking-widest px-2 py-1 rounded-sm border bg-[#FBF7F0] border-[rgba(196,160,106,0.4)] text-[#9A7A4A]">
                              Pending Approval
                            </span>
                          </div>

                          {pendingQuote && (
                            <div className="flex gap-2 mt-3">
                              <motion.button
                                whileTap={{ scale: 0.97 }}
                                onClick={() => handleApproveQuote(pendingQuote.id)}
                                disabled={approvingId === pendingQuote.id}
                                className="flex-1 bg-[#1A1714] text-[#F5F3EF] text-[10px] uppercase tracking-widest py-2 rounded-sm hover:bg-[#3A3530] transition-colors disabled:opacity-50"
                              >
                                {approvingId === pendingQuote.id ? 'Accepting…' : 'Accept'}
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.97 }}
                                onClick={() => { setDecliningRequestId(req.id); setDeclineReason(''); }}
                                disabled={approvingId === pendingQuote.id}
                                className="flex-1 border border-border text-[10px] uppercase tracking-widest py-2 rounded-sm text-[#7A7068] hover:border-[#C4A06A] transition-colors disabled:opacity-50"
                              >
                                Decline
                              </motion.button>
                            </div>
                          )}

                          <AnimatePresence>
                            {decliningRequestId === req.id && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="mt-3 overflow-hidden"
                              >
                                <textarea
                                  value={declineReason}
                                  onChange={e => setDeclineReason(e.target.value)}
                                  placeholder="Let the planner know why you're declining (optional)"
                                  maxLength={500}
                                  rows={2}
                                  className="w-full bg-[#F5F3EF] border border-border rounded-md px-3 py-2 text-[13px] font-sans focus:border-[#C4A06A] outline-none resize-none"
                                />
                                <div className="flex gap-2 mt-2">
                                  <button
                                    onClick={() => handleDeclineRequest(req.id)}
                                    className="text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-sm text-[#F5F3EF]"
                                    style={{ background: '#B84040' }}
                                  >
                                    Confirm Decline
                                  </button>
                                  <button
                                    onClick={() => { setDecliningRequestId(null); setDeclineReason(''); }}
                                    className="text-[10px] uppercase tracking-widest text-[#7A7068] px-4 py-1.5"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <Link
                            to={`/requests/${req.id}`}
                            className="text-[10px] uppercase tracking-widest text-[#7A7068] mt-2 block hover:text-[#3A3530]"
                          >
                            View Details →
                          </Link>
                        </div>
                      </motion.div>
                    );
                  }

                  // kind === 'booking'
                  const bk = item.data;
                  const clientName = bk.client
                    ? `${bk.client.firstName} ${bk.client.lastName}`
                    : bk.quote?.client
                      ? `${bk.quote.client.firstName} ${bk.quote.client.lastName}`
                      : 'Client';

                  return (
                    <motion.div
                      key={`bk-${bk.id}`}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx, 4) * 0.07, duration: 0.4 }}
                    >
                      <div className="bg-white border border-border rounded-md p-4 mb-3">
                        <div className="flex items-start justify-between mb-1">
                          <div>
                            <p className="font-serif text-[16px] text-[#1A1714]">{clientName}</p>
                            <p className="text-[11px] text-[#7A7068] mt-0.5">
                              {bk.package?.name && `${bk.package.name} · `}
                              {bk.eventDate ? fmtDate(bk.eventDate) : '—'}
                              {bk.guestCount != null && ` · ${bk.guestCount} guests`}
                            </p>
                          </div>
                          <span className={`text-[9px] uppercase tracking-widest px-2 py-1 rounded-sm border ${bookingStatusStyle(bk.status)}`}>
                            {bookingStatusLabel(bk.status)}
                          </span>
                        </div>
                        <p className="font-serif text-[15px] text-[#1A1714] mt-1">
                          {fmt(bk.totalAmount)}
                        </p>
                        <Link
                          to={`/requests/${bk.id}`}
                          className="text-[10px] uppercase tracking-widest text-[#7A7068] mt-2 block hover:text-[#3A3530]"
                        >
                          View →
                        </Link>
                      </div>
                    </motion.div>
                  );
                })}

                <Link
                  to="/event-requests"
                  className="flex items-center gap-1 font-sans text-xs text-gold hover:text-gold-dark transition-colors mt-1 mb-2"
                >
                  View all requests <ChevronRight size={12} />
                </Link>
              </>
            )}
          </div>

          {/* ── RIGHT COLUMN ─────────────────────────────────────────────────── */}
          <div>

            {/* ── STATS CARD ───────────────────────────────────────────────── */}
            <div className="bg-white border border-border rounded-md p-6 mb-6">
              <p className="font-sans text-xs font-bold uppercase tracking-widest text-charcoal mb-4">
                Overview
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-sans text-xs text-muted uppercase tracking-wide">Total</p>
                  <p className="font-serif text-2xl text-dark mt-1">{stats.totalBookings}</p>
                </div>
                <div>
                  <p className="font-sans text-xs text-muted uppercase tracking-wide">Confirmed</p>
                  <p className="font-serif text-2xl text-dark mt-1">{stats.confirmedBookings}</p>
                </div>
                <div>
                  <p className="font-sans text-xs text-muted uppercase tracking-wide">Completed</p>
                  <p className="font-serif text-2xl text-dark mt-1">{stats.completedBookings}</p>
                </div>
                <div>
                  <p className="font-sans text-xs text-muted uppercase tracking-wide">Revenue</p>
                  <p className="font-serif text-2xl text-gold-dark mt-1">{fmt(stats.totalRevenue)}</p>
                </div>
              </div>

              {profile && profile.averageRating > 0 && (
                <>
                  <div className="border-t border-border my-4" />
                  <div className="flex items-center gap-2">
                    <Star size={14} strokeWidth={1.5} className="text-gold fill-gold" />
                    <span className="font-sans text-sm text-dark font-semibold">
                      {profile.averageRating.toFixed(1)}
                    </span>
                    <span className="font-sans text-xs text-muted">
                      · {profile.totalReviews} review{profile.totalReviews !== 1 ? 's' : ''}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* ── AWAITING RESPONSE (quotes sidebar) ───────────────────────── */}
            <div className="bg-white border border-border rounded-md p-6 mb-6">
              <p className="font-sans text-xs font-bold uppercase tracking-widest text-charcoal mb-4">
                Awaiting Response
              </p>

              {quotes.length === 0 ? (
                <p className="font-sans text-xs text-muted">No pending quotes</p>
              ) : (
                <div>
                  {quotes.map((q, idx) => {
                    const clientName = q.eventRequest?.client
                      ? `${q.eventRequest.client.firstName} ${q.eventRequest.client.lastName}`
                      : 'Client';
                    const eventType = q.eventRequest?.eventType?.replace(/_/g, ' ') ?? 'Event';
                    const daysLeft  = q.expiresAt ? daysUntil(q.expiresAt) : null;
                    const requestId = q.eventRequest?.id;

                    return (
                      <div
                        key={q.id}
                        className={`${idx < quotes.length - 1 ? 'border-b border-border pb-3 mb-3' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-sans text-sm text-dark font-medium truncate">
                              {clientName}
                            </p>
                            <p className="font-sans text-xs text-muted mt-0.5">{eventType}</p>
                          </div>
                          {requestId ? (
                            <Link
                              to={`/requests/${requestId}`}
                              className="font-sans text-xs text-gold hover:text-gold-dark transition-colors flex-shrink-0"
                            >
                              View
                            </Link>
                          ) : (
                            <span className="font-sans text-xs text-muted flex-shrink-0">—</span>
                          )}
                        </div>
                        <p className="font-serif text-lg text-gold-dark mt-1">{fmt(q.total)}</p>
                        {daysLeft !== null && (
                          <p className="font-sans text-xs text-muted mt-0.5">
                            {daysLeft === 0
                              ? 'Expires today'
                              : `Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── QUICK ACTIONS ─────────────────────────────────────────────── */}
            <div className="bg-dark rounded-md p-6">
              <p className="font-sans text-xs font-bold uppercase tracking-widest text-white/50 mb-4">
                Quick Actions
              </p>
              <div className="space-y-0">
                {[
                  { Icon: Package,  label: 'Manage Packages',    to: '/vendor/packages'                                   },
                  { Icon: Calendar, label: 'Update Availability', to: '/vendor/availability'                               },
                  { Icon: User,     label: 'Edit Profile',        to: '/vendor/setup'                                      },
                  { Icon: Eye,      label: 'Preview My Profile',  to: profileId ? `/providers/${profileId}` : '#'          },
                  { Icon: Star,     label: 'View Reviews',        to: profileId ? `/providers/${profileId}#reviews` : '#'  },
                ].map(({ Icon, label, to }) => (
                  <Link
                    key={label}
                    to={to}
                    className="flex items-center gap-3 py-3 border-b border-white/10 last:border-0 text-white/60 hover:text-gold-light transition-colors duration-150 focus:outline-none group"
                  >
                    <Icon size={15} strokeWidth={1.5} className="flex-shrink-0 group-hover:text-gold-light transition-colors" />
                    <span className="font-sans text-sm">{label}</span>
                    <ChevronRight size={12} className="ml-auto opacity-40 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </div>}
      </div>

      {/* ── TOAST ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 font-sans text-xs px-4 py-2.5 rounded-md shadow-sm z-50"
            style={{ background: toast.ok ? '#1A1714' : '#B84040', color: '#F5F3EF', whiteSpace: 'nowrap' }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
