import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { requireUser } from '~/lib/server/auth';
import { db } from '~/lib/server/db';

export async function loader({ context, request }: LoaderFunctionArgs) {
  const user = await requireUser(context, request);
  const rows = db.prepare('SELECT provider, api_key_enc FROM user_api_keys WHERE user_id = ?').all(user.id) as any[];
  return json({ keys: rows });
}

export async function action({ context, request }: ActionFunctionArgs) {
  const user = await requireUser(context, request);
  const { provider, apiKey } = (await request.json()) as { provider: string; apiKey: string };
  if (!provider || !apiKey) return json({ error: 'Missing provider or apiKey' }, { status: 400 });
  db.prepare(
    'INSERT INTO user_api_keys (user_id, provider, api_key_enc) VALUES (?, ?, ?) ON CONFLICT(user_id, provider) DO UPDATE SET api_key_enc = excluded.api_key_enc',
  ).run(user.id, provider, apiKey);
  return json({ ok: true });
}
