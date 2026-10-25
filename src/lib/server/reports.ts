import { getRequestEvent } from 'solid-js/web';
import { REPORT_MESSAGE_MAX, REPORT_REASONS, type ReportReason } from '~/lib/report-reasons';

const REPORTS_PER_DAY = 10;

export interface ReportResult {
  ok: boolean;
  message: string;
}

/** Strip control characters (keeps newlines and tabs) so user text is safe in a plain-text email. */
function plain(text: string): string {
  // Drop control characters (keeping tab and newline) and bidi overrides.
  return Array.from(text.replace(/\r\n?/g, '\n'))
    .filter((ch) => {
      const c = ch.codePointAt(0) ?? 0;
      if (c === 9 || c === 10) return true;
      return !(c < 32 || c === 127 || (c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069));
    })
    .join('');
}

async function sendReportEmail(body: { subject: string; text: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[registry] RESEND_API_KEY is not set; report stored without an email.');
    return;
  }
  const from = process.env.REPORT_EMAIL_FROM;
  if (!from) {
    console.warn('[registry] REPORT_EMAIL_FROM is not set; report stored without an email.');
    return;
  }
  const to = process.env.REPORT_EMAIL_TO || 'support@antora-supplemental.org';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: plain(body.subject).replace(/\n/g, ' ').slice(0, 200), text: body.text }),
    });
    if (!res.ok) console.error(`[registry] report email failed: ${res.status} ${await res.text()}`);
  } catch (error) {
    console.error('[registry] report email failed:', error);
  }
}

/** Signed-in users report a listed extension or theme. One open report per user per item. */
export async function submitReport(input: {
  itemKind: 'extension' | 'theme';
  itemId: string;
  itemName: string;
  reason: ReportReason;
  message?: string;
}): Promise<ReportResult> {
  'use server';
  const event = getRequestEvent();
  if (!event) return { ok: false, message: 'No request.' };
  const { auth } = await import('~/server/auth');
  const session = await auth.api.getSession({ headers: event.request.headers });
  const user = session?.user;
  if (!user) return { ok: false, message: 'Sign in to report.' };

  const kind = input.itemKind === 'theme' ? 'theme' : input.itemKind === 'extension' ? 'extension' : null;
  const reason = REPORT_REASONS.find((r) => r.value === input.reason);
  const itemId = String(input.itemId ?? '').slice(0, 300);
  if (!kind || !reason || !itemId) return { ok: false, message: 'Pick a reason.' };
  const message = plain(String(input.message ?? '')).trim();
  if (message.length > REPORT_MESSAGE_MAX) return { ok: false, message: `Keep the message under ${REPORT_MESSAGE_MAX} characters.` };
  const itemName = plain(String(input.itemName ?? itemId)).slice(0, 200);

  const { client } = await import('~/server/db');
  const open = await client.execute({
    sql: "SELECT id FROM report WHERE reporterId = ? AND itemKind = ? AND itemId = ? AND status = 'open' LIMIT 1",
    args: [user.id, kind, itemId],
  });
  if (open.rows[0]) return { ok: false, message: 'You already have an open report for this. We\u2019ll look at it.' };
  const since = Math.floor(Date.now() / 1000) - 86400;
  const n = Number((await client.execute({ sql: 'SELECT COUNT(*) AS n FROM report WHERE reporterId = ? AND createdAt > ?', args: [user.id, since] })).rows[0]?.n ?? 0);
  if (n >= REPORTS_PER_DAY) return { ok: false, message: `You've sent ${REPORTS_PER_DAY} reports today. Try again tomorrow.` };

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await client.execute({
    sql: "INSERT INTO report (id, itemKind, itemId, itemName, reporterId, reason, message, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)",
    args: [id, kind, itemId, itemName, user.id, reason.value, message || null, now, now],
  });

  const site = process.env.BETTER_AUTH_URL ?? 'https://registry.antora-supplemental.org';
  await sendReportEmail({
    subject: `Registry report: ${reason.label} \u2013 ${itemName}`,
    text: [
      `A ${kind} was reported on the Antora Registry.`,
      '',
      `Item: ${itemName} (${itemId})`,
      `Reason: ${reason.label}`,
      `Reporter: ${plain(user.name ?? '')} <${plain(user.email ?? '')}> (user ${user.id})`,
      '',
      'Message:',
      message || '(none)',
      '',
      `Review: ${site}/admin#reports`,
    ].join('\n'),
  });
  return { ok: true, message: 'Thanks. Your report was sent to the registry admins.' };
}

export interface AdminReport {
  id: string;
  itemKind: string;
  itemId: string;
  itemName: string;
  reason: string;
  message: string | null;
  reporter: string;
  createdAt: string;
}

/** Resolve or dismiss a report. Admin-only; checked on the server. */
export async function closeReport(id: string, status: 'resolved' | 'dismissed'): Promise<ReportResult> {
  'use server';
  const event = getRequestEvent();
  if (!event) return { ok: false, message: 'No request.' };
  const { auth } = await import('~/server/auth');
  const { isAdminUser } = await import('~/server/admin');
  const session = await auth.api.getSession({ headers: event.request.headers });
  if (!(await isAdminUser(session?.user?.id))) return { ok: false, message: 'Admins only.' };
  if (status !== 'resolved' && status !== 'dismissed') return { ok: false, message: 'Unknown status.' };
  const { client } = await import('~/server/db');
  await client.execute({
    sql: 'UPDATE report SET status = ?, resolvedBy = ?, updatedAt = ? WHERE id = ?',
    args: [status, session!.user.id, Math.floor(Date.now() / 1000), id],
  });
  return { ok: true, message: status === 'resolved' ? 'Report resolved.' : 'Report dismissed.' };
}
