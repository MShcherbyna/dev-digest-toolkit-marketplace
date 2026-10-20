import type { Catalog, Entry, Kind } from '../types';
import { KINDS } from '../types';
import { useT } from '../i18n';
import { searchHref } from '../lib/search-url';
import { useTitle } from '../lib/title';
import { navigate, pageHref, pluginHref } from '../router';
import { KindDot } from '../components/Kind';

const STAT_KEY: Record<Kind, keyof Catalog['stats']> = { plugin: 'plugins', skill: 'skills', agent: 'agents', command: 'commands', hook: 'hooks', mcp: 'mcp' };
const HOME_RELEASES = 3;
const HERO_CHIPS = 7;

interface Props {
  catalog: Catalog;
  entries: Entry[];
  query: string;
  onQueryInput: (value: string) => void;
}

export function Home({ catalog, entries, query, onQueryInput }: Props) {
  const t = useT();
  useTitle(null);
  const empty = catalog.plugins.length === 0;
  const contributing = catalog.marketplace.repoUrl ? `${catalog.marketplace.repoUrl}/blob/main/CONTRIBUTING.md` : null;

  const kwCount = new Map<string, number>();
  for (const e of entries) for (const k of e.keywords) kwCount.set(k, (kwCount.get(k) ?? 0) + 1);
  const topKeywords = [...kwCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, HERO_CHIPS);

  const stats = KINDS.map((k) => ({ kind: k, count: catalog.stats[STAT_KEY[k]] })).filter((s) => s.kind === 'plugin' || s.count > 0);

  return (
    <main class="page page-home" id="main">
      <section class="hero">
        <div class="eyebrow">{t.home.eyebrow}</div>
        <h1>
          {t.home.title1}
          <br />
          {t.home.title2}
        </h1>
        <p>{t.home.lead}</p>
        <form
          class="hero-search"
          role="search"
          onSubmit={(ev) => {
            ev.preventDefault();
            navigate(searchHref({ q: query }));
          }}
        >
          <span class="search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            type="search"
            value={query}
            onInput={(ev) => onQueryInput(ev.currentTarget.value)}
            placeholder={t.home.placeholder}
            aria-label={t.app.searchLabel}
            data-search-input
          />
        </form>
        {topKeywords.length > 0 && (
          <div class="chips">
            {topKeywords.map(([k]) => (
              <button key={k} type="button" class="chip" onClick={() => navigate(searchHref({ keywords: [k] }))}>
                #{k}
              </button>
            ))}
          </div>
        )}
      </section>

      {empty ? (
        <section class="empty">
          <div class="empty-icon" aria-hidden="true">
            📦
          </div>
          <h2>{t.home.emptyTitle}</h2>
          <p>{t.home.emptyText}</p>
          <div class="empty-actions">
            <a class="btn btn-primary" href={pageHref('start')}>
              {t.home.emptyCta}
            </a>
            {contributing && (
              <a class="btn" href={contributing} target="_blank" rel="noopener noreferrer">
                CONTRIBUTING.md
              </a>
            )}
          </div>
        </section>
      ) : (
        <>
          <section aria-label={t.home.statsLabel}>
            <div class="stats">
              {stats.map((s) => (
                <button key={s.kind} type="button" class="stat" onClick={() => navigate(searchHref({ kinds: [s.kind] }))}>
                  <div class="stat-count">{s.count}</div>
                  <div class="stat-label">{t.statLabel(s.count, s.kind)}</div>
                </button>
              ))}
            </div>
            <p class="stats-updated">{t.home.updated(t.formatDate(catalog.generatedAt))}</p>
          </section>

          {catalog.releases.length > 0 && (
            <section class="section" style={{ marginBottom: '44px' }}>
              <div class="section-head">
                <h2>{t.home.whatsNew}</h2>
                <a class="muted-link" href={pageHref('whats-new')}>
                  {t.home.allReleases}
                </a>
              </div>
              <div class="release-list">
                {catalog.releases.slice(0, HOME_RELEASES).map((r) => (
                  <a key={`${r.plugin}@${r.version}`} class="release-row" href={pluginHref(r.plugin)}>
                    <span class="version-pill">v{r.version}</span>
                    <div class="grow">
                      <div style={{ fontWeight: 600 }}>{r.displayName}</div>
                      <div class="dim ellipsis" style={{ fontSize: '13px' }}>
                        {r.summary || (r.kind === 'added' ? t.home.newPlugin : t.home.update)}
                      </div>
                    </div>
                    <span class="release-date">{t.formatDate(r.date)}</span>
                  </a>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 class="section-title" style={{ fontSize: '16px', marginBottom: '14px' }}>
              {t.home.browse}
            </h2>
            <div class="browse">
              {stats.map((s) => (
                <button key={s.kind} type="button" class="browse-btn" onClick={() => navigate(searchHref({ kinds: [s.kind] }))}>
                  <KindDot kind={s.kind} />
                  <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{t.kindPlural[s.kind]}</span>
                  <span class="faint mono" style={{ fontSize: '12px' }}>
                    {s.count}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
