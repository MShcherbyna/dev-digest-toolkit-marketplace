import type MiniSearch from 'minisearch';
import { useCallback, useEffect, useState } from 'preact/hooks';
import type { Catalog, Entry, MarketplaceInfo } from './types';
import { loadIndex } from './search/engine';

declare const __MARKETPLACE__: MarketplaceInfo;

/** Marketplace identity baked in at build time, used when catalog.json does not load. */
export const FALLBACK_MARKETPLACE: MarketplaceInfo = __MARKETPLACE__;

export type CatalogState =
  | { status: 'loading' }
  | { status: 'error'; error: string; retry: () => void }
  | { status: 'ready'; catalog: Catalog; index: MiniSearch | null; entries: Entry[]; byId: Map<string, Entry> };

export function buildEntries(catalog: Catalog): Entry[] {
  const entries: Entry[] = [];
  for (const p of catalog.plugins) {
    const shared = { plugin: p, keywords: p.keywords, author: p.author.name, version: p.version, updated: p.updated };
    entries.push({
      ...shared,
      id: `${p.name}/plugin`,
      kind: 'plugin',
      name: p.name,
      displayName: p.displayName,
      description: p.description,
      component: null,
      invocation: '',
    });
    for (const c of p.components) {
      entries.push({
        ...shared,
        id: c.id,
        kind: c.type,
        name: c.name,
        displayName: c.displayName,
        description: c.description,
        component: c,
        invocation: c.invocation,
      });
    }
  }
  return entries;
}

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

export function useCatalog(): CatalogState {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<CatalogState>({ status: 'loading' });
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    const base = import.meta.env.BASE_URL;
    Promise.all([fetchJson(`${base}data/catalog.json`), fetchJson(`${base}data/search-index.json`).catch(() => null)])
      .then(([catalog, indexJson]: [Catalog, unknown]) => {
        if (cancelled) return;
        const entries = buildEntries(catalog);
        let index: MiniSearch | null = null;
        try {
          index = indexJson ? loadIndex(indexJson) : null;
        } catch (e) {
          console.warn('search index failed to load, falling back to browsing', e);
        }
        setState({ status: 'ready', catalog, index, entries, byId: new Map(entries.map((e) => [e.id, e])) });
      })
      .catch((e: Error) => !cancelled && setState({ status: 'error', error: e.message, retry }));
    return () => {
      cancelled = true;
    };
  }, [attempt, retry]);

  return state;
}
