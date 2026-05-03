import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { bookingsApi } from '../utils/api';
import { ProviderTypeBadge } from '../components/ProviderTypeBadge';

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(n);

function initials(firstName?: string, lastName?: string) {
  return ((firstName?.[0] ?? '') + (lastName?.[0] ?? '')).toUpperCase() || '?';
}

// ── Types ─────────────────────────────────────────────────────────────────────

type BookingStatus =
  | 'PENDING_DEPOSIT'
  | 'DEPOSIT_PAID'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'DISPUTED'
  | 'PENDING_REVIEW';

interface BookingData {
  id: string;
  status: BookingStatus;
  eventType: string;
  eventDate: string;
  guestCount: number;
  durationHours?: number | null;
  packagePrice: number;
  addOnsTotal: number;
  adjustmentsTotal: number;
  subtotal: number;
  tax: number;
  total: number;
  depositAmount: number;
  depositPaidAt?: string | null;
  specialRequests?: string | null;
  vendorNotes?: string | null;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string | null;
  };
  providerProfile?: {
    id: string;
    businessName: string;
    primaryType: string;
    logoUrl?: string | null;
    user?: {
      city?: string | null;
      state?: string | null;
    };
  };
  package?: {
    id: string;
    name: string;
    pricingModel: string;
  } | null;
  quote?: {
    id: string;
    vendorMessage?: string | null;
    addOnsTotal?: number;
    adjustmentsTotal?: number;
  } | null;
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING_DEPOSIT: { label: 'Awaiting Deposit',  cls: 'bg-gold/10 text-gold-dark border border-gold/30' },
  DEPOSIT_PAID:    { label: 'Deposit Paid',       cls: 'bg-charcoal/10 text-charcoal border border-charcoal/20' },
  CONFIRMED:       { label: 'Confirmed',          cls: 'bg-green/10 text-green border border-green/30' },
  IN_PROGRESS:     { label: 'In Progress',        cls: 'bg-green/10 text-green border border-green/30' },
  COMPLETED:       { label: 'Completed',          cls: 'bg-charcoal/10 text-charcoal border border-charcoal/20' },
  CANCELLED:       { label: 'Cancelled',          cls: 'bg-red/10 text-red border border-red/30' },
  REFUNDED:        { label: 'Refunded',           cls: 'bg-muted/10 text-muted border border-muted/20' },
  DISPUTED:        { label: 'Disputed',           cls: 'bg-red/10 text-red border border-red/30' },
  PENDING_REVIEW:  { label: 'Pending Review',     cls: 'bg-gold/10 text-gold-dark border border-gold/30' },
};

const EVENT_TYPE_LABEL: Record<string, string> = {
  WEDDING: 'Wedding', CORPORATE: 'Corporate', BIRTHDAY: 'Birthday',
  ANNIVERSARY: 'Anniversary', GRADUATION: 'Graduation', BABY_SHOWER: 'Baby Shower',
  BRIDAL_SHOWER: 'Bridal Shower', HOLIDAY: 'Holiday', COCKTAIL_PARTY: 'Cocktail Party',
  DINNER_PARTY: 'Dinner Party', BRUNCH: 'Brunch', OTHER: 'Other',
};

