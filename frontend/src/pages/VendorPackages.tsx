import { useState, useEffect } from 'react';
import {
  Pencil, Trash2, Plus, ChevronUp, Check, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { packagesApi, addOnsApi } from '../utils/api';
import ImageUpload from '../components/ImageUpload';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);

const uid = () => Math.random().toString(36).slice(2);

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_OF_WEEK = ['MON','TUE','WED','THU','FRI','SAT','SUN'];

const labelCls = 'font-sans text-xs font-bold uppercase tracking-widest text-charcoal mb-1 block';
const inputCls = 'w-full border border-border rounded-md px-4 py-3 text-sm font-sans text-dark focus:outline-none focus:border-gold transition-colors bg-white';
const smallInputCls = 'w-full border border-border rounded-md px-3 py-2 text-sm font-sans text-dark focus:outline-none focus:border-gold transition-colors bg-white';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SeasonalRule {
  id: string;
  name: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  priceOverride?: number | null;
  minimumSpendOverride?: number | null;
  multiplier?: number | null;
}

interface DowRule {
  id: string;
  days: string[];
  priceOverride?: number | null;
  minimumSpendOverride?: number | null;
}

interface Package {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  pricingModel: string;
  basePrice: number;
  flatFee?: number | null;
  minimumSpend?: number | null;
  minGuests?: number | null;
  maxGuests?: number | null;
  durationHours?: number | null;
  included: string[];
  isActive: boolean;
  imageUrl?: string | null;
  seasonalRules: SeasonalRule[];
  dayOfWeekRules: DowRule[];
}

interface AddOn {
  id: string;
  name: string;
  description?: string | null;
  pricingType: string;
  price: number;
  isRequired: boolean;
  applicablePackages: { id: string; name: string; category: string }[];
}

// ─── Package form draft ───────────────────────────────────────────────────────

interface PkgDraft {
  name: string;
  description: string;
  category: string;
  pricingModel: string;
  basePrice: string;
  flatFee: string;
  minimumSpend: string;
  minGuests: string;
  maxGuests: string;
  durationHours: string;
  included: string[];
  imageUrl: string;
  seasonalRules: (Omit<SeasonalRule, 'id'> & { _uid: string })[];
  dowRules: (Omit<DowRule, 'id'> & { _uid: string })[];
}

const blankDraft = (): PkgDraft => ({
  name: '', description: '', category: '', pricingModel: 'PER_PERSON',
  basePrice: '', flatFee: '', minimumSpend: '', minGuests: '', maxGuests: '',
  durationHours: '', included: [], imageUrl: '',
  seasonalRules: [], dowRules: [],
});

const pkgToDraft = (p: Package): PkgDraft => ({
  name: p.name,
  description: p.description ?? '',
  category: p.category,
  pricingModel: p.pricingModel,
  basePrice: String(p.basePrice),
  flatFee: p.flatFee != null ? String(p.flatFee) : '',
  minimumSpend: p.minimumSpend != null ? String(p.minimumSpend) : '',
  minGuests: p.minGuests != null ? String(p.minGuests) : '',
  maxGuests: p.maxGuests != null ? String(p.maxGuests) : '',
  durationHours: p.durationHours != null ? String(p.durationHours) : '',
  included: [...p.included],
  imageUrl: p.imageUrl ?? '',
  seasonalRules: p.seasonalRules.map(r => ({ ...r, _uid: r.id })),
  dowRules: p.dayOfWeekRules.map(r => ({ ...r, _uid: r.id })),
});

function draftToPayload(d: PkgDraft) {
  return {
    name:         d.name,
    description:  d.description || undefined,
    category:     d.category,
    pricingModel: d.pricingModel,
    basePrice:    parseFloat(d.basePrice) || 0,
    flatFee:      d.flatFee ? parseFloat(d.flatFee) : undefined,
    minimumSpend: d.minimumSpend ? parseFloat(d.minimumSpend) : undefined,
    minGuests:    d.minGuests ? parseInt(d.minGuests) : undefined,
    maxGuests:    d.maxGuests ? parseInt(d.maxGuests) : undefined,
    durationHours: d.durationHours ? parseFloat(d.durationHours) : undefined,
    included:     d.included,
    imageUrl:     d.imageUrl || undefined,
  };
}

// ─── AddOn form draft ─────────────────────────────────────────────────────────

interface AddOnDraft {
  name: string;
  description: string;
  pricingType: string;
  price: string;
  isRequired: boolean;
  packageIds: string[];
}

const blankAddOnDraft = (): AddOnDraft => ({
  name: '', description: '', pricingType: 'FLAT', price: '', isRequired: false, packageIds: [],
});

const addOnToDraft = (a: AddOn): AddOnDraft => ({
  name: a.name,
  description: a.description ?? '',
  pricingType: a.pricingType,
  price: String(a.price),
  isRequired: a.isRequired,
  packageIds: a.applicablePackages.map(p => p.id),
});

// ─── Pricing model display ────────────────────────────────────────────────────

