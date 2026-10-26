/**
 * Package-to-package compatibility.
 *
 * Declared relations come from package.json `antoraRegistry` (or `antora-registry`):
 *   requires / worksWith / conflictsWith : { "<package name | owner/repo>": "<semver range>" } or ["name@range", ...]
 *   provides / uses                      : { "<contract>": "<version | range>" } or ["contract@version", ...]
 *
 * Precedence: declared conflict > Antora-version mismatch > contract-guaranteed > declared works-with (requires
 * implies works-with) > likely (inferred) > alternative. Declared relations and satisfied contracts always beat
 * layer inference: two packages are alternatives only when they share an exclusive layer (engine, body kit, paint)
 * and nothing relates them. Composable layers (chassis, extensions) never produce alternatives.
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
  /** package.json name when it differs from the display name (monorepo packages). */
  packageName?: string;
}

/**
 * Exclusive layers hold one package per site (pick one engine, one layout/body kit, one paint); two packages there are
 * alternatives. Composable layers (chassis, extensions/bolt-ons) are sets of cooperating packages: never alternatives.
 */
export const EXCLUSIVE_LAYERS: LayerId[] = ['engine', 'body-kit', 'paint'];
const EXCLUSIVE = EXCLUSIVE_LAYERS;
export const isExclusiveLayer = (l: LayerId) => EXCLUSIVE.includes(l);

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
  const id = n.catalogId.split('/').pop()!.toLowerCase();
  const keys = [n.catalogId.toLowerCase(), n.name.toLowerCase(), repo, n.repositoryName.toLowerCase(), `${repo}/${id}`, `@${n.repositoryOwner.toLowerCase()}/${id}`];
  if (n.packageName) keys.unshift(n.packageName.toLowerCase());
  return keys;
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

/** Name / package / repo lookup. A repo name resolves to the entry that speaks for the package: one carrying relations, then a recipe/bundle. */
export function makeResolver(nodes: CompatNode[]): { index: Map<string, CompatNode>; find: (name: string) => CompatNode | undefined } {
  const index = new Map<string, CompatNode>();
  const weight = (n: CompatNode) => (n.relations ? 0 : 2) + ((n as { type?: string }).type === 'recipe' || n.bundle ? 0 : 1);
  for (const n of [...nodes].sort((a, b) => weight(a) - weight(b))) for (const k of keysOf(n)) if (!index.has(k)) index.set(k, n);
  return { index, find: (name: string) => index.get(name.toLowerCase()) };
}

