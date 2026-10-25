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

/**
 * Best guess when the repository declares nothing. Results are flagged `inferred`.
 * Returns [] when there is no reasonable guess (the entry lands in "Unclassified").
 */
export function inferLayers(e: Pick<ExtensionCatalogEntry, 'type' | 'repositoryName' | 'id' | 'name' | 'description' | 'tags' | 'githubTopics' | 'partials' | 'bundle'>): LayerId[] {
  const text = `${e.id} ${e.name} ${e.description}`.toLowerCase();
  const topics = (e.githubTopics ?? []).map((t) => t.toLowerCase());
  const has = (...words: string[]) => words.some((w) => text.includes(w) || topics.includes(w));
  if (e.bundle) return [];
  if (e.repositoryName?.toLowerCase() === 'antora-ui-chassis' || has('chassis')) return ['chassis'];
  if (e.type === 'ui-module' || e.type === 'ui-recipe') {
    if (has('dark', 'palette', 'color', 'colour', 'icon', 'logo', 'font', 'typography')) return ['paint'];
    if (has('layout', 'header', 'mast', 'column', 'silhouette') || (e.partials?.replace?.length ?? 0) > 0) return ['body-kit'];
    return ['bolt-on'];
  }
  if (e.type === 'antora-extension') {
    if (has('theme', 'palette')) return ['paint'];
    return ['bolt-on'];
  }
  return [];
}
