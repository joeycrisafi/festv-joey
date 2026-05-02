import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Star, MapPin, Globe, Instagram, ChevronDown, CheckCircle, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { ProviderTypeBadge } from '../components/ProviderTypeBadge';
import ImageUpload from '../components/ImageUpload';
import { eventRequestsApi, favoritesApi } from '../utils/api';
import PortfolioCard from '../components/PortfolioCard';

// ── Helpers ───────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(n);



function Stars({ rating, count }: { rating: number; count?: number }) {
  return (
    <span className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={14}
          className={i <= Math.round(rating) ? 'text-gold fill-gold' : 'text-border'}
        />
      ))}
      {count !== undefined && (
        <span className="font-sans text-xs text-muted ml-1">({count})</span>
      )}
    </span>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Provider {
  id: string;
  userId: string;
  businessName: string;
  primaryType: string;
  providerTypes: string[];
  tagline?: string | null;
  businessDescription?: string | null;
  verificationStatus: string;
  averageRating: number;
  totalReviews: number;
  logoUrl?: string | null;
  bannerImageUrl?: string | null;
  languages?: string[];
  serviceRadius?: number | null;
  website?: string | null;
  instagram?: string | null;
  user: {
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    city?: string | null;
    state?: string | null;
  };
}

interface AddOn {
  id: string;
  name: string;
  price: number;
  pricingModel: string;
  description?: string | null;
}

interface Package {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  pricingModel: 'PER_PERSON' | 'FLAT_RATE' | 'PER_HOUR';
  basePrice: number;
  minimumSpend?: number | null;
  durationHours?: number | null;
  minGuests?: number | null;
  maxGuests?: number | null;
  included: string[];
  eventTypes: string[];
  addOns: AddOn[];
}

interface PackageGroup {
  category: string;
  packages: Package[];
}

interface Review {
  id: string;
  overallRating: number;
  title?: string | null;
  content?: string | null;
  createdAt: string;
  author?: {
    firstName?: string;
    lastName?: string;
  } | null;
}

interface EstimateResult {
  appliedPrice?: number;
  packagePrice?: number;
  basePrice?: number;
  addOnTotal: number;
  subtotal: number;
  tax: number;
  total: number;
  depositAmount: number;
  isOutOfParameters?: boolean;
}

interface EstimatorState {
  isOpen: boolean;
  eventDate: string;
  guestCount: string;
  durationHours: string;
  selectedAddOnIds: string[];
  result: EstimateResult | null;
  isCalculating: boolean;
  error: string | null;
  // request fields
  eventType: string;
  specialRequests: string;
  isSending: boolean;
  requestSent: boolean;
  requestError: string | null;
}

const EVENT_TYPES = [
  'WEDDING', 'CORPORATE', 'BIRTHDAY', 'ANNIVERSARY', 'GRADUATION',
  'BABY_SHOWER', 'BRIDAL_SHOWER', 'HOLIDAY', 'COCKTAIL_PARTY',
  'DINNER_PARTY', 'BRUNCH', 'OTHER',
] as const;

const EVENT_TYPE_LABELS: Record<string, string> = {
  WEDDING: 'Wedding', CORPORATE: 'Corporate', BIRTHDAY: 'Birthday',
  ANNIVERSARY: 'Anniversary', GRADUATION: 'Graduation', BABY_SHOWER: 'Baby Shower',
  BRIDAL_SHOWER: 'Bridal Shower', HOLIDAY: 'Holiday', COCKTAIL_PARTY: 'Cocktail Party',
  DINNER_PARTY: 'Dinner Party', BRUNCH: 'Brunch', OTHER: 'Other',
};

const defaultEstimator = (): EstimatorState => ({
  isOpen: false,
  eventDate: '',
  guestCount: '',
  durationHours: '',
  selectedAddOnIds: [],
  result: null,
  isCalculating: false,
  error: null,
  eventType: '',
  specialRequests: '',
  isSending: false,
  requestSent: false,
  requestError: null,
});

