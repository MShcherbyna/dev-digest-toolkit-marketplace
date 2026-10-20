import MiniSearch, { type Query, type SearchResult } from 'minisearch';
import type { Entry, Kind } from '../types';
import { KINDS } from '../types';
import { FIELD_BOOST, INDEX_OPTIONS } from './index-options.js';
import { parseQuery, type ParsedQuery } from './query';

export type Sort = 'relevance' | 'name' | 'updated';

export interface Facets {
  kinds: Kind[];
  keywords: string[];
  author: string | null;
}

export interface SearchParams extends Facets {
  q: string;
  sort: Sort;
  /** Apply kinds named in the query ("скіл для …") as a filter. */
  useQueryKinds: boolean;
}

export interface SearchOutcome {
  results: Entry[];
  parsed: ParsedQuery;
  /** Kinds actually filtered on: chosen facets plus kinds from the query. */
  activeKinds: Kind[];
  /** True when no result matched every term and the search fell back to any term. */
  relaxed: boolean;
  counts: { kinds: Record<Kind, number>; keywords: Map<string, number>; authors: Map<string, number> };
}

const SEARCH_OPTIONS = {
  boost: FIELD_BOOST,
  prefix: true,
  fuzzy: (term: string) => (term.length > 3 ? 0.2 : false),
};

export function loadIndex(json: unknown): MiniSearch {
  return MiniSearch.loadJS(json as Parameters<typeof MiniSearch.loadJS>[0], INDEX_OPTIONS);
}

function runQuery(index: MiniSearch, groups: string[][], combineWith: 'AND' | 'OR'): SearchResult[] {
  const query: Query = { combineWith, queries: groups.map((g) => ({ combineWith: 'OR', queries: g })) };
  return index.search(query, SEARCH_OPTIONS);
}

/** Matches entries against the text query only, before facets. Scores are null when there are no terms. */
export function matchQuery(index: MiniSearch | null, entries: Entry[], q: string) {
  const parsed = parseQuery(q);
  if (!index || parsed.terms.length === 0) return { parsed, matched: entries.map((e) => ({ e, score: 0 })), relaxed: false };
  const byId = new Map(entries.map((e) => [e.id, e]));
  let hits = runQuery(index, parsed.groups, 'AND');
  let relaxed = false;
  if (hits.length === 0 && parsed.groups.length > 1) {
    hits = runQuery(index, parsed.groups, 'OR');
    relaxed = hits.length > 0;
  }
  const matched = hits.flatMap((h) => {
    const e = byId.get(String(h.id));
    return e ? [{ e, score: h.score }] : [];
  });
  return { parsed, matched, relaxed };
}

const facetFilter = (f: Facets, skip?: keyof Facets) => (e: Entry) =>
  (skip === 'kinds' || f.kinds.length === 0 || f.kinds.includes(e.kind)) &&
  (skip === 'keywords' || f.keywords.length === 0 || f.keywords.some((k) => e.keywords.includes(k))) &&
  (skip === 'author' || !f.author || e.author === f.author);

const KIND_ORDER = Object.fromEntries(KINDS.map((k, i) => [k, i])) as Record<Kind, number>;
const byName = (a: Entry, b: Entry) => a.displayName.localeCompare(b.displayName, 'uk');

export function search(index: MiniSearch | null, entries: Entry[], p: SearchParams): SearchOutcome {
  const { parsed, matched, relaxed } = matchQuery(index, entries, p.q);
  const activeKinds = [...new Set([...p.kinds, ...(p.useQueryKinds ? parsed.kinds : [])])];
  const facets: Facets = { kinds: activeKinds, keywords: p.keywords, author: p.author };

  const kinds = Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<Kind, number>;
  const keywords = new Map<string, number>();
  const authors = new Map<string, number>();
  for (const { e } of matched) {
    if (facetFilter(facets, 'kinds')(e)) kinds[e.kind]++;
    if (facetFilter(facets, 'keywords')(e)) for (const k of e.keywords) keywords.set(k, (keywords.get(k) ?? 0) + 1);
    if (facetFilter(facets, 'author')(e)) authors.set(e.author, (authors.get(e.author) ?? 0) + 1);
  }

  const list = matched.filter(({ e }) => facetFilter(facets)(e));
  list.sort((a, b) => {
    if (p.sort === 'name') return byName(a.e, b.e);
    if (p.sort === 'updated') return (b.e.updated ?? '').localeCompare(a.e.updated ?? '') || byName(a.e, b.e);
    return b.score - a.score || KIND_ORDER[a.e.kind] - KIND_ORDER[b.e.kind] || byName(a.e, b.e);
  });

  return { results: list.map((x) => x.e), parsed, activeKinds, relaxed, counts: { kinds, keywords, authors } };
}
