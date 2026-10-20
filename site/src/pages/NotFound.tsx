import { useT } from '../i18n';
import { useTitle } from '../lib/title';
import { homeHref, pageHref } from '../router';

export function NotFound({ what = 'page' }: { what?: 'page' | 'plugin' | 'artifact' }) {
  const t = useT();
  useTitle(t.notFound.title);
  return (
    <main class="page page-plugin" id="main">
      <div class="empty" style={{ marginTop: '40px' }}>
        <div class="empty-icon" aria-hidden="true">
          🧭
        </div>
        <h2>{t.notFound[what]}</h2>
        <p>{t.notFound.text}</p>
        <div class="empty-actions">
          <a class="btn btn-primary" href={pageHref('search')}>
            {t.notFound.toSearch}
          </a>
          <a class="btn" href={homeHref()}>
            {t.notFound.home}
          </a>
        </div>
      </div>
    </main>
  );
}
