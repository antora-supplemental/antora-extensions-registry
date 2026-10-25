/**
 * Preview image liveness checks shared by catalog building, the daily catalog sync and the audit script.
 * A preview survives only when its URL answers 200 with an image/* content type.
 */
import type { ExtensionCatalogEntry, PreviewImage } from '~/types/ui-module';

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const USER_AGENT = 'Antora-Extensions-Registry';
const cache = new Map<string, Promise<boolean>>();

/** HEAD first (GET when the server refuses HEAD); true only for 200 + image/*. Results are cached per process. */
export function isLiveImage(url: string, fetchImpl: FetchLike = fetch): Promise<boolean> {
  if (fetchImpl !== fetch) return checkImage(url, fetchImpl);
  let hit = cache.get(url);
  if (!hit) cache.set(url, (hit = checkImage(url, fetchImpl)));
  return hit;
}

async function checkImage(url: string, fetchImpl: FetchLike): Promise<boolean> {
  for (const method of ['HEAD', 'GET'] as const) {
    try {
      const res = await fetchImpl(url, { method, headers: { 'User-Agent': USER_AGENT }, redirect: 'follow', signal: AbortSignal.timeout(10_000) });
      if (method === 'GET') res.body?.cancel().catch(() => {});
      if (method === 'HEAD' && (res.status === 405 || res.status === 403 || res.status === 501)) continue;
      return res.status === 200 && /^image\//i.test(res.headers.get('content-type') ?? '');
    } catch {
      if (method === 'GET') return false;
    }
  }
  return false;
}

/** Keeps live previews in their original order, at most `max`. */
export async function liveImages(previews: PreviewImage[], max = Infinity, fetchImpl: FetchLike = fetch): Promise<PreviewImage[]> {
  const ok = await Promise.all(previews.map((p) => isLiveImage(p.url, fetchImpl)));
  return previews.filter((_, i) => ok[i]).slice(0, max);
}

export interface PruneReport {
  checkedUrls: number;
  droppedUrls: string[];
  /** catalogIds that had at least one dead preview. */
  affected: string[];
}

/**
 * Re-checks every stored preview URL and drops dead ones in place. An entry left with no previews loses
 * the field, so cards and the detail page stop showing a gallery or a screenshots badge.
 */
export async function pruneDeadPreviews(entries: ExtensionCatalogEntry[], concurrency = 8, fetchImpl: FetchLike = fetch): Promise<PruneReport> {
  const report: PruneReport = { checkedUrls: 0, droppedUrls: [], affected: [] };
  const queue = entries.filter((e) => e.previews?.length);
  const worker = async () => {
    for (let e = queue.shift(); e; e = queue.shift()) {
      const before = e.previews!;
      const kept = await liveImages(before, Infinity, fetchImpl);
      report.checkedUrls += before.length;
      if (kept.length === before.length) continue;
      report.affected.push(e.catalogId);
      report.droppedUrls.push(...before.filter((p) => !kept.includes(p)).map((p) => p.url));
      if (kept.length) e.previews = kept;
      else delete e.previews;
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return report;
}
