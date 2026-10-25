import type { ExtensionCatalogEntry } from '~/types/ui-module';

export type DependencyRelation = 'root' | 'requires' | 'recommends';

export interface DependencyNode {
  /** Module id as written in the manifest (e.g. `ui-bus`). */
  id: string;
  relation: DependencyRelation;
  /** Resolved catalog entry; undefined when the id is not in the catalog (external or unindexed). */
  entry?: ExtensionCatalogEntry;
  /** True when this id already appears higher up the same branch. */
  cycle: boolean;
  children: DependencyNode[];
}

/** Resolve a manifest module id, preferring an entry from the same repository. */
export function resolveModuleId(id: string, from: ExtensionCatalogEntry, all: ExtensionCatalogEntry[]): ExtensionCatalogEntry | undefined {
  const matches = all.filter((e) => e.id === id);
  return matches.find((e) => e.repository === from.repository) ?? matches[0];
}

/** Build the requires/recommends tree from catalog manifests, cycle-safe and depth-limited. */
export function buildDependencyTree(root: ExtensionCatalogEntry, all: ExtensionCatalogEntry[], maxDepth = 4): DependencyNode {
  const walk = (entry: ExtensionCatalogEntry, relation: DependencyRelation, path: Set<string>, depth: number): DependencyNode => {
    const node: DependencyNode = { id: entry.id, relation, entry, cycle: false, children: [] };
    if (depth >= maxDepth) return node;
    const next = new Set(path).add(entry.catalogId);
    const edges: Array<[string, DependencyRelation]> = [
      ...(entry.requires ?? []).map((id) => [id, 'requires'] as [string, DependencyRelation]),
      ...(entry.recommends ?? []).map((id) => [id, 'recommends'] as [string, DependencyRelation]),
    ];
    for (const [id, rel] of edges) {
      const child = resolveModuleId(id, entry, all);
      if (!child) node.children.push({ id, relation: rel, cycle: false, children: [] });
      else if (next.has(child.catalogId)) node.children.push({ id, relation: rel, entry: child, cycle: true, children: [] });
      else node.children.push(walk(child, rel, next, depth + 1));
    }
    return node;
  };
  return walk(root, 'root', new Set(), 0);
}

export interface Dependent {
  /** The package that declares the edge. */
  entry: ExtensionCatalogEntry;
  /** How `entry` depends on the target: `entry` requires (or recommends) the target, never the reverse. */
  relation: 'requires' | 'recommends';
  /** True when the target also requires or recommends `entry` back (a two-package cycle). */
  mutual: boolean;
}

function points(from: ExtensionCatalogEntry, ids: string[] | undefined, to: ExtensionCatalogEntry, all: ExtensionCatalogEntry[]): boolean {
  return (ids ?? []).some((id) => resolveModuleId(id, from, all)?.catalogId === to.catalogId);
}

/** Entries whose requires/recommends point at `target` (incoming edges), flagged when the edge is mutual. */
export function dependents(target: ExtensionCatalogEntry, all: ExtensionCatalogEntry[]): Dependent[] {
  const out: Dependent[] = [];
  for (const e of all) {
    if (e.catalogId === target.catalogId) continue;
    const relation = points(e, e.requires, target, all) ? 'requires' : points(e, e.recommends, target, all) ? 'recommends' : null;
    if (!relation) continue;
    const mutual = points(target, target.requires, e, all) || points(target, target.recommends, e, all);
    out.push({ entry: e, relation, mutual });
  }
  return out;
}
