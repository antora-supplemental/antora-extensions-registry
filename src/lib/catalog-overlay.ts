import { CURATED_PREVIEWS } from '~/data/curated-previews';
import { normalizeLayers } from '~/lib/layers';
import type { ExtensionCatalogEntry, PreviewImage } from '~/types/ui-module';

export interface CatalogOverride {
  catalogId: string;
  /** null = keep the sync value. */
  layers: string[] | null;
  bundleMembers: string[] | null;
}

export interface CatalogOverlay {
  overrides: Map<string, CatalogOverride>;
  uploads: Map<string, PreviewImage[]>;
  /** Catalog ids for the home-page featured slot, in order. */
  featured: string[];
}

export const DEFAULT_FEATURED = ['antora-supplemental/facto-stack/facto-stack'];

export const emptyOverlay = (): CatalogOverlay => ({ overrides: new Map(), uploads: new Map(), featured: DEFAULT_FEATURED });

/** Previews in display order: admin uploads, then the repo's manifest, else curated, else README images. */
function mergePreviews(e: ExtensionCatalogEntry, uploads: PreviewImage[]): PreviewImage[] | undefined {
  const synced = e.previews ?? [];
  const manifest = synced.filter((p) => p.source === 'manifest');
  const rest = manifest.length ? manifest : CURATED_PREVIEWS[e.catalogId] ?? synced;
  const list = [...uploads, ...rest];
  return list.length ? list : undefined;
}

/** Applies admin overrides, admin uploads and curated previews on top of the synced catalog. */
export function applyOverlay(entries: ExtensionCatalogEntry[], overlay: CatalogOverlay): ExtensionCatalogEntry[] {
  return entries.map((e) => {
    const out: ExtensionCatalogEntry = { ...e, previews: mergePreviews(e, overlay.uploads.get(e.catalogId) ?? []) };
    if (!out.previews) delete out.previews;
    const o = overlay.overrides.get(e.catalogId);
    if (o?.layers) {
      out.layers = normalizeLayers(o.layers);
      out.layerSource = 'admin';
    }
    if (o?.bundleMembers) {
      if (o.bundleMembers.length) out.bundle = { members: o.bundleMembers, source: 'admin', reason: 'set by an admin' };
      else delete out.bundle;
    }
    return out;
  });
}
