import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Clock, ArrowLeft, Users, Timer, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { eventRequestsApi } from '../utils/api';
import { ProviderTypeBadge } from '../components/ProviderTypeBadge';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Quote {
  id: string;
  version: number;
  status: string;
  total: number;
  depositAmount: number;
  expiresAt?: string;
  rejectionReason?: string | null;
}

interface EventRequest {
  id: string;
  status: string;
  eventType: string;
  eventDate: string;
  guestCount: number;
  calculatedEstimate?: number;
  isOutOfParameters: boolean;
  specialRequests?: string;
  package?: { name: string; pricingModel: string; durationHours?: number };
  providerProfile: {
    id: string;
    businessName: string;
    primaryType: string;
    logoUrl?: string;
    user?: { city?: string };
  };
  quotes: Quote[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const cad = (n: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);

const EVENT_TYPE_LABEL = (t: string) =>
  t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const PRICING_MODEL_LABEL: Record<string, string> = {
  PER_PERSON:           'Per Person',
  FLAT_RATE:            'Flat Rate',
  PER_HOUR:             'Per Hour',
  FLAT_PLUS_PER_PERSON: 'Flat + Per Person',
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING:    { label: 'Awaiting Response', className: 'bg-gold/10 text-gold-dark' },
  QUOTE_SENT: { label: 'Quote Received',    className: 'bg-blue-50 text-blue-700' },
  ACCEPTED:   { label: 'Accepted',          className: 'bg-green/10 text-green' },
  DECLINED:   { label: 'Declined',          className: 'bg-red/10 text-red' },
  EXPIRED:    { label: 'Expired',           className: 'bg-muted/10 text-muted' },
};

const QUOTE_STATUS: Record<string, { label: string; className: string }> = {
  PENDING:                  { label: 'Pending',            className: 'bg-gold/10 text-gold-dark' },
  PENDING_VENDOR_APPROVAL:  { label: 'Pending Approval',   className: 'bg-gold/10 text-gold-dark' },
  ACCEPTED:                 { label: 'Accepted',           className: 'bg-green/10 text-green' },
  REJECTED:                 { label: 'Declined',           className: 'bg-red/10 text-red' },
  EXPIRED:                  { label: 'Expired',            className: 'bg-muted/10 text-muted' },
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10 animate-pulse">
      <div className="h-4 w-32 bg-border rounded mb-6" />
      <div className="h-8 w-64 bg-border rounded mb-2" />
      <div className="h-5 w-24 bg-border rounded mb-8" />
      <div className="bg-white border border-border rounded-md p-8 space-y-4">
        <div className="h-5 w-48 bg-border rounded" />
        <div className="h-8 w-40 bg-border rounded" />
        <div className="h-5 w-32 bg-border rounded" />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EventRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();

  const [request, setRequest]       = useState<EventRequest | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!id || !token) return;
    (async () => {
      try {
        const res = await eventRequestsApi.getById(id, token) as any;
        setRequest(res?.data ?? res);
      } catch {
        setError('Request not found.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, token]);

  const handleCancel = async () => {
    if (!id || !token) return;
    setCancelling(true);
    try {
      await eventRequestsApi.updateStatus(id, 'EXPIRED', token);
      setRequest(prev => prev ? { ...prev, status: 'EXPIRED' } : prev);
    } catch {
      /* silent */
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <div className="bg-bg min-h-screen"><Skeleton /></div>;
  if (error || !request) {
    return (
      <div className="bg-bg min-h-screen flex items-center justify-center">
        <p className="font-sans text-muted">{error || 'Request not found.'}</p>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[request.status] ?? STATUS_CONFIG.PENDING;
  const vendor    = request.providerProfile;
  const pkg       = request.package;
  const initials  = vendor.businessName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="bg-bg min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-10">

        {/* Back */}
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-gold text-xs font-sans uppercase tracking-widest hover:text-gold-dark transition-colors"
        >
          <ArrowLeft size={12} strokeWidth={2} />
          Back to dashboard
        </Link>

        {/* Heading */}
        <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="font-sans text-xs uppercase tracking-widest text-muted mb-1">
              {EVENT_TYPE_LABEL(request.eventType)}
            </p>
            <h1 className="font-serif text-3xl text-dark leading-tight">
              {vendor.businessName}
            </h1>
          </div>
          <span className={`font-sans text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full ${statusCfg.className}`}>
            {statusCfg.label}
          </span>
        </div>

        {/* Request summary card */}
        <div className="bg-white border border-border rounded-md p-8 mt-6 space-y-5">

          {pkg && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-sans font-semibold text-sm text-dark">{pkg.name}</span>
              <span className="font-sans text-xs px-2 py-0.5 rounded-full bg-bg text-muted border border-border">
                {PRICING_MODEL_LABEL[pkg.pricingModel] ?? pkg.pricingModel}
              </span>
            </div>
          )}

          <div>
            <p className="font-sans text-xs uppercase tracking-widest text-muted mb-1">Event Date</p>
            <p className="font-serif text-2xl text-dark">
              {format(new Date(request.eventDate), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>

          <div className="flex items-center gap-6 text-sm font-sans text-charcoal flex-wrap">
            <span className="flex items-center gap-1.5">
              <Users size={14} className="text-muted" />
              {request.guestCount} guests
            </span>
            {pkg?.durationHours && (
              <span className="flex items-center gap-1.5">
                <Timer size={14} className="text-muted" />
                {pkg.durationHours}h
              </span>
            )}
          </div>

          {request.calculatedEstimate != null && (
            <div>
              <p className="font-sans text-xs uppercase tracking-widest text-muted mb-1">Estimated Total</p>
              <p className="font-serif text-2xl text-gold-dark font-semibold">
                Est. {cad(request.calculatedEstimate)}
              </p>
            </div>
          )}

          {request.isOutOfParameters && (
            <div className="bg-gold/10 border border-gold/30 rounded-md p-4">
              <p className="font-sans text-sm text-gold-dark leading-relaxed">
                This is a custom request — the vendor will review and respond with a personalised quote.
              </p>
            </div>
          )}

          {request.specialRequests && (
            <div className="bg-bg rounded-md p-4">
              <p className="font-sans text-xs uppercase tracking-widest text-muted mb-2">Special Requests</p>
              <p className="font-sans text-sm text-charcoal italic leading-relaxed">
                "{request.specialRequests}"
              </p>
            </div>
          )}
        </div>

        {/* Vendor */}
        <div className="bg-white border border-border rounded-md p-6 mt-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full flex-shrink-0 overflow-hidden">
            {vendor.logoUrl ? (
              <img src={vendor.logoUrl} alt={vendor.businessName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gold/10 flex items-center justify-center">
                <span className="font-serif text-gold-dark font-semibold text-sm">{initials}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-serif text-xl text-dark leading-tight">{vendor.businessName}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <ProviderTypeBadge type={vendor.primaryType} size="xs" />
              {vendor.user?.city && (
                <span className="flex items-center gap-1 font-sans text-xs text-muted">
                  <MapPin size={10} />
                  {vendor.user.city}
                </span>
              )}
            </div>
          </div>
          <Link
            to={`/providers/${vendor.id}`}
            className="text-gold text-xs font-sans font-semibold uppercase tracking-widest hover:text-gold-dark transition-colors flex-shrink-0"
          >
            View Profile →
          </Link>
        </div>

        {/* Quotes */}
        <div className="mt-8">
          <p className="font-sans text-xs font-bold uppercase tracking-widest text-charcoal mb-4">
            Quotes
          </p>

          {request.quotes.length > 0 ? (
            <div className="space-y-3">
              {request.quotes.map(quote => {
                // Vendor hasn't approved yet — show waiting state instead of price details
                if (quote.status === 'PENDING_VENDOR_APPROVAL') {
                  return (
                    <div
                      key={quote.id}
                      className="rounded-md px-4 py-3"
                      style={{ background: '#FBF7F0', border: '1px solid rgba(196,160,106,0.3)' }}
                    >
                      <p className="font-sans text-[10px] uppercase tracking-widest mb-1" style={{ color: '#C4A06A' }}>
                        Pending Approval
                      </p>
                      <p className="font-serif text-[15px]" style={{ color: '#3A3530' }}>
                        Your request has been received. The vendor is reviewing it and will respond shortly.
                      </p>
                    </div>
                  );
                }

                const qStatus = QUOTE_STATUS[quote.status] ?? QUOTE_STATUS.PENDING;
                return (
                  <div key={quote.id} className="bg-white border border-border rounded-md p-6">
                    <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                      <div className="flex items-center gap-2">
                        <span className="font-sans text-sm font-semibold text-dark">
                          Quote v{quote.version}
                        </span>
                        <span className={`font-sans text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full ${qStatus.className}`}>
                          {qStatus.label}
                        </span>
                      </div>
                      {quote.expiresAt && (
                        <span className="font-sans text-xs text-muted">
                          Expires {format(new Date(quote.expiresAt), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-end justify-between gap-4 flex-wrap">
                      <div>
                        <p className="font-sans text-xs uppercase tracking-widest text-muted mb-0.5">Total</p>
                        <p className="font-serif text-2xl text-dark">{cad(quote.total)}</p>
                        <p className="font-serif text-lg text-gold-dark mt-0.5">
                          {cad(quote.depositAmount)} deposit
                        </p>
                      </div>
                      <Link
                        to={`/quotes/${quote.id}`}
                        className="bg-gold text-dark px-4 py-2 rounded-md text-xs font-sans font-semibold uppercase tracking-widest hover:bg-gold-dark transition-colors"
                      >
                        View Quote →
                      </Link>
                    </div>
                    {quote.status === 'REJECTED' && quote.rejectionReason && (
                      <div
                        className="mt-4 px-3 py-2 rounded-sm"
                        style={{ background: '#FBF7F0', borderLeft: '2px solid #C4A06A' }}
                      >
                        <p
                          className="font-sans font-bold uppercase tracking-widest mb-1"
                          style={{ fontSize: 9, color: '#C4A06A' }}
                        >
                          Your note
                        </p>
                        <p
                          className="font-serif italic leading-snug"
                          style={{ fontSize: 14, color: '#3A3530' }}
                        >
                          {quote.rejectionReason}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border border-border rounded-md p-8 flex flex-col items-center text-center gap-3">
              <Clock size={28} strokeWidth={1.5} className="text-muted" />
              <p className="font-serif text-lg text-muted">Waiting for vendor response</p>
              <p className="font-sans text-xs text-muted leading-relaxed max-w-xs">
                Your request has been sent. The vendor will respond shortly.
              </p>
              <p className="font-sans text-xs text-muted">
                {request.isOutOfParameters
                  ? 'Custom requests may take 24–48 hours.'
                  : 'Standard requests typically receive an instant quote.'}
              </p>
            </div>
          )}
        </div>

        {/* Cancel */}
        {request.status === 'PENDING' && (
          <div className="mt-6 text-center">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="font-sans text-xs text-muted hover:text-red transition-colors disabled:opacity-50"
            >
              {cancelling ? 'Cancelling…' : 'Cancel Request'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
