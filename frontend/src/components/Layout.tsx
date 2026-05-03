import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import JessWidget from './JessWidget';
import { useState, useEffect } from 'react';
import {
  Menu,
  X,
  User,
  LogOut,
  LayoutDashboard,
  Search,
  PlusCircle,
  Briefcase,
  Users,
  CalendarCheck,
  FileText,
  CheckCircle,
  Package,
  CalendarX2,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { canAccessPlanner } from '../pages/Planner';

export default function Layout() {
  const { isAuthenticated, user, logout, switchRole } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) return;
    const token = localStorage.getItem('accessToken');

    const fetchUnread = async () => {
      try {
        const res = await fetch('/api/v1/messages/unread-count', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const d = await res.json();
          setUnreadMessages(d?.data?.unreadCount ?? 0);
        }
      } catch {
        // silent
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleLogout = () => {
    logout();
    navigate('/');
    setUserMenuOpen(false);
  };

  const handleSwitchRole = async (role: 'CLIENT' | 'PROVIDER') => {
    if (user?.role === role) return;
    setIsSwitching(true);
    try {
      await switchRole(role);
      setUserMenuOpen(false);
      navigate(role === 'PROVIDER' ? '/provider/dashboard' : '/dashboard');
    } catch (err) {
      console.error('Failed to switch role:', err);
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F5F3EF' }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="bg-white sticky top-0 z-50 border-b border-border">
        <nav className="section-padding">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <Link to="/" className="flex items-center">
              <span className="font-serif text-2xl tracking-widest text-dark">
                FEST<span className="text-gold">V</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6">
              <Link
                to="/providers"
                className="flex items-center gap-1.5 text-xs font-sans font-medium uppercase tracking-widest text-charcoal hover:text-gold transition-colors duration-200"
              >
                <Search className="w-3.5 h-3.5" />
                Browse Vendors
              </Link>

              <Link
                to="/feed"
                className="flex items-center gap-1.5 text-xs font-sans font-medium uppercase tracking-widest text-charcoal hover:text-gold transition-colors duration-200"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Feed
              </Link>

              {isAuthenticated ? (
                <>
                  <Link
                    to="/messages"
                    className="relative flex items-center gap-1.5 text-xs font-sans font-medium uppercase tracking-widest text-charcoal hover:text-gold transition-colors duration-200"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Messages
                    {unreadMessages > 0 && (
                      <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-gold" />
                    )}
                  </Link>

                  {user?.role === 'CLIENT' && (
                    <Link
                      to="/providers"
                      className="flex items-center gap-1.5 text-xs font-sans font-medium uppercase tracking-widest text-charcoal hover:text-gold transition-colors duration-200"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      New Request
                    </Link>
                  )}

                  {canAccessPlanner(user?.email) && (
                    <>
                      <Link
                        to="/planner"
                        className="text-xs font-sans font-medium uppercase tracking-widest text-gold hover:text-gold-dark transition-colors duration-200"
                      >
                        Planner
                      </Link>
                      <Link
                        to="/database"
                        className="text-xs font-sans font-medium uppercase tracking-widest text-gold hover:text-gold-dark transition-colors duration-200"
                      >
                        Database
                      </Link>
                    </>
                  )}

                  {/* User dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="flex items-center gap-2 px-3 py-2 rounded-full transition-colors"
                      style={{ backgroundColor: 'rgba(196,160,106,0.08)' }}
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                        {user?.avatarUrl ? (
                          <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gold flex items-center justify-center">
                            <span className="text-dark font-semibold text-sm font-sans">
                              {user?.firstName?.[0]}{user?.lastName?.[0]}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="font-sans font-medium text-sm text-charcoal">
                        {user?.firstName}
                      </span>
                    </button>

                    {userMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                        <div
                          className="absolute right-0 mt-2 w-60 bg-white rounded-2xl py-2 z-20 animate-slide-up"
                          style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }}
                        >
                          {/* User info */}
                          <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                            <p className="font-sans font-semibold text-sm text-dark">
                              {user?.firstName} {user?.lastName}
                            </p>
                            <p className="font-sans text-xs text-muted mt-0.5">{user?.email}</p>
                            <p className="font-sans text-xs text-gold mt-1 flex items-center gap-1">
                              {user?.role === 'PROVIDER' ? (
                                <><Briefcase className="w-3 h-3" /> Provider Mode</>
                              ) : (
                                <><Users className="w-3 h-3" /> Client Mode</>
                              )}
                            </p>
                          </div>

                          {/* Role switcher */}
                          {user?.roles && user.roles.length > 1 ? (
                            <div className="px-2 py-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                              <p className="px-2 text-xs font-sans font-medium text-muted uppercase tracking-widest mb-2">
                                Switch Mode
                              </p>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleSwitchRole('CLIENT')}
                                  disabled={isSwitching || user.role === 'CLIENT'}
                                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-sans font-medium transition-colors"
                                  style={user.role === 'CLIENT'
                                    ? { backgroundColor: 'rgba(196,160,106,0.12)', color: '#9C7A45' }
                                    : { color: '#7A7068' }}
                                >
                                  <Users className="w-3.5 h-3.5" />Client
                                </button>
                                <button
                                  onClick={() => handleSwitchRole('PROVIDER')}
                                  disabled={isSwitching || user.role === 'PROVIDER'}
                                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-sans font-medium transition-colors"
                                  style={user.role === 'PROVIDER'
                                    ? { backgroundColor: 'rgba(196,160,106,0.12)', color: '#9C7A45' }
                                    : { color: '#7A7068' }}
                                >
                                  <Briefcase className="w-3.5 h-3.5" />Provider
                                </button>
                              </div>
                            </div>
                          ) : !user?.roles?.includes('PROVIDER') ? (
                            <div className="px-2 py-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                              <Link
                                to="/become-provider"
                                onClick={() => setUserMenuOpen(false)}
                                className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm font-sans font-medium text-gold transition-colors hover:bg-gold/5"
                              >
                                <Briefcase className="w-4 h-4" />
                                Become a Vendor
                              </Link>
                            </div>
                          ) : null}

                          {/* Dashboard */}
                          <Link
                            to={user?.role === 'PROVIDER' ? '/provider/dashboard' : '/dashboard'}
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm font-sans text-charcoal hover:text-gold hover:bg-gold/5 transition-colors"
                          >
                            <LayoutDashboard className="w-4 h-4" />
                            Dashboard
                          </Link>

                          {/* Provider links */}
                          {user?.role === 'PROVIDER' && (
                            <>
                              <Link
                                to="/vendor/packages"
                                onClick={() => setUserMenuOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm font-sans text-charcoal hover:text-gold hover:bg-gold/5 transition-colors"
                              >
                                <Package className="w-4 h-4" />
                                Packages
                              </Link>
                              <Link
                                to="/vendor/availability"
                                onClick={() => setUserMenuOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm font-sans text-charcoal hover:text-gold hover:bg-gold/5 transition-colors"
                              >
                                <CalendarX2 className="w-4 h-4" />
                                Availability
                              </Link>
                              <Link
                                to="/provider/bookings"
                                onClick={() => setUserMenuOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm font-sans text-charcoal hover:text-gold hover:bg-gold/5 transition-colors"
                              >
                                <CalendarCheck className="w-4 h-4" />
                                Bookings
                              </Link>
                              <Link
                                to="/provider/quotes"
                                onClick={() => setUserMenuOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm font-sans text-charcoal hover:text-gold hover:bg-gold/5 transition-colors"
                              >
                                <FileText className="w-4 h-4" />
                                Quotes
                              </Link>
                            </>
                          )}

                          {/* Client links */}
                          {user?.role === 'CLIENT' && (
                            <>
                              <Link
                                to="/event-requests"
                                onClick={() => setUserMenuOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm font-sans text-charcoal hover:text-gold hover:bg-gold/5 transition-colors"
                              >
                                <FileText className="w-4 h-4" />
                                My Requests
                              </Link>
                              <Link
                                to="/bookings"
                                onClick={() => setUserMenuOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm font-sans text-charcoal hover:text-gold hover:bg-gold/5 transition-colors"
                              >
                                <CalendarCheck className="w-4 h-4" />
                                My Bookings
                              </Link>
                            </>
                          )}

                          <Link
                            to="/profile"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm font-sans text-charcoal hover:text-gold hover:bg-gold/5 transition-colors"
                          >
                            <User className="w-4 h-4" />
                            My Profile
                          </Link>

                          {/* Verification status */}
                          {user?.emailVerified === false ? (
                            <Link
                              to="/account/verify"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm font-sans text-amber-600 hover:bg-amber-50 transition-colors"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Verify Account
                            </Link>
                          ) : (
                            <div className="flex items-center gap-3 px-4 py-2.5 text-sm font-sans" style={{ color: '#3A8A55' }}>
                              <CheckCircle className="w-4 h-4" />
                              Verified ✓
                            </div>
                          )}

                          {/* Admin links */}
                          {canAccessPlanner(user?.email) && (
                            <Link
                              to="/admin/providers"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm font-sans text-gold hover:bg-gold/5 transition-colors"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Admin: Verify Vendors
                            </Link>
                          )}

                          <hr style={{ borderColor: 'rgba(0,0,0,0.06)', margin: '4px 0' }} />
                          <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm font-sans w-full transition-colors hover:bg-red-50"
                            style={{ color: '#B84040' }}
                          >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-xs font-sans font-medium uppercase tracking-widest text-charcoal hover:text-gold transition-colors duration-200"
                  >
                    Sign In
                  </Link>
                  <Link to="/register" className="btn-primary text-xs uppercase tracking-widest">
                    Get Started
                  </Link>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg transition-colors hover:bg-gold/5"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen
                ? <X className="w-6 h-6 text-charcoal" />
                : <Menu className="w-6 h-6 text-charcoal" />}
            </button>
          </div>

          {/* ── Mobile Navigation ──────────────────────────────────────────── */}
          {mobileMenuOpen && (
            <div
              className="md:hidden py-4 animate-slide-up"
              style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
            >
              <div className="flex flex-col gap-1">
                <Link
                  to="/providers"
                  className="px-4 py-3 rounded-lg text-sm font-sans text-charcoal hover:text-gold hover:bg-gold/5 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Browse Vendors
                </Link>

                <Link
                  to="/feed"
                  className="px-4 py-3 rounded-lg text-sm font-sans text-charcoal hover:text-gold hover:bg-gold/5 transition-colors flex items-center gap-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Sparkles className="w-4 h-4" />
                  Feed
                </Link>

                {isAuthenticated ? (
                  <>
                    <Link
                      to={user?.role === 'PROVIDER' ? '/provider/dashboard' : '/dashboard'}
                      className="px-4 py-3 rounded-lg text-sm font-sans text-charcoal hover:text-gold hover:bg-gold/5 transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Dashboard
                    </Link>

                    <Link
                      to="/messages"
                      className="px-4 py-3 rounded-lg text-sm font-sans text-charcoal hover:text-gold hover:bg-gold/5 transition-colors flex items-center gap-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <MessageSquare className="w-4 h-4" />
                      Messages
                      {unreadMessages > 0 && (
                        <span className="ml-auto w-2 h-2 rounded-full bg-gold" />
                      )}
                    </Link>

                    {/* Provider mobile links */}
                    {user?.role === 'PROVIDER' && (
                      <>
                        <Link
                          to="/vendor/packages"
                          className="px-4 py-3 rounded-lg text-sm font-sans text-charcoal hover:text-gold hover:bg-gold/5 transition-colors flex items-center gap-2"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Package className="w-4 h-4" />
                          Packages
                        </Link>
                        <Link
                          to="/vendor/availability"
                          className="px-4 py-3 rounded-lg text-sm font-sans text-charcoal hover:text-gold hover:bg-gold/5 transition-colors flex items-center gap-2"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <CalendarX2 className="w-4 h-4" />
                          Availability
                        </Link>
                        <Link
                          to="/provider/bookings"
                          className="px-4 py-3 rounded-lg text-sm font-sans text-charcoal hover:text-gold hover:bg-gold/5 transition-colors flex items-center gap-2"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <CalendarCheck className="w-4 h-4" />
                          Bookings
                        </Link>
                        <Link
                          to="/provider/quotes"
                          className="px-4 py-3 rounded-lg text-sm font-sans text-charcoal hover:text-gold hover:bg-gold/5 transition-colors flex items-center gap-2"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <FileText className="w-4 h-4" />
                          Quotes
                        </Link>
                      </>
                    )}

                    {/* Client mobile links */}
                    {user?.role === 'CLIENT' && (
                      <>
                        <Link
                          to="/providers"
                          className="px-4 py-3 rounded-lg text-sm font-sans text-charcoal hover:text-gold hover:bg-gold/5 transition-colors flex items-center gap-2"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <PlusCircle className="w-4 h-4" />
                          New Request
                        </Link>
                        <Link
                          to="/event-requests"
                          className="px-4 py-3 rounded-lg text-sm font-sans text-charcoal hover:text-gold hover:bg-gold/5 transition-colors flex items-center gap-2"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <FileText className="w-4 h-4" />
                          My Requests
                        </Link>
                        <Link
                          to="/bookings"
                          className="px-4 py-3 rounded-lg text-sm font-sans text-charcoal hover:text-gold hover:bg-gold/5 transition-colors flex items-center gap-2"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <CalendarCheck className="w-4 h-4" />
                          My Bookings
                        </Link>
                      </>
                    )}

                    <Link
                      to="/profile"
                      className="px-4 py-3 rounded-lg text-sm font-sans text-charcoal hover:text-gold hover:bg-gold/5 transition-colors flex items-center gap-3"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                        {user?.avatarUrl ? (
                          <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gold flex items-center justify-center">
                            <span className="text-dark font-semibold text-xs font-sans">
                              {user?.firstName?.[0]}{user?.lastName?.[0]}
                            </span>
                          </div>
                        )}
                      </div>
                      My Profile
                    </Link>

                    {/* Verification status */}
                    {user?.emailVerified === false ? (
                      <Link
                        to="/account/verify"
                        className="px-4 py-3 rounded-lg text-sm font-sans text-amber-600 hover:bg-amber-50 transition-colors flex items-center gap-2"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <CheckCircle className="w-4 h-4" />
                        Verify Account
                      </Link>
                    ) : (
                      <div className="px-4 py-3 flex items-center gap-2 text-sm font-sans" style={{ color: '#3A8A55' }}>
                        <CheckCircle className="w-4 h-4" />
                        Verified ✓
                      </div>
                    )}

                    {/* Role switch / become provider */}
                    {user?.roles && user.roles.length > 1 ? (
                      <div className="px-4 py-2">
                        <p className="text-xs font-sans font-medium text-muted uppercase tracking-widest mb-2">
                          Switch Mode
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { handleSwitchRole('CLIENT'); setMobileMenuOpen(false); }}
                            disabled={user.role === 'CLIENT'}
                            className="flex-1 py-2 rounded-lg text-sm font-sans font-medium transition-colors"
                            style={user.role === 'CLIENT'
                              ? { backgroundColor: 'rgba(196,160,106,0.12)', color: '#9C7A45' }
                              : { backgroundColor: 'rgba(0,0,0,0.04)', color: '#7A7068' }}
                          >
                            Client
                          </button>
                          <button
                            onClick={() => { handleSwitchRole('PROVIDER'); setMobileMenuOpen(false); }}
                            disabled={user.role === 'PROVIDER'}
                            className="flex-1 py-2 rounded-lg text-sm font-sans font-medium transition-colors"
                            style={user.role === 'PROVIDER'
                              ? { backgroundColor: 'rgba(196,160,106,0.12)', color: '#9C7A45' }
                              : { backgroundColor: 'rgba(0,0,0,0.04)', color: '#7A7068' }}
                          >
                            Provider
                          </button>
                        </div>
                      </div>
                    ) : !user?.roles?.includes('PROVIDER') ? (
                      <Link
                        to="/become-provider"
                        className="px-4 py-3 rounded-lg text-sm font-sans text-gold hover:bg-gold/5 transition-colors flex items-center gap-2"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Briefcase className="w-4 h-4" />
                        Become a Vendor
                      </Link>
                    ) : null}

                    {/* Dev/admin links */}
                    {canAccessPlanner(user?.email) && (
                      <>
                        <Link
                          to="/planner"
                          className="px-4 py-3 rounded-lg text-sm font-sans text-gold hover:bg-gold/5 transition-colors flex items-center gap-2"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <LayoutDashboard className="w-4 h-4" />
                          Planner
                        </Link>
                        <Link
                          to="/database"
                          className="px-4 py-3 rounded-lg text-sm font-sans text-gold hover:bg-gold/5 transition-colors flex items-center gap-2"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Search className="w-4 h-4" />
                          Database
                        </Link>
                        <Link
                          to="/admin/providers"
                          className="px-4 py-3 rounded-lg text-sm font-sans text-gold hover:bg-gold/5 transition-colors flex items-center gap-2"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <CheckCircle className="w-4 h-4" />
                          Admin: Verify Vendors
                        </Link>
                      </>
                    )}

                    <button
                      onClick={handleLogout}
                      className="px-4 py-3 rounded-lg text-sm font-sans text-left transition-colors hover:bg-red-50"
                      style={{ color: '#B84040' }}
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className="px-4 py-3 rounded-lg text-sm font-sans text-charcoal hover:text-gold hover:bg-gold/5 transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/register"
                      className="btn-primary mx-4 text-xs uppercase tracking-widest"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="bg-dark text-white py-16">
        <div className="section-padding">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">

            {/* Brand */}
            <div>
              <span className="font-serif text-2xl tracking-widest text-white block mb-3">
                FEST<span className="text-gold">V</span>
              </span>
              <p className="text-sm font-sans text-muted leading-relaxed">
                The luxury event planning marketplace.
              </p>
            </div>

            {/* For Clients */}
            <div>
              <h4 className="font-sans font-semibold text-xs uppercase tracking-widest text-white mb-4">
                For Clients
              </h4>
              <ul className="space-y-2 text-sm font-sans">
                <li>
                  <Link to="/providers" className="text-muted hover:text-gold transition-colors">
                    Find Vendors
                  </Link>
                </li>
                <li>
                  <Link to="/events/new" className="text-muted hover:text-gold transition-colors">
                    Plan an Event
                  </Link>
                </li>
                <li>
                  <Link to="/" className="text-muted hover:text-gold transition-colors">
                    How It Works
                  </Link>
                </li>
              </ul>
            </div>

            {/* For Vendors */}
            <div>
              <h4 className="font-sans font-semibold text-xs uppercase tracking-widest text-white mb-4">
                For Vendors
              </h4>
              <ul className="space-y-2 text-sm font-sans">
                <li>
                  <Link to="/register?role=PROVIDER" className="text-muted hover:text-gold transition-colors">
                    Join as Vendor
                  </Link>
                </li>
                <li>
                  <Link to="/vendor/setup" className="text-muted hover:text-gold transition-colors">
                    Setup Your Profile
                  </Link>
                </li>
              </ul>
            </div>

            {/* Admin — only shown to admin users */}
            {canAccessPlanner(user?.email) && (
              <div>
                <h4 className="font-sans font-semibold text-xs uppercase tracking-widest text-white mb-4">
                  Admin
                </h4>
                <ul className="space-y-2 text-sm font-sans">
                  <li>
                    <Link to="/admin/providers" className="text-muted hover:text-gold transition-colors">
                      Verify Vendors
                    </Link>
                  </li>
                </ul>
              </div>
            )}
          </div>

          <div className="mt-12 pt-8 text-sm font-sans text-muted flex flex-col sm:flex-row items-center justify-between gap-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <p>© 2026 FESTV. All rights reserved.</p>
            <div className="flex gap-6 flex-wrap justify-center">
              <Link to="/legal/terms" className="text-[10px] uppercase tracking-widest text-[#7A7068] hover:text-[#C4A06A] transition-colors">Terms</Link>
              <Link to="/legal/privacy" className="text-[10px] uppercase tracking-widest text-[#7A7068] hover:text-[#C4A06A] transition-colors">Privacy</Link>
              <Link to="/legal/vendor-agreement" className="text-[10px] uppercase tracking-widest text-[#7A7068] hover:text-[#C4A06A] transition-colors">Vendor Agreement</Link>
              <Link to="/legal/cancellation" className="text-[10px] uppercase tracking-widest text-[#7A7068] hover:text-[#C4A06A] transition-colors">Cancellation Policy</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* ── Jess AI Widget ────────────────────────────────────────────────── */}
      <JessWidget />
    </div>
  );
}
