'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { signOut } from '../lib/auth/client';

type Credits = { remaining: number; total: number };

/** Fired by the agent sidebar after a run, so the badge never lies about credits. */
export const CREDITS_CHANGED_EVENT = 'basix:credits-changed';

/** Top navigation bar (Phantasma mark, Board, credits, sign out). No sidebar. */
export function Shell({ children }: { children: React.ReactNode; title?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [credits, setCredits] = useState<Credits | null>(null);

  const loadCredits = useCallback(() => {
    fetch('/api/credits')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Credits | null) => setCredits(data))
      .catch(() => setCredits(null));
  }, []);

  useEffect(() => {
    loadCredits();
    // A run in another component spends a credit: refetch on its event, and when
    // the user comes back to the tab.
    window.addEventListener(CREDITS_CHANGED_EVENT, loadCredits);
    window.addEventListener('focus', loadCredits);
    return () => {
      window.removeEventListener(CREDITS_CHANGED_EVENT, loadCredits);
      window.removeEventListener('focus', loadCredits);
    };
  }, [loadCredits]);

  async function handleSignOut() {
    await signOut();
    router.push('/sign-in');
  }

  return (
    <div className="shell">
      <div className="main">
        <header className="topbar">
          <div style={{ gap: 16 }}>
            <Link href="/app" className="mark">
              Phantasma
            </Link>
            <nav className="nav nav-top" aria-label="Primary">
              <Link href="/app" aria-current={pathname === '/app' ? 'page' : undefined}>
                Board
              </Link>
            </nav>
          </div>
          <div style={{ gap: 16 }}>
            <span className="chip" aria-live="polite">
              <span className="label">Credits</span>
              <span className="credits">{credits ? `${credits.remaining} / ${credits.total}` : '—'}</span>
            </span>
            <button type="button" className="btn" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
