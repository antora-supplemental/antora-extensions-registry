/**
 * Package-to-package compatibility.
 *
 * Declared relations come from package.json `antoraRegistry` (or `antora-registry`):
 *   requires / worksWith / conflictsWith : { "<package name | owner/repo>": "<semver range>" } or ["name@range", ...]
 *   provides / uses                      : { "<contract>": "<version | range>" } or ["contract@version", ...]
 *
 * Precedence: declared conflict > Antora-version mismatch > declared works-with (requires implies works-with)
 * > contract-guaranteed > likely (inferred). Inferred results are never shown as declared, and nothing is ever
 * inferred between two packages in the same layer: same exclusive layer = alternatives.
 */
import { antoraMajorsOf, type ReleaseInfo } from '~/lib/antora-compat';
import type { LayerId } from '~/types/ui-module';

export type RangeMap = Record<string, string>;
export interface DeclaredRelations {
  requires?: RangeMap;
  worksWith?: RangeMap;
  conflictsWith?: RangeMap;
  provides?: RangeMap;
  uses?: RangeMap;
  /** 'declared' = from the package itself; 'curated' = registry seed for packages that cannot carry metadata yet. */
  source?: 'declared' | 'curated';
}

export type CompatConfidence = 'declared' | 'curated' | 'guaranteed' | 'likely';
export type CompatRelation = 'works-with' | 'conflicts' | 'alternative' | 'antora-mismatch';
export interface CompatLink {
  target: string; // catalogId when indexed, else the declared name
  targetName: string;
  indexed: boolean;
  relation: CompatRelation;
  confidence: CompatConfidence;
  why: string;
  /** Chain through other packages (catalog ids / names), for the tooltip. */
  path?: string[];
  /** Contracts that made the link, e.g. ["color-scheme-tokens@0.5 (B provides)"]. */
  contracts?: string[];
}

export interface CompatNode {
  catalogId: string;
  name: string;
  version: string;
  repositoryOwner: string;
  repositoryName: string;
  layers?: LayerId[];
  bundle?: unknown;
  releases?: ReleaseInfo[];
  antora?: number[];
  relations?: DeclaredRelations;
}

const EXCLUSIVE: LayerId[] = ['engine', 'chassis', 'body-kit', 'paint'];

/** Accepts { name: range }, ["name@range"], ["name"]. Scoped names keep their leading @. */
export function toRangeMap(v: unknown): RangeMap {
  if (!v) return {};
  if (Array.isArray(v)) {
    const out: RangeMap = {};
    for (const s of v) {
      if (typeof s !== 'string') continue;
      const i = s.lastIndexOf('@');
      if (i > 0) out[s.slice(0, i).trim()] = s.slice(i + 1).trim() || '*';
      else out[s.trim()] = '*';
    }
    return out;
  }
  if (typeof v === 'object') {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, r]) => [k, typeof r === 'string' ? r : String(r ?? '*')]));
  }
  return {};
}

export function readRelations(meta: Record<string, unknown> | undefined | null, source: 'declared' | 'curated' = 'declared'): DeclaredRelations | undefined {
  if (!meta) return undefined;
  const r: DeclaredRelations = { source };
  for (const k of ['requires', 'worksWith', 'conflictsWith', 'provides', 'uses'] as const) {
    const m = toRangeMap(meta[k]);
    if (Object.keys(m).length) r[k] = m;
  }
  return Object.keys(r).length > 1 ? r : undefined;
}

