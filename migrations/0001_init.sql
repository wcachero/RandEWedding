-- Guest invite / RSVP list
CREATE TABLE IF NOT EXISTS guest_list (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE,
  joyfully_accept INTEGER, -- NULL = not yet responded, 1 = yes, 0 = no
  message TEXT,
  companion_count INTEGER NOT NULL DEFAULT 0, -- 0/NULL allowance = guest only; 1+ may bring companions
  date_responded TEXT,
  date_added TEXT NOT NULL,
  date_updated TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_guest_list_name ON guest_list(name);
CREATE INDEX IF NOT EXISTS idx_guest_list_responded ON guest_list(date_responded);

-- Companions tied to a guest (name optional)
CREATE TABLE IF NOT EXISTS companion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_id INTEGER NOT NULL REFERENCES guest_list(id) ON DELETE CASCADE,
  name TEXT,
  date_added TEXT NOT NULL,
  date_updated TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_companion_guest ON companion(guest_id);

-- Simple admin auth
CREATE TABLE IF NOT EXISTS admin_user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  date_added TEXT NOT NULL,
  date_updated TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_session (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES admin_user(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  date_added TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_session_user ON admin_session(user_id);
