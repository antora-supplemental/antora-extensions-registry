import type { betterAuth } from "better-auth";
import { serverEnv } from "~/env/server";

type SocialProviders = NonNullable<Parameters<typeof betterAuth>[0]["socialProviders"]>;

export function buildSocialProviders(): SocialProviders {
  const providers: SocialProviders = {};

  if (serverEnv.GITHUB_ID && serverEnv.GITHUB_SECRET) {
    providers.github = {
      clientId: serverEnv.GITHUB_ID,
      clientSecret: serverEnv.GITHUB_SECRET,
    };
  }


  if (serverEnv.GOOGLE_ID && serverEnv.GOOGLE_SECRET) {
    providers.google = {
      clientId: serverEnv.GOOGLE_ID,
      clientSecret: serverEnv.GOOGLE_SECRET,
    };
  }

  if (serverEnv.MICROSOFT_ID && serverEnv.MICROSOFT_SECRET) {
    providers.microsoft = {
      clientId: serverEnv.MICROSOFT_ID,
      clientSecret: serverEnv.MICROSOFT_SECRET,
    };
  }

  if (serverEnv.APPLE_CLIENT_ID && serverEnv.APPLE_CLIENT_SECRET) {
    providers.apple = {
      clientId: serverEnv.APPLE_CLIENT_ID,
      clientSecret: serverEnv.APPLE_CLIENT_SECRET,
      appBundleIdentifier: serverEnv.APPLE_APP_BUNDLE_IDENTIFIER,
    };
  }

  return providers;
}

export const configuredProviderIds = () => {
  const ids: string[] = [];
  if (serverEnv.GITHUB_ID && serverEnv.GITHUB_SECRET) ids.push("github");
  if (serverEnv.GITLAB_ID && serverEnv.GITLAB_SECRET) ids.push("gitlab");
  if (serverEnv.GOOGLE_ID && serverEnv.GOOGLE_SECRET) ids.push("google");
  if (serverEnv.MICROSOFT_ID && serverEnv.MICROSOFT_SECRET) ids.push("microsoft");
  if (serverEnv.APPLE_CLIENT_ID && serverEnv.APPLE_CLIENT_SECRET) ids.push("apple");
  if (serverEnv.EMAIL_SERVER && serverEnv.EMAIL_FROM) ids.push("magic-link");
  return ids;
};

/** GitLab via OpenID Connect (genericOAuth). Callback: {BETTER_AUTH_URL}/api/auth/oauth2/callback/gitlab */
export function buildOidcProviders() {
  if (!serverEnv.GITLAB_ID || !serverEnv.GITLAB_SECRET) return [];
  const issuer = (serverEnv.GITLAB_ISSUER ?? "https://gitlab.com").replace(/\/+$/, "");
  return [
    {
      providerId: "gitlab",
      clientId: serverEnv.GITLAB_ID,
      clientSecret: serverEnv.GITLAB_SECRET,
      discoveryUrl: `${issuer}/.well-known/openid-configuration`,
      issuer,
      scopes: ["openid", "profile", "email"],
      pkce: true,
      mapProfileToUser: (profile: Record<string, unknown>) => ({
        id: String(profile.sub),
        email: profile.email as string | undefined,
        emailVerified: profile.email_verified === true,
        name: (profile.name as string | undefined) ?? (profile.nickname as string | undefined),
        image: profile.picture as string | undefined,
      }),
    },
  ];
}
