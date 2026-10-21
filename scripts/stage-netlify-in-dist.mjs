import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
} from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const netlifyOut = join(repoRoot, ".netlify");
const distDir = join(repoRoot, "dist");
const dest = join(distDir, ".netlify");

function materializeEntry(entryPath) {
  let target;
  const stat = lstatSync(entryPath);
  if (stat.isSymbolicLink()) {
    target = readlinkSync(entryPath);
  } else if (stat.isFile()) {
    const text = readFileSync(entryPath, "utf8").trim();
    if (!text.includes("node_modules") && !text.includes(".nitro")) {
      return false;
    }
    target = text;
  } else {
    return false;
  }

  const resolved = resolve(dirname(entryPath), target);
  if (!existsSync(resolved)) {
    console.warn(
      `[registry] Skip materialize ${entryPath}: target missing (${resolved})`,
    );
    return false;
  }

  rmSync(entryPath, { force: true, recursive: true });
  cpSync(resolved, entryPath, { recursive: true });
  return true;
}

function materializeNodeModules(nmDir) {
  if (!existsSync(nmDir)) return;

  for (let pass = 0; pass < 12; pass += 1) {
    let changed = false;
    for (const name of readdirSync(nmDir)) {
      const entryPath = join(nmDir, name);
      try {
        if (materializeEntry(entryPath)) changed = true;
      } catch (error) {
        console.warn(`[registry] Materialize failed for ${entryPath}:`, error);
      }
    }
    if (!changed) break;
  }
}

function rebuildServerZip() {
  const serverDir = join(netlifyOut, "functions-internal/server");
  const zipPath = join(netlifyOut, "functions/server.zip");
  if (!existsSync(serverDir)) return;

  materializeNodeModules(join(serverDir, "node_modules"));
  mkdirSync(dirname(zipPath), { recursive: true });
  const tempZip = `${zipPath}.next`;

  try {
    rmSync(tempZip, { force: true });
    execSync(`zip -r -q "${tempZip}" .`, { cwd: serverDir, stdio: "pipe" });
    rmSync(zipPath, { force: true });
    cpSync(tempZip, zipPath);
    rmSync(tempZip, { force: true });
    console.log("[registry] Rebuilt server.zip with materialized node_modules.");
  } catch {
    rmSync(tempZip, { force: true });
    console.warn(
      "[registry] zip CLI unavailable; kept Nitro server.zip (deps materialized in functions-internal only).",
    );
  }
}

if (!existsSync(netlifyOut)) {
  console.warn("[registry] No .netlify build output; SSR functions were not staged.");
  process.exit(0);
}

rebuildServerZip();
mkdirSync(distDir, { recursive: true });
cpSync(netlifyOut, dest, { recursive: true });
console.log("[registry] Staged .netlify SSR artifacts into dist/.netlify for deploy.");
