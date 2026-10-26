/**
 * Per-account limits for email + password auth (better-auth's own limiter is per IP).
 * Keys are `<action>:<lowercased email>`; nothing about the account's existence is revealed.
 */

export const AUTH_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS "rateLimit" ("id" text PRIMARY KEY NOT NULL, "key" text NOT NULL, "count" integer NOT NULL, "lastRequest" integer NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "rateLimit_key_unique" ON "rateLimit" ("key")`,
  `CREATE TABLE IF NOT EXISTS "auth_attempt" ("key" text PRIMARY KEY NOT NULL, "count" integer NOT NULL, "windowStart" integer NOT NULL, "lockedUntil" integer)`,
];

export type GuardAction = "sign-in" | "sign-up" | "reset" | "magic-link";

export interface GuardRule {
  /** Attempts allowed in the window. */
  max: number;
  windowMs: number;
  /** For sign-in: lock this long after `max` failures. */
  lockMs?: number;
}

const MIN = 60_000;
export const GUARD_RULES: Record<GuardAction, GuardRule> = {
  "sign-in": { max: 5, windowMs: 15 * MIN, lockMs: 15 * MIN },
  "sign-up": { max: 3, windowMs: 60 * MIN },
  reset: { max: 3, windowMs: 60 * MIN },
  "magic-link": { max: 3, windowMs: 60 * MIN },
};

/** Auth path (after /api/auth) to the per-account action it counts against. */
export const GUARDED_PATHS: Record<string, GuardAction> = {
  "/sign-in/email": "sign-in",
  "/sign-up/email": "sign-up",
  "/request-password-reset": "reset",
  "/forget-password": "reset",
  "/sign-in/magic-link": "magic-link",
};

export interface AttemptRow {
  count: number;
  windowStart: number;
  lockedUntil: number | null;
}

export interface AttemptStore {
  get(key: string): Promise<AttemptRow | null>;
  set(key: string, row: AttemptRow): Promise<void>;
  delete(key: string): Promise<void>;
}

export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  return e.length > 3 && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

export const guardKey = (action: GuardAction, email: string) => `${action}:${email}`;

/** True when the account may try this action now. Sign-in is checked before, counted only on failure. */
export async function isAllowed(store: AttemptStore, action: GuardAction, email: string, now = Date.now()): Promise<boolean> {
  const rule = GUARD_RULES[action];
  const row = await store.get(guardKey(action, email));
  if (!row) return true;
  if (row.lockedUntil && row.lockedUntil > now) return false;
  if (now - row.windowStart >= rule.windowMs) return true;
  return action === "sign-in" ? !row.lockedUntil || row.lockedUntil <= now : row.count < rule.max;
}

/** Count one attempt (a failed sign-in, or any sign-up/reset/magic-link request). */
export async function recordAttempt(store: AttemptStore, action: GuardAction, email: string, now = Date.now()): Promise<void> {
  const rule = GUARD_RULES[action];
  const key = guardKey(action, email);
  const row = await store.get(key);
  const fresh = !row || now - row.windowStart >= rule.windowMs || (row.lockedUntil !== null && row.lockedUntil <= now && row.count >= rule.max);
  const next: AttemptRow = fresh ? { count: 1, windowStart: now, lockedUntil: null } : { ...row!, count: row!.count + 1 };
  if (rule.lockMs && next.count >= rule.max) next.lockedUntil = now + rule.lockMs;
  await store.set(key, next);
}

export async function clearAttempts(store: AttemptStore, action: GuardAction, email: string): Promise<void> {
  await store.delete(guardKey(action, email));
}

/** Same body for every refusal so the response never says whether the account exists. */
export function tooManyResponse(): Response {
  return new Response(JSON.stringify({ code: "TOO_MANY_REQUESTS", message: "Too many attempts. Try again later." }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": "900" },
  });
}

export function memoryStore(): AttemptStore & { rows: Map<string, AttemptRow> } {
  const rows = new Map<string, AttemptRow>();
  return {
    rows,
    get: async (k) => rows.get(k) ?? null,
    set: async (k, r) => void rows.set(k, r),
    delete: async (k) => void rows.delete(k),
  };
}
