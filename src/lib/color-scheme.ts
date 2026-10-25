export type ColorScheme = 'light' | 'dark';
export const COLOR_SCHEME_KEY = 'registry-color-scheme';
export const COLOR_SCHEME_EVENT = 'registry:colorscheme';

/**
 * Inline in <head>, runs before first paint. Applies a manual choice from localStorage if present,
 * otherwise prefers-color-scheme. A later OS/browser scheme change always wins: it clears the manual
 * choice and resyncs the page live.
 */
export const COLOR_SCHEME_BOOT = `(function(){var K='${COLOR_SCHEME_KEY}',E='${COLOR_SCHEME_EVENT}',r=document.documentElement;function set(d){r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';try{dispatchEvent(new CustomEvent(E,{detail:d?'dark':'light'}))}catch(e){}}var mq=matchMedia('(prefers-color-scheme: dark)'),s=null;try{s=localStorage.getItem(K)}catch(e){}set(s==='dark'||(s!=='light'&&mq.matches));mq.addEventListener('change',function(ev){try{localStorage.removeItem(K)}catch(e){}set(ev.matches)});})();`;

export function currentColorScheme(): ColorScheme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/** Manual toggle: applies and persists until the next system scheme change. */
export function setColorScheme(scheme: ColorScheme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', scheme === 'dark');
  root.style.colorScheme = scheme;
  try { localStorage.setItem(COLOR_SCHEME_KEY, scheme); } catch { /* storage unavailable */ }
  window.dispatchEvent(new CustomEvent(COLOR_SCHEME_EVENT, { detail: scheme }));
}