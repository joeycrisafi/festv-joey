import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { type PortfolioPostData } from './PortfolioCard';

interface Props {
  onClose: () => void;
  onPosted: (post: PortfolioPostData) => void;
  forcedType?: 'VENDOR_POST' | 'PLANNER_POST';
}

interface PackageOption { id: string; name: string; }
interface EventOption { id: string; name: string; }
interface BookingVendor { bookingId: string; providerId: string; businessName: string; }

export default function PostComposer({ onClose, onPosted, forcedType }: Props) {
  const { user, token } = useAuth();

  // Effective type — forcedType wins, otherwise derive from role
  const effectiveType: 'VENDOR_POST' | 'PLANNER_POST' = forcedType
    ?? (user?.role === 'PROVIDER' ? 'VENDOR_POST' : 'PLANNER_POST');
  const isProvider = effectiveType === 'VENDOR_POST';
  const isClient   = effectiveType === 'PLANNER_POST';

  const [caption, setCaption] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState('');

  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');

  const [bookingVendors, setBookingVendors] = useState<BookingVendor[]>([]);
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    if (isProvider) {
      fetch('/api/v1/packages/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => setPackages(d?.data ?? []))
        .catch(() => {});
    }
    if (isClient) {
      fetch('/api/v1/events/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => setEvents(d?.data ?? []))
        .catch(() => {});
      fetch('/api/v1/bookings/me/client', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => {
          const bookings: any[] = d?.data ?? [];
          const confirmed = bookings.filter(b =>
            ['CONFIRMED', 'DEPOSIT_PAID', 'COMPLETED'].includes(b.status)
          );
          const unique = new Map<string, BookingVendor>();
          confirmed.forEach(b => {
            if (b.providerProfile?.id) {
              unique.set(b.providerProfile.id, {
                bookingId: b.id,
                providerId: b.providerProfile.id,
                businessName: b.providerProfile.businessName ?? 'Vendor',
              });
            }
          });
          setBookingVendors([...unique.values()]);
        })
        .catch(() => {});
    }
  }, [token, isProvider, isClient]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !token) return;
    const remaining = 5 - imageUrls.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (toUpload.length === 0) return;

    setUploading(true);
    setError('');
    const uploaded: string[] = [];

    for (const file of toUpload) {
      const form = new FormData();
      form.append('image', file);
      try {
        const res = await fetch('/api/v1/upload/portfolio-image', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const d = await res.json();
        if (d.success && d.data?.imageUrl) {
          uploaded.push(d.data.imageUrl);
        } else {
          setError('One or more images failed to upload.');
        }
      } catch {
        setError('Upload failed. Please try again.');
      }
    }

    setImageUrls(prev => [...prev, ...uploaded]);
    setUploading(false);
  };

  const removeImage = (idx: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== idx));
  };

  const toggleVendor = (providerId: string) => {
    setSelectedVendorIds(prev =>
      prev.includes(providerId) ? prev.filter(id => id !== providerId) : [...prev, providerId]
    );
  };

  const handleSubmit = async () => {
    if (!token) return;
    if (imageUrls.length === 0) { setError('Add at least one image.'); return; }

    setSubmitting(true);
    setError('');

    const vendorTags = selectedVendorIds.map(pid => {
      const v = bookingVendors.find(bv => bv.providerId === pid)!;
      return { providerId: pid, bookingId: v.bookingId };
    });

    const body: Record<string, any> = {
      type: effectiveType,
      caption: caption.trim() || undefined,
      imageUrls,
    };
    if (isProvider && selectedPackageId) body.packageId = selectedPackageId;
    if (isClient && selectedEventId) body.eventId = selectedEventId;
    if (isClient && vendorTags.length > 0) body.vendorTags = vendorTags;

    try {
      const res = await fetch('/api/v1/portfolio/posts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.success) {
        onPosted(d.data);
        onClose();
      } else {
        setError(d.error ?? 'Failed to post. Try again.');
      }
    } catch {
      setError('Failed to post. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-md w-full mx-4"
          style={{ maxWidth: 512 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <p className="font-sans font-semibold text-sm text-dark uppercase tracking-widest">
              Add to Portfolio
            </p>
            <button onClick={onClose} className="text-muted hover:text-charcoal transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Image upload area */}
            <div>
              <p className="font-sans text-xs font-bold uppercase tracking-widest text-charcoal mb-2">
                Images <span className="text-muted font-normal normal-case tracking-normal">({imageUrls.length}/5)</span>
              </p>

              {imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {imageUrls.map((url, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border border-border">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(26,23,20,0.7)' }}
                      >
                        <X size={10} color="white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {imageUrls.length < 5 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 border border-border rounded-md py-3 font-sans text-xs text-muted hover:border-gold hover:text-charcoal transition-colors disabled:opacity-40"
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploading ? 'Uploading…' : 'Add images'}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={e => handleFiles(e.target.files)}
              />
            </div>

            {/* Caption */}
            <div>
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Tell the story of this event…"
                className="w-full border border-border rounded-md px-4 py-2.5 font-sans text-sm text-charcoal focus:outline-none resize-none"
                style={{ fontSize: 13 }}
                onFocus={e => e.currentTarget.style.borderColor = '#C4A06A'}
                onBlur={e => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.09)'}
              />
              <p className="font-sans text-[10px] text-muted text-right mt-0.5">{caption.length}/2000</p>
            </div>

            {/* Package selector — VENDOR only */}
            {isProvider && packages.length > 0 && (
              <div>
                <p className="font-sans text-xs font-bold uppercase tracking-widest text-charcoal mb-1.5">
                  Link a Package <span className="text-muted font-normal normal-case tracking-normal">(optional)</span>
                </p>
                <select
                  value={selectedPackageId}
                  onChange={e => setSelectedPackageId(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 font-sans text-sm text-charcoal focus:outline-none bg-white"
                  onFocus={e => e.currentTarget.style.borderColor = '#C4A06A'}
                  onBlur={e => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.09)'}
                >
                  <option value="">No package</option>
                  {packages.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Event selector — CLIENT only */}
            {isClient && events.length > 0 && (
              <div>
                <p className="font-sans text-xs font-bold uppercase tracking-widest text-charcoal mb-1.5">
                  Link an Event <span className="text-muted font-normal normal-case tracking-normal">(optional)</span>
                </p>
                <select
                  value={selectedEventId}
                  onChange={e => setSelectedEventId(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 font-sans text-sm text-charcoal focus:outline-none bg-white"
                  onFocus={e => e.currentTarget.style.borderColor = '#C4A06A'}
                  onBlur={e => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.09)'}
                >
                  <option value="">No event</option>
                  {events.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Vendor tags — CLIENT only, from confirmed bookings */}
            {isClient && bookingVendors.length > 0 && (
              <div>
                <p className="font-sans text-xs font-bold uppercase tracking-widest text-charcoal mb-1.5">
                  Tag Vendors <span className="text-muted font-normal normal-case tracking-normal">(optional)</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {bookingVendors.map(v => {
                    const selected = selectedVendorIds.includes(v.providerId);
                    return (
                      <button
                        key={v.providerId}
                        onClick={() => toggleVendor(v.providerId)}
                        className="font-sans text-xs rounded-sm px-2.5 py-1 border transition-colors"
                        style={selected
                          ? { background: 'rgba(196,160,106,0.15)', borderColor: '#C4A06A', color: '#9C7A45' }
                          : { background: 'white', borderColor: 'rgba(0,0,0,0.09)', color: '#7A7068' }}
                      >
                        {v.businessName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <p className="font-sans text-xs text-red">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-border">
            <button
              onClick={handleSubmit}
              disabled={submitting || imageUrls.length === 0}
              className="w-full font-sans text-xs font-bold uppercase tracking-widest py-3 rounded-md transition-opacity disabled:opacity-40"
              style={{ background: '#1A1714', color: '#F5F3EF' }}
            >
              {submitting ? 'Saving…' : 'Add to Portfolio'}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
