import { useState, useEffect, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────
interface EventRequestData {
  id: string;
  title: string;
  eventType: string;
  status: string;
  guestCount: number;
  budgetMin: number;
  budgetMax: number;
  eventDate: string;
  eventStartTime: string;
  eventEndTime: string;
  venueCity: string;
  venueState: string;
  serviceStyle: string;
  serviceStyles: string[];
  servicesWanted: string[];
  dietaryRestrictions: string[];
  allergies: string[];
  needsStaffing: boolean;
  needsSetup: boolean;
  needsCleanup: boolean;
  createdAt: string;
  client: { id: string; firstName: string; lastName: string; email: string; city: string | null; state: string | null };
  cuisineTypes: { id: string; name: string }[];
  eventThemes: { id: string; name: string }[];
  equipmentNeeded: { id: string; name: string; category: string }[];
  quotes: {
    id: string; status: string; totalAmount: number; createdAt: string;
    provider: { id: string; businessName: string; primaryType: string | null; providerTypes: string[]; averageRating: number; maxGuestCount: number };
  }[];
  booking: {
    id: string; status: string; totalAmount: number; eventDate: string; guestCount: number;
    provider: { id: string; businessName: string; primaryType: string | null };
    payments: { id: string; type: string; status: string; amount: number }[];
    review: { id: string; overallRating: number; title: string } | null;
  } | null;
}

// ── Constants ───────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#9ca3af', SUBMITTED: '#3b82f6', MATCHING: '#8b5cf6', QUOTED: '#f59e0b',
  BOOKED: '#10b981', COMPLETED: '#059669', CANCELLED: '#e94560',
};
const STATUS_BG: Record<string, string> = {
  DRAFT: '#f3f4f6', SUBMITTED: '#eff6ff', MATCHING: '#f5f3ff', QUOTED: '#fffbeb',
  BOOKED: '#f0fdf4', COMPLETED: '#ecfdf5', CANCELLED: '#fef2f2',
};
const QUOTE_STATUS_COLOR: Record<string, string> = {
  DRAFT: '#9ca3af', SENT: '#3b82f6', VIEWED: '#8b5cf6', ACCEPTED: '#10b981', REJECTED: '#e94560', EXPIRED: '#f59e0b', WITHDRAWN: '#6b7280',
};
const TYPE_EMOJI: Record<string, string> = {
  CATERER: '🍽️', DJ: '🎧', DECORATOR: '🎨', MUSICIAN: '🎵', PHOTOGRAPHER: '📷',
  VIDEOGRAPHER: '🎬', FLORIST: '💐', EVENT_PLANNER: '📋', BARTENDER: '🍸',
  RENTAL_EQUIPMENT: '🎪', OTHER: '📦',
};
const EVENT_TYPE_EMOJI: Record<string, string> = {
  CORPORATE: '🏢', WEDDING: '💒', BIRTHDAY: '🎂', ANNIVERSARY: '💍', GRADUATION: '🎓',
  BABY_SHOWER: '🍼', BRIDAL_SHOWER: '👰', HOLIDAY: '🎄', COCKTAIL_PARTY: '🍸',
  DINNER_PARTY: '🍷', BRUNCH: '🥐', BBQ: '🔥', PICNIC: '🧺', SOCIAL: '🎉', OTHER: '📋',
};

const PIPELINE_STEPS = [
  { key: 'request', label: 'Request Created', emoji: '📋' },
  { key: 'preferences', label: 'Preferences Set', emoji: '🎯' },
  { key: 'quoted', label: 'Quotes Received', emoji: '💬' },
  { key: 'booked', label: 'Provider Booked', emoji: '📅' },
  { key: 'paid', label: 'Payment Made', emoji: '💳' },
  { key: 'completed', label: 'Event Complete', emoji: '✅' },
  { key: 'reviewed', label: 'Review Left', emoji: '⭐' },
];

function fmtD(n: number) { return `$${n >= 1000 ? `${(n / 1000).toFixed(1)}K` : Math.round(n).toLocaleString()}`; }

