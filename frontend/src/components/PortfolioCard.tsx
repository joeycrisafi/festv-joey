import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Upload, Loader2, Pencil } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PortfolioPostData {
  id: string;
  type: 'VENDOR_POST' | 'PLANNER_POST';
  caption?: string | null;
  imageUrls: string[];
  createdAt: string;
  sharedToFeed?: boolean;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
    role: string;
    providerProfiles?: { businessName: string; logoUrl?: string | null }[];
  };
  package?: { id: string; name: string } | null;
  event?: { id: string; name: string } | null;
  vendorTags: {
    id: string;
    providerId: string;
    bookingId: string;
    provider: { businessName: string; logoUrl?: string | null };
    vendorReply?: string | null;
    vendorRepliedAt?: string | null;
  }[];
  _count: { likes: number; saves: number };
  likedByMe?: boolean;
  savedByMe?: boolean;
}

interface Props {
  post: PortfolioPostData;
  token?: string | null;
  onRequireAuth?: () => void;
  onSaveChange?: (postId: string, saved: boolean) => void;
  managementMode?: boolean;
  onDelete?: (id: string) => void;
  onUpdate?: (post: PortfolioPostData) => void;
  currentProviderProfileId?: string | null;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        stroke={filled ? '#C4A06A' : '#7A7068'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? 'rgba(196,160,106,0.15)' : 'none'}
      />
    </svg>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="13" height="13" viewBox="0 0 24 24"
      fill={filled ? 'rgba(196,160,106,0.15)' : 'none'}
      stroke={filled ? '#C4A06A' : '#7A7068'}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PortfolioCard({
  post,
  token,
  onRequireAuth,
  onSaveChange,
  managementMode = false,
  onDelete,
  onUpdate,
  currentProviderProfileId,
}: Props) {

  // ── Like / save state ──────────────────────────────────────────────────────
  const [liked, setLiked] = useState(post.likedByMe ?? false);
  const [likeCount, setLikeCount] = useState(post._count.likes);
  const [saved, setSaved] = useState(post.savedByMe ?? false);
  const [saveCount, setSaveCount] = useState(post._count.saves);

  // ── Feed toggle state ──────────────────────────────────────────────────────
  const [sharedToFeed, setSharedToFeed] = useState(post.sharedToFeed ?? false);

  // ── Hover / management state ───────────────────────────────────────────────
  const [hovered, setHovered] = useState(false);

  // ── Edit state ─────────────────────────────────────────────────────────────
  const [showEdit, setShowEdit] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption ?? '');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const editFileRef = useRef<HTMLInputElement>(null);

