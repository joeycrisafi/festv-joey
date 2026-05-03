import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setErrorMessage('Invalid verification link.');
      return;
    }

    fetch(`/api/v1/auth/verify-email?token=${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          localStorage.setItem('accessToken', data.data.accessToken);
          localStorage.setItem('refreshToken', data.data.refreshToken);
          setStatus('success');
          // Full page replace so AuthContext re-initializes from localStorage
          setTimeout(() => {
            const role = data.data.user.role;
            window.location.replace(role === 'PROVIDER' ? '/provider/dashboard' : '/dashboard');
          }, 2000);
        } else {
          setStatus('error');
          setErrorMessage(data.error ?? data.message ?? 'Verification failed.');
        }
      })
      .catch(() => {
        setStatus('error');
        setErrorMessage('Something went wrong. Please try again.');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F3EF] flex items-center justify-center px-4">
      <div className="bg-white border border-border rounded-md p-10 max-w-md w-full text-center">

        {status === 'loading' && (
          <>
            <div className="w-8 h-8 border-2 border-[#C4A06A] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="font-serif italic text-[16px] text-[#7A7068]">Verifying your email…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-12 h-12 rounded-full bg-[#EAF3DE] flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B6D11" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="font-serif text-[24px] font-light text-[#1A1714] mb-2">Email verified</h2>
            <p className="text-[13px] text-[#7A7068]">Your account is active. Taking you to your dashboard…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-12 h-12 rounded-full bg-[#FCEBEB] flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A32D2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 className="font-serif text-[24px] font-light text-[#1A1714] mb-2">Verification failed</h2>
            <p className="text-[13px] text-[#7A7068] mb-6">{errorMessage}</p>
            <a
              href="/register"
              className="text-[11px] uppercase tracking-widest text-[#C4A06A] hover:text-[#9A7A4A] transition-colors"
            >
              Create a new account
            </a>
          </>
        )}

      </div>
    </div>
  );
}