function pipelineProgress(er: EventRequestData): number {
  // Returns 0-6 for how far along the pipeline
  if (er.booking?.review) return 6;
  if (er.status === 'COMPLETED' || er.booking?.status === 'COMPLETED') return 5;
  if (er.booking?.payments.some(p => p.status === 'COMPLETED')) return 4;
  if (er.booking) return 3;
  if (er.quotes.length > 0) return 2;
  if (er.cuisineTypes.length > 0 || er.eventThemes.length > 0 || er.servicesWanted.length > 0) return 1;
  return 0;
}

// ── Sub-graph: Single event request flow ────────────────────────
function EventFlowDetail({ er, onBack }: { er: EventRequestData; onBack: () => void }) {
  const progress = pipelineProgress(er);
  const statusColor = STATUS_COLORS[er.status] || '#6b7280';
  // Build flow nodes
  // Center column: Client → Request → Booking → Payment → Review
  // Left wing: Preferences (cuisines, themes, services, dietary, equipment)
  // Right wing: Quotes from providers

  const prefItems: { label: string; emoji: string; values: string[]; color: string }[] = [];
  if (er.cuisineTypes.length > 0) prefItems.push({ label: 'Cuisines', emoji: '🌮', values: er.cuisineTypes.map(c => c.name), color: '#f59e0b' });
  if (er.eventThemes.length > 0) prefItems.push({ label: 'Themes', emoji: '🎨', values: er.eventThemes.map(t => t.name), color: '#ec4899' });
  if (er.servicesWanted.length > 0) prefItems.push({ label: 'Services', emoji: '🔧', values: er.servicesWanted.map(s => s.replace(/_/g, ' ')), color: '#3b82f6' });
  if (er.dietaryRestrictions.length > 0) prefItems.push({ label: 'Dietary', emoji: '🥗', values: er.dietaryRestrictions, color: '#10b981' });
  if (er.allergies.length > 0) prefItems.push({ label: 'Allergies', emoji: '⚠️', values: er.allergies, color: '#e94560' });
  if (er.equipmentNeeded.length > 0) prefItems.push({ label: 'Equipment', emoji: '🎪', values: er.equipmentNeeded.map(e => e.name), color: '#8b5cf6' });
  const extras: string[] = [];
  if (er.needsStaffing) extras.push('Staffing');
  if (er.needsSetup) extras.push('Setup');
  if (er.needsCleanup) extras.push('Cleanup');
  if (extras.length > 0) prefItems.push({ label: 'Extras', emoji: '👥', values: extras, color: '#0f3460' });

  // SVG layout
  const W = 920, H = 600;
  const centerX = W / 2;

  // Spine nodes (vertical center)
  const spine = [
    { y: 50, label: `${er.client.firstName} ${er.client.lastName}`, sub: er.client.email, emoji: '👤', color: '#1a1a2e', active: true },
    { y: 140, label: er.title, sub: `${er.eventType} · ${er.guestCount} guests · ${fmtD(er.budgetMin)}-${fmtD(er.budgetMax)}`, emoji: EVENT_TYPE_EMOJI[er.eventType] || '📋', color: statusColor, active: true },
    { y: 260, label: `${er.quotes.length} Quote${er.quotes.length !== 1 ? 's' : ''}`, sub: er.quotes.length > 0 ? `Best: ${fmtD(Math.min(...er.quotes.map(q => q.totalAmount)))}` : 'Awaiting quotes', emoji: '💬', color: progress >= 2 ? '#f59e0b' : '#d1d5db', active: progress >= 2 },
    { y: 370, label: er.booking ? er.booking.provider.businessName : 'No booking yet', sub: er.booking ? `${er.booking.status} · ${fmtD(er.booking.totalAmount)}` : '', emoji: '📅', color: progress >= 3 ? '#10b981' : '#d1d5db', active: progress >= 3 },
    { y: 460, label: er.booking?.payments.length ? `${er.booking.payments.length} payment${er.booking.payments.length !== 1 ? 's' : ''}` : 'No payments', sub: er.booking?.payments.filter(p => p.status === 'COMPLETED').reduce((s, p) => s + p.amount, 0) ? fmtD(er.booking!.payments.filter(p => p.status === 'COMPLETED').reduce((s, p) => s + p.amount, 0)) + ' paid' : '', emoji: '💳', color: progress >= 4 ? '#10b981' : '#d1d5db', active: progress >= 4 },
    { y: 540, label: er.booking?.review ? `${er.booking.review.overallRating}/5` : 'No review yet', sub: er.booking?.review?.title || '', emoji: '⭐', color: progress >= 6 ? '#f59e0b' : '#d1d5db', active: progress >= 6 },
  ];

  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #f0f0f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{
          padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white',
          cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#6b7280',
        }}>← Back</button>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: statusColor }}>
            {EVENT_TYPE_EMOJI[er.eventType]} {er.title}
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>
            {er.client.firstName} {er.client.lastName} · {new Date(er.eventDate).toLocaleDateString()} · {er.venueCity}, {er.venueState}
          </p>
        </div>
        <span style={{ padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: STATUS_BG[er.status], color: statusColor }}>{er.status}</span>
      </div>

      {/* Pipeline progress bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {PIPELINE_STEPS.map((step, i) => {
          const done = i <= progress;
          return (
            <div key={step.key} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                height: 4, borderRadius: 2, marginBottom: 4,
                background: done ? (i === progress ? statusColor : '#10b981') : '#e5e7eb',
                transition: 'background 0.3s',
              }} />
              <div style={{ fontSize: 12 }}>{step.emoji}</div>
              <div style={{ fontSize: 8, color: done ? '#1a1a2e' : '#d1d5db', fontWeight: done ? 600 : 400 }}>{step.label}</div>
            </div>
          );
        })}
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, background: '#fafafa' }}>
        <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>
          <defs>
            <filter id="dfc"><feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.06" /></filter>
            <marker id="arrF" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="7" markerHeight="5" orient="auto-start-reverse">
              <polygon points="0 0, 10 3.5, 0 7" fill="#10b981" />
            </marker>
            <marker id="arrD" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="7" markerHeight="5" orient="auto-start-reverse">
              <polygon points="0 0, 10 3.5, 0 7" fill="#d1d5db" />
            </marker>
          </defs>

          {/* Spine edges */}
          {spine.slice(0, -1).map((node, i) => {
            const next = spine[i + 1];
            const active = node.active && next.active;
            return (
              <line key={i} x1={centerX} y1={node.y + 22} x2={centerX} y2={next.y - 22}
                stroke={active ? '#10b981' : '#e5e7eb'} strokeWidth={active ? 2.5 : 1.5}
                markerEnd={active ? 'url(#arrF)' : 'url(#arrD)'} />
            );
          })}

          {/* Preference edges (left side, connect to request node) */}
          {prefItems.map((pref, i) => {
            const px = 100;
            const py = 100 + i * 48;
            return (
              <line key={`pref-edge-${i}`} x1={px + 75} y1={py} x2={centerX - 70} y2={spine[1].y}
                stroke={pref.color} strokeWidth={1.5} strokeOpacity={0.25} />
            );
          })}

          {/* Quote edges (right side, connect to quotes node) */}
          {er.quotes.map((q, i) => {
            const qx = W - 180;
            const qy = 190 + i * 56;
            const isAccepted = q.status === 'ACCEPTED';
            return (
              <g key={`q-edge-${i}`}>
                <line x1={centerX + 70} y1={spine[2].y} x2={qx} y2={qy}
                  stroke={isAccepted ? '#10b981' : QUOTE_STATUS_COLOR[q.status] || '#d1d5db'}
                  strokeWidth={isAccepted ? 2.5 : 1.2} strokeOpacity={isAccepted ? 0.6 : 0.25} />
                {/* If accepted, connect to booking node */}
                {isAccepted && er.booking && (
                  <line x1={qx} y1={qy + 20} x2={centerX + 70} y2={spine[3].y}
                    stroke="#10b981" strokeWidth={2} strokeOpacity={0.4} strokeDasharray="4 3" />
                )}
              </g>
            );
          })}

          {/* Spine nodes */}
          {spine.map((node, i) => (
            <g key={i}>
              <rect x={centerX - 65} y={node.y - 22} width={130} height={44} rx={10}
                fill="white" stroke={node.color} strokeWidth={node.active ? 2 : 1} filter="url(#dfc)" />
              {node.active && <rect x={centerX - 65} y={node.y - 22} width={130} height={4} rx={2} fill={node.color} />}
              <text x={centerX - 40} y={node.y - 2} fontSize={11} fontWeight={700} fill="#1a1a2e">
                {node.label.length > 16 ? node.label.slice(0, 14) + '…' : node.label}
              </text>
              <text x={centerX - 40} y={node.y + 12} fontSize={8} fill="#9ca3af">
                {node.sub.length > 28 ? node.sub.slice(0, 26) + '…' : node.sub}
              </text>
              <text x={centerX - 55} y={node.y + 4} fontSize={16}>{node.emoji}</text>
            </g>
          ))}

          {/* Preference nodes (left) */}
          {prefItems.map((pref, i) => {
            const px = 20;
            const py = 100 + i * 48;
            return (
              <g key={`pref-${i}`}>
                <rect x={px} y={py - 16} width={155} height={32} rx={8}
                  fill="white" stroke={pref.color} strokeWidth={1.2} filter="url(#dfc)" />
                <rect x={px} y={py - 16} width={4} height={32} rx={2} fill={pref.color} />
                <text x={px + 12} y={py - 2} fontSize={9} fontWeight={700} fill={pref.color}>
                  {pref.emoji} {pref.label}
                </text>
                <text x={px + 12} y={py + 10} fontSize={7} fill="#9ca3af">
                  {pref.values.slice(0, 3).join(', ')}{pref.values.length > 3 ? ` +${pref.values.length - 3}` : ''}
                </text>
              </g>
            );
          })}

          {/* Quote nodes (right) */}
          {er.quotes.map((q, i) => {
            const qx = W - 180;
            const qy = 190 + i * 56;
            const isAccepted = q.status === 'ACCEPTED';
            const pt = q.provider.primaryType || q.provider.providerTypes[0] || 'OTHER';
            const qColor = isAccepted ? '#10b981' : QUOTE_STATUS_COLOR[q.status] || '#9ca3af';
            return (
              <g key={`q-${i}`}>
                <rect x={qx - 5} y={qy - 20} width={175} height={40} rx={8}
                  fill={isAccepted ? '#f0fdf4' : 'white'} stroke={qColor}
                  strokeWidth={isAccepted ? 2.5 : 1} filter="url(#dfc)" />
                {isAccepted && <rect x={qx - 5} y={qy - 20} width={175} height={4} rx={2} fill="#10b981" />}
                <text x={qx + 4} y={qy - 4} fontSize={9} fontWeight={700} fill="#1a1a2e">
                  {TYPE_EMOJI[pt]} {q.provider.businessName.length > 16 ? q.provider.businessName.slice(0, 14) + '…' : q.provider.businessName}
                </text>
                <text x={qx + 4} y={qy + 9} fontSize={8} fill="#6b7280">
                  {fmtD(q.totalAmount)} · {q.provider.averageRating.toFixed(1)}★
                </text>
                <text x={qx + 140} y={qy + 2} fontSize={8} fontWeight={700} fill={qColor} textAnchor="end">
                  {q.status}
                </text>
              </g>
            );
          })}

          {/* Labels */}
          <text x={95} y={78} fontSize={9} fontWeight={700} fill="#9ca3af80" textAnchor="middle" letterSpacing="0.06em">PREFERENCES</text>
          <text x={W - 92} y={172} fontSize={9} fontWeight={700} fill="#9ca3af80" textAnchor="middle" letterSpacing="0.06em">QUOTES</text>
        </svg>
      </div>
    </div>
  );
}

