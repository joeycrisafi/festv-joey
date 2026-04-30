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
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { eventRequestsApi } from '../utils/api';

const eventTypes = [
  'WEDDING', 'CORPORATE', 'BIRTHDAY', 'ANNIVERSARY', 
  'GRADUATION', 'BABY_SHOWER', 'BRIDAL_SHOWER', 'HOLIDAY', 'SOCIAL', 'OTHER'
];

const serviceStyles = [
  { value: 'BUFFET', label: 'Buffet Style' },
  { value: 'PLATED', label: 'Plated Service' },
  { value: 'FAMILY_STYLE', label: 'Family Style' },
  { value: 'FOOD_STATIONS', label: 'Food Stations' },
  { value: 'COCKTAIL', label: 'Cocktail Reception' },
  { value: 'DROP_OFF', label: 'Drop-off Catering' },
];

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

  const updateForm = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleServiceStyle = (style: string) => {
    setFormData(prev => ({
      ...prev,
      serviceStyles: prev.serviceStyles.includes(style)
        ? prev.serviceStyles.filter(s => s !== style)
        : [...prev.serviceStyles, style]
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
      console.log('Creating event request with data:', formData);
      const response = await eventRequestsApi.create(formData, token);
      console.log('Create response:', response);
      
      if ((response as any).success && (response as any).data?.id) {
        navigate('/dashboard');
      } else {
        console.error('Unexpected response structure:', response);
        setError('Failed to create request - unexpected response');
      }
    } catch (err) {
      console.error('Error creating event request:', err);
      setError(err instanceof Error ? err.message : 'Failed to create request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="py-8">
      <div className="section-padding max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-stone-600 hover:text-stone-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <h1 className="font-display text-3xl font-bold text-stone-900">
            Create Event Request
          </h1>
          <p className="text-stone-600 mt-1">
            Tell us about your event and we'll connect you with the best providers
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {['Event Details', 'Venue', 'Preferences'].map((label, index) => (
            <div key={label} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                step > index + 1 
                  ? 'bg-green-500 text-white'
                  : step === index + 1 
                  ? 'bg-brand-500 text-white' 
                  : 'bg-stone-200 text-stone-500'
              }`}>
                {step > index + 1 ? <CheckCircle className="w-5 h-5" /> : index + 1}
              </div>
              <span className={`ml-2 font-medium ${step === index + 1 ? 'text-stone-900' : 'text-stone-500'}`}>
                {label}
              </span>
              {index < 2 && <div className="w-16 h-0.5 bg-stone-200 mx-4" />}
            </div>
          ))}
        </div>

        <div className="card p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
              {error}
            </div>
          )}

          {/* Step 1: Event Details */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Event Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => updateForm('title', e.target.value)}
                  className="input-field"
                  placeholder="e.g., Smith Wedding Reception"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Event Type *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {eventTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateForm('eventType', type)}
                      className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                        formData.eventType === type
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-stone-200 hover:border-stone-300 text-stone-600'
                      }`}
                    >
                      {type.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Event Date *
                  </label>
                  <input
                    type="date"
                    value={formData.eventDate}
                    onChange={(e) => updateForm('eventDate', e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    <Users className="w-4 h-4 inline mr-1" />
                    Guest Count *
                  </label>
                  <input
                    type="number"
                    value={formData.guestCount}
                    onChange={(e) => updateForm('guestCount', parseInt(e.target.value))}
                    className="input-field"
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Start Time *
                  </label>
                  <input
                    type="time"
                    value={formData.eventStartTime}
                    onChange={(e) => updateForm('eventStartTime', e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    End Time *
                  </label>
                  <input
                    type="time"
                    value={formData.eventEndTime}
                    onChange={(e) => updateForm('eventEndTime', e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-1" />
                  Budget Range *
                </label>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                    <input
                      type="number"
                      value={formData.budgetMin}
                      onChange={(e) => updateForm('budgetMin', parseInt(e.target.value))}
                      className="input-field pl-10"
                      placeholder="Min"
                      min="0"
                    />
                  </div>
                  <span className="text-stone-400">to</span>
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                    <input
                      type="number"
                      value={formData.budgetMax}
                      onChange={(e) => updateForm('budgetMax', parseInt(e.target.value))}
                      className="input-field pl-10"
                      placeholder="Max"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Event Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                  className="input-field min-h-[100px]"
                  placeholder="Tell providers more about your event..."
                />
              </div>
            </div>
          )}

          {/* Step 2: Venue */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Venue Name
                </label>
                <input
                  type="text"
                  value={formData.venueName}
                  onChange={(e) => updateForm('venueName', e.target.value)}
                  className="input-field"
                  placeholder="e.g., Grand Ballroom"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Street Address *
                </label>
                <input
                  type="text"
                  value={formData.venueAddress}
                  onChange={(e) => updateForm('venueAddress', e.target.value)}
                  className="input-field"
                  placeholder="123 Main Street"
                  required
                />
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    City *
                  </label>
                  <input
                    type="text"
                    value={formData.venueCity}
                    onChange={(e) => updateForm('venueCity', e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    State *
                  </label>
                  <input
                    type="text"
                    value={formData.venueState}
                    onChange={(e) => updateForm('venueState', e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    ZIP Code *
                  </label>
                  <input
                    type="text"
                    value={formData.venueZipCode}
                    onChange={(e) => updateForm('venueZipCode', e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Venue Notes
                </label>
                <textarea
                  value={formData.venueNotes}
                  onChange={(e) => updateForm('venueNotes', e.target.value)}
                  className="input-field min-h-[100px]"
                  placeholder="Any special instructions for the venue (parking, access, kitchen facilities, etc.)"
                />
              </div>
            </div>
          )}

          {/* Step 3: Preferences */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Service Style (select all that apply)
                </label>
                <div className="grid sm:grid-cols-2 gap-2">
                  {serviceStyles.map((style) => (
                    <button
                      key={style.value}
                      type="button"
                      onClick={() => toggleServiceStyle(style.value)}
                      className={`px-4 py-3 rounded-lg border-2 text-left transition-all flex items-center gap-3 ${
                        formData.serviceStyles.includes(style.value)
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        formData.serviceStyles.includes(style.value)
                          ? 'border-brand-500 bg-brand-500'
                          : 'border-stone-300'
                      }`}>
                        {formData.serviceStyles.includes(style.value) && (
                          <CheckCircle className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className={`font-medium ${
                        formData.serviceStyles.includes(style.value) ? 'text-brand-700' : 'text-stone-700'
                      }`}>
                        {style.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-3">
                  Additional Services
                </label>
                <div className="space-y-3">
                  {[
                    { key: 'needsStaffing', label: 'Staffing/Servers' },
                    { key: 'needsSetup', label: 'Setup & Decoration' },
                    { key: 'needsCleanup', label: 'Cleanup' },
                  ].map((option) => (
                    <label key={option.key} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData[option.key as keyof typeof formData] as boolean}
                        onChange={(e) => updateForm(option.key, e.target.checked)}
                        className="w-5 h-5 rounded border-stone-300 text-brand-500 focus:ring-brand-500"
                      />
                      <span className="text-stone-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-stone-50 rounded-xl p-6">
                <h3 className="font-semibold text-stone-900 mb-4">Request Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-stone-600">Event</span>
                    <span className="font-medium">{formData.title || 'Untitled'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-600">Type</span>
                    <span className="font-medium">{formData.eventType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-600">Date</span>
                    <span className="font-medium">
                      {formData.eventDate ? new Date(formData.eventDate).toLocaleDateString() : 'Not set'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-600">Guests</span>
                    <span className="font-medium">{formData.guestCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-600">Budget</span>
                    <span className="font-medium">
                      ${formData.budgetMin.toLocaleString()} - ${formData.budgetMax.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-600">Location</span>
                    <span className="font-medium">
                      {formData.venueCity ? `${formData.venueCity}, ${formData.venueState}` : 'Not set'}
                    </span>
                  </div>
                  {formData.serviceStyles.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-stone-600">Service Styles</span>
                      <span className="font-medium text-right">
                        {formData.serviceStyles.map(s => 
                          serviceStyles.find(ss => ss.value === s)?.label
                        ).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-stone-200">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="btn-secondary"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Previous
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="btn-primary"
              >
                Next
                <ArrowRight className="w-5 h-5 ml-2" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="btn-primary"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
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