/** Computes compatibility links for every node. Pure: same input, same output. */
export function computeCompat(nodes: CompatNode[]): Map<string, CompatLink[]> {
  const { index, find } = makeResolver(nodes);

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

  /** Declared edge either way, or either side's contracts satisfied by the other: never alternatives. */
  const usesSatisfiedBy = (x: CompatNode, y: CompatNode) => {
    const u = x.relations?.uses ?? {};
    if (!Object.keys(u).length) return false;
    const r = contractsSatisfied(u, [y]);
    return r.ok.length > 0;
  };
  const related = (a: CompatNode, b: CompatNode) =>
    edges.get(a.catalogId)?.has(b.catalogId) || edges.get(b.catalogId)?.has(a.catalogId) || usesSatisfiedBy(a, b) || usesSatisfiedBy(b, a);

  const out = new Map<string, CompatLink[]>();
  for (const a of nodes) {
    const links = new Map<string, CompatLink>();
    const add = (l: CompatLink) => {
      const prev = links.get(l.target);
      const rank = (x: CompatLink) =>
        x.relation === 'conflicts' && (x.confidence === 'declared' || x.confidence === 'curated') ? 0 : x.relation === 'antora-mismatch' ? 1 : x.confidence === 'guaranteed' ? 2 : x.confidence === 'declared' || x.confidence === 'curated' ? 3 : x.relation === 'alternative' ? 5 : 4;
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
      // 2) contracts first: everything A uses is provided by B (declared data beats layer inference)
      const uses = a.relations?.uses ?? {};
      const s = Object.keys(uses).length ? contractsSatisfied(uses, [b]) : null;
      if (s && s.ok.length && !s.missing.length) {
        add({ target: b.catalogId, targetName: b.name, indexed: true, relation: 'works-with', confidence: 'guaranteed', why: `${b.name} provides every contract ${a.name} uses`, contracts: s.ok.map((c) => `${c}@${b.relations!.provides![c]}`) });
        continue;
      }
      // 3) same exclusive layer: alternatives only when nothing declared relates the two (either direction)
      if (sameExclusive(a, b) && !related(a, b)) {
        if (!links.has(b.catalogId)) add({ target: b.catalogId, targetName: b.name, indexed: true, relation: 'alternative', confidence: 'likely', why: `Both fill the ${a.layers![0]} layer; use one or the other` });
        continue;
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

// ---- stack-wide contracts ----
// A stack is guaranteed when the union of `provides` across every member covers every `uses` contract of every member
// at satisfied versions, and every indexed `requires` is in the stack at a satisfied version. Partial coverage is
// "declared" when the members are held together by declared requires/worksWith, otherwise "likely".

export type StackStatus = 'guaranteed' | 'declared' | 'likely' | 'none';
export interface StackCoverage {
  status: StackStatus;
  /** Catalog ids, root (or first pick) first. */
  members: string[];
  /** Display names, same order as members. */
  memberNames: string[];
  /** "contract@range (Provider)" for every satisfied use. */
  covered: string[];
  /** "contract@range (used by X)" or "requires Y range (used by X)" for every gap. */
  missing: string[];
  /** Contract names nobody in the stack provides, for suggestions. */
  missingContracts: string[];
  why: string;
}

const providesAt = (n: CompatNode, c: string, range: string) => n.relations?.provides?.[c] !== undefined && satisfies(n.relations.provides[c], range);

/** Coverage of one fixed set of packages. `nodes` (the whole registry) resolves declared names; defaults to the members. */
export function stackCoverage(members: CompatNode[], nodes: CompatNode[] = members): StackCoverage {
  const { find } = makeResolver(nodes.length ? nodes : members);
  const ids = new Set(members.map((m) => m.catalogId));
  const covered: string[] = [];
  const missing: string[] = [];
  const missingContracts: string[] = [];
  const conflicts: string[] = [];
  let usesCount = 0;
  for (const m of members) {
    for (const [c, range] of Object.entries(m.relations?.uses ?? {})) {
      usesCount++;
      const p = members.find((n) => providesAt(n, c, range));
      if (p) covered.push(`${c}@${range} (${p.name})`);
      else {
        missing.push(`${c}@${range} (used by ${m.name})`);
        if (!missingContracts.includes(c)) missingContracts.push(c);
      }
    }
    for (const [name, range] of Object.entries(m.relations?.requires ?? {})) {
      const t = find(name);
      if (!t) continue; // not in the registry: cannot be checked here
      const inStack = members.find((x) => x.catalogId === t.catalogId);
      if (!inStack) missing.push(`requires ${t.name} ${range} (used by ${m.name})`);
      else if (range !== '*' && name.toLowerCase() === (t.packageName ?? t.name).toLowerCase() && !satisfies(t.version, range)) missing.push(`requires ${t.name} ${range}, stack has ${t.version} (used by ${m.name})`);
    }
    for (const name of Object.keys(m.relations?.conflictsWith ?? {})) {
      const t = find(name);
      if (t && ids.has(t.catalogId)) conflicts.push(`${m.name} conflicts with ${t.name}`);
    }
  }
  const glued = members.length > 1 && members.slice(1).every((x) => members.some((y) => y !== x && (
    Object.keys({ ...(y.relations?.requires ?? {}), ...(y.relations?.worksWith ?? {}) }).some((k) => find(k)?.catalogId === x.catalogId) ||
    Object.keys({ ...(x.relations?.requires ?? {}), ...(x.relations?.worksWith ?? {}) }).some((k) => find(k)?.catalogId === y.catalogId))));
  let status: StackStatus;
  let why: string;
  if (conflicts.length) {
    status = 'none';
    why = conflicts.join('; ');
  } else if (usesCount && !missing.length) {
    status = 'guaranteed';
    why = `The stack provides every contract its packages use (${covered.length}) at satisfied versions`;
  } else if (glued) {
    status = 'declared';
    why = missing.length ? `Declared relations tie the stack together; missing ${missing.join(', ')}` : 'Declared relations tie the stack together; no contracts declared';
  } else if (covered.length) {
    status = 'likely';
    why = `Partial contract coverage; missing ${missing.join(', ')}`;
  } else {
    status = 'none';
    why = missing.length ? `Missing ${missing.join(', ')}` : 'No contracts or relations declared';
  }
  return { status, members: members.map((m) => m.catalogId), memberNames: members.map((m) => (m as { title?: string }).title ?? m.name), covered, missing, missingContracts, why };
}

/**
 * The requires/uses closure of `seeds`: declared requires (indexed ones), then for every unprovided use a provider from
 * the registry (preferring one a member declares requires/worksWith on, then declared metadata, then the one covering the
 * most open contracts, then catalog id). Never adds a package that shares a single exclusive layer with a member.
 */
export function stackClosure(seeds: CompatNode[], nodes: CompatNode[], max = 40): CompatNode[] {
  const { find } = makeResolver(nodes);
  const out: CompatNode[] = [...seeds];
  const has = (n: CompatNode) => out.some((x) => x.catalogId === n.catalogId);
  const blocked = (n: CompatNode) => out.some((x) => sameExclusive(x, n)) ||
    out.some((x) => Object.keys(x.relations?.conflictsWith ?? {}).some((k) => find(k)?.catalogId === n.catalogId)) ||
    Object.keys(n.relations?.conflictsWith ?? {}).some((k) => { const t = find(k); return !!t && has(t); });
  for (let i = 0; i < out.length && out.length < max; i++) {
    const m = out[i];
    for (const name of Object.keys(m.relations?.requires ?? {})) {
      const t = find(name);
      if (t && !has(t)) out.push(t);
    }
  }
  for (let i = 0; i < out.length && out.length < max; i++) {
    const m = out[i];
    for (const [c, range] of Object.entries(m.relations?.uses ?? {})) {
      if (out.some((n) => providesAt(n, c, range))) continue;
      const declaredOn = new Set(out.flatMap((x) => Object.keys({ ...(x.relations?.requires ?? {}), ...(x.relations?.worksWith ?? {}) }).map((k) => find(k)?.catalogId)).filter(Boolean));
      const open = out.flatMap((x) => Object.entries(x.relations?.uses ?? {})).filter(([k, r]) => !out.some((n) => providesAt(n, k, r)));
      const score = (n: CompatNode) => open.filter(([k, r]) => providesAt(n, k, r)).length;
      const cands = nodes.filter((n) => !has(n) && providesAt(n, c, range) && !blocked(n)).sort((a, b) =>
        Number(declaredOn.has(b.catalogId)) - Number(declaredOn.has(a.catalogId)) ||
        Number(b.relations?.source === 'declared') - Number(a.relations?.source === 'declared') ||
        score(b) - score(a) || a.catalogId.localeCompare(b.catalogId));
      const p = cands[0];
      if (!p) continue;
      out.push(p);
      for (let j = out.length - 1; j < out.length && out.length < max; j++) {
        for (const name of Object.keys(out[j].relations?.requires ?? {})) {
          const t = find(name);
          if (t && !has(t)) out.push(t);
        }
      }
    }
  }
  return out;
}

/** The smallest stack (by pruning the closure, last added first) that makes `root` guaranteed, or the best partial one. */
export function minimalStack(root: CompatNode, nodes: CompatNode[]): StackCoverage | undefined {
  if (!Object.keys(root.relations?.uses ?? {}).length) return undefined;
  let members = stackClosure([root], nodes);
  const full = stackCoverage(members, nodes);
  if (full.status === 'guaranteed') {
    for (let i = members.length - 1; i >= 1; i--) {
      const trial = members.filter((_, j) => j !== i);
      if (stackCoverage(trial, nodes).status === 'guaranteed') members = trial;
    }
    return stackCoverage(members, nodes);
  }
  return full;
}

/** `minimalStack` for every node that uses contracts. */
export function computeStacks(nodes: CompatNode[]): Map<string, StackCoverage> {
  const out = new Map<string, StackCoverage>();
  for (const n of nodes) {
    const s = minimalStack(n, nodes);
    if (s && s.members.length > 1) out.set(n.catalogId, s);
  }
  return out;
}
