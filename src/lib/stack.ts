import type { ExtensionCatalogEntry } from '~/types/ui-module';
import { antoraMajorsOf } from './antora-compat';
import { resolveModuleId } from './extension-deps';

/** localStorage key for the "Build a stack" basket. */
export const STACK_KEY = 'antora-registry:stack';
export const MAX_STACK = 40;
export const DEFAULT_UI_BUNDLE = 'https://gitlab.com/antora/antora-ui-default/-/jobs/artifacts/HEAD/raw/build/ui-bundle.zip?job=bundle-stable';

/** Picks as a URL value: comma-separated catalog ids (ids contain slashes, which stay readable). */
export function encodeStack(ids: string[]): string {
  return ids.map((id) => encodeURIComponent(id).replace(/%2F/gi, '/')).join(',');
}

export function decodeStack(v: string | null | undefined): string[] {
  if (!v) return [];
  const out: string[] = [];
  for (const raw of v.split(',')) {
    let id = raw.trim();
    try { id = decodeURIComponent(id); } catch { /* keep raw */ }
    if (id && !out.includes(id)) out.push(id);
    if (out.length >= MAX_STACK) break;
  }
  return out;
}

export type StackIssueKind = 'conflict' | 'alternative' | 'missing' | 'antora';
export interface StackIssue {
  kind: StackIssueKind;
  message: string;
  /** Picks involved (catalog ids). */
  ids: string[];
  /** For missing requirements: the catalog entry to add, when indexed. */
  suggest?: ExtensionCatalogEntry;
  /** For missing requirements: the name as declared. */
  missing?: string;
}

const label = (e: ExtensionCatalogEntry) => e.title ?? e.name;
const names = (e: ExtensionCatalogEntry) => [e.name, e.packageName, e.id].filter((x): x is string => !!x).map((x) => x.toLowerCase());

