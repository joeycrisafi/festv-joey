import { useRef, useState } from 'react';
import { Upload, Camera } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1';

interface ImageUploadProps {
  /** Currently saved image URL — shown as preview when present */
  currentUrl?: string;
  /** Called with the new Cloudinary URL after a successful upload */
  onUpload: (url: string) => void;
  /** Which backend endpoint to POST to */
  endpoint: 'logo' | 'banner' | 'package-image';
  /** Required for package-image uploads */
  packageId?: string;
  /** Label shown in the empty upload zone (or on the compact button) */
  label: string;
  /** Controls the aspect-ratio of the preview / zone (ignored in compact mode) */
  aspectRatio?: 'square' | 'banner' | 'landscape';
  /**
   * compact — renders as a small pill button instead of a full upload zone.
   * Useful for inline edit triggers (e.g. the "Edit Cover Photo" chip on a
   * dark hero banner).  Shows a spinner while uploading; error appears below.
   */
  compact?: boolean;
}

const ASPECT: Record<string, string> = {
  square:    'aspect-square',
  banner:    'aspect-[3/1]',
  landscape: 'aspect-[4/3]',
};

export default function ImageUpload({
  currentUrl,
  onUpload,
  endpoint,
  packageId,
  label,
  aspectRatio = 'landscape',
  compact = false,
}: ImageUploadProps) {
  const { token } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);

  const displayUrl = preview ?? currentUrl ?? null;
  const aspectCls = ASPECT[aspectRatio] ?? ASPECT.landscape;

  async function handleFile(file: File) {
    setError(null);

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPG, PNG, or WebP files are accepted.');
      return;
    }

    // Show local preview immediately (full-zone mode only)
    if (!compact) {
      setPreview(URL.createObjectURL(file));
    }
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);
      if (packageId) formData.append('packageId', packageId);

      const res = await fetch(`${API_BASE}/upload/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Upload failed');
      }

      // Pull the URL from whichever key the server returns
      const url: string =
        json.data?.logoUrl ?? json.data?.bannerImageUrl ?? json.data?.imageUrl;

      if (!compact) setPreview(url);
      onUpload(url);
    } catch (err: any) {
      setError(err.message ?? 'Upload failed. Please try again.');
      if (!compact) setPreview(null);
    } finally {
      setUploading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  // ── Compact mode — pill button ────────────────────────────────────────────
  if (compact) {
    return (
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleChange}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 font-sans text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-md border border-white/30 text-white bg-dark/40 hover:bg-dark/70 transition-colors disabled:opacity-60 focus:outline-none"
          style={{ backdropFilter: 'blur(6px)' }}
        >
          {uploading ? (
            <span className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin inline-block" />
          ) : (
            <Camera size={13} strokeWidth={1.5} />
          )}
          {label}
        </button>
        {error && <p className="font-sans text-xs text-red mt-1">{error}</p>}
      </div>
    );
  }

  // ── Full upload zone ──────────────────────────────────────────────────────
  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
      />

      <div
        className={`relative w-full ${aspectCls} cursor-pointer rounded-md overflow-hidden`}
        onClick={() => !uploading && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {displayUrl ? (
          <>
            <img src={displayUrl} alt={label} className="w-full h-full object-cover" />
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center gap-2 transition-opacity duration-200 ${
                hovered || uploading ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ background: 'rgba(26,23,20,0.55)' }}
            >
              {uploading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Camera size={20} className="text-white" strokeWidth={1.5} />
                  <span className="font-sans text-xs font-semibold text-white uppercase tracking-widest">
                    Change
                  </span>
                </>
              )}
            </div>
          </>
        ) : (
          <div
            className={`w-full h-full flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-md transition-colors duration-200 ${
              uploading
                ? 'border-gold/50 bg-gold/5'
                : hovered
                ? 'border-gold bg-gold/5'
                : 'border-border bg-white'
            }`}
          >
            {uploading ? (
              <div className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
            ) : (
              <>
                <Upload size={22} strokeWidth={1.5} className="text-muted" />
                <div className="text-center px-4">
                  <p className="font-sans text-xs font-bold uppercase tracking-widest text-charcoal">
                    {label}
                  </p>
                  <p className="font-sans text-xs text-muted mt-1">
                    Click or drag &amp; drop · JPG, PNG, WebP
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {error && <p className="font-sans text-xs text-red">{error}</p>}
    </div>
  );
}
