import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { serverEnv } from "~/env/server";
import { buildSocialProviders, configuredProviderIds } from "./auth-providers";
import { db } from "./db";
import * as schema from "./db/schema";

const trustedOrigins = [
  "https://appleid.apple.com",
  ...(serverEnv.BETTER_AUTH_TRUSTED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? []),
];

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
    },
  }),
  account: {
    accountLinking: {
      enabled: true,
      allowDifferentEmails: true,
      trustedProviders: configuredProviderIds(),
    },
  },
  socialProviders: buildSocialProviders(),
  plugins: serverEnv.EMAIL_SERVER && serverEnv.EMAIL_FROM
    ? [
        magicLink({
          sendMagicLink: async ({ email, url }) => {
            if (serverEnv.NODE_ENV === "development") {
              console.info(`[auth] Magic link for ${email}: ${url}`);
              return;
            }

            throw new Error(
              "Magic link email is not configured for production. Wire sendMagicLink to your mail provider.",
            );
          },
        }),
      ]
    : [],
});

export type Session = typeof auth.$Infer.Session;
