import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import PortfolioCard, { type PortfolioPostData } from '../components/PortfolioCard';
import PostComposer from '../components/PostComposer';

// ─── Filter config ─────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'venues' | 'florals' | 'photography' | 'entertainment' | 'catering' | 'saved';

const FILTERS: { key: FilterKey; label: string; authRequired?: boolean }[] = [
  { key: 'all',           label: 'All' },
  { key: 'venues',        label: 'Venues' },
  { key: 'florals',       label: 'Florals' },
  { key: 'photography',   label: 'Photography' },
  { key: 'entertainment', label: 'Entertainment' },
  { key: 'catering',      label: 'Catering' },
  { key: 'saved',         label: 'Saved', authRequired: true },
];

// ─── Stagger variants ──────────────────────────────────────────────────────────

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0 },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const { isAuthenticated, token } = useAuth();

  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [posts, setPosts] = useState<PortfolioPostData[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [authToast, setAuthToast] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchFeed = useCallback(async (filter: FilterKey, pageNum: number, append = false) => {
    if (!token) { setLoading(false); return; }

    if (!append) setLoading(true); else setLoadingMore(true);

    try {
      const url = filter === 'saved'
        ? `/api/v1/portfolio/saved`
        : `/api/v1/portfolio/feed?page=${pageNum}&limit=20`;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { setLoading(false); setLoadingMore(false); return; }

      const d = await res.json();
      const incoming: PortfolioPostData[] = d?.data?.posts ?? [];
      const total: number = d?.data?.pagination?.total ?? incoming.length;

      if (append) {
        setPosts(prev => [...prev, ...incoming]);
      } else {
        setPosts(incoming);
      }

      setHasMore(filter !== 'saved' && pageNum * 20 < total);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [token]);

  useEffect(() => {
    setPage(1);
    fetchFeed(activeFilter, 1, false);
  }, [activeFilter, fetchFeed]);

  const handleLoadMore = async () => {
    const next = page + 1;
    setPage(next);
    await fetchFeed(activeFilter, next, true);
  };

  // ── New post prepended ─────────────────────────────────────────────────────

  const handlePosted = (post: PortfolioPostData) => {
    setPosts(prev => [post, ...prev]);
  };

  // ── Auth toast ─────────────────────────────────────────────────────────────

  const showAuthToast = () => {
    setAuthToast(true);
    setTimeout(() => setAuthToast(false), 3000);
  };

  // ── Filter switch ──────────────────────────────────────────────────────────

  const handleFilterClick = (key: FilterKey) => {
    if (key === 'saved' && !isAuthenticated) { showAuthToast(); return; }
    setActiveFilter(key);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: '#F5F3EF' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: 32, fontWeight: 300, color: '#1A1714', margin: 0 }}>
            Inspiration Feed
          </h1>
          {isAuthenticated && (
            <button
              onClick={() => setComposerOpen(true)}
              className="font-sans rounded-sm transition-opacity hover:opacity-80"
              style={{ background: '#1A1714', color: '#F5F3EF', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '8px 16px' }}
            >
              + Share Work
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-6 mb-8 border-b border-border overflow-x-auto">
          {FILTERS.filter(f => !f.authRequired || isAuthenticated).map(f => {
            const active = f.key === activeFilter;
            return (
              <button
                key={f.key}
                onClick={() => handleFilterClick(f.key as FilterKey)}
                className="font-sans pb-3 flex-shrink-0 transition-colors focus:outline-none"
                style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: active ? '#1A1714' : '#7A7068',
                  borderBottom: active ? '2px solid #C4A06A' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* No auth prompt for feed */}
        {!isAuthenticated && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="font-sans text-sm text-muted mb-4">Sign in to explore the inspiration feed.</p>
            <Link
              to="/login"
              className="font-sans text-xs font-bold uppercase tracking-widest px-6 py-2.5 rounded-md transition-colors"
              style={{ background: '#1A1714', color: '#F5F3EF' }}
            >
              Sign In
            </Link>
          </div>
        )}

        {/* Feed grid */}
        {isAuthenticated && (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeFilter}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {loading ? (
                <div className="columns-2 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="break-inside-avoid mb-4 bg-white border border-border rounded-md overflow-hidden animate-pulse">
                      <div style={{ height: i % 3 === 0 ? 200 : 140, background: '#E8E0D4' }} />
                      <div className="p-3.5 space-y-2">
                        <div className="h-3 bg-bg rounded w-1/2" />
                        <div className="h-3 bg-bg rounded w-3/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <p style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: 20, fontStyle: 'italic', color: '#7A7068' }}>
                    {activeFilter === 'saved' ? 'Posts you save will appear here.' : 'No posts yet. Be the first to share.'}
                  </p>
                </div>
              ) : (
                <>
                  <motion.div
                    className="columns-2 gap-4"
                    variants={gridVariants}
                    initial="hidden"
                    animate="show"
                  >
                    <AnimatePresence>
                      {posts.map(post => (
                        <motion.div
                          key={post.id}
                          className="break-inside-avoid mb-4"
                          variants={cardVariants}
                          transition={{ duration: 0.3 }}
                          initial={{ opacity: 0, y: -20 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <PortfolioCard
                            post={post}
                            token={token}
                            onRequireAuth={showAuthToast}
                            onSaveChange={(id, saved) => {
                              if (activeFilter === 'saved' && !saved) {
                                setPosts(prev => prev.filter(p => p.id !== id));
                              }
                            }}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </motion.div>

                  {hasMore && (
                    <div className="flex justify-center mt-8">
                      <button
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="font-sans text-xs uppercase tracking-widest px-6 py-2.5 border border-border rounded-md text-muted hover:border-gold hover:text-charcoal transition-colors disabled:opacity-40"
                      >
                        {loadingMore ? 'Loading…' : 'Load More'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Auth toast */}
      <AnimatePresence>
        {authToast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 font-sans text-xs px-4 py-2.5 rounded-md shadow-sm"
            style={{ background: '#1A1714', color: '#F5F3EF', whiteSpace: 'nowrap' }}
          >
            Sign in to interact with posts
          </motion.div>
        )}
      </AnimatePresence>

      {/* Post composer modal */}
      {composerOpen && (
        <PostComposer
          onClose={() => setComposerOpen(false)}
          onPosted={handlePosted}
        />
      )}
    </div>
  );
}
