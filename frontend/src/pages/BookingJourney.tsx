import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { eventRequestsApi, apiFetch } from '../utils/api';
import MessageThread from '../components/MessageThread';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AddOnItem {
  addOnId: string;
  name: string;
  pricingType: string;
  price: number;
  quantity: number;
  total: number;
}

interface AdjustmentItem {
  description: string;
  amount: number;
}

interface BookingRef {
  id: string;
  status: string;
  depositPaidAt: string | null;
  createdAt: string;
}

interface QuoteRef {
  id: string;
  status: string;
  version: number;
  createdAt: string;
  expiresAt: string | null;
  rejectionReason: string | null;
  vendorMessage: string | null;
  isOutOfParameters: boolean;
  packagePrice: number;
  addOns: AddOnItem[];
  addOnsTotal: number;
  adjustments: AdjustmentItem[];
  adjustmentsTotal: number;
  subtotal: number;
  tax: number;
  total: number;
  depositAmount: number;
  booking: BookingRef | null;
}

interface EventRequestData {
  id: string;
  status: string;
  eventType: string;
  eventDate: string;
  guestCount: number;
  durationHours?: number | null;
  calculatedEstimate?: number | null;
  isOutOfParameters: boolean;
  specialRequests?: string | null;
  createdAt: string;
  package?: {
    id: string;
    name: string;
    pricingModel: string;
    basePrice: number;
    durationHours?: number | null;
  } | null;
  providerProfile: {
    id: string;
    businessName: string;
    primaryType: string;
    logoUrl?: string | null;
    user?: { id: string; city?: string | null; state?: string | null } | null;
  };
  client: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
  };
  quotes: QuoteRef[];
  booking: BookingRef | null;
}

type JourneyState =
  | 'awaiting_vendor'
  | 'vendor_reviewing'
  | 'quote_ready'
  | 'waiting_planner'
  | 'deposit_due'
  | 'deposit_pending_vendor'
  | 'confirmed'
  | 'declined'
  | 'expired';

// ── Formatters ────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1';

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n);

const formatDate = (iso: string) => {
  try { return format(parseISO(iso), 'EEEE, MMMM d, yyyy'); } catch { return iso; }
};

const formatDateShort = (iso: string) => {
  try { return format(parseISO(iso), 'MMM d, yyyy'); } catch { return iso; }
};

const formatExpiry = (iso: string | null) => {
  if (!iso) return 'N/A';
  try { return format(parseISO(iso), 'MMM d, yyyy'); } catch { return iso; }
};

const formatEventType = (t: string) =>
  t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING:    { label: 'Pending',     color: 'bg-[#F5F3EF] border border-border text-[#7A7068]' },
  QUOTE_SENT: { label: 'Quote Ready', color: 'bg-[#EAF3DE] border border-[rgba(59,109,17,0.2)] text-[#3B6D11]' },
  ACCEPTED:   { label: 'Accepted',    color: 'bg-[#E6F1FB] border border-[rgba(24,95,165,0.2)] text-[#185FA5]' },
  DECLINED:   { label: 'Declined',    color: 'bg-[#FCEBEB] border border-[rgba(163,45,45,0.2)] text-[#A32D2D]' },
  EXPIRED:    { label: 'Expired',     color: 'bg-[#F5F3EF] border border-border text-[#7A7068]' },
};

// ── Shared inline components ──────────────────────────────────────────────────

const PriceLine = ({
  label,
  value,
  indent,
  green,
}: {
  label: string;
  value: number;
  indent?: boolean;
  green?: boolean;
}) => (
  <div className={`flex justify-between items-baseline py-1 ${indent ? 'pl-3' : ''}`}>
    <span className="text-[11px] text-[#7A7068]">{label}</span>
    <span className={`text-[12px] ${green ? 'text-[#3B6D11]' : 'text-[#3A3530]'}`}>
      {formatCurrency(value)}
    </span>
  </div>
);

const Divider = () => <div className="h-px bg-[#E2DDD6] my-2" />;

