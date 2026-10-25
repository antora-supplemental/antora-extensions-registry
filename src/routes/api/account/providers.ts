import { configuredProviderIds } from "~/server/auth-providers";

/** Public: which sign-in providers are configured, so the UI only offers working buttons. */
export function GET() {
  return new Response(JSON.stringify({ providers: configuredProviderIds() }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
  });
}
