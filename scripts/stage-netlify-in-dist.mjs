import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const netlifyOut = join(repoRoot, ".netlify");
const distDir = join(repoRoot, "dist");
const dest = join(distDir, ".netlify");

if (!existsSync(netlifyOut)) {
  console.warn("[registry] No .netlify build output; SSR functions were not staged.");
  process.exit(0);
}

mkdirSync(distDir, { recursive: true });
cpSync(netlifyOut, dest, { recursive: true });
console.log("[registry] Staged .netlify SSR artifacts into dist/.netlify for deploy.");
