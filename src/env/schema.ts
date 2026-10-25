import { z } from "zod";

const isRemoteLibSql = (url: string) =>
  url.startsWith("libsql://") || url.startsWith("https://") || url.startsWith("http://");

export const serverScheme = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    GITHUB_ID: z.string().optional(),
    GITHUB_SECRET: z.string().optional(),
    GITLAB_ID: z.string().optional(),
    GITLAB_SECRET: z.string().optional(),
    /** OIDC issuer for GitLab sign-in; set for self-managed GitLab. Defaults to https://gitlab.com. */
    GITLAB_ISSUER: z.string().url().optional(),
    GOOGLE_ID: z.string().optional(),
    GOOGLE_SECRET: z.string().optional(),
    MICROSOFT_ID: z.string().optional(),
    MICROSOFT_SECRET: z.string().optional(),
    APPLE_CLIENT_ID: z.string().optional(),
    APPLE_CLIENT_SECRET: z.string().optional(),
    APPLE_APP_BUNDLE_IDENTIFIER: z.string().optional(),
    EMAIL_SERVER: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    BETTER_AUTH_SECRET: z.string(),
    BETTER_AUTH_URL: z.string().url(),
    BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional(),
    DB_URL: z.string().default("file:local.db"),
    DB_AUTH_TOKEN: z.string().optional(),
    GITHUB_TOKEN: z.string().optional(),
    /** Comma-separated GitHub logins allowed into /admin (e.g. "AMDphreak"). */
    ADMIN_GITHUB_LOGINS: z.string().optional(),
    /** Resend API key for report notification emails; when unset, reports are stored but not emailed. */
    RESEND_API_KEY: z.string().optional(),
    /** Verified sender for report emails, e.g. "Antora Registry <reports@antora-supplemental.org>". */
    REPORT_EMAIL_FROM: z.string().optional(),
    /** Where report emails go. Defaults to support@antora-supplemental.org. */
    REPORT_EMAIL_TO: z.string().optional(),
    REGISTRY_CATALOG_ONLY: z.enum(["true", "false", "0", "1"]).optional(),
  })
  .superRefine((data, ctx) => {
    const catalogOnly =
      data.REGISTRY_CATALOG_ONLY === "true" ||
      data.REGISTRY_CATALOG_ONLY === "1";

    if (
      data.NODE_ENV === "production" &&
      !catalogOnly &&
      !isRemoteLibSql(data.DB_URL)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DB_URL"],
        message: "Production requires a remote LibSQL database (Turso). Use libsql://… not file:…",
      });
    }

    if (isRemoteLibSql(data.DB_URL) && !data.DB_AUTH_TOKEN && !catalogOnly) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DB_AUTH_TOKEN"],
        message: "DB_AUTH_TOKEN is required for remote LibSQL databases",
      });
    }
  });

export const clientScheme = z.object({
  MODE: z.enum(["development", "production", "test"]).default("development"),
});
