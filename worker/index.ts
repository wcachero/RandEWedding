import {
  clearSessionCookie,
  createSession,
  ensureAdminUser,
  hashPassword,
  isSecureRequest,
  json,
  nowIso,
  requireAdmin,
  verifyPassword,
} from './auth';
import { enforceRateLimit, rateLimitKind } from './rate-limit';
import type { CompanionRow, Env, GuestRow } from './types';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        console.error(err);
        return json({ error: 'Server error' }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request),
    });
  }

  const limited = await enforceRateLimit(env, request, rateLimitKind(path, method));
  if (limited) return withCors(request, limited);

  // Public guest search (debounce)
  if (method === 'GET' && path === '/api/guests/search') {
    const q = (url.searchParams.get('q') || '').trim();
    if (q.length < 1) return withCors(request, json({ guests: [] }));
    const like = `%${q.replace(/[%_]/g, '')}%`;
    const { results } = await env.DB.prepare(
      `SELECT id, name, companion_count, joyfully_accept, date_responded
       FROM guest_list
       WHERE name LIKE ? COLLATE NOCASE
       ORDER BY name ASC
       LIMIT 12`,
    )
      .bind(like)
      .all<{
        id: number;
        name: string;
        companion_count: number;
        joyfully_accept: number | null;
        date_responded: string | null;
      }>();

    return withCors(
      request,
      json({
        guests: (results || []).map((g) => ({
          id: g.id,
          name: g.name,
          companionCount: g.companion_count ?? 0,
          responded: g.date_responded != null,
          joyfullyAccept: g.joyfully_accept === null ? null : g.joyfully_accept === 1,
        })),
      }),
    );
  }

  // Public guest detail for RSVP form
  if (method === 'GET' && /^\/api\/guests\/\d+$/.test(path)) {
    const id = Number(path.split('/').pop());
    const guest = await env.DB.prepare(`SELECT * FROM guest_list WHERE id = ?`).bind(id).first<GuestRow>();
    if (!guest) return withCors(request, json({ error: 'Guest not found' }, 404));
    const companions = await listCompanions(env, id);
    return withCors(request, json({ guest: serializeGuest(guest, companions) }));
  }

  // Public RSVP submit
  if (method === 'POST' && path === '/api/rsvp') {
    const body = await readJson<{
      guestId?: number;
      joyfullyAccept?: boolean;
      message?: string;
      companions?: Array<{ name?: string | null }>;
    }>(request);
    if (!body?.guestId || typeof body.joyfullyAccept !== 'boolean') {
      return withCors(request, json({ error: 'guestId and joyfullyAccept are required' }, 400));
    }

    const guest = await env.DB.prepare(`SELECT * FROM guest_list WHERE id = ?`).bind(body.guestId).first<GuestRow>();
    if (!guest) return withCors(request, json({ error: 'Guest not found' }, 404));

    const allowed = Math.max(0, guest.companion_count ?? 0);
    const companions = Array.isArray(body.companions) ? body.companions.slice(0, allowed) : [];
    if (companions.length > allowed) {
      return withCors(request, json({ error: `At most ${allowed} companion(s) allowed` }, 400));
    }

    const ts = nowIso();
    const message = (body.message || '').trim().slice(0, 500) || null;

    await env.DB.batch([
      env.DB.prepare(
        `UPDATE guest_list
         SET joyfully_accept = ?, message = ?, date_responded = ?, date_updated = ?
         WHERE id = ?`,
      ).bind(body.joyfullyAccept ? 1 : 0, message, ts, ts, guest.id),
      env.DB.prepare(`DELETE FROM companion WHERE guest_id = ?`).bind(guest.id),
      ...companions.map((c) =>
        env.DB.prepare(
          `INSERT INTO companion (guest_id, name, date_added, date_updated) VALUES (?, ?, ?, ?)`,
        ).bind(guest.id, (c.name || '').trim().slice(0, 120) || null, ts, ts),
      ),
    ]);

    const updated = await env.DB.prepare(`SELECT * FROM guest_list WHERE id = ?`).bind(guest.id).first<GuestRow>();
    const savedCompanions = await listCompanions(env, guest.id);
    return withCors(request, json({ ok: true, guest: serializeGuest(updated!, savedCompanions) }));
  }

  // Admin auth
  if (method === 'POST' && path === '/api/admin/login') {
    await ensureAdminUser(env);
    const body = await readJson<{ username?: string; password?: string }>(request);
    const username = (body?.username || '').trim();
    const password = body?.password || '';
    if (!username || !password) return withCors(request, json({ error: 'Username and password required' }, 400));

    const user = await env.DB.prepare(
      `SELECT id, username, password_hash, password_salt FROM admin_user WHERE username = ? COLLATE NOCASE`,
    )
      .bind(username)
      .first<{ id: number; username: string; password_hash: string; password_salt: string }>();

    if (!user || !(await verifyPassword(password, user.password_hash, user.password_salt))) {
      return withCors(request, json({ error: 'Invalid credentials' }, 401));
    }

    const session = await createSession(env, user.id, isSecureRequest(request));
    return withCors(
      request,
      json(
        { ok: true, username: user.username },
        200,
        { 'Set-Cookie': session.cookie },
      ),
    );
  }

  if (method === 'POST' && path === '/api/admin/logout') {
    const secure = isSecureRequest(request);
    const admin = await requireAdmin(env, request);
    if (admin instanceof Response) {
      return withCors(request, json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie(secure) }));
    }
    const token = request.headers.get('Cookie')?.match(/(?:^|;\s*)gk_admin_session=([^;]+)/)?.[1];
    if (token) {
      await env.DB.prepare(`DELETE FROM admin_session WHERE token = ?`)
        .bind(decodeURIComponent(token))
        .run();
    }
    return withCors(request, json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie(secure) }));
  }

  if (method === 'GET' && path === '/api/admin/me') {
    const admin = await requireAdmin(env, request);
    if (admin instanceof Response) return withCors(request, admin);
    return withCors(request, json({ username: admin.username }));
  }

  // Admin guests CRUD
  if (path === '/api/admin/guests') {
    const admin = await requireAdmin(env, request);
    if (admin instanceof Response) return withCors(request, admin);

    if (method === 'GET') {
      const { results } = await env.DB.prepare(
        `SELECT * FROM guest_list ORDER BY name COLLATE NOCASE ASC`,
      ).all<GuestRow>();
      const guests = [];
      for (const g of results || []) {
        guests.push(serializeGuest(g, await listCompanions(env, g.id)));
      }
      return withCors(request, json({ guests }));
    }

    if (method === 'POST') {
      const body = await readJson<{ name?: string; companionCount?: number }>(request);
      const name = (body?.name || '').trim();
      if (!name) return withCors(request, json({ error: 'Name is required' }, 400));
      const companionCount = Math.max(0, Math.min(20, Number(body?.companionCount ?? 0) || 0));
      const ts = nowIso();
      const result = await env.DB.prepare(
        `INSERT INTO guest_list (name, joyfully_accept, message, companion_count, date_responded, date_added, date_updated)
         VALUES (?, NULL, NULL, ?, NULL, ?, ?)`,
      )
        .bind(name, companionCount, ts, ts)
        .run();
      const id = Number(result.meta.last_row_id);
      const guest = await env.DB.prepare(`SELECT * FROM guest_list WHERE id = ?`).bind(id).first<GuestRow>();
      return withCors(request, json({ guest: serializeGuest(guest!, []) }, 201));
    }
  }

  if (/^\/api\/admin\/guests\/\d+$/.test(path)) {
    const admin = await requireAdmin(env, request);
    if (admin instanceof Response) return withCors(request, admin);
    const id = Number(path.split('/').pop());

    if (method === 'PUT' || method === 'PATCH') {
      const body = await readJson<{
        name?: string;
        companionCount?: number;
        joyfullyAccept?: boolean | null;
        message?: string | null;
        clearResponse?: boolean;
      }>(request);

      const guest = await env.DB.prepare(`SELECT * FROM guest_list WHERE id = ?`).bind(id).first<GuestRow>();
      if (!guest) return withCors(request, json({ error: 'Guest not found' }, 404));

      const name = body?.name != null ? body.name.trim() : guest.name;
      if (!name) return withCors(request, json({ error: 'Name is required' }, 400));
      const companionCount =
        body?.companionCount != null
          ? Math.max(0, Math.min(20, Number(body.companionCount) || 0))
          : guest.companion_count;

      let joyfully = guest.joyfully_accept;
      let message = guest.message;
      let dateResponded = guest.date_responded;
      if (body?.clearResponse) {
        joyfully = null;
        message = null;
        dateResponded = null;
        await env.DB.prepare(`DELETE FROM companion WHERE guest_id = ?`).bind(id).run();
      } else {
        if (body?.joyfullyAccept !== undefined) {
          joyfully = body.joyfullyAccept === null ? null : body.joyfullyAccept ? 1 : 0;
          if (joyfully === null) dateResponded = null;
          else if (!dateResponded) dateResponded = nowIso();
        }
        if (body?.message !== undefined) {
          message = (body.message || '').trim().slice(0, 500) || null;
        }
      }

      const ts = nowIso();
      await env.DB.prepare(
        `UPDATE guest_list
         SET name = ?, companion_count = ?, joyfully_accept = ?, message = ?, date_responded = ?, date_updated = ?
         WHERE id = ?`,
      )
        .bind(name, companionCount, joyfully, message, dateResponded, ts, id)
        .run();

      const updated = await env.DB.prepare(`SELECT * FROM guest_list WHERE id = ?`).bind(id).first<GuestRow>();
      const companions = await listCompanions(env, id);
      return withCors(request, json({ guest: serializeGuest(updated!, companions) }));
    }

    if (method === 'DELETE') {
      await env.DB.prepare(`DELETE FROM guest_list WHERE id = ?`).bind(id).run();
      return withCors(request, json({ ok: true }));
    }
  }

  // Respondents = guests who have date_responded
  if (method === 'GET' && path === '/api/admin/respondents') {
    const admin = await requireAdmin(env, request);
    if (admin instanceof Response) return withCors(request, admin);
    const { results } = await env.DB.prepare(
      `SELECT * FROM guest_list
       WHERE date_responded IS NOT NULL
       ORDER BY date_responded DESC`,
    ).all<GuestRow>();
    const respondents = [];
    for (const g of results || []) {
      respondents.push(serializeGuest(g, await listCompanions(env, g.id)));
    }
    return withCors(request, json({ respondents }));
  }

  // Change admin password (optional convenience)
  if (method === 'POST' && path === '/api/admin/password') {
    const admin = await requireAdmin(env, request);
    if (admin instanceof Response) return withCors(request, admin);
    const body = await readJson<{ currentPassword?: string; newPassword?: string }>(request);
    if (!body?.currentPassword || !body?.newPassword) {
      return withCors(request, json({ error: 'currentPassword and newPassword required' }, 400));
    }
    const user = await env.DB.prepare(
      `SELECT id, password_hash, password_salt FROM admin_user WHERE id = ?`,
    )
      .bind(admin.id)
      .first<{ id: number; password_hash: string; password_salt: string }>();
    if (!user || !(await verifyPassword(body.currentPassword, user.password_hash, user.password_salt))) {
      return withCors(request, json({ error: 'Current password is incorrect' }, 401));
    }
    const next = await hashPassword(body.newPassword);
    await env.DB.prepare(
      `UPDATE admin_user SET password_hash = ?, password_salt = ?, date_updated = ? WHERE id = ?`,
    )
      .bind(next.hash, next.salt, nowIso(), user.id)
      .run();
    return withCors(request, json({ ok: true }));
  }

  return withCors(request, json({ error: 'Not found' }, 404));
}

function serializeGuest(guest: GuestRow, companions: CompanionRow[]) {
  return {
    id: guest.id,
    name: guest.name,
    joyfullyAccept: guest.joyfully_accept === null ? null : guest.joyfully_accept === 1,
    message: guest.message,
    companionCount: guest.companion_count ?? 0,
    dateResponded: guest.date_responded,
    dateAdded: guest.date_added,
    dateUpdated: guest.date_updated,
    companions: companions.map((c) => ({
      id: c.id,
      name: c.name,
      dateAdded: c.date_added,
      dateUpdated: c.date_updated,
    })),
  };
}

async function listCompanions(env: Env, guestId: number): Promise<CompanionRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT * FROM companion WHERE guest_id = ? ORDER BY id ASC`,
  )
    .bind(guestId)
    .all<CompanionRow>();
  return results || [];
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
  // Never pair credentials with "*"; echo the request origin when present.
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function withCors(request: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  const cors = corsHeaders(request);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v as string);
  return new Response(response.body, { status: response.status, headers });
}
