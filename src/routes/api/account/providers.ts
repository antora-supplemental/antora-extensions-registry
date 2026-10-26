import { configuredProviderIds } from "~/server/auth-providers";

/** Public: which sign-in methods are configured, so the UI only offers working ones. */
export async function GET() {
  const { authFeatures } = await import("~/server/auth");
  return new Response(JSON.stringify({ providers: configuredProviderIds(), ...authFeatures }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
  });
}
