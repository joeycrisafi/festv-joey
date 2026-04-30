import { useState, useEffect, useMemo, useRef } from 'react';

// ── Types ───────────────────────────────────────────────────────
interface ProviderData {
  id: string;
  businessName: string;
  primaryType: string | null;
  providerTypes: string[];
  isSoloWorker: boolean;
  verificationStatus: string;
  verifiedAt: string | null;
  rejectionReason: string | null;
  minGuestCount: number;
  maxGuestCount: number;
  pricePerPerson: number | null;
  hourlyRate: number | null;
  averageRating: number;
  totalReviews: number;
  totalBookings: number;
  completedBookings: number;
  leadTimeDays: number;
  serviceAreas: string[];
  serviceRadius: number;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string; city: string | null; state: string | null };
  services: { id: string; name: string; providerType: string; basePrice: number; priceType: string }[];
  pricingLevels: { id: string; name: string; pricePerPerson: number; features: string[] }[];
  menuItems: { id: string; name: string; category: string; price: number; allergens: string[]; dietaryInfo: string[] }[];
  cuisineTypes: { id: string; name: string }[];
  eventThemes: { id: string; name: string }[];
  equipmentOfferings: { id: string; name: string; category: string; rentalPrice: number | null; isIncluded: boolean }[];
  portfolioItems: { id: string; title: string; mediaType: string }[];
  _count: { bookings: number; quotes: number; menuItems: number; services: number; portfolioItems: number; equipmentOfferings: number };
}

// ── Constants ───────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  CATERER: '#e94560', DJ: '#8b5cf6', DECORATOR: '#f59e0b', MUSICIAN: '#3b82f6',
  PHOTOGRAPHER: '#ec4899', VIDEOGRAPHER: '#14b8a6', FLORIST: '#10b981', EVENT_PLANNER: '#0f3460',
  BARTENDER: '#f97316', RENTAL_EQUIPMENT: '#6b7280', OTHER: '#9ca3af',
};

const TYPE_EMOJI: Record<string, string> = {
  CATERER: '🍽️', DJ: '🎧', DECORATOR: '🎨', MUSICIAN: '🎵',
  PHOTOGRAPHER: '📷', VIDEOGRAPHER: '🎬', FLORIST: '💐', EVENT_PLANNER: '📋',
  BARTENDER: '🍸', RENTAL_EQUIPMENT: '🎪', OTHER: '📦',
};

const OFFERING_COLORS: Record<string, string> = {
  services: '#3b82f6', pricingLevels: '#8b5cf6', menuItems: '#e94560',
  cuisineTypes: '#f59e0b', eventThemes: '#ec4899', equipmentOfferings: '#10b981', portfolioItems: '#14b8a6',
};

// ── Geometry helpers ────────────────────────────────────────────
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

function nodeRadius(maxGuests: number): number {
  // Scale: 10 guests = r18, 500 guests = r55
  return clamp(18 + Math.sqrt(maxGuests) * 1.6, 18, 60);
}

// Layout providers in a force-directed-like arrangement grouped by type
function layoutProviders(providers: ProviderData[], width: number, height: number) {
  const byType: Record<string, ProviderData[]> = {};
  providers.forEach(p => {
    const t = p.primaryType || p.providerTypes[0] || 'OTHER';
    if (!byType[t]) byType[t] = [];
    byType[t].push(p);
  });

  const types = Object.keys(byType).sort((a, b) => byType[b].length - byType[a].length);
  const nodes: { p: ProviderData; x: number; y: number; r: number; type: string }[] = [];

  // Arrange type clusters in a grid-like pattern
  const cols = Math.ceil(Math.sqrt(types.length));
  const cellW = width / cols;
  const rows = Math.ceil(types.length / cols);
  const cellH = height / rows;

  types.forEach((type, ti) => {
    const col = ti % cols;
    const row = Math.floor(ti / cols);
    const cx = cellW * (col + 0.5);
    const cy = cellH * (row + 0.5);
    const members = byType[type];

    // Arrange members in a spiral around cluster center
    members.forEach((p, i) => {
      const r = nodeRadius(p.maxGuestCount);
      const angle = i * 2.4; // golden angle-ish
      const dist = i === 0 ? 0 : 40 + Math.sqrt(i) * 28;
      const x = clamp(cx + Math.cos(angle) * dist, r + 10, width - r - 10);
      const y = clamp(cy + Math.sin(angle) * dist, r + 10, height - r - 10);
      nodes.push({ p, x, y, r, type });
    });
  });

  return { nodes, types: byType };
}