// ── Package card with inline estimator ───────────────────────────────────────
function PackageCard({ pkg, isAuthenticated, providerId, providerName, eventId }: {
  pkg: Package;
  isAuthenticated: boolean;
  providerId: string;
  providerName: string;
  eventId?: string | null;
}) {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const isClient = isAuthenticated && user?.role === 'CLIENT';
  const [est, setEst] = useState<EstimatorState>(defaultEstimator());
  const SHOWN_ITEMS = 4;

  const updateEst = (patch: Partial<EstimatorState>) =>
    setEst(prev => ({ ...prev, ...patch }));

  const toggleAddOn = (id: string) => {
    setEst(prev => ({
      ...prev,
      selectedAddOnIds: prev.selectedAddOnIds.includes(id)
        ? prev.selectedAddOnIds.filter(a => a !== id)
        : [...prev.selectedAddOnIds, id],
    }));
  };

  const calculate = async () => {
    updateEst({ isCalculating: true, error: null, result: null });
    try {
      const res = await fetch(`${API_BASE}/packages/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: pkg.id,
          eventDate: est.eventDate || undefined,
          guestCount: est.guestCount ? Number(est.guestCount) : undefined,
          durationHours: est.durationHours ? Number(est.durationHours) : undefined,
          selectedAddOnIds: est.selectedAddOnIds,
        }),
      });
      const data = await res.json();
      if (data.success) {
        updateEst({ result: data.data, isCalculating: false });
      } else {
        updateEst({ error: data.message || 'Could not calculate estimate', isCalculating: false });
      }
    } catch {
      updateEst({ error: 'Network error — please try again', isCalculating: false });
    }
  };

  const handleSendRequest = async () => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=/providers/${providerId}`);
      return;
    }
    if (!token || !isClient) return;

    updateEst({ isSending: true, requestError: null });
    try {
      const body: Record<string, unknown> = {
        providerProfileId: providerId,
        packageId: pkg.id,
        ...(eventId           ? { eventId }                               : {}),
        ...(est.eventType     ? { eventType: est.eventType }              : {}),
        ...(est.eventDate     ? { eventDate: est.eventDate }              : {}),
        ...(est.guestCount    ? { guestCount: Number(est.guestCount) }    : {}),
        ...(est.durationHours ? { durationHours: Number(est.durationHours) } : {}),
        ...(est.selectedAddOnIds.length > 0 ? { selectedAddOnIds: est.selectedAddOnIds } : {}),
        ...(est.specialRequests ? { specialRequests: est.specialRequests } : {}),
      };
      const res = await eventRequestsApi.create(body, token);
      const data = res as { success: boolean; message?: string };
      if (data.success) {
        updateEst({ requestSent: true, isSending: false });
      } else {
        updateEst({ requestError: data.message ?? 'Failed to send request', isSending: false });
      }
    } catch {
      updateEst({ requestError: 'Network error — please try again', isSending: false });
    }
  };

  const priceLabel = () => {
    const effective = pkg.minimumSpend && pkg.minimumSpend > pkg.basePrice
      ? pkg.minimumSpend
      : pkg.basePrice;
    if (pkg.pricingModel === 'PER_PERSON') return `From ${fmt(pkg.basePrice)} per person`;
    if (pkg.pricingModel === 'PER_HOUR')   return `From ${fmt(pkg.basePrice)} per hour`;
    // FLAT_RATE
    if (pkg.minimumSpend && pkg.minimumSpend > pkg.basePrice)
      return `Minimum spend ${fmt(effective)}`;
    return `From ${fmt(pkg.basePrice)}`;
  };

  const pricingBadgeLabel = {
    PER_PERSON: 'Per Person',
    FLAT_RATE:  'Flat Rate',
    PER_HOUR:   'Per Hour',
  }[pkg.pricingModel];

  return (
    <div className="bg-white border border-border rounded-md p-7 mb-4">

      {/* Top row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h4 className="font-sans text-sm font-bold text-dark uppercase tracking-wide">{pkg.name}</h4>
          <p className="font-serif text-xl text-gold-dark font-semibold mt-2">{priceLabel()}</p>
          {pkg.minimumSpend != null && pkg.minimumSpend > pkg.basePrice && (
            <p className="font-sans text-xs text-muted mt-0.5">Minimum spend applies</p>
          )}
        </div>
        <span className="font-sans text-xs text-muted border border-border rounded-full px-3 py-1 flex-shrink-0">
          {pricingBadgeLabel}
        </span>
      </div>

      {pkg.description && (
        <p className="font-sans text-sm text-muted mt-3 leading-relaxed">{pkg.description}</p>
      )}

      {/* Meta row — plain text with · separator */}
      {(pkg.durationHours != null || pkg.minGuests != null || pkg.maxGuests != null) && (
        <p className="font-sans text-xs text-muted mt-3">
          {pkg.durationHours != null && (
            <span>{pkg.durationHours} hour{pkg.durationHours !== 1 ? 's' : ''}</span>
          )}
          {pkg.durationHours != null && (pkg.minGuests != null || pkg.maxGuests != null) && (
            <span className="mx-1.5">·</span>
          )}
          {(pkg.minGuests != null || pkg.maxGuests != null) && (
            <span>{pkg.minGuests ?? 1}–{pkg.maxGuests ?? '∞'} guests</span>
          )}
        </p>
      )}

      {/* Included chips */}
      {pkg.included?.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {pkg.included.slice(0, SHOWN_ITEMS).map((item, i) => (
            <span key={i} className="font-sans text-xs bg-bg border border-border rounded-full px-3 py-1 text-charcoal">
              {item}
            </span>
          ))}
          {pkg.included.length > SHOWN_ITEMS && (
            <span className="font-sans text-xs text-muted px-3 py-1">
              +{pkg.included.length - SHOWN_ITEMS} more
            </span>
          )}
        </div>
      )}

      {/* Estimator toggle */}
      <button
        onClick={() => updateEst({ isOpen: !est.isOpen })}
        className="mt-5 flex items-center gap-2 border border-gold text-gold font-sans text-xs font-bold tracking-widest uppercase px-6 py-3 hover:bg-gold hover:text-dark transition-colors duration-200 focus:outline-none rounded-md"
      >
        Get a Price Estimate
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${est.isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Inline estimator */}
      <AnimatePresence>
      {est.isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
        <div className="mt-5 border-t border-border pt-5 space-y-4">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-sans text-xs uppercase tracking-widest text-muted mb-2">
                Event Date
              </label>
              <input
                type="date"
                value={est.eventDate}
                onChange={e => updateEst({ eventDate: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-dark font-sans focus:outline-none focus:border-gold transition-colors"
              />
            </div>
            <div>
              <label className="block font-sans text-xs uppercase tracking-widest text-muted mb-2">
                Guest Count
              </label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 80"
                value={est.guestCount}
                onChange={e => updateEst({ guestCount: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-dark font-sans focus:outline-none focus:border-gold transition-colors"
              />
            </div>
            {pkg.pricingModel === 'PER_HOUR' && (
              <div>
                <label className="block font-sans text-xs uppercase tracking-widest text-muted mb-2">
                  Duration (hours)
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder={pkg.durationHours ? String(pkg.durationHours) : 'e.g. 4'}
                  value={est.durationHours}
                  onChange={e => updateEst({ durationHours: e.target.value })}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm text-dark font-sans focus:outline-none focus:border-gold transition-colors"
                />
              </div>
            )}
          </div>

          {/* Add-ons */}
          {pkg.addOns?.length > 0 && (
            <div>
              <p className="font-sans text-xs uppercase tracking-widest text-muted mb-3">Add-ons</p>
              <div className="space-y-2">
                {pkg.addOns.map(addon => (
                  <label
                    key={addon.id}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={est.selectedAddOnIds.includes(addon.id)}
                      onChange={() => toggleAddOn(addon.id)}
                      className="w-4 h-4 accent-gold cursor-pointer"
                    />
                    <span className="font-sans text-sm text-charcoal group-hover:text-dark transition-colors">
                      {addon.name}
                    </span>
                    <span className="font-sans text-xs text-muted ml-auto">
                      {fmt(addon.price)}
                      {addon.pricingModel === 'PER_PERSON' && '/person'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Event type + special requests — CLIENT only */}
          {isClient && (
            <div className="space-y-3">
              <div>
                <label className="block font-sans text-xs uppercase tracking-widest text-muted mb-2">
                  Event Type
                </label>
                <select
                  value={est.eventType}
                  onChange={e => updateEst({ eventType: e.target.value })}
                  className="w-full border border-border rounded-md px-3 py-2.5 text-sm text-dark font-sans focus:outline-none focus:border-gold transition-colors bg-white"
                >
                  <option value="">Select event type…</option>
                  {EVENT_TYPES.map(t => (
                    <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-sans text-xs uppercase tracking-widest text-muted mb-2">
                  Special Requests <span className="normal-case tracking-normal font-normal">(optional)</span>
                </label>
                <textarea
                  value={est.specialRequests}
                  onChange={e => updateEst({ specialRequests: e.target.value })}
                  placeholder="Anything the vendor should know…"
                  rows={3}
                  className="w-full border border-border rounded-md px-3 py-2.5 text-sm text-dark font-sans focus:outline-none focus:border-gold transition-colors resize-none"
                />
              </div>
            </div>
          )}

          <button
            onClick={calculate}
            disabled={est.isCalculating}
            className="bg-gold text-dark font-sans text-xs tracking-widest uppercase px-6 py-3 hover:bg-gold-dark transition-colors duration-200 focus:outline-none disabled:opacity-50"
          >
            {est.isCalculating ? 'Calculating…' : 'Calculate'}
          </button>

          {est.error && (
            <p className="font-sans text-xs text-red">{est.error}</p>
          )}

          {/* Estimate result */}
          {est.result && (
            <div className="bg-white rounded-xl border border-border p-5 space-y-2">
              {est.result.isOutOfParameters && (
                <div className="mb-4 border border-gold rounded-xl px-4 py-3"
                  style={{ background: 'rgba(196,160,106,0.06)' }}>
                  <p className="font-sans text-xs text-gold leading-relaxed">
                    This request has special requirements — the vendor will review and provide a custom quote.
                  </p>
                </div>
              )}
              <div className="flex justify-between font-sans text-sm">
                <span className="text-muted">Package price</span>
                <span className="text-dark">{fmt(est.result.appliedPrice ?? est.result.packagePrice ?? est.result.basePrice ?? 0)}</span>
              </div>
              {est.result.addOnTotal > 0 && (
                <div className="flex justify-between font-sans text-sm">
                  <span className="text-muted">Add-ons</span>
                  <span className="text-dark">{fmt(est.result.addOnTotal)}</span>
                </div>
              )}
              <div className="flex justify-between font-sans text-sm">
                <span className="text-muted">Subtotal</span>
                <span className="text-dark">{fmt(est.result.subtotal)}</span>
              </div>
              <div className="flex justify-between font-sans text-sm">
                <span className="text-muted">Tax (15%)</span>
                <span className="text-dark">{fmt(est.result.tax)}</span>
              </div>
              <div className="flex justify-between font-sans text-sm font-medium border-t border-border pt-2 mt-2">
                <span className="text-dark">Total</span>
                <span className="font-serif text-lg text-dark">{fmt(est.result.total)}</span>
              </div>
              <div className="flex justify-between font-sans text-xs text-muted">
                <span>Deposit (10%)</span>
                <span>{fmt(est.result.depositAmount)}</span>
              </div>

              {est.requestSent ? (
                <div className="mt-4 flex flex-col items-center gap-2 py-4 text-center">
                  <CheckCircle size={32} strokeWidth={1.5} className="text-gold" />
                  <p className="font-serif text-2xl text-dark">Request sent!</p>
                  <p className="font-sans text-sm text-muted">
                    We'll notify you when {providerName} responds.
                  </p>
                  <Link
                    to="/dashboard"
                    className="font-sans text-xs text-gold hover:text-gold-dark transition-colors font-semibold mt-1"
                  >
                    View your requests →
                  </Link>
                </div>
              ) : (
                <>
                  {est.requestError && (
                    <p className="font-sans text-xs text-red mt-3">{est.requestError}</p>
                  )}
                  <button
                    onClick={handleSendRequest}
                    disabled={est.isSending}
                    className="w-full mt-4 bg-gold text-dark font-sans text-xs tracking-widest uppercase py-3 hover:bg-gold-dark transition-colors duration-200 focus:outline-none disabled:opacity-50"
                  >
                    {est.isSending ? 'Sending…' : 'Send Request'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Send request even without estimate */}
          {!est.result && (
            est.requestSent ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <CheckCircle size={32} strokeWidth={1.5} className="text-gold" />
                <p className="font-serif text-2xl text-dark">Request sent!</p>
                <p className="font-sans text-sm text-muted">
                  We'll notify you when {providerName} responds.
                </p>
                <Link
                  to="/dashboard"
                  className="font-sans text-xs text-gold hover:text-gold-dark transition-colors font-semibold mt-1"
                >
                  View your requests →
                </Link>
              </div>
            ) : (
              <>
                {est.requestError && (
                  <p className="font-sans text-xs text-red">{est.requestError}</p>
                )}
                <button
                  onClick={handleSendRequest}
                  disabled={est.isSending}
                  className="font-sans text-xs text-gold hover:text-gold-dark transition-colors focus:outline-none underline disabled:opacity-50"
                >
                  {est.isSending ? 'Sending…' : 'Skip estimate and send request →'}
                </button>
              </>
            )
          )}
        </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProviderProfile() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, user, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // eventId arrives either via router state (from VendorCard) or URL param
  const eventId: string | null =
    (location.state as { eventId?: string } | null)?.eventId ??
    searchParams.get('eventId') ??
    null;

  const [provider, setProvider]         = useState<Provider | null>(null);
  const [packageGroups, setPackageGroups] = useState<PackageGroup[]>([]);
  const [reviews, setReviews]           = useState<Review[]>([]);
  const [portfolioPosts, setPortfolioPosts] = useState<any[]>([]);
  const [portfolioLoaded, setPortfolioLoaded] = useState(false);
  const [isLoading, setIsLoading]       = useState(true);
  const [notFound, setNotFound]         = useState(false);
  const [showStickyNav, setShowStickyNav] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  // Live image URLs — updated immediately on upload without a page reload
  const [liveLogoUrl, setLiveLogoUrl]     = useState<string | null>(null);
  const [liveBannerUrl, setLiveBannerUrl] = useState<string | null>(null);
  const [isFavorited, setIsFavorited]     = useState(false);

  // ── Scroll → sticky nav ────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => {
      const heroBottom = heroRef.current?.getBoundingClientRect().bottom ?? 0;
      setShowStickyNav(heroBottom < 64);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Data fetch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const fetchAll = async () => {
      setIsLoading(true);
      setNotFound(false);
      try {
        const [providerRes, packagesRes, reviewsRes] = await Promise.all([
          fetch(`${API_BASE}/providers/${id}`),
          fetch(`${API_BASE}/providers/${id}/packages`),
          fetch(`${API_BASE}/reviews/provider/${id}`).catch(() => null),
        ]);

        const providerData = await providerRes.json();
        if (!providerData.success || !providerData.data) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }
        setProvider(providerData.data);
        setLiveLogoUrl(providerData.data.logoUrl ?? null);
        setLiveBannerUrl(providerData.data.bannerImageUrl ?? null);

        const packagesData = await packagesRes.json();
        if (packagesData.success) setPackageGroups(packagesData.data ?? []);

        if (reviewsRes) {
          const reviewsData = await reviewsRes.json().catch(() => null);
          if (reviewsData?.success) setReviews(reviewsData.data ?? []);
        }
      } catch (err) {
        console.error('[ProviderProfile] fetch error:', err);
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, [id]);

  // ── Check favorite status ─────────────────────────────────────────────────
  useEffect(() => {
    if (!id || !token || user?.role !== 'CLIENT') return;
    favoritesApi.checkFavorite(id, token).then((res: any) => {
      setIsFavorited(res?.data?.isFavorited ?? false);
    }).catch(() => {});
  }, [id, token, user?.role]);

  // ── Toggle favorite ───────────────────────────────────────────────────────
  const toggleFavorite = async () => {
    if (!token || user?.role !== 'CLIENT') return;
    const prev = isFavorited;
    setIsFavorited(!prev);
    try {
      if (prev) {
        await favoritesApi.removeFavorite(id!, token);
      } else {
        await favoritesApi.addFavorite(id!, token);
      }
    } catch {
      setIsFavorited(prev);
    }
  };

  // ── Scroll to anchor ───────────────────────────────────────────────────────
  const scrollTo = (anchor: string) => {
    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg">
        <div className="h-96 bg-charcoal animate-pulse" />
        <div className="max-w-5xl mx-auto px-6 md:px-12 py-12 space-y-4">
          <div className="h-4 bg-border rounded w-1/4 animate-pulse" />
          <div className="h-4 bg-border rounded w-1/2 animate-pulse" />
        </div>
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (notFound || !provider) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-center px-6">
        <h1 className="font-serif text-4xl text-dark">Vendor not found</h1>
        <p className="font-sans text-sm text-muted mt-4">
          This vendor profile doesn't exist or has been removed.
        </p>
        <Link to="/providers" className="mt-8 font-sans text-xs text-gold hover:text-gold-dark transition-colors underline">
          ← Back to Browse Vendors
        </Link>
      </div>
    );
  }

  const city = provider.user?.city;
  const state = provider.user?.state;

  // Is the logged-in user viewing their own profile?
  const isOwner = isAuthenticated && user?.role === 'PROVIDER' && provider.userId === user.id;

  // Resolved image URLs — live state wins over fetched data
  const displayLogoUrl   = liveLogoUrl   ?? provider.logoUrl   ?? null;
  const displayBannerUrl = liveBannerUrl ?? provider.bannerImageUrl ?? null;

  return (
    <div className="bg-bg min-h-screen">

      {/* ── STICKY NAV ──────────────────────────────────────────────────────── */}
      <div
        className={`fixed top-16 left-0 right-0 z-40 bg-dark transition-all duration-300 ${
          showStickyNav ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
        }`}
        style={{ borderBottom: '1px solid rgba(196,160,106,0.2)' }}
      >
        <div className="max-w-5xl mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-8">
            {['packages', 'about', 'reviews', 'portfolio'].map(anchor => (
              <button
                key={anchor}
                onClick={() => scrollTo(anchor)}
                className="font-sans text-xs font-semibold uppercase tracking-widest text-white/50 hover:text-gold-light transition-colors focus:outline-none"
              >
                {anchor === 'packages' ? 'Packages' : anchor.charAt(0).toUpperCase() + anchor.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {!isOwner && isAuthenticated && user?.role === 'CLIENT' && (
              <button
                onClick={toggleFavorite}
                className="p-2 border border-gold/40 hover:border-gold transition-colors focus:outline-none"
                aria-label={isFavorited ? 'Unsave vendor' : 'Save vendor'}
              >
                <Heart
                  size={14}
                  strokeWidth={1.5}
                  className={isFavorited ? 'fill-gold text-gold' : 'text-gold/60 hover:text-gold'}
                />
              </button>
            )}
            {!isOwner && (
              <button
                onClick={() => isAuthenticated
                  ? scrollTo('packages')
                  : navigate(`/login?redirect=/providers/${id}`)
                }
                className="border border-gold text-gold font-sans text-xs tracking-widest uppercase px-6 py-2 hover:bg-gold hover:text-dark transition-colors duration-200 focus:outline-none"
              >
                Request This Vendor
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 1: HERO — content sits inside at the bottom ─────────────── */}
      <div
        ref={heroRef}
        className="relative h-96 bg-gradient-to-br from-dark via-charcoal to-dark overflow-hidden"
        style={displayBannerUrl ? {
          backgroundImage: `url(${displayBannerUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : undefined}
      >
        {/* Darkening overlay when a real banner image is used */}
        {displayBannerUrl && (
          <div className="absolute inset-0" style={{ background: 'rgba(26,23,20,0.6)' }} />
        )}
        {/* Bottom gradient vignette */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(26,23,20,0.85) 0%, rgba(26,23,20,0.15) 55%, transparent 100%)' }}
        />

        {/* Owner — "Edit Cover Photo" compact button (top-right corner) */}
        {isOwner && (
          <div className="absolute top-4 right-4 z-20">
            <ImageUpload
              onUpload={url => setLiveBannerUrl(url)}
              endpoint="banner"
              label="Edit Cover Photo"
              compact
            />
          </div>
        )}

        {/* Content — bottom of hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
          className="absolute bottom-0 left-0 right-0 p-8 flex items-end justify-between gap-6"
        >
          <div className="flex items-end gap-5 min-w-0">
            {/* Avatar */}
            <div className="relative flex-shrink-0 group">
              {displayLogoUrl ? (
                <img
                  src={displayLogoUrl}
                  alt={provider.businessName}
                  className="w-24 h-24 rounded-full object-cover border-2 border-gold-light"
                />
              ) : (
                <div className="w-24 h-24 rounded-full border-2 border-gold-light flex items-center justify-center"
                  style={{ background: 'rgba(196,160,106,0.15)' }}>
                  <span className="font-serif text-2xl text-gold-light">
                    {provider.businessName.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              {/* Owner: "Change Logo" compact overlay on avatar */}
              {isOwner && (
                <div className="absolute -bottom-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <ImageUpload
                    onUpload={url => setLiveLogoUrl(url)}
                    endpoint="logo"
                    label="Logo"
                    compact
                  />
                </div>
              )}
            </div>

            {/* Text */}
            <div className="min-w-0">
              <h1 className="font-serif text-4xl font-semibold text-white leading-tight">
                {provider.businessName}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <ProviderTypeBadge type={provider.primaryType} size="xs" />
                {city && (
                  <span className="flex items-center gap-1 font-sans text-xs text-white/70">
                    <span className="text-white/40">·</span>
                    <MapPin size={11} />
                    {city}{state ? `, ${state}` : ''}
                  </span>
                )}
                {provider.averageRating > 0 && (
                  <span className="flex items-center gap-1 font-sans text-xs text-white/70">
                    <span className="text-white/40">·</span>
                    <Star size={11} className="text-gold fill-gold" />
                    {provider.averageRating.toFixed(1)}
                    <span className="text-white/40">({provider.totalReviews})</span>
                  </span>
                )}
              </div>
              {provider.tagline && (
                <p className="font-sans text-sm italic mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {provider.tagline}
                </p>
              )}
              {provider.languages && provider.languages.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {provider.languages.map(lang => (
                    <span
                      key={lang}
                      className="font-sans text-xs rounded-full px-3 py-1 border"
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(8px)',
                        borderColor: 'rgba(255,255,255,0.2)',
                        color: 'rgba(255,255,255,0.8)',
                      }}
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Request CTA + save button */}
          <div className="flex items-end gap-3 flex-shrink-0 self-end">
            {!isOwner && isAuthenticated && user?.role === 'CLIENT' && (
              <button
                onClick={toggleFavorite}
                className="p-2.5 border border-white/30 hover:border-gold transition-colors focus:outline-none"
                aria-label={isFavorited ? 'Unsave vendor' : 'Save vendor'}
              >
                <Heart
                  size={18}
                  strokeWidth={1.5}
                  className={isFavorited ? 'fill-gold text-gold' : 'text-white/70 hover:text-gold'}
                />
              </button>
            )}
            {!isOwner && (
              <button
                onClick={() => isAuthenticated
                  ? scrollTo('packages')
                  : navigate(`/login?redirect=/providers/${id}`)
                }
                className="bg-gold text-dark font-sans text-xs font-bold tracking-widest uppercase px-8 py-3 hover:bg-gold-dark transition-colors duration-200 focus:outline-none"
              >
                Request This Vendor
              </button>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── SECTION 3: PACKAGES ─────────────────────────────────────────────── */}
      <section id="packages" className="py-12 px-6 md:px-12">
        <div className="max-w-5xl mx-auto">
          <p className="font-sans text-xs font-bold tracking-widest uppercase text-charcoal mb-3">
            Packages &amp; Pricing
          </p>

          {packageGroups.length === 0 ? (
            <p className="font-sans text-sm text-muted mt-4">No packages listed yet.</p>
          ) : (
            packageGroups.map(group => (
              <div key={group.category}>
                <h3 className="font-serif text-xl text-dark border-b border-border pb-3 mb-6 mt-10 first:mt-0">
                  {group.category}
                </h3>
                {group.packages.map((pkg, pkgIdx) => (
                  <motion.div
                    key={pkg.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: pkgIdx * 0.08 }}
                  >
                  <PackageCard
                    pkg={pkg}
                    isAuthenticated={isAuthenticated}
                    providerId={id!}
                    providerName={provider.businessName}
                    eventId={eventId}
                  />
                  </motion.div>
                ))}
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── SECTION 4: ABOUT ────────────────────────────────────────────────── */}
      <section id="about" className="py-12 px-6 md:px-12">
        <div className="max-w-5xl mx-auto">
          <p className="font-sans text-xs font-bold tracking-widest uppercase text-charcoal mb-6">About</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

            {/* Description */}
            <div className="md:col-span-2">
              {provider.businessDescription ? (
                provider.businessDescription.split('\n\n').map((para, i) => (
                  <p key={i} className="font-sans text-sm text-muted leading-relaxed mb-4">{para}</p>
                ))
              ) : (
                <p className="font-sans text-muted text-sm">No description provided.</p>
              )}
            </div>

            {/* Details card */}
            <div className="bg-white border border-border rounded-md p-6 self-start space-y-4">
              {provider.serviceRadius != null && (
                <div>
                  <p className="font-sans text-xs font-bold uppercase tracking-widest text-muted mb-1">Service Radius</p>
                  <p className="font-sans text-sm font-medium text-dark">{provider.serviceRadius} km</p>
                </div>
              )}
              {provider.languages && provider.languages.length > 0 && (
                <div>
                  <p className="font-sans text-xs font-bold uppercase tracking-widest text-muted mb-2">Languages</p>
                  <div className="flex flex-wrap gap-2">
                    {provider.languages.map(lang => (
                      <span key={lang} className="font-sans text-xs border border-border rounded-full px-3 py-1 text-charcoal">
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {provider.website && (
                <a
                  href={provider.website.startsWith('http') ? provider.website : `https://${provider.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 font-sans text-xs text-gold hover:text-gold-dark transition-colors"
                >
                  <Globe size={14} />
                  Website
                </a>
              )}
              {provider.instagram && (
                <a
                  href={`https://instagram.com/${provider.instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 font-sans text-xs text-gold hover:text-gold-dark transition-colors"
                >
                  <Instagram size={14} />
                  @{provider.instagram.replace('@', '')}
                </a>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* ── SECTION 5: REVIEWS ──────────────────────────────────────────────── */}
      <section id="reviews" className="py-12 px-6 md:px-12 pb-24">
        <div className="max-w-5xl mx-auto">
          <p className="font-sans text-xs font-bold tracking-widest uppercase text-charcoal mb-6">Reviews</p>

          {/* Rating summary */}
          {provider.averageRating > 0 && (
            <div className="flex items-center gap-4 mb-10">
              <span className="font-serif text-6xl font-semibold text-dark leading-none">
                {provider.averageRating.toFixed(1)}
              </span>
              <div>
                <Stars rating={provider.averageRating} />
                <p className="font-sans text-xs text-muted mt-1">
                  {provider.totalReviews} review{provider.totalReviews !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )}

          {reviews.length === 0 ? (
            <p className="font-sans text-sm text-muted">No reviews yet.</p>
          ) : (
            <div className="space-y-4">
              {reviews.map(review => {
                const name = review.author
                  ? `${review.author.firstName ?? ''} ${review.author.lastName?.[0] ?? ''}.`.trim()
                  : 'Anonymous';
                return (
                  <div key={review.id} className="bg-white border border-border rounded-md p-6">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="font-sans text-sm font-bold text-dark">{name}</p>
                        <p className="font-sans text-xs text-muted mt-0.5">
                          {new Date(review.createdAt).toLocaleDateString('en-CA', {
                            year: 'numeric', month: 'long', day: 'numeric',
                          })}
                        </p>
                      </div>
                      <Stars rating={review.overallRating} />
                    </div>
                    {review.title && (
                      <p className="font-sans text-sm font-bold text-dark mb-2">{review.title}</p>
                    )}
                    {review.content && (
                      <p className="font-sans text-sm text-muted leading-loose">{review.content}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── SECTION: PORTFOLIO ────────────────────────────────────────────── */}
      <section id="portfolio" className="py-12 px-6 md:px-12 pb-24">
        <div className="max-w-5xl mx-auto">
          <p className="font-sans text-xs font-bold tracking-widest uppercase text-charcoal mb-6">Portfolio</p>
          {!portfolioLoaded ? (
            <button
              onClick={async () => {
                if (!provider || portfolioLoaded) return;
                try {
                  const res = await fetch(`${API_BASE}/portfolio/users/${provider.userId}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                  });
                  const d = await res.json();
                  setPortfolioPosts(d?.data?.posts ?? []);
                } catch {}
                setPortfolioLoaded(true);
              }}
              className="font-sans text-xs text-gold hover:text-gold-dark transition-colors"
            >
              Load portfolio posts →
            </button>
          ) : portfolioPosts.length === 0 ? (
            <p className="font-sans text-sm text-muted">No portfolio posts yet.</p>
          ) : (
            <div className="columns-2 gap-4">
              {portfolioPosts.map((post: any) => (
                <div key={post.id} className="break-inside-avoid mb-4">
                  <PortfolioCard post={post} token={token} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
