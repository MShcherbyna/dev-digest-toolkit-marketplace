import { describe, expect, test } from 'vitest';
import MiniSearch from 'minisearch';
import { buildCatalog } from '../../scripts/build-catalog.mjs';
import { buildEntries } from '../data';
import type { Catalog } from '../types';
import { loadIndex, search, type SearchParams } from './engine';
import { parseQuery } from './query';
import { INDEX_OPTIONS } from './index-options.js';

const { catalog, searchIndex } = buildCatalog({ root: 'test/fixtures/marketplace', repo: 'owner/repo' }) as { catalog: Catalog; searchIndex: unknown };
// Round-trip through JSON, as the browser receives it.
const index = loadIndex(JSON.parse(JSON.stringify(searchIndex)));
const entries = buildEntries(catalog);
const base: SearchParams = { q: '', kinds: [], keywords: [], author: null, sort: 'relevance', useQueryKinds: true };
const ids = (p: Partial<SearchParams>) => search(index, entries, { ...base, ...p }).results.map((e) => e.id);

describe('parseQuery', () => {
  test('drops stopwords and turns type words into a filter', () => {
    const q = parseQuery("Мені треба скіл для рев'ю PR");
    expect(q.kinds).toEqual(['skill']);
    expect(q.terms).toEqual(["рев'ю", 'pr']);
    expect(q.groups[0]).toContain('review');
  });

  test('unifies apostrophes', () => {
    expect(parseQuery('рев’ю').terms).toEqual(parseQuery('ревʼю').terms);
  });

  test('a query of only a type word has no terms', () => {
    expect(parseQuery('агенти')).toMatchObject({ terms: [], kinds: ['agent'] });
  });
});

describe('search', () => {
  test("«скіл для рев'ю» finds review skills through plugin keywords", () => {
    const r = ids({ q: "скіл для рев'ю" });
    expect(r).toContain('pr-review/skill/review-diff');
    expect(r.every((id) => id.includes('/skill/'))).toBe(true);
  });

  test('a one-letter typo still matches', () => {
    expect(ids({ q: 'reviw' })).toContain('pr-review/plugin');
  });

  test('Ukrainian query finds English content through synonyms', () => {
    expect(ids({ q: 'документація' })).toContain('docs-writer/plugin');
    expect(ids({ q: 'коміти' })).toContain('commit-helper/command/commit');
  });

  test('falls back to any term when no item matches all of them', () => {
    const out = search(index, entries, { ...base, q: 'commit documentation' });
    expect(out.relaxed).toBe(true);
    expect(out.results.length).toBeGreaterThan(0);
  });

  test('query kinds can be switched off', () => {
    const agents = ids({ q: 'review агент' });
    expect(agents[0]).toBe('pr-review/agent/reviewer');
    expect(agents.every((id) => id.includes('/agent/'))).toBe(true);
    expect(ids({ q: 'review агент', useQueryKinds: false }).length).toBeGreaterThan(agents.length);
  });

  test('facets filter and counts ignore their own dimension', () => {
    const out = search(index, entries, { ...base, kinds: ['skill'], author: 'Docs Guild' });
    expect(out.results.map((e) => e.id)).toEqual(['docs-writer/skill/api-docs']);
    expect(out.counts.kinds.agent).toBe(1);
    expect(out.counts.authors.get('Platform Team')).toBe(2);
  });

  test('empty query lists everything, sorted by name on request', () => {
    const names = search(index, entries, { ...base, sort: 'name' }).results.map((e) => e.displayName);
    expect(names.length).toBe(entries.length);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'uk')));
  });

  test('stays under 50 ms on 500 items', () => {
    const big = new MiniSearch(INDEX_OPTIONS);
    const many = Array.from({ length: 500 }, (_, i) => entries[i % entries.length]).map((e, i) => ({ ...e, id: `${e.id}#${i}` }));
    big.addAll(many.map((e) => ({ id: e.id, name: e.name, keywords: e.keywords.join(' '), description: e.description, body: e.component?.bodyHtml ?? '' })));
    const t0 = performance.now();
    search(big, many, { ...base, q: "скіл для рев'ю pull request" });
    expect(performance.now() - t0).toBeLessThan(50);
  });
});
