/** Cloudflare Workers Rate Limiting binding. */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  RATE_LIMIT_PUBLIC?: RateLimiter;
  RATE_LIMIT_LOGIN?: RateLimiter;
  RATE_LIMIT_ADMIN?: RateLimiter;
  ADMIN_BOOTSTRAP_USER?: string;
  ADMIN_BOOTSTRAP_PASS?: string;
}

export type GuestRow = {
  id: number;
  name: string;
  joyfully_accept: number | null;
  message: string | null;
  companion_count: number;
  date_responded: string | null;
  date_added: string;
  date_updated: string;
};

export type CompanionRow = {
  id: number;
  guest_id: number;
  name: string | null;
  date_added: string;
  date_updated: string;
};
