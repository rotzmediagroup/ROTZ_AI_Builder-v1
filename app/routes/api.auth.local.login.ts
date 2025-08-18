import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { verifyPassword, createSession } from '~/lib/server/auth';

export async function action({ request }: ActionFunctionArgs) {
  const { email, password } = (await request.json()) as { email: string; password: string };
  if (!email || !password) return json({ error: 'Email and password required' }, { status: 400 });
  const user = verifyPassword(email, password);
  if (!user) return json({ error: 'Invalid credentials' }, { status: 401 });

  const session = createSession(user.id);
  const headers = new Headers();
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  headers.append(
    'Set-Cookie',
    `sid=${encodeURIComponent(session.id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 12};${secure}`,
  );
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...Object.fromEntries(headers) },
  });
}
