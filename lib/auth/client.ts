'use client';

import { createAuthClient } from 'better-auth/react';

/**
 * Browser client for the existing Better Auth server instance.
 * Same origin by default, so the auth routes are served by the app itself.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || undefined,
});

export const { useSession, signIn, signUp, signOut } = authClient;
