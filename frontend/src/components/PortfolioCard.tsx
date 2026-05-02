import { useState } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PortfolioPostData {
  id: string;
  type: 'VENDOR_POST' | 'PLANNER_POST';
  caption?: string | null;
  imageUrls: string[];
  createdAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
    role: string;
    providerProfile?: { businessName: string; logoUrl?: string | null } | null;
  };
  package?: { id: string; name: string } | null;
  event?: { id: string; name: string } | null;
  vendorTags: {
    id: string;
    providerId: string;
    bookingId: string;
    provider: { businessName: string; logoUrl?: string | null };
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

export default function PortfolioCard({ post, token, onRequireAuth, onSaveChange }: Props) {
  const [liked, setLiked] = useState(post.likedByMe ?? false);
  const [likeCount, setLikeCount] = useState(post._count.likes);
  const [saved, setSaved] = useState(post.savedByMe ?? false);
  const [saveCount, setSaveCount] = useState(post._count.saves);

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

  const isVendor = post.type === 'VENDOR_POST';
  const businessName = post.author.providerProfile?.businessName;
  const authorName = isVendor && businessName
    ? businessName
    : `${post.author.firstName} ${post.author.lastName}`;
  const initials = isVendor && businessName
    ? businessName[0].toUpperCase()
    : `${post.author.firstName[0] ?? ''}${post.author.lastName[0] ?? ''}`.toUpperCase();

  return (
    <div className="bg-white border border-border rounded-md overflow-hidden">
      {/* Image */}
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

      {/* Body */}
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
        {post.type === 'PLANNER_POST' && post.vendorTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {post.vendorTags.map(tag => (
              <span
                key={tag.id}
                className="font-sans rounded-sm"
                style={{ fontSize: 10, padding: '2px 7px', background: 'rgba(0,0,0,0.05)', color: '#7A7068' }}
              >
                {tag.provider.businessName}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div
          className="flex items-center justify-between"
          style={{ borderTop: '1px solid #F0EDE8', paddingTop: 8 }}
        >
          <div className="flex items-center gap-3">
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
          </div>

          <span className="font-sans" style={{ fontSize: 10, color: '#B0A89E' }}>
            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  );
}
