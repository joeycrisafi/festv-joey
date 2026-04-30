import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccessPlanner } from './Planner';
import { apiFetch } from '../utils/api';
import ProviderGraph from './ProviderGraph';
import ClientFlowGraph from './ClientFlowGraph';

// ── Types ───────────────────────────────────────────────────────
interface DbEvent {
  id: string; model: string; action: 'create' | 'update' | 'delete'; recordId: string;
  summary: string; details: Record<string, any>; severity: 'info' | 'success' | 'warning' | 'critical'; timestamp: string;
}
interface EventStats {
  total: number; byModel: Record<string, number>; byAction: Record<string, number>; bySeverity: Record<string, number>; last24h: number; lastHour: number;
}
interface NotifierConfig {
  watchedModels: string[]; discordEnabled: boolean; emailEnabled: boolean; allModels: string[];
}

// ── Shared Constants ────────────────────────────────────────────
const SEVERITY_COLORS: Record<string, string> = { info: '#3B82F6', success: '#10B981', warning: '#F59E0B', critical: '#E94560' };
const SEVERITY_BG: Record<string, string> = { info: '#EFF6FF', success: '#F0FDF4', warning: '#FFFBEB', critical: '#FEF2F2' };
const ACTION_COLORS: Record<string, string> = { create: '#10B981', update: '#3B82F6', delete: '#E94560' };
const MODEL_EMOJI: Record<string, string> = {
  User: '👤', ProviderProfile: '🏪', EventRequest: '📋', Quote: '💬', Booking: '📅', Payment: '💳',
  Review: '⭐', Message: '💬', MenuItem: '🍽️', Service: '🔧', Favorite: '❤️', PortfolioItem: '📸',
  MenuItemPricingTier: '💲', PricingLevel: '📊', Notification: '🔔', RefreshToken: '🔑',
  Availability: '📆', Equipment: '🎪', BookingService: '🔗', QuoteItem: '📝',
  Conversation: '💭', CuisineType: '🌮', EventTheme: '🎨', PortfolioTag: '🏷️',
};
const MODEL_GROUPS: Record<string, string[]> = {
  'Core': ['User', 'ProviderProfile'],
  'Events & Bookings': ['EventRequest', 'Quote', 'Booking', 'Payment'],
  'Content': ['MenuItem', 'MenuItemPricingTier', 'Service', 'PricingLevel', 'PortfolioItem'],
  'Social': ['Review', 'Message', 'Favorite', 'Notification'],
  'System': ['RefreshToken', 'Availability', 'Equipment', 'BookingService', 'QuoteItem'],
};

// ════════════════════════════════════════════════════════════════
//  SCHEMA VIEW — Interactive Entity Relationship Diagram
// ════════════════════════════════════════════════════════════════

interface SchemaNode {
  id: string; x: number; y: number; emoji: string; fields: number; group: string; desc: string;
}
interface SchemaEdge {
  from: string; to: string; label: string; type: '1:1' | '1:N' | 'M:N'; note?: string;
}

const GROUP_COLORS: Record<string, string> = {
  identity: '#e94560', provider: '#0f3460', content: '#8b5cf6',
  marketplace: '#f59e0b', transactions: '#10b981', social: '#ec4899',
};

