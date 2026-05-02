import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Users,
  DollarSign,
  MapPin,
  Clock,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { eventRequestsApi } from '../utils/api';

const eventTypes = [
  'WEDDING', 'CORPORATE', 'BIRTHDAY', 'ANNIVERSARY',
  'GRADUATION', 'BABY_SHOWER', 'BRIDAL_SHOWER', 'HOLIDAY', 'SOCIAL', 'OTHER',
];

const serviceStyles = [
  { value: 'BUFFET',        label: 'Buffet Style' },
  { value: 'PLATED',        label: 'Plated Service' },
  { value: 'FAMILY_STYLE',  label: 'Family Style' },
  { value: 'FOOD_STATIONS', label: 'Food Stations' },
  { value: 'COCKTAIL',      label: 'Cocktail Reception' },
  { value: 'DROP_OFF',      label: 'Drop-off Catering' },
];

const INPUT = 'w-full bg-white border border-border rounded-md px-4 py-2.5 font-sans text-sm text-[#3A3530] focus:border-[#C4A06A] focus:outline-none';

export default function CreateEventRequest() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    eventType: 'WEDDING',
    description: '',
    guestCount: 50,
    budgetMin: 1000,
    budgetMax: 5000,
    eventDate: '',
    eventStartTime: '18:00',
    eventEndTime: '22:00',
    venueName: '',
    venueAddress: '',
    venueCity: '',
    venueState: '',
    venueZipCode: '',
    venueNotes: '',
    serviceStyles: [] as string[],
    dietaryRestrictions: [] as string[],
    needsStaffing: false,
    needsSetup: false,
    needsCleanup: false,
  });

  const updateForm = (field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleServiceStyle = (style: string) => {
    setFormData(prev => ({
      ...prev,
      serviceStyles: prev.serviceStyles.includes(style)
        ? prev.serviceStyles.filter(s => s !== style)
        : [...prev.serviceStyles, style],
    }));
  };

  const handleSubmit = async () => {
    if (!token) {
      setError('You must be logged in to create an event request');
      return;
    }
    setIsSubmitting(true);
    setError('');

    try {
      const response = await eventRequestsApi.create(formData, token);
      if ((response as any).success && (response as any).data?.id) {
        navigate('/dashboard');
      } else {
        setError('Failed to create request - unexpected response');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen py-10" style={{ backgroundColor: '#F5F3EF' }}>
      <div className="section-padding max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 font-sans text-sm text-[#7A7068] hover:text-[#3A3530] mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="font-serif text-3xl text-[#1A1714]">Create Event Request</h1>
          <p className="font-sans text-sm text-[#7A7068] mt-1">
            Tell us about your event and we'll connect you with the best providers.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {['Event Details', 'Venue', 'Preferences'].map((label, index) => (
            <div key={label} className="flex items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-sans font-semibold text-sm ${
                  step > index + 1
                    ? 'bg-[#3A8A55] text-white'
                    : step === index + 1
                    ? 'bg-[#1A1714] text-[#F5F3EF]'
                    : 'bg-[#E8E4DD] text-[#7A7068]'
                }`}
              >
                {step > index + 1 ? <CheckCircle className="w-4 h-4" /> : index + 1}
              </div>
              <span
                className={`ml-2 font-sans text-sm font-medium ${
                  step === index + 1 ? 'text-[#1A1714]' : 'text-[#7A7068]'
                }`}
              >
                {label}
              </span>
              {index < 2 && (
                <div className="w-12 h-px mx-4" style={{ backgroundColor: '#E8E4DD' }} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white border border-border rounded-md p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md font-sans text-sm text-red-700">
              {error}
            </div>
          )}

          {/* ── Step 1: Event Details ──────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block font-sans text-xs font-bold uppercase tracking-widest text-[#3A3530] mb-2">
                  Event Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => updateForm('title', e.target.value)}
                  className={INPUT}
                  placeholder="e.g., Smith Wedding Reception"
                />
              </div>

              <div>
                <label className="block font-sans text-xs font-bold uppercase tracking-widest text-[#3A3530] mb-2">
                  Event Type *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {eventTypes.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateForm('eventType', type)}
                      className={`px-4 py-2 rounded-md font-sans text-sm transition-all ${
                        formData.eventType === type
                          ? 'border-2 border-[#C4A06A] bg-[#FBF7F0] text-[#1A1714] font-medium'
                          : 'border border-border text-[#7A7068] hover:border-[#C4A06A]'
                      }`}
                    >
                      {type.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 font-sans text-xs font-bold uppercase tracking-widest text-[#3A3530] mb-2">
                    <Calendar className="w-3.5 h-3.5" />
                    Event Date *
                  </label>
                  <input
                    type="date"
                    value={formData.eventDate}
                    onChange={e => updateForm('eventDate', e.target.value)}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 font-sans text-xs font-bold uppercase tracking-widest text-[#3A3530] mb-2">
                    <Users className="w-3.5 h-3.5" />
                    Guest Count *
                  </label>
                  <input
                    type="number"
                    value={formData.guestCount}
                    onChange={e => updateForm('guestCount', parseInt(e.target.value))}
                    className={INPUT}
                    min="1"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 font-sans text-xs font-bold uppercase tracking-widest text-[#3A3530] mb-2">
                    <Clock className="w-3.5 h-3.5" />
                    Start Time *
                  </label>
                  <input
                    type="time"
                    value={formData.eventStartTime}
                    onChange={e => updateForm('eventStartTime', e.target.value)}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 font-sans text-xs font-bold uppercase tracking-widest text-[#3A3530] mb-2">
                    <Clock className="w-3.5 h-3.5" />
                    End Time *
                  </label>
                  <input
                    type="time"
                    value={formData.eventEndTime}
                    onChange={e => updateForm('eventEndTime', e.target.value)}
                    className={INPUT}
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 font-sans text-xs font-bold uppercase tracking-widest text-[#3A3530] mb-2">
                  <DollarSign className="w-3.5 h-3.5" />
                  Budget Range *
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A7068]" />
                    <input
                      type="number"
                      value={formData.budgetMin}
                      onChange={e => updateForm('budgetMin', parseInt(e.target.value))}
                      className={`${INPUT} pl-9`}
                      placeholder="Min"
                      min="0"
                    />
                  </div>
                  <span className="font-sans text-sm text-[#7A7068]">to</span>
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A7068]" />
                    <input
                      type="number"
                      value={formData.budgetMax}
                      onChange={e => updateForm('budgetMax', parseInt(e.target.value))}
                      className={`${INPUT} pl-9`}
                      placeholder="Max"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-sans text-xs font-bold uppercase tracking-widest text-[#3A3530] mb-2">
                  Event Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={e => updateForm('description', e.target.value)}
                  className={`${INPUT} min-h-[100px] resize-none`}
                  placeholder="Tell providers more about your event..."
                />
              </div>
            </div>
          )}

          {/* ── Step 2: Venue ──────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block font-sans text-xs font-bold uppercase tracking-widest text-[#3A3530] mb-2">
                  Venue Name
                </label>
                <input
                  type="text"
                  value={formData.venueName}
                  onChange={e => updateForm('venueName', e.target.value)}
                  className={INPUT}
                  placeholder="e.g., Grand Ballroom"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 font-sans text-xs font-bold uppercase tracking-widest text-[#3A3530] mb-2">
                  <MapPin className="w-3.5 h-3.5" />
                  Street Address *
                </label>
                <input
                  type="text"
                  value={formData.venueAddress}
                  onChange={e => updateForm('venueAddress', e.target.value)}
                  className={INPUT}
                  placeholder="123 Main Street"
                />
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-sans text-xs font-bold uppercase tracking-widest text-[#3A3530] mb-2">
                    City *
                  </label>
                  <input
                    type="text"
                    value={formData.venueCity}
                    onChange={e => updateForm('venueCity', e.target.value)}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className="block font-sans text-xs font-bold uppercase tracking-widest text-[#3A3530] mb-2">
                    State *
                  </label>
                  <input
                    type="text"
                    value={formData.venueState}
                    onChange={e => updateForm('venueState', e.target.value)}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className="block font-sans text-xs font-bold uppercase tracking-widest text-[#3A3530] mb-2">
                    ZIP Code *
                  </label>
                  <input
                    type="text"
                    value={formData.venueZipCode}
                    onChange={e => updateForm('venueZipCode', e.target.value)}
                    className={INPUT}
                  />
                </div>
              </div>

              <div>
                <label className="block font-sans text-xs font-bold uppercase tracking-widest text-[#3A3530] mb-2">
                  Venue Notes
                </label>
                <textarea
                  value={formData.venueNotes}
                  onChange={e => updateForm('venueNotes', e.target.value)}
                  className={`${INPUT} min-h-[100px] resize-none`}
                  placeholder="Parking, kitchen access, AV equipment, etc."
                />
              </div>
            </div>
          )}

          {/* ── Step 3: Preferences ────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block font-sans text-xs font-bold uppercase tracking-widest text-[#3A3530] mb-3">
                  Service Style — select all that apply
                </label>
                <div className="grid sm:grid-cols-2 gap-2">
                  {serviceStyles.map(style => {
                    const selected = formData.serviceStyles.includes(style.value);
                    return (
                      <button
                        key={style.value}
                        type="button"
                        onClick={() => toggleServiceStyle(style.value)}
                        className={`px-4 py-3 rounded-md text-left transition-all flex items-center gap-3 ${
                          selected
                            ? 'border-2 border-[#C4A06A] bg-[#FBF7F0] text-[#1A1714]'
                            : 'border border-border text-[#7A7068] hover:border-[#C4A06A]'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
                            selected
                              ? 'bg-[#C4A06A] border border-[#C4A06A]'
                              : 'border border-border'
                          }`}
                        >
                          {selected && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                        <span className={`font-sans text-sm ${selected ? 'font-medium text-[#1A1714]' : ''}`}>
                          {style.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-sans text-xs font-bold uppercase tracking-widest text-[#3A3530] mb-3">
                  Additional Services
                </label>
                <div className="space-y-3">
                  {[
                    { key: 'needsStaffing', label: 'Staffing / Servers' },
                    { key: 'needsSetup',    label: 'Setup & Decoration' },
                    { key: 'needsCleanup',  label: 'Cleanup' },
                  ].map(option => (
                    <label key={option.key} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData[option.key as keyof typeof formData] as boolean}
                        onChange={e => updateForm(option.key, e.target.checked)}
                        className="w-4 h-4 rounded border-border accent-[#C4A06A]"
                      />
                      <span className="font-sans text-sm text-[#3A3530]">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="rounded-md p-6" style={{ backgroundColor: '#F5F3EF' }}>
                <h3 className="font-serif text-lg text-[#1A1714] mb-4">Request Summary</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Event',    value: formData.title || 'Untitled' },
                    { label: 'Type',     value: formData.eventType.replace('_', ' ') },
                    { label: 'Date',     value: formData.eventDate ? new Date(formData.eventDate).toLocaleDateString() : 'Not set' },
                    { label: 'Guests',   value: String(formData.guestCount) },
                    { label: 'Budget',   value: `$${formData.budgetMin.toLocaleString()} – $${formData.budgetMax.toLocaleString()}` },
                    { label: 'Location', value: formData.venueCity ? `${formData.venueCity}, ${formData.venueState}` : 'Not set' },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between">
                      <span className="font-sans text-sm text-[#7A7068]">{row.label}</span>
                      <span className="font-sans text-sm font-medium text-[#1A1714]">{row.value}</span>
                    </div>
                  ))}
                  {formData.serviceStyles.length > 0 && (
                    <div className="flex justify-between">
                      <span className="font-sans text-sm text-[#7A7068]">Service Styles</span>
                      <span className="font-sans text-sm font-medium text-[#1A1714] text-right">
                        {formData.serviceStyles
                          .map(s => serviceStyles.find(ss => ss.value === s)?.label)
                          .join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-border">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-2 border border-border rounded-md px-6 py-2.5 font-sans text-sm text-[#3A3530] hover:bg-[#F5F3EF] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Previous
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-2 bg-[#1A1714] text-[#F5F3EF] rounded-md px-6 py-2.5 font-sans text-sm font-medium hover:bg-[#3A3530] transition-colors"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-[#1A1714] text-[#F5F3EF] rounded-md px-6 py-2.5 font-sans text-sm font-medium hover:bg-[#3A3530] transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Submit Request
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
