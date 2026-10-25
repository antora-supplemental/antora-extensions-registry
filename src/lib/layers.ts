import type { ExtensionCatalogEntry, LayerId } from '~/types/ui-module';

/**
 * Layer vocabulary from antora-ui-chassis (docs/modules/ROOT/pages/layering.adoc), in stack order.
 * Ids match extension-lister's `layer` values so one field serves both tools.
 */
export const LAYERS: Array<{ id: LayerId; label: string; owns: string }> = [
  { id: 'engine', label: 'Engine', owns: 'The Antora pipeline and UI model data' },
  { id: 'chassis', label: 'Chassis', owns: 'Unthemed region parts and their contracts' },
  { id: 'body-kit', label: 'Body kit', owns: 'Silhouette and column layout' },
  { id: 'paint', label: 'Paint & trim', owns: 'Palettes, type, logo and chrome' },
  { id: 'bolt-on', label: 'Bolt-ons', owns: 'Extensions that add features (slots preferred)' },
];

export const UNCLASSIFIED = 'unclassified' as const;
export type LayerBoxId = LayerId | typeof UNCLASSIFIED;

const ALIASES: Record<string, LayerId> = {
  engine: 'engine',
  chassis: 'chassis',
  'body-kit': 'body-kit',
  bodykit: 'body-kit',
  body: 'body-kit',
  paint: 'paint',
  'paint-trim': 'paint',
  'paint-and-trim': 'paint',
  trim: 'paint',
  'bolt-on': 'bolt-on',
  'bolt-ons': 'bolt-on',
  bolton: 'bolt-on',
};

/** Normalizes declared values ("Paint & trim", "bolt-ons", "body kit") to layer ids; drops unknown ones. */
export function normalizeLayers(value: unknown): LayerId[] {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const out = new Set<LayerId>();
  for (const v of list) {
    if (typeof v !== 'string') continue;
    const key = v.trim().toLowerCase().replace(/&/g, 'and').replace(/\s+/g, '-');
    const id = ALIASES[key];
    if (id) out.add(id);
  }
  return LAYERS.map((l) => l.id).filter((id) => out.has(id));
}

export function layerLabel(id: string): string {
  return LAYERS.find((l) => l.id === id)?.label ?? 'Unclassified';
}

/** Layer boxes an entry shows up in. */
export function entryLayerBoxes(e: Pick<ExtensionCatalogEntry, 'layers'>): LayerBoxId[] {
  return e.layers?.length ? e.layers : [UNCLASSIFIED];
}

export function isBundle(e: Pick<ExtensionCatalogEntry, 'type' | 'bundle'>): boolean {
  return e.type === 'ui-recipe' || e.type === 'ui-bundle' || Boolean(e.bundle);
}

/** GitHub/GitLab topics that classify a package. Topics are explicit metadata; free text never is. */
export const TOPIC_LAYERS: Record<string, LayerId> = {
  'antora-theme': 'paint',
  'antora-paint': 'paint',
  'antora-chassis': 'chassis',
  'antora-engine': 'engine',
  'antora-body-kit': 'body-kit',
  'body-kit': 'body-kit',
  layout: 'body-kit',
  'antora-layout': 'body-kit',
  'antora-bolt-on': 'bolt-on',
};

type Classifiable = Pick<ExtensionCatalogEntry, 'type' | 'repositoryName' | 'githubTopics' | 'partials' | 'bundle'> &
  Partial<Pick<ExtensionCatalogEntry, 'layers' | 'layerSource' | 'tags'>>;

export function topicLayers(e: Pick<ExtensionCatalogEntry, 'githubTopics'> & Partial<Pick<ExtensionCatalogEntry, 'tags'>>): LayerId[] {
  const topics = [...(e.githubTopics ?? []), ...(e.tags ?? [])].map((t) => t.toLowerCase());
  return normalizeLayers(topics.map((t) => TOPIC_LAYERS[t]).filter(Boolean));
}

/**
 * Structural guess when nothing explicit exists. Results are flagged `inferred`. Never reads names or
 * descriptions: words like "dark" or "theme" there do not make a package paint (article-zones mentions
 * "theme zones" and is a layout). Returns [] for bundles (their members decide).
 */
export function inferLayers(e: Classifiable): LayerId[] {
  if (e.bundle) return [];
  const fromTopics = topicLayers(e);
  if (fromTopics.length) return fromTopics;
  if (e.repositoryName?.toLowerCase() === 'antora-ui-chassis') return ['chassis'];
  if (e.type === 'ui-module' || e.type === 'ui-recipe') return (e.partials?.replace?.length ?? 0) > 0 ? ['body-kit'] : ['bolt-on'];
  if (e.type === 'antora-extension') return ['bolt-on'];
  return [];
}

/**
 * The one classifier for listing, search, and package pages. Declared (antoraRegistry.layer) and admin layers
 * win; topics come next; otherwise a structural inference. Stored `inferred` values are recomputed so stale
 * synced payloads cannot disagree with this code.
 */
export function classifyEntry<T extends Classifiable>(e: T): T {
  if (e.layerSource === 'declared' || e.layerSource === 'admin') return e;
  const fromTopics = topicLayers(e);
  if (fromTopics.length) return { ...e, layers: fromTopics, layerSource: 'topic' as T['layerSource'] };
  if (e.bundle && e.layerSource === 'inferred' && e.layers?.length) return e; // computed from members in finalizeCatalog
  const layers = inferLayers(e);
  const { layers: _l, layerSource: _s, ...rest } = e;
  return (layers.length ? { ...rest, layers, layerSource: 'inferred' } : rest) as T;
}

/** Paint/theme package: explicit paint layer (declared/admin) or an antora-theme / antora-paint topic. */
export function isThemePackage(e: Classifiable): boolean {
  const topics = (e.githubTopics ?? []).map((t) => t.toLowerCase());
  if (topics.includes('antora-theme') || topics.includes('antora-paint')) return true;
  return (e.layerSource === 'declared' || e.layerSource === 'admin') && Boolean(e.layers?.includes('paint'));
}