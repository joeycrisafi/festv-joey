import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  UtensilsCrossed, Wine, Music, Camera, Flower2,
  ChevronDown, ChevronUp, CheckCircle, X, Plus,
  ChevronLeft, ChevronRight, Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ImageUpload from '../components/ImageUpload';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(n);

const uid = () => Math.random().toString(36).slice(2);

const VENDOR_TYPES = [
  { value: 'RESTO_VENUE',   label: 'Restaurant / Venue', Icon: UtensilsCrossed, desc: 'Dining spaces, private rooms, and full venue experiences' },
  { value: 'CATERER',       label: 'Caterer',             Icon: Wine,            desc: 'Off-site catering, staffing, and full-service food packages' },
  { value: 'ENTERTAINMENT', label: 'Entertainment',       Icon: Music,           desc: 'DJs, live music, performers, and production' },
  { value: 'PHOTO_VIDEO',   label: 'Photo & Video',       Icon: Camera,          desc: 'Photography, videography, and creative media' },
  { value: 'FLORIST_DECOR', label: 'Florist & Decor',     Icon: Flower2,         desc: 'Floral design, styling, and event décor' },
];

const EVENT_TYPES = [
  { value: 'WEDDING',        label: 'Wedding',        emoji: '💍' },
  { value: 'CORPORATE',      label: 'Corporate',      emoji: '💼' },
  { value: 'BIRTHDAY',       label: 'Birthday',       emoji: '🎂' },
  { value: 'ANNIVERSARY',    label: 'Anniversary',    emoji: '🥂' },
  { value: 'GRADUATION',     label: 'Graduation',     emoji: '🎓' },
  { value: 'BABY_SHOWER',    label: 'Baby Shower',    emoji: '🍼' },
  { value: 'BRIDAL_SHOWER',  label: 'Bridal Shower',  emoji: '👰' },
  { value: 'HOLIDAY',        label: 'Holiday',        emoji: '✨' },
  { value: 'COCKTAIL_PARTY', label: 'Cocktail Party', emoji: '🍸' },
  { value: 'DINNER_PARTY',   label: 'Dinner Party',   emoji: '🍽️' },
  { value: 'BRUNCH',         label: 'Brunch',         emoji: '🥞' },
  { value: 'OTHER',          label: 'Other',          emoji: '🎉' },
];

const LANGUAGES = ['English', 'French', 'Spanish', 'Portuguese', 'Arabic', 'Mandarin', 'Italian', 'Other'];

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const STEP_LABELS = [
  'Your Business',
  'Your Events',
  'Your Packages',
  'Add-ons',
  'Availability',
  'Preview & Publish',
];

// ---------------------------------------------------------------------------
// Package template library
// ---------------------------------------------------------------------------

const PKG_TEMPLATES: Record<string, Array<{
  name: string; pricingModel: string; category: string; basePrice: number;
  minimumSpend?: number; minGuests?: number; maxGuests?: number;
  durationHours?: number; included: string[]; eventTypes: string[];
}>> = {
  RESTO_VENUE: [
    { name: 'Full Venue Buyout',      pricingModel: 'FLAT_RATE',  category: 'Venue Packages', basePrice: 0, minimumSpend: 0, minGuests: 50,  maxGuests: 200, durationHours: 5, included: ['Full venue access','Tables and chairs','Basic lighting','Staff'],                          eventTypes: ['WEDDING','CORPORATE','BIRTHDAY','ANNIVERSARY'] },
    { name: 'Seated Dinner Package',  pricingModel: 'PER_PERSON', category: 'Venue Packages', basePrice: 0, minGuests: 20,  maxGuests: 150,                  included: ['Welcome cocktail','3-course dinner','Service staff','Room hire'],                    eventTypes: ['WEDDING','CORPORATE','ANNIVERSARY','DINNER_PARTY'] },
    { name: 'Cocktail Hour Package',  pricingModel: 'PER_PERSON', category: 'Venue Packages', basePrice: 0, minGuests: 30,  maxGuests: 200,                  included: ['Standing reception','Passed canapés','Bar service','Staff'],                        eventTypes: ['WEDDING','CORPORATE','COCKTAIL_PARTY','BRIDAL_SHOWER'] },
    { name: 'Brunch Package',         pricingModel: 'PER_PERSON', category: 'Venue Packages', basePrice: 0, minGuests: 20,  maxGuests: 100,                  included: ['Full brunch service','Mimosa bar','Staff'],                                          eventTypes: ['BRUNCH','BABY_SHOWER','BRIDAL_SHOWER','BIRTHDAY'] },
  ],
  CATERER: [
    { name: 'Plated Dinner',    pricingModel: 'PER_PERSON', category: 'Food & Menu', basePrice: 0, included: ['3-course plated service','Service staff','Setup & teardown'],                     eventTypes: ['WEDDING','CORPORATE','ANNIVERSARY','DINNER_PARTY'] },
    { name: 'Buffet Package',   pricingModel: 'PER_PERSON', category: 'Food & Menu', basePrice: 0, included: ['Full buffet setup','Chafing dishes','Service staff','Cleanup'],                   eventTypes: ['CORPORATE','BIRTHDAY','GRADUATION','HOLIDAY'] },
    { name: 'Cocktail Reception',pricingModel: 'PER_PERSON', category: 'Food & Menu', basePrice: 0, included: ['Passed canapés','Grazing table','Bar staff'],                                    eventTypes: ['WEDDING','CORPORATE','COCKTAIL_PARTY','BRIDAL_SHOWER'] },
    { name: 'Grazing Table',    pricingModel: 'FLAT_RATE',  category: 'Food & Menu', basePrice: 0, included: ['Curated grazing table','Delivery & setup','Serving utensils'],                   eventTypes: ['BABY_SHOWER','BRIDAL_SHOWER','BIRTHDAY','BRUNCH'] },
  ],
  ENTERTAINMENT: [
    { name: 'DJ Set',      pricingModel: 'PER_HOUR',  category: 'Performance Packages',     basePrice: 0, durationHours: 4, included: ['Professional DJ','Sound system','Lighting rig','MC services'],                 eventTypes: ['WEDDING','BIRTHDAY','CORPORATE','HOLIDAY'] },
    { name: 'Live Band',   pricingModel: 'FLAT_RATE', category: 'Performance Packages',     basePrice: 0,                   included: ['Full band','Sound system','2 sets of 45 minutes'],                             eventTypes: ['WEDDING','CORPORATE','ANNIVERSARY'] },
    { name: 'MC / Emcee',  pricingModel: 'FLAT_RATE', category: 'Performance Packages',     basePrice: 0,                   included: ['Professional MC','Event coordination','Microphone'],                           eventTypes: ['WEDDING','CORPORATE','GRADUATION'] },
    { name: 'Photo Booth', pricingModel: 'FLAT_RATE', category: 'Equipment & Production',   basePrice: 0,                   included: ['Photo booth setup','Unlimited prints','Digital copies','Attendant'],           eventTypes: ['WEDDING','BIRTHDAY','CORPORATE','GRADUATION'] },
  ],
  PHOTO_VIDEO: [
    { name: 'Photography Coverage', pricingModel: 'PER_HOUR',  category: 'Coverage Packages',    basePrice: 0, durationHours: 8, included: ['Professional photographer','Edited digital gallery','Online delivery'],                        eventTypes: ['WEDDING','CORPORATE','BIRTHDAY','GRADUATION'] },
    { name: 'Videography Coverage', pricingModel: 'PER_HOUR',  category: 'Coverage Packages',    basePrice: 0, durationHours: 8, included: ['Professional videographer','Highlight reel','Full ceremony film','Online delivery'],           eventTypes: ['WEDDING','CORPORATE','ANNIVERSARY'] },
    { name: 'Photo + Video Bundle', pricingModel: 'FLAT_RATE', category: 'Coverage Packages',    basePrice: 0,                   included: ['Photographer + videographer','Highlight reel','Edited gallery','Online delivery'],             eventTypes: ['WEDDING','ANNIVERSARY','CORPORATE'] },
    { name: 'Same-Day Edit',        pricingModel: 'FLAT_RATE', category: 'Production & Extras',  basePrice: 0,                   included: ['Same-day edited video','Screened at reception'],                                              eventTypes: ['WEDDING','CORPORATE'] },
  ],
  FLORIST_DECOR: [
    { name: 'Full Floral Installation', pricingModel: 'FLAT_RATE', category: 'Design & Arrangements', basePrice: 0, included: ['Ceremony arch','Centerpieces','Bridal bouquet','Setup & breakdown'],                eventTypes: ['WEDDING','ANNIVERSARY'] },
    { name: 'Centerpieces Package',     pricingModel: 'FLAT_RATE', category: 'Design & Arrangements', basePrice: 0, included: ['Table centerpieces','Delivery & setup','Breakdown'],                                 eventTypes: ['WEDDING','CORPORATE','ANNIVERSARY','DINNER_PARTY'] },
    { name: 'Bridal Package',           pricingModel: 'FLAT_RATE', category: 'Design & Arrangements', basePrice: 0, included: ['Bridal bouquet','Bridesmaid bouquets','Boutonnieres','Flower girl basket'],           eventTypes: ['WEDDING','BRIDAL_SHOWER'] },
    { name: 'Event Styling',            pricingModel: 'FLAT_RATE', category: 'Design & Arrangements', basePrice: 0, included: ['Full venue styling','Candles & accents','Signage','Setup & breakdown'],              eventTypes: ['CORPORATE','BIRTHDAY','COCKTAIL_PARTY'] },
  ],
};

// ---------------------------------------------------------------------------
// Suggested add-ons by type
// ---------------------------------------------------------------------------

