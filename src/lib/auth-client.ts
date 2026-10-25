import { createAuthClient } from "better-auth/client";
import { genericOAuthClient, magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [magicLinkClient(), genericOAuthClient()],
});

/** Providers served by the genericOAuth (OIDC) plugin instead of built-in socialProviders. */
const oidcProviders = new Set(["gitlab"]);

export const signInWithProvider = (provider: string, callbackURL: string) =>
  oidcProviders.has(provider)
    ? authClient.signIn.oauth2({ providerId: provider, callbackURL })
    : authClient.signIn.social({ provider: provider as "github", callbackURL });

export const linkProvider = (provider: string, callbackURL: string) =>
  oidcProviders.has(provider)
    ? authClient.oauth2.link({ providerId: provider, callbackURL })
    : authClient.linkSocial({ provider: provider as "github", callbackURL });

