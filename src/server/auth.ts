import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth, haveIBeenPwned, magicLink } from "better-auth/plugins";
import { serverEnv } from "~/env/server";
import { authEmailConfigured, emailVerificationEnabled, sendAuthEmail } from "./auth-email";
import { buildOidcProviders, buildSocialProviders, configuredProviderIds } from "./auth-providers";
import { db } from "./db";
import * as schema from "./db/schema";
import { hashPassword, verifyPassword } from "./password";

const trustedOrigins = [
  "https://appleid.apple.com",
  ...(serverEnv.BETTER_AUTH_TRUSTED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? []),
];

const emailReady = authEmailConfigured(serverEnv);
const verifyEmails = emailVerificationEnabled(serverEnv);

export const PASSWORD_MIN_LENGTH = 12;

export const auth = betterAuth({
  secret: serverEnv.BETTER_AUTH_SECRET,
  baseURL: serverEnv.BETTER_AUTH_URL,
  trustedOrigins,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
      rateLimit: schema.rateLimits,
    },
  }),
  advanced: {
    // Netlify's real client IP header first; x-forwarded-for as the fallback.
    ipAddress: { ipAddressHeaders: ["x-nf-client-connection-ip", "x-forwarded-for"] },
  },
  // Per-IP limits (stored in Turso so they hold across function instances). Per-account limits: api/auth/[...all].ts.
  rateLimit: {
    enabled: serverEnv.NODE_ENV !== "test",
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 3600, max: 10 },
      "/request-password-reset": { window: 3600, max: 5 },
      "/forget-password": { window: 3600, max: 5 },
      "/sign-in/magic-link": { window: 3600, max: 5 },
      "/send-verification-email": { window: 3600, max: 5 },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: 256,
    password: { hash: hashPassword, verify: verifyPassword },
    // Verification is a feature flag (AUTH_EMAIL_VERIFICATION) until the Resend sending domain is verified.
    requireEmailVerification: verifyEmails,
    // No auto sign-in: a sign-up for an existing email gets the same response as a new one (no enumeration);
    // the client signs in right after.
    autoSignIn: false,
    revokeSessionsOnPasswordReset: true,
    ...(verifyEmails
      ? {
          sendResetPassword: async ({ user, url }) => sendAuthEmail(serverEnv, user.email, "reset-password", url),
          // Existing (e.g. GitHub) account: link a password only after the owner proves the inbox, via a set-password link.
          onExistingUserSignUp: async ({ user }) => {
            await auth.api.requestPasswordReset({ body: { email: user.email, redirectTo: "/auth/reset-password?set=1" } });
          },
        }
      : {}),
  },
  ...(verifyEmails
    ? {
        emailVerification: {
          sendOnSignUp: true,
          autoSignInAfterVerification: true,
          sendVerificationEmail: async ({ user, url }) => sendAuthEmail(serverEnv, user.email, "verify-email", url),
        },
      }
    : {}),
  user: { deleteUser: { enabled: true } },
  account: {
    accountLinking: {
      enabled: true,
      // Auto-link only when the provider reports a verified email that matches the existing user.
      allowDifferentEmails: false,
      // GitHub is trusted (better-auth only uses its verified primary email). GitLab (OIDC) is not listed,
      // so it auto-links only when the ID token/userinfo says email_verified: true.
      trustedProviders: configuredProviderIds().filter((id) => id === "github"),
    },
  },
  databaseHooks: {
    account: {
      create: {
        // Pre-hijack guard: when a provider with a verified email links to a user whose email was never verified,
        // drop the unverified password (someone else may have registered it) and sign out its sessions.
        after: async (account) => {
          if (account.providerId === "credential") return;
          const { removeUnverifiedPassword } = await import("./account-merge-password");
          await removeUnverifiedPassword(account.userId);
        },
      },
    },
  },
  socialProviders: buildSocialProviders(),
  plugins: [
    haveIBeenPwned({ customPasswordCompromisedMessage: "Choose a different password: this one appears in known data breaches." }),
    ...(buildOidcProviders().length ? [genericOAuth({ config: buildOidcProviders() })] : []),
    ...(emailReady || serverEnv.NODE_ENV === "development"
      ? [magicLink({ sendMagicLink: async ({ email, url }) => sendAuthEmail(serverEnv, email, "magic-link", url) })]
      : []),
  ],
});

/** Public flags for the sign-in UI. */
export const authFeatures = { password: true, magicLink: emailReady, emailVerification: verifyEmails, passwordReset: verifyEmails };

export type Session = typeof auth.$Infer.Session;
