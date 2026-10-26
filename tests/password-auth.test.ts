import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authEmailConfigured, emailVerificationEnabled, renderAuthEmail, sendAuthEmail } from '../src/server/auth-email';
import { clearAttempts, GUARD_RULES, GUARDED_PATHS, isAllowed, memoryStore, normalizeEmail, recordAttempt, tooManyResponse } from '../src/server/auth-guard';
import { hashPassword, verifyPassword } from '../src/server/password';
import { PASSWORD_MIN, passwordProblem } from '../src/lib/password-policy';

test('passwords are hashed with argon2id and verify only with the right password', async () => {
  const hash = await hashPassword('correct horse battery staple');
  assert.match(hash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.equal(await verifyPassword({ hash, password: 'correct horse battery staple' }), true);
  assert.equal(await verifyPassword({ hash, password: 'correct horse battery stapl' }), false);
  assert.notEqual(await hashPassword('correct horse battery staple'), hash, 'salted');
  assert.equal(await verifyPassword({ hash: 'scrypt:abc', password: 'x' }), false);
});

test('password policy is length-only, minimum 12, no composition rules', () => {
  assert.equal(PASSWORD_MIN, 12);
  assert.ok(passwordProblem('short pass1'));
  assert.equal(passwordProblem('alllowercaseletters'), null);
  assert.equal(passwordProblem('🙂🙂🙂🙂🙂🙂🙂🙂🙂🙂🙂🙂'), null);
});

test('emails are normalized to lowercase and junk is rejected', () => {
  assert.equal(normalizeEmail('  Ryan.J@Example.COM '), 'ryan.j@example.com');
  assert.equal(normalizeEmail('nope'), null);
  assert.equal(normalizeEmail(42), null);
});

test('per-account sign-in lock after 5 failures, cleared by a success', async () => {
  const store = memoryStore();
  const t0 = 1_000_000;
  for (let i = 0; i < 4; i++) await recordAttempt(store, 'sign-in', 'a@b.co', t0 + i);
  assert.equal(await isAllowed(store, 'sign-in', 'a@b.co', t0 + 5), true);
  await recordAttempt(store, 'sign-in', 'a@b.co', t0 + 6);
  assert.equal(await isAllowed(store, 'sign-in', 'a@b.co', t0 + 7), false);
  assert.equal(await isAllowed(store, 'sign-in', 'other@b.co', t0 + 7), true, 'per account');
  assert.equal(await isAllowed(store, 'sign-in', 'a@b.co', t0 + 6 + GUARD_RULES['sign-in'].lockMs!), true, 'lock expires');
  await clearAttempts(store, 'sign-in', 'a@b.co');
  assert.equal(store.rows.size, 0);
});

test('sign-up and reset requests are capped per account per hour', async () => {
  const store = memoryStore();
  for (let i = 0; i < 3; i++) await recordAttempt(store, 'reset', 'a@b.co', i);
  assert.equal(await isAllowed(store, 'reset', 'a@b.co', 10), false);
  assert.equal(await isAllowed(store, 'reset', 'a@b.co', GUARD_RULES.reset.windowMs + 10), true);
  assert.equal(GUARDED_PATHS['/sign-up/email'], 'sign-up');
  const res = tooManyResponse();
  assert.equal(res.status, 429);
  assert.doesNotMatch(await res.text(), /exist|unknown|not found/i);
});

test('verification is behind a flag and needs Resend configured', () => {
  assert.equal(authEmailConfigured({ RESEND_API_KEY: 'k' }), false);
  assert.equal(emailVerificationEnabled({ RESEND_API_KEY: 'k', EMAIL_FROM: 'a@b.co' }), false);
  assert.equal(emailVerificationEnabled({ RESEND_API_KEY: 'k', EMAIL_FROM: 'a@b.co', AUTH_EMAIL_VERIFICATION: 'true' }), true);
  assert.equal(emailVerificationEnabled({ AUTH_EMAIL_VERIFICATION: 'true' }), false);
});

test('auth email goes through the Resend API with an escaped link', async () => {
  let call: { url: string; init: RequestInit } | null = null;
  const fake = (async (url: string, init: RequestInit) => {
    call = { url, init };
    return new Response('{"id":"x"}', { status: 200 });
  }) as unknown as typeof fetch;
  await sendAuthEmail({ RESEND_API_KEY: 'test-key', EMAIL_FROM: 'Registry <auth@example.org>' }, 'u@x.io', 'magic-link', 'https://r.example/v?a=1&b=2', fake);
  assert.equal(call!.url, 'https://api.resend.com/emails');
  const body = JSON.parse(String(call!.init.body));
  assert.deepEqual(body.to, ['u@x.io']);
  assert.equal(body.from, 'Registry <auth@example.org>');
  assert.match(body.html, /a=1&amp;b=2/);
  assert.match(body.text, /a=1&b=2/);
  assert.equal(renderAuthEmail('reset-password', 'u').subject, 'Reset your password');
  const failing = (async () => new Response('{"message":"domain not verified"}', { status: 403 })) as unknown as typeof fetch;
  await assert.rejects(sendAuthEmail({ RESEND_API_KEY: 'k', EMAIL_FROM: 'a@b.co' }, 'u@x.io', 'verify-email', 'u', failing));
  await assert.rejects(sendAuthEmail({ NODE_ENV: 'production' }, 'u@x.io', 'magic-link', 'u'), /not configured/);
});
