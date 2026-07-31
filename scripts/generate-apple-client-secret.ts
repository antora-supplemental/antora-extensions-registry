#!/usr/bin/env tsx
/**
 * Generate an Apple Sign In client secret JWT (valid ~6 months).
 * Store the output in APPLE_CLIENT_SECRET.
 *
 * Usage:
 *   APPLE_CLIENT_ID=... APPLE_TEAM_ID=... APPLE_KEY_ID=... APPLE_PRIVATE_KEY="$(cat AuthKey.p8)" pnpm exec tsx scripts/generate-apple-client-secret.ts
 */
import { generateAppleClientSecret } from "../src/server/apple-client-secret";

const clientId = process.env.APPLE_CLIENT_ID;
const teamId = process.env.APPLE_TEAM_ID;
const keyId = process.env.APPLE_KEY_ID;
const privateKey = process.env.APPLE_PRIVATE_KEY;

if (!clientId || !teamId || !keyId || !privateKey) {
  console.error("Set APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, and APPLE_PRIVATE_KEY");
  process.exit(1);
}

const secret = await generateAppleClientSecret(clientId, teamId, keyId, privateKey);
console.log(secret);