const SCHEMA_NODES: SchemaNode[] = [
  // Identity
  { id: 'User', x: 100, y: 320, emoji: '👤', fields: 20, group: 'identity', desc: 'Core user account — clients & providers' },
  { id: 'RefreshToken', x: 100, y: 450, emoji: '🔑', fields: 5, group: 'identity', desc: 'JWT refresh tokens' },
  // Provider
  { id: 'ProviderProfile', x: 320, y: 220, emoji: '🏪', fields: 30, group: 'provider', desc: 'Business profile with pricing, capacity, and verification' },
  { id: 'Availability', x: 320, y: 90, emoji: '📆', fields: 5, group: 'provider', desc: 'Date-specific availability' },
  // Shared taxonomy (between Provider + EventRequest)
  { id: 'CuisineType', x: 190, y: 120, emoji: '🌮', fields: 4, group: 'marketplace', desc: 'Cuisine categories (Italian, Mexican, etc.)' },
  { id: 'EventTheme', x: 190, y: 510, emoji: '🎨', fields: 4, group: 'marketplace', desc: 'Event themes (Rustic, Modern, etc.)' },
  // Provider content
  { id: 'Service', x: 540, y: 80, emoji: '🔧', fields: 15, group: 'content', desc: 'Service packages offered by providers' },
  { id: 'PricingLevel', x: 540, y: 160, emoji: '📊', fields: 8, group: 'content', desc: 'Tiered per-person pricing (Basic, Premium, Deluxe)' },
  { id: 'MenuItem', x: 540, y: 250, emoji: '🍽️', fields: 10, group: 'content', desc: 'Menu items with dietary info and allergens' },
  { id: 'MenuItemPricingTier', x: 700, y: 250, emoji: '💲', fields: 5, group: 'content', desc: 'Quantity-based pricing tiers for menu items' },
  { id: 'PortfolioItem', x: 540, y: 340, emoji: '📸', fields: 12, group: 'content', desc: 'Photos, videos, and audio showcasing work' },
  { id: 'PortfolioTag', x: 700, y: 340, emoji: '🏷️', fields: 2, group: 'content', desc: 'Tags for portfolio organization' },
  { id: 'Equipment', x: 540, y: 430, emoji: '🎪', fields: 7, group: 'content', desc: 'Rental equipment and included items' },
  // Marketplace
  { id: 'EventRequest', x: 320, y: 480, emoji: '📋', fields: 22, group: 'marketplace', desc: 'Client event requests with budget, date, and preferences' },
  // Transactions
  { id: 'Quote', x: 540, y: 540, emoji: '💬', fields: 15, group: 'transactions', desc: 'Provider proposals with itemized pricing' },
  { id: 'QuoteItem', x: 700, y: 480, emoji: '📝', fields: 6, group: 'transactions', desc: 'Line items within a quote' },
  { id: 'Booking', x: 720, y: 580, emoji: '📅', fields: 16, group: 'transactions', desc: 'Confirmed bookings with deposit tracking' },
  { id: 'BookingService', x: 880, y: 500, emoji: '🔗', fields: 6, group: 'transactions', desc: 'Services included in a booking' },
  { id: 'Payment', x: 880, y: 600, emoji: '💳', fields: 10, group: 'transactions', desc: 'Deposits, balances, refunds, and tips' },
  // Social / Outcomes
  { id: 'Review', x: 880, y: 350, emoji: '⭐', fields: 14, group: 'social', desc: 'Post-booking reviews with multi-dimension ratings' },
  { id: 'Message', x: 880, y: 180, emoji: '💬', fields: 8, group: 'social', desc: 'Direct messages between users' },
  { id: 'Conversation', x: 1020, y: 120, emoji: '💭', fields: 4, group: 'social', desc: 'Message threads' },
  { id: 'Notification', x: 100, y: 560, emoji: '🔔', fields: 7, group: 'social', desc: 'In-app notifications' },
  { id: 'Favorite', x: 100, y: 210, emoji: '❤️', fields: 3, group: 'social', desc: 'Saved/favorited providers' },
];

