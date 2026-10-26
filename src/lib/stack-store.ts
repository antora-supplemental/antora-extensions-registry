import { createSignal } from 'solid-js';
import { MAX_STACK, STACK_KEY, decodeStack } from './stack';

const [picks, setPicks] = createSignal<string[]>([]);
let loaded = false;

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = JSON.parse(window.localStorage.getItem(STACK_KEY) ?? '[]');
    if (Array.isArray(raw)) setPicks(raw.filter((x) => typeof x === 'string').slice(0, MAX_STACK));
  } catch { /* ignore */ }
  window.addEventListener('storage', (ev) => {
    if (ev.key === STACK_KEY) { loaded = false; load(); }
  });
}

function save(next: string[]) {
  setPicks(next);
  try { window.localStorage.setItem(STACK_KEY, JSON.stringify(next)); } catch { /* storage full or blocked */ }
}

/** Basket of catalog ids, persisted in localStorage. Call stackPicks() in client effects/onMount. */
export const stackPicks = () => { load(); return picks(); };
export const inStack = (id: string) => stackPicks().includes(id);
export const toggleStack = (id: string) => { load(); const cur = picks(); save(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(0, MAX_STACK)); };
export const addToStack = (ids: string[]) => { load(); const cur = picks(); save([...cur, ...ids.filter((x) => !cur.includes(x))].slice(0, MAX_STACK)); };
export const removeFromStack = (id: string) => { load(); save(picks().filter((x) => x !== id)); };
export const clearStack = () => save([]);
export const replaceStack = (v: string) => save(decodeStack(v));