// ---- minimal semver: x.y.z, partial versions, ^ ~ >= > <= < = x/*, space AND, || OR ----
function parts(v: string): [number, number, number] | null {
  const m = v.trim().replace(/^v/, '').match(/^(\d+|[x*])(?:\.(\d+|[x*]))?(?:\.(\d+|[x*]))?/i);
  if (!m) return null;
  const n = (s?: string) => (s === undefined || /[x*]/i.test(s) ? NaN : Number(s));
  return [n(m[1]), n(m[2]), n(m[3])];
}
function cmp(a: number[], b: number[]): number {
  for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0);
  return 0;
}
function one(v: number[], c: string): boolean {
  c = c.trim();
  if (!c || c === '*' || /^x$/i.test(c) || c === 'latest') return true;
  const op = c.match(/^(\^|~|>=|<=|>|<|=)?\s*(.*)$/)!;
  const p = parts(op[2]);
  if (!p) return false;
  const lo = p.map((x) => (Number.isNaN(x) ? 0 : x));
  const given = p.filter((x) => !Number.isNaN(x)).length;
  switch (op[1]) {
    case '>=': return cmp(v, lo) >= 0;
    case '>': return cmp(v, lo) > 0;
    case '<=': return cmp(v, lo) <= 0;
    case '<': return cmp(v, lo) < 0;
    case '~': return cmp(v, lo) >= 0 && v[0] === lo[0] && (given < 2 || v[1] === lo[1]);
    case '^': {
      if (cmp(v, lo) < 0) return false;
      if (lo[0] > 0 || given < 2) return v[0] === lo[0];
      if (lo[1] > 0 || given < 3) return v[0] === 0 && v[1] === lo[1];
      return cmp(v, lo) === 0;
    }
    default: // exact or partial ("4", "0.5")
      for (let i = 0; i < given; i++) if (v[i] !== lo[i]) return false;
      return true;
  }
}
export function satisfies(version: string, range: string): boolean {
  const p = parts(version);
  if (!p) return range.trim() === '*' || range.trim() === '';
  const v = p.map((x) => (Number.isNaN(x) ? 0 : x));
  return range.split('||').some((alt) => alt.trim().split(/\s+/).every((c) => one(v, c)));
}

// ---- graph ----
function keysOf(n: CompatNode): string[] {
  const repo = `${n.repositoryOwner}/${n.repositoryName}`.toLowerCase();
  return [n.catalogId.toLowerCase(), n.name.toLowerCase(), repo, n.repositoryName.toLowerCase()];
}

function contractsSatisfied(uses: RangeMap, providers: CompatNode[]): { ok: string[]; missing: string[]; by: Map<string, CompatNode> } {
  const ok: string[] = [];
  const missing: string[] = [];
  const by = new Map<string, CompatNode>();
  for (const [c, range] of Object.entries(uses)) {
    const p = providers.find((n) => n.relations?.provides?.[c] !== undefined && satisfies(n.relations.provides[c], range));
    if (p) {
      ok.push(c);
      by.set(c, p);
    } else missing.push(c);
  }
  return { ok, missing, by };
}

const sameExclusive = (a: CompatNode, b: CompatNode) =>
  !a.bundle && !b.bundle && (a.layers ?? []).some((l) => EXCLUSIVE.includes(l) && (b.layers ?? []).includes(l)) &&
  (a.layers?.length ?? 0) === 1 && (b.layers?.length ?? 0) === 1;
const layersCollide = (a: CompatNode, b: CompatNode) => (a.layers ?? []).some((l) => EXCLUSIVE.includes(l) && (b.layers ?? []).includes(l));
const label = (n: CompatNode) => `${n.name}@${n.version}`;

