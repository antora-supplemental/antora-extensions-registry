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
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production" && !isRemoteLibSql(data.DB_URL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DB_URL"],
        message: "Production requires a remote LibSQL database (Turso). Use libsql://… not file:…",
      });
    }

    if (isRemoteLibSql(data.DB_URL) && !data.DB_AUTH_TOKEN) {
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
