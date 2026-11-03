import type { Env } from './types';

let schemaReady = false;

/** Ensure RSVP tables exist (covers D1 created in dashboard before migrations ran). */
export async function ensureSchema(env: Env): Promise<void> {
  if (schemaReady) return;

  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS guest_list (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL COLLATE NOCASE,
        joyfully_accept INTEGER,
        message TEXT,
        companion_count INTEGER NOT NULL DEFAULT 0,
        date_responded TEXT,
        date_added TEXT NOT NULL,
        date_updated TEXT NOT NULL
      )
    `),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_guest_list_name ON guest_list(name)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_guest_list_responded ON guest_list(date_responded)`),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS companion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guest_id INTEGER NOT NULL REFERENCES guest_list(id) ON DELETE CASCADE,
        name TEXT,
        date_added TEXT NOT NULL,
        date_updated TEXT NOT NULL
      )
    `),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_companion_guest ON companion(guest_id)`),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS admin_user (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        date_added TEXT NOT NULL,
        date_updated TEXT NOT NULL
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS admin_session (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES admin_user(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        date_added TEXT NOT NULL
      )
    `),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_admin_session_user ON admin_session(user_id)`),
  ]);

  schemaReady = true;
}
