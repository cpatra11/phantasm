import { requireUser, unauthorized } from '../../../lib/auth/server';
import { CREDITS_PER_USER } from '../../../lib/credits';
import { getStore } from '../../../lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return unauthorized();
  const c = await getStore().ensureCredits(user.id, CREDITS_PER_USER);
  return Response.json({ remaining: Math.max(0, c.total - c.used), total: c.total });
}
