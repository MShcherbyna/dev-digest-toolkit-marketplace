import type { Plugin, PluginComponent } from '../types';
import { useT } from '../i18n';
import { useTitle } from '../lib/title';
import { pageHref, pluginHref } from '../router';
import { CopyButton } from '../components/CopyButton';
import { KindBadge } from '../components/Kind';
import { Terminal } from '../components/Terminal';

// Shown in the header already, so the parameters table skips them.
const HIDDEN_META = new Set(['name', 'description']);

export function Component({ plugin, component: c }: { plugin: Plugin; component: PluginComponent }) {
  const t = useT();
  useTitle(`${c.displayName} (${t.kindBadge[c.type]})`);
  const meta = Object.entries(c.meta).filter(([k, v]) => !HIDDEN_META.has(k) && v !== '');

  return (
    <main class="page page-component" id="main">
      <nav class="breadcrumbs" aria-label={t.component.breadcrumbs}>
        <a href={pageHref('search')}>{t.component.catalog}</a>
        <span class="sep"> / </span>
        <a href={pluginHref(plugin.name)}>{plugin.displayName}</a>
        <span class="sep"> / </span>
        <span aria-current="page">{c.displayName}</span>
      </nav>

      <div class="title-row" style={{ marginBottom: '6px' }}>
        <KindBadge kind={c.type} />
        <h1>{c.displayName}</h1>
        {c.invocation && <span class="invocation">{c.invocation}</span>}
      </div>
      {c.description && <p class="detail-desc">{c.description}</p>}

      {c.tools.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <div class="label-caps">{t.component.tools}</div>
          <div class="tools">
            {c.tools.map((t) => (
              <span key={t} class="tool">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      <div class="install-bar">
        <Terminal cmd={plugin.install} />
        <CopyButton text={plugin.install} class="btn btn-lg btn-primary" />
        {c.sourceUrl && (
          <a class="btn btn-lg" href={c.sourceUrl} target="_blank" rel="noopener noreferrer">
            {t.component.file}
          </a>
        )}
        <div class="install-note">
          {t.component.installNote(t.kindBadge[c.type])} <a href={pluginHref(plugin.name)}>{plugin.displayName}</a>.
        </div>
      </div>

      {meta.length > 0 && (
        <section class="section">
          <h2 class="section-title">{c.type === 'hook' || c.type === 'mcp' ? t.component.config : t.component.frontmatter}</h2>
          <div class="panel" style={{ overflow: 'hidden' }}>
            <table class="meta-table">
              <tbody>
                {meta.map(([k, v]) => (
                  <tr key={k}>
                    <th scope="row">{k}</th>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {c.bodyHtml && (
        <section class="section">
          <h2 class="section-title">{t.component.docs}</h2>
          <div class="panel prose" dangerouslySetInnerHTML={{ __html: c.bodyHtml }} />
        </section>
      )}
    </main>
  );
}
