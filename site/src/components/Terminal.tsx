import { CopyButton } from './CopyButton';

/** A one-line command with a copy button, as on the design's install bars and onboarding steps. */
export function Terminal({ cmd, inlineCopy = false }: { cmd: string; inlineCopy?: boolean }) {
  return (
    <div class="terminal">
      <span class="prompt" aria-hidden="true">
        $
      </span>
      <span class="cmd" tabIndex={0}>
        {cmd}
      </span>
      {inlineCopy && <CopyButton text={cmd} label="Copy" copiedLabel="✓" class="terminal-copy" />}
    </div>
  );
}
