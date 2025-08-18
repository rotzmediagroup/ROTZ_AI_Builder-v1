import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createClient } from '@supabase/supabase-js';

export async function action({ request, context }: ActionFunctionArgs) {
  try {
    const { email, password } = (await request.json()) as { email: string; password: string };
    if (!email || !password) {
      return json({ error: 'Email and password are required' }, { status: 400 });
    }

    const env = (context.cloudflare?.env as any) as Env;
    if (!env?.SUPABASE_URL || !env?.SUPABASE_ANON_KEY) {
      return json({ error: 'Auth not configured' }, { status: 500 });
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data?.session?.access_token) {
      return json({ error: error?.message || 'Invalid credentials' }, { status: 401 });
    }

    const accessToken = data.session.access_token;
    const headers = new Headers();
    const cookie = `sb=${encodeURIComponent(accessToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 12};$${
      process.env.NODE_ENV === 'production' ? ' Secure;' : ''
    }`;
    headers.append('Set-Cookie', cookie);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...Object.fromEntries(headers),
      },
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Login failed' }, { status: 500 });
  }
}
