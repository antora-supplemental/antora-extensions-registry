import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

/** Vinxi/Nitro often omit hoisted deps from the Lambda zip. */
const SERVER_BUNDLE_PACKAGES = ["pathe"];

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
        if (name.startsWith("@")) {
          const scopeDir = entryPath;
          if (existsSync(scopeDir) && lstatSync(scopeDir).isDirectory()) {
            for (const scoped of readdirSync(scopeDir)) {
              const scopedPath = join(scopeDir, scoped);
              try {
                if (materializeEntry(scopedPath)) changed = true;
              } catch (error) {
                console.warn(
                  `[registry] Materialize failed for ${scopedPath}:`,
                  error,
                );
              }
            }
          }
        }
        const nestedNm = join(entryPath, "node_modules");
        if (existsSync(nestedNm)) {
          materializeNodeModules(nestedNm);
        }
      } catch (error) {
        console.warn(`[registry] Materialize failed for ${entryPath}:`, error);
      }
    }
    if (!changed) break;
  }
}

function ensurePackageInNodeModules(nmDir, packageName) {
  const dest = join(nmDir, packageName);
  if (existsSync(dest)) return;

  let resolved;
  try {
    resolved = dirname(require.resolve(`${packageName}/package.json`));
  } catch {
    console.warn(`[registry] Cannot resolve ${packageName} from repo root.`);
    return;
  }

  cpSync(resolved, dest, { recursive: true });
  console.log(`[registry] Copied ${packageName} into server function bundle.`);
}

function ensureServerBundlePackages(serverDir) {
  const nmDir = join(serverDir, "node_modules");
  mkdirSync(nmDir, { recursive: true });
  materializeNodeModules(nmDir);
  for (const pkg of SERVER_BUNDLE_PACKAGES) {
    ensurePackageInNodeModules(nmDir, pkg);
  }
}

function zipServerDirectory(serverDir, zipPath) {
  mkdirSync(dirname(zipPath), { recursive: true });
  const tempZip = `${zipPath}.next`;
  rmSync(tempZip, { force: true });

  if (process.platform === "win32") {
    execSync(`tar.exe -a -cf "${tempZip}" -C "${serverDir}" .`, {
      stdio: "pipe",
    });
  } else {
    execSync(`zip -r -q "${tempZip}" .`, { cwd: serverDir, stdio: "pipe" });
  }

  rmSync(zipPath, { force: true });
  cpSync(tempZip, zipPath);
  rmSync(tempZip, { force: true });
}

function rebuildServerZip() {
  const serverDir = join(netlifyOut, "functions-internal/server");
  const zipPath = join(netlifyOut, "functions/server.zip");
  if (!existsSync(serverDir)) return;

  ensureServerBundlePackages(serverDir);

  try {
    zipServerDirectory(serverDir, zipPath);
    console.log("[registry] Rebuilt server.zip with materialized node_modules.");
  } catch (error) {
    console.warn("[registry] Failed to rebuild server.zip:", error);
    if (!existsSync(zipPath)) {
      throw new Error(
        "server.zip missing and rebuild failed; Netlify SSR will not deploy.",
      );
    }
  }
}

function normalizeFunctionsManifest(functionsDir) {
  const manifestPath = join(functionsDir, "manifest.json");
  if (!existsSync(manifestPath)) return;

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest.functions)) return;

  for (const fn of manifest.functions) {
    if (fn.path) fn.path = "server.zip";
    if (fn.mainFile) fn.mainFile = "server.mjs";
  }

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

if (!existsSync(netlifyOut)) {
  console.warn("[registry] No .netlify build output; SSR functions were not staged.");
  process.exit(0);
}

rebuildServerZip();
mkdirSync(distDir, { recursive: true });
cpSync(netlifyOut, dest, { recursive: true });
normalizeFunctionsManifest(join(dest, "functions"));

const stagedZip = join(dest, "functions/server.zip");
if (!existsSync(stagedZip)) {
  throw new Error(
    "[registry] dist/.netlify/functions/server.zip missing after staging.",
  );
}

console.log("[registry] Staged .netlify SSR artifacts into dist/.netlify for deploy.");
