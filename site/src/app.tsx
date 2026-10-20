import { useEffect, useRef, useState } from 'preact/hooks';
import { FALLBACK_MARKETPLACE, useCatalog } from './data';
import { homeHref, navigate, pageHref, switchLangHref, useLocation } from './router';
import { I18nProvider, LANGS, MESSAGES, storeLang } from './i18n';
import { readSearchParams, searchHref } from './lib/search-url';
import { useTheme } from './lib/theme';
import { ToastProvider } from './components/toast';
import { Palette } from './components/Palette';
import { Home } from './pages/Home';
import { Search } from './pages/Search';
import { Plugin } from './pages/Plugin';
import { Component } from './pages/Component';
import { WhatsNew } from './pages/WhatsNew';
import { Start } from './pages/Start';
import { NotFound } from './pages/NotFound';

const URL_DEBOUNCE_MS = 300;

const isTyping = (el: Element | null) => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el as HTMLElement).isContentEditable);

export function App() {
  const state = useCatalog();
  const loc = useLocation();
  const [theme, toggleTheme] = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState(() => loc.params.get('q') ?? '');
  const headerInput = useRef<HTMLInputElement>(null);
  const urlTimer = useRef<number | undefined>(undefined);
  const focusHeader = useRef(false);
  const locRef = useRef(loc);
  locRef.current = loc;
  const route = loc.route;
  const t = MESSAGES[loc.lang];

  useEffect(() => {
    document.documentElement.lang = t.htmlLang;
  }, [t]);

  // Back/forward and deep links drive the query; typing updates the URL after a debounce.
  useEffect(() => {
    window.clearTimeout(urlTimer.current);
    setQuery(route.name === 'search' ? loc.params.get('q') ?? '' : '');
  }, [loc.path, loc.params.get('q')]);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (focusHeader.current && route.name === 'search') {
      focusHeader.current = false;
      const input = headerInput.current;
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    }
  }, [loc.path]);

  const onQueryInput = (value: string) => {
    setQuery(value);
    window.clearTimeout(urlTimer.current);
    const current = locRef.current;
    if (current.route.name !== 'search') {
      // The hero input unmounts with the home page; typing continues in the header input.
      focusHeader.current = true;
      navigate(searchHref({ q: value }));
      return;
    }
    urlTimer.current = window.setTimeout(() => {
      navigate(searchHref({ ...readSearchParams(locRef.current.params), q: value }), { replace: true });
    }, URL_DEBOUNCE_MS);
  };

  const clearQuery = () => onQueryInput('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (e.key === 'Escape') {
        if (paletteOpen) setPaletteOpen(false);
        else if ((document.activeElement as HTMLElement | null)?.dataset?.searchInput !== undefined) clearQuery();
      } else if (e.key === '/' && !isTyping(document.activeElement) && !paletteOpen) {
        e.preventDefault();
        const hero = document.querySelector<HTMLInputElement>('.hero-search input');
        (hero ?? headerInput.current)?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const marketplace = state.status === 'ready' ? state.catalog.marketplace : FALLBACK_MARKETPLACE;

  let page;
  if (route.name === 'start') {
    page = <Start marketplace={marketplace} plugins={state.status === 'ready' ? state.catalog.plugins : []} />;
  } else if (state.status === 'loading') {
    page = (
      <main class="page page-home" id="main" aria-busy="true">
        <div class="cards">
          {[0, 1, 2].map((i) => (
            <div key={i} class="skeleton" />
          ))}
        </div>
      </main>
    );
  } else if (state.status === 'error') {
    page = (
      <main class="page page-plugin" id="main">
        <div class="empty" role="alert" style={{ marginTop: '40px' }}>
          <div class="empty-icon" aria-hidden="true">
            ⚠️
          </div>
          <h2>{t.app.loadErrorTitle}</h2>
          <p>{state.error}</p>
          <div class="empty-actions">
            <button type="button" class="btn btn-primary" onClick={state.retry}>
              {t.app.retry}
            </button>
            <a class="btn" href={pageHref('start')}>
              {t.app.howToConnect}
            </a>
          </div>
        </div>
      </main>
    );
  } else {
    const { catalog, entries, index } = state;
    const plugin = 'plugin' in route ? catalog.plugins.find((p) => p.name === route.plugin) : undefined;
    switch (route.name) {
      case 'home':
        page = <Home catalog={catalog} entries={entries} query={query} onQueryInput={onQueryInput} />;
        break;
      case 'search':
        page = <Search entries={entries} index={index} params={readSearchParams(loc.params)} query={query} onClearQuery={clearQuery} />;
        break;
      case 'whats-new':
        page = <WhatsNew catalog={catalog} />;
        break;
      case 'plugin':
        page = plugin ? <Plugin plugin={plugin} catalog={catalog} /> : <NotFound what="plugin" />;
        break;
      case 'component': {
        const component = plugin?.components.find((c) => c.type === route.kind && c.name === route.component);
        page = plugin && component ? <Component plugin={plugin} component={component} /> : <NotFound what="artifact" />;
        break;
      }
      default:
        page = <NotFound />;
    }
  }

  return (
    <I18nProvider value={t}>
      <ToastProvider>
        <a
          class="sr-only"
          href="#main"
          onClick={(e) => {
            e.preventDefault();
            const main = document.getElementById('main');
            main?.setAttribute('tabindex', '-1');
            main?.focus();
          }}
        >
          {t.app.skip}
        </a>
        <header class="header">
          <a class="brand" href={homeHref()} aria-label={t.app.brandHome}>
            <span class="brand-mark" aria-hidden="true">
              ◆
            </span>
            <span class="brand-name">{t.app.brand}</span>
            <span class="brand-tag">{marketplace.name}</span>
          </a>
          <form
            class="header-search"
            role="search"
            onSubmit={(ev) => {
              ev.preventDefault();
              navigate(searchHref({ ...(route.name === 'search' ? readSearchParams(loc.params) : {}), q: query }), { replace: route.name === 'search' });
            }}
          >
            <span class="search-icon" aria-hidden="true">
              ⌕
            </span>
            <input
              ref={headerInput}
              type="search"
              value={query}
              onInput={(ev) => onQueryInput(ev.currentTarget.value)}
              placeholder={t.app.searchPlaceholder}
              aria-label={t.app.searchLabel}
              data-search-input
            />
          </form>
          <div class="header-actions">
            <a class="header-link" href={pageHref('whats-new')}>
              {t.app.whatsNew}
            </a>
            <a class="header-link" href={pageHref('start')}>
              {t.app.start}
            </a>
            <nav class="lang-switch" aria-label={t.app.language}>
              {LANGS.map((l) => (
                <a key={l} href={switchLangHref(loc, l)} hrefLang={MESSAGES[l].htmlLang} lang={MESSAGES[l].htmlLang} title={MESSAGES[l].langName} aria-current={l === loc.lang ? 'true' : undefined} onClick={() => storeLang(l)}>
                  {l.toUpperCase()}
                </a>
              ))}
            </nav>
            <button type="button" class="icon-btn mono kbd-hint" onClick={() => setPaletteOpen(true)} aria-label={t.app.palette} disabled={state.status !== 'ready'}>
              ⌘K
            </button>
            <button type="button" class="icon-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? t.app.lightTheme : t.app.darkTheme}>
              {theme === 'dark' ? '☾' : '☀'}
            </button>
            {marketplace.repoUrl && (
              <a class="header-link" href={marketplace.repoUrl} target="_blank" rel="noopener noreferrer">
                GitHub ↗
              </a>
            )}
          </div>
        </header>
        {page}
        <footer class="footer">
          <a href={pageHref('start')}>{t.app.start}</a>
          <a href={pageHref('whats-new')}>{t.app.whatsNew}</a>
          <a href={`${import.meta.env.BASE_URL}feed.xml`}>{t.app.rss}</a>
          {marketplace.repoUrl && (
            <a href={marketplace.repoUrl} target="_blank" rel="noopener noreferrer">
              GitHub ↗
            </a>
          )}
          <span>
            {marketplace.name}
            {state.status === 'ready' && state.catalog.commit ? ` · ${state.catalog.commit}` : ''}
          </span>
        </footer>
        {paletteOpen && state.status === 'ready' && <Palette entries={state.entries} index={state.index} onClose={() => setPaletteOpen(false)} />}
      </ToastProvider>
    </I18nProvider>
  );
}