function PriceDisplay({ pkg }: { pkg: Package }) {
  const cls = 'font-serif text-xl text-gold-dark';
  if (pkg.pricingModel === 'FLAT_PLUS_PER_PERSON') {
    return (
      <span className={cls}>
        {fmt(pkg.flatFee ?? 0)} room + {fmt(pkg.basePrice)} per person
      </span>
    );
  }
  const label =
    pkg.pricingModel === 'PER_PERSON' ? 'per person' :
    pkg.pricingModel === 'FLAT_RATE'  ? 'flat rate' : 'per hour';
  return <span className={cls}>{fmt(pkg.basePrice)} <span className="font-sans text-sm text-muted">{label}</span></span>;
}

// ─── Pricing model toggle ─────────────────────────────────────────────────────

const PRICING_MODELS = [
  { value: 'PER_PERSON',         label: 'Per Person' },
  { value: 'FLAT_RATE',          label: 'Flat Rate' },
  { value: 'PER_HOUR',           label: 'Per Hour' },
  { value: 'FLAT_PLUS_PER_PERSON', label: 'Room + Per Person' },
];

function PricingModelToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRICING_MODELS.map(m => (
        <button
          key={m.value}
          type="button"
          onClick={() => onChange(m.value)}
          className={`font-sans text-xs px-3 py-2 rounded-md border transition-all focus:outline-none ${
            value === m.value
              ? 'bg-gold/10 border-gold text-gold-dark font-semibold'
              : 'border-border text-charcoal hover:border-gold'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

// ─── Chip editor (included items) ─────────────────────────────────────────────

function ChipEditor({ items, onChange }: { items: string[]; onChange: (items: string[]) => void }) {
  const [val, setVal] = useState('');
  function add() {
    const v = val.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setVal('');
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {items.map(item => (
          <span
            key={item}
            className="flex items-center gap-1 bg-bg border border-border rounded-full px-3 py-1 text-xs font-sans text-charcoal"
          >
            {item}
            <button type="button" onClick={() => onChange(items.filter(i => i !== item))} className="text-muted hover:text-red transition-colors ml-1">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 border border-border rounded-md px-3 py-2 text-xs font-sans text-dark focus:outline-none focus:border-gold bg-white"
          placeholder="Add included item…"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button type="button" onClick={add} className="border border-gold text-gold px-3 py-2 rounded-md hover:bg-gold/10 transition-colors">
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Seasonal rule row (inline) ───────────────────────────────────────────────

interface SeasonalRuleDraft {
  _uid: string;
  name: string;
  startMonth: number; startDay: number;
  endMonth: number;   endDay: number;
  priceOverride: string;
  minimumSpendOverride: string;
  multiplier: string;
}

function blankSeasonal(): SeasonalRuleDraft {
  return { _uid: uid(), name: '', startMonth: 1, startDay: 1, endMonth: 12, endDay: 31, priceOverride: '', minimumSpendOverride: '', multiplier: '' };
}

function toSeasonalPayload(r: SeasonalRuleDraft) {
  return {
    name: r.name,
    startMonth: r.startMonth, startDay: r.startDay,
    endMonth:   r.endMonth,   endDay:   r.endDay,
    priceOverride:        r.priceOverride        ? parseFloat(r.priceOverride)        : undefined,
    minimumSpendOverride: r.minimumSpendOverride ? parseFloat(r.minimumSpendOverride) : undefined,
    multiplier:           r.multiplier           ? parseFloat(r.multiplier)           : undefined,
  };
}

function SeasonalRuleRow({
  rule, onChange, onDelete,
}: { rule: SeasonalRuleDraft; onChange: (r: SeasonalRuleDraft) => void; onDelete: () => void }) {
  const p = (field: keyof SeasonalRuleDraft, v: any) => onChange({ ...rule, [field]: v });
  return (
    <div className="bg-bg border border-border rounded-md p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <input
          className={smallInputCls}
          placeholder="Rule name (e.g. High Season)"
          value={rule.name}
          onChange={e => p('name', e.target.value)}
        />
        <button type="button" onClick={onDelete} className="text-muted hover:text-red transition-colors flex-shrink-0">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Start</label>
          <div className="flex gap-2">
            <select className={smallInputCls} value={rule.startMonth} onChange={e => p('startMonth', +e.target.value)}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <input type="number" className={smallInputCls} placeholder="Day" min={1} max={31}
              value={rule.startDay} onChange={e => p('startDay', +e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelCls}>End</label>
          <div className="flex gap-2">
            <select className={smallInputCls} value={rule.endMonth} onChange={e => p('endMonth', +e.target.value)}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <input type="number" className={smallInputCls} placeholder="Day" min={1} max={31}
              value={rule.endDay} onChange={e => p('endDay', +e.target.value)} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Price Override</label>
          <input type="number" className={smallInputCls} placeholder="$" min={0}
            value={rule.priceOverride} onChange={e => p('priceOverride', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Min Spend Override</label>
          <input type="number" className={smallInputCls} placeholder="$" min={0}
            value={rule.minimumSpendOverride} onChange={e => p('minimumSpendOverride', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Multiplier</label>
          <input type="number" className={smallInputCls} placeholder="e.g. 1.25" min={0} step={0.01}
            value={rule.multiplier} onChange={e => p('multiplier', e.target.value)} />
        </div>
      </div>
    </div>
  );
}

// ─── DOW rule row (inline) ────────────────────────────────────────────────────

interface DowRuleDraft {
  _uid: string;
  days: string[];
  priceOverride: string;
  minimumSpendOverride: string;
}

function blankDow(): DowRuleDraft {
  return { _uid: uid(), days: [], priceOverride: '', minimumSpendOverride: '' };
}

function toDowPayload(r: DowRuleDraft) {
  return {
    days: r.days,
    priceOverride:        r.priceOverride        ? parseFloat(r.priceOverride)        : undefined,
    minimumSpendOverride: r.minimumSpendOverride ? parseFloat(r.minimumSpendOverride) : undefined,
  };
}

function DowRuleRow({
  rule, onChange, onDelete,
}: { rule: DowRuleDraft; onChange: (r: DowRuleDraft) => void; onDelete: () => void }) {
  const p = (field: keyof DowRuleDraft, v: any) => onChange({ ...rule, [field]: v });
  function toggleDay(day: string) {
    const next = rule.days.includes(day) ? rule.days.filter(d => d !== day) : [...rule.days, day];
    p('days', next);
  }
  return (
    <div className="bg-bg border border-border rounded-md p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {DAYS_OF_WEEK.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              className={`font-sans text-xs px-2.5 py-1.5 rounded border transition-all focus:outline-none ${
                rule.days.includes(d)
                  ? 'bg-gold/10 border-gold text-gold-dark font-semibold'
                  : 'border-border text-charcoal hover:border-gold'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <button type="button" onClick={onDelete} className="text-muted hover:text-red transition-colors flex-shrink-0 mt-1">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Price Override</label>
          <input type="number" className={smallInputCls} placeholder="$" min={0}
            value={rule.priceOverride} onChange={e => p('priceOverride', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Min Spend Override</label>
          <input type="number" className={smallInputCls} placeholder="$" min={0}
            value={rule.minimumSpendOverride} onChange={e => p('minimumSpendOverride', e.target.value)} />
        </div>
      </div>
    </div>
  );
}

// ─── Package form ─────────────────────────────────────────────────────────────

function PackageForm({
  draft,
  onChange,
  packageId,
}: {
  draft: PkgDraft;
  onChange: (d: PkgDraft) => void;
  packageId?: string; // undefined = new package
}) {
  const p = (field: keyof PkgDraft, v: any) => onChange({ ...draft, [field]: v });

  function addSeasonal() {
    p('seasonalRules', [...draft.seasonalRules, { ...blankSeasonal() }]);
  }
  function updateSeasonal(idx: number, r: any) {
    const next = [...draft.seasonalRules];
    next[idx] = r;
    p('seasonalRules', next);
  }
  function removeSeasonal(idx: number) {
    p('seasonalRules', draft.seasonalRules.filter((_, i) => i !== idx));
  }

  function addDow() {
    p('dowRules', [...draft.dowRules, { ...blankDow() }]);
  }
  function updateDow(idx: number, r: any) {
    const next = [...draft.dowRules];
    next[idx] = r;
    p('dowRules', next);
  }
  function removeDow(idx: number) {
    p('dowRules', draft.dowRules.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-6 pt-4 border-t border-border mt-4">
      {/* Name */}
      <div>
        <label className={labelCls}>Package Name *</label>
        <input className={inputCls} placeholder="e.g. Seated Dinner Package"
          value={draft.name} onChange={e => p('name', e.target.value)} />
      </div>

      {/* Category */}
      <div>
        <label className={labelCls}>Category</label>
        <input className={inputCls} placeholder="e.g. Venue Packages"
          value={draft.category} onChange={e => p('category', e.target.value)} />
      </div>

      {/* Pricing model */}
      <div>
        <label className={labelCls}>Pricing Model</label>
        <PricingModelToggle value={draft.pricingModel} onChange={v => p('pricingModel', v)} />
      </div>

      {/* Price fields */}
      <div className="grid grid-cols-2 gap-4">
        {draft.pricingModel === 'FLAT_PLUS_PER_PERSON' ? (
          <>
            <div>
              <label className={labelCls}>Flat Room Fee ($)</label>
              <input type="number" className={inputCls} placeholder="0" min={0}
                value={draft.flatFee} onChange={e => p('flatFee', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Per Person Rate ($)</label>
              <input type="number" className={inputCls} placeholder="0" min={0}
                value={draft.basePrice} onChange={e => p('basePrice', e.target.value)} />
            </div>
          </>
        ) : (
          <div className="col-span-2 sm:col-span-1">
            <label className={labelCls}>
              {draft.pricingModel === 'PER_PERSON' ? 'Price per Person ($)' :
               draft.pricingModel === 'FLAT_RATE'  ? 'Flat Rate ($)' : 'Hourly Rate ($)'}
            </label>
            <input type="number" className={inputCls} placeholder="0" min={0}
              value={draft.basePrice} onChange={e => p('basePrice', e.target.value)} />
          </div>
        )}
        <div>
          <label className={labelCls}>Minimum Spend ($)</label>
          <input type="number" className={inputCls} placeholder="Optional" min={0}
            value={draft.minimumSpend} onChange={e => p('minimumSpend', e.target.value)} />
        </div>
      </div>

      {/* Guest range + duration */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Min Guests</label>
          <input type="number" className={inputCls} placeholder="—" min={0}
            value={draft.minGuests} onChange={e => p('minGuests', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Max Guests</label>
          <input type="number" className={inputCls} placeholder="—" min={0}
            value={draft.maxGuests} onChange={e => p('maxGuests', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Duration (hrs)</label>
          <input type="number" className={inputCls} placeholder="—" min={0} step={0.5}
            value={draft.durationHours} onChange={e => p('durationHours', e.target.value)} />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className={labelCls}>Description</label>
        <textarea
          className="w-full border border-border rounded-md px-4 py-3 text-sm font-sans text-dark focus:outline-none focus:border-gold transition-colors bg-white resize-none h-20"
          placeholder="Optional description shown to clients"
          value={draft.description}
          onChange={e => p('description', e.target.value)}
        />
      </div>

      {/* Included items */}
      <div>
        <label className={labelCls}>What's Included</label>
        <ChipEditor items={draft.included} onChange={v => p('included', v)} />
      </div>

      {/* Package image */}
      {packageId && (
        <div>
          <label className={labelCls}>Package Image</label>
          <div className="max-w-xs">
            <ImageUpload
              currentUrl={draft.imageUrl || undefined}
              onUpload={url => p('imageUrl', url)}
              endpoint="package-image"
              packageId={packageId}
              label="Upload Package Image"
              aspectRatio="landscape"
            />
          </div>
          <p className="font-sans text-xs text-muted mt-1">JPG/PNG/WebP · max 5 MB · 800×600</p>
        </div>
      )}

      {/* Seasonal rules */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className={labelCls + ' mb-0'}>Seasonal Pricing Rules</label>
          <button type="button" onClick={addSeasonal}
            className="flex items-center gap-1 font-sans text-xs text-gold hover:text-gold-dark transition-colors">
            <Plus size={13} /> Add Rule
          </button>
        </div>
        {draft.seasonalRules.length === 0 ? (
          <p className="font-sans text-xs text-muted">No seasonal rules. Prices stay flat year-round.</p>
        ) : (
          <div className="space-y-3">
            {draft.seasonalRules.map((r, i) => (
              <SeasonalRuleRow
                key={r._uid}
                rule={r as unknown as SeasonalRuleDraft}
                onChange={v => updateSeasonal(i, v)}
                onDelete={() => removeSeasonal(i)}
              />
            ))}
          </div>
        )}
      </div>

      {/* DOW rules */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className={labelCls + ' mb-0'}>Day-of-Week Pricing Rules</label>
          <button type="button" onClick={addDow}
            className="flex items-center gap-1 font-sans text-xs text-gold hover:text-gold-dark transition-colors">
            <Plus size={13} /> Add Rule
          </button>
        </div>
        {draft.dowRules.length === 0 ? (
          <p className="font-sans text-xs text-muted">No day-of-week rules.</p>
        ) : (
          <div className="space-y-3">
            {draft.dowRules.map((r, i) => (
              <DowRuleRow
                key={r._uid}
                rule={r as unknown as DowRuleDraft}
                onChange={v => updateDow(i, v)}
                onDelete={() => removeDow(i)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Package card ─────────────────────────────────────────────────────────────

function PackageCard({
  pkg,
  token,
  onUpdate,
  onDelete,
}: {
  pkg: Package;
  token: string;
  onUpdate: (updated: Package) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft]       = useState<PkgDraft>(pkgToDraft(pkg));
  const [saving, setSaving]     = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleEdit() {
    setDraft(pkgToDraft(pkg)); // reset to current server state
    setError(null);
    setExpanded(e => !e);
  }

  async function handleSave() {
    if (!draft.name.trim()) { setError('Package name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      // 1. Update base package fields
      const res = await packagesApi.update(pkg.id, draftToPayload(draft), token) as any;
      let updated: Package = res.data;

      // 2. Seasonal rules: delete all existing, re-create from draft
      //    (simplest approach — no partial diff needed at this scale)
      for (const existing of pkg.seasonalRules) {
        await fetch(
          `${import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/v1` : '/api/v1'}/packages/${pkg.id}/seasonal-rules/${existing.id}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
        );
      }
      const newSeasonalRules: SeasonalRule[] = [];
      for (const r of draft.seasonalRules) {
        const rRes = await packagesApi.addSeasonalRule(pkg.id, toSeasonalPayload(r as any), token) as any;
        if (rRes.data) newSeasonalRules.push(rRes.data);
      }

      // 3. DOW rules: same pattern
      for (const existing of pkg.dayOfWeekRules) {
        await fetch(
          `${import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/v1` : '/api/v1'}/packages/${pkg.id}/dow-rules/${existing.id}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
        );
      }
      const newDowRules: DowRule[] = [];
      for (const r of draft.dowRules) {
        const rRes = await packagesApi.addDowRule(pkg.id, toDowPayload(r as any), token) as any;
        if (rRes.data) newDowRules.push(rRes.data);
      }

      onUpdate({ ...updated, seasonalRules: newSeasonalRules, dayOfWeekRules: newDowRules });
      setExpanded(false);
    } catch (err: any) {
      setError(err.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle() {
    setToggling(true);
    try {
      const res = await packagesApi.toggleActive(pkg.id, token) as any;
      onUpdate(res.data);
    } catch {
      // silent — UI stays as-is on failure
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    try {
      await packagesApi.delete(pkg.id, token);
      onDelete(pkg.id);
    } catch (err: any) {
      setError(err.message ?? 'Failed to delete');
      setConfirmDelete(false);
    }
  }

  return (
    <div className="bg-white border border-border rounded-md p-6 mb-4">
      {/* ── Top row ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Name + category */}
        <span className="font-sans text-sm font-bold uppercase tracking-wide text-dark flex-1 min-w-0 truncate">
          {pkg.name}
        </span>
        <span className="bg-gold/10 text-gold-dark text-xs px-2 py-0.5 rounded-full font-sans flex-shrink-0">
          {pkg.category || '—'}
        </span>

        {/* Active toggle */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={toggling}
          className="flex items-center gap-1.5 font-sans text-xs transition-colors focus:outline-none flex-shrink-0"
        >
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${pkg.isActive ? 'bg-green' : 'bg-muted'}`} />
          <span className={pkg.isActive ? 'text-green' : 'text-muted'}>{pkg.isActive ? 'Active' : 'Inactive'}</span>
        </button>

        {/* Edit button */}
        <button
          type="button"
          onClick={handleEdit}
          className="flex items-center gap-1 font-sans text-xs text-charcoal hover:text-gold transition-colors focus:outline-none flex-shrink-0"
        >
          {expanded ? <ChevronUp size={14} /> : <Pencil size={14} />}
          {expanded ? 'Collapse' : 'Edit'}
        </button>

        {/* Delete button */}
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="font-sans text-xs text-red">Delete?</span>
            <button type="button" onClick={handleDelete}
              className="font-sans text-xs font-bold text-red hover:text-red/80 transition-colors focus:outline-none">
              Yes
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)}
              className="font-sans text-xs text-muted hover:text-charcoal transition-colors focus:outline-none">
              No
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-muted hover:text-red transition-colors focus:outline-none flex-shrink-0"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* ── Price row ── */}
      <div className="mt-3">
        <PriceDisplay pkg={pkg} />
        {pkg.minimumSpend != null && (
          <span className="font-sans text-xs text-muted ml-3">
            min {fmt(pkg.minimumSpend)}
          </span>
        )}
      </div>

      {/* ── Meta row ── */}
      <div className="flex flex-wrap gap-4 mt-2">
        {(pkg.minGuests != null || pkg.maxGuests != null) && (
          <span className="font-sans text-xs text-muted">
            {pkg.minGuests ?? '—'}–{pkg.maxGuests ?? '—'} guests
          </span>
        )}
        {pkg.durationHours != null && (
          <span className="font-sans text-xs text-muted">{pkg.durationHours}h</span>
        )}
      </div>

      {/* ── Included chips ── */}
      {pkg.included.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {pkg.included.map(item => (
            <span key={item} className="bg-bg border border-border rounded-full px-3 py-1 text-xs font-sans text-charcoal">
              {item}
            </span>
          ))}
        </div>
      )}

      {/* ── Rules summary ── */}
      <div className="flex gap-4 mt-3">
        {pkg.seasonalRules.length > 0 && (
          <span className="font-sans text-xs text-muted">
            {pkg.seasonalRules.length} seasonal rule{pkg.seasonalRules.length !== 1 ? 's' : ''}
          </span>
        )}
        {pkg.dayOfWeekRules.length > 0 && (
          <span className="font-sans text-xs text-muted">
            {pkg.dayOfWeekRules.length} day-of-week rule{pkg.dayOfWeekRules.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Inline edit form ── */}
      {expanded && (
        <>
          <PackageForm draft={draft} onChange={setDraft} packageId={pkg.id} />
          {error && <p className="font-sans text-xs text-red mt-3">{error}</p>}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-gold text-dark font-sans text-xs font-bold uppercase tracking-widest px-6 py-2.5 rounded-md hover:bg-gold-dark transition-colors disabled:opacity-60 focus:outline-none"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => { setExpanded(false); setError(null); }}
              className="border border-border text-charcoal font-sans text-xs uppercase tracking-widest px-6 py-2.5 rounded-md hover:border-gold hover:text-gold transition-colors focus:outline-none"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Add-on card ──────────────────────────────────────────────────────────────

function AddOnCard({
  addOn,
  packages,
  token,
  onUpdate,
  onDelete,
}: {
  addOn: AddOn;
  packages: Package[];
  token: string;
  onUpdate: (a: AddOn) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded]   = useState(false);
  const [draft, setDraft]         = useState<AddOnDraft>(addOnToDraft(addOn));
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const PRICING_TYPE_LABELS: Record<string, string> = {
    FLAT: 'Flat', PER_PERSON: 'Per Person', PER_HOUR: 'Per Hour',
  };

  async function handleSave() {
    if (!draft.name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError(null);
    try {
      const res = await addOnsApi.update(addOn.id, {
        name: draft.name,
        description: draft.description || undefined,
        pricingType: draft.pricingType,
        price: parseFloat(draft.price) || 0,
        isRequired: draft.isRequired,
        applicablePackageIds: draft.packageIds.length > 0 ? draft.packageIds : undefined,
      }, token) as any;
      onUpdate(res.data);
      setExpanded(false);
    } catch (err: any) {
      setError(err.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await addOnsApi.delete(addOn.id, token);
      onDelete(addOn.id);
    } catch (err: any) {
      setError(err.message ?? 'Failed to delete');
      setConfirmDelete(false);
    }
  }

  const pkgNames = addOn.applicablePackages.length > 0
    ? addOn.applicablePackages.map(p => p.name).join(', ')
    : 'All packages';

  return (
    <div className="bg-white border border-border rounded-md p-4 mb-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-sans text-sm font-semibold text-dark flex-1 min-w-0 truncate">{addOn.name}</span>
        <span className="bg-bg border border-border text-charcoal text-xs px-2 py-0.5 rounded-full font-sans">
          {PRICING_TYPE_LABELS[addOn.pricingType] ?? addOn.pricingType} · {fmt(addOn.price)}
        </span>
        {addOn.isRequired && (
          <span className="bg-gold/10 text-gold-dark text-xs px-2 py-0.5 rounded-full font-sans">Required</span>
        )}
        <button type="button" onClick={() => { setDraft(addOnToDraft(addOn)); setError(null); setExpanded(e => !e); }}
          className="flex items-center gap-1 font-sans text-xs text-charcoal hover:text-gold transition-colors focus:outline-none flex-shrink-0">
          {expanded ? <ChevronUp size={14} /> : <Pencil size={14} />}
          {expanded ? 'Collapse' : 'Edit'}
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="font-sans text-xs text-red">Delete?</span>
            <button type="button" onClick={handleDelete} className="font-sans text-xs font-bold text-red focus:outline-none">Yes</button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="font-sans text-xs text-muted focus:outline-none">No</button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)}
            className="text-muted hover:text-red transition-colors focus:outline-none flex-shrink-0">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <p className="font-sans text-xs text-muted mt-1.5">Available with: {pkgNames}</p>

      {expanded && (
        <div className="pt-4 border-t border-border mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Name *</label>
              <input className={inputCls} value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Pricing Type</label>
              <select className={inputCls + ' appearance-none'} value={draft.pricingType}
                onChange={e => setDraft(d => ({ ...d, pricingType: e.target.value }))}>
                <option value="FLAT">Flat</option>
                <option value="PER_PERSON">Per Person</option>
                <option value="PER_HOUR">Per Hour</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Price ($)</label>
              <input type="number" className={inputCls} min={0}
                value={draft.price} onChange={e => setDraft(d => ({ ...d, price: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input className={inputCls} value={draft.description}
              onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} />
          </div>
          <div className="flex items-center gap-3">
            <button type="button"
              onClick={() => setDraft(d => ({ ...d, isRequired: !d.isRequired }))}
              className={`flex items-center gap-2 font-sans text-xs px-3 py-2 rounded-md border transition-all focus:outline-none ${
                draft.isRequired ? 'bg-gold/10 border-gold text-gold-dark font-semibold' : 'border-border text-charcoal hover:border-gold'
              }`}>
              {draft.isRequired ? <Check size={12} /> : <X size={12} />}
              Required Add-on
            </button>
          </div>
          <div>
            <label className={labelCls}>Available With</label>
            <p className="font-sans text-xs text-muted mb-2">Leave none selected to apply to all packages.</p>
            <div className="flex flex-wrap gap-2">
              {packages.map(p => {
                const active = draft.packageIds.includes(p.id);
                return (
                  <button key={p.id} type="button"
                    onClick={() => {
                      const next = active ? draft.packageIds.filter(id => id !== p.id) : [...draft.packageIds, p.id];
                      setDraft(d => ({ ...d, packageIds: next }));
                    }}
                    className={`font-sans text-xs px-3 py-1.5 rounded-md border transition-all focus:outline-none ${
                      active ? 'bg-gold/10 border-gold text-gold-dark font-semibold' : 'border-border text-charcoal hover:border-gold'
                    }`}>
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
          {error && <p className="font-sans text-xs text-red">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={handleSave} disabled={saving}
              className="bg-gold text-dark font-sans text-xs font-bold uppercase tracking-widest px-6 py-2.5 rounded-md hover:bg-gold-dark transition-colors disabled:opacity-60 focus:outline-none">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" onClick={() => { setExpanded(false); setError(null); }}
              className="border border-border text-charcoal font-sans text-xs uppercase tracking-widest px-6 py-2.5 rounded-md hover:border-gold hover:text-gold transition-colors focus:outline-none">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white border border-border rounded-md p-6 mb-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-4 bg-bg rounded w-1/3" />
        <div className="h-5 bg-bg rounded-full w-20" />
        <div className="ml-auto h-4 bg-bg rounded w-16" />
      </div>
      <div className="h-7 bg-bg rounded w-32 mt-4" />
      <div className="flex gap-2 mt-3">
        <div className="h-6 bg-bg rounded-full w-24" />
        <div className="h-6 bg-bg rounded-full w-20" />
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function VendorPackages() {
  const { token } = useAuth();

  const [packages, setPackages]   = useState<Package[]>([]);
  const [addOns, setAddOns]       = useState<AddOn[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // New package form
  const [showNewPkg, setShowNewPkg]     = useState(false);
  const [newPkgDraft, setNewPkgDraft]   = useState<PkgDraft>(blankDraft());
  const [newPkgSaving, setNewPkgSaving] = useState(false);
  const [newPkgError, setNewPkgError]   = useState<string | null>(null);

  // New add-on form
  const [showNewAddOn, setShowNewAddOn]     = useState(false);
  const [newAddOnDraft, setNewAddOnDraft]   = useState<AddOnDraft>(blankAddOnDraft());
  const [newAddOnSaving, setNewAddOnSaving] = useState(false);
  const [newAddOnError, setNewAddOnError]   = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      packagesApi.getMyPackages(token) as Promise<any>,
      addOnsApi.getMyAddOns(token) as Promise<any>,
    ])
      .then(([pkgRes, addOnRes]) => {
        if (pkgRes.success)   setPackages(pkgRes.data ?? []);
        if (addOnRes.success) setAddOns(addOnRes.data ?? []);
      })
      .catch(() => setError('Failed to load packages'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleCreatePackage() {
    if (!newPkgDraft.name.trim()) { setNewPkgError('Package name is required'); return; }
    setNewPkgSaving(true); setNewPkgError(null);
    try {
      const res = await packagesApi.create(draftToPayload(newPkgDraft), token!) as any;
      setPackages(prev => [...prev, { ...res.data, seasonalRules: [], dayOfWeekRules: [] }]);
      setShowNewPkg(false);
      setNewPkgDraft(blankDraft());
    } catch (err: any) {
      setNewPkgError(err.message ?? 'Failed to create package');
    } finally {
      setNewPkgSaving(false);
    }
  }

  async function handleCreateAddOn() {
    if (!newAddOnDraft.name.trim()) { setNewAddOnError('Name is required'); return; }
    setNewAddOnSaving(true); setNewAddOnError(null);
    try {
      const res = await addOnsApi.create({
        name: newAddOnDraft.name,
        description: newAddOnDraft.description || undefined,
        pricingType: newAddOnDraft.pricingType,
        price: parseFloat(newAddOnDraft.price) || 0,
        isRequired: newAddOnDraft.isRequired,
        applicablePackageIds: newAddOnDraft.packageIds.length > 0 ? newAddOnDraft.packageIds : undefined,
      }, token!) as any;
      setAddOns(prev => [...prev, res.data]);
      setShowNewAddOn(false);
      setNewAddOnDraft(blankAddOnDraft());
    } catch (err: any) {
      setNewAddOnError(err.message ?? 'Failed to create add-on');
    } finally {
      setNewAddOnSaving(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg px-6 md:px-12 py-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-serif text-3xl text-dark">My Packages</h1>
            <p className="font-sans text-sm text-muted mt-1">Manage your packages, pricing rules and add-ons.</p>
          </div>
          <button
            type="button"
            onClick={() => { setShowNewPkg(v => !v); setNewPkgError(null); setNewPkgDraft(blankDraft()); }}
            className="bg-gold text-dark font-sans text-xs font-bold uppercase tracking-widest px-6 py-2.5 rounded-md hover:bg-gold-dark transition-colors focus:outline-none flex items-center gap-2 flex-shrink-0"
          >
            <Plus size={14} />
            Add Package
          </button>
        </div>

        {error && (
          <div className="bg-red/10 border border-red/20 rounded-md p-4 mb-6">
            <p className="font-sans text-sm text-red">{error}</p>
          </div>
        )}

        {/* ── New package inline form ── */}
        {showNewPkg && (
          <div className="bg-white border border-gold/40 rounded-md p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="font-sans text-xs font-bold uppercase tracking-widest text-gold">New Package</p>
              <button type="button" onClick={() => setShowNewPkg(false)} className="text-muted hover:text-charcoal transition-colors focus:outline-none">
                <X size={16} />
              </button>
            </div>
            <PackageForm draft={newPkgDraft} onChange={setNewPkgDraft} packageId={undefined} />
            {newPkgError && <p className="font-sans text-xs text-red mt-3">{newPkgError}</p>}
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={handleCreatePackage} disabled={newPkgSaving}
                className="bg-gold text-dark font-sans text-xs font-bold uppercase tracking-widest px-6 py-2.5 rounded-md hover:bg-gold-dark transition-colors disabled:opacity-60 focus:outline-none">
                {newPkgSaving ? 'Creating…' : 'Create Package'}
              </button>
              <button type="button" onClick={() => { setShowNewPkg(false); setNewPkgError(null); }}
                className="border border-border text-charcoal font-sans text-xs uppercase tracking-widest px-6 py-2.5 rounded-md hover:border-gold hover:text-gold transition-colors focus:outline-none">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Packages list ── */}
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : packages.length === 0 && !showNewPkg ? (
          <div className="bg-white border border-border rounded-md p-12 text-center mb-8">
            <p className="font-sans text-sm text-muted mb-4">No packages yet.</p>
            <button type="button" onClick={() => setShowNewPkg(true)}
              className="bg-gold text-dark font-sans text-xs font-bold uppercase tracking-widest px-6 py-2.5 rounded-md hover:bg-gold-dark transition-colors focus:outline-none">
              Add Your First Package
            </button>
          </div>
        ) : (
          packages.map(pkg => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              token={token!}
              onUpdate={updated => setPackages(prev => prev.map(p => p.id === updated.id ? updated : p))}
              onDelete={id => setPackages(prev => prev.filter(p => p.id !== id))}
            />
          ))
        )}

        {/* ── Add-ons section ── */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <p className="font-sans text-xs font-bold uppercase tracking-widest text-charcoal">Add-ons</p>
            <button
              type="button"
              onClick={() => { setShowNewAddOn(v => !v); setNewAddOnError(null); setNewAddOnDraft(blankAddOnDraft()); }}
              className="flex items-center gap-1 font-sans text-xs text-gold hover:text-gold-dark transition-colors focus:outline-none"
            >
              <Plus size={13} /> Add Add-on
            </button>
          </div>

          {/* New add-on form */}
          {showNewAddOn && (
            <div className="bg-white border border-gold/40 rounded-md p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <p className="font-sans text-xs font-bold uppercase tracking-widest text-gold">New Add-on</p>
                <button type="button" onClick={() => setShowNewAddOn(false)} className="text-muted hover:text-charcoal transition-colors focus:outline-none">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className={labelCls}>Name *</label>
                    <input className={inputCls} placeholder="e.g. Audio & Visual Package"
                      value={newAddOnDraft.name} onChange={e => setNewAddOnDraft(d => ({ ...d, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Pricing Type</label>
                    <select className={inputCls + ' appearance-none'} value={newAddOnDraft.pricingType}
                      onChange={e => setNewAddOnDraft(d => ({ ...d, pricingType: e.target.value }))}>
                      <option value="FLAT">Flat</option>
                      <option value="PER_PERSON">Per Person</option>
                      <option value="PER_HOUR">Per Hour</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Price ($)</label>
                    <input type="number" className={inputCls} min={0} placeholder="0"
                      value={newAddOnDraft.price} onChange={e => setNewAddOnDraft(d => ({ ...d, price: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Description</label>
                  <input className={inputCls} placeholder="Optional"
                    value={newAddOnDraft.description} onChange={e => setNewAddOnDraft(d => ({ ...d, description: e.target.value }))} />
                </div>
                <div className="flex items-center gap-3">
                  <button type="button"
                    onClick={() => setNewAddOnDraft(d => ({ ...d, isRequired: !d.isRequired }))}
                    className={`flex items-center gap-2 font-sans text-xs px-3 py-2 rounded-md border transition-all focus:outline-none ${
                      newAddOnDraft.isRequired ? 'bg-gold/10 border-gold text-gold-dark font-semibold' : 'border-border text-charcoal hover:border-gold'
                    }`}>
                    {newAddOnDraft.isRequired ? <Check size={12} /> : <X size={12} />}
                    Required
                  </button>
                </div>
                {packages.length > 0 && (
                  <div>
                    <label className={labelCls}>Available With (leave empty for all)</label>
                    <div className="flex flex-wrap gap-2">
                      {packages.map(p => {
                        const active = newAddOnDraft.packageIds.includes(p.id);
                        return (
                          <button key={p.id} type="button"
                            onClick={() => {
                              const next = active ? newAddOnDraft.packageIds.filter(id => id !== p.id) : [...newAddOnDraft.packageIds, p.id];
                              setNewAddOnDraft(d => ({ ...d, packageIds: next }));
                            }}
                            className={`font-sans text-xs px-3 py-1.5 rounded-md border transition-all focus:outline-none ${
                              active ? 'bg-gold/10 border-gold text-gold-dark font-semibold' : 'border-border text-charcoal hover:border-gold'
                            }`}>
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              {newAddOnError && <p className="font-sans text-xs text-red mt-3">{newAddOnError}</p>}
              <div className="flex gap-3 mt-5">
                <button type="button" onClick={handleCreateAddOn} disabled={newAddOnSaving}
                  className="bg-gold text-dark font-sans text-xs font-bold uppercase tracking-widest px-6 py-2.5 rounded-md hover:bg-gold-dark transition-colors disabled:opacity-60 focus:outline-none">
                  {newAddOnSaving ? 'Creating…' : 'Create Add-on'}
                </button>
                <button type="button" onClick={() => { setShowNewAddOn(false); setNewAddOnError(null); }}
                  className="border border-border text-charcoal font-sans text-xs uppercase tracking-widest px-6 py-2.5 rounded-md hover:border-gold hover:text-gold transition-colors focus:outline-none">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Add-ons list */}
          {!loading && addOns.length === 0 && !showNewAddOn ? (
            <div className="bg-white border border-border rounded-md p-8 text-center">
              <p className="font-sans text-sm text-muted">No add-ons yet.</p>
            </div>
          ) : (
            addOns.map(a => (
              <AddOnCard
                key={a.id}
                addOn={a}
                packages={packages}
                token={token!}
                onUpdate={updated => setAddOns(prev => prev.map(x => x.id === updated.id ? updated : x))}
                onDelete={id => setAddOns(prev => prev.filter(x => x.id !== id))}
              />
            ))
          )}
        </div>

      </div>
    </div>
  );
}
