import { useState } from 'preact/hooks';
import type { Catalog, Release } from '../types';
import { useT } from '../i18n';
import { useTitle } from '../lib/title';
import { pluginHref } from '../router';
import { BackButton } from '../components/BackButton';

const LONG_NOTES = 280;

function FeedItem({ r }: { r: Release }) {
  const t = useT();
  const long = r.summary.length > LONG_NOTES;
  const [open, setOpen] = useState(false);
  return (
    <article class="feed-item">
      <div class="feed-side">
        <div class="feed-version">v{r.version}</div>
        <div class="feed-date">{t.formatDate(r.date)}</div>
      </div>
      <div class="grow">
        <div class="feed-title">
          <a href={pluginHref(r.plugin)}>{r.displayName}</a>
          <span class={`feed-kind${r.kind === 'added' ? ' added' : ''}`}>{r.kind === 'added' ? t.whatsNew.added : t.whatsNew.updated}</span>
        </div>
        {r.notesHtml ? (
          <div class={`notes prose${long && !open ? ' clamp' : ''}`} dangerouslySetInnerHTML={{ __html: r.notesHtml }} />
        ) : (
          <div class="dim" style={{ fontSize: '13px', marginTop: '2px' }}>
            {r.kind === 'added' ? t.whatsNew.pluginAdded : t.whatsNew.noNotes}
          </div>
        )}
        {long && (
          <button type="button" class="link-btn" style={{ marginTop: '6px', fontSize: '12px' }} onClick={() => setOpen((o) => !o)}>
            {open ? t.whatsNew.less : t.whatsNew.more}
          </button>
        )}
      </div>
    </article>
  );
}

export function WhatsNew({ catalog }: { catalog: Catalog }) {
  const t = useT();
  useTitle(t.whatsNew.title);
  const months: [string, Release[]][] = [];
  for (const r of catalog.releases) {
    const key = r.date ? r.date.slice(0, 7) : '';
    const last = months[months.length - 1];
    if (last && last[0] === key) last[1].push(r);
    else months.push([key, [r]]);
  }

  return (
    <main class="page page-whats-new" id="main">
      <BackButton label={t.whatsNew.back} />
      <div class="feed-head">
        <h1>{t.whatsNew.title}</h1>
        <a class="rss" href={`${import.meta.env.BASE_URL}feed.xml`}>
          {t.whatsNew.subscribe}
        </a>
      </div>
      {months.length === 0 && (
        <div class="empty">
          <h3>{t.whatsNew.emptyTitle}</h3>
          <p>
            {t.whatsNew.emptyText} <code class="mono">{'<plugin>--v<version>'}</code> {t.whatsNew.emptyText2}
          </p>
        </div>
      )}
      {months.map(([month, items]) => (
        <section key={month} aria-label={t.formatMonth(month || null)}>
          <h2 class="month">{t.formatMonth(month || null)}</h2>
          {items.map((r) => (
            <FeedItem key={`${r.plugin}@${r.version}`} r={r} />
          ))}
        </section>
      ))}
    </main>
  );
}
