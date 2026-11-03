var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/auth.ts
var SESSION_DAYS = 14;
var COOKIE = "gk_admin_session";
function b64(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
__name(b64, "b64");
function fromB64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
__name(fromB64, "fromB64");
function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(randomToken, "randomToken");
async function hashPassword(password, saltB64) {
  const salt = saltB64 ? fromB64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits"
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 1e5, hash: "SHA-256" },
    key,
    256
  );
  return { hash: b64(bits), salt: b64(salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength)) };
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, hash, salt) {
  const next = await hashPassword(password, salt);
  return next.hash === hash;
}
__name(verifyPassword, "verifyPassword");
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
__name(nowIso, "nowIso");
function readSessionToken(request) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (match?.[1]) return decodeURIComponent(match[1]);
  const auth = request.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim() || null;
  return null;
}
__name(readSessionToken, "readSessionToken");
function sessionCookie(token, expiresAt, secure = true) {
  const secureFlag = secure ? "; Secure" : "";
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly${secureFlag}; SameSite=Lax; Expires=${expiresAt.toUTCString()}`;
}
__name(sessionCookie, "sessionCookie");
function clearSessionCookie(secure = true) {
  const secureFlag = secure ? "; Secure" : "";
  return `${COOKIE}=; Path=/; HttpOnly${secureFlag}; SameSite=Lax; Max-Age=0`;
}
__name(clearSessionCookie, "clearSessionCookie");
function isSecureRequest(request) {
  const url = new URL(request.url);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return false;
  const forwarded = request.headers.get("X-Forwarded-Proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  return url.protocol === "https:";
}
__name(isSecureRequest, "isSecureRequest");
async function ensureAdminUser(env) {
  const existing = await env.DB.prepare("SELECT id FROM admin_user LIMIT 1").first();
  if (existing) return;
  const username = env.ADMIN_BOOTSTRAP_USER || "admin000";
  const password = env.ADMIN_BOOTSTRAP_PASS || "#admin0001";
  const { hash, salt } = await hashPassword(password);
  const ts = nowIso();
  await env.DB.prepare(
    `INSERT INTO admin_user (username, password_hash, password_salt, date_added, date_updated)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(username, hash, salt, ts, ts).run();
}
__name(ensureAdminUser, "ensureAdminUser");
async function requireAdmin(env, request) {
  await ensureAdminUser(env);
  const token = readSessionToken(request);
  if (!token) return json({ error: "Unauthorized" }, 401);
  const row = await env.DB.prepare(
    `SELECT s.token, s.expires_at, u.id, u.username
     FROM admin_session s
     JOIN admin_user u ON u.id = s.user_id
     WHERE s.token = ?`
  ).bind(token).first();
  if (!row) return json({ error: "Unauthorized" }, 401);
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await env.DB.prepare("DELETE FROM admin_session WHERE token = ?").bind(token).run();
    return json({ error: "Session expired" }, 401);
  }
  return { id: row.id, username: row.username };
}
__name(requireAdmin, "requireAdmin");
async function createSession(env, userId, secure = true) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1e3);
  await env.DB.prepare(
    `INSERT INTO admin_session (token, user_id, expires_at, date_added) VALUES (?, ?, ?, ?)`
  ).bind(token, userId, expires.toISOString(), nowIso()).run();
  return { token, cookie: sessionCookie(token, expires, secure) };
}
__name(createSession, "createSession");
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
}
__name(json, "json");

