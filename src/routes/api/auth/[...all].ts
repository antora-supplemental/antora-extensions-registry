import type { APIEvent } from "@solidjs/start/server";
import { toSolidStartHandler } from "better-auth/solid-start";
import { auth } from "~/server/auth";
import { clearAttempts, GUARDED_PATHS, isAllowed, normalizeEmail, recordAttempt, tooManyResponse } from "~/server/auth-guard";
import { dbAttemptStore, ensureAuthTables } from "~/server/auth-guard-db";

const handler = toSolidStartHandler(auth);

export async function GET(event: APIEvent) {
  await ensureAuthTables();
  return handler.GET(event);
}

/** Per-account limits on the email routes (better-auth's limiter, configured in auth.ts, covers per IP). */
export async function POST(event: APIEvent) {
  await ensureAuthTables();
  const path = new URL(event.request.url).pathname.replace(/^\/api\/auth/, "");
  const action = GUARDED_PATHS[path];
  if (!action) return handler.POST(event);

  let email: string | null = null;
  try {
    email = normalizeEmail(((await event.request.clone().json()) as { email?: unknown }).email);
  } catch {
    email = null;
  }
  if (!email) return handler.POST(event);
  if (!(await isAllowed(dbAttemptStore, action, email))) return tooManyResponse();

  const res = await handler.POST(event);
  if (action === "sign-in") {
    if (res.ok) await clearAttempts(dbAttemptStore, action, email);
    else if (res.status === 401 || res.status === 403) await recordAttempt(dbAttemptStore, action, email);
  } else {
    await recordAttempt(dbAttemptStore, action, email);
  }
  return res;
}