const SCHEMA_EDGES: SchemaEdge[] = [
  // User relations
  { from: 'User', to: 'RefreshToken', label: '1:N', type: '1:N' },
  { from: 'User', to: 'ProviderProfile', label: '1:N', type: '1:N', note: 'can have multiple profiles' },
  { from: 'User', to: 'EventRequest', label: '1:N', type: '1:N', note: 'as client' },
  { from: 'User', to: 'Booking', label: '1:N', type: '1:N', note: 'as client' },
  { from: 'User', to: 'Review', label: '1:N', type: '1:N', note: 'author + subject' },
  { from: 'User', to: 'Message', label: '1:N', type: '1:N', note: 'sender + recipient' },
  { from: 'User', to: 'Notification', label: '1:N', type: '1:N' },
  { from: 'User', to: 'Favorite', label: '1:N', type: '1:N' },
  // Provider relations
  { from: 'ProviderProfile', to: 'Service', label: '1:N', type: '1:N' },
  { from: 'ProviderProfile', to: 'PricingLevel', label: '1:N', type: '1:N' },
  { from: 'ProviderProfile', to: 'MenuItem', label: '1:N', type: '1:N' },
  { from: 'ProviderProfile', to: 'PortfolioItem', label: '1:N', type: '1:N' },
  { from: 'ProviderProfile', to: 'Equipment', label: '1:N', type: '1:N' },
  { from: 'ProviderProfile', to: 'Availability', label: '1:N', type: '1:N' },
  { from: 'ProviderProfile', to: 'Quote', label: '1:N', type: '1:N' },
  { from: 'ProviderProfile', to: 'Booking', label: '1:N', type: '1:N' },
  { from: 'ProviderProfile', to: 'CuisineType', label: 'M:N', type: 'M:N' },
  { from: 'ProviderProfile', to: 'EventTheme', label: 'M:N', type: 'M:N' },
  // Content relations
  { from: 'MenuItem', to: 'MenuItemPricingTier', label: '1:N', type: '1:N' },
  { from: 'PortfolioItem', to: 'PortfolioTag', label: 'M:N', type: 'M:N' },
  // Marketplace relations
  { from: 'EventRequest', to: 'Quote', label: '1:N', type: '1:N' },
  { from: 'EventRequest', to: 'Booking', label: '1:1', type: '1:1' },
  { from: 'EventRequest', to: 'CuisineType', label: 'M:N', type: 'M:N' },
  { from: 'EventRequest', to: 'EventTheme', label: 'M:N', type: 'M:N' },
  { from: 'EventRequest', to: 'Equipment', label: 'M:N', type: 'M:N' },
  // Transaction relations
  { from: 'Quote', to: 'QuoteItem', label: '1:N', type: '1:N' },
  { from: 'Quote', to: 'Booking', label: '1:1', type: '1:1' },
  { from: 'Service', to: 'QuoteItem', label: '1:N', type: '1:N' },
  { from: 'Service', to: 'BookingService', label: '1:N', type: '1:N' },
  { from: 'Booking', to: 'BookingService', label: '1:N', type: '1:N' },
  { from: 'Booking', to: 'Payment', label: '1:N', type: '1:N' },
  { from: 'Booking', to: 'Review', label: '1:1', type: '1:1' },
  // Social
  { from: 'Conversation', to: 'Message', label: '1:N', type: '1:N' },
];

const NODE_W = 140;
const NODE_H = 52;

