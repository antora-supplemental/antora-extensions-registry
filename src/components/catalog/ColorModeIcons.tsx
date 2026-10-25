import { For } from 'solid-js';

export type ColorMode = 'dark' | 'light';
export interface ModePalette { background?: string; surface?: string; accent?: string }

const MODE_TAGS: Record<string, ColorMode> = {
  dark: 'dark', 'dark-theme': 'dark', 'antora-dark-theme': 'dark',
  light: 'light', 'light-theme': 'light', 'antora-light-theme': 'light',
};

const DEFAULTS: Record<ColorMode, Required<ModePalette>> = {
  dark: { background: '#111111', surface: '#2a2a2a', accent: '#60a5fa' },
  light: { background: '#ffffff', surface: '#e8e8e8', accent: '#2563eb' },
};

/** Pull dark/light mode tags out of a tag list so they render as icons, not pills. */
export function splitModeTags(tags: string[]): { modes: ColorMode[]; rest: string[] } {
  const modes = new Set<ColorMode>();
  const rest: string[] = [];
  for (const t of tags) {
    const m = MODE_TAGS[t.toLowerCase()];
    if (m) modes.add(m);
    else rest.push(t);
  }
  return { modes: (['dark', 'light'] as const).filter((m) => modes.has(m)), rest };
}

export function ColorModeIcons(props: { modes: ColorMode[]; palettes?: Partial<Record<ColorMode, ModePalette>> }) {
  return (
    <For each={props.modes}>
      {(mode) => {
        const p = { ...DEFAULTS[mode], ...(props.palettes?.[mode] ?? {}) };
        const label = mode === 'dark' ? 'Dark theme' : 'Light theme';
        return (
          <span
            role="img"
            aria-label={label}
            title={label}
            class="inline-block shrink-0 self-center rounded-full"
            style={{
              width: '15px',
              height: '15px',
              background: `conic-gradient(${p.background} 0 50%, ${p.surface} 50% 80%, ${p.accent} 80% 100%)`,
              border: '1.5px solid rgb(var(--trim) / calc(var(--trim-alpha) + 0.25))',
            }}
          />
        );
      }}
    </For>
  );
}
