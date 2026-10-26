import { client } from "./db";
import { AUTH_TABLES_SQL, type AttemptStore } from "./auth-guard";

let ready: Promise<void> | null = null;

/** Create the auth tables once per cold start (same SQL as drizzle/0001_password_auth.sql). */
export function ensureAuthTables(): Promise<void> {
  ready ??= client.batch(AUTH_TABLES_SQL, "write").then(() => undefined).catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

export const dbAttemptStore: AttemptStore = {
  async get(key) {
    const r = await client.execute({ sql: `SELECT count, windowStart, lockedUntil FROM auth_attempt WHERE key = ?`, args: [key] });
    const row = r.rows[0];
    return row ? { count: Number(row.count), windowStart: Number(row.windowStart), lockedUntil: row.lockedUntil == null ? null : Number(row.lockedUntil) } : null;
  },
  async set(key, row) {
    await client.execute({
      sql: `INSERT INTO auth_attempt (key, count, windowStart, lockedUntil) VALUES (?, ?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET count = excluded.count, windowStart = excluded.windowStart, lockedUntil = excluded.lockedUntil`,
      args: [key, row.count, row.windowStart, row.lockedUntil],
    });
  },
  async delete(key) {
    await client.execute({ sql: `DELETE FROM auth_attempt WHERE key = ?`, args: [key] });
  },
};
