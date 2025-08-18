import type { AppLoadContext } from '@remix-run/cloudflare';
import { createClient } from '@supabase/supabase-js';

export type Role = 'admin' | 'user' | 'blocked';

export interface AuthUser {
  id: string;
  email?: string;
  role: Role;
  isWhitelisted?: boolean;
}

export function getSupabaseServerClient(context: AppLoadContext) {
  const env = (context.cloudflare?.env as unknown as Env | undefined) ?? ({} as Env);
  if (!env?.SUPABASE_URL || !env?.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase server environment variables not configured');
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export async function requireUser(context: AppLoadContext, request: Request): Promise<AuthUser> {
  const env = (context.cloudflare?.env as unknown as Env | undefined) ?? ({} as Env);
  // Expect a JWT in Authorization: Bearer <token> or cookie 'sb'
  const authHeader = request.headers.get('Authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

  if (!token) {
    const cookie = request.headers.get('Cookie') || '';
    const match = cookie.match(/(?:^|;\s*)sb=([^;]+)/);
    token = match ? decodeURIComponent(match[1]) : undefined;
  }

  if (!token) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const supabase = getSupabaseServerClient(context);
  const { data: userResult, error } = await supabase.auth.getUser(token);
  if (error || !userResult.user) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const userId = userResult.user.id;
  // Lookup role/whitelist from a `users` table if present
  const { data: profile } = await supabase
    .from('users')
    .select('role,is_whitelisted')
    .eq('id', userId)
    .maybeSingle();

  const role: Role = (profile?.role as Role) || 'user';
  const isWhitelisted = Boolean(profile?.is_whitelisted);

  if (role === 'blocked') {
    throw new Response('Forbidden', { status: 403 });
  }

  if (env?.WHITELIST_ONLY === 'true' && !isWhitelisted && role !== 'admin') {
    throw new Response('Forbidden', { status: 403 });
  }

  return { id: userId, email: userResult.user.email ?? undefined, role, isWhitelisted };
}

export function requireAdmin(user: AuthUser) {
  if (user.role !== 'admin') {
    throw new Response('Forbidden', { status: 403 });
  }
}
