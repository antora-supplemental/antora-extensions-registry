/**
 * Outgoing auth email (magic link, email verification, password reset) through the Resend HTTP API.
 * Uses RESEND_API_KEY and EMAIL_FROM. Nothing here logs the key or the link in production.
 */

export type AuthEmailKind = "magic-link" | "verify-email" | "reset-password" | "set-password";

export interface AuthEmailEnv {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  AUTH_EMAIL_VERIFICATION?: string;
  NODE_ENV?: string;
}

const truthy = (v?: string) => v === "true" || v === "1";

/** Resend can send when both the key and a sender are configured. */
export function authEmailConfigured(env: AuthEmailEnv): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

/**
 * Feature flag: require a verified email for password accounts, and enable password reset and
 * "set a password" linking for existing accounts. Off unless AUTH_EMAIL_VERIFICATION=true AND email can be sent.
 */
export function emailVerificationEnabled(env: AuthEmailEnv): boolean {
  return truthy(env.AUTH_EMAIL_VERIFICATION) && authEmailConfigured(env);
}

const COPY: Record<AuthEmailKind, { subject: string; lead: string; action: string }> = {
  "magic-link": { subject: "Your sign-in link", lead: "Use this link to sign in to the Antora Extensions Registry. It expires in 5 minutes.", action: "Sign in" },
  "verify-email": { subject: "Confirm your email", lead: "Confirm this email address to finish creating your Antora Extensions Registry account.", action: "Confirm email" },
  "reset-password": { subject: "Reset your password", lead: "Someone asked to reset the password for this email on the Antora Extensions Registry. If it wasn't you, ignore this email.", action: "Reset password" },
  "set-password": { subject: "Set a password for your account", lead: "Someone tried to create a password account with this email, which already has an Antora Extensions Registry account. To add a password to your existing account, use this link. If it wasn't you, ignore this email.", action: "Set a password" },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderAuthEmail(kind: AuthEmailKind, url: string) {
  const c = COPY[kind];
  const text = `${c.lead}\n\n${c.action}: ${url}\n\nAntora Extensions Registry - https://registry.antora-supplemental.org`;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#262626;max-width:520px">
<p>${esc(c.lead)}</p>
<p><a href="${esc(url)}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#c2410c;color:#ffffff;text-decoration:none;font-weight:600">${esc(c.action)}</a></p>
<p style="font-size:13px;color:#525252">Or paste this link into your browser:<br>${esc(url)}</p>
</div>`;
  return { subject: c.subject, text, html };
}

export async function sendAuthEmail(
  env: AuthEmailEnv,
  to: string,
  kind: AuthEmailKind,
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!authEmailConfigured(env)) {
    if (env.NODE_ENV === "development") {
      console.info(`[auth] ${kind} for ${to}: ${url}`);
      return;
    }
    throw new Error("Auth email is not configured (RESEND_API_KEY and EMAIL_FROM).");
  }
  const { subject, text, html } = renderAuthEmail(kind, url);
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text, html }),
  });
  if (!res.ok) {
    // Resend's error body names the problem (e.g. unverified domain) and never echoes the key.
    const detail = (await res.text()).slice(0, 300);
    console.error(`[auth] ${kind} email failed: ${res.status} ${detail}`);
    throw new Error("Could not send email.");
  }
}
