import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { serverEnv } from "~/env/server";
import { db } from "./db";
import { accounts, accountMergeAudit, extensionRepos, extensions, sessions, themes, users } from "./db/schema";

export const MERGE_COOKIE = "registry_merge_intent";
/** Both sign-ins must be at most this old when the merge is started / completed. */
export const FRESH_AUTH_MS = 10 * 60 * 1000;

const sign = (payload: string) =>
  createHmac("sha256", serverEnv.BETTER_AUTH_SECRET).update(payload).digest("base64url");

export function createMergeIntent(targetUserId: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ t: targetUserId, exp: now + FRESH_AUTH_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readMergeIntent(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { t: string; exp: number };
    return data.exp > now && typeof data.t === "string" ? data.t : null;
  } catch {
    return null;
  }
}

export const isFresh = (createdAt: Date | string | number, now = Date.now()) =>
  now - new Date(createdAt).getTime() <= FRESH_AUTH_MS;

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

/**
 * Merge user `sourceId` (B) into `targetId` (A) in one transaction:
 * B's sign-ins, sessions and registry ownership move to A, A's profile is kept, B is deleted, an audit row is written.
 */
export async function mergeUsers(targetId: string, sourceId: string, database = db) {
  if (targetId === sourceId) throw new Error("Both sign-ins already belong to the same account.");
  return database.transaction(async (tx) => {
    const [target] = await tx.select().from(users).where(eq(users.id, targetId));
    const [source] = await tx.select().from(users).where(eq(users.id, sourceId));
    if (!target || !source) throw new Error("One of the accounts no longer exists.");

    const moved = await tx.select({ providerId: accounts.providerId }).from(accounts).where(eq(accounts.userId, sourceId));
    await tx.update(accounts).set({ userId: targetId }).where(eq(accounts.userId, sourceId));
    await tx.update(sessions).set({ userId: targetId }).where(eq(sessions.userId, sourceId));
    await tx.update(extensions).set({ authorId: targetId }).where(eq(extensions.authorId, sourceId));
    await tx.update(extensionRepos).set({ submittedBy: targetId }).where(eq(extensionRepos.submittedBy, sourceId));
    await tx.update(themes).set({ authorId: targetId }).where(eq(themes.authorId, sourceId));

    await tx.insert(accountMergeAudit).values({
      id: crypto.randomUUID(),
      targetUserId: targetId,
      sourceUserId: sourceId,
      sourceEmail: source.email ?? null,
      movedProviders: JSON.stringify(moved.map((m) => m.providerId)),
      createdAt: new Date(),
    });
    await tx.delete(users).where(eq(users.id, sourceId));
    return { targetId, sourceId, movedProviders: moved.map((m) => m.providerId) };
  });
}
