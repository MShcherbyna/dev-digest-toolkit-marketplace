import type { Entry } from '../types';
import { CopyButton } from './CopyButton';
import { KindBadge } from './Kind';
import { useT } from '../i18n';
import { entryHref } from '../router';

export function Card({ entry }: { entry: Entry }) {
  const t = useT();
  const href = entryHref(entry);
  const isPlugin = entry.kind === 'plugin';
  const install = entry.plugin.install;
  return (
    <article class="card">
      <div class="card-body">
        <div class="card-top">
          <KindBadge kind={entry.kind} />
          <span class="card-version">v{entry.version}</span>
        </div>
        <a class="card-title" href={href}>
          {entry.displayName}
        </a>
        {!isPlugin && <div class="card-parent">{t.card.inPlugin(entry.plugin.displayName)}</div>}
        <p class="card-desc">{entry.description || t.card.noDescription}</p>
        {entry.keywords.length > 0 && (
          <div class="card-kws">
            {entry.keywords.slice(0, 3).map((k) => (
              <span key={k}>#{k}</span>
            ))}
          </div>
        )}
      </div>
      <div class="card-foot">
        <span class="card-meta ellipsis">{entry.author}</span>
        <div class="card-actions">
          <CopyButton
            text={install}
            title={isPlugin ? install : t.card.installsWith(install, entry.displayName, entry.plugin.displayName)}
          />
          <a class="btn btn-sm btn-primary" href={href}>
            {t.card.open}
          </a>
        </div>
      </div>
    </article>
  );
}
