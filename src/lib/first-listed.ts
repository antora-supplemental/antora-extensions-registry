import type { Client, InStatement } from '@libsql/client';

/** INSERT OR IGNORE statements: the first timestamp written for an item is kept forever. */
export function firstListedStatements(kind: 'extension' | 'theme', items: Array<{ id: string; at: number }>): InStatement[] {
  return items.map((i) => ({
    sql: 'INSERT OR IGNORE INTO first_listed (id, kind, itemId, firstListedAt) VALUES (?, ?, ?, ?)',
    args: [`${kind}:${i.id}`, kind, i.id, i.at],
  }));
}

export async function recordFirstListed(db: Client, kind: 'extension' | 'theme', ids: string[], at = Math.floor(Date.now() / 1000)) {
  if (ids.length === 0) return;
  await db.batch(firstListedStatements(kind, ids.map((id) => ({ id, at }))), 'write');
}

/** itemId -> ISO first-listed date. Empty map if the table doesn't exist yet. */
export async function readFirstListed(db: Client, kind: 'extension' | 'theme'): Promise<Map<string, string>> {
  try {
    const rows = await db.execute({ sql: 'SELECT itemId, firstListedAt FROM first_listed WHERE kind = ?', args: [kind] });
    return new Map(rows.rows.map((r) => [String(r.itemId), new Date(Number(r.firstListedAt) * 1000).toISOString()]));
  } catch {
    return new Map();
  }
}
