import type { Catalog, Plugin as PluginT } from '../types';
import { COMPONENT_KINDS } from '../types';
import { useT } from '../i18n';
import { useTitle } from '../lib/title';
import { componentHref, pluginHref } from '../router';
import { CopyButton } from '../components/CopyButton';
import { KindDot } from '../components/Kind';
import { Terminal } from '../components/Terminal';
import { BackButton } from '../components/BackButton';

export function Plugin({ plugin, catalog }: { plugin: PluginT; catalog: Catalog }) {
  const t = useT();
  useTitle(plugin.displayName);
  const groups = COMPONENT_KINDS.map((k) => ({ kind: k, items: plugin.components.filter((c) => c.type === k) })).filter((g) => g.items.length);
  const hooks = plugin.components.filter((c) => c.type === 'hook');
  const servers = plugin.components.filter((c) => c.type === 'mcp');
  const known = new Set(catalog.plugins.map((p) => p.name));

  return (
    <main class="page page-plugin" id="main">
      <BackButton label={t.plugin.back} />
      <div class="detail-head">
        <div class="detail-icon" aria-hidden="true">
          ◆
        </div>
        <div class="grow">
          <div class="title-row">
            <h1>{plugin.displayName}</h1>
            <span class="version-pill">v{plugin.version}</span>
            {plugin.category && <span class="badge kind-skill">{plugin.category}</span>}
          </div>
          <p class="detail-desc">{plugin.description}</p>
          <div class="detail-meta">
            {[plugin.author.name, plugin.license, plugin.updated && t.plugin.updated(t.formatDate(plugin.updated))].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>

      <div class="install-bar">
        <Terminal cmd={plugin.install} />
        <CopyButton text={plugin.install} class="btn btn-lg btn-primary" />
        {plugin.sourceUrl && (
          <a class="btn btn-lg" href={plugin.sourceUrl} target="_blank" rel="noopener noreferrer">
            {t.plugin.source}
          </a>
        )}
        {plugin.homepage && (
          <a class="btn btn-lg" href={plugin.homepage} target="_blank" rel="noopener noreferrer">
            {t.plugin.website}
          </a>
        )}
      </div>

      {groups.length > 0 && (
        <section class="section">
          <h2 class="section-title">{t.plugin.contents}</h2>
          <div class="comp-groups">
            {groups.map((g) => (
              <div key={g.kind}>
                <div class="group-head">
                  <KindDot kind={g.kind} />
                  <span class="group-label">{t.kindPlural[g.kind]}</span>
                  <span class="faint mono" style={{ fontSize: '11px' }}>
                    {g.items.length}
                  </span>
                </div>
                <div class="comp-grid">
                  {g.items.map((c) => (
                    <a key={c.id} class="comp" href={componentHref(c)}>
                      <div class="comp-top">
                        <span class="comp-name">{c.displayName}</span>
                        {c.invocation && <span class="comp-inv">{c.invocation}</span>}
                      </div>
                      <div class="comp-desc ellipsis">{c.description || t.card.noDescription}</div>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(hooks.length > 0 || servers.length > 0 || plugin.userConfig.length > 0) && (
        <section class="section">
          <h2 class="section-title">{t.plugin.runs}</h2>
          <div class="panel runs">
            {hooks.map((h) => (
              <div key={h.id} class="runs-row">
                <span class="runs-kind">
                  {t.plugin.hook} · {h.meta.event}
                </span>
                <div>
                  <div class="faint" style={{ fontSize: '12px' }}>
                    matcher: <code>{h.meta.matcher}</code>
                  </div>
                  <code>{h.meta.command ?? h.meta.prompt ?? h.description}</code>
                </div>
              </div>
            ))}
            {servers.map((s) => (
              <div key={s.id} class="runs-row">
                <span class="runs-kind">
                  {t.plugin.mcp} · {s.meta.type}
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>{s.name}</div>
                  <code>{s.meta.url ?? s.meta.command}</code>
                  {s.meta.env && <div class="faint" style={{ fontSize: '12px' }}>env: {s.meta.env}</div>}
                </div>
              </div>
            ))}
            {plugin.userConfig.length > 0 && (
              <div class="runs-row">
                <span class="runs-kind">{t.plugin.settings}</span>
                <div>
                  {plugin.userConfig.map((u) => (
                    <div key={u.key}>
                      <code>{u.key}</code>
                      {u.sensitive && <span class="tag-sensitive">sensitive</span>}
                      {u.description && <span class="dim"> — {u.description}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {plugin.dependencies.length > 0 && (
        <section class="section">
          <h2 class="section-title">{t.plugin.deps}</h2>
          <div class="deps">
            {plugin.dependencies.map((d) => {
              const name = d.split('@')[0];
              return known.has(name) ? (
                <a key={d} class="dep" href={pluginHref(name)}>
                  {d} ↗
                </a>
              ) : (
                <span key={d} class="dep">
                  {d}
                </span>
              );
            })}
          </div>
        </section>
      )}

      {plugin.readmeHtml && (
        <section class="section">
          <h2 class="section-title">{t.plugin.readme}</h2>
          <div class="panel prose" dangerouslySetInnerHTML={{ __html: plugin.readmeHtml }} />
        </section>
      )}

      {plugin.releases.length > 0 && (
        <section class="section">
          <h2 class="section-title">{t.plugin.history}</h2>
          <div class="changelog">
            {plugin.releases.map((r) => (
              <div key={r.version} class="changelog-item">
                <div class="changelog-head">
                  <span class="changelog-version">v{r.version}</span>
                  <span class="faint" style={{ fontSize: '12px' }}>
                    {t.formatDate(r.date)}
                  </span>
                </div>
                {r.notesHtml ? <div class="notes prose" dangerouslySetInnerHTML={{ __html: r.notesHtml }} /> : <div class="dim" style={{ fontSize: '13px', marginTop: '5px' }}>{r.kind === 'added' ? t.plugin.firstVersion : t.plugin.noNotes}</div>}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
