import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { accounts, sessions, users } from "./db/schema";

/**
 * Called after an OAuth account is linked. If the user's email was never verified and a password exists,
 * the password may belong to someone who registered this email first, so remove it and end its sessions.
 * The OAuth provider then marks the email verified via better-auth's linking rules.
 */
export async function removeUnverifiedPassword(userId: string): Promise<void> {
  const [user] = await db.select({ emailVerified: users.emailVerified }).from(users).where(eq(users.id, userId));
  if (!user || user.emailVerified) return;
  const removed = await db
    .delete(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
    .returning({ id: accounts.id });
  if (removed.length) await db.delete(sessions).where(eq(sessions.userId, userId));
}
