'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn, signUp } from '../lib/auth/client';

type Mode = 'sign-in' | 'sign-up';

/** Email and password form shared by sign-in and sign-up. */
export function AuthForm({ mode }: { mode: Mode }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSignUp = mode === 'sign-up';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const next = new URLSearchParams(window.location.search).get('next') || '/app';
    const res = isSignUp
      ? await signUp.email({ name: name || email.split('@')[0], email, password })
      : await signIn.email({ email, password });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? 'Something went wrong. Check your details and try again.');
      return;
    }
    window.location.assign(next.startsWith('/') ? next : '/app');
  }

  return (
    <form className="panel span-5" onSubmit={submit} noValidate>
      <div className="label">{isSignUp ? 'Create account' : 'Sign in'}</div>
      <h2>{isSignUp ? 'Start with free credits.' : 'Welcome back.'}</h2>

      {isSignUp && (
        <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>
      )}

      <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </label>

      <label className="label" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        Password
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
        />
      </label>

      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Working…' : isSignUp ? 'Create account' : 'Sign in'}
      </button>

      <p className="muted" style={{ margin: 0 }}>
        {isSignUp ? (
          <>
            Already have an account? <Link href="/sign-in">Sign in</Link>
          </>
        ) : (
          <>
            New here? <Link href="/sign-up">Create an account</Link>
          </>
        )}
      </p>
    </form>
  );
}
