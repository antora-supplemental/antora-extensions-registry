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

  if (serverEnv.GITLAB_ID && serverEnv.GITLAB_SECRET) {
    providers.gitlab = {
      clientId: serverEnv.GITLAB_ID,
      clientSecret: serverEnv.GITLAB_SECRET,
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
