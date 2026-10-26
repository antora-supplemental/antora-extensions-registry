import { displayTitle, rawPackageName } from './package-title';
import type { ExtensionCatalogEntry, GroupLink } from '../types/ui-module';

/** Declared or curated grouping for one entry (`antoraRegistry.variantOf` / `supersededBy` / `variantLabel`). */
export interface GroupDecl {
  variantOf?: string;
  supersededBy?: string;
  variantLabel?: string;
}

const MAX_HOPS = 5;

/** `https://github.com/a/b/c`, `github.com/a/b/c` and `a/b/c` all name catalog id `a/b/c` (other hosts keep the host). */
export function normalizeGroupRef(ref: string): string {
  return ref
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^github\.com\//, '')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '');
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** Picks the grouping fields out of an antoraRegistry block (unknown input, strings only). */
export function readGroupDecl(block: unknown): GroupDecl | undefined {
  if (!block || typeof block !== 'object') return undefined;
  const b = block as Record<string, unknown>;
  const out: GroupDecl = {};
  const v = str(b.variantOf);
  const s = str(b.supersededBy);
  const l = str(b.variantLabel);
  if (v) out.variantOf = v;
  if (s) out.supersededBy = s;
  if (l) out.variantLabel = l.slice(0, 200);
  return Object.keys(out).length ? out : undefined;
}

const link = (e: ExtensionCatalogEntry): GroupLink => ({ catalogId: e.catalogId, title: displayTitle(e) });

/**
 * Canonical entries: resolves `variantOf` and `supersededBy` (declared in the repo, else curated) into
 * `partOf` / `replacedBy` on the entry and `variants` on the canonical entry. Chains are followed to the final
 * entry; unknown or circular targets are ignored (the entry stays listed). Returns new objects; input is not mutated.
 */
export function applyGroups<T extends ExtensionCatalogEntry>(entries: T[], curated: Record<string, GroupDecl> = {}): T[] {
  const out = entries.map((e) => {
    const c = { ...e };
    delete c.partOf;
    delete c.replacedBy;
    delete c.variants;
    const cur = curated[e.catalogId] ?? curated[e.catalogId.toLowerCase()];
    if (cur && !c.variantOf && !c.supersededBy) {
      if (cur.variantOf) c.variantOf = cur.variantOf;
      if (cur.supersededBy) c.supersededBy = cur.supersededBy;
      if (cur.variantLabel && !c.variantLabel) c.variantLabel = cur.variantLabel;
      c.groupSource = 'curated';
    } else if (c.variantOf || c.supersededBy) {
      c.groupSource = 'declared';
    }
    return c;
  });
  const byId = new Map(out.map((e) => [e.catalogId.toLowerCase(), e]));
  const target = (ref: string | undefined, self: T) => {
    const t = ref ? byId.get(normalizeGroupRef(ref)) : undefined;
    return t && t !== self ? t : undefined;
  };
  /** Follows supersededBy, then variantOf, to the entry that is listed. */
  const finalOf = (start: T): T | undefined => {
    let cur: T | undefined = start;
    const seen = new Set<T>();
    for (let i = 0; cur && i <= MAX_HOPS; i++) {
      if (seen.has(cur)) return undefined;
      seen.add(cur);
      const next: T | undefined = target(cur.supersededBy, cur) ?? target(cur.variantOf, cur);
      if (!next) return cur;
      cur = next;
    }
    return undefined;
  };
  for (const e of out) {
    if (e.supersededBy) {
      const t = target(e.supersededBy, e);
      const fin = t && finalOf(t);
      if (fin && fin !== e) e.replacedBy = link(fin);
    } else if (e.variantOf) {
      const t = target(e.variantOf, e);
      const fin = t && finalOf(t);
      if (fin && fin !== e) {
        e.partOf = link(fin);
        (fin.variants ??= []).push({
          ...link(e),
          type: e.type,
          description: e.variantLabel ?? e.description,
          keywords: [e.name, rawPackageName(e), e.id, ...(e.tags ?? [])].filter(Boolean).map((k) => k.toLowerCase()),
        });
      }
    }
  }
  // A title held by an entry that is now replaced is not a clash.
  for (const e of out) {
    const holder = e.titleInUseBy ? byId.get(e.titleInUseBy.toLowerCase()) : undefined;
    if (holder?.replacedBy) {
      delete e.titleInUseBy;
      delete e.titleDisambiguator;
    }
  }
  for (const e of out) e.variants?.sort((a, b) => a.title.localeCompare(b.title));
  return out;
}

/** Search, browse, featured and gallery list only canonical entries (not variants, not superseded). */
export const isListed = (e: Pick<ExtensionCatalogEntry, 'partOf' | 'replacedBy'>) => !e.partOf && !e.replacedBy;

/** The variant whose title, package name or keywords match `q` (lowercase), for the "matched …" note. */
export function variantMatch(e: Pick<ExtensionCatalogEntry, 'variants'>, q: string): GroupLink | undefined {
  if (!q) return undefined;
  return e.variants?.find((v) => v.title.toLowerCase().includes(q) || v.keywords?.some((k) => k.includes(q)));
}
