import { useEffect, useRef, useState } from 'preact/hooks';
import { useCopy } from './toast';
import { useT } from '../i18n';

interface Props {
  text: string;
  label?: string;
  copiedLabel?: string;
  class?: string;
  title?: string;
}

export function CopyButton({ text, label, copiedLabel, class: cls = 'btn btn-sm', title }: Props) {
  const t = useT();
  const copy = useCopy();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onClick = async (ev: MouseEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (await copy(text)) {
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button type="button" class={`${cls}${copied ? ' copied' : ''}`} onClick={onClick} title={title ?? text}>
      {copied ? copiedLabel ?? t.card.copied : label ?? t.card.copyInstall}
    </button>
  );
}
