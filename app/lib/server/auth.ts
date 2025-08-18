import { randomUUID } from 'node:crypto';
import type { AppLoadContext } from '@remix-run/cloudflare';
import bcrypt from 'bcryptjs';
import { db } from './db';

export type Role = 'admin' | 'user' | 'blocked';

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  isWhitelisted: boolean;
}

function getCookie(request: Request, name: string) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function createUser(email: string, password: string, role: Role = 'user', isWhitelisted = false) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const password_hash = bcrypt.hashSync(password, 10);
  const stmt = db.prepare(
    `INSERT INTO users (id, email, password_hash, role, is_whitelisted, created_at, updated_at)
     VALUES (@id, @email, @password_hash, @role, @is_whitelisted, @created_at, @updated_at)`,
  );
  stmt.run({ id, email, password_hash, role, is_whitelisted: isWhitelisted ? 1 : 0, created_at: now, updated_at: now });
  return id;
}

export function verifyPassword(email: string, password: string): SessionUser | null {
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  if (!row) return null;
  if (!bcrypt.compareSync(password, row.password_hash)) return null;
  return { id: row.id, email: row.email, role: row.role, isWhitelisted: !!row.is_whitelisted };
}

export function createSession(userId: string, ttlSeconds = 60 * 60 * 12) {
  const id = randomUUID();
  const now = Date.now();
  const expires = now + ttlSeconds * 1000;
  db.prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(id, userId, expires, now);
  return { id, expires };
}

export function getSessionUser(request: Request): SessionUser | null {
  const sid = getCookie(request, 'sid');
  if (!sid) return null;
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sid) as any;
  if (!row || row.expires_at < Date.now()) return null;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id) as any;
  if (!user) return null;
  return { id: user.id, email: user.email, role: user.role, isWhitelisted: !!user.is_whitelisted };
}

export function destroySession(request: Request) {
  const sid = getCookie(request, 'sid');
  if (sid) db.prepare('DELETE FROM sessions WHERE id = ?').run(sid);
}

export function requireUser(_context: AppLoadContext, request: Request): SessionUser {
  const user = getSessionUser(request);
  if (!user) throw new Response('Unauthorized', { status: 401 });
  if (user.role === 'blocked') throw new Response('Forbidden', { status: 403 });
  return user;
}

export function requireAdmin(user: SessionUser) {
  if (user.role !== 'admin') throw new Response('Forbidden', { status: 403 });
}
