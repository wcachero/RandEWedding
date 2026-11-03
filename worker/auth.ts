import type { Env } from './types';

const SESSION_DAYS = 14;
const COOKIE = 'gk_admin_session';

function b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password: string, saltB64?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltB64 ? fromB64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    key,
    256,
  );
  return { hash: b64(bits), salt: b64(salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength)) };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const next = await hashPassword(password, salt);
  return next.hash === hash;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function readSessionToken(request: Request): string | null {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (match?.[1]) return decodeURIComponent(match[1]);
  const auth = request.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim() || null;
  return null;
}

export function sessionCookie(token: string, expiresAt: Date, secure = true): string {
  const secureFlag = secure ? '; Secure' : '';
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly${secureFlag}; SameSite=Lax; Expires=${expiresAt.toUTCString()}`;
}

export function clearSessionCookie(secure = true): string {
  const secureFlag = secure ? '; Secure' : '';
  return `${COOKIE}=; Path=/; HttpOnly${secureFlag}; SameSite=Lax; Max-Age=0`;
}

export function isSecureRequest(request: Request): boolean {
  const url = new URL(request.url);
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return false;
  const forwarded = request.headers.get('X-Forwarded-Proto');
  if (forwarded) return forwarded.split(',')[0].trim() === 'https';
  return url.protocol === 'https:';
}

export async function ensureAdminUser(env: Env): Promise<void> {
  const existing = await env.DB.prepare('SELECT id FROM admin_user LIMIT 1').first();
  if (existing) return;

  const username = env.ADMIN_BOOTSTRAP_USER || 'admin000';
  const password = env.ADMIN_BOOTSTRAP_PASS || '#admin0001';
  const { hash, salt } = await hashPassword(password);
  const ts = nowIso();
  await env.DB.prepare(
    `INSERT INTO admin_user (username, password_hash, password_salt, date_added, date_updated)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(username, hash, salt, ts, ts)
    .run();
}

export async function requireAdmin(env: Env, request: Request): Promise<{ id: number; username: string } | Response> {
  await ensureAdminUser(env);
  const token = readSessionToken(request);
  if (!token) return json({ error: 'Unauthorized' }, 401);

  const row = await env.DB.prepare(
    `SELECT s.token, s.expires_at, u.id, u.username
     FROM admin_session s
     JOIN admin_user u ON u.id = s.user_id
     WHERE s.token = ?`,
  )
    .bind(token)
    .first<{ token: string; expires_at: string; id: number; username: string }>();

  if (!row) return json({ error: 'Unauthorized' }, 401);
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await env.DB.prepare('DELETE FROM admin_session WHERE token = ?').bind(token).run();
    return json({ error: 'Session expired' }, 401);
  }
  return { id: row.id, username: row.username };
}

export async function createSession(
  env: Env,
  userId: number,
  secure = true,
): Promise<{ token: string; cookie: string }> {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await env.DB.prepare(
    `INSERT INTO admin_session (token, user_id, expires_at, date_added) VALUES (?, ?, ?, ?)`,
  )
    .bind(token, userId, expires.toISOString(), nowIso())
    .run();
  return { token, cookie: sessionCookie(token, expires, secure) };
}

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}
