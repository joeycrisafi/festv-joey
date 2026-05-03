import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { format, parseISO, isPast } from 'date-fns';
import { CheckCircle, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { quotesApi } from '../utils/api';
import { ProviderTypeBadge } from '../components/ProviderTypeBadge';

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(n);

// ── Types ─────────────────────────────────────────────────────────────────────

interface AddOnLineItem {
  addOnId: string;
  name: string;
  pricingType: string;
  price: number;
  quantity: number;
  total: number;
}

interface Adjustment {
  description: string;
  amount: number;
}

type QuoteStatus = 'DRAFT' | 'PENDING_VENDOR_APPROVAL' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

interface QuoteData {
  id: string;
  version: number;
  status: QuoteStatus;
  eventDate: string;
  guestCount: number;
  durationHours?: number | null;
  packagePrice: number;
  minimumSpend?: number | null;
  addOns: AddOnLineItem[];
  addOnsTotal: number;
  adjustments: Adjustment[];
  adjustmentsTotal: number;
  subtotal: number;
  tax: number;
  total: number;
  depositAmount: number;
  isOutOfParameters: boolean;
  vendorMessage?: string | null;
  rejectionReason?: string | null;
  expiresAt?: string | null;
  providerProfile: {
    id: string;
    businessName: string;
    primaryType: string;
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
  eventRequest?: {
    id: string;
    eventType: string;
    specialRequests?: string | null;
  } | null;
}

// ── Status badge config ───────────────────────────────────────────────────────

const STATUS_BADGE: Record<QuoteStatus, { label: string; cls: string }> = {
  DRAFT:                   { label: 'Draft',            cls: 'bg-muted/10 text-muted border border-muted/20' },
  PENDING_VENDOR_APPROVAL: { label: 'Pending Approval', cls: 'bg-gold/10 text-gold-dark border border-gold/30' },
  SENT:                    { label: 'Sent',             cls: 'bg-gold/10 text-gold-dark border border-gold/30' },
  VIEWED:                  { label: 'Viewed',           cls: 'bg-charcoal/10 text-charcoal border border-charcoal/20' },
  ACCEPTED:                { label: 'Accepted',         cls: 'bg-green/10 text-green border border-green/30' },
  REJECTED:                { label: 'Declined',         cls: 'bg-red/10 text-red border border-red/30' },
  EXPIRED:                 { label: 'Expired',          cls: 'bg-muted/10 text-muted border border-muted/20' },
};

const PRICING_MODEL_LABEL: Record<string, string> = {
  PER_PERSON:          'Per Person',
  FLAT_RATE:           'Flat Rate',
  PER_HOUR:            'Per Hour',
  FLAT_PLUS_PER_PERSON:'Flat + Per Person',
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
        <div className="h-8 bg-border rounded w-2/3" />
        <div className="bg-white border border-border rounded-md p-8 space-y-4">
          <div className="h-3 bg-bg rounded w-24" />
          <div className="h-4 bg-bg rounded w-1/2" />
          <div className="border-t border-border my-4" />
          {[0,1,2,3,4].map(i => (
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

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [status, setStatus] = useState<QuoteStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [acceptedBookingId, setAcceptedBookingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const isClient = user?.role === 'CLIENT';

  useEffect(() => {
    if (!id || !token) return;
    const load = async () => {
      try {
        const res = await quotesApi.getById(id, token);
        const data = res as { success: boolean; data?: QuoteData; message?: string };
        if (data.success && data.data) {
          setQuote(data.data);
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

  const handleAccept = async () => {
    if (!id || !token) return;
    setAccepting(true);
    setActionError(null);
    try {
      const res = await quotesApi.accept(id, token);
      const data = res as { success: boolean; data?: { id: string }; booking?: { id: string }; message?: string };
      if (data.success) {
        const bookingId = data.data?.id ?? data.booking?.id ?? null;
        setAccepted(true);
        setAcceptedBookingId(bookingId);
        setStatus('ACCEPTED');
      } else {
        setActionError(data.message ?? 'Failed to accept quote. Please try again.');
      }
    } catch {
      setActionError('Network error — please try again.');
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!id || !token) return;
    setDeclining(true);
    setActionError(null);
    try {
      const res = await quotesApi.reject(id, token, rejectionReason.trim() || undefined);
      const data = res as { success: boolean; message?: string };
      if (data.success) {
        setStatus('REJECTED');
        setShowDeclineForm(false);
      } else {
        setActionError(data.message ?? 'Failed to decline quote. Please try again.');
      }
    } catch {
      setActionError('Network error — please try again.');
    } finally {
      setDeclining(false);
    }
  };

  // ── States ──────────────────────────────────────────────────────────────────

  if (loading) return <Skeleton />;

  if (notFound || !quote) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-center px-6">
        <h1 className="font-serif text-3xl text-dark">Quote not found</h1>
        <p className="font-sans text-sm text-muted mt-3">
          This quote doesn't exist or you don't have access to it.
        </p>
        <Link
          to="/dashboard"
          className="mt-6 font-sans text-xs text-gold hover:text-gold-dark transition-colors underline"
        >
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const currentStatus = status ?? quote.status;
  const badge = STATUS_BADGE[currentStatus] ?? STATUS_BADGE.DRAFT;
  const canAct = isClient &&
    (currentStatus === 'SENT' || currentStatus === 'VIEWED');

  const vendor = quote.providerProfile;
  const city = vendor.user?.city;
  const state = vendor.user?.state;
  const eventType = quote.eventRequest?.eventType;
  const expiresAt = quote.expiresAt ? parseISO(quote.expiresAt) : null;
  const isExpired = expiresAt ? isPast(expiresAt) : false;

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-6 py-10">

        {/* Back link */}
        <Link
          to="/dashboard"
          className="font-sans text-xs text-gold hover:text-gold-dark transition-colors"
        >
          ← Back to dashboard
        </Link>

        {/* Vendor header */}
        <div className="mt-4">
          <h1 className="font-serif text-3xl text-dark">{vendor.businessName}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <ProviderTypeBadge type={vendor.primaryType} size="sm" />
            {city && (
              <span className="flex items-center gap-1 font-sans text-xs text-muted">
                <MapPin size={11} strokeWidth={1.5} />
                {city}{state ? `, ${state}` : ''}
              </span>
            )}
            {eventType && (
              <span className="font-sans text-xs text-muted border border-border rounded-md px-2.5 py-0.5">
                {EVENT_TYPE_LABEL[eventType] ?? eventType.replace(/_/g, ' ')}
              </span>
            )}
            <span className="font-sans text-xs text-muted">
              {format(parseISO(quote.eventDate), 'MMMM d, yyyy')}
            </span>
          </div>
        </div>

        {/* ── Accepted state ────────────────────────────────────────────────── */}
        {accepted && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center py-10 px-8 bg-white border border-gold/30 rounded-md mt-6 overflow-hidden relative"
          >
            {/* Gold shimmer bar */}
            <motion.div
              initial={{ scaleX: 0, originX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-0.5 bg-gradient-to-r from-gold via-gold-light to-gold mb-8 rounded-full"
            />

            <CheckCircle size={48} className="text-gold mx-auto" />
            <p className="font-serif text-3xl text-dark mt-4">Quote accepted!</p>
            <p className="font-sans text-sm text-muted mt-2">
              You're one step away from confirming your booking.
            </p>

            <div className="bg-gold/5 border border-gold/20 rounded-md p-6 mt-6">
              <p className="font-sans text-xs font-bold uppercase tracking-widest text-muted mb-2">
                Deposit Due
              </p>
              <p className="font-serif text-4xl text-gold-dark">{fmt(quote.depositAmount)}</p>
              <p className="font-sans text-xs text-muted mt-1">
                Pay this to lock in your date with {vendor.businessName}
              </p>
            </div>

            <button
              onClick={() => {
                if (acceptedBookingId) {
                  navigate(`/bookings/${acceptedBookingId}`);
                } else {
                  navigate('/dashboard');
                }
              }}
              className="mt-6 bg-gold text-dark font-sans text-xs font-bold uppercase tracking-widest px-8 py-3 rounded-md hover:bg-gold-dark transition-colors"
            >
              Go to Booking →
            </button>
          </motion.div>
        )}

        {/* ── Quote Summary Card ────────────────────────────────────────────── */}
        <div className="bg-white border border-border rounded-md p-8 mt-6">

          {/* Quote # + status + expiry */}
          <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
            <div>
              <p className="font-sans text-xs font-bold uppercase tracking-widest text-muted">
                Quote #{quote.version}
              </p>
              {expiresAt && (
                <p className={`font-sans text-xs mt-1 ${isExpired ? 'text-red' : 'text-muted'}`}>
                  {isExpired ? 'Expired' : 'Expires'} {format(expiresAt, 'MMMM d, yyyy')}
                </p>
              )}
            </div>
            <span className={`font-sans text-xs px-3 py-1 rounded-md ${badge.cls}`}>
              {badge.label}
            </span>
          </div>

          {/* Package line */}
          {quote.package && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-sans text-sm font-bold uppercase tracking-wide text-dark">
                {quote.package.name}
              </span>
              <span className="font-sans text-xs border border-border rounded-full px-2.5 py-0.5 text-muted">
                {PRICING_MODEL_LABEL[quote.package.pricingModel] ?? quote.package.pricingModel}
              </span>
            </div>
          )}

          {/* Guest count + duration */}
          <p className="font-sans text-xs text-muted mt-1">
            {quote.guestCount} guests
            {quote.durationHours ? ` · ${quote.durationHours}h` : ''}
          </p>

          {/* Out-of-parameters banner */}
          {quote.isOutOfParameters && (
            <div className="mt-4 bg-gold/10 border border-gold/30 rounded-md p-4">
              <p className="font-sans text-xs text-gold-dark leading-relaxed">
                Custom quote — this request had special requirements reviewed by the vendor.
              </p>
            </div>
          )}

          <div className="border-t border-border my-5" />

          {/* Line items */}
          <div className="space-y-2">
            {/* Package price */}
            <div className="flex items-baseline justify-between">
              <span className="font-sans text-sm text-charcoal">Package price</span>
              <span className="font-serif text-lg text-dark">{fmt(quote.packagePrice)}</span>
            </div>

            {/* Add-on line items */}
            {quote.addOns?.length > 0 && (
              <>
                {quote.addOns.map((addon, i) => (
                  <div key={i} className="flex items-baseline justify-between pl-4">
                    <span className="font-sans text-sm text-muted">
                      {addon.name}
                      {addon.quantity > 1 ? ` ×${addon.quantity}` : ''}
                    </span>
                    <span className="font-sans text-sm text-dark">{fmt(addon.total)}</span>
                  </div>
                ))}
                {quote.addOnsTotal > 0 && (
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="font-sans text-sm text-charcoal">Add-ons total</span>
                    <span className="font-sans text-sm text-dark">{fmt(quote.addOnsTotal)}</span>
                  </div>
                )}
              </>
            )}

            {/* Adjustments */}
            {quote.adjustments?.length > 0 && (
              <>
                {quote.adjustments.map((adj, i) => (
                  <div key={i} className="flex items-baseline justify-between">
                    <span className="font-sans text-sm text-muted">{adj.description}</span>
                    <span className={`font-sans text-sm ${adj.amount < 0 ? 'text-green' : 'text-dark'}`}>
                      {adj.amount < 0 ? `−${fmt(Math.abs(adj.amount))}` : fmt(adj.amount)}
                    </span>
                  </div>
                ))}
              </>
            )}

            <div className="border-t border-border pt-2 mt-2 space-y-2">
              {/* Subtotal */}
              <div className="flex items-baseline justify-between">
                <span className="font-sans text-sm text-charcoal">Subtotal</span>
                <span className="font-sans text-sm text-dark">{fmt(quote.subtotal)}</span>
              </div>

              {/* Tax */}
              <div className="flex items-baseline justify-between">
                <span className="font-sans text-sm text-charcoal">Tax (15%)</span>
                <span className="font-sans text-sm text-dark">{fmt(quote.tax)}</span>
              </div>
            </div>

            {/* Total */}
            <div className="border-t border-border pt-4 mt-2">
              <div className="flex items-baseline justify-between">
                <span className="font-sans text-sm font-bold uppercase tracking-widest text-dark">Total</span>
                <span className="font-serif text-2xl text-dark font-semibold">{fmt(quote.total)}</span>
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <div>
                  <span className="font-sans text-sm text-muted">Deposit (10%)</span>
                  <p className="font-sans text-xs text-muted">Due to confirm booking</p>
                </div>
                <span className="font-serif text-lg text-gold-dark">{fmt(quote.depositAmount)}</span>
              </div>
            </div>
          </div>

          {/* Vendor message */}
          {quote.vendorMessage && (
            <div className="mt-6 pl-4 border-l-2 border-gold">
              <p className="font-sans text-xs uppercase tracking-widest text-muted mb-1">
                A note from {vendor.businessName}:
              </p>
              <p className="font-sans text-sm text-charcoal italic leading-relaxed">
                {quote.vendorMessage}
              </p>
            </div>
          )}

          {/* ── Action buttons (CLIENT only, SENT or VIEWED) ─────────────────── */}
          {canAct && !accepted && (
            <div className="mt-6">
              {actionError && (
                <p className="font-sans text-xs text-red mb-3">{actionError}</p>
              )}
              <button
                onClick={handleAccept}
                disabled={accepting || declining}
                className="w-full bg-gold text-dark font-sans text-xs font-bold uppercase tracking-widest py-4 rounded-md hover:bg-gold-dark transition-colors disabled:opacity-50"
              >
                {accepting ? 'Confirming…' : 'Accept & Confirm Booking'}
              </button>
              {!showDeclineForm ? (
                <button
                  onClick={() => setShowDeclineForm(true)}
                  disabled={accepting || declining}
                  className="w-full mt-3 font-sans text-xs text-center text-muted hover:text-red transition-colors disabled:opacity-50"
                >
                  Decline Quote
                </button>
              ) : (
                <div className="mt-4 border border-border rounded-md p-4 space-y-3">
                  <p className="font-sans text-xs font-bold uppercase tracking-widest text-charcoal">
                    Reason for declining <span className="font-normal normal-case text-muted">(optional)</span>
                  </p>
                  <textarea
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Let the vendor know why you're declining…"
                    className="w-full border border-border rounded-md px-3 py-2 font-sans text-sm text-charcoal placeholder:text-muted focus:outline-none focus:border-gold resize-none"
                    style={{ background: '#F5F3EF' }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleDecline}
                      disabled={declining}
                      className="flex-1 font-sans text-xs font-bold uppercase tracking-widest py-2.5 rounded-md transition-colors disabled:opacity-50"
                      style={{ background: '#B84040', color: '#fff' }}
                    >
                      {declining ? 'Declining…' : 'Confirm Decline'}
                    </button>
                    <button
                      onClick={() => { setShowDeclineForm(false); setRejectionReason(''); }}
                      disabled={declining}
                      className="font-sans text-xs text-muted hover:text-charcoal transition-colors px-3 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Awaiting vendor approval — client view */}
          {currentStatus === 'PENDING_VENDOR_APPROVAL' && isClient && !accepted && (
            <div className="mt-6 border border-border rounded-md p-4 text-center">
              <p className="font-serif italic text-[16px] text-[#7A7068]">
                Awaiting vendor approval
              </p>
              <p className="font-sans text-[11px] text-[#B0A89E] mt-1">
                You'll be notified as soon as the vendor responds.
              </p>
            </div>
          )}

          {/* Declined state message */}
          {currentStatus === 'REJECTED' && !accepted && (
            <p className="mt-5 font-sans text-xs text-center text-muted">
              You declined this quote.{' '}
              <Link to="/providers" className="text-gold hover:text-gold-dark transition-colors">
                Browse other vendors →
              </Link>
            </p>
          )}
        </div>

        {/* ── Special requests ─────────────────────────────────────────────── */}
        {quote.eventRequest?.specialRequests && (
          <div className="mt-8">
            <p className="font-sans text-xs font-bold uppercase tracking-widest text-charcoal mb-3">
              Your Special Requests
            </p>
            <div className="bg-bg rounded-md p-4">
              <p className="font-sans text-sm text-charcoal italic leading-relaxed">
                {quote.eventRequest.specialRequests}
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Toast */}
      {toastMessage && (
        <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
      )}
    </div>
  );
}
