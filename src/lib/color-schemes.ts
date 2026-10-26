/**
 * Reads a paint's declared color schemes from its CSS: a leading `/* @color-schemes { JSON } *\/` comment maps
 * scheme id -> { label, slots?, base? }. Swatch colors come from the scheme's CSS block:
 *   light -> `:root {`, dark -> `html.dark-theme {`, others -> `html[data-scheme="id"]` / `html.dark-theme[data-scheme="id"]`.
 */
export interface ColorScheme {
  id: string;
  label: string;
  /** light | dark | special */
  mode: 'light' | 'dark' | 'special';
  /** Up to 4 hex colors: canvas, ink, dominant/accent, link. */
  swatches: string[];
}

const ROLES: RegExp[] = [/canvas|(^|-)bg$|background/, /dominant|brand|primary|accent/, /link$/, /ink$|text$|fg$/];

function blockFor(css: string, id: string): string | null {
  const sels =
    id === 'light'
      ? [/(^|\n)\s*:root\s*\{/]
      : id === 'dark'
        ? [/(^|\n)\s*html\.dark-theme\s*\{/]
        : [new RegExp(`html(?:\\.dark-theme)?\\[data-scheme="${id.replace(/[^\w-]/g, '')}"\\]\\s*\\{`)];
  for (const re of sels) {
    const m = re.exec(css);
    if (!m) continue;
    const start = m.index + m[0].length;
    const end = css.indexOf('}', start);
    if (end > start) return css.slice(start, end);
  }
  return null;
}

function swatchesOf(block: string | null): string[] {
  if (!block) return [];
  const vars = [...block.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\b/g)].map(([, n, v]) => ({ n: n.toLowerCase(), v: v.toLowerCase() }));
  const out: string[] = [];
  for (const role of ROLES) {
    const hit = vars.find((x) => role.test(x.n) && !out.includes(x.v));
    if (hit) out.push(hit.v);
  }
  return out;
}

export function parseColorSchemes(css: string): ColorScheme[] {
  const m = css.match(/\/\*\s*@color-schemes\s*([\s\S]*?)\*\//);
  if (!m) return [];
  let decl: Record<string, { label?: string; slots?: string[]; base?: string }>;
  try {
    decl = JSON.parse(m[1]);
  } catch {
    return [];
  }
  return Object.entries(decl).map(([id, d]) => {
    const block = blockFor(css, id);
    const dark = id === 'dark' || (d.slots ?? []).includes('dark') || Boolean(block && /color-scheme:\s*dark/.test(block));
    const special = Array.isArray(d.slots) && d.slots.length === 0 && id !== 'light' && id !== 'dark';
    return { id, label: d.label ?? id, mode: special ? 'special' : dark ? 'dark' : 'light', swatches: swatchesOf(block) };
  });
}
