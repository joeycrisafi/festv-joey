import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import TestAccountsPicker from '../components/TestAccountsPicker';

export default function Login() {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');
  const [isLoading, setIsLoading]       = useState(false);
  const { login, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const destination = user.role === 'PROVIDER' ? '/provider/dashboard' : '/dashboard';
      navigate(destination, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleResendFromLogin = async () => {
    try {
      await fetch('/api/v1/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // silent
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      // Navigation is handled by App.tsx based on user role
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center px-4">
      <div className="w-full max-w-md mt-20">

        {/* Card */}
        <div className="bg-white border border-border rounded-md p-10">

          {/* Wordmark */}
          <p className="font-serif text-2xl tracking-widest text-dark text-center">
            FEST<span className="text-gold">V</span>
          </p>

          {/* Gold rule */}
          <div className="w-8 border-t border-gold mx-auto my-6" />

          {/* Heading */}
          <h1 className="font-serif text-3xl text-dark font-light text-center">
            Welcome back
          </h1>
          <p className="font-sans text-sm text-muted text-center mt-2">
            Sign in to your FESTV account
          </p>

          {/* Error */}
          {error && (
            <div className="mt-6 bg-red/10 border border-red/30 text-red text-sm font-sans rounded-md px-4 py-3">
              {error}
              {error.toLowerCase().includes('verify') && (
                <button
                  onClick={handleResendFromLogin}
                  className="block mx-auto mt-2 text-[11px] uppercase tracking-widest text-[#C4A06A] hover:text-[#9A7A4A] transition-colors"
                >
                  Resend verification email
                </button>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">

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
                  placeholder="Enter your password"
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
              <Link
                to="/forgot-password"
                className="text-xs text-gold font-sans hover:text-gold-dark transition-colors block text-right mt-1"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gold text-dark py-3 text-xs tracking-widest uppercase font-sans font-bold hover:bg-gold-dark transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-dark/30 border-t-dark rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                'Sign In'
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

          {/* Register link */}
          <p className="font-sans text-sm text-muted text-center">
            Don't have an account?{' '}
            <Link to="/register" className="text-gold hover:text-gold-dark transition-colors">
              Get started
            </Link>
          </p>

        </div>

        {/* Test accounts picker (preserved) */}
        <TestAccountsPicker
          onSelect={(e, p) => {
            setEmail(e);
            setPassword(p);
          }}
        />

      </div>
    </div>
  );
}