function SchemaView() {
  const [selected, setSelected] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const nodeMap = useMemo(() => {
    const m: Record<string, SchemaNode> = {};
    SCHEMA_NODES.forEach(n => { m[n.id] = n; });
    return m;
  }, []);

  const connectedTo = useMemo(() => {
    if (!selected) return new Set<string>();
    const s = new Set<string>();
    SCHEMA_EDGES.forEach(e => {
      if (e.from === selected) s.add(e.to);
      if (e.to === selected) s.add(e.from);
    });
    return s;
  }, [selected]);

  const isHighlighted = (id: string) => !selected || id === selected || connectedTo.has(id);
  const isEdgeHighlighted = (e: SchemaEdge) => !selected || e.from === selected || e.to === selected;

  // Edge path calculation
  const edgePath = (e: SchemaEdge) => {
    const a = nodeMap[e.from];
    const b = nodeMap[e.to];
    if (!a || !b) return '';

    const acx = a.x + NODE_W / 2, acy = a.y + NODE_H / 2;
    const bcx = b.x + NODE_W / 2, bcy = b.y + NODE_H / 2;

    // Find connection points on node borders
    const angle = Math.atan2(bcy - acy, bcx - acx);
    const fx = acx + Math.cos(angle) * (NODE_W / 2 + 2);
    const fy = acy + Math.sin(angle) * (NODE_H / 2 + 2);
    const tx = bcx - Math.cos(angle) * (NODE_W / 2 + 2);
    const ty = bcy - Math.sin(angle) * (NODE_H / 2 + 2);

    // Curved path
    const mx = (fx + tx) / 2;
    const my = (fy + ty) / 2;
    const dx = tx - fx;
    const dy = ty - fy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const curve = Math.min(dist * 0.15, 30);
    const nx = -dy / dist * curve;
    const ny = dx / dist * curve;

    return `M${fx},${fy} Q${mx + nx},${my + ny} ${tx},${ty}`;
  };

  // Edge label position
  const edgeLabelPos = (e: SchemaEdge) => {
    const a = nodeMap[e.from];
    const b = nodeMap[e.to];
    if (!a || !b) return { x: 0, y: 0 };
    return { x: (a.x + b.x + NODE_W) / 2, y: (a.y + b.y + NODE_H) / 2 - 6 };
  };

  // Group backgrounds
  const groups = [
    { id: 'identity', label: 'Identity', color: GROUP_COLORS.identity, x: 55, y: 180, w: 210, h: 310 },
    { id: 'provider', label: 'Provider', color: GROUP_COLORS.provider, x: 275, y: 60, w: 190, h: 210 },
    { id: 'content', label: 'Provider Content', color: GROUP_COLORS.content, x: 495, y: 50, w: 260, h: 420 },
    { id: 'marketplace', label: 'Marketplace', color: GROUP_COLORS.marketplace, x: 145, y: 85, w: 220, h: 475 },
    { id: 'transactions', label: 'Transactions', color: GROUP_COLORS.transactions, x: 495, y: 455, w: 420, h: 195 },
    { id: 'social', label: 'Social', color: GROUP_COLORS.social, x: 835, y: 90, w: 230, h: 310 },
  ];

  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #f0f0f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>Entity Relationship Diagram</h3>
          <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>Click any model to see its connections. {SCHEMA_NODES.length} models, {SCHEMA_EDGES.length} relationships.</p>
        </div>
        {selected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ padding: '6px 12px', background: `${GROUP_COLORS[nodeMap[selected]?.group] || '#6b7280'}12`, borderRadius: 8, border: `2px solid ${GROUP_COLORS[nodeMap[selected]?.group] || '#6b7280'}` }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{MODEL_EMOJI[selected]} {selected}</span>
              <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 6 }}>{nodeMap[selected]?.desc}</span>
            </div>
            <button onClick={() => setSelected(null)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Clear</button>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        {Object.entries(GROUP_COLORS).map(([g, c]) => (
          <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6b7280' }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
            <span style={{ textTransform: 'capitalize' }}>{g}</span>
          </div>
        ))}
        <span style={{ fontSize: 10, color: '#d1d5db' }}>|</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6b7280' }}>
          <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#6b7280" strokeWidth="1.5" /></svg> 1:1 / 1:N
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6b7280' }}>
          <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#6b7280" strokeWidth="1.5" strokeDasharray="4 3" /></svg> M:N
        </div>
      </div>

      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 720, border: '1px solid #f0f0f0', borderRadius: 8, background: '#fafafa' }}>
        <svg ref={svgRef} width={1120} height={680} style={{ display: 'block', minWidth: 1120 }} onClick={(e) => { if ((e.target as Element).tagName === 'svg' || (e.target as Element).tagName === 'rect' && !(e.target as Element).closest('[data-node]')) setSelected(null); }}>
          <defs>
            <marker id="arrowG" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
              <polygon points="0 0, 10 3.5, 0 7" fill="#10b981" />
            </marker>
            <marker id="arrowD" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
              <polygon points="0 0, 10 3.5, 0 7" fill="#d1d5db" />
            </marker>
            <filter id="shadow"><feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.08" /></filter>
          </defs>

          {/* Group backgrounds */}
          {groups.map(g => (
            <g key={g.id} opacity={!selected || SCHEMA_NODES.some(n => n.group === g.id && isHighlighted(n.id)) ? 1 : 0.25}>
              <rect x={g.x} y={g.y} width={g.w} height={g.h} rx={12} fill={`${g.color}06`} stroke={`${g.color}20`} strokeWidth={1} />
              <text x={g.x + 8} y={g.y + 16} fontSize={10} fontWeight={700} fill={`${g.color}60`} style={{ textTransform: 'uppercase' }} letterSpacing="0.06em">{g.label}</text>
            </g>
          ))}

          {/* Edges */}
          {SCHEMA_EDGES.map((e, i) => {
            const hl = isEdgeHighlighted(e);
            const color = hl ? (GROUP_COLORS[nodeMap[e.from]?.group] || '#10b981') : '#e5e7eb';
            const lp = edgeLabelPos(e);
            return (
              <g key={i} opacity={hl ? 1 : 0.15} style={{ transition: 'opacity 0.2s' }}>
                <path d={edgePath(e)} fill="none" stroke={color} strokeWidth={hl && selected ? 2.5 : 1.5}
                  strokeDasharray={e.type === 'M:N' ? '5 3' : undefined}
                  markerEnd={hl ? 'url(#arrowG)' : 'url(#arrowD)'} />
                {hl && selected && (
                  <g>
                    <rect x={lp.x - 12} y={lp.y - 6} width={24} height={13} rx={3} fill="white" stroke={color} strokeWidth={0.8} />
                    <text x={lp.x} y={lp.y + 4} fontSize={8} fontWeight={700} fill={color} textAnchor="middle">{e.label}</text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {SCHEMA_NODES.map(node => {
            const hl = isHighlighted(node.id);
            const color = GROUP_COLORS[node.group] || '#6b7280';
            const isSelected = selected === node.id;
            return (
              <g key={node.id} data-node={node.id}
                onClick={(e) => { e.stopPropagation(); setSelected(selected === node.id ? null : node.id); }}
                style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                opacity={hl ? 1 : 0.2}
              >
                {/* Node shadow + bg */}
                <rect x={node.x} y={node.y} width={NODE_W} height={NODE_H} rx={8}
                  fill="white" stroke={isSelected ? color : '#e5e7eb'} strokeWidth={isSelected ? 2.5 : 1}
                  filter="url(#shadow)" />
                {/* Color top bar */}
                <rect x={node.x} y={node.y} width={NODE_W} height={4} rx={2} fill={color} />
                {/* Emoji + name */}
                <text x={node.x + NODE_W / 2} y={node.y + 24} fontSize={12} fontWeight={700} fill="#1a1a2e" textAnchor="middle">
                  {node.emoji} {node.id.length > 16 ? node.id.slice(0, 14) + '…' : node.id}
                </text>
                {/* Fields count */}
                <text x={node.x + NODE_W / 2} y={node.y + 40} fontSize={9} fill="#9ca3af" textAnchor="middle">
                  {node.fields} fields
                </text>
                {/* Selection ring */}
                {isSelected && (
                  <rect x={node.x - 3} y={node.y - 3} width={NODE_W + 6} height={NODE_H + 6} rx={10}
                    fill="none" stroke={color} strokeWidth={2} strokeDasharray="4 2" opacity={0.5} />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected model detail */}
      {selected && (
        <div style={{ marginTop: 16, padding: 16, background: '#fafafa', borderRadius: 10, border: `1px solid ${GROUP_COLORS[nodeMap[selected]?.group] || '#e5e7eb'}30` }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: GROUP_COLORS[nodeMap[selected]?.group] }}>
            {MODEL_EMOJI[selected]} {selected} — Connections
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
            {SCHEMA_EDGES.filter(e => e.from === selected || e.to === selected).map((e, i) => {
              const other = e.from === selected ? e.to : e.from;
              const direction = e.from === selected ? '→' : '←';
              return (
                <div key={i} onClick={() => setSelected(other)} style={{
                  padding: '8px 12px', borderRadius: 8, background: 'white', border: '1px solid #f0f0f0',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
                }}>
                  <span style={{ fontSize: 16 }}>{MODEL_EMOJI[other] || '📦'}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600 }}>{direction} {other}</span>
                    {e.note && <span style={{ color: '#9ca3af', marginLeft: 4, fontSize: 10 }}>({e.note})</span>}
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                    background: e.type === '1:1' ? '#dbeafe' : e.type === '1:N' ? '#dcfce7' : '#fef3c7',
                    color: e.type === '1:1' ? '#1d4ed8' : e.type === '1:N' ? '#166534' : '#92400e',
                  }}>{e.type}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════════════════════════════

export default function EventDashboard() {
  const { user, token } = useAuth();

  if (!canAccessPlanner(user?.email)) {
    return <Navigate to="/" replace />;
  }

  const [events, setEvents] = useState<DbEvent[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [config, setConfig] = useState<NotifierConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelFilter, setModelFilter] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [tab, setTab] = useState<'schema' | 'providers' | 'clients' | 'feed' | 'settings'>('schema');
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const fp = modelFilter ? `&model=${modelFilter}` : '';
      const [evR, stR, cfR] = await Promise.all([
        apiFetch<{ success: boolean; data: DbEvent[] }>(`/admin/events?limit=200${fp}`, { token }),
        apiFetch<{ success: boolean; data: EventStats }>('/admin/events/stats', { token }),
        apiFetch<{ success: boolean; data: NotifierConfig }>('/admin/events/config', { token }),
      ]);
      if (evR.success) setEvents(evR.data);
      if (stR.success) setStats(stR.data);
      if (cfR.success) setConfig(cfR.data);
      setError(null);
    } catch (err: any) { setError(err.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [token, modelFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (autoRefresh && tab === 'feed') intervalRef.current = setInterval(fetchData, 15000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetchData, tab]);

  const toggleModel = async (model: string) => {
    if (!config || !token) return;
    const cur = new Set(config.watchedModels);
    cur.has(model) ? cur.delete(model) : cur.add(model);
    try {
      const r = await apiFetch<{ success: boolean; data: NotifierConfig }>('/admin/events/config', { method: 'PUT', token, body: JSON.stringify({ watchedModels: Array.from(cur) }) });
      if (r.success) setConfig(r.data);
    } catch {}
  };

  const timeAgo = (ts: string) => {
    const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  const card = { background: 'white', borderRadius: 12, padding: 20, border: '1px solid #f0f0f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
  const tabSt = (a: boolean) => ({
    padding: '10px 18px', border: 'none', borderBottom: a ? '3px solid #e94560' : '3px solid transparent',
    background: a ? 'rgba(233,69,96,0.06)' : 'transparent', cursor: 'pointer' as const,
    fontWeight: a ? 700 : 500, color: a ? '#e94560' : '#6b7280', fontSize: 13,
    display: 'flex' as const, alignItems: 'center' as const, gap: 6,
  });

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)', padding: '28px 24px 24px', borderBottom: '4px solid #e94560' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ color: 'white', margin: 0, fontSize: 24, fontWeight: 700 }}>🗄️ Database</h1>
              <p style={{ color: 'rgba(255,255,255,0.5)', margin: '4px 0 0', fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>Schema visualization, event monitoring & notification config</p>
            </div>
            {stats && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[
                  { l: 'Models', v: String(SCHEMA_NODES.length), c: '#8b5cf6' },
                  { l: 'Relationships', v: String(SCHEMA_EDGES.length), c: '#0f3460' },
                  { l: 'Events Captured', v: String(stats.total), c: '#e94560' },
                  { l: 'Discord', v: config?.discordEnabled ? 'ON' : 'OFF', c: config?.discordEnabled ? '#5865F2' : '#9ca3af' },
                  { l: 'Email', v: config?.emailEnabled ? 'ON' : 'OFF', c: config?.emailEnabled ? '#10b981' : '#9ca3af' },
                ].map(({ l, v, c }) => (
                  <div key={l} style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: '8px 16px', borderLeft: `3px solid ${c}` }}>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, textTransform: 'uppercase' as const }}>{l}</div>
                    <div style={{ color: 'white', fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>{v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab Nav */}
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 64, zIndex: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex' }}>
            <button onClick={() => setTab('schema')} style={tabSt(tab === 'schema')}>🔗 Schema</button>
            <button onClick={() => setTab('providers')} style={tabSt(tab === 'providers')}>🏪 Providers</button>
            <button onClick={() => setTab('clients')} style={tabSt(tab === 'clients')}>📋 Client Flows</button>
            <button onClick={() => setTab('feed')} style={tabSt(tab === 'feed')}>📡 Event Feed</button>
            <button onClick={() => setTab('settings')} style={tabSt(tab === 'settings')}>⚙️ Settings</button>
          </div>
          {tab === 'feed' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px' }}>
              <button onClick={() => setAutoRefresh(!autoRefresh)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: autoRefresh ? '#f0fdf4' : 'white', color: autoRefresh ? '#166534' : '#6b7280', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                {autoRefresh ? '● Live' : '○ Paused'}
              </button>
              <button onClick={fetchData} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>↻ Refresh</button>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px' }}>
        {error && (
          <div style={{ ...card, borderLeft: '4px solid #e94560', marginBottom: 16, padding: '12px 16px' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#e94560' }}><strong>Error:</strong> {error}
              {error.includes('403') && <span style={{ display: 'block', marginTop: 4, color: '#6b7280', fontSize: 12 }}>Make sure your email is in ADMIN_EMAILS on the backend.</span>}
            </p>
          </div>
        )}

        {/* ─── SCHEMA TAB ─── */}
        {tab === 'schema' && <SchemaView />}

        {/* ─── PROVIDERS TAB ─── */}
        {tab === 'providers' && <ProviderGraph token={token} />}

        {/* ─── CLIENT FLOWS TAB ─── */}
        {tab === 'clients' && <ClientFlowGraph token={token} />}

        {/* ─── EVENT FEED ─── */}
        {tab === 'feed' && (
          loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}><div style={{ fontSize: 32, marginBottom: 8 }}>📡</div>Loading event data...</div>
          ) : (
            <div>
              {/* Filter bar */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>Filter:</span>
                <button onClick={() => setModelFilter('')} style={{ padding: '4px 10px', borderRadius: 6, border: modelFilter === '' ? '2px solid #e94560' : '1px solid #e5e7eb', background: modelFilter === '' ? '#fef2f2' : 'white', fontSize: 11, fontWeight: 600, color: modelFilter === '' ? '#e94560' : '#6b7280', cursor: 'pointer' }}>All</button>
                {Object.entries(stats?.byModel || {}).sort((a, b) => b[1] - a[1]).map(([model, count]) => (
                  <button key={model} onClick={() => setModelFilter(model)} style={{ padding: '4px 10px', borderRadius: 6, border: modelFilter === model ? '2px solid #e94560' : '1px solid #e5e7eb', background: modelFilter === model ? '#fef2f2' : 'white', fontSize: 11, fontWeight: 500, color: modelFilter === model ? '#e94560' : '#6b7280', cursor: 'pointer' }}>
                    {MODEL_EMOJI[model] || '📦'} {model} <span style={{ opacity: 0.6 }}>({count})</span>
                  </button>
                ))}
              </div>

              {/* Stats */}
              {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
                  {Object.entries(stats.byAction).map(([action, count]) => (
                    <div key={action} style={{ ...card, padding: '12px 16px', borderLeft: `4px solid ${ACTION_COLORS[action] || '#6b7280'}` }}>
                      <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' as const, marginBottom: 2 }}>{action}s</div>
                      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'monospace', color: ACTION_COLORS[action] || '#6b7280' }}>{count}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Event list */}
              <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                {events.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}><div style={{ fontSize: 32, marginBottom: 8 }}>🔇</div>No events captured yet.</div>
                ) : (
                  <div>
                    <div style={{ padding: '12px 16px', background: '#fafafa', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>{events.length} events {modelFilter && `(${modelFilter})`}</span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{autoRefresh && '● Refreshing every 15s'}</span>
                    </div>
                    {events.map(event => (
                      <div key={event.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f8f8f8', display: 'flex', gap: 12, alignItems: 'flex-start', background: SEVERITY_BG[event.severity] || 'white' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${SEVERITY_COLORS[event.severity]}15`, fontSize: 18, flexShrink: 0 }}>
                          {MODEL_EMOJI[event.model] || '📦'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, padding: '1px 6px', borderRadius: 4, background: ACTION_COLORS[event.action], color: 'white' }}>{event.action}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>{event.model}</span>
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600, background: `${SEVERITY_COLORS[event.severity]}15`, color: SEVERITY_COLORS[event.severity] }}>{event.severity}</span>
                          </div>
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#4b5563', lineHeight: 1.4 }}>{event.summary}</p>
                          {Object.keys(event.details).length > 0 && (
                            <details style={{ marginTop: 4 }}>
                              <summary style={{ fontSize: 11, color: '#9ca3af', cursor: 'pointer' }}>Details</summary>
                              <div style={{ marginTop: 4, padding: 8, background: 'rgba(0,0,0,0.03)', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', lineHeight: 1.6, color: '#6b7280', maxHeight: 120, overflowY: 'auto' }}>
                                {Object.entries(event.details).map(([k, v]) => (<div key={k}><span style={{ color: '#9ca3af' }}>{k}:</span> {String(v)}</div>))}
                              </div>
                            </details>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0 }}>{timeAgo(event.timestamp)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {/* ─── SETTINGS ─── */}
        {tab === 'settings' && config && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Channel status */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {[
                { icon: '🎮', label: 'Discord', on: config.discordEnabled, desc: config.discordEnabled ? 'All watched events sent as rich embeds.' : 'Set DISCORD_WEBHOOK_URL in backend env vars.', color: '#5865F2' },
                { icon: '📧', label: 'Email', on: config.emailEnabled, desc: config.emailEnabled ? 'Critical events (bookings, payments) trigger alerts.' : 'Set SMTP + ADMIN_NOTIFICATION_EMAIL in backend env vars.', color: '#E94560' },
                { icon: '📊', label: 'Dashboard', on: true, desc: 'Events stored in memory (last 500). Auto-refreshes every 15s.', color: '#10B981' },
              ].map(ch => (
                <div key={ch.label} style={{ ...card, borderTop: `4px solid ${ch.on ? ch.color : '#d1d5db'}` }}>
                  <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>{ch.icon} {ch.label}</h4>
                  <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: ch.on ? '#dcfce7' : '#f3f4f6', color: ch.on ? '#166534' : '#9ca3af', marginBottom: 8 }}>
                    {ch.on ? '● Connected' : '○ Not configured'}
                  </div>
                  <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, margin: 0 }}>{ch.desc}</p>
                </div>
              ))}
            </div>

            {/* Discord setup guide */}
            {!config.discordEnabled && (
              <div style={{ ...card, borderLeft: '4px solid #5865F2' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#5865F2' }}>🎮 Discord Webhook Setup</h4>
                <ol style={{ margin: 0, padding: '0 0 0 18px', fontSize: 13, color: '#4b5563', lineHeight: 2 }}>
                  <li>Open your Discord server → <strong>Server Settings → Integrations → Webhooks</strong></li>
                  <li>Click <strong>"New Webhook"</strong>, name it "CaterEase Events", pick a channel</li>
                  <li>Click <strong>"Copy Webhook URL"</strong></li>
                  <li>In Render → Backend → Environment, add: <code style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>DISCORD_WEBHOOK_URL=your-url</code></li>
                  <li>Also add: <code style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>ADMIN_EMAILS=your@email.com</code></li>
                  <li>Redeploy. Events will flow to Discord immediately.</li>
                </ol>
              </div>
            )}

            {/* Model toggles */}
            <div style={{ ...card }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>Watched Models</h3>
              <p style={{ margin: '0 0 16px', fontSize: 11, color: '#9ca3af' }}>Toggle which models generate notifications. Changes apply immediately.</p>
              {Object.entries(MODEL_GROUPS).map(([group, models]) => (
                <div key={group} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#e94560', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #f3f4f6' }}>{group}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                    {models.map(model => {
                      const w = config.watchedModels.includes(model);
                      return (
                        <button key={model} onClick={() => toggleModel(model)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: w ? '2px solid #10b981' : '2px solid #e5e7eb', background: w ? '#f0fdf4' : 'white', cursor: 'pointer', transition: 'all 0.15s' }}>
                          <span style={{ fontSize: 16 }}>{MODEL_EMOJI[model] || '📦'}</span>
                          <div style={{ flex: 1, textAlign: 'left' }}><div style={{ fontSize: 12, fontWeight: 600, color: w ? '#166534' : '#6b7280' }}>{model}</div></div>
                          {(stats?.byModel[model] || 0) > 0 && <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#9ca3af', background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>{stats?.byModel[model]}</span>}
                          <div style={{ width: 18, height: 18, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: w ? '#10b981' : '#e5e7eb', color: 'white', fontSize: 12, fontWeight: 700 }}>{w ? '✓' : ''}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Env vars reference */}
            <div style={{ ...card }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>Environment Variables</h3>
              <p style={{ margin: '0 0 16px', fontSize: 11, color: '#9ca3af' }}>Backend env vars for the full notification pipeline</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr style={{ background: '#1a1a2e', color: 'white' }}>
                    {['Variable', 'Purpose', 'Status', 'Example'].map(h => <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11 }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {[
                      { v: 'ADMIN_EMAILS', p: 'Emails for admin API access', s: true, e: 'you@gmail.com' },
                      { v: 'DISCORD_WEBHOOK_URL', p: 'Discord webhook for event alerts', s: config.discordEnabled, e: 'https://discord.com/api/webhooks/...' },
                      { v: 'ADMIN_NOTIFICATION_EMAIL', p: 'Email for critical alerts', s: config.emailEnabled, e: 'admin@company.com' },
                      { v: 'SMTP_HOST', p: 'SMTP server', s: config.emailEnabled, e: 'smtp.gmail.com' },
                      { v: 'SMTP_USER', p: 'SMTP username', s: config.emailEnabled, e: 'your@gmail.com' },
                      { v: 'SMTP_PASS', p: 'SMTP password / app password', s: config.emailEnabled, e: '(app password)' },
                      { v: 'VITE_PLANNER_EMAILS', p: 'Frontend: Planner + Database nav visibility', s: true, e: 'you@gmail.com (frontend env)' },
                    ].map((r, i) => (
                      <tr key={r.v} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 ? '#fafafa' : 'white' }}>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600, fontSize: 11, color: '#1a1a2e' }}>{r.v}</td>
                        <td style={{ padding: '10px 12px', color: '#6b7280' }}>{r.p}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: r.s ? '#dcfce7' : '#fef3c7', color: r.s ? '#166534' : '#92400e' }}>{r.s ? 'Set' : 'Not set'}</span>
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 10, color: '#9ca3af' }}>{r.e}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
      <div style={{ textAlign: 'center', padding: '28px 16px', color: '#d1d5db', fontSize: 11 }}>CaterEase / Fetes — Database Dashboard — Feb 2026</div>
    </div>
  );
}