// Layout sub-graph for a single provider's offerings
function layoutOfferings(provider: ProviderData) {
  const centerX = 440;
  const centerY = 280;
  const offerings: { key: string; label: string; items: { id: string; name: string; extra?: string }[]; color: string; emoji: string }[] = [];

  if (provider.menuItems.length > 0) {
    // Group menu items by category
    const cats: Record<string, typeof provider.menuItems> = {};
    provider.menuItems.forEach(m => { (cats[m.category] = cats[m.category] || []).push(m); });
    Object.entries(cats).forEach(([cat, items]) => {
      offerings.push({ key: `menu-${cat}`, label: `Menu: ${cat}`, items: items.map(i => ({ id: i.id, name: i.name, extra: `$${i.price}` })), color: OFFERING_COLORS.menuItems, emoji: '🍽️' });
    });
  }
  if (provider.services.length > 0) {
    offerings.push({ key: 'services', label: 'Services', items: provider.services.map(s => ({ id: s.id, name: s.name, extra: `$${s.basePrice}` })), color: OFFERING_COLORS.services, emoji: '🔧' });
  }
  if (provider.pricingLevels.length > 0) {
    offerings.push({ key: 'pricing', label: 'Pricing Tiers', items: provider.pricingLevels.map(l => ({ id: l.id, name: l.name, extra: `$${l.pricePerPerson}/pp` })), color: OFFERING_COLORS.pricingLevels, emoji: '📊' });
  }
  if (provider.cuisineTypes.length > 0) {
    offerings.push({ key: 'cuisines', label: 'Cuisines', items: provider.cuisineTypes.map(c => ({ id: c.id, name: c.name })), color: OFFERING_COLORS.cuisineTypes, emoji: '🌮' });
  }
  if (provider.eventThemes.length > 0) {
    offerings.push({ key: 'themes', label: 'Event Themes', items: provider.eventThemes.map(t => ({ id: t.id, name: t.name })), color: OFFERING_COLORS.eventThemes, emoji: '🎨' });
  }
  if (provider.equipmentOfferings.length > 0) {
    offerings.push({ key: 'equipment', label: 'Equipment', items: provider.equipmentOfferings.map(e => ({ id: e.id, name: e.name, extra: e.isIncluded ? 'Included' : e.rentalPrice ? `$${e.rentalPrice}` : '' })), color: OFFERING_COLORS.equipmentOfferings, emoji: '🎪' });
  }
  if (provider.portfolioItems.length > 0) {
    offerings.push({ key: 'portfolio', label: 'Portfolio', items: provider.portfolioItems.map(p => ({ id: p.id, name: p.title, extra: p.mediaType })), color: OFFERING_COLORS.portfolioItems, emoji: '📸' });
  }

  // Place offering groups radially around center
  const groups: { key: string; label: string; emoji: string; color: string; cx: number; cy: number; items: { id: string; name: string; extra?: string; x: number; y: number }[] }[] = [];
  const baseR = 160;

  offerings.forEach((off, i) => {
    const angle = (i / offerings.length) * Math.PI * 2 - Math.PI / 2;
    const gcx = centerX + Math.cos(angle) * baseR;
    const gcy = centerY + Math.sin(angle) * baseR;

    // Place individual items in a small arc around group center
    const itemR = 55 + off.items.length * 6;
    const items = off.items.map((item, j) => {
      const itemAngle = angle + ((j - (off.items.length - 1) / 2) * 0.25);
      const ix = gcx + Math.cos(itemAngle) * itemR;
      const iy = gcy + Math.sin(itemAngle) * itemR;
      return { ...item, x: ix, y: iy };
    });

    groups.push({ ...off, cx: gcx, cy: gcy, items });
  });

  return { centerX, centerY, groups };
}

// ── Props ───────────────────────────────────────────────────────
interface ProviderGraphProps {
  token: string | null;
}

// ── Component ───────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL + '/api/v1' : '/api/v1';

const VERIFY_STATUS_STYLES: Record<string, { bg: string; border: string; text: string; label: string; icon: string }> = {
  VERIFIED:   { bg: '#f0fdf4', border: '#10b981', text: '#059669', label: 'Verified',   icon: '✅' },
  PENDING:    { bg: '#fffbeb', border: '#f59e0b', text: '#d97706', label: 'Pending',    icon: '⏳' },
  UNVERIFIED: { bg: '#f3f4f6', border: '#9ca3af', text: '#6b7280', label: 'Unverified', icon: '⚪' },
  REJECTED:   { bg: '#fef2f2', border: '#e94560', text: '#dc2626', label: 'Rejected',   icon: '❌' },
};

