import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UtensilsCrossed, Wine, Music, Camera, Flower2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { eventsApi } from '../utils/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPE_OPTIONS = [
  { value: 'WEDDING',        label: 'Wedding' },
  { value: 'CORPORATE',      label: 'Corporate' },
  { value: 'BIRTHDAY',       label: 'Birthday' },
  { value: 'ANNIVERSARY',    label: 'Anniversary' },
  { value: 'GRADUATION',     label: 'Graduation' },
  { value: 'BABY_SHOWER',    label: 'Baby Shower' },
  { value: 'BRIDAL_SHOWER',  label: 'Bridal Shower' },
  { value: 'HOLIDAY',        label: 'Holiday' },
  { value: 'COCKTAIL_PARTY', label: 'Cocktail Party' },
  { value: 'DINNER_PARTY',   label: 'Dinner Party' },
  { value: 'BRUNCH',         label: 'Brunch' },
  { value: 'OTHER',          label: 'Other' },
];

const VENDOR_TYPES = [
  { value: 'RESTO_VENUE',  label: 'Restaurant / Venue', Icon: UtensilsCrossed },
  { value: 'CATERER',      label: 'Caterer',            Icon: Wine },
  { value: 'ENTERTAINMENT',label: 'Entertainment',      Icon: Music },
  { value: 'PHOTO_VIDEO',  label: 'Photo & Video',      Icon: Camera },
  { value: 'FLORIST_DECOR',label: 'Florist & Decor',    Icon: Flower2 },
];

// ─── Input / label styles ─────────────────────────────────────────────────────

const labelCls = 'block font-sans text-xs font-bold uppercase tracking-widest text-charcoal mb-2';
const inputCls =
  'w-full border border-border rounded-md px-4 py-3 font-sans text-sm text-dark focus:outline-none focus:border-gold transition-colors bg-white';

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateEvent() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [name, setName]           = useState('');
  const [eventType, setEventType] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [notes, setNotes]         = useState('');
  const [vendorTypes, setVendorTypes] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const toggleVendorType = (type: string) => {
    setVendorTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setError(null);

    // Basic validation
    if (!name.trim()) { setError('Event name is required.'); return; }
    if (!eventType)   { setError('Event type is required.'); return; }
    if (!eventDate)   { setError('Event date is required.'); return; }
    if (!guestCount || parseInt(guestCount) < 1) {
      setError('Guest count must be at least 1.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await eventsApi.create(
        {
          name: name.trim(),
          eventType,
          eventDate,
          guestCount: parseInt(guestCount),
          notes: notes.trim() || undefined,
        },
        token
      );
      const data = res as any;
      if (!data.success) throw new Error(data.error ?? 'Failed to create event');

      const eventId: string = data.data.id;

      // Persist vendor types needed for this event
      if (vendorTypes.length > 0) {
        localStorage.setItem(
          `festv_event_vendors_needed_${eventId}`,
          JSON.stringify(vendorTypes)
        );
      }

      navigate(`/events/${eventId}`);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg py-12 px-6">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div>
          <h1 className="font-serif text-4xl text-dark">Plan Your Event</h1>
          <p className="font-sans text-sm text-muted mt-2">
            Tell us about your event and we'll help you find the perfect vendors.
          </p>
        </div>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-border rounded-md p-8 mt-8 space-y-6"
        >
          {/* Event name */}
          <div>
            <label className={labelCls}>Event Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Sarah & John's Wedding"
              className={inputCls}
            />
          </div>

          {/* Event type */}
          <div>
            <label className={labelCls}>Event Type</label>
            <select
              value={eventType}
              onChange={e => setEventType(e.target.value)}
              className={inputCls}
            >
              <option value="">Select event type…</option>
              {EVENT_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Event date */}
          <div>
            <label className={labelCls}>Event Date</label>
            <input
              type="date"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Guest count */}
          <div>
            <label className={labelCls}>Estimated Guests</label>
            <input
              type="number"
              min={1}
              value={guestCount}
              onChange={e => setGuestCount(e.target.value)}
              placeholder="e.g. 100"
              className={inputCls}
            />
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes (Optional)</label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Anything else we should know about your event?"
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Vendor types needed */}
          <div>
            <label className={labelCls}>What Do You Need?</label>
            <p className="font-sans text-xs text-muted mb-3">
              Select the vendor types you're looking for. We'll help you find the right ones.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {VENDOR_TYPES.map(({ value, label, Icon }) => {
                const selected = vendorTypes.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleVendorType(value)}
                    className={`flex items-center gap-3 p-4 rounded-md cursor-pointer text-left transition-all duration-150 focus:outline-none ${
                      selected
                        ? 'border-2 border-gold bg-gold/5'
                        : 'border border-border hover:border-gold/50'
                    }`}
                  >
                    <Icon size={20} className="text-gold flex-shrink-0" strokeWidth={1.5} />
                    <span className="font-sans text-sm font-semibold text-dark">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="font-sans text-sm text-red bg-red/5 border border-red/20 rounded-md px-4 py-3">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gold text-dark py-4 font-sans text-xs font-bold uppercase tracking-widest hover:bg-gold-dark transition-colors disabled:opacity-50 rounded-md mt-2"
          >
            {isSubmitting ? 'Creating Event…' : 'Start Planning'}
          </button>
        </form>
      </div>
    </div>
  );
}
