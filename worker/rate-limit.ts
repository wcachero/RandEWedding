import { json } from './auth';
import type { Env } from './types';

/** In-memory fallback for local `wrangler dev` (per isolate). */
const localBuckets = new Map<string, { count: number; resetAt: number }>();

export type RateLimitKind = 'public' | 'login' | 'admin';

const LOCAL_LIMITS: Record<RateLimitKind, { limit: number; periodMs: number }> = {
  public: { limit: 60, periodMs: 60_000 },
  login: { limit: 8, periodMs: 60_000 },
  admin: { limit: 120, periodMs: 60_000 },
};

export function clientKey(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('True-Client-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export function rateLimitKind(path: string, method: string): RateLimitKind {
  if (method === 'POST' && path === '/api/admin/login') return 'login';
  if (path.startsWith('/api/admin')) return 'admin';
  return 'public';
}

export async function enforceRateLimit(
  env: Env,
  request: Request,
  kind: RateLimitKind,
): Promise<Response | null> {
  const key = `${kind}:${clientKey(request)}`;
  const limiter =
    kind === 'login'
      ? env.RATE_LIMIT_LOGIN
      : kind === 'admin'
        ? env.RATE_LIMIT_ADMIN
        : env.RATE_LIMIT_PUBLIC;

  let allowed = true;
  if (limiter) {
    const result = await limiter.limit({ key });
    allowed = result.success;
  } else {
    allowed = allowLocal(key, LOCAL_LIMITS[kind]);
  }

  if (allowed) return null;
  return json(
    { error: 'Too many requests. Please wait a moment and try again.' },
    429,
    { 'Retry-After': '60' },
  );
}

function allowLocal(key: string, cfg: { limit: number; periodMs: number }): boolean {
  const now = Date.now();
  const bucket = localBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    localBuckets.set(key, { count: 1, resetAt: now + cfg.periodMs });
    return true;
  }
  if (bucket.count >= cfg.limit) return false;
  bucket.count += 1;
  return true;
}