// worker/rate-limit.ts
var localBuckets = /* @__PURE__ */ new Map();
var LOCAL_LIMITS = {
  public: { limit: 60, periodMs: 6e4 },
  login: { limit: 8, periodMs: 6e4 },
  admin: { limit: 120, periodMs: 6e4 }
};
function clientKey(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("True-Client-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || "unknown";
}
__name(clientKey, "clientKey");
function rateLimitKind(path, method) {
  if (method === "POST" && path === "/api/admin/login") return "login";
  if (path.startsWith("/api/admin")) return "admin";
  return "public";
}
__name(rateLimitKind, "rateLimitKind");
async function enforceRateLimit(env, request, kind) {
  const key = `${kind}:${clientKey(request)}`;
  const limiter = kind === "login" ? env.RATE_LIMIT_LOGIN : kind === "admin" ? env.RATE_LIMIT_ADMIN : env.RATE_LIMIT_PUBLIC;
  let allowed = true;
  if (limiter) {
    const result = await limiter.limit({ key });
    allowed = result.success;
  } else {
    allowed = allowLocal(key, LOCAL_LIMITS[kind]);
  }
  if (allowed) return null;
  return json(
    { error: "Too many requests. Please wait a moment and try again." },
    429,
    { "Retry-After": "60" }
  );
}
__name(enforceRateLimit, "enforceRateLimit");
function allowLocal(key, cfg) {
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
__name(allowLocal, "allowLocal");

// worker/index.ts
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        console.error(err);
        return json({ error: "Server error" }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  }
};
async function handleApi(request, env, url) {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request)
    });
  }
  const limited = await enforceRateLimit(env, request, rateLimitKind(path, method));
  if (limited) return withCors(request, limited);
  if (method === "GET" && path === "/api/guests/search") {
    const q = (url.searchParams.get("q") || "").trim();
    if (q.length < 1) return withCors(request, json({ guests: [] }));
    const like = `%${q.replace(/[%_]/g, "")}%`;
    const { results } = await env.DB.prepare(
      `SELECT id, name, companion_count, joyfully_accept, date_responded
       FROM guest_list
       WHERE name LIKE ? COLLATE NOCASE
       ORDER BY name ASC
       LIMIT 12`
    ).bind(like).all();
    return withCors(
      request,
      json({
        guests: (results || []).map((g) => ({
          id: g.id,
          name: g.name,
          companionCount: g.companion_count ?? 0,
          responded: g.date_responded != null,
          joyfullyAccept: g.joyfully_accept === null ? null : g.joyfully_accept === 1
        }))
      })
    );
  }
  if (method === "GET" && /^\/api\/guests\/\d+$/.test(path)) {
    const id = Number(path.split("/").pop());
    const guest = await env.DB.prepare(`SELECT * FROM guest_list WHERE id = ?`).bind(id).first();
    if (!guest) return withCors(request, json({ error: "Guest not found" }, 404));
    const companions = await listCompanions(env, id);
    return withCors(request, json({ guest: serializeGuest(guest, companions) }));
  }
  if (method === "POST" && path === "/api/rsvp") {
    const body = await readJson(request);
    if (!body?.guestId || typeof body.joyfullyAccept !== "boolean") {
      return withCors(request, json({ error: "guestId and joyfullyAccept are required" }, 400));
    }
    const guest = await env.DB.prepare(`SELECT * FROM guest_list WHERE id = ?`).bind(body.guestId).first();
    if (!guest) return withCors(request, json({ error: "Guest not found" }, 404));
    const allowed = Math.max(0, guest.companion_count ?? 0);
    const companions = Array.isArray(body.companions) ? body.companions.slice(0, allowed) : [];
    if (companions.length > allowed) {
      return withCors(request, json({ error: `At most ${allowed} companion(s) allowed` }, 400));
    }
    const ts = nowIso();
    const message = (body.message || "").trim().slice(0, 500) || null;
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE guest_list
         SET joyfully_accept = ?, message = ?, date_responded = ?, date_updated = ?
         WHERE id = ?`
      ).bind(body.joyfullyAccept ? 1 : 0, message, ts, ts, guest.id),
      env.DB.prepare(`DELETE FROM companion WHERE guest_id = ?`).bind(guest.id),
      ...companions.map(
        (c) => env.DB.prepare(
          `INSERT INTO companion (guest_id, name, date_added, date_updated) VALUES (?, ?, ?, ?)`
        ).bind(guest.id, (c.name || "").trim().slice(0, 120) || null, ts, ts)
      )
    ]);
    const updated = await env.DB.prepare(`SELECT * FROM guest_list WHERE id = ?`).bind(guest.id).first();
    const savedCompanions = await listCompanions(env, guest.id);
    return withCors(request, json({ ok: true, guest: serializeGuest(updated, savedCompanions) }));
  }
  if (method === "POST" && path === "/api/admin/login") {
    await ensureAdminUser(env);
    const body = await readJson(request);
    const username = (body?.username || "").trim();
    const password = body?.password || "";
    if (!username || !password) return withCors(request, json({ error: "Username and password required" }, 400));
    const user = await env.DB.prepare(
      `SELECT id, username, password_hash, password_salt FROM admin_user WHERE username = ? COLLATE NOCASE`
    ).bind(username).first();
    if (!user || !await verifyPassword(password, user.password_hash, user.password_salt)) {
      return withCors(request, json({ error: "Invalid credentials" }, 401));
    }
    const session = await createSession(env, user.id, isSecureRequest(request));
    return withCors(
      request,
      json(
        { ok: true, username: user.username },
        200,
        { "Set-Cookie": session.cookie }
      )
    );
  }
  if (method === "POST" && path === "/api/admin/logout") {
    const secure = isSecureRequest(request);
    const admin = await requireAdmin(env, request);
    if (admin instanceof Response) {
      return withCors(request, json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie(secure) }));
    }
    const token = request.headers.get("Cookie")?.match(/(?:^|;\s*)gk_admin_session=([^;]+)/)?.[1];
    if (token) {
      await env.DB.prepare(`DELETE FROM admin_session WHERE token = ?`).bind(decodeURIComponent(token)).run();
    }
    return withCors(request, json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie(secure) }));
  }
  if (method === "GET" && path === "/api/admin/me") {
    const admin = await requireAdmin(env, request);
    if (admin instanceof Response) return withCors(request, admin);
    return withCors(request, json({ username: admin.username }));
  }
  if (path === "/api/admin/guests") {
    const admin = await requireAdmin(env, request);
    if (admin instanceof Response) return withCors(request, admin);
    if (method === "GET") {
      const { results } = await env.DB.prepare(
        `SELECT * FROM guest_list ORDER BY name COLLATE NOCASE ASC`
      ).all();
      const guests = [];
      for (const g of results || []) {
        guests.push(serializeGuest(g, await listCompanions(env, g.id)));
      }
      return withCors(request, json({ guests }));
    }
    if (method === "POST") {
      const body = await readJson(request);
      const name = (body?.name || "").trim();
      if (!name) return withCors(request, json({ error: "Name is required" }, 400));
      const companionCount = Math.max(0, Math.min(20, Number(body?.companionCount ?? 0) || 0));
      const ts = nowIso();
      const result = await env.DB.prepare(
        `INSERT INTO guest_list (name, joyfully_accept, message, companion_count, date_responded, date_added, date_updated)
         VALUES (?, NULL, NULL, ?, NULL, ?, ?)`
      ).bind(name, companionCount, ts, ts).run();
      const id = Number(result.meta.last_row_id);
      const guest = await env.DB.prepare(`SELECT * FROM guest_list WHERE id = ?`).bind(id).first();
      return withCors(request, json({ guest: serializeGuest(guest, []) }, 201));
    }
  }
  if (/^\/api\/admin\/guests\/\d+$/.test(path)) {
    const admin = await requireAdmin(env, request);
    if (admin instanceof Response) return withCors(request, admin);
    const id = Number(path.split("/").pop());
    if (method === "PUT" || method === "PATCH") {
      const body = await readJson(request);
      const guest = await env.DB.prepare(`SELECT * FROM guest_list WHERE id = ?`).bind(id).first();
      if (!guest) return withCors(request, json({ error: "Guest not found" }, 404));
      const name = body?.name != null ? body.name.trim() : guest.name;
      if (!name) return withCors(request, json({ error: "Name is required" }, 400));
      const companionCount = body?.companionCount != null ? Math.max(0, Math.min(20, Number(body.companionCount) || 0)) : guest.companion_count;
      let joyfully = guest.joyfully_accept;
      let message = guest.message;
      let dateResponded = guest.date_responded;
      if (body?.clearResponse) {
        joyfully = null;
        message = null;
        dateResponded = null;
        await env.DB.prepare(`DELETE FROM companion WHERE guest_id = ?`).bind(id).run();
      } else {
        if (body?.joyfullyAccept !== void 0) {
          joyfully = body.joyfullyAccept === null ? null : body.joyfullyAccept ? 1 : 0;
          if (joyfully === null) dateResponded = null;
          else if (!dateResponded) dateResponded = nowIso();
        }
        if (body?.message !== void 0) {
          message = (body.message || "").trim().slice(0, 500) || null;
        }
      }
      const ts = nowIso();
      await env.DB.prepare(
        `UPDATE guest_list
         SET name = ?, companion_count = ?, joyfully_accept = ?, message = ?, date_responded = ?, date_updated = ?
         WHERE id = ?`
      ).bind(name, companionCount, joyfully, message, dateResponded, ts, id).run();
      const updated = await env.DB.prepare(`SELECT * FROM guest_list WHERE id = ?`).bind(id).first();
      const companions = await listCompanions(env, id);
      return withCors(request, json({ guest: serializeGuest(updated, companions) }));
    }
    if (method === "DELETE") {
      await env.DB.prepare(`DELETE FROM guest_list WHERE id = ?`).bind(id).run();
      return withCors(request, json({ ok: true }));
    }
  }
  if (method === "GET" && path === "/api/admin/respondents") {
    const admin = await requireAdmin(env, request);
    if (admin instanceof Response) return withCors(request, admin);
    const { results } = await env.DB.prepare(
      `SELECT * FROM guest_list
       WHERE date_responded IS NOT NULL
       ORDER BY date_responded DESC`
    ).all();
    const respondents = [];
    for (const g of results || []) {
      respondents.push(serializeGuest(g, await listCompanions(env, g.id)));
    }
    return withCors(request, json({ respondents }));
  }
  if (method === "POST" && path === "/api/admin/password") {
    const admin = await requireAdmin(env, request);
    if (admin instanceof Response) return withCors(request, admin);
    const body = await readJson(request);
    if (!body?.currentPassword || !body?.newPassword) {
      return withCors(request, json({ error: "currentPassword and newPassword required" }, 400));
    }
    const user = await env.DB.prepare(
      `SELECT id, password_hash, password_salt FROM admin_user WHERE id = ?`
    ).bind(admin.id).first();
    if (!user || !await verifyPassword(body.currentPassword, user.password_hash, user.password_salt)) {
      return withCors(request, json({ error: "Current password is incorrect" }, 401));
    }
    const next = await hashPassword(body.newPassword);
    await env.DB.prepare(
      `UPDATE admin_user SET password_hash = ?, password_salt = ?, date_updated = ? WHERE id = ?`
    ).bind(next.hash, next.salt, nowIso(), user.id).run();
    return withCors(request, json({ ok: true }));
  }
  return withCors(request, json({ error: "Not found" }, 404));
}
__name(handleApi, "handleApi");
function serializeGuest(guest, companions) {
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
      dateUpdated: c.date_updated
    }))
  };
}
__name(serializeGuest, "serializeGuest");
async function listCompanions(env, guestId) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM companion WHERE guest_id = ? ORDER BY id ASC`
  ).bind(guestId).all();
  return results || [];
}
__name(listCompanions, "listCompanions");
async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
__name(readJson, "readJson");
function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  const headers = {
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin"
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}
__name(corsHeaders, "corsHeaders");
function withCors(request, response) {
  const headers = new Headers(response.headers);
  const cors = corsHeaders(request);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}
__name(withCors, "withCors");

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-mc4HGc/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-mc4HGc/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