// ── Toast ─────────────────────────────────────────────────────────────────────

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
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-dark text-bg font-sans text-xs px-5 py-3 rounded-md shadow-lg"
    >
      {message}
    </motion.div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-6 py-10 animate-pulse space-y-6">
        <div className="h-3 bg-border rounded w-32" />
        <div className="h-8 bg-border rounded w-1/2" />
        <div className="bg-white border border-border rounded-md p-8 space-y-5">
          <div className="h-4 bg-bg rounded w-1/3" />
          <div className="h-6 bg-bg rounded w-2/3" />
          <div className="border-t border-border my-4" />
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="flex justify-between">
              <div className="h-3 bg-bg rounded w-1/3" />
              <div className="h-3 bg-bg rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [status, setStatus] = useState<BookingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [searchParams] = useSearchParams();

  const isProvider = user?.role === 'PROVIDER';
  const isClient = user?.role === 'CLIENT';
  const dashboardLink = isProvider ? '/provider/dashboard' : '/dashboard';

  useEffect(() => {
    if (!id || !token) return;
    const load = async () => {
      try {
        const res = await bookingsApi.getById(id, token);
        const data = res as { success: boolean; data?: BookingData; message?: string };
        if (data.success && data.data) {
          setBooking(data.data);
          setStatus(data.data.status);
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, token]);

  // Handle Stripe Checkout return
  useEffect(() => {
    const paymentParam = searchParams.get('payment');
    if (paymentParam === 'success') {
      setToastMessage('Payment received! Your deposit is confirmed.');
      // Optimistically update status
      setStatus('DEPOSIT_PAID');
      setBooking(prev => prev ? { ...prev, status: 'DEPOSIT_PAID' } : prev);
    } else if (paymentParam === 'cancelled') {
      setToastMessage('Payment cancelled — your booking is still saved.');
    }
  }, [searchParams]);

  // ── Action handlers ──────────────────────────────────────────────────────────

  const doAction = async (
    apiFn: (id: string, token: string) => Promise<unknown>,
    nextStatus: BookingStatus,
    confirmMsg?: string,
  ) => {
    if (!id || !token) return;
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await apiFn(id, token);
      const data = res as { success: boolean; message?: string };
      if (data.success) {
        setStatus(nextStatus);
        setBooking(prev => prev ? { ...prev, status: nextStatus } : prev);
      } else {
        setActionError(data.message ?? 'Action failed. Please try again.');
      }
    } catch {
      setActionError('Network error — please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const payDeposit = async () => {
    if (!id || !token) return;
    setPaymentLoading(true);
    try {
      const API_BASE = import.meta.env.VITE_API_URL
        ? `${import.meta.env.VITE_API_URL}/api/v1`
        : '/api/v1';
      const res = await fetch(`${API_BASE}/stripe/checkout/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bookingId: id }),
      });
      const data = await res.json();
      if (data.success && data.data?.url) {
        window.location.href = data.data.url;
      } else {
        setActionError(data.error ?? 'Unable to start payment. Please try again.');
        setPaymentLoading(false);
      }
    } catch {
      setActionError('Network error — please try again.');
      setPaymentLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!booking || !token) return;
    try {
      const res = await fetch(`/api/v1/bookings/${booking.id}/confirmation-pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to download');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FESTV-Booking-${booking.id.slice(0, 8).toUpperCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setToastMessage('Failed to download PDF. Please try again.');
    }
  };

  // ── States ───────────────────────────────────────────────────────────────────

  if (loading) return <Skeleton />;

  if (notFound || !booking) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-center px-6">
        <h1 className="font-serif text-3xl text-dark">Booking not found</h1>
        <p className="font-sans text-sm text-muted mt-3">
          This booking doesn't exist or you don't have access to it.
        </p>
        <Link
          to={dashboardLink}
          className="mt-6 font-sans text-xs text-gold hover:text-gold-dark transition-colors underline"
        >
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const currentStatus = status ?? booking.status;
  const badge = STATUS[currentStatus] ?? STATUS.PENDING_DEPOSIT;
  const eventLabel = EVENT_TYPE_LABEL[booking.eventType] ?? booking.eventType?.replace(/_/g, ' ');
  const vendor = booking.providerProfile;
  const client = booking.client;
  const pkg = booking.package;
  const quote = booking.quote;
  const vendorMessage = quote?.vendorMessage ?? booking.vendorNotes;

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-6 py-10">

        {/* Back link */}
        <Link
          to={dashboardLink}
          className="font-sans text-xs text-gold hover:text-gold-dark transition-colors"
        >
          ← Back to dashboard
        </Link>

        {/* Page title + status */}
        <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
          <h1 className="font-serif text-3xl text-dark">Booking Details</h1>
          <span className={`font-sans text-xs font-semibold px-3 py-1.5 rounded-md ${badge.cls}`}>
            {badge.label}
          </span>
        </div>

        {/* ── CLIENT: PENDING_DEPOSIT — Confirmation hero ───────────────────── */}
        {isClient && currentStatus === 'PENDING_DEPOSIT' && (
          <>
            <div className="text-center py-12 px-8 bg-white border border-border rounded-md mt-6">
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
              >
                <CheckCircle size={64} className="text-gold mx-auto" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <p className="font-serif text-4xl text-dark font-light mt-4">
                  Your booking is confirmed!
                </p>
                <p className="font-serif text-2xl text-muted mt-2">
                  {format(parseISO(booking.eventDate), 'EEEE, MMMM d')} · {booking.guestCount} guests
                </p>
                {vendor && (
                  <p className="font-sans text-sm text-muted mt-1">
                    with {vendor.businessName}
                  </p>
                )}

                <div className="w-16 border-t border-gold mx-auto my-8" />

                <p className="font-sans text-sm text-muted">
                  To lock in your date, pay your deposit
                </p>
                <p className="font-serif text-4xl text-gold-dark font-light mt-2">
                  {fmt(booking.depositAmount)}
                </p>
                <p className="font-sans text-xs text-muted mt-1">
                  10% of {fmt(booking.total)}
                </p>

                <button
                  onClick={payDeposit}
                  disabled={paymentLoading}
                  className="w-full bg-gold text-dark font-sans text-xs font-bold uppercase tracking-widest py-4 rounded-md hover:bg-gold-dark transition-colors mt-6 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {paymentLoading ? 'Redirecting to payment…' : `Pay Deposit — ${fmt(booking.depositAmount)}`}
                </button>
              </motion.div>
            </div>

            {/* What happens next */}
            <div className="bg-white border border-border rounded-md p-8 mt-4">
              <p className="font-sans text-xs font-bold uppercase tracking-widest text-muted mb-8">
                What Happens Next
              </p>
              <div className="space-y-0">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center flex-shrink-0">
                      <span className="font-sans text-xs font-bold text-dark">1</span>
                    </div>
                    <div className="w-px flex-1 bg-border mt-2" />
                  </div>
                  <div className="pb-8">
                    <p className="font-sans text-sm font-bold text-dark">Pay your deposit</p>
                    <p className="font-sans text-xs text-muted mt-0.5">
                      Secure your date with a {fmt(booking.depositAmount)} deposit
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-border flex items-center justify-center flex-shrink-0">
                      <span className="font-sans text-xs font-bold text-muted">2</span>
                    </div>
                    <div className="w-px flex-1 bg-border mt-2" />
                  </div>
                  <div className="pb-8">
                    <p className="font-sans text-sm font-bold text-muted">Booking confirmed</p>
                    <p className="font-sans text-xs text-muted mt-0.5">
                      Your vendor will confirm once the deposit is received
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-border flex items-center justify-center flex-shrink-0">
                      <span className="font-sans text-xs font-bold text-muted">3</span>
                    </div>
                  </div>
                  <div>
                    <p className="font-sans text-sm font-bold text-muted">Enjoy your event</p>
                    <p className="font-sans text-xs text-muted mt-0.5">
                      {eventLabel} on {format(parseISO(booking.eventDate), 'MMMM d, yyyy')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Cancel option */}
            <div className="mt-4">
              <button
                onClick={() =>
                  doAction(
                    bookingsApi.cancel,
                    'CANCELLED',
                    'Are you sure you want to cancel this booking? This cannot be undone.',
                  )
                }
                disabled={actionLoading}
                className="w-full border border-red text-red font-sans text-xs font-bold uppercase tracking-widest py-3 rounded-md hover:bg-red/5 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Cancelling…' : 'Cancel Booking'}
              </button>
            </div>
          </>
        )}

        {/* ── CLIENT: CONFIRMED ────────────────────────────────────────────────── */}
        {isClient && (currentStatus === 'CONFIRMED' || currentStatus === 'IN_PROGRESS') && (
          <div className="text-center py-10 px-8 bg-white border border-border rounded-md mt-6">
            <CheckCircle size={48} className="text-green mx-auto" />
            <p className="font-serif text-3xl text-dark mt-4">You're all set!</p>
            <p className="font-sans text-sm text-muted mt-2">
              {eventLabel}{vendor ? ` with ${vendor.businessName}` : ''} on{' '}
              {format(parseISO(booking.eventDate), 'MMMM d, yyyy')}
            </p>
            <button
              onClick={() => setToastMessage('Calendar integration coming soon!')}
              className="mt-6 border border-gold text-gold-dark font-sans text-xs font-bold uppercase tracking-widest px-8 py-3 rounded-md hover:bg-gold/5 transition-colors"
            >
              Add to Calendar
            </button>
            <button
              onClick={handleDownloadPdf}
              className="mt-3 border border-border text-muted font-sans text-xs font-bold uppercase tracking-widest px-8 py-3 rounded-md hover:border-gold hover:text-gold-dark transition-colors"
            >
              Download Confirmation PDF
            </button>
          </div>
        )}

        {/* ── Booking Summary Card ─────────────────────────────────────────── */}
        <div className="bg-white border border-border rounded-md p-8 mt-6">

          {/* Event details */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-sans text-xs border border-border rounded-md px-2.5 py-0.5 text-muted">
                {eventLabel}
              </span>
              {pkg && (
                <span className="font-sans text-sm font-bold uppercase tracking-wide text-dark">
                  {pkg.name}
                </span>
              )}
            </div>
            <p className="font-serif text-2xl text-dark">
              {format(parseISO(booking.eventDate), 'EEEE, MMMM d, yyyy')}
            </p>
            <p className="font-sans text-sm text-muted mt-1">
              {booking.guestCount} guests
              {booking.durationHours ? ` · ${booking.durationHours}h` : ''}
            </p>
          </div>

          {/* Vendor / Client info */}
          {isClient && vendor && (
            <div className="flex items-center gap-3 mt-4 py-4 border-t border-border">
              {vendor.logoUrl ? (
                <img
                  src={vendor.logoUrl}
                  alt={vendor.businessName}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-border"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0">
                  <span className="font-serif text-gold-dark text-sm">
                    {vendor.businessName.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <Link
                  to={`/providers/${vendor.id}`}
                  className="font-serif text-lg text-dark hover:text-gold-dark transition-colors"
                >
                  {vendor.businessName}
                </Link>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <ProviderTypeBadge type={vendor.primaryType} size="sm" />
                  {vendor.user?.city && (
                    <span className="font-sans text-xs text-muted">
                      {vendor.user.city}{vendor.user.state ? `, ${vendor.user.state}` : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {isProvider && client && (
            <div className="flex items-center gap-3 mt-4 py-4 border-t border-border">
              <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0">
                <span className="font-serif text-gold-dark text-sm">
                  {initials(client.firstName, client.lastName)}
                </span>
              </div>
              <div>
                <p className="font-sans text-sm font-semibold text-dark">
                  {client.firstName} {client.lastName}
                </p>
                <p className="font-sans text-xs text-muted">{client.email}</p>
              </div>
            </div>
          )}

          {/* Price breakdown */}
          <div className="border-t border-border my-6" />

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="font-sans text-sm text-charcoal">Package price</span>
              <span className="font-serif text-lg text-dark">{fmt(booking.packagePrice)}</span>
            </div>

            {booking.addOnsTotal > 0 && (
              <div className="flex items-baseline justify-between">
                <span className="font-sans text-sm text-charcoal">Add-ons</span>
                <span className="font-sans text-sm text-dark">{fmt(booking.addOnsTotal)}</span>
              </div>
            )}

            {booking.adjustmentsTotal !== 0 && (
              <div className="flex items-baseline justify-between">
                <span className="font-sans text-sm text-charcoal">Adjustments</span>
                <span className={`font-sans text-sm ${booking.adjustmentsTotal < 0 ? 'text-green' : 'text-dark'}`}>
                  {booking.adjustmentsTotal < 0
                    ? `−${fmt(Math.abs(booking.adjustmentsTotal))}`
                    : fmt(booking.adjustmentsTotal)}
                </span>
              </div>
            )}

            <div className="border-t border-border pt-3 mt-2 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="font-sans text-sm text-charcoal">Subtotal</span>
                <span className="font-sans text-sm text-dark">{fmt(booking.subtotal)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="font-sans text-sm text-charcoal">Tax (15%)</span>
                <span className="font-sans text-sm text-dark">{fmt(booking.tax)}</span>
              </div>
            </div>

            <div className="border-t border-border pt-4 mt-2">
              <div className="flex items-baseline justify-between">
                <span className="font-sans text-sm font-bold uppercase tracking-widest text-dark">Total</span>
                <span className="font-serif text-2xl text-dark font-semibold">{fmt(booking.total)}</span>
              </div>
              <div className="flex items-start justify-between mt-3">
                <div>
                  <span className="font-sans text-sm text-muted">Deposit (10%)</span>
                  {booking.depositPaidAt && (
                    <p className="font-sans text-xs text-green mt-0.5">
                      Paid {format(parseISO(booking.depositPaidAt), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
                <span className="font-serif text-lg text-gold-dark">{fmt(booking.depositAmount)}</span>
              </div>
            </div>
          </div>

          {/* Special requests */}
          {booking.specialRequests && (
            <div className="mt-6">
              <p className="font-sans text-xs font-bold uppercase tracking-widest text-charcoal mb-3">
                Special Requests
              </p>
              <div className="bg-bg rounded-md p-4">
                <p className="font-sans text-sm text-charcoal italic leading-relaxed">
                  {booking.specialRequests}
                </p>
              </div>
            </div>
          )}

          {/* Vendor message */}
          {vendorMessage && vendor && (
            <div className="mt-6 pl-4 border-l-2 border-gold">
              <p className="font-sans text-xs uppercase tracking-widest text-muted mb-1">
                A note from {vendor.businessName}:
              </p>
              <p className="font-sans text-sm text-charcoal italic leading-relaxed">
                {vendorMessage}
              </p>
            </div>
          )}

          {/* ── Error message ──────────────────────────────────────────────── */}
          {actionError && (
            <p className="mt-4 font-sans text-xs text-red">{actionError}</p>
          )}

          {/* ── VENDOR ACTIONS ─────────────────────────────────────────────── */}
          {isProvider && (
            <div className="mt-6 space-y-2">
              {currentStatus === 'PENDING_DEPOSIT' && (
                <button
                  onClick={() => doAction(bookingsApi.markDepositPaid, 'DEPOSIT_PAID')}
                  disabled={actionLoading}
                  className="w-full bg-gold text-dark font-sans text-xs font-bold uppercase tracking-widest py-3 rounded-md hover:bg-gold-dark transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Updating…' : 'Mark Deposit Received'}
                </button>
              )}

              {currentStatus === 'DEPOSIT_PAID' && (
                <button
                  onClick={() => doAction(bookingsApi.confirm, 'CONFIRMED')}
                  disabled={actionLoading}
                  className="w-full bg-gold text-dark font-sans text-xs font-bold uppercase tracking-widest py-3 rounded-md hover:bg-gold-dark transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Updating…' : 'Confirm Booking'}
                </button>
              )}

              {currentStatus === 'CONFIRMED' && (
                <button
                  onClick={() => doAction(bookingsApi.complete, 'COMPLETED')}
                  disabled={actionLoading}
                  className="w-full bg-gold text-dark font-sans text-xs font-bold uppercase tracking-widest py-3 rounded-md hover:bg-gold-dark transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Updating…' : 'Mark as Completed'}
                </button>
              )}

              {(currentStatus === 'CONFIRMED' || currentStatus === 'DEPOSIT_PAID' || currentStatus === 'PENDING_DEPOSIT') && (
                <button
                  onClick={() =>
                    doAction(
                      bookingsApi.cancel,
                      'CANCELLED',
                      'Are you sure you want to cancel this booking? This cannot be undone.',
                    )
                  }
                  disabled={actionLoading}
                  className="w-full border border-red text-red font-sans text-xs font-bold uppercase tracking-widest py-3 rounded-md hover:bg-red/5 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Cancelling…' : 'Cancel Booking'}
                </button>
              )}
            </div>
          )}

          {/* ── CLIENT ACTIONS (non-PENDING_DEPOSIT) ───────────────────────── */}
          {isClient && currentStatus === 'DEPOSIT_PAID' && (
            <div className="mt-6">
              <button
                onClick={() =>
                  doAction(
                    bookingsApi.cancel,
                    'CANCELLED',
                    'Are you sure you want to cancel this booking? This cannot be undone.',
                  )
                }
                disabled={actionLoading}
                className="w-full border border-red text-red font-sans text-xs font-bold uppercase tracking-widest py-3 rounded-md hover:bg-red/5 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Cancelling…' : 'Cancel Booking'}
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Toast */}
      {toastMessage && (
        <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
      )}
    </div>
  );
}