const SUGGESTED_ADDONS: Record<string, Array<{ name: string; pricingModel: 'FLAT_RATE' | 'PER_PERSON' | 'PER_HOUR'; price: number }>> = {
  RESTO_VENUE: [
    { name: 'Valet Service',       pricingModel: 'FLAT_RATE',  price: 350 },
    { name: 'Dance Floor',         pricingModel: 'FLAT_RATE',  price: 500 },
    { name: 'DJ Equipment',        pricingModel: 'FLAT_RATE',  price: 800 },
    { name: 'Extra Hour',          pricingModel: 'PER_HOUR',   price: 500 },
    { name: 'Champagne Reception', pricingModel: 'PER_PERSON', price: 25  },
  ],
  CATERER: [
    { name: 'Extra Server',      pricingModel: 'PER_HOUR',  price: 35  },
    { name: 'Bar Staff',         pricingModel: 'PER_HOUR',  price: 40  },
    { name: 'Equipment Rental',  pricingModel: 'FLAT_RATE', price: 500 },
    { name: 'Cake Cutting',      pricingModel: 'FLAT_RATE', price: 150 },
  ],
  ENTERTAINMENT: [
    { name: 'Extra Hour',     pricingModel: 'PER_HOUR',  price: 200 },
    { name: 'Second DJ',      pricingModel: 'FLAT_RATE', price: 400 },
    { name: 'Fog Machine',    pricingModel: 'FLAT_RATE', price: 150 },
    { name: 'LED Dance Floor',pricingModel: 'FLAT_RATE', price: 600 },
  ],
  PHOTO_VIDEO: [
    { name: 'Second Shooter', pricingModel: 'FLAT_RATE', price: 400 },
    { name: 'Drone Footage',  pricingModel: 'FLAT_RATE', price: 300 },
    { name: 'Photo Album',    pricingModel: 'FLAT_RATE', price: 250 },
    { name: 'RAW Files',      pricingModel: 'FLAT_RATE', price: 150 },
  ],
  FLORIST_DECOR: [
    { name: 'Delivery & Setup', pricingModel: 'FLAT_RATE', price: 200 },
    { name: 'Candle Package',   pricingModel: 'FLAT_RATE', price: 300 },
    { name: 'Signage',          pricingModel: 'FLAT_RATE', price: 250 },
    { name: 'Rental Items',     pricingModel: 'FLAT_RATE', price: 150 },
  ],
};

// ---------------------------------------------------------------------------
// TypeScript interfaces
// ---------------------------------------------------------------------------

interface SeasonalRule {
  _id: string;
  name: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  minSpendOverride: string;
  priceOverride: string;
  multiplier: string;
}

interface DowRule {
  _id: string;
  days: number[];
  priceOverride: string;
  minSpendOverride: string;
}

interface PackageDraft {
  _id: string;
  name: string;
  category: string;
  pricingModel: 'PER_PERSON' | 'FLAT_RATE' | 'PER_HOUR' | 'FLAT_PLUS_PER_PERSON';
  basePrice: string;
  flatFee: string;
  minimumSpend: string;
  minGuests: string;
  maxGuests: string;
  durationHours: string;
  included: string[];
  eventTypes: string[];
  expanded: boolean;
  typeFields: Record<string, string | boolean | string[]>;
  seasonalRules: SeasonalRule[];
  dowRules: DowRule[];
}

interface AddOnDraft {
  _id: string;
  name: string;
  pricingModel: 'FLAT_RATE' | 'PER_PERSON' | 'PER_HOUR';
  price: string;
  required: boolean;
  packageIds: string[];
}

interface SetupState {
  businessName: string;
  phone: string;
  contactEmail: string;
  website: string;
  instagram: string;
  city: string;
  province: string;
  country: string;
  serviceRadius: string;
  about: string;
  languages: string[];
  minBudget: string;
  maxBudget: string;
  primaryType: string;
  secondaryTypes: string[];
  eventTypes: string[];
  packages: PackageDraft[];
  packagesGenerated: boolean;
  addOns: AddOnDraft[];
  blockedDates: string[];
  logoUrl: string;
  bannerImageUrl: string;
}

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

const DEFAULT_STATE: SetupState = {
  businessName: '', phone: '', contactEmail: '', website: '', instagram: '',
  city: '', province: '', country: 'Canada', serviceRadius: '', about: '',
  languages: [], minBudget: '', maxBudget: '',
  primaryType: '', secondaryTypes: [],
  eventTypes: [],
  logoUrl: '', bannerImageUrl: '',
  packages: [], packagesGenerated: false,
  addOns: [],
  blockedDates: [],
};

// ---------------------------------------------------------------------------
// generatePackages
// ---------------------------------------------------------------------------

function generatePackages(primaryType: string, selectedEventTypes: string[]): PackageDraft[] {
  const templates = PKG_TEMPLATES[primaryType] ?? [];
  const filtered = selectedEventTypes.length > 0
    ? templates.filter(t => t.eventTypes.some(et => selectedEventTypes.includes(et)))
    : templates;
  const source = filtered.length > 0 ? filtered : templates;
  return source.map(t => ({
    _id: uid(),
    name: t.name,
    category: t.category,
    pricingModel: t.pricingModel as 'PER_PERSON' | 'FLAT_RATE' | 'PER_HOUR' | 'FLAT_PLUS_PER_PERSON',
    basePrice: '',
    flatFee: '',
    minimumSpend: t.minimumSpend !== undefined ? String(t.minimumSpend) : '',
    minGuests: t.minGuests !== undefined ? String(t.minGuests) : '',
    maxGuests: t.maxGuests !== undefined ? String(t.maxGuests) : '',
    durationHours: t.durationHours !== undefined ? String(t.durationHours) : '',
    included: [...t.included],
    eventTypes: [...t.eventTypes],
    expanded: false,
    typeFields: {},
    seasonalRules: [],
    dowRules: [],
  }));
}

