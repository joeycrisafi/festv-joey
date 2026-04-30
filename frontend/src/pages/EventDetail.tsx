import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { UtensilsCrossed, Wine, Music, Camera, Flower2, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { eventsApi } from '../utils/api';

// ─── Currency / date helpers ──────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(n);

const fmtDate = (iso: string) =>
  format(parseISO(iso), 'MMMM d, yyyy');

// ─── Vendor type meta ─────────────────────────────────────────────────────────

const VENDOR_TYPE_META: Record<string, { label: string; Icon: React.ElementType; browseLabel: string }> = {
  RESTO_VENUE:   { label: 'Restaurant / Venue', Icon: UtensilsCrossed, browseLabel: 'Venue' },
  CATERER:       { label: 'Caterer',            Icon: Wine,            browseLabel: 'Caterer' },
  ENTERTAINMENT: { label: 'Entertainment',      Icon: Music,           browseLabel: 'Entertainment' },
  PHOTO_VIDEO:   { label: 'Photo & Video',      Icon: Camera,          browseLabel: 'Photographer' },
  FLORIST_DECOR: { label: 'Florist & Decor',    Icon: Flower2,         browseLabel: 'Florist' },
};

// ─── Status configs ───────────────────────────────────────────────────────────

const EVENT_STATUS_CFG: Record<string, { label: string; cls: string }> = {
  PLANNING:   { label: 'Planning',   cls: 'bg-gold/10 text-gold-dark border border-gold/30' },
  CONFIRMED:  { label: 'Confirmed',  cls: 'bg-green/10 text-green border border-green/30' },
  COMPLETED:  { label: 'Completed',  cls: 'bg-charcoal/10 text-charcoal border border-charcoal/20' },
  CANCELLED:  { label: 'Cancelled',  cls: 'bg-red/10 text-red border border-red/30' },
};

const REQUEST_STATUS_CFG: Record<string, { label: string; cls: string }> = {
  PENDING:    { label: 'Pending',    cls: 'bg-gold/10 text-gold-dark border border-gold/30' },
  QUOTE_SENT: { label: 'Quote Sent', cls: 'bg-green/10 text-green border border-green/30' },
  ACCEPTED:   { label: 'Accepted',   cls: 'bg-charcoal/10 text-charcoal border border-charcoal/20' },
  DECLINED:   { label: 'Declined',   cls: 'bg-red/10 text-red border border-red/30' },
  EXPIRED:    { label: 'Expired',    cls: 'bg-muted/10 text-muted border border-muted/20' },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventQuote {
  id: string;
  status: string;
  total: number;
  depositAmount: number;
  version: number;
  expiresAt?: string;
  createdAt: string;
}

interface EventRequest {
  id: string;
  eventType: string;
  eventDate: string;
  guestCount: number;
  status: string;
  calculatedEstimate?: number;
  eventId?: string;
  package?: { id: string; name: string; category: string; pricingModel: string; basePrice: number };
  providerProfile?: { id: string; businessName: string; primaryType?: string; logoUrl?: string; averageRating?: number };
  quotes?: EventQuote[];
}

interface EventData {
  id: string;
  name: string;
  eventType: string;
  eventDate: string;
  guestCount: number;
  notes?: string;
  status: string;
  requests: EventRequest[];
  _count: { requests: number };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="bg-white border border-border rounded-md p-5 animate-pulse flex items-center gap-4">
      <div className="w-10 h-10 rounded-md bg-bg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-bg rounded w-1/3" />
        <div className="h-3 bg-bg rounded w-1/4" />
      </div>
      <div className="h-7 w-24 bg-bg rounded-md" />
    </div>
  );
}

// ─── Vendor row ───────────────────────────────────────────────────────────────

function VendorRow({
  vendorType,
  eventId,
  eventType: _eventType,
  request,
}: {
  vendorType: string;
  eventId: string;
  eventType: string;
  request?: EventRequest;
}) {
  const meta = VENDOR_TYPE_META[vendorType];
  if (!meta) return null;
  const { label, Icon, browseLabel } = meta;

  const latestQuote = request?.quotes?.[0];

  return (
    <div className="bg-white border border-border rounded-md p-5 flex items-center gap-4">
      {/* Icon */}
      <div className="w-10 h-10 bg-gold/10 rounded-md flex items-center justify-center flex-shrink-0">
        <Icon size={18} className="text-gold" strokeWidth={1.5} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-sans text-sm font-semibold text-dark">{label}</p>

        {request ? (
          <>
            <p className="font-sans text-xs text-charcoal mt-0.5">
              {request.providerProfile?.businessName ?? 'Vendor'}
              {request.package?.name ? ` — ${request.package.name}` : ''}
            </p>
            {request.calculatedEstimate != null && (
              <p className="font-serif text-base text-gold-dark mt-0.5">
                {fmt(request.calculatedEstimate)}
              </p>
            )}
          </>
        ) : (
          <p className="font-sans text-xs text-muted mt-0.5">No vendor selected yet</p>
        )}
      </div>

      {/* Right: status + CTA */}
      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        {request ? (
          <>
            <span
              className={`font-sans text-xs px-2.5 py-0.5 rounded-md ${
                REQUEST_STATUS_CFG[request.status]?.cls ?? 'bg-muted/10 text-muted border border-muted/20'
              }`}
            >
              {REQUEST_STATUS_CFG[request.status]?.label ?? request.status}
            </span>

            {latestQuote && request.status === 'QUOTE_SENT' && (
              <Link
                to={`/event-requests/${request.id}`}
                className="font-sans text-xs text-gold hover:text-gold-dark font-semibold transition-colors"
              >
                View Quote →
              </Link>
            )}
            {request.status === 'ACCEPTED' && (
              <Link
                to={`/event-requests/${request.id}`}
                className="font-sans text-xs text-gold hover:text-gold-dark font-semibold transition-colors"
              >
                View Booking →
              </Link>
            )}
          </>
        ) : (
          <Link
            to={`/providers?type=${vendorType}&eventId=${eventId}`}
            className="bg-gold text-dark font-sans text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-md hover:bg-gold-dark transition-colors whitespace-nowrap"
          >
            Browse {browseLabel}s →
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();

  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Vendor types saved from CreateEvent
  const vendorsNeeded: string[] = id
    ? JSON.parse(localStorage.getItem(`festv_event_vendors_needed_${id}`) ?? '[]')
    : [];

  useEffect(() => {
    if (!id || !token) return;
    eventsApi.getById(id, token)
      .then((res: any) => {
        if (res.success) setEvent(res.data);
        else setError(res.error ?? 'Failed to load event');
      })
      .catch(() => setError('Failed to load event'))
      .finally(() => setLoading(false));
  }, [id, token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg px-6 md:px-12 py-8 max-w-4xl mx-auto">
        <div className="h-3 bg-white rounded w-24 mb-8 animate-pulse" />
        <div className="h-10 bg-white rounded w-1/2 mb-4 animate-pulse" />
        <div className="space-y-3 mt-8">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <p className="font-serif text-xl text-muted">{error ?? 'Event not found'}</p>
          <Link to="/dashboard" className="font-sans text-xs text-gold mt-4 inline-block">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Build the display list of vendor categories
  // Priority: vendorsNeeded (from localStorage) → fall back to unique types on requests
  const requestTypes = event.requests.map(r => r.providerProfile?.primaryType).filter(Boolean) as string[];
  const allTypes = vendorsNeeded.length > 0
    ? vendorsNeeded
    : [...new Set(requestTypes)];

  // Map vendor type → request (if exists)
  const requestByType: Record<string, EventRequest> = {};
  for (const req of event.requests) {
    const type = req.providerProfile?.primaryType;
    if (type && !requestByType[type]) requestByType[type] = req;
  }

  // Unlinked requests (not belonging to this event's vendorsNeeded display)
  const displayedTypes = new Set(allTypes);
  const unlinkedRequests = event.requests.filter(
    r => r.providerProfile?.primaryType && !displayedTypes.has(r.providerProfile.primaryType)
  );

  // Total estimate from all linked requests
  const totalEstimate = event.requests.reduce(
    (sum, r) => sum + (r.calculatedEstimate ?? 0),
    0
  );

  const bookedCount = event.requests.filter(r => r.status === 'ACCEPTED').length;

  const eventStatusCfg = EVENT_STATUS_CFG[event.status] ?? EVENT_STATUS_CFG.PLANNING;

  const eventTypeLabel = event.eventType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="min-h-screen bg-bg px-6 md:px-12 py-8">
      <div className="max-w-4xl mx-auto">

        {/* Back link */}
        <Link
          to="/dashboard"
          className="font-sans text-xs text-gold hover:text-gold-dark transition-colors"
        >
          ← My Events
        </Link>

        {/* Event header */}
        <div className="mt-4 mb-8">
          <div className="flex flex-wrap items-start gap-3">
            <h1 className="font-serif text-4xl text-dark leading-tight">{event.name}</h1>
            <span className={`font-sans text-xs px-2.5 py-1 rounded-md mt-2 ${eventStatusCfg.cls}`}>
              {eventStatusCfg.label}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-3">
            <span className="font-sans text-sm text-muted">{eventTypeLabel}</span>
            <span className="text-border">·</span>
            <span className="font-sans text-sm text-muted">{fmtDate(event.eventDate)}</span>
            <span className="text-border">·</span>
            <span className="font-sans text-sm text-muted flex items-center gap-1">
              <Users size={13} strokeWidth={1.5} />
              {event.guestCount} guests
            </span>
          </div>
        </div>

        {/* Vendor categories */}
        <div className="mb-8">
          <p className="font-sans text-xs font-bold uppercase tracking-widest text-charcoal mb-4">
            Your Vendors
          </p>

          {allTypes.length === 0 ? (
            <div className="bg-white border border-border rounded-md p-8 text-center">
              <p className="font-sans text-sm text-muted mb-4">
                No vendor categories selected. Browse vendors to get started.
              </p>
              <Link
                to={`/providers?eventId=${event.id}`}
                className="bg-gold text-dark font-sans text-xs font-bold uppercase tracking-widest px-6 py-2.5 rounded-md hover:bg-gold-dark transition-colors inline-block"
              >
                Browse All Vendors
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {allTypes.map(type => (
                <VendorRow
                  key={type}
                  vendorType={type}
                  eventId={event.id}
                  eventType={event.eventType}
                  request={requestByType[type]}
                />
              ))}
            </div>
          )}
        </div>

        {/* Unlinked requests from other vendor types */}
        {unlinkedRequests.length > 0 && (
          <div className="mb-8">
            <p className="font-sans text-xs font-bold uppercase tracking-widest text-charcoal mb-4">
              Other Requests
            </p>
            <div className="space-y-3">
              {unlinkedRequests.map(req => (
                <VendorRow
                  key={req.id}
                  vendorType={req.providerProfile?.primaryType ?? ''}
                  eventId={event.id}
                  eventType={event.eventType}
                  request={req}
                />
              ))}
            </div>
          </div>
        )}

        {/* Total estimate */}
        {totalEstimate > 0 && (
          <div className="bg-white border border-border rounded-md p-6 mb-6">
            <p className="font-sans text-xs font-bold uppercase tracking-widest text-charcoal mb-2">
              Total Estimate
            </p>
            <p className="font-serif text-3xl text-gold-dark">{fmt(totalEstimate)}</p>
            <p className="font-sans text-xs text-muted mt-1">
              Based on current estimates — final quotes may vary
            </p>
            {bookedCount > 0 && (
              <p className="font-sans text-xs text-green mt-2 font-semibold">
                {bookedCount} of {event._count.requests} vendor{event._count.requests !== 1 ? 's' : ''} confirmed
              </p>
            )}
          </div>
        )}

        {/* Notes */}
        {event.notes && (
          <div className="bg-white border border-border rounded-md p-6">
            <p className="font-sans text-xs font-bold uppercase tracking-widest text-charcoal mb-3">
              Your Notes
            </p>
            <p className="font-sans text-sm text-charcoal leading-relaxed whitespace-pre-line">
              {event.notes}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