// ── Overview: All event requests ────────────────────────────────
interface ClientFlowGraphProps {
  token: string | null;
}

export default function ClientFlowGraph({ token }: ClientFlowGraphProps) {
  const [requests, setRequests] = useState<EventRequestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EventRequestData | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [clientFilter, setClientFilter] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL + '/api/v1' : '/api/v1'}/admin/event-requests`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (data.success) setRequests(data.data);
        else setError(data.error || 'Failed to load');
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [token]);

  const filtered = useMemo(() => {
    let r = requests;
    if (statusFilter) r = r.filter(e => e.status === statusFilter);
    if (clientFilter) r = r.filter(e => e.client.id === clientFilter);
    return r;
  }, [requests, statusFilter, clientFilter]);

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    requests.forEach(r => { m[r.status] = (m[r.status] || 0) + 1; });
    return m;
  }, [requests]);

  const clientCounts = useMemo(() => {
    const m: Record<string, { name: string; count: number }> = {};
    requests.forEach(r => {
      if (!m[r.client.id]) m[r.client.id] = { name: `${r.client.firstName} ${r.client.lastName}`, count: 0 };
      m[r.client.id].count++;
    });
    return m;
  }, [requests]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalQuotes = requests.reduce((s, r) => s + r.quotes.length, 0);
    const withBooking = requests.filter(r => r.booking).length;
    const totalRevenue = requests.reduce((s, r) => s + (r.booking?.totalAmount || 0), 0);
    const avgProgress = requests.length > 0 ? requests.reduce((s, r) => s + pipelineProgress(r), 0) / requests.length : 0;
    return { totalQuotes, withBooking, totalRevenue, avgProgress };
  }, [requests]);

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}><div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>Loading event requests...</div>;
  if (error) return <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #f0f0f0', borderLeft: '4px solid #e94560' }}><p style={{ margin: 0, fontSize: 13, color: '#e94560' }}><strong>Error:</strong> {error}</p></div>;
  if (selected) return <EventFlowDetail er={selected} onBack={() => setSelected(null)} />;

  if (requests.length === 0) {
    return (
      <div style={{ background: 'white', borderRadius: 12, padding: 40, border: '1px solid #f0f0f0', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>No Event Requests Yet</h3>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Client event flows will appear here as users create requests and move through the booking pipeline.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {[
          { l: 'Total Requests', v: String(requests.length), c: '#1a1a2e' },
          { l: 'Unique Clients', v: String(Object.keys(clientCounts).length), c: '#3b82f6' },
          { l: 'Total Quotes', v: String(stats.totalQuotes), c: '#f59e0b' },
          { l: 'Bookings Made', v: String(stats.withBooking), c: '#10b981' },
          { l: 'Total Revenue', v: fmtD(stats.totalRevenue), c: '#e94560' },
          { l: 'Avg Pipeline', v: `${(stats.avgProgress / 6 * 100).toFixed(0)}%`, c: '#8b5cf6' },
        ].map(s => (
          <div key={s.l} style={{ background: 'white', borderRadius: 12, padding: '12px 16px', border: '1px solid #f0f0f0', borderLeft: `4px solid ${s.c}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' as const, marginBottom: 2 }}>{s.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background: 'white', borderRadius: 12, padding: 16, border: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>Status:</span>
          <button onClick={() => setStatusFilter(null)} style={{
            padding: '4px 10px', borderRadius: 6, border: !statusFilter ? '2px solid #e94560' : '1px solid #e5e7eb',
            background: !statusFilter ? '#fef2f2' : 'white', fontSize: 11, fontWeight: 600, color: !statusFilter ? '#e94560' : '#6b7280', cursor: 'pointer',
          }}>All ({requests.length})</button>
          {Object.entries(statusCounts).map(([status, count]) => (
            <button key={status} onClick={() => setStatusFilter(statusFilter === status ? null : status)} style={{
              padding: '4px 10px', borderRadius: 6,
              border: statusFilter === status ? `2px solid ${STATUS_COLORS[status]}` : '1px solid #e5e7eb',
              background: statusFilter === status ? STATUS_BG[status] : 'white',
              fontSize: 11, fontWeight: 500, color: statusFilter === status ? STATUS_COLORS[status] : '#6b7280', cursor: 'pointer',
            }}>{status} ({count})</button>
          ))}
        </div>
        {Object.keys(clientCounts).length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>Client:</span>
            <button onClick={() => setClientFilter(null)} style={{
              padding: '4px 10px', borderRadius: 6, border: !clientFilter ? '2px solid #3b82f6' : '1px solid #e5e7eb',
              background: !clientFilter ? '#eff6ff' : 'white', fontSize: 11, fontWeight: 600, color: !clientFilter ? '#3b82f6' : '#6b7280', cursor: 'pointer',
            }}>All</button>
            {Object.entries(clientCounts).map(([id, { name, count }]) => (
              <button key={id} onClick={() => setClientFilter(clientFilter === id ? null : id)} style={{
                padding: '4px 10px', borderRadius: 6,
                border: clientFilter === id ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                background: clientFilter === id ? '#eff6ff' : 'white',
                fontSize: 11, fontWeight: 500, color: clientFilter === id ? '#3b82f6' : '#6b7280', cursor: 'pointer',
              }}>👤 {name} ({count})</button>
            ))}
          </div>
        )}
      </div>

      {/* Event request cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
        {filtered.map(er => {
          const progress = pipelineProgress(er);
          const statusColor = STATUS_COLORS[er.status] || '#6b7280';
          const progressPct = (progress / 6) * 100;
          return (
            <div key={er.id} onClick={() => setSelected(er)} style={{
              background: 'white', borderRadius: 12, padding: 16, border: '1px solid #f0f0f0',
              borderTop: `4px solid ${statusColor}`, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              transition: 'box-shadow 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)')}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                    {EVENT_TYPE_EMOJI[er.eventType] || '📋'} {er.title}
                  </h4>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280' }}>
                    👤 {er.client.firstName} {er.client.lastName} · {er.venueCity}
                  </p>
                </div>
                <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: STATUS_BG[er.status], color: statusColor }}>{er.status}</span>
              </div>

              {/* Key info */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                {[
                  { v: `${er.guestCount} guests` },
                  { v: `${fmtD(er.budgetMin)}-${fmtD(er.budgetMax)}` },
                  { v: new Date(er.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
                  { v: er.serviceStyle?.replace(/_/g, ' ') },
                ].map((t, i) => (
                  <span key={i} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#f3f4f6', color: '#6b7280', fontFamily: 'monospace' }}>{t.v}</span>
                ))}
              </div>

              {/* Preference tags */}
              {(er.cuisineTypes.length > 0 || er.eventThemes.length > 0 || er.servicesWanted.length > 0) && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
                  {er.cuisineTypes.map(c => <span key={c.id} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#fffbeb', color: '#92400e' }}>🌮 {c.name}</span>)}
                  {er.eventThemes.map(t => <span key={t.id} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#fdf2f8', color: '#9d174d' }}>🎨 {t.name}</span>)}
                  {er.servicesWanted.slice(0, 3).map(s => <span key={s} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#eff6ff', color: '#1d4ed8' }}>🔧 {s.replace(/_/g, ' ')}</span>)}
                </div>
              )}

              {/* Pipeline progress */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600 }}>Pipeline</span>
                  <span style={{ fontSize: 9, color: statusColor, fontWeight: 700 }}>{Math.round(progressPct)}%</span>
                </div>
                <div style={{ height: 4, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progressPct}%`, background: progressPct >= 80 ? '#10b981' : progressPct >= 40 ? '#f59e0b' : statusColor, borderRadius: 2, transition: 'width 0.3s' }} />
                </div>
              </div>

              {/* Bottom: quotes + booking indicator */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ fontSize: 10, color: '#6b7280' }}>💬 {er.quotes.length} quote{er.quotes.length !== 1 ? 's' : ''}</span>
                  {er.booking && <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>📅 Booked</span>}
                  {er.booking?.review && <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>⭐ {er.booking.review.overallRating}/5</span>}
                </div>
                <span style={{ fontSize: 10, color: '#9ca3af' }}>Click to explore →</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
