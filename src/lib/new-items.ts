/** Items first listed within this many days get the "New" badge. */
export const NEW_WINDOW_DAYS = 30;

export function isNewListing(firstListedAt: string | null | undefined, now = Date.now()): boolean {
  if (!firstListedAt) return false;
  const t = Date.parse(firstListedAt);
  return Number.isFinite(t) && now - t <= NEW_WINDOW_DAYS * 86_400_000;
}

/** Newest first; items without a date go last. */
export function byFirstListedDesc<T extends { firstListedAt?: string | null }>(a: T, b: T): number {
  return (Date.parse(b.firstListedAt ?? '') || 0) - (Date.parse(a.firstListedAt ?? '') || 0);
}