export default function ProviderGraph({ token }: ProviderGraphProps) {
  const [providers, setProviders] = useState<ProviderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ProviderData | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL + '/api/v1' : '/api/v1'}/admin/providers`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (data.success) setProviders(data.data);
        else setError(data.error || 'Failed to load');
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [token]);

  const filtered = useMemo(() => {
    if (!typeFilter) return providers;
    return providers.filter(p => (p.primaryType || p.providerTypes[0]) === typeFilter);
  }, [providers, typeFilter]);

  const layout = useMemo(() => layoutProviders(filtered, 880, 560), [filtered]);

  const subLayout = useMemo(() => {
    if (!selected) return null;
    return layoutOfferings(selected);
  }, [selected]);

  // Type counts for filter
  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    providers.forEach(p => { const t = p.primaryType || p.providerTypes[0] || 'OTHER'; m[t] = (m[t] || 0) + 1; });
    return m;
  }, [providers]);

  // ── Verification handlers ──────────────────────────────────
  const handleVerify = async (providerId: string) => {
    if (!token) return;
    setVerifyLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/providers/${providerId}/verify`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        // Update local state
        setProviders(prev => prev.map(p => p.id === providerId ? { ...p, verificationStatus: 'VERIFIED', verifiedAt: new Date().toISOString() } : p));
        if (selected?.id === providerId) setSelected(s => s ? { ...s, verificationStatus: 'VERIFIED', verifiedAt: new Date().toISOString() } : s);
      } else { alert(`Failed: ${data.error}`); }
    } catch (e: any) { alert(`Error: ${e.message}`); }
    finally { setVerifyLoading(false); }
  };

  const handleReject = async (providerId: string) => {
    if (!token || !rejectReason.trim()) { alert('Rejection reason is required'); return; }
    setVerifyLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/providers/${providerId}/reject`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setProviders(prev => prev.map(p => p.id === providerId ? { ...p, verificationStatus: 'REJECTED', rejectionReason: rejectReason.trim() } : p));
        if (selected?.id === providerId) setSelected(s => s ? { ...s, verificationStatus: 'REJECTED', rejectionReason: rejectReason.trim() } : s);
        setShowRejectInput(false); setRejectReason('');
      } else { alert(`Failed: ${data.error}`); }
    } catch (e: any) { alert(`Error: ${e.message}`); }
    finally { setVerifyLoading(false); }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}><div style={{ fontSize: 32, marginBottom: 8 }}>🏪</div>Loading providers...</div>;
  }
  if (error) {
    return (
      <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #f0f0f0', borderLeft: '4px solid #e94560' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#e94560' }}><strong>Error:</strong> {error}</p>
      </div>
    );
  }
  if (providers.length === 0) {
    return (
      <div style={{ background: 'white', borderRadius: 12, padding: 40, border: '1px solid #f0f0f0', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🏪</div>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>No Providers Yet</h3>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Provider nodes will appear here as vendors sign up and create profiles.</p>
      </div>
    );
  }

  // ── Sub-graph view (single provider) ────────────────────────
  if (selected && subLayout) {
    const pt = selected.primaryType || selected.providerTypes[0] || 'OTHER';
    const color = TYPE_COLORS[pt] || '#6b7280';

    return (
      <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #f0f0f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {/* Back bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => setSelected(null)} style={{
            padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white',
            cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4,
          }}>← Back to all providers</button>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color }}>{TYPE_EMOJI[pt]} {selected.businessName}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>
              {selected.user.firstName} {selected.user.lastName} · {selected.maxGuestCount} max guests · {selected.averageRating.toFixed(1)}★ · {selected.totalBookings} bookings
            </p>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { l: 'Menu Items', v: selected._count.menuItems, c: OFFERING_COLORS.menuItems },
            { l: 'Services', v: selected._count.services, c: OFFERING_COLORS.services },
            { l: 'Equipment', v: selected._count.equipmentOfferings, c: OFFERING_COLORS.equipmentOfferings },
            { l: 'Portfolio', v: selected._count.portfolioItems, c: OFFERING_COLORS.portfolioItems },
            { l: 'Quotes', v: selected._count.quotes, c: '#f59e0b' },
            { l: 'Bookings', v: selected._count.bookings, c: '#10b981' },
          ].map(s => (
            <div key={s.l} style={{ padding: '6px 12px', background: `${s.c}08`, borderRadius: 8, borderLeft: `3px solid ${s.c}` }}>
              <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase' as const }}>{s.l}</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: s.c }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* ── Verification Panel ── */}
        {(() => {
          const vs = selected.verificationStatus;
          const st = VERIFY_STATUS_STYLES[vs] || VERIFY_STATUS_STYLES.UNVERIFIED;
          return (
            <div style={{ marginBottom: 16, padding: 14, borderRadius: 10, background: st.bg, border: `1px solid ${st.border}30`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 20 }}>{st.icon}</span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: st.text }}>
                  Status: {st.label}
                  {selected.verifiedAt && vs === 'VERIFIED' && <span style={{ fontWeight: 400, fontSize: 11, marginLeft: 8, color: '#9ca3af' }}>since {new Date(selected.verifiedAt).toLocaleDateString()}</span>}
                </div>
                {vs === 'REJECTED' && selected.rejectionReason && (
                  <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>Reason: {selected.rejectionReason}</div>
                )}
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                  {selected.user.email} · Joined {new Date(selected.createdAt).toLocaleDateString()}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
                  Types: {selected.providerTypes.map(t => `${TYPE_EMOJI[t] || ''} ${t.replace(/_/g, ' ')}`).join(', ')}
                </div>
              </div>
              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {vs !== 'VERIFIED' && (
                  <button onClick={() => handleVerify(selected.id)} disabled={verifyLoading}
                    style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#10b981', color: 'white', fontSize: 12, fontWeight: 700, cursor: verifyLoading ? 'wait' : 'pointer', opacity: verifyLoading ? 0.6 : 1 }}>
                    {verifyLoading ? 'Processing...' : '✅ Verify Provider'}
                  </button>
                )}
                {vs !== 'REJECTED' && !showRejectInput && (
                  <button onClick={() => setShowRejectInput(true)} disabled={verifyLoading}
                    style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #e94560', background: 'white', color: '#e94560', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    ❌ Reject
                  </button>
                )}
                {vs === 'VERIFIED' && (
                  <span style={{ padding: '7px 16px', borderRadius: 8, background: '#10b98120', color: '#059669', fontSize: 12, fontWeight: 700 }}>✅ Already Verified</span>
                )}
              </div>
              {/* Reject reason input */}
              {showRejectInput && (
                <div style={{ width: '100%', display: 'flex', gap: 8, marginTop: 4 }}>
                  <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection (required)..."
                    style={{ flex: 1, padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
                  <button onClick={() => handleReject(selected.id)} disabled={verifyLoading || !rejectReason.trim()}
                    style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#e94560', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: (!rejectReason.trim() || verifyLoading) ? 0.5 : 1 }}>
                    Confirm Reject
                  </button>
                  <button onClick={() => { setShowRejectInput(false); setRejectReason(''); }}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', fontSize: 12, cursor: 'pointer', color: '#6b7280' }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* Sub-graph SVG */}
        <div style={{ overflowX: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, background: '#fafafa' }}>
          <svg width={880} height={560} style={{ display: 'block', minWidth: 880 }}>
            <defs>
              <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              <filter id="dsub"><feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.06" /></filter>
            </defs>

            {/* Edges from center to offering groups */}
            {subLayout.groups.map(g => (
              <g key={g.key}>
                {/* Center → group */}
                <line x1={subLayout.centerX} y1={subLayout.centerY} x2={g.cx} y2={g.cy}
                  stroke={g.color} strokeWidth={2.5} strokeOpacity={0.3} />
                {/* Group → items */}
                {g.items.map(item => (
                  <line key={item.id} x1={g.cx} y1={g.cy} x2={item.x} y2={item.y}
                    stroke={g.color} strokeWidth={1.2} strokeOpacity={0.2} />
                ))}
              </g>
            ))}

            {/* Center node (provider) */}
            <g>
              <circle cx={subLayout.centerX} cy={subLayout.centerY} r={42}
                fill="white" stroke={color} strokeWidth={3} filter="url(#dsub)" />
              <circle cx={subLayout.centerX} cy={subLayout.centerY} r={42}
                fill={`${color}08`} stroke="none" />
              <text x={subLayout.centerX} y={subLayout.centerY - 6} fontSize={20} textAnchor="middle">{TYPE_EMOJI[pt]}</text>
              <text x={subLayout.centerX} y={subLayout.centerY + 12} fontSize={10} fontWeight={700} fill="#1a1a2e" textAnchor="middle">
                {selected.businessName.length > 18 ? selected.businessName.slice(0, 16) + '…' : selected.businessName}
              </text>
              <text x={subLayout.centerX} y={subLayout.centerY + 24} fontSize={8} fill="#9ca3af" textAnchor="middle">
                {selected.maxGuestCount} max guests
              </text>
            </g>

            {/* Offering group nodes */}
            {subLayout.groups.map(g => (
              <g key={g.key}>
                {/* Group circle */}
                <circle cx={g.cx} cy={g.cy} r={28} fill="white" stroke={g.color} strokeWidth={2} filter="url(#dsub)" />
                <circle cx={g.cx} cy={g.cy} r={28} fill={`${g.color}10`} stroke="none" />
                <text x={g.cx} y={g.cy - 4} fontSize={14} textAnchor="middle">{g.emoji}</text>
                <text x={g.cx} y={g.cy + 10} fontSize={8} fontWeight={700} fill={g.color} textAnchor="middle">{g.label}</text>
                <text x={g.cx} y={g.cy + 20} fontSize={7} fill="#9ca3af" textAnchor="middle">{g.items.length} items</text>

                {/* Item nodes */}
                {g.items.map(item => (
                  <g key={item.id}>
                    <circle cx={item.x} cy={item.y} r={16} fill="white" stroke={g.color} strokeWidth={1} strokeOpacity={0.5} filter="url(#dsub)" />
                    <text x={item.x} y={item.y - 2} fontSize={7} fontWeight={600} fill="#1a1a2e" textAnchor="middle">
                      {item.name.length > 12 ? item.name.slice(0, 10) + '…' : item.name}
                    </text>
                    {item.extra && (
                      <text x={item.x} y={item.y + 7} fontSize={6} fill="#9ca3af" textAnchor="middle">{item.extra}</text>
                    )}
                  </g>
                ))}
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  }

  // ── Overview graph (all providers) ──────────────────────────
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #f0f0f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>Provider Network</h3>
          <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>
            {providers.length} providers. Node size = max guest capacity. Click to explore offerings.
          </p>
        </div>
      </div>

      {/* Type filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>Filter:</span>
        <button onClick={() => setTypeFilter(null)} style={{
          padding: '4px 10px', borderRadius: 6, border: !typeFilter ? '2px solid #e94560' : '1px solid #e5e7eb',
          background: !typeFilter ? '#fef2f2' : 'white', fontSize: 11, fontWeight: 600,
          color: !typeFilter ? '#e94560' : '#6b7280', cursor: 'pointer',
        }}>All ({providers.length})</button>
        {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
          <button key={type} onClick={() => setTypeFilter(typeFilter === type ? null : type)} style={{
            padding: '4px 10px', borderRadius: 6,
            border: typeFilter === type ? `2px solid ${TYPE_COLORS[type] || '#6b7280'}` : '1px solid #e5e7eb',
            background: typeFilter === type ? `${TYPE_COLORS[type] || '#6b7280'}10` : 'white',
            fontSize: 11, fontWeight: 500, color: typeFilter === type ? TYPE_COLORS[type] : '#6b7280', cursor: 'pointer',
          }}>
            {TYPE_EMOJI[type] || '📦'} {type.replace(/_/g, ' ')} ({count})
          </button>
        ))}
      </div>

      {/* SVG Graph */}
      <div style={{ overflowX: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, background: '#fafafa' }}>
        <svg ref={svgRef} width={880} height={560} style={{ display: 'block', minWidth: 880 }}>
          <defs>
            <filter id="dshadow"><feDropShadow dx="0" dy="1" stdDeviation="3" floodOpacity="0.1" /></filter>
            <filter id="hglow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>

          {/* Type cluster labels */}
          {!typeFilter && Object.entries(layout.types).map(([type, members]) => {
            // Find cluster centroid
            const typeNodes = layout.nodes.filter(n => n.type === type);
            if (typeNodes.length === 0) return null;
            const cx = typeNodes.reduce((s, n) => s + n.x, 0) / typeNodes.length;
            const cy = Math.min(...typeNodes.map(n => n.y - n.r)) - 14;
            return (
              <text key={type} x={cx} y={cy} fontSize={10} fontWeight={700}
                fill={`${TYPE_COLORS[type] || '#6b7280'}80`} textAnchor="middle" style={{ textTransform: 'uppercase' }} letterSpacing="0.06em">
                {TYPE_EMOJI[type]} {type.replace(/_/g, ' ')} ({members.length})
              </text>
            );
          })}

          {/* Provider nodes */}
          {layout.nodes.map(({ p, x, y, r, type }) => {
            const color = TYPE_COLORS[type] || '#6b7280';
            const isHov = hovered === p.id;
            const emoji = TYPE_EMOJI[type] || '📦';
            const nameDisplay = p.businessName.length > 14 ? p.businessName.slice(0, 12) + '…' : p.businessName;

            return (
              <g key={p.id}
                onClick={() => setSelected(p)}
                onMouseEnter={() => setHovered(p.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer' }}>
                {/* Hover glow */}
                {isHov && <circle cx={x} cy={y} r={r + 4} fill="none" stroke={color} strokeWidth={2} opacity={0.3} />}
                {/* Main circle */}
                <circle cx={x} cy={y} r={r} fill="white" stroke={color}
                  strokeWidth={isHov ? 3 : 1.5} filter="url(#dshadow)" />
                <circle cx={x} cy={y} r={r} fill={`${color}${isHov ? '12' : '06'}`} stroke="none" />
                {/* Verification badge */}
                {p.verificationStatus === 'VERIFIED' && (
                  <circle cx={x + r * 0.65} cy={y - r * 0.65} r={6} fill="#10b981" stroke="white" strokeWidth={1.5} />
                )}
                {p.verificationStatus === 'PENDING' && (
                  <circle cx={x + r * 0.65} cy={y - r * 0.65} r={6} fill="#f59e0b" stroke="white" strokeWidth={1.5} />
                )}
                {p.verificationStatus === 'REJECTED' && (
                  <circle cx={x + r * 0.65} cy={y - r * 0.65} r={6} fill="#e94560" stroke="white" strokeWidth={1.5} />
                )}
                {(p.verificationStatus === 'UNVERIFIED' || !p.verificationStatus) && (
                  <circle cx={x + r * 0.65} cy={y - r * 0.65} r={6} fill="#9ca3af" stroke="white" strokeWidth={1.5} />
                )}
                {/* Content */}
                <text x={x} y={y - (r > 30 ? 6 : 2)} fontSize={r > 35 ? 18 : 14} textAnchor="middle">{emoji}</text>
                {r > 28 && (
                  <>
                    <text x={x} y={y + 10} fontSize={9} fontWeight={700} fill="#1a1a2e" textAnchor="middle">{nameDisplay}</text>
                    <text x={x} y={y + 20} fontSize={7} fill="#9ca3af" textAnchor="middle">{p.maxGuestCount} guests</text>
                  </>
                )}
                {/* Rating arc for larger nodes */}
                {r > 35 && p.averageRating > 0 && (
                  <text x={x} y={y + r - 4} fontSize={7} fill={color} textAnchor="middle" fontWeight={600}>
                    {p.averageRating.toFixed(1)}★ · {p.completedBookings}✓
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Hover tooltip */}
      {hovered && (() => {
        const p = providers.find(p => p.id === hovered);
        if (!p) return null;
        const pt = p.primaryType || p.providerTypes[0] || 'OTHER';
        return (
          <div style={{ marginTop: 12, padding: 14, background: '#fafafa', borderRadius: 10, border: `1px solid ${TYPE_COLORS[pt]}30`, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 28 }}>{TYPE_EMOJI[pt]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TYPE_COLORS[pt] }}>{p.businessName}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>
                {p.user.firstName} {p.user.lastName} · {p.user.city || 'No location'}{p.user.state ? `, ${p.user.state}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { l: 'Guests', v: `${p.minGuestCount}-${p.maxGuestCount}` },
                { l: 'Rating', v: p.averageRating > 0 ? `${p.averageRating.toFixed(1)}★` : 'New' },
                { l: 'Items', v: String(p._count.menuItems + p._count.services) },
                { l: 'Bookings', v: String(p._count.bookings) },
              ].map(s => (
                <div key={s.l} style={{ textAlign: 'center', padding: '4px 10px', background: 'white', borderRadius: 6, border: '1px solid #f0f0f0' }}>
                  <div style={{ fontSize: 8, color: '#9ca3af', textTransform: 'uppercase' as const }}>{s.l}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{s.v}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>Click to explore →</div>
          </div>
        );
      })()}
    </div>
  );
}
