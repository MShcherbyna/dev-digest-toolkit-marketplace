// Hash routing: GitHub Pages serves static files only and has no SPA fallback.
// English lives at `#/…`, Ukrainian at `#/uk/…`, so every page has a shareable URL in both languages.

import { useEffect, useState } from 'preact/hooks';
import type { PluginComponent } from './types';
import { DEFAULT_LANG, LANGS, type Lang } from './i18n';

export type Route =
  | { name: 'home' }
  | { name: 'search' }
  | { name: 'whats-new' }
  | { name: 'start' }
  | { name: 'plugin'; plugin: string }
  | { name: 'component'; plugin: string; kind: string; component: string }
  | { name: 'not-found' };

export interface Location {
  lang: Lang;
  /** Path without the language prefix, e.g. "/plugin/x". */
  path: string;
  params: URLSearchParams;
  route: Route;
}

const enc = encodeURIComponent;

// The language of the location being rendered; hrefs built during a render carry it.
let currentLang: Lang = DEFAULT_LANG;

/** Prefixes a language-neutral href ("#/plugin/x") with a language ("#/uk/plugin/x"). */
export function localize(href: string, lang: Lang = currentLang): string {
  const path = href.replace(/^#/, '') || '/';
  if (lang === DEFAULT_LANG) return `#${path}`;
  return `#/${lang}${path === '/' ? '/' : path}`;
}

export const homeHref = () => localize('#/');
export const pluginHref = (plugin: string) => localize(`#/plugin/${enc(plugin)}`);
export const componentHref = (c: Pick<PluginComponent, 'plugin' | 'type' | 'name'>) => localize(`#/plugin/${enc(c.plugin)}/${c.type}/${enc(c.name)}`);
/** Link to a search card's page. */
export const entryHref = (e: { plugin: { name: string }; component: Pick<PluginComponent, 'plugin' | 'type' | 'name'> | null }) =>
  e.component ? componentHref(e.component) : pluginHref(e.plugin.name);
export const pageHref = (page: 'search' | 'whats-new' | 'start') => localize(`#/${page}`);

function match(path: string): Route {
  const parts = path.split('/').filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  if (parts.length === 0) return { name: 'home' };
  const [head, ...rest] = parts;
  if (head === 'search' && rest.length === 0) return { name: 'search' };
  if (head === 'whats-new' && rest.length === 0) return { name: 'whats-new' };
  if (head === 'start' && rest.length === 0) return { name: 'start' };
  if (head === 'plugin' && rest.length === 1) return { name: 'plugin', plugin: rest[0] };
  if (head === 'plugin' && rest.length === 3) return { name: 'component', plugin: rest[0], kind: rest[1], component: rest[2] };
  return { name: 'not-found' };
}

export function parseLocation(hash = window.location.hash): Location {
  const raw = hash.replace(/^#/, '') || '/';
  const [fullPath, query = ''] = raw.split('?');
  const first = fullPath.split('/')[1] as Lang;
  const lang = LANGS.includes(first) && first !== DEFAULT_LANG ? first : DEFAULT_LANG;
  const path = lang === DEFAULT_LANG ? fullPath : fullPath.slice(lang.length + 1) || '/';
  currentLang = lang;
  return { lang, path, params: new URLSearchParams(query), route: match(path) };
}

/** The same page and query in another language. */
export function switchLangHref(loc: Location, lang: Lang): string {
  const qs = loc.params.toString();
  return localize(`#${loc.path}${qs ? `?${qs}` : ''}`, lang);
}

export function navigate(href: string, { replace = false } = {}) {
  const target = href.startsWith('#') ? href : `#${href}`;
  if (replace) {
    // Keeps the depth stamp of the entry being replaced.
    history.replaceState(history.state, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else if (window.location.hash !== target) {
    window.location.hash = target;
  }
}

// Every history entry created inside the app gets a depth, so "Back" knows whether
// the previous entry is ours or another site (or nothing, on a deep link).
let depth = 0;

function stampDepth() {
  const current = (history.state as { appDepth?: number } | null)?.appDepth;
  if (typeof current === 'number') depth = current;
  else {
    depth += 1;
    history.replaceState({ ...(history.state ?? {}), appDepth: depth }, '');
  }
}

export const canGoBack = () => depth > 0;

export function useLocation(): Location {
  const [loc, setLoc] = useState(() => {
    if (typeof (history.state as { appDepth?: number } | null)?.appDepth !== 'number') history.replaceState({ ...(history.state ?? {}), appDepth: 0 }, '');
    else depth = (history.state as { appDepth: number }).appDepth;
    return parseLocation();
  });
  useEffect(() => {
    const onChange = () => {
      stampDepth();
      setLoc(parseLocation());
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return loc;
}
