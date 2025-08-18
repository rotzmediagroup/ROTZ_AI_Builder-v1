import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { destroySession } from '~/lib/server/auth';

export async function action({ request }: ActionFunctionArgs) {
  destroySession(request);
  const headers = new Headers();
  headers.append('Set-Cookie', 'sid=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax');
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...Object.fromEntries(headers) },
  });
}
