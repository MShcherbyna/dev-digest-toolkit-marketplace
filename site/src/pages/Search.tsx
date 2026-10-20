import type MiniSearch from 'minisearch';
import { useState } from 'preact/hooks';
import type { Entry, Kind } from '../types';
import { KINDS } from '../types';
import { useT } from '../i18n';
import { search, type SearchParams, type Sort } from '../search/engine';
import { searchHref } from '../lib/search-url';
import { useTitle } from '../lib/title';
import { navigate } from '../router';
import { Card } from '../components/Card';
import { KindDot } from '../components/Kind';

const KEYWORD_FACETS = 24;

interface Props {
  entries: Entry[];
  index: MiniSearch | null;
  params: SearchParams;
  /** Live query from the input; the URL catches up after a debounce. */
  query: string;
  onClearQuery: () => void;
}

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

export function Search({ entries, index, params, query, onClearQuery }: Props) {
  const t = useT();
  const p = { ...params, q: query };
  const [facetsOpen, setFacetsOpen] = useState(false);
  const { results, parsed, activeKinds, relaxed, counts } = search(index, entries, p);
  useTitle(query ? t.search.titleFor(query) : t.search.browse);

  const update = (patch: Partial<SearchParams>) => navigate(searchHref({ ...p, ...patch }), { replace: true });
  const clearAll = () => {
    onClearQuery();
    navigate(searchHref({ sort: p.sort }), { replace: true });
  };

  const toggleKind = (k: Kind) => {
    // Turning off a kind that came from the query ("скіл …") disables query kinds instead.
    if (parsed.kinds.includes(k) && p.useQueryKinds && !p.kinds.includes(k)) update({ useQueryKinds: false });
    else update({ kinds: toggle(p.kinds, k) });
  };

  const keywordFacets = [...counts.keywords.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, KEYWORD_FACETS)
    .map(([k]) => k);
  for (const k of p.keywords) if (!keywordFacets.includes(k)) keywordFacets.push(k);
  const authors = [...counts.authors.entries()].sort((a, b) => a[0].localeCompare(b[0], 'uk'));
  if (p.author && !counts.authors.has(p.author)) authors.push([p.author, 0]);
  const facetCount = p.kinds.length + p.keywords.length + (p.author ? 1 : 0);
  const queryKinds = p.useQueryKinds ? parsed.kinds.filter((k) => !p.kinds.includes(k)) : [];

  return (
    <main class="page page-search" id="main">
      <aside class="facets" data-open={String(facetsOpen)} aria-label={t.search.filters}>
        <div class="facets-head">
          <span class="facets-title">{t.search.filters}</span>
          <span style={{ display: 'flex', gap: '12px' }}>
            {facetCount > 0 && (
              <button type="button" class="link-btn" onClick={() => update({ kinds: [], keywords: [], author: null })}>
                {t.search.reset}
              </button>
            )}
            <button type="button" class="link-btn facets-toggle" aria-expanded={facetsOpen} onClick={() => setFacetsOpen((o) => !o)}>
              {facetsOpen ? t.search.hide : t.search.show(facetCount)}
            </button>
          </span>
        </div>
        <div class="facets-body">
          <div class="facet-label">{t.search.type}</div>
          <div class="facet-list">
            {KINDS.map((k) => {
              const on = activeKinds.includes(k);
              return (
                <button key={k} type="button" class="facet" aria-pressed={on} disabled={!on && counts.kinds[k] === 0} onClick={() => toggleKind(k)}>
                  <KindDot kind={k} />
                  <span style={{ textTransform: 'capitalize' }}>{t.kindPlural[k]}</span>
                  <span class="count">{counts.kinds[k]}</span>
                </button>
              );
            })}
          </div>
          {keywordFacets.length > 0 && (
            <>
              <div class="facet-label">{t.search.keywords}</div>
              <div class="kw-list">
                {keywordFacets.map((k) => (
                  <button key={k} type="button" class="kw" aria-pressed={p.keywords.includes(k)} onClick={() => update({ keywords: toggle(p.keywords, k) })}>
                    {k}
                  </button>
                ))}
              </div>
            </>
          )}
          {authors.length > 0 && (
            <>
              <div class="facet-label">{t.search.author}</div>
              <div class="facet-list">
                {authors.map(([a, n]) => (
                  <button key={a} type="button" class="facet" aria-pressed={p.author === a} onClick={() => update({ author: p.author === a ? null : a })}>
                    <span class="ellipsis">{a}</span>
                    <span class="count">{n}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </aside>

      <section aria-labelledby="results-title">
        <div class="results-head">
          <div style={{ minWidth: 0 }}>
            <h1 id="results-title">{query ? t.search.resultsFor(query) : t.search.browse}</h1>
            <div class="results-meta" aria-live="polite">
              {t.artifacts(results.length)}
              {relaxed && t.search.relaxed}
            </div>
          </div>
          <label class="sort">
            {t.search.sort}
            <select value={p.sort} onChange={(ev) => update({ sort: ev.currentTarget.value as Sort })}>
              <option value="relevance">{t.search.relevance}</option>
              <option value="name">{t.search.name}</option>
              <option value="updated">{t.search.updated}</option>
            </select>
          </label>
        </div>

        {queryKinds.length > 0 && (
          <div class="query-hint">
            {t.search.fromQuery}
            {queryKinds.map((k) => (
              <span key={k} class="query-chip">
                {t.kindPlural[k]}
                <button type="button" aria-label={t.search.removeFilter(t.kindPlural[k])} onClick={() => update({ useQueryKinds: false })}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {results.length > 0 ? (
          <div class="cards">
            {results.map((e) => (
              <Card key={e.id} entry={e} />
            ))}
          </div>
        ) : (
          <div class="empty">
            <div class="empty-icon" aria-hidden="true">
              🔍
            </div>
            <h3>{query ? t.search.noResultsFor(query) : t.search.noResults}</h3>
            <p>{t.search.noResultsHint}</p>
            <div class="empty-actions">
              <button type="button" class="btn" onClick={clearAll}>
                {t.search.resetAll}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
