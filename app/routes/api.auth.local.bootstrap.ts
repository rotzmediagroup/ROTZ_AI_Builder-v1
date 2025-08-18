import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { db } from '~/lib/server/db';
import { createUser } from '~/lib/server/auth';

/**
 * One-time bootstrap endpoint to create the first admin user.
 * Only works if there are no users yet.
 */
export async function action({ request }: ActionFunctionArgs) {
  const count = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c as number;
  if (count > 0) {
    return json({ error: 'Users already exist' }, { status: 400 });
  }
  const { email, password } = (await request.json()) as { email: string; password: string };
  if (!email || !password) return json({ error: 'Email and password required' }, { status: 400 });
  const id = createUser(email, password, 'admin', true);
  return json({ ok: true, id });
}
