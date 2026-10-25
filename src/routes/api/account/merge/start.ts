import { auth } from "~/server/auth";
import { createMergeIntent, isFresh, MERGE_COOKIE } from "~/server/account-merge";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

/** Step 1: signed-in account A (fresh sign-in required) records a short-lived, signed merge intent. */
export async function POST({ request }: { request: Request }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return json({ error: "Unauthorized" }, 401);
  if (!isFresh(session.session.createdAt)) {
    return json({ error: "reauth", message: "Sign in again (within the last 10 minutes) before merging accounts." }, 403);
  }
  const token = createMergeIntent(session.user.id);
  return json({ ok: true }, 200, {
    "Set-Cookie": `${MERGE_COOKIE}=${token}; Path=/api/account/merge; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  });
}