const Timeline = ({
  steps,
}: {
  steps: { label: string; sub: string; done: boolean }[];
}) => (
  <div className="flex flex-col gap-3">
    {steps.map((step, i) => (
      <div key={i} className="flex gap-3 items-start">
        <div
          className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
            step.done ? 'bg-[#C4A06A]' : 'bg-[#F5F3EF] border border-border'
          }`}
        >
          {step.done && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <div>
          <p className={`text-[12px] ${step.done ? 'text-[#3A3530]' : 'text-[#B0A89E]'}`}>
            {step.label}
          </p>
          {step.sub && <p className="text-[10px] text-[#7A7068]">{step.sub}</p>}
        </div>
      </div>
    ))}
  </div>
);

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1A1714] text-[#F5F3EF] font-sans text-xs px-5 py-3 rounded-md"
    >
      {message}
    </motion.div>
  );
}

function Skeleton() {
  return (
    <div className="bg-[#F5F3EF] min-h-screen">
      <div className="max-w-[900px] mx-auto px-6 py-10 animate-pulse">
        <div className="h-3 w-24 bg-border rounded mb-8" />
        <div className="h-4 w-20 bg-border rounded mb-3" />
        <div className="h-8 w-64 bg-border rounded mb-2" />
        <div className="h-3 w-48 bg-border rounded mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          <div className="space-y-4">
            <div className="bg-white border border-border rounded-md h-48" />
            <div className="bg-white border border-border rounded-md h-32" />
          </div>
          <div className="bg-white border border-border rounded-md h-64" />
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function BookingJourney() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();

  const [request, setRequest] = useState<EventRequestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'overview' | 'messages'>('overview');

  // Action state
  const [showDecline, setShowDecline] = useState(false);
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  const isClient = user?.role === 'CLIENT';
  const isProvider = user?.role === 'PROVIDER';
  const dashboardLink = isProvider ? '/provider/dashboard' : '/dashboard';

  useEffect(() => {
    if (!id || !token) return;
    (async () => {
      try {
        const res = await eventRequestsApi.getById(id, token) as any;
        setRequest(res?.data ?? null);
      } catch {
        setError('Request not found.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, token]);

  useEffect(() => {
    const payment = searchParams.get('payment');
    if (payment === 'success') {
      setToastMsg('Deposit paid successfully — your booking is confirmed!');
    } else if (payment === 'cancelled') {
      setToastMsg('Payment cancelled. Your booking is still pending deposit.');
    }
  }, []);

  const toast = (msg: string) => setToastMsg(msg);

  const refetch = async () => {
    if (!id || !token) return;
    try {
      const res = await eventRequestsApi.getById(id, token) as any;
      setRequest(res?.data ?? null);
    } catch {
      toast('Failed to refresh');
    }
  };

  // ── Action handlers ──────────────────────────────────────────────────────────

  const handleApproveQuote = async () => {
    if (!request?.quotes[0]) return;
    setActionLoading(true);
    try {
      await apiFetch(`/quotes/${request.quotes[0].id}/vendor-approve`, {
        method: 'POST',
        token: token ?? undefined,
      });
      await refetch();
    } catch {
      toast('Failed to approve request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineRequest = async () => {
    if (!request) return;
    setActionLoading(true);
    try {
      await apiFetch(`/quotes/requests/${request.id}/vendor-decline`, {
        method: 'POST',
        token: token ?? undefined,
        body: JSON.stringify({ rejectionReason: declineReason.trim() || undefined }),
      });
      setShowDecline(false);
      setDeclineReason('');
      await refetch();
    } catch {
      toast('Failed to decline request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptQuote = async () => {
    if (!request?.quotes[0]) return;
    setActionLoading(true);
    try {
      await apiFetch(`/quotes/${request.quotes[0].id}/accept`, {
        method: 'POST',
        token: token ?? undefined,
      });
      await refetch();
    } catch {
      toast('Failed to accept quote');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineQuote = async () => {
    if (!request?.quotes[0]) return;
    setActionLoading(true);
    try {
      await apiFetch(`/quotes/${request.quotes[0].id}/reject`, {
        method: 'POST',
        token: token ?? undefined,
        body: JSON.stringify({ rejectionReason: declineReason.trim() || undefined }),
      });
      setShowDeclineForm(false);
      setDeclineReason('');
      await refetch();
    } catch {
      toast('Failed to decline quote');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayDeposit = async () => {
    if (!request?.booking) return;
    setPaymentLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stripe/checkout/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bookingId: request.booking.id }),
      });
      const data = await res.json();
      if (data.success && data.data?.url) {
        window.location.href = data.data.url;
      } else {
        toast(data.error ?? 'Unable to start payment. Please try again.');
        setPaymentLoading(false);
      }
    } catch {
      toast('Failed to initiate payment');
      setPaymentLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!request?.booking || !token) return;
    try {
      const res = await fetch(`${API_BASE}/bookings/${request.booking.id}/confirmation-pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to download');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FESTV-Booking-${request.booking.id.slice(0, 8).toUpperCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast('Failed to download PDF. Please try again.');
    }
  };

  const handleMarkDepositPaid = async () => {
    if (!request?.booking) return;
    setActionLoading(true);
    try {
      await apiFetch(`/bookings/${request.booking.id}/deposit-paid`, {
        method: 'PATCH',
        token: token ?? undefined,
      });
      await refetch();
    } catch {
      toast('Failed to mark deposit');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Render states ────────────────────────────────────────────────────────────

  if (loading) return <Skeleton />;

  if (error || !request) {
    return (
      <div className="bg-[#F5F3EF] min-h-screen flex items-center justify-center">
        <div className="text-center px-6">
          <p className="font-serif text-2xl text-[#3A3530]">{error || 'Request not found.'}</p>
          <Link
            to={dashboardLink}
            className="font-sans text-xs text-[#C4A06A] hover:text-[#9A7A4A] mt-4 inline-block transition-colors"
          >
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ── Derived values ───────────────────────────────────────────────────────────

  const latestQuote = request.quotes[0] ?? null;
  const booking = request.booking ?? null;
  const statusCfg = STATUS_CONFIG[request.status] ?? STATUS_CONFIG.PENDING;

  const journeyState: JourneyState = (() => {
    if (request.status === 'DECLINED') return 'declined';
    if (request.status === 'EXPIRED') return 'expired';
    if (booking?.status === 'CONFIRMED' || booking?.status === 'DEPOSIT_PAID') return 'confirmed';
    if (booking?.status === 'PENDING_DEPOSIT') return isClient ? 'deposit_due' : 'deposit_pending_vendor';
    if (latestQuote?.status === 'PENDING_VENDOR_APPROVAL') return isProvider ? 'awaiting_vendor' : 'vendor_reviewing';
    if (request.status === 'QUOTE_SENT') return isClient ? 'quote_ready' : 'waiting_planner';
    return 'awaiting_vendor';
  })();

  const durationHours =
    request.package?.durationHours ?? request.durationHours ?? null;

  return (
    <div className="bg-[#F5F3EF] min-h-screen">
      <div className="max-w-[900px] mx-auto px-6 py-10">

        {/* Back */}
        <Link
          to={dashboardLink}
          className="inline-flex items-center gap-1 text-[#C4A06A] hover:text-[#9A7A4A] text-[10px] uppercase tracking-widest font-sans transition-colors mb-6"
        >
          ← Back
        </Link>

        {/* Status badge + submitted date */}
        <div className="flex items-center gap-3 mb-3">
          <span className={`font-sans text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
          <span className="font-sans text-[10px] text-[#7A7068]">
            Submitted {formatDateShort(request.createdAt)}
          </span>
        </div>

        {/* Event title */}
        <h1
          style={{
            fontFamily: '"Cormorant Garamond", serif',
            fontSize: 30,
            fontWeight: 300,
            color: '#1A1714',
            lineHeight: 1.2,
          }}
          className="mb-2"
        >
          {formatEventType(request.eventType)}
        </h1>

        {/* Subtitle */}
        <p className="font-sans text-[12px] text-[#7A7068] mb-6">
          {request.providerProfile.businessName}
          {request.package?.name ? ` · ${request.package.name}` : ''}
          {' · '}
          {formatDate(request.eventDate)}
        </p>

        {/* Tabs */}
        <div className="flex items-center gap-6 border-b border-[#E2DDD6] mb-6">
          {(['overview', 'messages'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="font-sans pb-3 transition-colors focus:outline-none"
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: tab === t ? '#1A1714' : '#7A7068',
                borderBottom: tab === t ? '2px solid #C4A06A' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Messages tab ──────────────────────────────────────────────────── */}
        {tab === 'messages' && (
          <div className="bg-white border border-border rounded-md overflow-hidden">
            <MessageThread
              otherUserId={isClient ? (request.providerProfile.user?.id ?? '') : request.client.id}
              requestId={request.id}
              otherName={
                isClient
                  ? request.providerProfile.businessName
                  : `${request.client.firstName} ${request.client.lastName}`
              }
              otherInitials={
                isClient
                  ? request.providerProfile.businessName.slice(0, 2).toUpperCase()
                  : `${request.client.firstName[0]}${request.client.lastName[0]}`.toUpperCase()
              }
            />
          </div>
        )}

        {/* ── Overview tab ──────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">

            {/* ── LEFT COLUMN ───────────────────────────────────────────────── */}
            <div>

              {/* Event Details */}
              <div className="bg-white border border-border rounded-md p-5 mb-4">
                <p className="text-[9px] uppercase tracking-widest text-[#C4A06A] mb-3">Event Details</p>
                <div className="space-y-0">
                  {(
                    [
                      ['Date',        formatDate(request.eventDate)],
                      ['Event type',  formatEventType(request.eventType)],
                      ['Guest count', `${request.guestCount} guests`],
                      ['Duration',    durationHours != null ? `${durationHours}h` : '—'],
                      ['Package',     request.package?.name ?? '—'],
                    ] as [string, string][]
                  ).map(([label, value]) => (
                    <div
                      key={label}
                      className="flex justify-between items-center py-1.5 border-b border-[#F0EDE8] last:border-0"
                    >
                      <span className="text-[11px] text-[#7A7068]">{label}</span>
                      <span className="text-[12px] text-[#3A3530] font-medium">{value}</span>
                    </div>
                  ))}
                </div>
                {request.specialRequests && (
                  <div className="mt-3 bg-[#F5F3EF] rounded-sm px-3 py-2">
                    <p className="text-[9px] uppercase tracking-widest text-[#7A7068] mb-1">Special Requests</p>
                    <p className="font-serif italic text-[13px] text-[#3A3530]">
                      {request.specialRequests}
                    </p>
                  </div>
                )}
                {request.isOutOfParameters && (
                  <div className="mt-3 bg-[#FBF7F0] border border-[rgba(196,160,106,0.3)] rounded-sm px-3 py-2">
                    <p className="text-[10px] text-[#9A7A4A]">
                      This request falls outside standard parameters — the vendor will review manually.
                    </p>
                  </div>
                )}
              </div>

              {/* Vendor */}
              <div className="bg-white border border-border rounded-md p-5 mb-4">
                <p className="text-[9px] uppercase tracking-widest text-[#C4A06A] mb-3">Vendor</p>
                <div className="flex items-center gap-3">
                  {request.providerProfile.logoUrl ? (
                    <img
                      src={request.providerProfile.logoUrl}
                      alt={request.providerProfile.businessName}
                      className="w-10 h-10 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#F5F3EF] border border-border flex items-center justify-center text-[11px] text-[#7A7068] font-medium">
                      {request.providerProfile.businessName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-serif text-[17px] text-[#1A1714]">
                      {request.providerProfile.businessName}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-[#7A7068]">
                      {request.providerProfile.user?.city ?? ''}
                    </p>
                  </div>
                  <Link
                    to={`/providers/${request.providerProfile.id}`}
                    className="text-[10px] uppercase tracking-widest text-[#C4A06A] hover:text-[#9A7A4A] transition-colors"
                  >
                    View Profile →
                  </Link>
                </div>
              </div>

              {/* Price Breakdown — only when quote exists and approved */}
              {latestQuote && latestQuote.status !== 'PENDING_VENDOR_APPROVAL' && (
                <div className="bg-white border border-border rounded-md p-5 mb-4">
                  <p className="text-[9px] uppercase tracking-widest text-[#C4A06A] mb-3">Price Breakdown</p>
                  <div className="space-y-0">
                    <PriceLine label="Package price" value={latestQuote.packagePrice} />
                    {Array.isArray(latestQuote.addOns) &&
                      latestQuote.addOns.map(addon => (
                        <PriceLine
                          key={addon.addOnId}
                          label={addon.name}
                          value={addon.total}
                          indent
                        />
                      ))}
                    {latestQuote.addOnsTotal > 0 && <Divider />}
                    {Array.isArray(latestQuote.adjustments) &&
                      latestQuote.adjustments.map((adj, i) => (
                        <PriceLine
                          key={i}
                          label={adj.description}
                          value={adj.amount}
                          green={adj.amount < 0}
                        />
                      ))}
                    <Divider />
                    <PriceLine label="Subtotal" value={latestQuote.subtotal} />
                    <PriceLine label="Tax (15%)" value={latestQuote.tax} />
                    <Divider />
                    <div className="flex justify-between items-baseline pt-2">
                      <span className="text-[12px] text-[#1A1714] font-medium">Total</span>
                      <span
                        style={{
                          fontFamily: '"Cormorant Garamond", serif',
                          fontSize: 26,
                          color: '#1A1714',
                          fontWeight: 600,
                        }}
                      >
                        {formatCurrency(latestQuote.total)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[11px] text-[#C4A06A]">Deposit due (10%)</span>
                      <span className="text-[12px] text-[#C4A06A] font-medium">
                        {formatCurrency(latestQuote.depositAmount)}
                      </span>
                    </div>
                    {booking?.depositPaidAt && (
                      <>
                        <div className="flex justify-between items-baseline border-t border-[#F0EDE8] pt-2 mt-1">
                          <span className="text-[11px] text-[#3B6D11]">Deposit paid</span>
                          <span className="text-[12px] text-[#3B6D11] font-medium">
                            {formatCurrency(latestQuote.depositAmount)} ✓
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-[11px] text-[#7A7068]">Balance due on event day</span>
                          <span className="text-[12px] text-[#3A3530] font-medium">
                            {formatCurrency(latestQuote.total - latestQuote.depositAmount)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Confirmation Receipt — when CONFIRMED or DEPOSIT_PAID */}
              {booking && (booking.status === 'CONFIRMED' || booking.status === 'DEPOSIT_PAID') && (
                <div className="bg-white border border-border rounded-md p-5 mb-4">
                  <p className="text-[9px] uppercase tracking-widest text-[#C4A06A] mb-3">
                    Confirmation Receipt
                  </p>
                  <div className="space-y-0">
                    {(
                      [
                        ['Booking ID',    booking.id.slice(0, 8).toUpperCase()],
                        ['Status',        booking.status.replace(/_/g, ' ')],
                        ['Deposit paid',  booking.depositPaidAt ? formatDateShort(booking.depositPaidAt) : 'Pending'],
                      ] as [string, string][]
                    ).map(([label, value]) => (
                      <div
                        key={label}
                        className="flex justify-between items-center py-1 border-b border-[#F0EDE8] last:border-0"
                      >
                        <span className="text-[11px] text-[#7A7068]">{label}</span>
                        <span className="text-[12px] text-[#3A3530] font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT COLUMN ──────────────────────────────────────────────── */}
            <div>

              {/* ── awaiting_vendor: PROVIDER sees Accept/Decline ──────────── */}
              {journeyState === 'awaiting_vendor' && isProvider && (
                <div className="bg-white border border-border rounded-md p-5 mb-4">
                  <p className="text-[9px] uppercase tracking-widest text-[#C4A06A] mb-3">New Request</p>
                  <p className="font-serif italic text-[15px] text-[#3A3530] leading-relaxed mb-4">
                    {request.client.firstName} {request.client.lastName} is requesting{' '}
                    {request.package?.name ?? 'your service'}. Review the details and respond.
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleApproveQuote}
                    disabled={actionLoading}
                    className="w-full bg-[#1A1714] text-[#F5F3EF] text-[10px] uppercase tracking-widest py-3 rounded-sm mb-2 hover:bg-[#3A3530] transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? 'Accepting…' : 'Accept Request'}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowDecline(true)}
                    disabled={actionLoading}
                    className="w-full border border-border text-[10px] uppercase tracking-widest py-2.5 rounded-sm text-[#7A7068] hover:border-[#C4A06A] hover:text-[#C4A06A] transition-colors disabled:opacity-50"
                  >
                    Decline
                  </motion.button>
                  <AnimatePresence>
                    {showDecline && (
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
                          placeholder="Let the planner know why (optional)"
                          maxLength={500}
                          rows={2}
                          className="w-full bg-[#F5F3EF] border border-border rounded-md px-3 py-2 text-[13px] font-sans focus:border-[#C4A06A] outline-none resize-none"
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={handleDeclineRequest}
                            disabled={actionLoading}
                            className="text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-sm text-white disabled:opacity-50"
                            style={{ background: '#B84040' }}
                          >
                            {actionLoading ? 'Declining…' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => { setShowDecline(false); setDeclineReason(''); }}
                            className="text-[10px] text-[#7A7068] px-4 py-1.5"
                          >
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* ── awaiting_vendor: CLIENT sees "waiting" state ───────────── */}
              {journeyState === 'awaiting_vendor' && isClient && (
                <div className="bg-white border border-border rounded-md p-5 mb-4">
                  <p className="text-[9px] uppercase tracking-widest text-[#C4A06A] mb-3">Request Sent</p>
                  <p className="font-serif italic text-[15px] text-[#7A7068] leading-relaxed mb-4">
                    Your request has been sent to {request.providerProfile.businessName}. You'll hear
                    back shortly.
                  </p>
                  <Timeline
                    steps={[
                      { label: 'Request sent',      sub: formatDateShort(request.createdAt), done: true },
                      { label: 'Vendor response',   sub: 'Pending',                          done: false },
                      { label: 'Pay deposit',        sub: 'After approval',                  done: false },
                      { label: 'Booking confirmed', sub: '',                                 done: false },
                    ]}
                  />
                </div>
              )}

              {/* ── vendor_reviewing: CLIENT sees "awaiting approval" ──────── */}
              {journeyState === 'vendor_reviewing' && (
                <div className="bg-white border border-border rounded-md p-5 mb-4">
                  <p className="text-[9px] uppercase tracking-widest text-[#C4A06A] mb-3">Awaiting Approval</p>
                  <p className="font-serif italic text-[15px] text-[#7A7068] leading-relaxed mb-4">
                    Your request has been received. {request.providerProfile.businessName} is reviewing
                    it and will respond shortly.
                  </p>
                  <Timeline
                    steps={[
                      { label: 'Request sent',      sub: formatDateShort(request.createdAt), done: true },
                      { label: 'Vendor approval',   sub: 'Pending',                          done: false },
                      { label: 'Pay deposit',        sub: 'After approval',                  done: false },
                      { label: 'Booking confirmed', sub: '',                                 done: false },
                    ]}
                  />
                </div>
              )}

              {/* ── quote_ready: CLIENT sees quote + accept/decline ────────── */}
              {journeyState === 'quote_ready' && latestQuote && (
                <div className="bg-white border border-border rounded-md p-5 mb-4">
                  <p className="text-[9px] uppercase tracking-widest text-[#C4A06A] mb-3">Quote Ready</p>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-[11px] text-[#7A7068]">Total</span>
                    <span
                      style={{
                        fontFamily: '"Cormorant Garamond", serif',
                        fontSize: 26,
                        color: '#1A1714',
                        fontWeight: 600,
                      }}
                    >
                      {formatCurrency(latestQuote.total)}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#C4A06A] mb-4">
                    Deposit {formatCurrency(latestQuote.depositAmount)} · Expires{' '}
                    {formatExpiry(latestQuote.expiresAt)}
                  </p>
                  {latestQuote.vendorMessage && (
                    <div className="border-l-2 border-[#C4A06A] bg-[#FBF7F0] px-3 py-2 mb-4 rounded-sm">
                      <p className="font-serif italic text-[13px] text-[#3A3530]">
                        {latestQuote.vendorMessage}
                      </p>
                    </div>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleAcceptQuote}
                    disabled={actionLoading}
                    className="w-full bg-[#C4A06A] text-[#1A1714] text-[10px] uppercase tracking-widest py-3 rounded-sm mb-2 hover:bg-[#B8935E] transition-colors font-medium disabled:opacity-50"
                  >
                    {actionLoading ? 'Accepting…' : 'Accept Quote'}
                  </motion.button>
                  {!showDeclineForm ? (
                    <button
                      onClick={() => setShowDeclineForm(true)}
                      disabled={actionLoading}
                      className="w-full text-[10px] uppercase tracking-widest text-[#7A7068] py-2 hover:text-[#3A3530] disabled:opacity-50"
                    >
                      Decline
                    </button>
                  ) : (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <textarea
                        value={declineReason}
                        onChange={e => setDeclineReason(e.target.value)}
                        placeholder="Let the vendor know why (optional)"
                        maxLength={500}
                        rows={2}
                        className="w-full bg-[#F5F3EF] border border-border rounded-md px-3 py-2 text-[13px] font-sans focus:border-[#C4A06A] outline-none resize-none mt-2"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={handleDeclineQuote}
                          disabled={actionLoading}
                          className="text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-sm text-white disabled:opacity-50"
                          style={{ background: '#B84040' }}
                        >
                          {actionLoading ? 'Declining…' : 'Confirm Decline'}
                        </button>
                        <button
                          onClick={() => { setShowDeclineForm(false); setDeclineReason(''); }}
                          className="text-[10px] text-[#7A7068] px-4 py-1.5"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {/* ── waiting_planner: PROVIDER waiting on client ────────────── */}
              {journeyState === 'waiting_planner' && (
                <div className="bg-white border border-border rounded-md p-5 mb-4">
                  <p className="text-[9px] uppercase tracking-widest text-[#C4A06A] mb-3">Awaiting Planner</p>
                  <p className="font-serif italic text-[15px] text-[#7A7068] leading-relaxed">
                    Your quote has been sent to {request.client.firstName}. You'll be notified when they
                    respond.
                  </p>
                </div>
              )}

              {/* ── deposit_due: CLIENT pays deposit ───────────────────────── */}
              {journeyState === 'deposit_due' && latestQuote && (
                <div className="bg-white border border-border rounded-md p-5 mb-4">
                  <p className="text-[9px] uppercase tracking-widest text-[#C4A06A] mb-3">Deposit Due</p>
                  <p
                    style={{
                      fontFamily: '"Cormorant Garamond", serif',
                      fontSize: 28,
                      color: '#1A1714',
                      fontWeight: 600,
                    }}
                    className="mb-1"
                  >
                    {formatCurrency(latestQuote.depositAmount)}
                  </p>
                  <p className="text-[11px] text-[#7A7068] mb-4">
                    10% of {formatCurrency(latestQuote.total)}
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handlePayDeposit}
                    disabled={paymentLoading}
                    className="w-full bg-[#C4A06A] text-[#1A1714] text-[10px] uppercase tracking-widest py-3.5 rounded-sm mb-2 font-medium hover:bg-[#B8935E] transition-colors disabled:opacity-60"
                  >
                    {paymentLoading ? 'Redirecting…' : 'Pay Deposit'}
                  </motion.button>
                  <p className="text-[10px] text-[#B0A89E] text-center">Secure payment via Stripe</p>
                </div>
              )}

              {/* ── deposit_pending_vendor: PROVIDER marks deposit received ── */}
              {journeyState === 'deposit_pending_vendor' && (
                <div className="bg-white border border-border rounded-md p-5 mb-4">
                  <p className="text-[9px] uppercase tracking-widest text-[#C4A06A] mb-3">Awaiting Deposit</p>
                  <p className="font-serif italic text-[15px] text-[#7A7068] leading-relaxed mb-4">
                    Waiting for {request.client.firstName} to pay the deposit.
                  </p>
                  <button
                    onClick={handleMarkDepositPaid}
                    disabled={actionLoading}
                    className="w-full bg-[#1A1714] text-[#F5F3EF] text-[10px] uppercase tracking-widest py-3 rounded-sm hover:bg-[#3A3530] transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? 'Updating…' : 'Mark Deposit Received'}
                  </button>
                </div>
              )}

              {/* ── confirmed: booking is locked in ───────────────────────── */}
              {journeyState === 'confirmed' && booking && latestQuote && (
                <div className="bg-white border border-border rounded-md p-5 mb-4">
                  <div className="text-center mb-5">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                      className="w-10 h-10 rounded-full bg-[#EAF3DE] flex items-center justify-center mx-auto mb-3"
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#3B6D11"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </motion.div>
                    <p className="font-serif text-[20px] text-[#1A1714] font-light">Booking Confirmed</p>
                    <p className="text-[10px] uppercase tracking-widest text-[#7A7068] mt-1">
                      {isClient
                        ? request.providerProfile.businessName
                        : `${request.client.firstName} ${request.client.lastName}`}
                    </p>
                  </div>
                  <Timeline
                    steps={[
                      {
                        label: 'Booking confirmed',
                        sub: formatDateShort(booking.createdAt),
                        done: true,
                      },
                      {
                        label: 'Deposit paid',
                        sub: formatCurrency(latestQuote.depositAmount),
                        done: !!booking.depositPaidAt,
                      },
                      {
                        label: 'Event day',
                        sub: formatDateShort(request.eventDate),
                        done: false,
                      },
                      {
                        label: 'Balance due on arrival',
                        sub: formatCurrency(latestQuote.total - latestQuote.depositAmount),
                        done: false,
                      },
                    ]}
                  />
                  <button
                    onClick={handleDownloadPdf}
                    className="w-full border border-border text-[10px] uppercase tracking-widest py-2.5 rounded-sm text-[#7A7068] mt-4 hover:border-[#C4A06A] hover:text-[#C4A06A] transition-colors"
                  >
                    Download Confirmation PDF
                  </button>
                </div>
              )}

              {/* ── declined ──────────────────────────────────────────────── */}
              {journeyState === 'declined' && (
                <div className="bg-white border border-border rounded-md p-5 mb-4">
                  <p className="text-[9px] uppercase tracking-widest text-[#7A7068] mb-3">
                    Request Declined
                  </p>
                  {latestQuote?.rejectionReason && (
                    <div
                      className="border-l-2 border-[#C4A06A] bg-[#FBF7F0] px-3 py-2 mb-4"
                      style={{ borderRadius: '0 4px 4px 0' }}
                    >
                      <p className="text-[9px] uppercase tracking-widest text-[#C4A06A] mb-1">
                        Vendor Note
                      </p>
                      <p className="font-serif italic text-[13px] text-[#3A3530] leading-relaxed">
                        {latestQuote.rejectionReason}
                      </p>
                    </div>
                  )}
                  <Link
                    to="/providers"
                    className="block w-full text-center bg-[#1A1714] text-[#F5F3EF] text-[10px] uppercase tracking-widest py-3 rounded-sm hover:bg-[#3A3530] transition-colors"
                  >
                    Browse Other Vendors
                  </Link>
                </div>
              )}

              {/* ── expired ───────────────────────────────────────────────── */}
              {journeyState === 'expired' && (
                <div className="bg-white border border-border rounded-md p-5 mb-4">
                  <p className="text-[9px] uppercase tracking-widest text-[#7A7068] mb-3">
                    Request Expired
                  </p>
                  <p className="font-serif italic text-[14px] text-[#7A7068]">
                    This request has expired. Browse vendors to start a new request.
                  </p>
                  <Link
                    to="/providers"
                    className="block w-full text-center border border-border text-[10px] uppercase tracking-widest py-2.5 rounded-sm text-[#7A7068] mt-4 hover:border-[#C4A06A] transition-colors"
                  >
                    Browse Vendors
                  </Link>
                </div>
              )}

            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toastMsg && (
          <Toast message={toastMsg} onDone={() => setToastMsg(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
