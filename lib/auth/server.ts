export type SessionUser = { id: string; email: string; name: string };

/**
 * Resolves the signed-in user for an API request by asking the app's own Better Auth
 * instance (mounted at /api/auth) with the same cookies. Works with any Better Auth setup
 * that exposes the standard get-session endpoint.
 */
export async function requireUser(request: Request): Promise<SessionUser | null> {
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/auth/get-session`, {
    headers: { cookie: request.headers.get('cookie') ?? '' },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as { user?: SessionUser } | null;
  return data?.user ?? null;
}

export function unauthorized() {
  return Response.json({ error: 'Sign in to continue.' }, { status: 401 });
}
