import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';

export async function action({ request }: ActionFunctionArgs) {
  const headers = new Headers();
  headers.append('Set-Cookie', 'sb=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax');
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...Object.fromEntries(headers),
    },
  });
}
