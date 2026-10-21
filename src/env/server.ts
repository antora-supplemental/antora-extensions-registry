import { serverScheme } from "./schema";
import type { ZodFormattedError } from "zod";

export const formatErrors = (
  errors: ZodFormattedError<Map<string, string>, string>
) =>
  Object.entries(errors)
    .map(([name, value]) => {
      if (value && "_errors" in value)
        return `${name}: ${value._errors.join(", ")}\n`;
    })
    .filter(Boolean);

function netlifyHost(): string {
  return (
    process.env.URL ||
    process.env.DEPLOY_URL ||
    "https://antora-extensions-registry.netlify.app"
  );
}

function isNetlifyRuntime(): boolean {
  return (
    process.env.NETLIFY === "true" ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    Boolean(process.env.NETLIFY_DEV)
  );
}

function catalogOnlyBootstrap(): boolean {
  if (
    process.env.REGISTRY_CATALOG_ONLY === "true" ||
    process.env.REGISTRY_CATALOG_ONLY === "1"
  ) {
    return true;
  }
  if (!isNetlifyRuntime()) return false;
  return !process.env.BETTER_AUTH_SECRET || !process.env.DB_URL;
}

function bootstrapCatalogOnlyEnv() {
  console.warn(
    "[registry] Catalog-only bootstrap: set Netlify env (BETTER_AUTH_SECRET, DB_URL, DB_AUTH_TOKEN) for auth and DB search.",
  );
  return serverScheme.parse({
    ...process.env,
    NODE_ENV: "production",
    REGISTRY_CATALOG_ONLY: "true",
    BETTER_AUTH_SECRET:
      process.env.BETTER_AUTH_SECRET ||
      "catalog-only-placeholder-not-for-auth-use",
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || netlifyHost(),
    DB_URL: process.env.DB_URL || "file::memory:?cache=shared",
  });
}

const parsed = serverScheme.safeParse(process.env);

export const serverEnv =
  parsed.success
    ? parsed.data
    : catalogOnlyBootstrap()
      ? bootstrapCatalogOnlyEnv()
      : (() => {
          console.error(
            "❌ Invalid environment variables:\n",
            ...formatErrors(parsed.error.format()),
          );
          throw new Error("Invalid environment variables");
        })();
