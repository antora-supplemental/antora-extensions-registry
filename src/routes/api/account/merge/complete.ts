import { auth } from "~/server/auth";
import { isFresh, mergeUsers, MERGE_COOKIE, readCookie, readMergeIntent } from "~/server/account-merge";

const back = (status: string) =>
  new Response(null, {
    status: 302,
    headers: {
      Location: `/auth/account?merge=${encodeURIComponent(status)}`,
      "Set-Cookie": `${MERGE_COOKIE}=; Path=/api/account/merge; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    },
  });

/** Step 2: OAuth callback lands here signed in as account B; merge B into the account A from the intent. */
export async function GET({ request }: { request: Request }) {
  const targetId = readMergeIntent(readCookie(request, MERGE_COOKIE));
  if (!targetId) return back("expired");
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user || !isFresh(session.session.createdAt)) return back("reauth");
  if (session.user.id === targetId) return back("same");
  try {
    await mergeUsers(targetId, session.user.id);
    return back("done");
  } catch (err) {
    console.error("[account-merge]", err);
    return back("failed");
  }
}
