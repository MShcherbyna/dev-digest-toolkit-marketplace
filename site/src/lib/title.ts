import { useEffect } from 'preact/hooks';
import { useT } from '../i18n';

const SITE = 'Dev Digest Toolkit';

export function useTitle(title?: string | null) {
  const t = useT();
  useEffect(() => {
    document.title = `${title ?? t.siteTitle} · ${SITE}`;
  }, [title, t]);
}