  // ── Delete state ───────────────────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Reply state ────────────────────────────────────────────────────────────
  const [localTags, setLocalTags] = useState(post.vendorTags);
  const [replyingToTagId, setReplyingToTagId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // ── Author display ─────────────────────────────────────────────────────────
  const isVendor = post.type === 'VENDOR_POST';
  const businessName = post.author.providerProfiles?.[0]?.businessName;
  const authorName = isVendor && businessName
    ? businessName
    : `${post.author.firstName} ${post.author.lastName}`;
  const initials = isVendor && businessName
    ? businessName[0].toUpperCase()
    : `${post.author.firstName[0] ?? ''}${post.author.lastName[0] ?? ''}`.toUpperCase();

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleLike = async () => {
    if (!token) { onRequireAuth?.(); return; }
    const next = !liked;
    setLiked(next);
    setLikeCount(c => next ? c + 1 : c - 1);
    try {
      const res = await fetch(`/api/v1/portfolio/posts/${post.id}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setLiked(d.data.liked);
        setLikeCount(d.data.likeCount);
      } else {
        setLiked(!next);
        setLikeCount(c => next ? c - 1 : c + 1);
      }
    } catch {
      setLiked(!next);
      setLikeCount(c => next ? c - 1 : c + 1);
    }
  };

  const handleSave = async () => {
    if (!token) { onRequireAuth?.(); return; }
    const next = !saved;
    setSaved(next);
    setSaveCount(c => next ? c + 1 : c - 1);
    try {
      const res = await fetch(`/api/v1/portfolio/posts/${post.id}/save`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setSaved(d.data.saved);
        setSaveCount(d.data.saveCount);
        onSaveChange?.(post.id, d.data.saved);
      } else {
        setSaved(!next);
        setSaveCount(c => next ? c - 1 : c + 1);
      }
    } catch {
      setSaved(!next);
      setSaveCount(c => next ? c - 1 : c + 1);
    }
  };

  const handleToggleFeed = async () => {
    if (!token) return;
    const next = !sharedToFeed;
    setSharedToFeed(next);
    try {
      const res = await fetch(`/api/v1/portfolio/posts/${post.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sharedToFeed: next }),
      });
      if (!res.ok) setSharedToFeed(!next);
    } catch {
      setSharedToFeed(!next);
    }
  };

  const handleEditFiles = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files);
    const previews = newFiles.map(f => URL.createObjectURL(f));
    setPendingFiles(prev => [...prev, ...newFiles]);
    setPendingPreviews(prev => [...prev, ...previews]);
  };

  const handleEditSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const uploaded: string[] = [];
      for (const file of pendingFiles) {
        const form = new FormData();
        form.append('image', file);
        const r = await fetch('/api/v1/upload/portfolio-image', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const d = await r.json();
        if (d.success && d.data?.imageUrl) uploaded.push(d.data.imageUrl);
      }

      const body: Record<string, any> = { caption: editCaption };
      if (uploaded.length > 0) {
        body.imageUrls = [...post.imageUrls, ...uploaded];
      }

      const res = await fetch(`/api/v1/portfolio/posts/${post.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.success) {
        onUpdate?.(d.data);
        setShowEdit(false);
        setPendingFiles([]);
        setPendingPreviews([]);
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!token) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/portfolio/posts/${post.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) onDelete?.(post.id);
    } catch {
      // silent
    } finally {
      setDeleting(false);
    }
  };

  const handleReplySubmit = async (tagId: string) => {
    if (!token || !replyText.trim()) return;
    setSubmittingReply(true);
    try {
      const res = await fetch(`/api/v1/portfolio/posts/${post.id}/tags/${tagId}/reply`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: replyText.trim() }),
      });
      if (res.ok) {
        const now = new Date().toISOString();
        setLocalTags(prev => prev.map(t =>
          t.id === tagId ? { ...t, vendorReply: replyText.trim(), vendorRepliedAt: now } : t
        ));
        setReplyingToTagId(null);
        setReplyText('');
      }
    } catch {
      // silent
    } finally {
      setSubmittingReply(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white border border-border rounded-md overflow-hidden">

      {/* Image with management hover overlay */}
      <div
        className="relative"
        onMouseEnter={() => managementMode && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {post.imageUrls.length > 0 ? (
          <img
            src={post.imageUrls[0]}
            alt=""
            className="w-full object-cover"
            style={{ background: '#E8E0D4' }}
          />
        ) : (
          <div className="w-full h-36" style={{ background: '#E8E0D4' }} />
        )}

        {managementMode && (
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 flex items-start justify-end gap-1.5 p-2"
                style={{ background: 'rgba(26,23,20,0.2)' }}
              >
                <button
                  onClick={() => { setShowEdit(v => !v); setShowDeleteConfirm(false); }}
                  className="w-7 h-7 rounded-md flex items-center justify-center focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.9)' }}
                  aria-label="Edit"
                >
                  <Pencil size={12} color="#1A1714" />
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(v => !v); setShowEdit(false); }}
                  className="w-7 h-7 rounded-md flex items-center justify-center focus:outline-none font-sans font-semibold"
                  style={{ background: 'rgba(255,255,255,0.9)', fontSize: 14, color: '#1A1714', lineHeight: 1 }}
                  aria-label="Delete"
                >
                  ×
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Inline edit form */}
      <AnimatePresence>
        {showEdit && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 py-3 border-t border-border" style={{ background: '#FAFAF8' }}>
              <textarea
                value={editCaption}
                onChange={e => setEditCaption(e.target.value)}
                maxLength={2000}
                rows={2}
                placeholder="Caption…"
                className="w-full border border-border rounded-md px-3 py-2 font-sans text-xs text-charcoal focus:outline-none resize-none mb-2"
                onFocus={e => e.currentTarget.style.borderColor = '#C4A06A'}
                onBlur={e => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.09)'}
              />

              {/* Existing images (non-removable) */}
              {post.imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {post.imageUrls.map((url, i) => (
                    <div key={i} className="w-14 h-14 rounded-md overflow-hidden border border-border flex-shrink-0">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                  {pendingPreviews.map((url, i) => (
                    <div key={`pending-${i}`} className="w-14 h-14 rounded-md overflow-hidden border border-gold/40 flex-shrink-0">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}

              {/* Add more images */}
              {(post.imageUrls.length + pendingFiles.length) < 10 && (
                <button
                  onClick={() => editFileRef.current?.click()}
                  className="flex items-center gap-1 font-sans text-xs text-muted hover:text-charcoal transition-colors mb-2"
                >
                  <Upload size={11} /> Add images
                </button>
              )}
              <input
                ref={editFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={e => handleEditFiles(e.target.files)}
              />

              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={handleEditSave}
                  disabled={saving}
                  className="font-sans text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-md disabled:opacity-40"
                  style={{ background: '#1A1714', color: '#F5F3EF' }}
                >
                  {saving ? <Loader2 size={11} className="animate-spin inline" /> : 'Save'}
                </button>
                <button
                  onClick={() => { setShowEdit(false); setPendingFiles([]); setPendingPreviews([]); }}
                  className="font-sans text-xs text-muted hover:text-charcoal transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="px-3 py-3 border-t border-border"
            style={{ background: '#FDF5F5' }}
          >
            <p className="font-sans text-xs text-charcoal mb-2">
              Remove this post? This cannot be undone.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="font-sans text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-md disabled:opacity-40"
                style={{ background: '#B84040', color: '#fff' }}
              >
                {deleting ? 'Removing…' : 'Confirm'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="font-sans text-xs text-muted hover:text-charcoal transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card body */}
      <div style={{ padding: '12px 14px' }}>
        {/* Author row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div
              className="rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ width: 26, height: 26, background: 'rgba(196,160,106,0.15)' }}
            >
              {post.author.avatarUrl ? (
                <img src={post.author.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="font-sans font-semibold" style={{ fontSize: 9, color: '#9C7A45' }}>
                  {initials}
                </span>
              )}
            </div>
            <span className="font-sans font-medium" style={{ fontSize: 11, color: '#3A3530' }}>
              {authorName}
            </span>
          </div>
          <span
            className="font-sans uppercase tracking-widest rounded-sm"
            style={{ fontSize: 9, padding: '2px 6px', background: 'rgba(196,160,106,0.1)', color: '#9C7A45' }}
          >
            {post.type === 'VENDOR_POST' ? 'Vendor' : 'Planner'}
          </span>
        </div>

        {/* Caption */}
        {post.caption && (
          <p
            className="mb-2 leading-relaxed"
            style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: 14, color: '#3A3530', lineHeight: 1.5 }}
          >
            {post.caption}
          </p>
        )}

        {/* Tags */}
        {post.type === 'VENDOR_POST' && post.package && (
          <div className="flex flex-wrap gap-1 mb-2">
            <span
              className="font-sans rounded-sm"
              style={{ fontSize: 10, padding: '2px 7px', background: 'rgba(196,160,106,0.12)', color: '#9C7A45' }}
            >
              {post.package.name}
            </span>
          </div>
        )}

        {/* Planner vendor tags with replies */}
        {post.type === 'PLANNER_POST' && localTags.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {localTags.map(tag => (
              <div key={tag.id}>
                <span
                  className="font-sans rounded-sm inline-block"
                  style={{ fontSize: 10, padding: '2px 7px', background: 'rgba(0,0,0,0.05)', color: '#7A7068' }}
                >
                  {tag.provider.businessName}
                </span>

                {/* Vendor reply block */}
                {tag.vendorReply ? (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-1 px-3 py-2 rounded-sm"
                    style={{ background: '#FBF7F0', borderLeft: '2px solid #C4A06A' }}
                  >
                    <p style={{ fontFamily: '"Cormorant Garamond", serif', fontStyle: 'italic', fontSize: 13, color: '#3A3530', lineHeight: 1.4 }}>
                      {tag.vendorReply}
                    </p>
                    <p className="font-sans mt-1" style={{ fontSize: 10, color: '#7A7068' }}>
                      — {tag.provider.businessName}
                      {tag.vendorRepliedAt && ` · ${formatDistanceToNow(new Date(tag.vendorRepliedAt), { addSuffix: true })}`}
                    </p>
                  </motion.div>
                ) : !managementMode && !!currentProviderProfileId && currentProviderProfileId === tag.providerId ? (
                  <div className="mt-1">
                    {replyingToTagId === tag.id ? (
                      <div>
                        <textarea
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          maxLength={500}
                          rows={2}
                          placeholder="Write a reply…"
                          className="w-full border border-border rounded-md px-3 py-1.5 font-sans text-xs text-charcoal focus:outline-none resize-none"
                          onFocus={e => e.currentTarget.style.borderColor = '#C4A06A'}
                          onBlur={e => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.09)'}
                        />
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={() => handleReplySubmit(tag.id)}
                            disabled={submittingReply || !replyText.trim()}
                            className="font-sans uppercase tracking-widest disabled:opacity-40"
                            style={{ fontSize: 10, color: '#C4A06A' }}
                          >
                            {submittingReply ? 'Posting…' : 'Post Reply'}
                          </button>
                          <button
                            onClick={() => { setReplyingToTagId(null); setReplyText(''); }}
                            className="font-sans text-muted"
                            style={{ fontSize: 10 }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setReplyingToTagId(tag.id)}
                        className="font-sans uppercase tracking-widest cursor-pointer"
                        style={{ fontSize: 10, color: '#C4A06A' }}
                      >
                        Reply
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div
          className="flex items-center justify-between"
          style={{ borderTop: '1px solid #F0EDE8', paddingTop: 8 }}
        >
          <div className="flex items-center gap-3">
            {managementMode ? (
              <span className="font-sans" style={{ fontSize: 10, color: '#7A7068' }}>
                {likeCount} likes · {saveCount} saves
              </span>
            ) : (
              <>
                <motion.button
                  whileTap={{ scale: 1.3 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  onClick={handleLike}
                  className="flex items-center gap-1 focus:outline-none"
                  aria-label="Like"
                >
                  <HeartIcon filled={liked} />
                  <span className="font-sans" style={{ fontSize: 10, color: '#7A7068' }}>{likeCount}</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 1.3 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  onClick={handleSave}
                  className="flex items-center gap-1 focus:outline-none"
                  aria-label="Save"
                >
                  <BookmarkIcon filled={saved} />
                  <span className="font-sans" style={{ fontSize: 10, color: '#7A7068' }}>{saveCount}</span>
                </motion.button>
              </>
            )}
          </div>

          {managementMode ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleFeed}
                className="font-sans uppercase tracking-widest transition-all"
                style={sharedToFeed
                  ? { fontSize: 10, background: '#1A1714', color: '#F5F3EF', padding: '3px 10px', borderRadius: 9999 }
                  : { fontSize: 10, border: '1px solid rgba(0,0,0,0.09)', color: '#7A7068', padding: '3px 10px', borderRadius: 9999 }}
              >
                {sharedToFeed ? 'On feed' : 'Not shared'}
              </button>
            </div>
          ) : (
            <span className="font-sans" style={{ fontSize: 10, color: '#B0A89E' }}>
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
