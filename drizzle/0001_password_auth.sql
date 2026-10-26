-- Email + password sign-in: per-IP limiter storage for better-auth and a per-account attempt counter.
-- Idempotent; also applied at runtime by ensureAuthTables() in src/server/auth-guard.ts.
CREATE TABLE IF NOT EXISTS "rateLimit" (
  "id" text PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "count" integer NOT NULL,
  "lastRequest" integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "rateLimit_key_unique" ON "rateLimit" ("key");
CREATE TABLE IF NOT EXISTS "auth_attempt" (
  "key" text PRIMARY KEY NOT NULL,
  "count" integer NOT NULL,
  "windowStart" integer NOT NULL,
  "lockedUntil" integer
);
