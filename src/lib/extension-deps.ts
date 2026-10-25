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

/** Entries whose requires/recommends point at `target`. */
export function dependents(target: ExtensionCatalogEntry, all: ExtensionCatalogEntry[]): Array<{ entry: ExtensionCatalogEntry; relation: 'requires' | 'recommends' }> {
  const out: Array<{ entry: ExtensionCatalogEntry; relation: 'requires' | 'recommends' }> = [];
  for (const e of all) {
    if (e.catalogId === target.catalogId) continue;
    if ((e.requires ?? []).some((id) => resolveModuleId(id, e, all)?.catalogId === target.catalogId)) out.push({ entry: e, relation: 'requires' });
    else if ((e.recommends ?? []).some((id) => resolveModuleId(id, e, all)?.catalogId === target.catalogId)) out.push({ entry: e, relation: 'recommends' });
  }
  return out;
}
