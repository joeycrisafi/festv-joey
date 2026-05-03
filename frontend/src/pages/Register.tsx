import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Calendar, Store, Check } from 'lucide-react';
import { providerTypeConfig } from '../components/ProviderTypeBadge';

// ── Password strength helpers ─────────────────────────────────────────────────
const checks = [
  { label: 'Uppercase letter',  test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter',  test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number',            test: (p: string) => /[0-9]/.test(p) },
];

export default function Register() {
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role') === 'provider' ? 'PROVIDER' : 'CLIENT';

  const [role, setRole]                       = useState<'CLIENT' | 'PROVIDER'>(initialRole);
  const [vendorType, setVendorType]           = useState('');
  const [firstName, setFirstName]             = useState('');
  const [lastName, setLastName]               = useState('');
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]       = useState(false);
  const [error, setError]                     = useState('');
  const [isLoading, setIsLoading]             = useState(false);

  // Email verification state
  const [emailSent, setEmailSent]             = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resendSent, setResendSent]           = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName, lastName, role, roles: [role] }),
      });
      const data = await res.json();

      if (data.success) {
        setRegisteredEmail(email);
        setEmailSent(true);
      } else {
        setError(data.message || data.error || 'Registration failed');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await fetch('/api/v1/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registeredEmail }),
      });
      setResendSent(true);
      setTimeout(() => setResendSent(false), 3000);
    } catch {
      // silent
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Card */}
        <div className="bg-white border border-border rounded-md p-10">

          {/* Wordmark */}
          <p className="font-serif text-2xl tracking-widest text-dark text-center">
            FEST<span className="text-gold">V</span>
          </p>

          {/* Gold rule */}
          <div className="w-8 border-t border-gold mx-auto my-6" />

          {/* ── Email sent state ──────────────────────────────────────────── */}
          {emailSent ? (
            <div className="text-center py-6 px-2">
              <div className="w-12 h-12 rounded-full bg-[#FBF7F0] border border-[rgba(196,160,106,0.3)] flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C4A06A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <h2 className="font-serif text-[24px] font-light text-[#1A1714] mb-2">Check your inbox</h2>
              <p className="text-[13px] text-[#7A7068] mb-1">We sent a verification link to</p>
              <p className="text-[13px] font-medium text-[#1A1714] mb-6">{registeredEmail}</p>
              <p className="text-[11px] text-[#B0A89E] mb-4">
                Click the link in the email to activate your account. It expires in 24 hours.
              </p>
              {resendSent ? (
                <p className="text-[11px] text-[#3A8A55] uppercase tracking-widest">Sent!</p>
              ) : (
                <button
                  onClick={handleResend}
                  className="text-[11px] uppercase tracking-widest text-[#C4A06A] hover:text-[#9A7A4A] transition-colors"
                >
                  Resend verification email
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Heading */}
              <h1 className="font-serif text-3xl text-dark font-light text-center">
                Join FESTV
              </h1>
              <p className="font-sans text-sm text-muted text-center mt-2">
                Create your account to start planning
              </p>

              {/* ── Role selector ──────────────────────────────────────────────── */}
              <div className="mt-8 grid grid-cols-2 gap-3">

                {/* Event Planner */}
                <button
                  type="button"
                  onClick={() => setRole('CLIENT')}
                  className={`rounded-md p-4 cursor-pointer text-center transition-all duration-150 focus:outline-none ${
                    role === 'CLIENT'
                      ? 'border-2 border-gold bg-gold/5'
                      : 'border border-border hover:border-gold/50'
                  }`}
                >
                  <Calendar size={24} strokeWidth={1.5} className="text-gold mx-auto" />
                  <p className="font-sans text-sm font-semibold text-dark mt-2">Event Planner</p>
                  <p className="font-sans text-xs text-muted mt-1">Find vendors for my events</p>
                </button>

                {/* Vendor */}
                <button
                  type="button"
                  onClick={() => setRole('PROVIDER')}
                  className={`rounded-md p-4 cursor-pointer text-center transition-all duration-150 focus:outline-none ${
                    role === 'PROVIDER'
                      ? 'border-2 border-gold bg-gold/5'
                      : 'border border-border hover:border-gold/50'
                  }`}
                >
                  <Store size={24} strokeWidth={1.5} className="text-gold mx-auto" />
                  <p className="font-sans text-sm font-semibold text-dark mt-2">Vendor</p>
                  <p className="font-sans text-xs text-muted mt-1">List my business on FESTV</p>
                </button>

              </div>

              {/* ── Vendor type pills (PROVIDER only) ─────────────────────────── */}
              {role === 'PROVIDER' && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {providerTypeConfig.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setVendorType(vendorType === t.value ? '' : t.value)}
                      className={`font-sans text-xs px-3 py-1.5 rounded-full transition-colors duration-150 focus:outline-none ${
                        vendorType === t.value
                          ? 'bg-gold text-dark font-semibold'
                          : 'border border-border text-charcoal hover:border-gold'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mt-6 bg-red/10 border border-red/30 text-red text-sm font-sans rounded-md px-4 py-3">
                  {error}
                </div>
              )}

              {/* ── Form ──────────────────────────────────────────────────────── */}
              <form onSubmit={handleSubmit} className="mt-6 space-y-5">

                {/* First + Last name */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-sans text-xs font-bold uppercase tracking-widest text-charcoal mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="Jane"
                      required
                      className="w-full border border-border rounded-md px-4 py-3 text-sm font-sans text-dark focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block font-sans text-xs font-bold uppercase tracking-widest text-charcoal mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      placeholder="Doe"
                      required
                      className="w-full border border-border rounded-md px-4 py-3 text-sm font-sans text-dark focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block font-sans text-xs font-bold uppercase tracking-widest text-charcoal mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full border border-border rounded-md px-4 py-3 text-sm font-sans text-dark focus:outline-none focus:border-gold transition-colors"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block font-sans text-xs font-bold uppercase tracking-widest text-charcoal mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      required
                      className="w-full border border-border rounded-md px-4 py-3 pr-11 text-sm font-sans text-dark focus:outline-none focus:border-gold transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-charcoal transition-colors focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                    </button>
                  </div>

                  {/* Strength indicator — only shown once typing starts */}
                  {password.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {checks.map(c => {
                        const ok = c.test(password);
                        return (
                          <div key={c.label} className="flex items-center gap-2">
                            <span className={`flex-shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors ${
                              ok ? 'bg-green/20' : 'bg-border'
                            }`}>
                              {ok && <Check size={9} strokeWidth={2.5} className="text-green" />}
                            </span>
                            <span className={`font-sans text-xs transition-colors ${ok ? 'text-green' : 'text-muted'}`}>
                              {c.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block font-sans text-xs font-bold uppercase tracking-widest text-charcoal mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      required
                      className="w-full border border-border rounded-md px-4 py-3 pr-11 text-sm font-sans text-dark focus:outline-none focus:border-gold transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-charcoal transition-colors focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                    </button>
                  </div>
                </div>

                {/* Terms */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    className="w-4 h-4 mt-0.5 accent-gold cursor-pointer flex-shrink-0"
                  />
                  <span className="font-sans text-sm text-muted">
                    I agree to the{' '}
                    <Link to="/terms" className="text-gold hover:text-gold-dark transition-colors">
                      Terms of Service
                    </Link>
                    {' '}and{' '}
                    <Link to="/privacy" className="text-gold hover:text-gold-dark transition-colors">
                      Privacy Policy
                    </Link>
                  </span>
                </label>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gold text-dark py-3 text-xs tracking-widest uppercase font-sans font-bold hover:bg-gold-dark transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-dark/30 border-t-dark rounded-full animate-spin" />
                      Creating account…
                    </span>
                  ) : (
                    'Create Account'
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="border-t border-border" />
                <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-white px-3 text-xs text-muted font-sans">
                  or
                </span>
              </div>

              {/* Sign in link */}
              <p className="font-sans text-sm text-muted text-center">
                Already have an account?{' '}
                <Link to="/login" className="text-gold hover:text-gold-dark transition-colors">
                  Sign in
                </Link>
              </p>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