// ---------------------------------------------------------------------------
// Toggle component
// ---------------------------------------------------------------------------

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${on ? 'bg-gold' : 'bg-border'}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// ProgressBar component
// ---------------------------------------------------------------------------

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="mb-10">
      {/* Outer: relative so we can position the connecting line absolutely behind circles */}
      <div className="relative flex items-start justify-between">
        {/* Full-width connecting line, vertically centred behind the circles (top: 16px = half of h-8) */}
        <div className="absolute left-0 right-0 h-px bg-border" style={{ top: 16 }} />

        {STEP_LABELS.map((label, i) => {
          const num       = i + 1;
          const completed = step > num;
          const current   = step === num;
          return (
            <div key={num} className="relative z-10 flex flex-col items-center" style={{ width: `${100 / STEP_LABELS.length}%` }}>
              {/* Circle */}
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all bg-white
                  ${completed ? 'bg-gold border-gold' : current ? 'border-gold' : 'border-border'}`}
                style={completed ? { backgroundColor: 'var(--gold, #C4A06A)' } : undefined}
              >
                {completed ? (
                  <Check size={14} className="text-dark" strokeWidth={2.5} />
                ) : (
                  <span className={`font-sans text-xs font-bold ${current ? 'text-gold' : 'text-muted'}`}>{num}</span>
                )}
              </div>
              {/* Label — hidden on small screens */}
              <span
                className={`mt-2 font-sans text-xs uppercase tracking-widest text-center leading-tight hidden sm:block
                  ${current ? 'text-gold font-bold' : completed ? 'text-charcoal' : 'text-muted'}`}
                style={{ maxWidth: '100%', overflowWrap: 'break-word' }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Label / Input helper classes (not components, just strings used inline)
// ---------------------------------------------------------------------------

const labelCls = 'font-sans text-xs font-bold uppercase tracking-widest text-charcoal mb-1 block';
const inputCls = 'w-full border border-border rounded-md px-4 py-3 text-sm font-sans text-dark focus:outline-none focus:border-gold transition-colors bg-white';
const textareaCls = 'w-full border border-border rounded-md px-4 py-3 text-sm font-sans text-dark focus:outline-none focus:border-gold transition-colors bg-white resize-none h-28';

// ---------------------------------------------------------------------------
// ChipToggle helper
// ---------------------------------------------------------------------------

function ChipToggle({
  options,
  selected,
  onToggle,
  className,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ''}`}>
      {options.map(opt => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`font-sans text-xs px-3 py-1.5 rounded-full border transition-all focus:outline-none
              ${active ? 'bg-gold/10 border-gold text-gold-dark font-semibold' : 'border-border text-charcoal hover:border-gold hover:text-gold'}`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TypeFieldsEditor — per-vendor-type extra fields inside a package card
// ---------------------------------------------------------------------------

function TypeFieldsEditor({
  primaryType,
  typeFields,
  onChange,
}: {
  primaryType: string;
  typeFields: Record<string, string | boolean | string[]>;
  onChange: (key: string, value: string | boolean | string[]) => void;
}) {
  const tf = typeFields;

  const getStr = (key: string, def = '') => (tf[key] as string) ?? def;
  const getBool = (key: string) => (tf[key] as boolean) ?? false;
  const getArr = (key: string): string[] => (tf[key] as string[]) ?? [];

  const toggleChip = (key: string, val: string) => {
    const arr = getArr(key);
    onChange(key, arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  };

  const selectCls = `${inputCls} appearance-none`;

  if (primaryType === 'RESTO_VENUE') {
    const foodOptions = ['None','Buffet','Plated 2-course','Plated 3-course','Family style','Custom'];
    const drinkOptions = ['None','Cash bar','Open bar','Wine service','Champagne service','Custom'];
    const venueTypes = ['Indoor','Outdoor','Both'];
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Food Service</label>
            <select className={selectCls} value={getStr('foodService')} onChange={e => onChange('foodService', e.target.value)}>
              <option value="">Select…</option>
              {foodOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Drinks</label>
            <select className={selectCls} value={getStr('drinks')} onChange={e => onChange('drinks', e.target.value)}>
              <option value="">Select…</option>
              {drinkOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Staff Count</label>
          <input type="number" min="0" className={inputCls} placeholder="0" value={getStr('staffCount')} onChange={e => onChange('staffCount', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Venue Type</label>
          <div className="flex gap-2">
            {venueTypes.map(vt => (
              <button
                key={vt}
                type="button"
                onClick={() => onChange('venueType', vt)}
                className={`font-sans text-xs px-4 py-2 rounded-md border transition-all focus:outline-none
                  ${getStr('venueType') === vt ? 'bg-gold text-dark border-gold font-bold' : 'border-border text-charcoal hover:border-gold'}`}
              >
                {vt}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className={labelCls + ' mb-0'}>AV / Tech Included</span>
          <Toggle on={getBool('avTech')} onChange={v => onChange('avTech', v)} />
        </div>
      </div>
    );
  }

  if (primaryType === 'CATERER') {
    const foodOptions = ['Plated','Buffet','Family style','Cocktail','Food stations','Drop-off'];
    const dietaryOptions = ['Vegan','Vegetarian','Halal','Kosher','Gluten-Free','Nut-Free'];
    return (
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Food Service Style</label>
          <select className={selectCls} value={getStr('foodService')} onChange={e => onChange('foodService', e.target.value)}>
            <option value="">Select…</option>
            {foodOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Dietary Options</label>
          <ChipToggle options={dietaryOptions} selected={getArr('dietary')} onToggle={v => toggleChip('dietary', v)} />
        </div>
        <div>
          <label className={labelCls}>Staff Count</label>
          <input type="number" min="0" className={inputCls} placeholder="0" value={getStr('staffCount')} onChange={e => onChange('staffCount', e.target.value)} />
        </div>
        <div className="flex items-center justify-between">
          <span className={labelCls + ' mb-0'}>Equipment Rental Included</span>
          <Toggle on={getBool('equipmentRental')} onChange={v => onChange('equipmentRental', v)} />
        </div>
        <div className="flex items-center justify-between">
          <span className={labelCls + ' mb-0'}>Setup / Teardown Included</span>
          <Toggle on={getBool('setupTeardown')} onChange={v => onChange('setupTeardown', v)} />
        </div>
      </div>
    );
  }

  if (primaryType === 'ENTERTAINMENT') {
    const genreOptions = ['Top 40','Hip Hop','Jazz','Classical','Latin','R&B','Electronic','Rock','Country','Custom'];
    return (
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Genre / Style</label>
          <ChipToggle options={genreOptions} selected={getArr('genres')} onToggle={v => toggleChip('genres', v)} />
        </div>
        <div className="flex items-center justify-between">
          <span className={labelCls + ' mb-0'}>Equipment Included</span>
          <Toggle on={getBool('equipmentIncluded')} onChange={v => onChange('equipmentIncluded', v)} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Min Hours</label>
            <input type="number" min="0" className={inputCls} placeholder="2" value={getStr('minHours')} onChange={e => onChange('minHours', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Overtime $/hr</label>
            <input type="number" min="0" className={inputCls} placeholder="200" value={getStr('overtimeRate')} onChange={e => onChange('overtimeRate', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Setup Time (min)</label>
            <input type="number" min="0" className={inputCls} placeholder="60" value={getStr('setupMinutes')} onChange={e => onChange('setupMinutes', e.target.value)} />
          </div>
        </div>
      </div>
    );
  }

  if (primaryType === 'PHOTO_VIDEO') {
    const styleOptions = ['Editorial','Candid','Documentary','Fine Art','Dark & Moody','Light & Airy','Custom'];
    const travelOptions = ['Included','Charged per km','Quoted separately'];
    return (
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Photography Style</label>
          <ChipToggle options={styleOptions} selected={getArr('styles')} onToggle={v => toggleChip('styles', v)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Delivery Timeline (days)</label>
            <input type="number" min="0" className={inputCls} placeholder="30" value={getStr('deliveryDays')} onChange={e => onChange('deliveryDays', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Edited Photos Count</label>
            <input type="number" min="0" className={inputCls} placeholder="300" value={getStr('editedPhotos')} onChange={e => onChange('editedPhotos', e.target.value)} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className={labelCls + ' mb-0'}>RAW Files Included</span>
          <Toggle on={getBool('rawFiles')} onChange={v => onChange('rawFiles', v)} />
        </div>
        <div>
          <label className={labelCls}>Travel Fee</label>
          <select className={selectCls} value={getStr('travelFee')} onChange={e => onChange('travelFee', e.target.value)}>
            <option value="">Select…</option>
            {travelOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-between">
          <span className={labelCls + ' mb-0'}>Second Shooter Available</span>
          <Toggle on={getBool('secondShooter')} onChange={v => onChange('secondShooter', v)} />
        </div>
      </div>
    );
  }

  if (primaryType === 'FLORIST_DECOR') {
    const styleOptions = ['Romantic','Modern','Rustic','Minimalist','Tropical','Bohemian','Custom'];
    return (
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Design Style</label>
          <ChipToggle options={styleOptions} selected={getArr('styles')} onToggle={v => toggleChip('styles', v)} />
        </div>
        <div className="flex items-center justify-between">
          <span className={labelCls + ' mb-0'}>Setup / Breakdown Included</span>
          <Toggle on={getBool('setupBreakdown')} onChange={v => onChange('setupBreakdown', v)} />
        </div>
        <div className="flex items-center justify-between">
          <span className={labelCls + ' mb-0'}>Rental Items Included</span>
          <Toggle on={getBool('rentalItems')} onChange={v => onChange('rentalItems', v)} />
        </div>
        <div className="flex items-center justify-between">
          <span className={labelCls + ' mb-0'}>Seasonal / Custom Florals</span>
          <Toggle on={getBool('seasonalCustom')} onChange={v => onChange('seasonalCustom', v)} />
        </div>
        <div className="flex items-center justify-between">
          <span className={labelCls + ' mb-0'}>Delivery Included</span>
          <Toggle on={getBool('deliveryIncluded')} onChange={v => onChange('deliveryIncluded', v)} />
        </div>
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// SeasonalRuleEditor
// ---------------------------------------------------------------------------

function SeasonalRuleEditor({
  rules,
  onChange,
}: {
  rules: SeasonalRule[];
  onChange: (rules: SeasonalRule[]) => void;
}) {
  const addRule = () => {
    onChange([...rules, {
      _id: uid(), name: '', startMonth: 1, startDay: 1,
      endMonth: 12, endDay: 31, minSpendOverride: '', priceOverride: '', multiplier: '',
    }]);
  };

  const removeRule = (id: string) => onChange(rules.filter(r => r._id !== id));

  const patchRule = (id: string, updates: Partial<SeasonalRule>) => {
    onChange(rules.map(r => r._id === id ? { ...r, ...updates } : r));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className={labelCls + ' mb-0'}>Seasonal Pricing Rules</span>
        <button
          type="button"
          onClick={addRule}
          className="flex items-center gap-1 font-sans text-xs text-gold hover:text-gold-dark transition-colors focus:outline-none"
        >
          <Plus size={12} /> Add Rule
        </button>
      </div>
      {rules.length === 0 && (
        <p className="font-sans text-xs text-muted italic">No seasonal rules. Prices apply year-round.</p>
      )}
      <div className="space-y-3">
        {rules.map(rule => (
          <div key={rule._id} className="border border-border rounded-md p-3 space-y-2 bg-bg">
            <div className="flex items-center justify-between">
              <input
                className={inputCls + ' flex-1 mr-2 py-2'}
                placeholder="Rule name (e.g. Peak Season)"
                value={rule.name}
                onChange={e => patchRule(rule._id, { name: e.target.value })}
              />
              <button type="button" onClick={() => removeRule(rule._id)} className="text-muted hover:text-red transition-colors focus:outline-none">
                <X size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Start Month</label>
                <select className={inputCls + ' py-2 appearance-none'} value={rule.startMonth} onChange={e => patchRule(rule._id, { startMonth: Number(e.target.value) })}>
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Start Day</label>
                <input type="number" min="1" max="31" className={inputCls + ' py-2'} value={rule.startDay} onChange={e => patchRule(rule._id, { startDay: Number(e.target.value) })} />
              </div>
              <div>
                <label className={labelCls}>End Month</label>
                <select className={inputCls + ' py-2 appearance-none'} value={rule.endMonth} onChange={e => patchRule(rule._id, { endMonth: Number(e.target.value) })}>
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>End Day</label>
                <input type="number" min="1" max="31" className={inputCls + ' py-2'} value={rule.endDay} onChange={e => patchRule(rule._id, { endDay: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={labelCls}>Price Override ($)</label>
                <input type="number" min="0" className={inputCls + ' py-2'} placeholder="—" value={rule.priceOverride} onChange={e => patchRule(rule._id, { priceOverride: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Min Spend ($)</label>
                <input type="number" min="0" className={inputCls + ' py-2'} placeholder="—" value={rule.minSpendOverride} onChange={e => patchRule(rule._id, { minSpendOverride: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Multiplier (×)</label>
                <input type="number" min="0" step="0.01" className={inputCls + ' py-2'} placeholder="1.25" value={rule.multiplier} onChange={e => patchRule(rule._id, { multiplier: e.target.value })} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DowRuleEditor
// ---------------------------------------------------------------------------

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function DowRuleEditor({
  rules,
  onChange,
}: {
  rules: DowRule[];
  onChange: (rules: DowRule[]) => void;
}) {
  const addRule = () => {
    onChange([...rules, { _id: uid(), days: [], priceOverride: '', minSpendOverride: '' }]);
  };

  const removeRule = (id: string) => onChange(rules.filter(r => r._id !== id));

  const patchRule = (id: string, updates: Partial<DowRule>) => {
    onChange(rules.map(r => r._id === id ? { ...r, ...updates } : r));
  };

  const toggleDay = (id: string, day: number, currentDays: number[]) => {
    const days = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    patchRule(id, { days });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className={labelCls + ' mb-0'}>Day-of-Week Rules</span>
        <button
          type="button"
          onClick={addRule}
          className="flex items-center gap-1 font-sans text-xs text-gold hover:text-gold-dark transition-colors focus:outline-none"
        >
          <Plus size={12} /> Add Rule
        </button>
      </div>
      {rules.length === 0 && (
        <p className="font-sans text-xs text-muted italic">No day-of-week rules configured.</p>
      )}
      <div className="space-y-3">
        {rules.map(rule => (
          <div key={rule._id} className="border border-border rounded-md p-3 space-y-2 bg-bg">
            <div className="flex items-center justify-between">
              <span className="font-sans text-xs font-semibold text-charcoal uppercase tracking-wide">Day Rule</span>
              <button type="button" onClick={() => removeRule(rule._id)} className="text-muted hover:text-red transition-colors focus:outline-none">
                <X size={14} />
              </button>
            </div>
            <div>
              <label className={labelCls}>Days</label>
              <div className="flex gap-1.5 flex-wrap">
                {DOW_LABELS.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(rule._id, i, rule.days)}
                    className={`font-sans text-xs px-2.5 py-1.5 rounded-md border transition-all focus:outline-none
                      ${rule.days.includes(i) ? 'bg-gold text-dark border-gold font-bold' : 'border-border text-charcoal hover:border-gold'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Price Override ($)</label>
                <input type="number" min="0" className={inputCls + ' py-2'} placeholder="—" value={rule.priceOverride} onChange={e => patchRule(rule._id, { priceOverride: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Min Spend Override ($)</label>
                <input type="number" min="0" className={inputCls + ' py-2'} placeholder="—" value={rule.minSpendOverride} onChange={e => patchRule(rule._id, { minSpendOverride: e.target.value })} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PackageCard
// ---------------------------------------------------------------------------

function PackageCard({
  pkg,
  primaryType,
  onPatch,
  onDelete,
  newItemInput,
  onNewItemInputChange,
}: {
  pkg: PackageDraft;
  primaryType: string;
  onPatch: (updates: Partial<PackageDraft>) => void;
  onDelete: () => void;
  newItemInput: string;
  onNewItemInputChange: (v: string) => void;
}) {
  const pricingModels: Array<'PER_PERSON' | 'FLAT_RATE' | 'PER_HOUR' | 'FLAT_PLUS_PER_PERSON'> = ['PER_PERSON', 'FLAT_RATE', 'PER_HOUR', 'FLAT_PLUS_PER_PERSON'];
  const pricingLabel: Record<string, string> = {
    PER_PERSON:           'Per Person',
    FLAT_RATE:            'Flat Rate',
    PER_HOUR:             'Per Hour',
    FLAT_PLUS_PER_PERSON: 'Flat + Per Person',
  };

  const addItem = () => {
    const val = newItemInput.trim();
    if (!val) return;
    onPatch({ included: [...pkg.included, val] });
    onNewItemInputChange('');
  };

  const removeItem = (idx: number) => {
    onPatch({ included: pkg.included.filter((_, i) => i !== idx) });
  };

  const toggleEventType = (et: string) => {
    const evts = pkg.eventTypes.includes(et)
      ? pkg.eventTypes.filter(e => e !== et)
      : [...pkg.eventTypes, et];
    onPatch({ eventTypes: evts });
  };

  const handleTypeField = (key: string, value: string | boolean | string[]) => {
    onPatch({ typeFields: { ...pkg.typeFields, [key]: value } });
  };

  return (
    <div className="border border-border rounded-lg bg-white overflow-hidden">
      {/* Card header */}
      <div className="flex items-start gap-3 p-4 border-b border-border">
        <div className="flex-1 min-w-0">
          <input
            className="w-full font-sans text-sm font-bold uppercase tracking-wide text-dark focus:outline-none border-b border-transparent focus:border-gold transition-colors bg-transparent pb-0.5"
            value={pkg.name}
            onChange={e => onPatch({ name: e.target.value })}
            placeholder="Package name"
          />
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <span className="text-xs bg-gold/10 text-gold-dark border border-gold/30 rounded-full px-2 py-0.5 font-sans font-medium">
              {pkg.category}
            </span>
            <input
              className="font-sans text-xs text-muted focus:outline-none border-b border-transparent focus:border-gold transition-colors bg-transparent"
              value={pkg.category}
              onChange={e => onPatch({ category: e.target.value })}
              placeholder="Category"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="text-muted hover:text-red transition-colors focus:outline-none flex-shrink-0 mt-0.5"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Pricing model */}
        <div>
          <label className={labelCls}>Pricing Model</label>
          <div className="flex gap-2">
            {pricingModels.map(pm => (
              <button
                key={pm}
                type="button"
                onClick={() => onPatch({ pricingModel: pm })}
                className={`font-sans text-xs px-3 py-2 rounded-md border transition-all focus:outline-none
                  ${pkg.pricingModel === pm ? 'bg-gold text-dark border-gold font-bold' : 'border-border text-charcoal hover:border-gold'}`}
              >
                {pricingLabel[pm]}
              </button>
            ))}
          </div>
        </div>

        {/* Prices */}
        {pkg.pricingModel === 'FLAT_PLUS_PER_PERSON' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Flat room fee (CAD $)</label>
                <input
                  type="number"
                  min="0"
                  className={inputCls}
                  placeholder="e.g. 2000"
                  value={pkg.flatFee}
                  onChange={e => onPatch({ flatFee: e.target.value })}
                />
                <p className="font-sans text-xs text-muted mt-1">Room or venue rental charge</p>
              </div>
              <div>
                <label className={labelCls}>Per person rate (CAD $)</label>
                <input
                  type="number"
                  min="0"
                  className={inputCls}
                  placeholder="e.g. 85"
                  value={pkg.basePrice}
                  onChange={e => onPatch({ basePrice: e.target.value })}
                />
                <p className="font-sans text-xs text-muted mt-1">Food & beverage per guest</p>
              </div>
            </div>
            <div>
              <label className={labelCls}>Min spend (CAD $)</label>
              <input
                type="number"
                min="0"
                className={inputCls}
                placeholder="Optional"
                value={pkg.minimumSpend}
                onChange={e => onPatch({ minimumSpend: e.target.value })}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Base Price (CAD $)</label>
              <input
                type="number"
                min="0"
                className={inputCls}
                placeholder="0"
                value={pkg.basePrice}
                onChange={e => onPatch({ basePrice: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Min Spend (CAD $)</label>
              <input
                type="number"
                min="0"
                className={inputCls}
                placeholder="Optional"
                value={pkg.minimumSpend}
                onChange={e => onPatch({ minimumSpend: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* Guest counts */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Min Guests</label>
            <input
              type="number"
              min="0"
              className={inputCls}
              placeholder="—"
              value={pkg.minGuests}
              onChange={e => onPatch({ minGuests: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Max Guests</label>
            <input
              type="number"
              min="0"
              className={inputCls}
              placeholder="—"
              value={pkg.maxGuests}
              onChange={e => onPatch({ maxGuests: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Duration (hrs)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              className={inputCls}
              placeholder="—"
              value={pkg.durationHours}
              onChange={e => onPatch({ durationHours: e.target.value })}
            />
          </div>
        </div>

        {/* Included items */}
        <div>
          <label className={labelCls}>What's Included</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {pkg.included.map((item, idx) => (
              <span
                key={idx}
                className="flex items-center gap-1 font-sans text-xs bg-bg border border-border rounded-full px-3 py-1.5 text-charcoal"
              >
                {item}
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="text-muted hover:text-red transition-colors focus:outline-none ml-0.5"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className={inputCls + ' flex-1 py-2'}
              placeholder="Add included item…"
              value={newItemInput}
              onChange={e => onNewItemInputChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
            />
            <button
              type="button"
              onClick={addItem}
              className="bg-gold text-dark font-sans text-xs font-bold px-3 py-2 rounded-md hover:bg-gold-dark transition-colors focus:outline-none flex items-center gap-1"
            >
              <Plus size={12} /> Add
            </button>
          </div>
        </div>

        {/* Expand / collapse more details */}
        <button
          type="button"
          onClick={() => onPatch({ expanded: !pkg.expanded })}
          className="flex items-center gap-1 font-sans text-xs text-gold hover:text-gold-dark transition-colors focus:outline-none w-full justify-between border-t border-border pt-3"
        >
          <span className="uppercase tracking-widest font-bold">{pkg.expanded ? 'Hide details' : 'More details'}</span>
          {pkg.expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {pkg.expanded && (
          <div className="space-y-6 border-t border-border pt-4">
            {/* Event types */}
            <div>
              <label className={labelCls}>Event Types</label>
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.map(et => {
                  const active = pkg.eventTypes.includes(et.value);
                  return (
                    <button
                      key={et.value}
                      type="button"
                      onClick={() => toggleEventType(et.value)}
                      className={`font-sans text-xs px-3 py-1.5 rounded-full border transition-all focus:outline-none
                        ${active ? 'bg-gold/10 border-gold text-gold-dark font-semibold' : 'border-border text-charcoal hover:border-gold'}`}
                    >
                      {et.emoji} {et.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Type-specific fields */}
            {primaryType && (
              <div>
                <label className={labelCls}>Type-Specific Details</label>
                <TypeFieldsEditor
                  primaryType={primaryType}
                  typeFields={pkg.typeFields}
                  onChange={handleTypeField}
                />
              </div>
            )}

            {/* Seasonal rules */}
            <SeasonalRuleEditor
              rules={pkg.seasonalRules}
              onChange={rules => onPatch({ seasonalRules: rules })}
            />

            {/* DOW rules */}
            <DowRuleEditor
              rules={pkg.dowRules}
              onChange={rules => onPatch({ dowRules: rules })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function VendorSetup() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<SetupState>(() => {
    try {
      const saved = localStorage.getItem('festv_vendor_setup');
      return saved ? { ...DEFAULT_STATE, ...JSON.parse(saved) } : DEFAULT_STATE;
    } catch { return DEFAULT_STATE; }
  });
  const [stepError, setStepError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [profileExists, setProfileExists] = useState(false);
  // Tracks whether the user has attempted to Continue on Step 1 — gates validation error colours
  const [step1Attempted, setStep1Attempted] = useState(false);

  const today = new Date();
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());

  const [newItemInputs, setNewItemInputs] = useState<Record<string, string>>({});

  // Auto-save
  useEffect(() => {
    try { localStorage.setItem('festv_vendor_setup', JSON.stringify(state)); } catch {}
  }, [state]);

  // Fetch existing profile
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/providers/profile/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        // Support both response shapes: { data: { providerProfile } } and { data: <profile> }
        const p = data.data?.providerProfile ?? (data.data && !data.data.providerProfile ? data.data : null);
        if (data.success && p) {
          setProfileExists(true);
          setState(prev => ({
            ...prev,
            businessName:  p.businessName        || prev.businessName,
            phone:         p.phone               || prev.phone,
            contactEmail:  p.contactEmail        || prev.contactEmail,
            website:       p.websiteUrl          || prev.website,
            instagram:     p.instagramHandle     || prev.instagram,
            city:          p.user?.city          || p.city          || prev.city,
            province:      p.user?.state         || p.state         || p.province || prev.province,
            country:       p.user?.country       || p.country       || prev.country,
            serviceRadius: p.serviceRadius != null ? String(p.serviceRadius) : prev.serviceRadius,
            about:         p.businessDescription || prev.about,
            languages:     Array.isArray(p.languages) && p.languages.length > 0 ? p.languages : prev.languages,
            minBudget:     p.minBudget != null ? String(p.minBudget) : prev.minBudget,
            maxBudget:     p.maxBudget != null ? String(p.maxBudget) : prev.maxBudget,
            // Vendor type — use || so an empty string also falls back
            primaryType:   p.primaryType || prev.primaryType,
            secondaryTypes: Array.isArray(p.providerTypes) && p.providerTypes.length > 0
              ? p.providerTypes.filter((t: string) => t !== p.primaryType)
              : prev.secondaryTypes,
          }));
        }
      })
      .catch(() => {});
  }, [token]);

  const patch = useCallback((updates: Partial<SetupState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const patchPkg = useCallback((pkgId: string, updates: Partial<PackageDraft>) => {
    setState(prev => ({
      ...prev,
      packages: prev.packages.map(p => p._id === pkgId ? { ...p, ...updates } : p),
    }));
  }, []);

  const patchAddOn = useCallback((addonId: string, updates: Partial<AddOnDraft>) => {
    setState(prev => ({
      ...prev,
      addOns: prev.addOns.map(a => a._id === addonId ? { ...a, ...updates } : a),
    }));
  }, []);

  // ---------------------------------------------------------------------------
  // handleContinue
  // ---------------------------------------------------------------------------

  const handleContinue = async () => {
    setStepError('');

    if (step === 1) {
      setStep1Attempted(true);
      if (!state.businessName.trim()) return setStepError('Business name is required');
      if (!state.primaryType) return setStepError('Please select your primary vendor type');
      if (!state.city.trim()) return setStepError('City is required');
      if (state.about.length < 50) return setStepError('About section must be at least 50 characters');

      setIsSubmitting(true);
      try {
        const providerTypes = [state.primaryType, ...state.secondaryTypes.filter(t => t !== state.primaryType)];
        const body = {
          businessName: state.businessName,
          phone: state.phone,
          contactEmail: state.contactEmail,
          websiteUrl: state.website || undefined,
          instagramHandle: state.instagram || undefined,
          city: state.city,
          state: state.province,
          country: state.country,
          serviceRadius: state.serviceRadius ? Number(state.serviceRadius) : undefined,
          businessDescription: state.about,
          languages: state.languages,
          minBudget: state.minBudget ? Number(state.minBudget) : undefined,
          maxBudget: state.maxBudget ? Number(state.maxBudget) : undefined,
          primaryType: state.primaryType,
          providerTypes,
          logoUrl: state.logoUrl || undefined,
          bannerImageUrl: state.bannerImageUrl || undefined,
        };
        const method = profileExists ? 'PUT' : 'POST';
        const res = await fetch(`${API_BASE}/providers/profile`, {
          method,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message ?? 'Failed to save profile');
        setProfileExists(true);
      } catch (err) {
        setStepError(err instanceof Error ? err.message : 'Failed to save profile');
        setIsSubmitting(false);
        return;
      }
      setIsSubmitting(false);
    }

    if (step === 2 && !state.packagesGenerated && state.primaryType) {
      const generated = generatePackages(state.primaryType, state.eventTypes);
      patch({ packages: generated, packagesGenerated: true });
    }

    setStep(s => s + 1);
  };

  const handleBack = () => {
    setStepError('');
    setStep(s => s - 1);
  };

  // ---------------------------------------------------------------------------
  // handleSubmit
  // ---------------------------------------------------------------------------

  const handleSubmit = async () => {
    setStepError('');
    if (!state.businessName || !state.city) return setStepError('Complete your business profile first');
    if (state.packages.length === 0) return setStepError('Add at least one package');
    const zeroPrices = state.packages.filter(p =>
      p.pricingModel === 'FLAT_PLUS_PER_PERSON'
        ? (!p.flatFee || Number(p.flatFee) === 0) && (!p.basePrice || Number(p.basePrice) === 0)
        : !p.basePrice || Number(p.basePrice) === 0
    );
    if (zeroPrices.length > 0) return setStepError('Set a price on all packages before submitting');

    setIsSubmitting(true);
    try {
      const providerTypes = [state.primaryType, ...state.secondaryTypes.filter(t => t !== state.primaryType)];
      await fetch(`${API_BASE}/providers/profile`, {
        method: profileExists ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          businessName: state.businessName, phone: state.phone, contactEmail: state.contactEmail,
          websiteUrl: state.website || undefined, instagramHandle: state.instagram || undefined,
          city: state.city, state: state.province, country: state.country,
          serviceRadius: state.serviceRadius ? Number(state.serviceRadius) : undefined,
          businessDescription: state.about, languages: state.languages,
          minBudget: state.minBudget ? Number(state.minBudget) : undefined,
          maxBudget: state.maxBudget ? Number(state.maxBudget) : undefined,
          primaryType: state.primaryType, providerTypes,
          logoUrl: state.logoUrl || undefined,
          bannerImageUrl: state.bannerImageUrl || undefined,
        }),
      });

      const pkgIdMap: Record<string, string> = {};
      for (const pkg of state.packages) {
        const pkgRes = await fetch(`${API_BASE}/packages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: pkg.name, category: pkg.category, pricingModel: pkg.pricingModel,
            basePrice: Number(pkg.basePrice) || 0,
            flatFee: pkg.flatFee ? Number(pkg.flatFee) : undefined,
            minimumSpend: pkg.minimumSpend ? Number(pkg.minimumSpend) : undefined,
            minGuests: pkg.minGuests ? Number(pkg.minGuests) : undefined,
            maxGuests: pkg.maxGuests ? Number(pkg.maxGuests) : undefined,
            durationHours: pkg.durationHours ? Number(pkg.durationHours) : undefined,
            included: pkg.included, eventTypes: pkg.eventTypes,
          }),
        });
        const pkgData = await pkgRes.json();
        if (pkgData.success && pkgData.data?.id) {
          const serverId = pkgData.data.id;
          pkgIdMap[pkg._id] = serverId;
          for (const rule of pkg.seasonalRules) {
            await fetch(`${API_BASE}/packages/${serverId}/seasonal-rules`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                name: rule.name,
                startMonth: rule.startMonth, startDay: rule.startDay,
                endMonth: rule.endMonth, endDay: rule.endDay,
                minimumSpend: rule.minSpendOverride ? Number(rule.minSpendOverride) : undefined,
                priceOverride: rule.priceOverride ? Number(rule.priceOverride) : undefined,
                multiplier: rule.multiplier ? Number(rule.multiplier) : undefined,
              }),
            }).catch(() => {});
          }
          for (const rule of pkg.dowRules) {
            await fetch(`${API_BASE}/packages/${serverId}/dow-rules`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                days: rule.days,
                priceOverride: rule.priceOverride ? Number(rule.priceOverride) : undefined,
                minimumSpend: rule.minSpendOverride ? Number(rule.minSpendOverride) : undefined,
              }),
            }).catch(() => {});
          }
        }
      }

      for (const addon of state.addOns) {
        const applicablePackageIds = addon.packageIds.length > 0
          ? addon.packageIds.map(localId => pkgIdMap[localId]).filter(Boolean)
          : [];
        await fetch(`${API_BASE}/addons`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: addon.name, pricingModel: addon.pricingModel,
            price: Number(addon.price) || 0,
            isRequired: addon.required,
            applicablePackageIds: applicablePackageIds.length > 0 ? applicablePackageIds : undefined,
          }),
        }).catch(() => {});
      }

      for (const dateStr of state.blockedDates) {
        await fetch(`${API_BASE}/availability`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ startDate: dateStr, endDate: dateStr, reason: 'CLOSED' }),
        }).catch(() => {});
      }

      localStorage.removeItem('festv_vendor_setup');
      setSubmitted(true);
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Calendar helpers
  // ---------------------------------------------------------------------------

  const formatDate = (d: Date) =>
    d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');

  const toggleDate = (dateStr: string) => {
    const blocked = state.blockedDates;
    if (blocked.includes(dateStr)) {
      patch({ blockedDates: blocked.filter(d => d !== dateStr) });
    } else {
      patch({ blockedDates: [...blocked, dateStr] });
    }
  };

  const blockAllWeekends = () => {
    const dates: string[] = [];
    const start = new Date(today);
    start.setDate(1);
    for (let m = 0; m < 4; m++) {
      const month = (today.getMonth() + m) % 12;
      const year = today.getFullYear() + Math.floor((today.getMonth() + m) / 12);
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dt = new Date(year, month, d);
        if (dt.getDay() === 0 || dt.getDay() === 6) {
          dates.push(formatDate(dt));
        }
      }
    }
    const merged = Array.from(new Set([...state.blockedDates, ...dates]));
    patch({ blockedDates: merged });
  };

  const blockNext30Days = () => {
    const dates: string[] = [];
    for (let i = 1; i <= 30; i++) {
      const dt = new Date(today);
      dt.setDate(today.getDate() + i);
      dates.push(formatDate(dt));
    }
    const merged = Array.from(new Set([...state.blockedDates, ...dates]));
    patch({ blockedDates: merged });
  };

  // Build calendar grid
  const buildCalendarGrid = () => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: Array<Date | null> = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(calYear, calMonth, d));
    return cells;
  };

  const todayStr = formatDate(today);

  // ---------------------------------------------------------------------------
  // Success screen
  // ---------------------------------------------------------------------------

  if (submitted) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-center px-6">
        <CheckCircle size={64} strokeWidth={1.5} className="text-gold mb-6" />
        <h1 className="font-serif text-4xl text-dark">You're all set!</h1>
        <p className="font-sans text-sm text-muted mt-4 max-w-sm leading-relaxed">
          We'll notify you by email once your listing is approved and live on FESTV.
        </p>
        <button
          onClick={() => navigate('/provider/dashboard')}
          className="mt-8 bg-gold text-dark font-sans text-xs font-bold tracking-widest uppercase px-10 py-4 hover:bg-gold-dark transition-colors focus:outline-none"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Step 1 — Your Business
  // ---------------------------------------------------------------------------

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-3xl text-dark">Your Business</h2>
        <p className="font-sans text-sm text-muted mt-1">Tell us about your business so clients can find you.</p>
      </div>

      {/* Vendor type selection */}
      <div>
        <label className={labelCls}>Primary Vendor Type *</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {VENDOR_TYPES.map(vt => {
            const active = state.primaryType === vt.value;
            return (
              <button
                key={vt.value}
                type="button"
                onClick={() => patch({ primaryType: vt.value, secondaryTypes: state.secondaryTypes.filter(t => t !== vt.value) })}
                className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all focus:outline-none
                  ${active ? 'border-gold bg-gold/5' : 'border-border bg-white hover:border-gold/50'}`}
              >
                <vt.Icon size={20} strokeWidth={1.5} className="text-gold mt-0.5 flex-shrink-0" />
                <div>
                  <p className={`font-sans text-sm font-bold ${active ? 'text-dark' : 'text-charcoal'}`}>{vt.label}</p>
                  <p className="font-sans text-xs text-muted mt-0.5 leading-snug">{vt.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Secondary types */}
      {state.primaryType && (
        <div>
          <label className={labelCls}>Additional Services (optional)</label>
          <div className="flex flex-wrap gap-2">
            {VENDOR_TYPES.filter(vt => vt.value !== state.primaryType).map(vt => {
              const active = state.secondaryTypes.includes(vt.value);
              return (
                <button
                  key={vt.value}
                  type="button"
                  onClick={() => {
                    const next = active
                      ? state.secondaryTypes.filter(t => t !== vt.value)
                      : [...state.secondaryTypes, vt.value];
                    patch({ secondaryTypes: next });
                  }}
                  className={`flex items-center gap-1.5 font-sans text-xs px-3 py-2 rounded-md border transition-all focus:outline-none
                    ${active ? 'bg-gold/10 border-gold text-gold-dark font-semibold' : 'border-border text-charcoal hover:border-gold'}`}
                >
                  <vt.Icon size={12} />
                  {vt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Business name */}
      <div>
        <label className={labelCls}>Business Name *</label>
        <input
          className={inputCls}
          placeholder="e.g. Golden Hour Events"
          value={state.businessName}
          onChange={e => patch({ businessName: e.target.value })}
        />
      </div>

      {/* Logo + banner uploads */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className={labelCls}>Business Logo</label>
          <ImageUpload
            currentUrl={state.logoUrl || undefined}
            onUpload={url => patch({ logoUrl: url })}
            endpoint="logo"
            label="Upload Logo"
            aspectRatio="square"
          />
          <p className="font-sans text-xs text-muted mt-1">Square · JPG/PNG/WebP · max 2 MB</p>
        </div>
        <div>
          <label className={labelCls}>Cover Photo</label>
          <ImageUpload
            currentUrl={state.bannerImageUrl || undefined}
            onUpload={url => patch({ bannerImageUrl: url })}
            endpoint="banner"
            label="Upload Cover Photo"
            aspectRatio="banner"
          />
          <p className="font-sans text-xs text-muted mt-1">Wide banner · JPG/PNG/WebP · max 5 MB</p>
        </div>
      </div>

      {/* Contact info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Phone</label>
          <input
            className={inputCls}
            placeholder="+1 (416) 555-0100"
            value={state.phone}
            onChange={e => patch({ phone: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls}>Contact Email</label>
          <input
            type="email"
            className={inputCls}
            placeholder="hello@yourbusiness.com"
            value={state.contactEmail}
            onChange={e => patch({ contactEmail: e.target.value })}
          />
        </div>
      </div>

      {/* Location */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls}>City *</label>
          <input
            className={inputCls}
            placeholder="Toronto"
            value={state.city}
            onChange={e => patch({ city: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls}>Province</label>
          <input
            className={inputCls}
            placeholder="ON"
            value={state.province}
            onChange={e => patch({ province: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls}>Country</label>
          <input
            className={inputCls}
            placeholder="Canada"
            value={state.country}
            onChange={e => patch({ country: e.target.value })}
          />
        </div>
      </div>

      {/* Service radius */}
      <div>
        <label className={labelCls}>Service Radius (km)</label>
        <input
          type="number"
          min="0"
          className={inputCls}
          placeholder="50"
          value={state.serviceRadius}
          onChange={e => patch({ serviceRadius: e.target.value })}
        />
      </div>

      {/* Website / Instagram */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Website</label>
          <input
            type="url"
            className={inputCls}
            placeholder="https://yourbusiness.com"
            value={state.website}
            onChange={e => patch({ website: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls}>Instagram Handle</label>
          <input
            className={inputCls}
            placeholder="@yourbusiness"
            value={state.instagram}
            onChange={e => patch({ instagram: e.target.value })}
          />
        </div>
      </div>

      {/* About */}
      <div>
        <label className={labelCls}>About Your Business *</label>
        <textarea
          className={textareaCls}
          placeholder="Tell potential clients about your experience, style, and what makes your services exceptional. Minimum 50 characters."
          value={state.about}
          onChange={e => patch({ about: e.target.value })}
        />
        <p className={`font-sans text-xs mt-1 ${step1Attempted && state.about.length < 50 ? 'text-red' : 'text-muted'}`}>
          {state.about.length} / 50 minimum characters
        </p>
      </div>

      {/* Languages */}
      <div>
        <label className={labelCls}>Languages Spoken</label>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map(lang => {
            const active = state.languages.includes(lang);
            return (
              <button
                key={lang}
                type="button"
                onClick={() => {
                  const next = active
                    ? state.languages.filter(l => l !== lang)
                    : [...state.languages, lang];
                  patch({ languages: next });
                }}
                className={`font-sans text-xs px-3 py-2 rounded-md border transition-all focus:outline-none
                  ${active ? 'bg-gold/10 border-gold text-gold-dark font-semibold' : 'border-border text-charcoal hover:border-gold'}`}
              >
                {lang}
              </button>
            );
          })}
        </div>
      </div>

      {/* Budget range */}
      <div>
        <label className={labelCls}>Typical Budget Range (CAD)</label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <input
              type="number"
              min="0"
              className={inputCls}
              placeholder="Min $"
              value={state.minBudget}
              onChange={e => patch({ minBudget: e.target.value })}
            />
          </div>
          <div>
            <input
              type="number"
              min="0"
              className={inputCls}
              placeholder="Max $"
              value={state.maxBudget}
              onChange={e => patch({ maxBudget: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Step 2 — Your Events
  // ---------------------------------------------------------------------------

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-3xl text-dark">Your Events</h2>
        <p className="font-sans text-sm text-muted mt-1">Select all the event types you specialise in. This helps match you with the right clients.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {EVENT_TYPES.map(et => {
          const active = state.eventTypes.includes(et.value);
          return (
            <button
              key={et.value}
              type="button"
              onClick={() => {
                const next = active
                  ? state.eventTypes.filter(e => e !== et.value)
                  : [...state.eventTypes, et.value];
                patch({ eventTypes: next });
              }}
              className={`border rounded-md p-4 text-center cursor-pointer transition-all focus:outline-none
                ${active ? 'border-2 border-gold bg-gold/5' : 'border border-border bg-white hover:border-gold/50'}`}
            >
              <div className="text-2xl mb-2">{et.emoji}</div>
              <p className={`font-sans text-xs font-semibold uppercase tracking-wide ${active ? 'text-gold-dark' : 'text-charcoal'}`}>
                {et.label}
              </p>
            </button>
          );
        })}
      </div>
      {state.eventTypes.length > 0 && (
        <p className="font-sans text-xs text-muted">
          {state.eventTypes.length} event type{state.eventTypes.length !== 1 ? 's' : ''} selected — packages will be pre-configured for these.
        </p>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Step 3 — Your Packages
  // ---------------------------------------------------------------------------

  const renderStep3 = () => {
    const addBlankPackage = () => {
      const blank: PackageDraft = {
        _id: uid(),
        name: 'New Package',
        category: 'General',
        pricingModel: 'FLAT_RATE',
        basePrice: '',
        flatFee: '',
        minimumSpend: '',
        minGuests: '',
        maxGuests: '',
        durationHours: '',
        included: [],
        eventTypes: [...state.eventTypes],
        expanded: false,
        typeFields: {},
        seasonalRules: [],
        dowRules: [],
      };
      patch({ packages: [...state.packages, blank] });
    };

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-serif text-3xl text-dark">Your Packages</h2>
            <p className="font-sans text-sm text-muted mt-1">
              We've pre-filled packages based on your vendor type. Set prices and customize details.
            </p>
          </div>
          <button
            type="button"
            onClick={addBlankPackage}
            className="flex items-center gap-1.5 bg-gold text-dark font-sans text-xs font-bold tracking-widest uppercase px-4 py-2.5 hover:bg-gold-dark transition-colors focus:outline-none rounded-md flex-shrink-0 ml-4"
          >
            <Plus size={14} /> Add Package
          </button>
        </div>

        {state.packages.length === 0 && (
          <div className="border border-dashed border-border rounded-lg p-10 text-center">
            <p className="font-sans text-sm text-muted">No packages yet. Click "Add Package" to create one.</p>
          </div>
        )}

        <div className="space-y-4">
          {state.packages.map(pkg => (
            <PackageCard
              key={pkg._id}
              pkg={pkg}
              primaryType={state.primaryType}

              onPatch={updates => patchPkg(pkg._id, updates)}
              onDelete={() => patch({ packages: state.packages.filter(p => p._id !== pkg._id) })}
              newItemInput={newItemInputs[pkg._id] ?? ''}
              onNewItemInputChange={v => setNewItemInputs(prev => ({ ...prev, [pkg._id]: v }))}
            />
          ))}
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Step 4 — Add-ons
  // ---------------------------------------------------------------------------

  const renderStep4 = () => {
    const suggestions = SUGGESTED_ADDONS[state.primaryType] ?? [];
    const addedNames = state.addOns.map(a => a.name);

    const addSuggestion = (s: typeof suggestions[number]) => {
      if (addedNames.includes(s.name)) return;
      const newAddon: AddOnDraft = {
        _id: uid(),
        name: s.name,
        pricingModel: s.pricingModel,
        price: String(s.price),
        required: false,
        packageIds: [],
      };
      patch({ addOns: [...state.addOns, newAddon] });
    };

    const addBlankAddon = () => {
      patch({
        addOns: [...state.addOns, {
          _id: uid(),
          name: 'New Add-on',
          pricingModel: 'FLAT_RATE',
          price: '',
          required: false,
          packageIds: [],
        }],
      });
    };

    const pricingModels: Array<'FLAT_RATE' | 'PER_PERSON' | 'PER_HOUR'> = ['FLAT_RATE', 'PER_PERSON', 'PER_HOUR'];
    const pricingLabel: Record<string, string> = {
      FLAT_RATE: 'Flat',
      PER_PERSON: 'Per Person',
      PER_HOUR: 'Per Hour',
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-serif text-3xl text-dark">Add-ons</h2>
          <p className="font-sans text-sm text-muted mt-1">
            Optional extras that clients can add to their booking.
          </p>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div>
            <label className={labelCls}>Suggested Add-ons — Click to Add</label>
            <div className="flex flex-wrap gap-2">
              {suggestions.map(s => {
                const alreadyAdded = addedNames.includes(s.name);
                return (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => addSuggestion(s)}
                    disabled={alreadyAdded}
                    className={`flex items-center gap-1.5 font-sans text-xs px-3 py-2 rounded-full border transition-all focus:outline-none
                      ${alreadyAdded
                        ? 'bg-gold/10 border-gold text-gold-dark cursor-not-allowed opacity-60'
                        : 'border-border text-charcoal hover:border-gold hover:text-gold'}`}
                  >
                    {alreadyAdded ? <Check size={10} /> : <Plus size={10} />}
                    {s.name}
                    <span className="text-muted ml-0.5">
                      ({s.pricingModel === 'FLAT_RATE' ? fmt(s.price) : s.pricingModel === 'PER_PERSON' ? `${fmt(s.price)}/pp` : `${fmt(s.price)}/hr`})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Add-on cards */}
        {state.addOns.length === 0 && (
          <div className="border border-dashed border-border rounded-lg p-8 text-center">
            <p className="font-sans text-sm text-muted">No add-ons yet. Click a suggestion above or add one manually.</p>
          </div>
        )}

        <div className="space-y-4">
          {state.addOns.map(addon => (
            <div key={addon._id} className="border border-border rounded-lg bg-white p-4 space-y-4">
              <div className="flex items-center gap-3">
                <input
                  className={inputCls + ' flex-1'}
                  value={addon.name}
                  onChange={e => patchAddOn(addon._id, { name: e.target.value })}
                  placeholder="Add-on name"
                />
                <button
                  type="button"
                  onClick={() => patch({ addOns: state.addOns.filter(a => a._id !== addon._id) })}
                  className="text-muted hover:text-red transition-colors focus:outline-none flex-shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Pricing model */}
              <div>
                <label className={labelCls}>Pricing Model</label>
                <div className="flex gap-2">
                  {pricingModels.map(pm => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => patchAddOn(addon._id, { pricingModel: pm })}
                      className={`font-sans text-xs px-3 py-2 rounded-md border transition-all focus:outline-none
                        ${addon.pricingModel === pm ? 'bg-gold text-dark border-gold font-bold' : 'border-border text-charcoal hover:border-gold'}`}
                    >
                      {pricingLabel[pm]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price */}
              <div>
                <label className={labelCls}>Price (CAD $)</label>
                <input
                  type="number"
                  min="0"
                  className={inputCls}
                  placeholder="0"
                  value={addon.price}
                  onChange={e => patchAddOn(addon._id, { price: e.target.value })}
                />
              </div>

              {/* Required toggle */}
              <div className="flex items-center justify-between">
                <span className={labelCls + ' mb-0'}>Required Add-on</span>
                <Toggle on={addon.required} onChange={v => patchAddOn(addon._id, { required: v })} />
              </div>

              {/* Package selection */}
              {state.packages.length > 0 && (
                <div>
                  <label className={labelCls}>Apply to Packages (leave unchecked for all)</label>
                  <div className="flex flex-wrap gap-2">
                    {state.packages.map(pkg => {
                      const selected = addon.packageIds.includes(pkg._id);
                      return (
                        <button
                          key={pkg._id}
                          type="button"
                          onClick={() => {
                            const ids = selected
                              ? addon.packageIds.filter(id => id !== pkg._id)
                              : [...addon.packageIds, pkg._id];
                            patchAddOn(addon._id, { packageIds: ids });
                          }}
                          className={`font-sans text-xs px-3 py-1.5 rounded-full border transition-all focus:outline-none
                            ${selected ? 'bg-gold/10 border-gold text-gold-dark font-semibold' : 'border-border text-charcoal hover:border-gold'}`}
                        >
                          {pkg.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addBlankAddon}
          className="flex items-center gap-2 font-sans text-xs text-gold hover:text-gold-dark transition-colors focus:outline-none border border-gold/40 hover:border-gold rounded-md px-4 py-2.5 w-full justify-center"
        >
          <Plus size={14} /> Add Custom Add-on
        </button>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Step 5 — Availability Calendar
  // ---------------------------------------------------------------------------

  const renderStep5 = () => {
    const calGrid = buildCalendarGrid();
    const prevMonth = () => {
      if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
      else setCalMonth(m => m - 1);
    };
    const nextMonth = () => {
      if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
      else setCalMonth(m => m + 1);
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-serif text-3xl text-dark">Availability</h2>
          <p className="font-sans text-sm text-muted mt-1">
            Click dates to mark them as unavailable. Clients won't be able to request these dates.
          </p>
        </div>

        {/* Bulk actions */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={blockAllWeekends}
            className="font-sans text-xs px-4 py-2 rounded-md border border-border text-charcoal hover:border-gold hover:text-gold transition-all focus:outline-none"
          >
            Block All Weekends
          </button>
          <button
            type="button"
            onClick={blockNext30Days}
            className="font-sans text-xs px-4 py-2 rounded-md border border-border text-charcoal hover:border-gold hover:text-gold transition-all focus:outline-none"
          >
            Block Next 30 Days
          </button>
          <button
            type="button"
            onClick={() => patch({ blockedDates: [] })}
            className="font-sans text-xs px-4 py-2 rounded-md border border-border text-charcoal hover:border-red hover:text-red transition-all focus:outline-none"
          >
            Clear All
          </button>
        </div>

        {/* Calendar */}
        <div className="border border-border rounded-lg bg-white p-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-md border border-border text-charcoal hover:border-gold hover:text-gold transition-all focus:outline-none"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-serif text-lg text-dark">
              {MONTHS[calMonth]} {calYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 rounded-md border border-border text-charcoal hover:border-gold hover:text-gold transition-all focus:outline-none"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} className="text-center font-sans text-xs font-bold text-muted uppercase tracking-widest py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Date cells */}
          <div className="grid grid-cols-7 gap-y-1">
            {calGrid.map((date, idx) => {
              if (!date) return <div key={`empty-${idx}`} />;
              const dateStr = formatDate(date);
              const isPast = date < today && dateStr !== todayStr;
              const isBlocked = state.blockedDates.includes(dateStr);
              const isToday = dateStr === todayStr;

              return (
                <div key={dateStr} className="flex justify-center">
                  <button
                    type="button"
                    disabled={isPast}
                    onClick={() => !isPast && toggleDate(dateStr)}
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-sans transition-all focus:outline-none
                      ${isPast ? 'opacity-30 cursor-not-allowed text-muted' : ''}
                      ${isBlocked && !isPast ? 'bg-dark text-white' : ''}
                      ${!isBlocked && !isPast ? 'hover:bg-gold/10 hover:text-gold-dark text-charcoal cursor-pointer' : ''}
                      ${isToday ? 'ring-1 ring-gold' : ''}`}
                  >
                    {date.getDate()}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-dark" />
            <span className="font-sans text-xs text-muted">Unavailable</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full ring-1 ring-gold" />
            <span className="font-sans text-xs text-muted">Today</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-bg border border-border" />
            <span className="font-sans text-xs text-muted">Available</span>
          </div>
        </div>

        {state.blockedDates.length > 0 && (
          <p className="font-sans text-xs text-muted">
            {state.blockedDates.length} date{state.blockedDates.length !== 1 ? 's' : ''} marked as unavailable
          </p>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Step 6 — Preview & Publish
  // ---------------------------------------------------------------------------

  const renderStep6 = () => {
    const vendorTypeLabel = VENDOR_TYPES.find(v => v.value === state.primaryType)?.label ?? state.primaryType;

    // Group packages by category
    const pkgByCategory: Record<string, PackageDraft[]> = {};
    for (const pkg of state.packages) {
      if (!pkgByCategory[pkg.category]) pkgByCategory[pkg.category] = [];
      pkgByCategory[pkg.category].push(pkg);
    }

    // Example pricing from first package
    const firstPkg = state.packages[0];
    const exampleGuests = firstPkg?.minGuests ? Number(firstPkg.minGuests) : 50;
    const examplePrice = firstPkg
      ? firstPkg.pricingModel === 'PER_PERSON'
        ? Number(firstPkg.basePrice) * exampleGuests
        : firstPkg.pricingModel === 'PER_HOUR'
        ? Number(firstPkg.basePrice) * (Number(firstPkg.durationHours) || 4)
        : Number(firstPkg.basePrice)
      : 0;

    // Checklist
    const checks = [
      { label: 'Business profile complete', ok: !!(state.businessName && state.city) },
      { label: 'At least 1 package', ok: state.packages.length > 0 },
      { label: 'All packages have pricing', ok: state.packages.length > 0 && state.packages.every(p => Number(p.basePrice) > 0) },
      { label: 'Add-ons configured', ok: state.addOns.length > 0, optional: true },
      { label: 'Portfolio photos', ok: false, comingSoon: true },
    ];

    const canSubmit = checks.filter(c => !c.optional && !c.comingSoon).every(c => c.ok);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-serif text-3xl text-dark">Preview & Publish</h2>
          <p className="font-sans text-sm text-muted mt-1">Review your listing before submitting for approval.</p>
        </div>

        {/* Hero preview */}
        <div className="rounded-xl overflow-hidden bg-gradient-to-br from-dark via-charcoal to-dark p-8 text-white">
          <div className="mb-2">
            <span className="font-sans text-xs uppercase tracking-widest border border-gold/50 text-gold px-3 py-1 rounded-full">
              {vendorTypeLabel}
            </span>
          </div>
          <h3 className="font-serif text-3xl mt-3">{state.businessName || 'Your Business Name'}</h3>
          <p className="font-sans text-sm text-white/60 mt-1">{[state.city, state.province, state.country].filter(Boolean).join(', ')}</p>
          {state.about && (
            <p className="font-sans text-sm text-white/70 mt-4 leading-relaxed line-clamp-3">{state.about}</p>
          )}
          {state.minBudget && state.maxBudget && (
            <p className="font-sans text-xs text-gold mt-3">
              {fmt(Number(state.minBudget))} – {fmt(Number(state.maxBudget))} CAD
            </p>
          )}
        </div>

        {/* Packages preview */}
        {Object.keys(pkgByCategory).length > 0 && (
          <div>
            <label className={labelCls}>Packages</label>
            <div className="space-y-4">
              {Object.entries(pkgByCategory).map(([category, pkgs]) => (
                <div key={category}>
                  <p className="font-sans text-xs font-bold text-muted uppercase tracking-widest mb-2">{category}</p>
                  <div className="space-y-2">
                    {pkgs.map(pkg => (
                      <div key={pkg._id} className="border border-border rounded-lg bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-sans text-sm font-bold text-dark">{pkg.name}</p>
                            <p className="font-sans text-xs text-muted mt-0.5">
                              {pkg.pricingModel === 'PER_PERSON' && pkg.basePrice ? `${fmt(Number(pkg.basePrice))} per person` : ''}
                              {pkg.pricingModel === 'FLAT_RATE' && pkg.basePrice ? `${fmt(Number(pkg.basePrice))} flat rate` : ''}
                              {pkg.pricingModel === 'PER_HOUR' && pkg.basePrice ? `${fmt(Number(pkg.basePrice))} per hour` : ''}
                              {!pkg.basePrice && <span className="text-red">Pricing not set</span>}
                            </p>
                            <ul className="mt-2 space-y-0.5">
                              {pkg.included.slice(0, 3).map((item, i) => (
                                <li key={i} className="font-sans text-xs text-charcoal flex items-center gap-1.5">
                                  <Check size={10} className="text-gold flex-shrink-0" />
                                  {item}
                                </li>
                              ))}
                              {pkg.included.length > 3 && (
                                <li className="font-sans text-xs text-muted">+{pkg.included.length - 3} more</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add-ons preview */}
        {state.addOns.length > 0 && (
          <div>
            <label className={labelCls}>Add-ons</label>
            <div className="flex flex-wrap gap-2">
              {state.addOns.map(addon => (
                <div key={addon._id} className="border border-border rounded-md bg-white px-3 py-2">
                  <p className="font-sans text-xs font-semibold text-dark">{addon.name}</p>
                  <p className="font-sans text-xs text-muted">
                    {addon.price ? fmt(Number(addon.price)) : '—'}
                    {addon.pricingModel === 'PER_PERSON' ? '/pp' : addon.pricingModel === 'PER_HOUR' ? '/hr' : ''}
                    {addon.required && <span className="ml-1 text-gold">Required</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Example pricing */}
        {firstPkg && Number(firstPkg.basePrice) > 0 && (
          <div className="bg-gold/5 border border-gold/30 rounded-lg p-4">
            <label className={labelCls}>Example Pricing — {firstPkg.name}</label>
            <p className="font-sans text-2xl font-bold text-dark">{fmt(examplePrice)}</p>
            <p className="font-sans text-xs text-muted mt-1">
              {firstPkg.pricingModel === 'PER_PERSON' && `Based on ${exampleGuests} guests × ${fmt(Number(firstPkg.basePrice))}/person`}
              {firstPkg.pricingModel === 'PER_HOUR' && `Based on ${Number(firstPkg.durationHours) || 4} hours × ${fmt(Number(firstPkg.basePrice))}/hr`}
              {firstPkg.pricingModel === 'FLAT_RATE' && 'Flat rate pricing'}
            </p>
          </div>
        )}

        {/* Bank account / Stripe note */}
        <div className="border border-gold/30 bg-gold/5 rounded-md p-4">
          <p className="font-sans text-xs font-bold uppercase tracking-widest text-gold-dark mb-1">
            Getting paid
          </p>
          <p className="font-sans text-xs text-charcoal leading-relaxed">
            Once your profile is approved you'll be prompted to connect your bank account via Stripe.
            Deposit payments from clients will land directly in your account — FESTV charges no platform fee.
          </p>
        </div>

        {/* Checklist */}
        <div>
          <label className={labelCls}>Submission Checklist</label>
          <div className="space-y-2">
            {checks.map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`flex h-5 w-5 items-center justify-center rounded-full flex-shrink-0
                  ${c.ok ? 'bg-green' : c.comingSoon ? 'bg-border' : 'bg-red/10 border border-red/30'}`}>
                  {c.ok ? (
                    <Check size={10} className="text-white" strokeWidth={3} />
                  ) : (
                    <X size={10} className={c.comingSoon ? 'text-muted' : 'text-red'} strokeWidth={2.5} />
                  )}
                </div>
                <span className={`font-sans text-xs ${c.ok ? 'text-dark' : c.comingSoon ? 'text-muted' : c.optional ? 'text-muted' : 'text-charcoal'}`}>
                  {c.label}
                  {c.optional && !c.comingSoon && <span className="text-muted ml-1">(optional)</span>}
                  {c.comingSoon && <span className="text-muted ml-1">— Coming soon</span>}
                </span>
              </div>
            ))}
          </div>
        </div>

        {!canSubmit && (
          <div className="border border-red/30 bg-red/5 rounded-md p-3">
            <p className="font-sans text-xs text-red">Complete the required checklist items above before submitting.</p>
          </div>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Render steps
  // ---------------------------------------------------------------------------

  const renderStep = () => {
    switch (step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      default: return null;
    }
  };

  const isLastStep = step === 6;

  // Determine canSubmit for button disabled state
  const step6CanSubmit = (() => {
    if (step !== 6) return true;
    if (!state.businessName || !state.city) return false;
    if (state.packages.length === 0) return false;
    if (state.packages.some(p => !p.basePrice || Number(p.basePrice) === 0)) return false;
    return true;
  })();

  return (
    <div className="bg-bg min-h-screen">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <p className="font-serif text-2xl text-gold tracking-widest">FESTV</p>
          <p className="font-sans text-xs text-muted uppercase tracking-widest mt-1">Vendor Setup</p>
        </div>

        {/* Progress bar */}
        <ProgressBar step={step} />

        {/* Step content */}
        <div className="mb-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Error */}
        {stepError && (
          <p className="font-sans text-xs text-red mb-4">{stepError}</p>
        )}

        {/* Navigation */}
        <div className={`flex items-center ${step === 1 ? 'justify-end' : 'justify-between'}`}>
          {step > 1 && (
            <button
              type="button"
              onClick={handleBack}
              disabled={isSubmitting}
              className="border border-border text-charcoal font-sans text-xs font-semibold uppercase tracking-widest px-8 py-3 hover:border-gold hover:text-gold transition-colors rounded-md focus:outline-none disabled:opacity-50"
            >
              Back
            </button>
          )}
          {isLastStep ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !step6CanSubmit}
              className="bg-gold text-dark font-sans text-xs font-bold tracking-widest uppercase px-8 py-3 hover:bg-gold-dark transition-colors disabled:opacity-50 focus:outline-none rounded-md"
            >
              {isSubmitting ? 'Submitting…' : 'Submit for Approval'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleContinue}
              disabled={isSubmitting}
              className="bg-gold text-dark font-sans text-xs font-bold tracking-widest uppercase px-8 py-3 hover:bg-gold-dark transition-colors disabled:opacity-50 focus:outline-none rounded-md"
            >
              {isSubmitting ? 'Saving…' : 'Continue'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
