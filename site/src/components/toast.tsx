import { createContext } from 'preact';
import { useCallback, useContext, useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { copyText } from '../lib/clipboard';
import { useT } from '../i18n';

type Copy = (text: string) => Promise<boolean>;
const ToastContext = createContext<Copy>(copyText);

/** Copies text and shows the "copied" toast; the same toast reports a failed copy. */
export function ToastProvider({ children }: { children: ComponentChildren }) {
  const t = useT();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const copy = useCallback<Copy>(async (text) => {
    const ok = await copyText(text);
    setMessage({ ok, text: ok ? t.toast.copied : t.toast.failed });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), ok ? 1800 : 3500);
    return ok;
  }, [t]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={copy}>
      {children}
      <div aria-live="polite" role="status">
        {message && (
          <div class="toast">
            {message.ok && <span class="toast-ok">✓</span>} {message.text}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useCopy = () => useContext(ToastContext);
