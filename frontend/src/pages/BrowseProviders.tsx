import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapPin, Star, CalendarDays } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProviderTypeBadge, providerTypeConfig } from '../components/ProviderTypeBadge';

// ── Currency formatter ────────────────────────────────────────────────────────
const formatPrice = (n: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(n);

// ── API base ──────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1';

// ── Event type options ────────────────────────────────────────────────────────
const EVENT_TYPES = [
  'Any',
  'Wedding',
  'Corporate',
  'Birthday',
  'Anniversary',
  'Graduation',
  'Baby Shower',
  'Bridal Shower',
  'Holiday',
  'Cocktail Party',
  'Dinner Party',
  'Brunch',
  'Other',
];

// ── Provider card shape (matches searchProviders response) ────────────────────
interface ProviderCard {
  id: string;
  businessName: string;
  primaryType: string;
  verificationStatus?: string;
  averageRating?: number;
  totalReviews?: number;
  // city/state are returned flat on the provider object (not under user)
  city?: string | null;
  state?: string | null;
  logoUrl?: string | null;
  tagline?: string | null;
  startingFrom?: number | null;
  featuredPackage?: {
    id: string;
    name: string;
    basePrice: number;
  } | null;
  activePackageCount?: number;
  isAvailable?: boolean;
}

// ── Filter shape ──────────────────────────────────────────────────────────────
interface Filters {
  types: string[];
  eventDate: string;
  guestCount: string;
  eventType: string;
  minBudget: string;
  maxBudget: string;
  city: string;
}

// All 5 canonical types — used as the default "no type filter" state
const ALL_TYPES = providerTypeConfig.map(t => t.value);

const EMPTY_FILTERS: Filters = {
  types: [],
  eventDate: '',
  guestCount: '',
  eventType: '',
  minBudget: '',
  maxBudget: '',
  city: '',
};

// ── Initials avatar ───────────────────────────────────────────────────────────
function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const letters =
    parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  return (
    <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: 'rgba(196,160,106,0.12)' }}>
      <span className="font-serif text-sm text-gold">{letters}</span>
    </div>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-border p-6 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-border" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-border rounded w-3/4" />
          <div className="h-3 bg-border rounded w-1/2" />
        </div>
      </div>
      <div className="h-3 bg-border rounded w-1/3 mb-6" />
      <div className="h-8 bg-border rounded w-1/2 mb-2" />
      <div className="h-3 bg-border rounded w-2/3" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BrowseProviders() {
  const [searchParams] = useSearchParams();

  // Optional event context passed from EventDetail
  const eventId   = searchParams.get('eventId');
  const eventName = eventId
    ? (JSON.parse(localStorage.getItem(`festv_browse_event_meta_${eventId}`) ?? 'null') as
        { name?: string; eventType?: string } | null)
    : null;

  // Initialise from URL ?type= param; default to all 5 types when no param
  const urlType = searchParams.get('type');
  const defaultTypes = urlType ? [urlType] : ALL_TYPES;

  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS, types: defaultTypes });
  const [applied, setApplied] = useState<Filters>({ ...EMPTY_FILTERS, types: defaultTypes });

  const [providers, setProviders] = useState<ProviderCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Fetch on applied change ───────────────────────────────────────────────
  // The API requires exactly one `type` param per request.
  // Fetch each selected type in parallel, then merge + dedupe results.
  useEffect(() => {
    const fetchProviders = async () => {
      setIsLoading(true);
      try {
        const typesToFetch = applied.types.length > 0 ? applied.types : ALL_TYPES;

        const buildParams = (type: string) => {
          const p = new URLSearchParams();
          p.set('type', type);
          if (applied.eventDate) p.set('eventDate', applied.eventDate);
          if (applied.guestCount) p.set('guestCount', applied.guestCount);
          if (applied.eventType && applied.eventType !== 'Any')
            p.set('eventType', applied.eventType.toUpperCase().replace(/\s+/g, '_'));
          if (applied.minBudget) p.set('minBudget', applied.minBudget);
          if (applied.maxBudget) p.set('maxBudget', applied.maxBudget);
          if (applied.city) p.set('city', applied.city);
          p.set('limit', '50');
          return p.toString();
        };

        const responses = await Promise.all(
          typesToFetch.map(type =>
            fetch(`${API_BASE}/providers/search?${buildParams(type)}`)
              .then(r => r.json())
              .catch(() => ({ success: false, data: [] }))
          )
        );

        const merged: ProviderCard[] = responses
          .filter(d => d.success)
          .flatMap(d => d.data ?? []);

        // Dedupe by id
        const deduped = Array.from(new Map(merged.map(p => [p.id, p])).values());
        setProviders(deduped);
      } catch (err) {
        console.error('[BrowseProviders] fetch error:', err);
        setProviders([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProviders();
  }, [applied]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  // "Clear all" resets to all-5-types (the default), not zero types
  const DEFAULT_FILTERS: Filters = { ...EMPTY_FILTERS, types: ALL_TYPES };

  // A filter is "active" only when it differs from the default state
  const hasFilters =
    (filters.types.length > 0 && filters.types.length < ALL_TYPES.length) ||
    !!filters.eventDate ||
    !!filters.guestCount ||
    (!!filters.eventType && filters.eventType !== 'Any') ||
    !!filters.minBudget ||
    !!filters.maxBudget ||
    !!filters.city;

  const toggleType = (type: string) => {
    setFilters(prev => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter(t => t !== type)
        : [...prev.types, type],
    }));
  };

  const applyFilters = () => setApplied({ ...filters });

  const clearAll = () => {
    setFilters(DEFAULT_FILTERS);
    setApplied(DEFAULT_FILTERS);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen">

      {/* ── SIDEBAR ───────────────────────────────────────────────────────── */}
      <motion.aside
        initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="hidden md:flex flex-col w-72 flex-shrink-0 bg-white border-r border-border sticky top-16 h-[calc(100vh-64px)] overflow-y-auto"
      >
        <div className="p-6 flex-1">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif text-xl text-dark">Filters</h2>
            {hasFilters && (
              <button
                onClick={clearAll}
                className="font-sans text-xs text-gold hover:text-gold-dark transition-colors focus:outline-none"
              >
                Clear all
              </button>
            )}
          </div>

          {/* ── Vendor Type ─────────────────────────────────────────────── */}
          <div className="mb-8">
            <p className="font-sans text-xs uppercase tracking-widest text-muted mb-3">Vendor Type</p>
            <div className="flex flex-wrap gap-2">
              {providerTypeConfig.map(t => (
                <button
                  key={t.value}
                  onClick={() => toggleType(t.value)}
                  className={`font-sans text-xs px-3 py-1.5 rounded-full border transition-all duration-150 focus:outline-none ${
                    filters.types.includes(t.value)
                      ? 'bg-gold text-dark border-gold'
                      : 'border-border text-charcoal hover:border-gold'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Event Date ──────────────────────────────────────────────── */}
          <div className="mb-6">
            <p className="font-sans text-xs uppercase tracking-widest text-muted mb-3">Event Date</p>
            <input
              type="date"
              value={filters.eventDate}
              onChange={e => setFilters(prev => ({ ...prev, eventDate: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-dark font-sans focus:outline-none focus:border-gold transition-colors"
            />
          </div>

          {/* ── Guest Count ─────────────────────────────────────────────── */}
          <div className="mb-6">
            <p className="font-sans text-xs uppercase tracking-widest text-muted mb-3">Guest Count</p>
            <input
              type="number"
              placeholder="e.g. 100"
              value={filters.guestCount}
              onChange={e => setFilters(prev => ({ ...prev, guestCount: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-dark font-sans focus:outline-none focus:border-gold transition-colors"
            />
          </div>

          {/* ── Event Type ──────────────────────────────────────────────── */}
          <div className="mb-6">
            <p className="font-sans text-xs uppercase tracking-widest text-muted mb-3">Event Type</p>
            <select
              value={filters.eventType || 'Any'}
              onChange={e => setFilters(prev => ({ ...prev, eventType: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-dark font-sans focus:outline-none focus:border-gold transition-colors bg-white"
            >
              {EVENT_TYPES.map(et => (
                <option key={et} value={et}>{et}</option>
              ))}
            </select>
          </div>

          {/* ── Budget Range ────────────────────────────────────────────── */}
          <div className="mb-6">
            <p className="font-sans text-xs uppercase tracking-widest text-muted mb-3">Budget Range</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min ($)"
                value={filters.minBudget}
                onChange={e => setFilters(prev => ({ ...prev, minBudget: e.target.value }))}
                className="flex-1 border border-border rounded-lg px-3 py-2 text-sm text-dark font-sans focus:outline-none focus:border-gold transition-colors min-w-0"
              />
              <span className="text-muted text-xs font-sans flex-shrink-0">to</span>
              <input
                type="number"
                placeholder="Max ($)"
                value={filters.maxBudget}
                onChange={e => setFilters(prev => ({ ...prev, maxBudget: e.target.value }))}
                className="flex-1 border border-border rounded-lg px-3 py-2 text-sm text-dark font-sans focus:outline-none focus:border-gold transition-colors min-w-0"
              />
            </div>
          </div>

          {/* ── City ────────────────────────────────────────────────────── */}
          <div className="mb-8">
            <p className="font-sans text-xs uppercase tracking-widest text-muted mb-3">City</p>
            <input
              type="text"
              placeholder="e.g. Montreal"
              value={filters.city}
              onChange={e => setFilters(prev => ({ ...prev, city: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-dark font-sans focus:outline-none focus:border-gold transition-colors"
            />
          </div>

          {/* ── Apply Button ─────────────────────────────────────────────── */}
          <button
            onClick={applyFilters}
            className="w-full bg-gold text-dark py-3 font-sans text-xs tracking-widest uppercase hover:bg-gold-dark transition-colors duration-200 focus:outline-none"
          >
            Apply Filters
          </button>

        </div>
      </motion.aside>

      {/* ── RESULTS AREA ──────────────────────────────────────────────────── */}
      <main className="flex-1 bg-bg px-8 py-8 min-w-0">

        {/* Event context banner */}
        {eventId && (
          <div className="flex items-center gap-3 bg-gold/10 border border-gold/30 rounded-md px-4 py-3 mb-6">
            <CalendarDays size={16} className="text-gold-dark flex-shrink-0" strokeWidth={1.5} />
            <p className="font-sans text-sm text-gold-dark flex-1">
              {eventName?.name
                ? <>You're browsing vendors for <strong>{eventName.name}</strong></>
                : <>You're browsing vendors for your event</>}
              {' '}— vendors you request will be linked to this event.
            </p>
            <Link
              to={`/events/${eventId}`}
              className="font-sans text-xs text-gold-dark hover:text-gold font-semibold transition-colors flex-shrink-0"
            >
              ← Back to event
            </Link>
          </div>
        )}

        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <p className="font-sans text-sm text-muted">
            {isLoading
              ? 'Searching…'
              : `${providers.length} vendor${providers.length !== 1 ? 's' : ''} found`}
          </p>
          <div className="flex items-center gap-2">
            <span className="font-sans text-xs text-muted">Sort by:</span>
            <select className="font-sans text-xs text-charcoal border border-border rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-gold transition-colors">
              <option>Relevance</option>
              <option>Rating</option>
              <option>Price: Low to High</option>
              <option>Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Loading skeletons */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && providers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <h3 className="font-serif text-xl text-muted">No vendors found</h3>
            <p className="font-sans text-sm text-muted mt-2 max-w-xs">
              Try adjusting your filters or broadening your search.
            </p>
            <button
              onClick={clearAll}
              className="font-sans text-xs text-gold hover:text-gold-dark transition-colors mt-6 focus:outline-none underline"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Vendor cards grid */}
        {!isLoading && providers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <AnimatePresence>
              {providers.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 5) * 0.07, duration: 0.4 }}
                >
                  <VendorCard provider={p} eventId={eventId} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

      </main>
    </div>
  );
}

// ── Vendor card sub-component ─────────────────────────────────────────────────
function VendorCard({ provider: p, eventId }: { provider: ProviderCard; eventId?: string | null }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-6 hover:border-gold hover:shadow-sm transition-all duration-200 flex flex-col">

      {/* Top row: avatar + name + badge */}
      <div className="flex items-start gap-3">
        <Initials name={p.businessName} />
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-lg text-dark leading-snug truncate">{p.businessName}</h3>
          <div className="mt-1">
            <ProviderTypeBadge type={p.primaryType} size="xs" />
          </div>
        </div>
      </div>

      {/* City + rating */}
      <div className="flex items-center gap-4 mt-3">
        {p.city && (
          <span className="flex items-center gap-1 text-xs text-muted font-sans">
            <MapPin size={12} className="text-muted flex-shrink-0" />
            {p.city}{p.state ? `, ${p.state}` : ''}
          </span>
        )}
        {((p.averageRating ?? 0) > 0 || (p.totalReviews ?? 0) > 0) && (
          <span className="flex items-center gap-1 text-xs text-muted font-sans">
            <Star size={12} className="text-gold flex-shrink-0" />
            {(p.averageRating ?? 0) > 0 ? p.averageRating!.toFixed(1) : '—'}
            {(p.totalReviews ?? 0) > 0 && <span className="text-muted/60">({p.totalReviews})</span>}
          </span>
        )}
      </div>

      {/* Pricing */}
      <div className="mt-4 flex-1">
        {p.startingFrom != null ? (
          <p className="font-serif text-2xl text-dark">
            From {formatPrice(p.startingFrom)}
          </p>
        ) : (
          <p className="font-serif text-lg text-muted">Contact for pricing</p>
        )}
        {p.featuredPackage?.name && (
          <p className="font-sans text-xs text-muted mt-1 truncate">{p.featuredPackage.name}</p>
        )}
        {(p.activePackageCount ?? 0) > 0 && (
          <p className="font-sans text-xs text-muted mt-1">
            {p.activePackageCount} package{p.activePackageCount !== 1 ? 's' : ''} available
          </p>
        )}
      </div>

      {/* CTA */}
      <Link
        to={`/providers/${p.id}`}
        state={eventId ? { eventId } : undefined}
        className="font-sans text-xs text-gold hover:text-gold-dark transition-colors mt-4 self-start"
      >
        View Profile →
      </Link>

    </div>
  );
}
