import { CopyButton } from './CopyButton';
import { useT } from '../i18n';

/** A one-line command with a copy button, as on the design's install bars and onboarding steps. */
export function Terminal({ cmd, inlineCopy = false }: { cmd: string; inlineCopy?: boolean }) {
  const t = useT();
  return (
    <div class="terminal">
      <span class="prompt" aria-hidden="true">
        $
      </span>
      <span class="cmd" tabIndex={0}>
        {cmd}
      </span>
      {inlineCopy && <CopyButton text={cmd} label={t.start.copy} copiedLabel="✓" class="terminal-copy" title={t.start.copyTitle} />}
    </div>
  );
}
