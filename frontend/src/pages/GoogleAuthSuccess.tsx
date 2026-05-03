import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function GoogleAuthSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const userId = searchParams.get('userId');
    const role = searchParams.get('role');
    const firstName = searchParams.get('firstName');
    const lastName = searchParams.get('lastName');

    if (!accessToken || !userId) {
      navigate('/login?error=oauth_failed', { replace: true });
      return;
    }

    localStorage.setItem('accessToken', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify({ id: userId, role, firstName, lastName }));

    window.location.replace(role === 'PROVIDER' ? '/provider/dashboard' : '/dashboard');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F3EF] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#C4A06A] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-serif italic text-[16px] text-[#7A7068]">Signing you in…</p>
      </div>
    </div>
  );
}