/** Pairwise compat between picks (from the precomputed compat links), missing requirements, and Antora line overlap. */
export function analyzeStack(picks: ExtensionCatalogEntry[], all: ExtensionCatalogEntry[]): { issues: StackIssue[]; antora: number[] | null } {
  const issues: StackIssue[] = [];
  const ids = new Set(picks.map((p) => p.catalogId));
  const pickNames = new Set(picks.flatMap(names));
  const seen = new Set<string>();

  for (const a of picks) {
    for (const l of a.compat ?? []) {
      if (!l.indexed || !ids.has(l.target) || l.target === a.catalogId) continue;
      const kind: StackIssueKind | undefined = l.relation === 'conflicts' ? 'conflict' : l.relation === 'alternative' ? 'alternative' : l.relation === 'antora-mismatch' ? 'antora' : undefined;
      if (!kind) continue;
      const key = `${kind}:${[a.catalogId, l.target].sort().join('|')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const verb = kind === 'conflict' ? 'conflicts with' : kind === 'alternative' ? 'is an alternative to' : 'shares no Antora line with';
      issues.push({ kind, ids: [a.catalogId, l.target], message: `${label(a)} ${verb} ${l.targetName}${l.why ? `: ${l.why}` : ''}` });
    }
  }

  const provided = (id: string) => pickNames.has(id.toLowerCase()) || picks.some((p) => (p.modules ?? []).includes(id) || (p.install?.orchestrator?.modules ?? []).includes(id));
  const missingSeen = new Set<string>();
  const addMissing = (a: ExtensionCatalogEntry, name: string, suggest?: ExtensionCatalogEntry) => {
    if (suggest && ids.has(suggest.catalogId)) return;
    const key = (suggest?.catalogId ?? name).toLowerCase();
    if (missingSeen.has(key)) {
      const prev = issues.find((i) => i.kind === 'missing' && (i.suggest?.catalogId ?? i.missing ?? '').toLowerCase() === key);
      if (prev && !prev.ids.includes(a.catalogId)) prev.ids.push(a.catalogId);
      return;
    }
    missingSeen.add(key);
    issues.push({ kind: 'missing', ids: [a.catalogId], missing: name, suggest, message: `${label(a)} requires ${suggest ? label(suggest) : name}` });
  };
  for (const a of picks) {
    for (const id of a.requires ?? []) {
      if (provided(id)) continue;
      addMissing(a, id, resolveModuleId(id, a, all));
    }
    for (const name of Object.keys(a.relations?.requires ?? {})) {
      if (provided(name)) continue;
      addMissing(a, name, all.find((e) => names(e).includes(name.toLowerCase())));
    }
  }

  const declared = picks.map((p) => ({ p, m: antoraMajorsOf(p) })).filter((x) => x.m.length);
  let antora: number[] | null = null;
  if (declared.length) {
    antora = declared.reduce<number[]>((acc, x) => acc.filter((m) => x.m.includes(m)), declared[0].m);
    if (!antora.length && declared.length > 1) {
      issues.push({ kind: 'antora', ids: declared.map((x) => x.p.catalogId), message: `No Antora line fits every pick: ${declared.map((x) => `${label(x.p)} (Antora ${x.m.join(', ')})`).join('; ')}` });
    }
  }
  const order: StackIssueKind[] = ['conflict', 'missing', 'antora', 'alternative'];
  issues.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return { issues, antora };
}

const gitSpec = (e: ExtensionCatalogEntry) =>
  !e.repositoryHost || /(^|\.)github\.com$/i.test(e.repositoryHost) ? `github:${e.repositoryOwner}/${e.repositoryName}` : `git+https://${e.repositoryHost}/${e.repositoryOwner}/${e.repositoryName}.git`;

/** A ready antora-playbook.yml fragment for the picks. */
export function stackPlaybook(picks: ExtensionCatalogEntry[]): string {
  const bundle = picks.filter((p) => p.type === 'ui-bundle');
  const zip = bundle.map((p) => p.releases?.flatMap((r) => r.assets ?? []).find((a) => /\.zip$/i.test(a.name))?.url).find(Boolean);
  const lines: string[] = ['ui:', '  bundle:'];
  if (zip) lines.push(`    url: ${zip}`);
  else {
    if (bundle.length) lines.push(`    # ${label(bundle[0])}: no release zip found; build it and point url at the zip`);
    lines.push(`    url: ${DEFAULT_UI_BUNDLE}`, '    snapshot: true');
  }
  const supplemental = picks.map((p) => (p.install as { supplementalFiles?: unknown } | undefined)?.supplementalFiles).find((s): s is string => typeof s === 'string');
  if (supplemental) lines.push(`  supplemental_files: ${supplemental}`);

  const ext: string[] = [];
  const notes: string[] = [];
  for (const p of picks.filter((x) => x.type === 'antora-extension')) {
    if (p.privatePackage) notes.push(`# Not on npm yet: pnpm add ${gitSpec(p)}`);
    ext.push(`    - require: '${p.packageName ?? p.name}'`);
  }
  const modules = picks.filter((p) => p.type === 'ui-module').map((p) => p.id);
  const recipes = picks.map((p) => p.install?.orchestrator?.recipe).filter((r): r is string => !!r);
  if (modules.length || recipes.length) {
    const registry = picks.find((p) => p.install?.orchestrator?.registry)?.install?.orchestrator?.registry ?? './ui-modules/registry.json5';
    ext.push('    - require: ./ui-modules/packages/orchestrator/lib/index.js', `      registry: ${registry}`);
    if (recipes.length) ext.push(`      recipe: ${recipes[0]}`);
    if (recipes.length > 1) ext.push(`      # also picked: ${recipes.slice(1).join(', ')} (one recipe per orchestrator)`);
    if (modules.length) ext.push('      modules:', ...modules.map((m) => `        - ${m}`));
  }
  if (ext.length) lines.push('antora:', '  extensions:', ...ext);
  return [...notes, ...lines].join('\n') + '\n';
}
