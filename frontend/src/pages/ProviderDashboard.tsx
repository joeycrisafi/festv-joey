import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar, Inbox, Star, Package, Eye, Clock, ChevronRight, User,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
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

function dayMonth(iso: string): { day: string; month: string } {
  const d = new Date(iso.split('T')[0] + 'T00:00:00');
  return {
    day:   d.toLocaleDateString('en-CA', { day: 'numeric' }),
    month: d.toLocaleDateString('en-CA', { month: 'short' }).toUpperCase(),
  };
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
    eventType?: string | null;
    client?: { firstName: string; lastName: string } | null;
  } | null;
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  PENDING_DEPOSIT: 'bg-amber-50 text-amber-700 border border-amber-200',
  DEPOSIT_PAID:    'bg-blue-50  text-blue-700  border border-blue-200',
  CONFIRMED:       'bg-green/10 text-green     border border-green/30',
  IN_PROGRESS:     'bg-gold/10  text-gold-dark border border-gold/30',
  COMPLETED:       'bg-bg       text-muted     border border-border',
  CANCELLED:       'bg-red/10   text-red       border border-red/30',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_DEPOSIT: 'Deposit Pending',
  DEPOSIT_PAID:    'Deposit Paid',
  CONFIRMED:       'Confirmed',
  IN_PROGRESS:     'In Progress',
  COMPLETED:       'Completed',
  CANCELLED:       'Cancelled',
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

  // ── Fetch all data on mount ────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { navigate('/login'); return; }

    const headers = { Authorization: `Bearer ${token}` };

    Promise.allSettled([
      fetch(`${API_BASE}/providers/profile/me`,               { headers }).then(r => r.json()),
      fetch(`${API_BASE}/event-requests/incoming?limit=5`,     { headers }).then(r => r.json()),
      fetch(`${API_BASE}/bookings/upcoming`,                   { headers }).then(r => r.json()),
      fetch(`${API_BASE}/bookings/stats`,                      { headers }).then(r => r.json()),
      fetch(`${API_BASE}/quotes/me/vendor?status=SENT&limit=5`,{ headers }).then(r => r.json()),
    ]).then(([profileRes, reqRes, bookRes, statsRes, quotesRes]) => {
      // Profile
      if (profileRes.status === 'fulfilled' && profileRes.value?.success) {
        const p = profileRes.value.data?.providerProfile ?? profileRes.value.data;
        if (p) {
          setProfile(p);
          // Fetch Stripe status after profile is known
          fetch(`${API_BASE}/stripe/connect/status?profileId=${p.id}`, { headers })
            .then(r => r.json())
            .then(d => {
              if (d.success) {
                setStripeStatus(d.data?.chargesEnabled ? 'ACTIVE' : (d.data?.stripeAccountId ? 'PENDING' : null));
              }
            })
            .catch(() => {});
        } else {
          // New vendor — no profile created yet. Send to the setup wizard.
          navigate('/vendor/setup', { replace: true });
          return;
        }
      }
      // If the profile fetch returned non-success (e.g. 403 from PENDING_VERIFICATION),
      // render the dashboard in empty state rather than navigating away — the user IS authenticated.

      // Requests
      if (reqRes.status === 'fulfilled' && reqRes.value?.success) {
        setRequests(reqRes.value.data ?? []);
      }

      // Bookings
      if (bookRes.status === 'fulfilled' && bookRes.value?.success) {
        setBookings(bookRes.value.data ?? []);
      }

      // Stats
      if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
        const s = statsRes.value.data;
        if (s) setStats({
          totalBookings:     s.totalBookings     ?? 0,
          confirmedBookings: s.confirmedBookings ?? 0,
          completedBookings: s.completedBookings ?? 0,
          totalRevenue:      s.totalRevenue      ?? 0,
        });
      }

      // Pending quotes
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

            {/* ── SECTION 1: INCOMING REQUESTS ─────────────────────────────── */}
            <p className="font-sans text-xs font-bold uppercase tracking-widest text-charcoal mb-4">
              Incoming Requests
            </p>

            {requests.length === 0 ? (
              <div className="bg-white border border-border rounded-md p-8 text-center mb-4">
                <Inbox size={32} strokeWidth={1.5} className="text-muted mx-auto mb-3" />
                <p className="font-serif text-lg text-muted">No new requests yet</p>
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
                {requests.map((req, reqIdx) => {
                  const clientName = req.client
                    ? `${req.client.firstName} ${req.client.lastName}`
                    : 'Anonymous';
                  const estimated = req.budget
                    ? fmt(req.budget)
                    : req.guestCount
                      ? `~${fmt(req.guestCount * 100)}` // rough estimate placeholder
                      : null;

                  return (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(reqIdx, 4) * 0.07, duration: 0.4 }}
                      className="bg-white border border-border rounded-md p-5 mb-3 hover:border-gold transition-colors duration-150"
                    >
                      {/* Top meta row */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-sans text-xs uppercase bg-gold/10 text-gold-dark px-2 py-0.5 rounded-full">
                          {req.eventType?.replace(/_/g, ' ') ?? 'Event'}
                        </span>
                        {req.eventDate && (
                          <span className="font-sans text-xs text-muted">
                            {fmtDate(req.eventDate)}
                          </span>
                        )}
                        {req.isOutOfParameters && (
                          <span className="font-sans text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                            Custom request
                          </span>
                        )}
                      </div>

                      {/* Client */}
                      <p className="font-sans text-sm font-semibold text-dark">{clientName}</p>

                      {/* Package */}
                      {req.package?.name && (
                        <p className="font-sans text-xs text-muted mt-0.5">
                          Package: {req.package.name}
                        </p>
                      )}

                      {/* Guests + estimated value */}
                      {(req.guestCount != null || estimated) && (
                        <p className="font-serif text-lg text-dark mt-1">
                          {req.guestCount != null && <span>{req.guestCount} guests</span>}
                          {req.guestCount != null && estimated && <span className="text-muted font-sans text-sm"> · </span>}
                          {estimated && <span>Est. {estimated}</span>}
                        </p>
                      )}

                      {/* Special requests preview */}
                      {req.specialRequests && (
                        <p className="font-sans text-xs text-muted italic mt-1 truncate">
                          "{req.specialRequests}"
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-3 mt-4">
                        <Link
                          to={`/event-requests/${req.id}`}
                          className="bg-gold text-dark font-sans text-xs font-bold tracking-widest uppercase px-5 py-2 hover:bg-gold-dark transition-colors focus:outline-none rounded-md"
                        >
                          {req.isOutOfParameters ? 'Create Custom Quote' : 'Auto-Generate Quote'}
                        </Link>
                        <button
                          className="font-sans text-xs text-muted hover:text-red transition-colors focus:outline-none"
                          onClick={() => {/* decline — navigate to detail */
                            navigate(`/event-requests/${req.id}`);
                          }}
                        >
                          Decline
                        </button>
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

            {/* ── SECTION 2: UPCOMING BOOKINGS ─────────────────────────────── */}
            <p className="font-sans text-xs font-bold uppercase tracking-widest text-charcoal mt-10 mb-4">
              Upcoming Bookings
            </p>

            {bookings.length === 0 ? (
              <div className="bg-white border border-border rounded-md p-8 text-center">
                <Calendar size={32} strokeWidth={1.5} className="text-muted mx-auto mb-3" />
                <p className="font-serif text-lg text-muted">No upcoming bookings</p>
                <p className="font-sans text-xs text-muted mt-2">
                  Confirmed bookings will appear here
                </p>
              </div>
            ) : (
              <>
                {bookings.map((booking, bkIdx) => {
                  const dm = booking.eventDate ? dayMonth(booking.eventDate) : null;
                  const clientName = booking.client
                    ? `${booking.client.firstName} ${booking.client.lastName}`
                    : booking.quote?.client
                      ? `${booking.quote.client.firstName} ${booking.quote.client.lastName}`
                      : 'Client';
                  return (
                    <motion.div
                      key={booking.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(bkIdx, 4) * 0.07, duration: 0.4 }}
                    >
                    <Link
                      to={`/bookings/${booking.id}`}
                      className="bg-white border border-border rounded-md p-5 mb-3 flex items-start gap-4 hover:border-gold transition-colors duration-150 block"
                    >
                      {/* Date block */}
                      {dm ? (
                        <div className="bg-gold/10 rounded-md p-3 text-center w-14 flex-shrink-0">
                          <p className="font-serif text-2xl text-gold-dark font-semibold leading-none">
                            {dm.day}
                          </p>
                          <p className="font-sans text-xs text-muted uppercase mt-1">{dm.month}</p>
                        </div>
                      ) : (
                        <div className="bg-border rounded-md p-3 text-center w-14 flex-shrink-0">
                          <Calendar size={20} strokeWidth={1.5} className="text-muted mx-auto" />
                        </div>
                      )}

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <p className="font-sans text-sm font-semibold text-dark">
                          {booking.eventType?.replace(/_/g, ' ') ?? 'Event'}
                          {booking.package?.name && (
                            <span className="font-normal text-muted"> · {booking.package.name}</span>
                          )}
                        </p>
                        <p className="font-sans text-xs text-muted mt-0.5">
                          {clientName}
                          {booking.guestCount != null && ` · ${booking.guestCount} guests`}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className={`font-sans text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[booking.status] ?? 'bg-bg text-muted border border-border'}`}>
                            {STATUS_LABEL[booking.status] ?? booking.status}
                          </span>
                          <span className="font-serif text-base text-dark">
                            {fmt(booking.totalAmount)}
                          </span>
                        </div>
                      </div>

                      <ChevronRight size={16} className="text-muted flex-shrink-0 mt-1" />
                    </Link>
                    </motion.div>
                  );
                })}
                <Link
                  to="/provider/bookings"
                  className="flex items-center gap-1 font-sans text-xs text-gold hover:text-gold-dark transition-colors mt-1"
                >
                  View all bookings <ChevronRight size={12} />
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

            {/* ── PENDING QUOTES ───────────────────────────────────────────── */}
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
                          <Link
                            to={`/bookings/${q.id}`}
                            className="font-sans text-xs text-gold hover:text-gold-dark transition-colors flex-shrink-0"
                          >
                            View
                          </Link>
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
                  { Icon: Package,  label: 'Manage Packages',     to: '/vendor/packages'             },
                  { Icon: Calendar, label: 'Update Availability',  to: '/vendor/availability'         },
                  { Icon: User,     label: 'Edit Profile',         to: '/vendor/setup'                },
                  { Icon: Eye,      label: 'Preview My Profile',   to: profileId ? `/providers/${profileId}` : '#' },
                  { Icon: Star,     label: 'View Reviews',         to: profileId ? `/providers/${profileId}#reviews` : '#' },
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
    </div>
  );
}