/** Computes compatibility links for every node. Pure: same input, same output. */
export function computeCompat(nodes: CompatNode[]): Map<string, CompatLink[]> {
  const index = new Map<string, CompatNode>();
  // A repo name resolves to the entry that speaks for the package: one carrying relations, then a recipe/bundle.
  const weight = (n: CompatNode) => (n.relations ? 0 : 2) + ((n as { type?: string }).type === 'recipe' || n.bundle ? 0 : 1);
  for (const n of [...nodes].sort((a, b) => weight(a) - weight(b))) for (const k of keysOf(n)) if (!index.has(k)) index.set(k, n);
  const find = (name: string) => index.get(name.toLowerCase());

  // Direct declared edges (requires implies works-with), both directions.
  type Edge = { range: string; declaredAs: string; from: CompatNode; kind: 'works' | 'conflict'; source: 'declared' | 'curated' };
  const edges = new Map<string, Map<string, Edge>>(); // a.catalogId -> target key -> edge
  const put = (a: CompatNode, key: string, e: Edge) => {
    const m = edges.get(a.catalogId) ?? new Map();
    const prev = m.get(key);
    if (!prev || (prev.kind === 'works' && e.kind === 'conflict')) m.set(key, e);
    edges.set(a.catalogId, m);
  };
  for (const a of nodes) {
    const r = a.relations;
    if (!r) continue;
    const src = r.source ?? 'declared';
    for (const [name, range] of Object.entries({ ...(r.worksWith ?? {}), ...(r.requires ?? {}) })) {
      const b = find(name);
      put(a, b?.catalogId ?? name, { range, declaredAs: name, from: a, kind: 'works', source: src });
      if (b) put(b, a.catalogId, { range: '*', declaredAs: name, from: a, kind: 'works', source: src });
    }
    for (const [name, range] of Object.entries(r.conflictsWith ?? {})) {
      const b = find(name);
      put(a, b?.catalogId ?? name, { range, declaredAs: name, from: a, kind: 'conflict', source: src });
      if (b) put(b, a.catalogId, { range: '*', declaredAs: name, from: a, kind: 'conflict', source: src });
    }
  }
  const declaredWorks = (a: CompatNode, b: CompatNode) => edges.get(a.catalogId)?.get(b.catalogId)?.kind === 'works';
  const rangeFor = (a: CompatNode, b: CompatNode) => {
    const e = edges.get(a.catalogId)?.get(b.catalogId);
    return e && e.from === a ? e.range : undefined;
  };

  const out = new Map<string, CompatLink[]>();
  for (const a of nodes) {
    const links = new Map<string, CompatLink>();
    const add = (l: CompatLink) => {
      const prev = links.get(l.target);
      const rank = (x: CompatLink) =>
        x.relation === 'conflicts' && (x.confidence === 'declared' || x.confidence === 'curated') ? 0 : x.relation === 'antora-mismatch' ? 1 : x.confidence === 'declared' || x.confidence === 'curated' ? 2 : x.confidence === 'guaranteed' ? 3 : x.relation === 'alternative' ? 4 : 5;
      if (!prev || rank(l) < rank(prev)) links.set(l.target, l);
    };
    const aAntora = antoraMajorsOf(a);

    // 1) declared edges
    for (const [key, e] of edges.get(a.catalogId) ?? []) {
      const b = index.get(key.toLowerCase());
      const name = b?.name ?? key;
      const conf = e.source;
      if (e.kind === 'conflict') {
        add({ target: b?.catalogId ?? key, targetName: name, indexed: Boolean(b), relation: 'conflicts', confidence: conf, why: e.from === a ? `${a.name} declares conflictsWith ${e.declaredAs} ${e.range}` : `${e.from.name} declares conflictsWith ${a.name}` });
        continue;
      }
      // Only compare versions when the range names this exact package (a repo name may resolve to a recipe with its own version).
      const versionNote = b && e.from === a && e.declaredAs.toLowerCase() === b.name.toLowerCase() && e.range !== '*' && !satisfies(b.version, e.range) ? ` (current ${b.version} is outside ${e.range})` : '';
      add({ target: b?.catalogId ?? key, targetName: name, indexed: Boolean(b), relation: 'works-with', confidence: conf, why: (e.from === a ? `${a.name} declares worksWith/requires ${e.declaredAs} ${e.range}` : `${e.from.name} declares it works with ${a.name}`) + versionNote });
    }

    for (const b of nodes) {
      if (b === a) continue;
      // 2) same exclusive layer: alternatives, never inferred compatible
      if (sameExclusive(a, b)) {
        if (!links.has(b.catalogId)) add({ target: b.catalogId, targetName: b.name, indexed: true, relation: 'alternative', confidence: 'likely', why: `Both fill the ${a.layers![0]} layer; use one or the other` });
        continue;
      }
      // 3) direct contracts: everything A uses is provided by B
      const uses = a.relations?.uses ?? {};
      if (Object.keys(uses).length && !layersCollide(a, b)) {
        const s = contractsSatisfied(uses, [b]);
        if (s.ok.length && !s.missing.length) add({ target: b.catalogId, targetName: b.name, indexed: true, relation: 'works-with', confidence: 'guaranteed', why: `${b.name} provides every contract ${a.name} uses`, contracts: s.ok.map((c) => `${c}@${b.relations!.provides![c]}`) });
      }
    }

    // 4) cross-layer chains A -> B -> C (one hop)
    for (const [bKey, e1] of edges.get(a.catalogId) ?? []) {
      if (e1.kind !== 'works') continue;
      const b = index.get(bKey.toLowerCase());
      if (!b) continue;
      for (const [cKey, e2] of edges.get(b.catalogId) ?? []) {
        if (e2.kind !== 'works') continue;
        const c = index.get(cKey.toLowerCase());
        if (!c || c === a || layersCollide(a, c) || layersCollide(a, b) || layersCollide(b, c)) continue;
        if (links.has(c.catalogId) && links.get(c.catalogId)!.confidence !== 'likely') continue;
        const aUses = a.relations?.uses ?? {};
        const bUses = b.relations?.uses ?? {};
        const viaBC = contractsSatisfied(aUses, [b, c]);
        const bByC = contractsSatisfied(bUses, [c]);
        const reachesC = viaBC.ok.filter((k) => viaBC.by.get(k) === c && b.relations?.provides?.[k] === undefined);
        const rA = rangeFor(a, b);
        const rC = rangeFor(c, b);
        const sameB = (!rA || satisfies(b.version, rA)) && (!rC || satisfies(b.version, rC));
        const strict = Object.keys(aUses).length > 0 && !viaBC.missing.length && !bByC.missing.length && reachesC.length === 0 && sameB;
        const reasons: string[] = [];
        if (!Object.keys(aUses).length) reasons.push(`${a.name} declares no contracts`);
        if (viaBC.missing.length) reasons.push(`nothing in the chain provides ${viaBC.missing.join(', ')}`);
        if (bByC.missing.length) reasons.push(`${b.name} uses ${bByC.missing.join(', ')}, which ${c.name} does not provide`);
        if (reachesC.length) reasons.push(`${a.name} reaches ${c.name}'s ${reachesC.join(', ')} directly, not via ${b.name}`);
        if (!sameB) reasons.push(`no single ${b.name} version is declared for both`);
        add({
          target: c.catalogId,
          targetName: c.name,
          indexed: true,
          relation: 'works-with',
          confidence: strict ? 'guaranteed' : 'likely',
          why: strict ? `Strict layering through ${label(b)}: contracts satisfied at compatible versions` : `Via ${b.name}; ${reasons.join('; ')}`,
          path: [a.catalogId, b.catalogId, c.catalogId],
          contracts: [...viaBC.ok.map((k) => `${k} (${viaBC.by.get(k)!.name})`), ...bByC.ok.map((k) => `${k} (${b.name} -> ${c.name})`)],
        });
      }
    }

    // 5) Antora-version mismatch overrides any works-with
    for (const l of links.values()) {
      if (l.relation !== 'works-with' || !l.indexed) continue;
      const b = index.get(l.target.toLowerCase());
      const bAntora = b ? antoraMajorsOf(b) : [];
      if (aAntora.length && bAntora.length && !aAntora.some((m) => bAntora.includes(m))) {
        links.set(l.target, { ...l, relation: 'antora-mismatch', why: `No shared Antora version: ${a.name} targets ${aAntora.join(', ')}, ${l.targetName} targets ${bAntora.join(', ')}. ${l.why}` });
      }
    }
    if (links.size) out.set(a.catalogId, [...links.values()]);
  }
  return out;
}

const ORDER: Record<CompatConfidence, number> = { declared: 0, curated: 1, guaranteed: 2, likely: 3 };
export function sortLinks(links: CompatLink[]): CompatLink[] {
  return [...links].sort((x, y) => ORDER[x.confidence] - ORDER[y.confidence] || x.targetName.localeCompare(y.targetName));
}
