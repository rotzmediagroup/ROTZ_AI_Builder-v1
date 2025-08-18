import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { requireUser, requireAdmin } from '~/lib/server/auth';
import { db } from '~/lib/server/db';

export async function loader({ context, request }: LoaderFunctionArgs) {
  const user = await requireUser(context, request);
  requireAdmin(user);

  const rows = db
    .prepare('SELECT id, email, role, is_whitelisted, created_at, updated_at FROM users ORDER BY created_at DESC')
    .all() as any[];
  return json({ users: rows });
}

export async function action({ context, request }: ActionFunctionArgs) {
  const user = await requireUser(context, request);
  requireAdmin(user);

  const { action, payload } = await request.json<{ action: string; payload: any }>();

  switch (action) {
    case 'create': {
      const { id, email, role = 'user', is_whitelisted = false, password_hash } = payload ?? {};
      const now = new Date().toISOString();
      try {
        db.prepare(
          'INSERT INTO users (id, email, password_hash, role, is_whitelisted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).run(id, email, password_hash, role, is_whitelisted ? 1 : 0, now, now);
        const user = db
          .prepare('SELECT id, email, role, is_whitelisted, created_at, updated_at FROM users WHERE id = ?')
          .get(id);
        return json({ user });
      } catch (e: any) {
        return json({ error: e.message }, { status: 400 });
      }
    }
    case 'update': {
      const { id, role, is_whitelisted } = payload ?? {};
      db.prepare('UPDATE users SET role = COALESCE(?, role), is_whitelisted = COALESCE(?, is_whitelisted), updated_at = ? WHERE id = ?')
        .run(role, typeof is_whitelisted === 'boolean' ? (is_whitelisted ? 1 : 0) : undefined, new Date().toISOString(), id);
      const updated = db
        .prepare('SELECT id, email, role, is_whitelisted, created_at, updated_at FROM users WHERE id = ?')
        .get(id);
      return json({ user: updated });
    }
    case 'delete': {
      const { id } = payload ?? {};
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      return json({ ok: true });
    }
    default:
      return json({ error: 'Unknown action' }, { status: 400 });
  }
}
