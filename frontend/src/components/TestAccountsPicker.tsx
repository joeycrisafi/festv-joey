import { useEffect, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

// ── Dev tool: autofills email + password on the login form with a
// pre-seeded test account. Gated by VITE_TEST_ACCOUNTS_ENABLED=true on
// the frontend AND ENABLE_TEST_ACCOUNTS=true on the backend. If the
// frontend flag is off the component renders nothing. If the frontend
// flag is on but the backend flag isn't, it surfaces the misconfig so
// it's obvious in dev.

const ENABLED = import.meta.env.VITE_TEST_ACCOUNTS_ENABLED === 'true';
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1';

interface TestAccount {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'CLIENT' | 'PROVIDER' | 'ADMIN';
  label: string;
  emoji: string;
}

interface Props {
  /** Called when the user picks an account. Parent should update its
   *  email + password state to match. */
  onSelect: (email: string, password: string) => void;
}

export default function TestAccountsPicker({ onSelect }: Props) {
  const [accounts, setAccounts] = useState<TestAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickedEmail, setPickedEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!ENABLED) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/seed-test-accounts`, {
          method: 'POST',
        });
        if (cancelled) return;
        if (!res.ok) {
          if (res.status === 404) {
            // Frontend flag is on but backend flag isn't — surface it so
            // the misconfiguration is obvious in dev. In prod the frontend
            // flag should be off and this component never renders at all.
            throw new Error(
              'Backend is not serving test accounts. Set ENABLE_TEST_ACCOUNTS=true on the backend.'
            );
          }
          throw new Error(`Unable to load test accounts (HTTP ${res.status})`);
        }
        const data = await res.json();
        setAccounts(data?.data?.accounts || []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load test accounts');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ENABLED) return null;

  if (loading) {
    return (
      <div className="mt-6 p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-500 flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
        Loading test accounts...
      </div>
    );
  }

  if (accounts.length === 0 && !error) return null;

  const handlePick = (acc: TestAccount) => {
    setPickedEmail(acc.email);
    onSelect(acc.email, acc.password);
  };

  return (
    <div className="mt-6 p-4 rounded-xl bg-stone-50 border border-dashed border-stone-300">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-stone-500">
          Dev · Test Accounts
        </div>
        <span className="text-[0.6rem] text-stone-400 font-mono">
          VITE_TEST_ACCOUNTS_ENABLED
        </span>
      </div>
      <p className="text-xs text-stone-500 mb-3 leading-snug">
        {accounts.length > 0
          ? 'Click to autofill the form, then hit Sign In.'
          : 'Test accounts are currently unavailable.'}
      </p>

      {error && (
        <div className="mb-3 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-px" strokeWidth={2} />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {accounts.map((acc) => {
          const isPicked = pickedEmail === acc.email;
          return (
            <button
              key={acc.email}
              type="button"
              onClick={() => handlePick(acc)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border bg-white transition-colors text-left ${
                isPicked
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-stone-200 hover:border-brand-400 hover:bg-brand-50/50'
              }`}
              title={acc.email}
            >
              <span className="text-base leading-none flex-shrink-0">{acc.emoji}</span>
              <span className="text-sm text-stone-800 flex-1 min-w-0 truncate">
                Sign in as test <span className="font-semibold">{acc.label}</span>
              </span>
              {isPicked && (
                <span className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-brand-600 flex-shrink-0">
                  Filled
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
