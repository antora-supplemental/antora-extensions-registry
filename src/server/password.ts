import { argon2id, argon2Verify } from "hash-wasm";

/**
 * argon2id via WebAssembly (no native addon, so it runs in Netlify Functions).
 * OWASP minimum profile: 19 MiB memory, 2 iterations, 1 lane.
 */
export const ARGON2_PARAMS = { memorySize: 19456, iterations: 2, parallelism: 1, hashLength: 32 } as const;

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return argon2id({ password: password.normalize("NFKC"), salt, ...ARGON2_PARAMS, outputType: "encoded" });
}

export async function verifyPassword({ hash, password }: { hash: string; password: string }): Promise<boolean> {
  if (!hash.startsWith("$argon2id$")) return false;
  try {
    return await argon2Verify({ password: password.normalize("NFKC"), hash });
  } catch {
    return false;
  }
}
