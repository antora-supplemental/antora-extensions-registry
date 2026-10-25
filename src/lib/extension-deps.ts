import type { ExtensionCatalogEntry } from '~/types/ui-module';
import { bundleMembers, matchPackage } from './bundle-members';

export type DependencyRelation = 'root' | 'requires' | 'recommends' | 'bundles';

export interface DependencyNode {
  /** Module id as written in the manifest (e.g. `ui-bus`), or the package name for bundle members. */
  id: string;
  relation: DependencyRelation;
  /** Resolved catalog entry; undefined when the id is not in the catalog (external or unindexed). */
  entry?: ExtensionCatalogEntry;
  /** Link for unlisted bundle members (npm or repository). */
  externalUrl?: string;
  /** True when this id already appears higher up the same branch. */
  cycle: boolean;
  children: DependencyNode[];
}

/** Resolve a manifest module id, preferring an entry from the same repository. */
export function resolveModuleId(id: string, from: ExtensionCatalogEntry, all: ExtensionCatalogEntry[]): ExtensionCatalogEntry | undefined {
  const matches = all.filter((e) => e.id === id);
  return matches.find((e) => e.repository === from.repository) ?? matches[0];
}

/** Build the requires/recommends/bundles tree from catalog manifests, cycle-safe and depth-limited. */
export function buildDependencyTree(root: ExtensionCatalogEntry, all: ExtensionCatalogEntry[], maxDepth = 4): DependencyNode {
  const walk = (entry: ExtensionCatalogEntry, relation: DependencyRelation, path: Set<string>, depth: number): DependencyNode => {
    const node: DependencyNode = { id: entry.id, relation, entry, cycle: false, children: [] };
    if (depth >= maxDepth) return node;
    const next = new Set(path).add(entry.catalogId);
    const seen = new Set<string>();
    const add = (id: string, rel: DependencyRelation, child: ExtensionCatalogEntry | undefined, externalUrl?: string) => {
      const key = child?.catalogId ?? `?${id.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (!child) node.children.push({ id, relation: rel, externalUrl, cycle: false, children: [] });
      else if (next.has(child.catalogId)) node.children.push({ id, relation: rel, entry: child, cycle: true, children: [] });
      else node.children.push(walk(child, rel, next, depth + 1));
    };
    for (const id of entry.requires ?? []) add(id, 'requires', resolveModuleId(id, entry, all));
    for (const id of entry.recommends ?? []) add(id, 'recommends', resolveModuleId(id, entry, all));
    for (const m of bundleMembers(entry, all)) add(m.name, 'bundles', m.entry, m.external?.url);
    return node;
  };
  return walk(root, 'root', new Set(), 0);
}

export interface Dependent {
  /** The package that declares the edge. */
  entry: ExtensionCatalogEntry;
  /** How `entry` relates to the target: `entry` requires, recommends or bundles the target, never the reverse. */
  relation: 'requires' | 'recommends' | 'bundled-in';
  /** True when the target also requires, recommends or bundles `entry` back (a two-package cycle). */
  mutual: boolean;
}

function points(from: ExtensionCatalogEntry, ids: string[] | undefined, to: ExtensionCatalogEntry, all: ExtensionCatalogEntry[]): boolean {
  return (ids ?? []).some((id) => resolveModuleId(id, from, all)?.catalogId === to.catalogId);
}

function bundles(from: ExtensionCatalogEntry, to: ExtensionCatalogEntry, all: ExtensionCatalogEntry[]): boolean {
  return (from.bundle?.members ?? []).some((m) => matchPackage(m, all)?.catalogId === to.catalogId);
}

/** Entries whose requires/recommends/bundle members point at `target` (incoming edges), flagged when the edge is mutual. */
export function dependents(target: ExtensionCatalogEntry, all: ExtensionCatalogEntry[]): Dependent[] {
  const out: Dependent[] = [];
  for (const e of all) {
    if (e.catalogId === target.catalogId) continue;
    const relation = points(e, e.requires, target, all)
      ? 'requires'
      : points(e, e.recommends, target, all)
        ? 'recommends'
        : bundles(e, target, all)
          ? 'bundled-in'
          : null;
    if (!relation) continue;
    const mutual = points(target, target.requires, e, all) || points(target, target.recommends, e, all) || bundles(target, e, all);
    out.push({ entry: e, relation, mutual });
  }
  return out;
}

/** Label for a dependent, read after its name: "facto-stack · bundled in". */
export function dependentLabel(relation: Dependent['relation']): string {
  return relation === 'bundled-in' ? 'bundled in' : `${relation} this`;
}